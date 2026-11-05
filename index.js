import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_BASE = 'https://framethrower.ai/api/v1'
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const PRESET_PATH = join(PLUGIN_DIR, 'presets', 'moodboards.json')
const run = promisify(execFile)
const CACHE_TTL_MS = 30 * 60 * 1000
const VOCAB_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 120
const WEB_CACHE_TTL_MS = 15 * 60 * 1000
const WEB_CACHE_MAX = 80
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000
const IMAGE_MAX_BYTES = 12 * 1024 * 1024
const IMAGE_CACHE_BYTES = 64 * 1024 * 1024
// Bing retired its public image-search API in 2025, so the web source reads the
// same async fragment the site itself uses. It is a best-effort fallback: no key,
// no quota, and it can change or throttle without notice.
const WEB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/**
 * Host half: proxies FrameThrower so the browser never talks to it directly,
 * and caches search results for the session.
 */
export const inject = ['webServer']

export function apply(ctx, config) {
  const configuredToken = typeof config?.apiToken === 'string' ? config.apiToken.trim() : ''

  const cache = new Map()
  const webCache = new Map()
  const imageCache = new Map()
  let imageBytes = 0
  let vocabulary = null
  let lastDebug = null

  // the repo is pushed with the machine's own git credentials (ssh key or stored helper),
  // so no token ever has to live in the plugin config
  async function pushPresets(cfg) {
    const branch = typeof cfg?.pushBranch === 'string' && cfg.pushBranch.trim() ? cfg.pushBranch.trim() : 'main'
    const remote = typeof cfg?.pushRemote === 'string' && cfg.pushRemote.trim() ? cfg.pushRemote.trim() : 'origin'
    const opts = { cwd: PLUGIN_DIR, timeout: 25_000, maxBuffer: 1 << 20 }
    try {
      await run('git', ['add', 'presets/moodboards.json'], opts)
      try {
        await run('git', ['commit', '-m', 'Update moodboard presets'], opts)
      } catch {
        // nothing to commit is fine: the file may be identical
      }
      await run('git', ['push', remote, `HEAD:${branch}`], opts)
      return { pushed: true, branch }
    } catch (error) {
      const detail = String((error && (error.stderr || error.message)) || error).trim().split('\n').slice(-2).join(' ')
      return { pushed: false, branch, pushError: detail.slice(0, 240) }
    }
  }

  async function readPresets() {
    try {
      const parsed = JSON.parse(await readFile(PRESET_PATH, 'utf8'))
      if (Array.isArray(parsed)) return parsed
      if (parsed && Array.isArray(parsed.boards)) return parsed.boards
      return []
    } catch {
      return []
    }
  }

  async function handle(req, res) {
    let url
    try {
      url = new URL(req.url ?? '/', 'http://localhost')
    } catch {
      return send(res, 400, { error: 'bad url' })
    }
    const path = url.pathname.replace(/\/+$/, '')

    if (req.method === 'OPTIONS') return send(res, 204, null)

    if (req.method === 'GET' && path === '/anistyle/presets') {
      return send(res, 200, { source: 'presets', boards: await readPresets() })
    }

    if (req.method === 'POST' && path === '/anistyle/presets') {
      let body
      try {
        body = await readJson(req)
      } catch {
        return send(res, 400, { error: 'invalid json' })
      }
      const boards = Array.isArray(body?.boards) ? body.boards : null
      if (!boards) return send(res, 400, { error: 'boards must be an array' })
      try {
        await mkdir(dirname(PRESET_PATH), { recursive: true })
        await writeFile(PRESET_PATH, JSON.stringify(boards, null, 2) + '\n', 'utf8')
      } catch (error) {
        return send(res, 500, { error: String(error && error.message ? error.message : error) })
      }
      if (config?.autoPush === false) {
        return send(res, 200, { source: 'presets', saved: boards.length, pushed: false })
      }
      const push = await pushPresets(config)
      return send(res, 200, { source: 'presets', saved: boards.length, ...push })
    }

    if (req.method === 'GET' && path === '/anistyle/last') {
      return send(res, 200, lastDebug || { empty: true })
    }

    if (req.method === 'GET' && path === '/anistyle/vocabulary') {
      const token = resolveToken(req)
      if (!token) return send(res, 200, { source: 'unconfigured' })
      if (vocabulary && Date.now() - vocabulary.at < VOCAB_TTL_MS) {
        return send(res, 200, { source: 'vocabulary', data: vocabulary.data })
      }
      const result = await callUpstream('/animation/vocabulary', null, token, 'GET')
      if (!result.ok) return send(res, 200, result.failure)
      const data = result.json?.data ?? result.json ?? null
      vocabulary = { at: Date.now(), data }
      return send(res, 200, { source: 'vocabulary', data })
    }

    if (req.method === 'POST' && path === '/anistyle/interpret') {
      let body
      try {
        body = await readJson(req)
      } catch {
        return send(res, 400, { error: 'invalid json' })
      }
      const source = text(body?.text, 600)
      if (!source) return send(res, 200, { source: 'none' })
      const count = clampInt(body?.count, 1, 3, 3)
      const refresh = body?.refresh === true
      const { params, reason, detail } = await interpretQuery(source, count, refresh)
      return send(res, 200, params ? { source: 'model', params } : { source: 'none', reason, detail })
    }

    if (req.method === 'GET' && path === '/anistyle/img') {
      return proxyImage(url, res)
    }

    if (req.method === 'POST' && path === '/anistyle/web') {
      let body
      try {
        body = await readJson(req)
      } catch {
        return send(res, 400, { error: 'invalid json' })
      }
      return searchWeb(body, res)
    }

    if (req.method === 'POST' && (path === '/anistyle/frames' || path === '/anistyle/similar')) {
      let body
      try {
        body = await readJson(req)
      } catch {
        return send(res, 400, { error: 'invalid json' })
      }
      const token = resolveToken(req)
      if (!token) {
        return send(res, 200, {
          source: 'unconfigured',
          frames: [],
          hint: 'Add a FrameThrower API token to load real reference frames.',
        })
      }
      return path === '/anistyle/frames' ? searchFrames(body, token, res) : similarFrames(body, token, res)
    }

    return send(res, 404, { error: 'not found' })
  }

  const interpretCache = new Map()

  function styleVocabulary() {
    const data = vocabulary && vocabulary.data
    const groups = data && data.style_groups
    if (!groups || typeof groups !== 'object') return []
    const values = []
    for (const list of Object.values(groups)) {
      if (!Array.isArray(list)) continue
      for (const entry of list) {
        const value = typeof entry === 'string' ? entry : entry && entry.value
        if (typeof value === 'string' && value) values.push(value)
      }
    }
    return values
  }

  function parseInterpret(raw) {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    let parsed
    try {
      parsed = JSON.parse(raw.slice(start, end + 1))
    } catch {
      return null
    }
    const listed = Array.isArray(parsed?.queries) ? parsed.queries : (parsed?.query ? [parsed.query] : [])
    const queries = []
    for (const item of listed) {
      let entry = text(item, 300)
      // translation is the whole point: a Chinese query means the model echoed the brief
      if (!entry || /[\u3400-\u9fff]/.test(entry)) continue
      // a stray long sentence makes the search muddy, so hard-cap each one
      const words = entry.split(/\s+/).filter(Boolean)
      if (words.length > 18) entry = words.slice(0, 18).join(' ').replace(/[,;:]+$/, '')
      if (!queries.includes(entry)) queries.push(entry)
      if (queries.length === 3) break
    }
    const listedWeb = Array.isArray(parsed?.web) ? parsed.web : (typeof parsed?.web === 'string' ? [parsed.web] : [])
    const web = []
    for (const item of listedWeb) {
      let entry = text(item, 120)
      if (!entry) continue
      const words = entry.split(/\s+/).filter(Boolean)
      if (words.length > 8) entry = words.slice(0, 8).join(' ')
      if (!web.includes(entry)) web.push(entry)
      if (web.length === 3) break
    }
    if (!queries.length && !web.length) return null
    const styles = styleVocabulary()
    const style = text(parsed?.style, 80)
    const title = text(parsed?.title, 140)
    return {
      query: queries[0] || '',
      queries,
      web,
      style: style && (!styles.length || styles.includes(style)) ? style : '',
      title: title && !/[\u3400-\u9fff]/.test(title) ? title : '',
      genre: text(parsed?.genre, 60),
      perTitle: clampInt(parsed?.perTitle, 1, 6, 3),
    }
  }

  /**
   * Turn a free-form brief into retrieval terms with the default model.
   * Optional: when no model service is mounted the client falls back to its
   * local dictionary, so this never blocks a search.
   */
  async function interpretQuery(source, count, refresh) {
    const total = clampInt(count, 1, 3, 3)
    const key = total + ':' + source.toLowerCase().slice(0, 400)
    const hit = interpretCache.get(key)
    if (!refresh && hit && Date.now() - hit.at < 30 * 60 * 1000) return { params: hit.value, reason: '' }

    const llm = typeof ctx.get === 'function' ? ctx.get('llm') : undefined
    const models = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : undefined
    if (!llm) return { params: null, reason: 'no-llm' }
    if (!models) return { params: null, reason: 'no-model' }

    let selection
    try {
      selection = models.currentSelection()
    } catch {
      return { params: null, reason: 'no-model' }
    }
    const provider = selection?.provider
    const model = selection?.model
    if (!provider || !model) return { params: null, reason: 'no-model' }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const styles = styleVocabulary().slice(0, 80)
    const example = '[' + Array.from({ length: total }, () => 'string').join(', ') + ']'
    const system = [
      'You turn a creative brief into FrameThrower animation frame searches.',
      total > 1
        ? 'The library matches one single-frame description per search, so return ' + total + ' distinct readings of the brief instead of collapsing it into one scene.'
        : 'The library matches one single-frame description per search, so return one single-frame description of the brief.',
      'Its own MCP tool search_animation_frames asks for "the scene or character, as a description of one frame".',
      'Reply with one JSON object and nothing else:',
      '{"queries": ' + example + ', "web": ' + example + ', "title"?: string, "genre"?: string, "style"?: string, "perTitle"?: number}',
      total > 1
        ? 'queries: ' + total + ' short English phrases, 5-12 words each, each describing ONE frame: who or what is in it, where, and the light. The first is the most literal reading of the brief; the others explore different subjects, settings or light that still fit the mood. Each query must change at least two of subject, setting and light; never reword the same scene. If the brief is abstract (a mood, a style, a genre), imagine a different concrete scene for each query rather than one scene with synonyms.'
        : 'queries: one short English phrase, 6-14 words, describing a single frame: who or what is in it, where, and the light.',
      'Plain words, no camera jargon, no comma-piled adjectives.',
      'Shape each like: "a girl on a rooftop at dusk watching the city lights".',
      'web: ' + total + ' short keyword phrases (2-6 words each) for a web image search engine such as Bing — what a person would type to find this look.',
      'web is keywords, not a sentence: subject, setting, light, style; keep the brief\'s language unless an official English name finds better results (死神 → Bleach). Each phrase must differ.',
      'queries and web are separate: queries describe one frame for the animation library, web is an image-search phrase.',
      'Keep what the brief states and drop the rest; never invent a plot.',
      'title: when the brief names or unmistakably implies ONE animation, put its official English title',
      'the library indexes — 死神 is "Bleach", 进击的巨人 is "Attack on Titan", 双城之战 is "Arcane".',
      'A wrong title returns zero frames, so include it only when you actually know it; otherwise omit it',
      'and let the query carry the look. For a character, keep the character in the query and still name the title.',
      'genre: only when the brief explicitly names a genre. perTitle: 1-6, only when the brief implies it.',
      'queries are always English, even when the brief is Chinese.',
      styles.length ? 'style: only one of: ' + styles.join(' | ') + '. Omit it when nothing fits.' : 'style: omit it.',
      'Nothing but the JSON.',
    ].join(' ')

    // The harness builds an auxiliary call as: prepare the route (with its
    // controls), then stream `{ ...call.config, messages, system, signal }`.
    // Passing controls to stream() instead of prepareCall is what the adapters reject.
    const message = { role: 'user', content: [{ type: 'text', text: source }] }
    // auxiliary work must stay quick: when the default model thinks, an
    // explicit "off" skips that phase instead of waiting for a long reasoning run
    const leastReasoning = (controls, info) => {
      const efforts = info && info.reasoning && Array.isArray(info.reasoning.efforts) ? info.reasoning.efforts : null
      if (!efforts || !efforts.length) return controls
      return { ...controls, reasoningEffort: efforts[0].id }
    }
    const routes = [
      () => ({ provider, model, maxTokens: 1200, temperature: 1.0 }),
      () => ({ provider, model, temperature: 1.0 }),
    ]
    const errors = []
    try {
      for (const build of routes) {
        try {
          const call = await llm.prepareCall(build(), controller.signal, leastReasoning)
          const options = { ...call.config, messages: [message], system, signal: controller.signal }
          let out = ''
          let providerError = ''
          let aborted = false
          for await (const chunk of call.stream(options)) {
            if (!chunk) continue
            if (chunk.type === 'text-delta') out += chunk.text
            else if (chunk.type === 'finish') {
              if (chunk.reason?.kind === 'error') providerError = chunk.reason.failure?.message || 'provider error'
              else if (chunk.reason?.kind === 'aborted') aborted = true
            }
          }
          if (aborted) return { params: null, reason: 'timeout' }
          if (providerError && !out) { errors.push(providerError); continue }
          const params = parseInterpret(out)
          if (params) {
            interpretCache.set(key, { at: Date.now(), value: params })
            return { params, reason: '' }
          }
          if (!out.trim()) { errors.push(providerError || 'empty response'); continue }
          return { params: null, reason: 'unparsed', detail: out.trim().slice(0, 160) }
        } catch (error) {
          if (error?.name === 'AbortError') return { params: null, reason: 'timeout' }
          errors.push(String((error && error.message) || error).slice(0, 160))
        }
      }
      return { params: null, reason: 'call-failed', detail: errors.slice(0, 2).join(' | ') }
    } finally {
      clearTimeout(timer)
    }
  }

  function resolveToken(req) {
    const header = req.headers['x-ft-token']
    if (typeof header === 'string' && header.trim()) return header.trim()
    if (configuredToken) return configuredToken
    const env = typeof process !== 'undefined' ? process.env?.FRAMETHROWER_API_TOKEN : ''
    return typeof env === 'string' ? env.trim() : ''
  }

  async function searchFrames(body, token, res) {
    const query = text(body?.query, 400)
    if (!query) return send(res, 400, { error: 'missing query' })

    const payload = {
      query,
      per_title: clampInt(body?.perTitle, 1, 6, 3),
      nsfw: false,
      limit: clampInt(body?.limit, 1, 24, 24),
      offset: clampInt(body?.offset, 0, 200, 0),
    }
    const style = text(body?.style, 240)
    if (style) payload.style = style
    const genre = text(body?.genre, 120)
    if (genre) payload.genre = genre
    const title = text(body?.title, 120)
    if (title) payload.title = title

    const key = JSON.stringify(payload)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return send(res, 200, { ...cached.value, cached: true })
    }

    const result = await callUpstream('/animation/frames/search', payload, token, 'POST')
    if (!result.ok) return send(res, 200, result.failure)

    const items = pickFrames(result.json)
    const frames = normalizeFrames(items)
    const value = {
      source: 'framethrower',
      frames,
      total: numberOr(result.json?.meta?.total, items.length),
      warnings: warningsOf(result.json),
    }
    cache.set(key, { at: Date.now(), value })
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    return send(res, 200, value)
  }

  async function similarFrames(body, token, res) {
    const payload = {
      by: ['look', 'colour', 'content'].includes(body?.by) ? body.by : 'look',
      limit: clampInt(body?.limit, 1, 24, 18),
    }
    const frameIds = Array.isArray(body?.frameIds)
      ? body.frameIds.filter((id) => typeof id === 'string' && id).slice(0, 10)
      : []
    const frameId = text(body?.frameId, 200)
    const image = typeof body?.image === 'string' ? body.image.trim().slice(0, 3_000_000) : ''
    if (frameIds.length) payload.frame_ids = frameIds
    else if (frameId) payload.frame_ids = [frameId]
    else if (image) payload.image = image
    else return send(res, 400, { error: 'need frameId, frameIds or image' })

    const result = await callUpstream('/animation/frames/similar', payload, token, 'POST')
    if (!result.ok) return send(res, 200, result.failure)
    return send(res, 200, {
      source: 'framethrower',
      frames: normalizeFrames(pickFrames(result.json)),
      warnings: warningsOf(result.json),
    })
  }

  /**
   * The web source: one keyword search against Bing Images, normalized into the
   * same frame shape FrameThrower returns so the grid does not care where a tile
   * came from. No token, no quota, and no promise that the endpoint stays put.
   */
  async function searchWeb(body, res) {
    const query = text(body?.query, 300)
    if (!query) return send(res, 400, { error: 'missing query' })

    const limit = clampInt(body?.limit, 1, 40, 24)
    const offset = clampInt(body?.offset, 0, 960, 0)
    const mkt = body?.lang === 'zh' ? 'zh-CN' : 'en-US'
    const key = `${mkt}|${offset}|${limit}|${query.toLowerCase()}`

    const cached = webCache.get(key)
    if (cached && Date.now() - cached.at < WEB_CACHE_TTL_MS) {
      return send(res, 200, { ...cached.value, cached: true })
    }

    const result = await fetchBingImages(query, offset, limit, mkt)
    if (!result.ok) return send(res, 200, result.failure)

    const value = {
      source: 'chrome',
      frames: result.frames,
      total: 0,
      warnings: result.frames.length ? [] : ['web-empty'],
    }
    webCache.set(key, { at: Date.now(), value })
    if (webCache.size > WEB_CACHE_MAX) webCache.delete(webCache.keys().next().value)
    return send(res, 200, value)
  }

  /**
   * Source images are often hotlink-protected or plain http. Fetching them once
   * here keeps the grid working and avoids mixed content in the panel.
   */
  async function proxyImage(url, res) {
    const raw = url.searchParams.get('u') || ''
    let target
    try {
      target = new URL(raw)
    } catch {
      return send(res, 400, { error: 'bad image url' })
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return send(res, 400, { error: 'bad image protocol' })
    }
    if (isPrivateHost(target.hostname)) return send(res, 403, { error: 'blocked host' })

    const key = target.href
    const hit = imageCache.get(key)
    if (hit && Date.now() - hit.at < IMAGE_TTL_MS) return sendImage(res, hit)

    let upstream
    try {
      upstream = await fetch(key, {
        headers: { 'User-Agent': WEB_UA, Accept: 'image/*', Referer: target.origin + '/' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      return send(res, 502, { error: 'image fetch failed' })
    }
    if (!upstream.ok) return send(res, 502, { error: `image ${upstream.status}` })
    try {
      if (isPrivateHost(new URL(upstream.url).hostname)) return send(res, 403, { error: 'blocked redirect' })
    } catch {}

    const type = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!type.startsWith('image/')) return send(res, 415, { error: 'not an image' })
    const declared = Number(upstream.headers.get('content-length') || 0)
    if (declared > IMAGE_MAX_BYTES) return send(res, 413, { error: 'image too large' })

    let buffer
    try {
      buffer = Buffer.from(await upstream.arrayBuffer())
    } catch {
      return send(res, 502, { error: 'image unreadable' })
    }
    if (!buffer.length || buffer.length > IMAGE_MAX_BYTES) return send(res, 413, { error: 'image too large' })

    const entry = { at: Date.now(), type, buffer }
    imageCache.set(key, entry)
    imageBytes += buffer.length
    while (imageBytes > IMAGE_CACHE_BYTES && imageCache.size > 1) {
      const oldest = imageCache.keys().next().value
      const dropped = imageCache.get(oldest)
      imageCache.delete(oldest)
      imageBytes -= dropped ? dropped.buffer.length : 0
    }
    return sendImage(res, entry)
  }

  async function callUpstream(path, payload, token, method) {
    let upstream
    try {
      upstream = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
          Accept: 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      return {
        ok: false,
        failure: {
          source: 'unreachable',
          frames: [],
          hint: `FrameThrower is unreachable (${error?.name ?? 'network error'}).`,
        },
      }
    }

    if (!upstream.ok) {
      const detail = await safeText(upstream)
      const auth = upstream.status === 401 || upstream.status === 403
      const poor = upstream.status === 402
      return {
        ok: false,
        failure: {
          source: auth ? 'unauthorized' : 'upstream-error',
          status: upstream.status,
          frames: [],
          hint: auth
            ? 'FrameThrower rejected the token. Create one in Settings → API.'
            : poor
              ? 'FrameThrower credits are used up (a frame search costs 4 credits).'
              : `FrameThrower returned ${upstream.status}. ${detail.slice(0, 160)}`,
        },
      }
    }

    try {
      const json = await upstream.json()
      try {
        lastDebug = {
          at: Date.now(),
          path,
          status: upstream.status,
          keys: Object.keys(json || {}),
          count: pickFrames(json).length,
          sample: JSON.stringify(json).slice(0, 1600),
        }
      } catch {}
      return { ok: true, json }
    } catch {
      return { ok: false, failure: { source: 'unreachable', frames: [], hint: 'FrameThrower returned an unreadable body.' } }
    }
  }

  const dispose = ctx.webServer.register({ kind: 'prefix', path: '/anistyle', handler: handle })
  ctx.effect(() => dispose)
}

async function fetchBingImages(query, offset, limit, mkt) {
  const params = new URLSearchParams({
    q: query,
    first: String(offset),
    count: String(limit),
    adlt: 'strict',
    mkt,
  })
  let upstream
  try {
    upstream = await fetch(`https://www.bing.com/images/async?${params}`, {
      headers: {
        'User-Agent': WEB_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': mkt === 'zh-CN' ? 'zh-CN,zh;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
        Referer: `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    return {
      ok: false,
      failure: {
        source: 'unreachable',
        frames: [],
        hint: `Web image search is unreachable (${error?.name ?? 'network error'}).`,
      },
    }
  }

  if (!upstream.ok) {
    return {
      ok: false,
      failure: {
        source: upstream.status === 429 ? 'rate-limited' : 'upstream-error',
        status: upstream.status,
        frames: [],
        hint: upstream.status === 429
          ? 'Bing is rate-limiting image search; try again later.'
          : `Bing image search returned ${upstream.status}.`,
      },
    }
  }

  const html = await upstream.text()
  return { ok: true, frames: parseBingFrames(html) }
}

function parseBingFrames(html) {
  const frames = []
  const seen = new Set()
  const item = /class="iusc"[^>]*?\bm="([^"]+)"/g
  let match
  while ((match = item.exec(html))) {
    let payload
    try {
      payload = JSON.parse(htmlUnescape(match[1]))
    } catch {
      continue
    }
    const frame = bingToFrame(payload)
    if (!frame || seen.has(frame.id)) continue
    seen.add(frame.id)
    frames.push(frame)
    if (frames.length >= 40) break
  }
  return frames
}

function bingToFrame(item) {
  if (!item || typeof item !== 'object') return null
  const murl = typeof item.murl === 'string' ? item.murl : ''
  const turl = typeof item.turl === 'string' ? item.turl : ''
  const image = /^https?:/i.test(murl) ? murl : (/^https?:/i.test(turl) ? turl : '')
  if (!image) return null
  const thumb = /^https?:/i.test(turl) ? turl : image
  const purl = typeof item.purl === 'string' && /^https?:/i.test(item.purl) ? item.purl : image
  const hash = typeof item.md5 === 'string' && item.md5 ? item.md5 : hashUrl(image)
  const title = cleanBingTitle(item.t) || hostOf(purl)
  return {
    id: 'web_' + hash,
    src: 'chrome',
    thumb,
    // every source image goes through the local proxy: hotlink protection and
    // http-only hosts would otherwise leave holes in the grid
    image: '/anistyle/img?u=' + encodeURIComponent(image),
    original: image,
    link: purl,
    title,
    year: null,
    slug: '',
    caption: cleanText(item.desc || item.t, 220),
    tags: [],
    palette: [],
    score: null,
    episode: null,
    timecode: null,
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function cleanBingTitle(value) {
  const title = cleanText(value, 140)
  return title.replace(/\s+[-–|]\s+[^-–|]{2,48}$/, '').trim()
}

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<[^>]*>/g, ' ')
    // Bing wraps matched terms in private-use markers (U+E000/U+E001); without
    // stripping them the UI renders tofu blocks where the highlights were
    .replace(/[\uE000-\uF8FF\u200B\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function htmlUnescape(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
}

function hashUrl(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === '::1') return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
  }
  return false
}

function sendImage(res, entry) {
  res.statusCode = 200
  res.setHeader('Content-Type', entry.type)
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.end(entry.buffer)
}

/** The API documents `{ data, meta }`; animation endpoints wrap frames a few ways. */
function pickFrames(json) {
  if (!json || typeof json !== 'object') return []
  const candidates = [
    json.data, json.frames, json.results, json.items,
    json.data?.frames, json.data?.results, json.data?.items,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate
  }
  const first = candidates.find((candidate) => Array.isArray(candidate)) || []
  const nested = []
  for (const item of first) {
    if (Array.isArray(item && item.frames)) nested.push(...item.frames)
  }
  return nested.length ? nested : first
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function normalizeFrames(items) {
  if (!Array.isArray(items)) return []
  return items.slice(0, 24).map(toFrame).filter(Boolean)
}

function toFrame(item) {
  if (!item || typeof item !== 'object') return null

  // `film` for film stills, `title` (or a bare object) for animation.
  const container = item.film ?? item.title ?? item.series ?? item.animation ?? null
  const asObject = container && typeof container === 'object' ? container : null
  const title = typeof container === 'string'
    ? container
    : String(asObject?.title ?? asObject?.name ?? item.titleText ?? '')
  const year = numberOr(asObject?.year ?? item.year, null)

  const thumb = String(
    item.thumbUrl ?? item.thumbnail ?? item.thumb_url ?? item.thumbnail_url
    ?? item.thumbnailUrl ?? item.still_url ?? item.image?.thumb ?? '',
  )
  const image = String(item.imageUrl ?? item.image_url ?? item.full_url ?? item.still_url ?? thumb)
  const link = String(item.url ?? item.deepLink ?? item.deep_link ?? '')

  // The documented shape nests scene data under `metadata`; the OpenAPI schema
  // puts it at the top level. Read both.
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const palette = paletteOf(item.colorPalette ?? meta.colors ?? meta.colorPalette)

  const tags = [
    meta.shot_type ?? item.shot_type,
    meta.visual_style ?? item.visual_style,
    meta.time_of_day ?? item.time_of_day,
    meta.setting ?? item.setting,
    meta.lens_character ?? item.lens_character,
  ].filter((tag) => typeof tag === 'string' && tag).slice(0, 4)

  const caption = String(
    item.prompt ?? meta.sceneDescription ?? item.sceneDescription
    ?? item.colorDescription ?? meta.colorDescription ?? item.caption ?? item.description
    ?? [meta.shot_type, meta.setting, meta.time_of_day].filter(Boolean).join(' · '),
  ).slice(0, 280)

  if (!thumb && !image) return null

  return {
    id: String(item.id ?? ''),
    src: 'framethrower',
    thumb,
    image,
    link,
    title: title.slice(0, 120),
    year,
    slug: String(asObject?.slug ?? ''),
    caption,
    tags,
    palette,
    score: typeof item.score === 'number' ? item.score : null,
    episode: item.episode ?? item.episodeNumber ?? null,
    timecode: item.timecode ?? item.timestamp ?? item.shotTime ?? null,
  }
}

function paletteOf(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry : entry && (entry.hex ?? entry.value ?? entry.color)))
    .filter((color) => typeof color === 'string' && HEX.test(color))
    .slice(0, 6)
}

function warningsOf(json) {
  const raw = json?.meta?.warnings
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 4).map((warning) => String(warning).slice(0, 200))
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function clampInt(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(number)))
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 3 * 1024 * 1024) throw new Error('too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function safeText(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

function send(res, status, body) {
  res.statusCode = status
  if (body === null) {
    res.end()
    return
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}
