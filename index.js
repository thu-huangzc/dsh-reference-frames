import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_BASE = 'https://framethrower.ai/api/v1'
// FrameThrower keeps three independent libraries behind one token. The client
// treats each as its own switchable source; the host maps a source to the right
// endpoints and normalizes the three different response shapes into one frame.
const FRAME_SOURCES = {
  animation: {
    search: '/animation/frames/search',
    similar: '/animation/frames/similar',
  },
  film: {
    search: '/search',
    similar: '/similar',
    // no image endpoint: /search/image only accepts a publicly reachable imageUrl
  },
  commercial: {
    search: '/commercials/shots/search',
    similar: '/commercials/shots/similar',
    image: '/commercials/shots/image',
  },
}
const FRAME_SOURCE_KEYS = Object.keys(FRAME_SOURCES)
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
// a successful update check costs one `git fetch`; keep it out of the way for
// a while, but retry a failed fetch sooner so a flaky network heals quickly
const UPDATE_TTL_MS = 10 * 60 * 1000
const UPDATE_RETRY_TTL_MS = 60 * 1000
// Web image search reads public endpoints: Bing Images' server-rendered result
// page first, with DuckDuckGo's Bing-backed image endpoint as a fallback. No
// key, no quota, and the endpoints can change or throttle without notice.
const WEB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const NON_LATIN_RE = /[\u0370-\u03ff\u0400-\u052f\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/

/** Pick the search market from the query itself, not from the panel UI. */
function marketFor(query) {
  const value = String(query || '')
  if (/[\u3040-\u30ff]/.test(value)) return 'ja-JP'
  if (/[\uac00-\ud7af]/.test(value)) return 'ko-KR'
  if (/[\u3400-\u9fff]/.test(value)) return 'zh-CN'
  if (/[\u0400-\u052f]/.test(value)) return 'ru-RU'
  if (/[\u0600-\u06ff]/.test(value)) return 'ar'
  if (/[\u0590-\u05ff]/.test(value)) return 'he-IL'
  if (/[\u0e00-\u0e7f]/.test(value)) return 'th-TH'
  if (/[\u0900-\u097f]/.test(value)) return 'hi-IN'
  return 'en-US'
}

function acceptLanguage(mkt) {
  const market = String(mkt || 'en-US')
  const base = market.split('-')[0]
  if (base === 'en') return 'en-US,en;q=0.9'
  if (!market.includes('-')) return `${market},en;q=0.8`
  return `${market},${base};q=0.9,en;q=0.8`
}

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
  const interpretCache = new Map()
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

  // ---------------------------------------------------------------- 版本更新
  // 插件本身就是一份 git 检出：查更新是 fetch 之后比较 HEAD 与 origin/<分支>，
  // 更新是只允许 fast-forward 的合并。整个过程不碰工作区里未提交的改动，
  // 也没有任何东西要写回磁盘以外的位置。
  const updateRemote = typeof config?.pushRemote === 'string' && config.pushRemote.trim()
    ? config.pushRemote.trim()
    : 'origin'
  const updateBranch = typeof config?.pushBranch === 'string' && config.pushBranch.trim()
    ? config.pushBranch.trim()
    : 'main'
  const updateRef = updateRemote + '/' + updateBranch
  let updateCache = null

  const git = (args, timeout) => run('git', args, {
    cwd: PLUGIN_DIR,
    timeout: timeout || 25_000,
    maxBuffer: 1 << 20,
  })

  function gitDetail(error) {
    const lines = String((error && (error.stderr || error.message)) || error)
      .split('\n').map((line) => line.trim()).filter(Boolean)
    const errors = lines.filter((line) => /^(?:fatal|error)\b/i.test(line))
    return (errors.slice(0, 2).join(' ') || lines.slice(-2).join(' ')).slice(0, 240)
  }

  async function gitCount(range) {
    const out = await git(['rev-list', '--count', range], 10_000)
    return Number.parseInt(String(out.stdout).trim(), 10) || 0
  }

  async function packageVersion(ref) {
    try {
      const raw = ref
        ? String((await git(['show', ref + ':package.json'], 10_000)).stdout)
        : await readFile(join(PLUGIN_DIR, 'package.json'), 'utf8')
      const parsed = JSON.parse(raw)
      return typeof parsed?.version === 'string' ? parsed.version : ''
    } catch {
      return ''
    }
  }

  async function checkForUpdate(force) {
    const cached = updateCache
    const fresh = cached && Date.now() - cached.at < (cached.value.ok ? UPDATE_TTL_MS : UPDATE_RETRY_TTL_MS)
    if (!force && fresh) return cached.value

    const base = {
      source: 'update',
      remote: updateRemote,
      branch: updateBranch,
      current: await packageVersion(''),
    }
    const remember = (value) => {
      updateCache = { at: Date.now(), value }
      return value
    }

    try {
      await git(['rev-parse', '--is-inside-work-tree'], 8_000)
    } catch {
      return remember({ ...base, ok: false, reason: 'no-repo' })
    }

    try {
      await git(['fetch', '--quiet', '--no-tags', updateRemote, updateBranch], 20_000)
    } catch (error) {
      // keep the last good answer when we already had one; offline should not
      // hide a known update
      if (cached && cached.value.ok) return cached.value
      return remember({ ...base, ok: false, reason: 'offline', detail: gitDetail(error) })
    }

    let behind = 0
    let ahead = 0
    try {
      behind = await gitCount('HEAD..' + updateRef)
      ahead = await gitCount(updateRef + '..HEAD')
    } catch (error) {
      return remember({ ...base, ok: false, reason: 'no-branch', detail: gitDetail(error) })
    }

    let head = ''
    try { head = String((await git(['rev-parse', updateRef], 10_000)).stdout).trim() } catch {}
    let commits = []
    if (behind > 0) {
      try {
        const out = String((await git(['log', '--max-count=6', '--format=%h%x1f%s', 'HEAD..' + updateRef], 10_000)).stdout)
        commits = out.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
          const parts = line.split('\x1f')
          return { hash: parts[0] || '', subject: parts.slice(1).join(' ') || '' }
        })
      } catch {}
    }
    const latest = behind > 0 ? await packageVersion(updateRef) : base.current
    return remember({
      ...base,
      ok: true,
      behind,
      ahead,
      head,
      latest: latest || base.current,
      commits,
      checkedAt: Date.now(),
    })
  }

  // paths a page reload picks up on its own; anything else means the host code
  // changed and the app has to come back up before the update is really in
  function isClientOnlyPath(path) {
    if (!path) return false
    if (path === 'client.js' || path === 'icon.svg') return true
    if (path === 'README.md' || path === 'CHANGELOG.md' || path === 'LICENSE' || path === '.gitignore') return true
    return path.startsWith('locale/') || path.startsWith('presets/') || path.startsWith('docs/')
  }

  async function changedFiles(from, to) {
    if (!from || !to || from === to) return []
    try {
      const out = String((await git(['diff', '--name-only', from + '..' + to], 15_000)).stdout)
      return out.split('\n').map((line) => line.trim()).filter(Boolean)
    } catch {
      return null
    }
  }

  /** Active turns, queued steps and running jobs — the same work the desktop asks about before quitting. */
  async function hasUnfinishedWork() {
    const agents = typeof ctx.get === 'function' ? ctx.get('agents') : undefined
    const jobs = typeof ctx.get === 'function' ? ctx.get('jobs') : undefined
    if (!agents || !jobs || typeof agents.list !== 'function' || typeof jobs.list !== 'function') return false
    let live = []
    try { live = agents.list() || [] } catch { return false }
    const busy = live.some((agent) => agent && (agent.status === 'running'
      || (agent.inbox && agent.inbox.nextTurn && agent.inbox.nextTurn.length > 0)
      || (agent.inbox && agent.inbox.nextStep && agent.inbox.nextStep.length > 0)))
      || [undefined, ...live].some((agent) => {
        try {
          return jobs.list(agent && agent.id).some((job) => job && (job.status === 'running' || job.status === 'stopping'))
        } catch {
          return false
        }
      })
    if (busy) return true
    // armed reminders make the desktop ask before quitting, so treat them as work
    if (typeof ctx.waterfall !== 'function') return false
    for (const agent of live) {
      try {
        const entries = await ctx.waterfall('workspace/session-activity', { sessionId: agent && agent.id }, () => Promise.resolve([]))
        if (Array.isArray(entries) && entries.some((entry) => entry && entry.kind === 'schedule')) return true
      } catch {}
    }
    return false
  }

  /**
   * Relaunch the desktop app so both halves boot from the new checkout.
   * The helper is detached so it outlives this process when the app quits.
   * When the app is idle its own quit path is silent; we only get here when
   * nothing is running, so no confirmation box should appear.
   */
  function relaunchDesktopApp() {
    const quit = 'tell application id "com.deepseek.dsh" to quit'
    const script = [
      'sleep 1.2',
      'osascript -e ' + JSON.stringify(quit) + ' >/dev/null 2>&1 || osascript -e ' + JSON.stringify('tell application "DeepSeek Harness" to quit') + ' >/dev/null 2>&1',
      'i=0',
      'while pgrep -x "DeepSeek Harness" >/dev/null 2>&1; do i=$((i+1)); [ "$i" -ge 16 ] && break; sleep 0.5; done',
      'open -b com.deepseek.dsh >/dev/null 2>&1 || open -a "DeepSeek Harness" >/dev/null 2>&1',
    ].join('; ')
    try {
      const child = spawn('sh', ['-c', script], { detached: true, stdio: 'ignore' })
      child.on('error', () => {})
      child.unref()
      return true
    } catch {
      return false
    }
  }

  async function restartApp(desktop) {
    if (!desktop) return { ok: false, reason: 'not-desktop' }
    if (process.platform !== 'darwin') return { ok: false, reason: 'unsupported' }
    if (await hasUnfinishedWork()) return { ok: false, reason: 'busy' }
    if (!relaunchDesktopApp()) return { ok: false, reason: 'unsupported' }
    return { ok: true, reason: 'restarting' }
  }

  async function applyUpdate(desktop) {
    const from = await packageVersion('')
    try {
      await git(['rev-parse', '--is-inside-work-tree'], 8_000)
    } catch {
      return { ok: false, reason: 'no-repo' }
    }
    let onBranch = ''
    try {
      onBranch = String((await git(['rev-parse', '--abbrev-ref', 'HEAD'], 8_000)).stdout).trim()
    } catch {}
    if (onBranch && onBranch !== 'HEAD' && onBranch !== updateBranch) {
      return { ok: false, reason: 'wrong-branch', detail: onBranch }
    }
    try {
      await git(['fetch', '--quiet', '--no-tags', updateRemote, updateBranch], 20_000)
    } catch (error) {
      return { ok: false, reason: 'offline', detail: gitDetail(error) }
    }
    let behind = 0
    let ahead = 0
    try {
      behind = await gitCount('HEAD..' + updateRef)
      ahead = await gitCount(updateRef + '..HEAD')
    } catch {}
    if (!behind) return { ok: true, upToDate: true, from, to: from, action: 'none' }
    // a fast-forward cannot land on a diverged branch; say so before git does
    if (ahead) return { ok: false, reason: 'diverged', detail: ahead + ' local commit(s)' }
    let beforeSha = ''
    try { beforeSha = String((await git(['rev-parse', 'HEAD'], 8_000)).stdout).trim() } catch {}
    try {
      await git(['merge', '--ff-only', updateRef], 30_000)
    } catch (error) {
      // a failed merge leaves the tree as it was; drop the cached "behind"
      // answer so the next check re-reads the real state
      updateCache = null
      return { ok: false, reason: 'conflict', detail: gitDetail(error) }
    }
    updateCache = null
    const to = await packageVersion('')
    let afterSha = ''
    try { afterSha = String((await git(['rev-parse', 'HEAD'], 8_000)).stdout).trim() } catch {}
    const files = await changedFiles(beforeSha, afterSha)
    const result = { ok: true, from, to: to || from, behind, files: Array.isArray(files) ? files.slice(0, 20) : [] }

    // a client-only change is live after a reload; host code needs a restart.
    // `files === null` means the diff could not be read — assume the worst.
    if (Array.isArray(files) && files.length === 0) return { ...result, action: 'reload' }
    if (Array.isArray(files) && files.every(isClientOnlyPath)) return { ...result, action: 'reload' }

    const restart = await restartApp(desktop)
    if (restart.ok) return { ...result, action: 'restart' }
    return { ...result, action: restart.reason === 'busy' ? 'busy' : 'manual' }
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

    // "清空": wipe every in-memory cache so the next search / "换一批" is fresh.
    // Best-effort from the client (no auth, nothing except caches is touched).
    if (req.method === 'POST' && path === '/anistyle/clear-cache') {
      try { await readJson(req) } catch {}
      const cleared = {
        frames: cache.size,
        web: webCache.size,
        images: imageCache.size,
        interpret: interpretCache.size,
        vocabulary: vocabulary ? 1 : 0,
      }
      cache.clear()
      webCache.clear()
      imageCache.clear()
      imageBytes = 0
      interpretCache.clear()
      vocabulary = null
      lastDebug = null
      return send(res, 200, { ok: true, cleared })
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

    if (req.method === 'POST' && path === '/anistyle/interpret-image') {
      let body
      try {
        body = await readJson(req)
      } catch {
        return send(res, 400, { error: 'invalid json' })
      }
      const { ok, web, reason, detail } = await describeImageForWeb(body)
      return send(res, 200, ok ? { source: 'model', params: { web } } : { source: 'none', reason, detail })
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

    if (req.method === 'GET' && path === '/anistyle/update') {
      const force = url.searchParams.get('refresh') === '1'
      return send(res, 200, await checkForUpdate(force))
    }

    if (req.method === 'POST' && path === '/anistyle/update') {
      let body = {}
      try { body = await readJson(req) } catch {}
      return send(res, 200, await applyUpdate(body?.desktop === true))
    }

    if (req.method === 'POST' && path === '/anistyle/restart') {
      let body = {}
      try { body = await readJson(req) } catch {}
      return send(res, 200, await restartApp(body?.desktop === true))
    }

    return send(res, 404, { error: 'not found' })
  }

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
      // translation is the whole point: a non-Latin query means the model
      // echoed the brief instead of translating it for FrameThrower
      if (!entry || NON_LATIN_RE.test(entry)) continue
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
      title: title && !NON_LATIN_RE.test(title) ? title : '',
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
      'You turn a creative brief into FrameThrower frame searches (animation, film stills and commercial shots all share one English frame-description register).',
      'The brief can arrive in any language — Chinese, Japanese, Korean, French, Spanish, and so on. Detect it, translate the meaning, and never assume the brief is Chinese.',
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
      'web: ' + total + ' short keyword phrases (2-6 words each) for a web image search engine — what a person would type to find this look.',
      'web is keywords, not a sentence: subject, setting, light, style. Write each phrase in the brief\'s own language when that language works for image search (中文、日本語、한국어、français, ...); switch a title to its official English name only when that finds better images (死神 → Bleach, 鬼滅の刃 → Demon Slayer). Never mix languages inside one phrase. Each phrase must differ.',
      'queries and web are separate: queries describe one frame for the FrameThrower libraries, web is an image-search phrase.',
      'Keep what the brief states and drop the rest; never invent a plot.',
      'title: when the brief names or unmistakably implies ONE animation, put its official English title',
      'the library indexes — 死神 is "Bleach", 进击的巨人 is "Attack on Titan", 双城之战 is "Arcane".',
      'A wrong title returns zero frames, so include it only when you actually know it; otherwise omit it',
      'and let the query carry the look. For a character, keep the character in the query and still name the title.',
      'genre: only when the brief explicitly names a genre. perTitle: 1-6, only when the brief implies it.',
      'queries are always English, no matter what language the brief is written in (Chinese, Japanese, Korean, French, Spanish, and so on). Translate the meaning; never echo non-English words into queries.',
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

  /**
   * Turn one attached image into web image-search phrases with the default
   * vision model. FrameThrower already accepts the image directly; this is the
   * bridge for the text-only Bing source. The image is admitted through the
   * host attachment store first, because model messages carry durable image
   * references rather than inline base64.
   */
  async function describeImageForWeb(body) {
    const parsedImage = parseImageDataUrl(body?.image)
    if (!parsedImage) return { ok: false, reason: 'bad-image' }
    const note = text(body?.text, 600)
    const count = clampInt(body?.count, 1, 3, 3)

    const llm = typeof ctx.get === 'function' ? ctx.get('llm') : undefined
    const models = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : undefined
    const attachments = typeof ctx.get === 'function' ? ctx.get('attachments') : undefined
    if (!llm) return { ok: false, reason: 'no-llm' }
    if (!models) return { ok: false, reason: 'no-model' }
    if (!attachments || typeof attachments.admitPromptContent !== 'function') {
      return { ok: false, reason: 'no-attachments' }
    }

    let selection
    try {
      selection = models.currentSelection()
    } catch {
      return { ok: false, reason: 'no-model' }
    }
    const provider = selection?.provider
    const model = selection?.model
    if (!provider || !model) return { ok: false, reason: 'no-model' }

    let modelInfo = null
    try {
      if (typeof llm.resolveModelInfo === 'function') modelInfo = await llm.resolveModelInfo(provider, model)
    } catch {}
    if (modelInfo && Array.isArray(modelInfo.inputModalities) && !modelInfo.inputModalities.includes('image')) {
      return { ok: false, reason: 'no-vision' }
    }

    let admitted
    try {
      admitted = await attachments.admitPromptContent([{
        type: 'image',
        mediaType: parsedImage.mediaType,
        data: parsedImage.data,
      }])
    } catch (error) {
      return { ok: false, reason: 'image-rejected', detail: String((error && error.message) || error).slice(0, 160) }
    }
    const imagePart = Array.isArray(admitted)
      ? admitted.find((part) => part && part.type === 'image' && part.attachment)
      : null
    if (!imagePart) return { ok: false, reason: 'image-rejected' }

    const example = '[' + Array.from({ length: count }, () => '"string"').join(', ') + ']'
    const system = [
      'You help a person find visually similar reference images on the web.',
      'Look carefully at the attached image and decide what a search engine should look for.',
      'Reply with one JSON object and nothing else:',
      '{"web":' + example + '}',
      'web: ' + count + ' short keyword phrases (2-6 words each) for a web image search engine such as DuckDuckGo or Bing.',
      'Say what is visible: subject, setting, light, colour, composition and style.',
      'The note can be in any language; detect it. Write the phrases in the note\'s language when there is one, otherwise use English, which works across the engines.',
      'If the image is a collage, moodboard or screenshot, describe the pictures inside it rather than the app interface or its text.',
      'Do not name an animation, film or artist unless the image itself proves it.',
      'The phrases must differ from each other and must be keywords, not sentences.',
      note
        ? 'The user added this note; use it as context, but never let it override what the image shows: ' + JSON.stringify(note)
        : 'There is no additional note.',
      'Nothing but the JSON.',
    ].join(' ')

    const message = {
      role: 'user',
      content: [
        { type: 'text', text: note ? 'User note: ' + note : 'Describe this image for an image search.' },
        imagePart,
      ],
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
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
          if (aborted) return { ok: false, reason: 'timeout' }
          if (providerError && !out) { errors.push(providerError); continue }
          const web = parseImageWebQueries(out)
          if (web) return { ok: true, web }
          if (!out.trim()) { errors.push(providerError || 'empty response'); continue }
          return { ok: false, reason: 'unparsed', detail: out.trim().slice(0, 160) }
        } catch (error) {
          if (error?.name === 'AbortError') return { ok: false, reason: 'timeout' }
          const detail = String((error && error.message) || error).slice(0, 160)
          if (!errors.includes(detail)) errors.push(detail)
        }
      }
      return { ok: false, reason: 'call-failed', detail: errors.slice(0, 2).join(' | ') }
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

  function frameKind(value) {
    const kind = text(value, 20)
    return FRAME_SOURCE_KEYS.includes(kind) ? kind : 'animation'
  }

  async function searchFrames(body, token, res) {
    const query = text(body?.query, 400)
    if (!query) return send(res, 400, { error: 'missing query' })

    const kind = frameKind(body?.source)
    const spec = FRAME_SOURCES[kind]
    const payload = { query }

    if (kind === 'animation') {
      payload.per_title = clampInt(body?.perTitle, 1, 6, 3)
      payload.nsfw = false
      payload.limit = clampInt(body?.limit, 1, 24, 24)
      payload.offset = clampInt(body?.offset, 0, 200, 0)
      const style = text(body?.style, 240)
      if (style) payload.style = style
      const genre = text(body?.genre, 120)
      if (genre) payload.genre = genre
      const title = text(body?.title, 120)
      if (title) payload.title = title
    } else if (kind === 'film') {
      payload.limit = clampInt(body?.limit, 1, 50, 24)
      payload.offset = clampInt(body?.offset, 0, 500, 0)
      payload.mode = 'hybrid'
      const genre = text(body?.genre, 120)
      if (genre) payload.genre = genre
      const title = text(body?.title, 120)
      if (title) payload.film_title = title
    } else {
      payload.limit = clampInt(body?.limit, 1, 50, 24)
      payload.offset = clampInt(body?.offset, 0, 150, 0)
      payload.per_spot = clampInt(body?.perSpot, 1, 6, 3)
    }

    const key = kind + '|' + JSON.stringify(payload)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return send(res, 200, { ...cached.value, cached: true })
    }

    const result = await callUpstream(spec.search, payload, token, 'POST')
    if (!result.ok) return send(res, 200, result.failure)

    const items = pickFrames(result.json)
    const frames = normalizeFrames(items, kind)
    const value = {
      source: 'framethrower',
      kind,
      frames,
      total: numberOr(result.json?.meta?.total, items.length),
      warnings: warningsOf(result.json),
    }
    cache.set(key, { at: Date.now(), value })
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    return send(res, 200, value)
  }

  async function similarFrames(body, token, res) {
    const kind = frameKind(body?.source)
    const spec = FRAME_SOURCES[kind]
    const limit = clampInt(body?.limit, 1, 24, 18)
    const frameIds = Array.isArray(body?.frameIds)
      ? body.frameIds.filter((id) => typeof id === 'string' && id).slice(0, 10)
      : []
    const frameId = text(body?.frameId, 200)
    const image = typeof body?.image === 'string' ? body.image.trim().slice(0, 3_000_000) : ''
    if (!frameIds.length && !frameId && !image) {
      return send(res, 400, { error: 'need frameId, frameIds or image' })
    }

    let payload
    let path = spec.similar
    if (kind === 'animation') {
      payload = { by: ['look', 'colour', 'content'].includes(body?.by) ? body.by : 'look', limit }
      if (frameIds.length) payload.frame_ids = frameIds
      else if (frameId) payload.frame_ids = [frameId]
      else payload.image = image
    } else if (kind === 'film') {
      if (image && !frameIds.length && !frameId) {
        return send(res, 200, {
          source: 'unsupported',
          frames: [],
          hint: 'Film stills cannot search by image: the API needs a publicly reachable image URL.',
        })
      }
      payload = {
        mode: ['look', 'colour', 'content'].includes(body?.by) ? { look: 'visual', colour: 'color', content: 'semantic' }[body.by] : 'visual',
        limit,
      }
      if (frameIds.length) payload.frameIds = frameIds
      else payload.frameId = frameId
    } else {
      payload = { limit }
      if (frameIds.length) payload.shot_ids = frameIds
      else if (frameId) payload.shot_ids = [frameId]
      else {
        path = spec.image
        payload.imageUrl = image
        payload.per_spot = clampInt(body?.perSpot, 1, 6, 3)
      }
    }

    const result = await callUpstream(path, payload, token, 'POST')
    if (!result.ok) return send(res, 200, result.failure)
    return send(res, 200, {
      source: 'framethrower',
      kind,
      frames: normalizeFrames(pickFrames(result.json), kind),
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
    const mkt = marketFor(query)
    const key = `${mkt}|${offset}|${limit}|${query.toLowerCase()}`

    const cached = webCache.get(key)
    if (cached && Date.now() - cached.at < WEB_CACHE_TTL_MS) {
      return send(res, 200, { ...cached.value, cached: true })
    }

    const result = await fetchWebImages(query, offset, limit, mkt)
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

    const declared = Number(upstream.headers.get('content-length') || 0)
    if (declared > IMAGE_MAX_BYTES) return send(res, 413, { error: 'image too large' })

    let buffer
    try {
      buffer = Buffer.from(await upstream.arrayBuffer())
    } catch {
      return send(res, 502, { error: 'image unreadable' })
    }
    if (!buffer.length || buffer.length > IMAGE_MAX_BYTES) return send(res, 413, { error: 'image too large' })

    // some hosts (naruto-official.com among them) serve a real webp as
    // application/octet-stream; sniff the bytes rather than leave a hole
    const declaredType = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const type = declaredType.startsWith('image/') ? declaredType : sniffImageType(buffer)
    if (!type) return send(res, 415, { error: 'not an image' })

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
              ? 'FrameThrower credits are used up.'
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

/**
 * The web source. Bing Images' full search page is tried first for every
 * language, with DuckDuckGo's Bing-backed image endpoint as the fallback. A
 * query that finds nothing in one engine can still find something in the other;
 * a challenge page or a parser change in one endpoint does not take the whole
 * source down. Bing's `/images/async` fragment is no longer used: since 2026 it
 * answers a plain request with a script-only stub and no result markup.
 */
async function fetchWebImages(query, offset, limit, mkt) {
  const attempts = [fetchBingImages, fetchDuckDuckGoImages]
  const failures = []
  let sawSuccess = false
  for (const attempt of attempts) {
    let result
    try {
      result = await attempt(query, offset, limit, mkt)
    } catch (error) {
      failures.push({ source: 'unreachable', frames: [], hint: String((error && error.message) || error).slice(0, 160) })
      continue
    }
    if (result.ok) {
      sawSuccess = true
      if (result.frames.length) return result
    } else if (result.failure) {
      failures.push(result.failure)
    }
  }
  if (sawSuccess) return { ok: true, frames: [], engine: 'web' }
  return {
    ok: false,
    failure: failures[0] || { source: 'unreachable', frames: [], hint: 'Web image search is unreachable.' },
  }
}

async function fetchDuckDuckGoImages(query, offset, limit, mkt) {
  const headers = {
    'User-Agent': WEB_UA,
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': acceptLanguage(mkt),
  }
  let page
  try {
    page = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
      headers,
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
  if (!page.ok) {
    return {
      ok: false,
      failure: {
        source: page.status === 429 ? 'rate-limited' : 'upstream-error',
        status: page.status,
        frames: [],
        hint: page.status === 429
          ? 'DuckDuckGo is rate-limiting image search; try again later.'
          : `DuckDuckGo image search returned ${page.status}.`,
      },
    }
  }
  const html = await page.text()
  const token = /vqd=["']?([\d-]+)["']?/.exec(html)
  if (!token) return { ok: true, frames: [], engine: 'ddg' }

  const params = new URLSearchParams({
    l: 'wt-wt',
    o: 'json',
    q: query,
    vqd: token[1],
    f: ',,,,',
    p: String(Math.floor(offset / 100) + 1),
    s: String(offset),
  })
  let payload
  try {
    payload = await fetch(`https://duckduckgo.com/i.js?${params}`, {
      headers: {
        ...headers,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: 'https://duckduckgo.com/',
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
  if (!payload.ok) {
    return {
      ok: false,
      failure: {
        source: payload.status === 429 ? 'rate-limited' : 'upstream-error',
        status: payload.status,
        frames: [],
        hint: payload.status === 429
          ? 'DuckDuckGo is rate-limiting image search; try again later.'
          : `DuckDuckGo image search returned ${payload.status}.`,
      },
    }
  }
  let data
  try {
    data = await payload.json()
  } catch {
    return { ok: true, frames: [], engine: 'ddg' }
  }
  return { ok: true, frames: parseDdgFrames(data, limit), engine: 'ddg' }
}

function parseDdgFrames(data, limit) {
  const items = data && Array.isArray(data.results) ? data.results : []
  const frames = []
  const seen = new Set()
  for (const item of items) {
    const frame = ddgToFrame(item)
    if (!frame || seen.has(frame.id)) continue
    seen.add(frame.id)
    frames.push(frame)
    if (frames.length >= Math.min(limit || 40, 40)) break
  }
  return frames
}

function ddgToFrame(item) {
  if (!item || typeof item !== 'object') return null
  const image = firstHttp([item.image, item.thumbnail])
  if (!image) return null
  const thumb = firstHttp([item.thumbnail, item.image, image])
  const purl = firstHttp([item.url]) || image
  const hash = typeof item.image_token === 'string' && item.image_token
    ? item.image_token.slice(0, 32)
    : hashUrl(image)
  const title = cleanBingTitle(item.title) || hostOf(purl)
  return {
    id: 'web_' + hash,
    src: 'chrome',
    thumb,
    image: '/anistyle/img?u=' + encodeURIComponent(image),
    original: image,
    link: purl,
    title,
    year: null,
    slug: '',
    caption: cleanText(item.title, 220),
    tags: [],
    palette: [],
    score: null,
    episode: null,
    timecode: null,
  }
}

function firstHttp(values) {
  for (const value of values) {
    if (typeof value === 'string' && /^https?:/i.test(value)) return value
  }
  return ''
}

async function fetchBingImages(query, offset, limit, mkt) {
  // `first` is 1-based; the async fragment Bing used to serve for scripts is
  // gone, so read the same server-rendered page a browser lands on
  const params = new URLSearchParams({
    q: query,
    first: String(offset + 1),
    count: String(Math.min(Math.max(limit, 1), 35)),
    adlt: 'strict',
    mkt,
    form: 'HDRSC3',
    qs: 'n',
    sp: '-1',
    pq: query,
  })
  let upstream
  try {
    upstream = await fetch(`https://www.bing.com/images/search?${params}`, {
      headers: {
        'User-Agent': WEB_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': acceptLanguage(mkt),
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
  const frames = parseBingFrames(html, limit)
  if (frames.length) return { ok: true, frames, engine: 'bing' }
  // an empty grid and a human check both parse to nothing; say which one it was
  if (/captcha|challenge|verify (that )?you are (a )?human/i.test(html)) {
    return {
      ok: false,
      failure: {
        source: 'rate-limited',
        frames: [],
        hint: 'Bing answered with a human check; try again later.',
      },
    }
  }
  return { ok: true, frames: [], engine: 'bing' }
}

function parseBingFrames(html, limit) {
  const max = Math.min(Math.max(limit || 0, 1), 40)
  const frames = []
  const seen = new Set()
  const item = /class="[^"]*\biusc\b[^"]*"[^>]*?\bm="([^"]+)"/g
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
    if (frames.length >= max) break
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

/** Detect an image from its first bytes when the server's type is missing or wrong. */
function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return ''
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer.toString('latin1', 1, 4) === 'PNG') return 'image/png'
  if (buffer.toString('latin1', 0, 4) === 'GIF8') return 'image/gif'
  if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  if (buffer.toString('latin1', 4, 8) === 'ftyp' && /^avi[fs]$|^heic$|^mif1$/.test(buffer.toString('latin1', 8, 12))) return 'image/avif'
  return ''
}

function sendImage(res, entry) {
  res.statusCode = 200
  res.setHeader('Content-Type', entry.type)
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.end(entry.buffer)
}

/** The API documents `{ data, meta }`; the three libraries wrap frames a few ways. */
function pickFrames(json) {
  if (!json || typeof json !== 'object') return []
  const candidates = [
    json.data, json.frames, json.results, json.items, json.shots, json.spots,
    json.data?.frames, json.data?.results, json.data?.items, json.data?.shots, json.data?.spots,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate
  }
  const first = candidates.find((candidate) => Array.isArray(candidate)) || []
  const nested = []
  for (const item of first) {
    if (Array.isArray(item && item.frames)) nested.push(...item.frames)
    else if (Array.isArray(item && item.shots)) nested.push(...item.shots)
  }
  return nested.length ? nested : first
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function normalizeFrames(items, kind) {
  if (!Array.isArray(items)) return []
  return items.slice(0, 24).map((item) => toFrame(item, kind)).filter(Boolean)
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value) return value
  }
  return ''
}

function toFrame(item, kind) {
  if (!item || typeof item !== 'object') return null

  // `film` for film stills, `title` (or a bare object) for animation,
  // `spot` / `commercial` / `ad` for a shot inside an ad.
  const container = item.film ?? item.title ?? item.series ?? item.animation
    ?? item.spot ?? item.commercial ?? item.ad ?? null
  const asObject = container && typeof container === 'object' ? container : null
  const spot = kind === 'commercial'
    ? (item.spot ?? item.commercial ?? item.ad ?? asObject)
    : null
  let title = typeof container === 'string'
    ? container
    : String(asObject?.title ?? asObject?.name ?? item.titleText ?? (typeof item.title === 'string' ? item.title : '') ?? '')
  if (kind === 'commercial') {
    const brand = firstString(spot?.brand, item.brand, item.spot_brand, item.brand_name, item.brandName, item.advertiser)
    const name = firstString(
      spot?.title, item.spotTitle, item.spot_title, item.ad_title, item.adTitle,
      typeof item.title === 'string' ? item.title : '', asObject?.name,
    )
    title = [brand, name].filter(Boolean).join(' · ')
  }
  const year = numberOr(spot?.year ?? item.spot_year ?? item.spotYear ?? asObject?.year ?? item.year, null)

  const thumb = firstString(
    item.thumbUrl, item.thumbnail, item.thumb_url, item.thumbnail_url,
    item.thumbnailUrl, item.still_url, item.stillUrl, item.still, item.image?.thumb,
    spot?.thumbUrl, spot?.thumb_url, spot?.still_url, spot?.stillUrl, spot?.still,
  )
  const image = firstString(
    item.imageUrl, item.image_url, item.full_url, item.still_url, item.stillUrl,
    item.still, item.image?.url, item.image, item.thumbUrl, thumb,
  )
  const link = firstString(
    item.url, item.link, item.deepLink, item.deep_link, item.watchUrl, item.watch_url,
    item.shot_url, item.shotUrl, item.spot_url, item.spotUrl,
    spot?.deepLink, spot?.deep_link, spot?.url, spot?.watchUrl, spot?.watch_url,
  )

  // The documented shape nests scene data under `metadata`; the OpenAPI schema
  // puts it at the top level. Film metadata is camelCase, animation snake_case,
  // commercial shots mostly top-level snake_case.
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const palette = paletteOf(
    item.palette ?? item.colorPalette ?? item.colors ?? item.color_palette
    ?? meta.colors ?? meta.colorPalette,
  )

  const tags = [
    firstString(meta.shot_type, meta.shotType, item.shot_type, item.shotType, item.shot_size),
    firstString(meta.visual_style, meta.visualStyle, item.visual_style),
    firstString(meta.time_of_day, meta.timeOfDay, item.time_of_day, item.timeOfDay),
    firstString(meta.setting, item.setting),
    firstString(meta.lens_character, meta.lensCharacter, item.lens_character),
    firstString(item.lighting, item.mood, meta.lightingKey),
  ].filter(Boolean).slice(0, 4)

  const caption = firstString(
    item.prompt, meta.sceneDescription, item.sceneDescription, item.scene_description,
    item.caption, item.description, meta.colorDescription, item.colorDescription,
    item.logline, spot?.logline,
    [firstString(meta.shot_type, item.shot_size), item.setting, item.time_of_day].filter(Boolean).join(' · '),
  ).slice(0, 280)

  if (!thumb && !image) return null

  const slug = firstString(asObject?.slug, item.slug, spot?.slug, spot?.id)

  return {
    id: String(item.id ?? item.shot_id ?? item.shotId ?? ''),
    src: 'framethrower',
    kind,
    thumb,
    image,
    link,
    title: title.slice(0, 120),
    year,
    slug,
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

function parseImageDataUrl(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || raw.length > 2_800_000) return null
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw)
  if (!match) return null
  const data = match[2].replace(/\s+/g, '')
  if (!data || data.length > 2_800_000) return null
  return { mediaType: match[1].toLowerCase(), data }
}

function parseImageWebQueries(raw) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
  const listed = Array.isArray(parsed?.web) ? parsed.web : (typeof parsed?.web === 'string' ? [parsed.web] : [])
  const web = []
  for (const item of listed) {
    let entry = text(item, 120)
    if (!entry) continue
    const words = entry.split(/\s+/).filter(Boolean)
    if (words.length > 8) entry = words.slice(0, 8).join(' ').replace(/[,;:]+$/, '')
    if (!web.includes(entry)) web.push(entry)
    if (web.length === 3) break
  }
  return web.length ? web : null
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
