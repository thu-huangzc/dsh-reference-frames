import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_BASE = 'https://framethrower.ai/api/v1'
const LIBRARY_PATH = join(dirname(fileURLToPath(import.meta.url)), 'styles.json')
const CACHE_TTL_MS = 30 * 60 * 1000
const VOCAB_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 120

/**
 * Host half: proxies FrameThrower so the browser never talks to it directly,
 * and caches search results for the session.
 */
export const inject = ['webServer']

export function apply(ctx, config) {
  const configuredToken = typeof config?.apiToken === 'string' ? config.apiToken.trim() : ''

  const cache = new Map()
  let library = { mtime: -1, data: null }
  let vocabulary = null
  let lastDebug = null

  async function loadLibrary() {
    try {
      const info = await stat(LIBRARY_PATH)
      if (library.data && library.mtime === info.mtimeMs) return library.data
      const parsed = JSON.parse(await readFile(LIBRARY_PATH, 'utf8'))
      library = { mtime: info.mtimeMs, data: Array.isArray(parsed) ? parsed : [] }
      return library.data
    } catch {
      return library.data || []
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

    if (req.method === 'GET' && (path === '/anistyle' || path === '/anistyle/library')) {
      const styles = await loadLibrary()
      return send(res, 200, {
        version: 3,
        groups: [...new Set(styles.map((style) => style.group))],
        styles,
        hasToken: Boolean(resolveToken(req)),
      })
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
      const { params, reason, detail } = await interpretQuery(source)
      return send(res, 200, params ? { source: 'model', params } : { source: 'none', reason, detail })
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
    let query = text(parsed?.query, 300)
    // translation is the whole point: a Chinese "query" means the model echoed the brief
    if (!query || /[\u3400-\u9fff]/.test(query)) return null
    // a stray long sentence makes the search muddy, so hard-cap it regardless
    const words = query.split(/\s+/).filter(Boolean)
    if (words.length > 18) query = words.slice(0, 18).join(' ').replace(/[,;:]+$/, '')
    const styles = styleVocabulary()
    const style = text(parsed?.style, 80)
    const title = text(parsed?.title, 140)
    return {
      query,
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
  async function interpretQuery(source) {
    const key = source.toLowerCase().slice(0, 400)
    const hit = interpretCache.get(key)
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return { params: hit.value, reason: '' }

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
    const timer = setTimeout(() => controller.abort(), 8000)
    const styles = styleVocabulary().slice(0, 80)
    const system = [
      'You turn a creative brief into one FrameThrower animation frame search.',
      'The library matches a single description of ONE frame — the same shape its own MCP tool',
      'search_animation_frames asks for: "the scene or character, as a description of one frame".',
      'Reply with one JSON object and nothing else:',
      '{"query": string, "title"?: string, "genre"?: string, "style"?: string, "perTitle"?: number}',
      'query: ONE short English phrase, 6-14 words, describing a single frame: who or what is in it,',
      'where, and the light. Plain words, no camera jargon, no comma-piled adjectives.',
      'Shape it like: "a girl on a rooftop at dusk watching the city lights".',
      'Keep what the brief states and drop the rest; never invent a plot.',
      'title: when the brief names or unmistakably implies ONE animation, put its official English title',
      'the library indexes — 死神 is "Bleach", 进击的巨人 is "Attack on Titan", 双城之战 is "Arcane".',
      'A wrong title returns zero frames, so include it only when you actually know it; otherwise omit it',
      'and let the query carry the look. For a character, keep the character in the query and still name the title.',
      'genre: only when the brief explicitly names a genre. perTitle: 1-6, only when the brief implies it.',
      'Always English, even when the brief is Chinese.',
      styles.length ? 'style: only one of: ' + styles.join(' | ') + '. Omit it when nothing fits.' : 'style: omit it.',
      'Nothing but the JSON.',
    ].join(' ')

    // The harness builds an auxiliary call as: prepare the route (with its
    // controls), then stream `{ ...call.config, messages, system, signal }`.
    // Passing controls to stream() instead of prepareCall is what the adapters reject.
    const message = { role: 'user', content: [{ type: 'text', text: source }] }
    const routes = [
      () => ({ provider, model, maxTokens: 240 }),
      () => ({ provider, model }),
    ]
    const errors = []
    try {
      for (const build of routes) {
        try {
          const call = await llm.prepareCall(build(), controller.signal)
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
