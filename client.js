window.__ModuleLoader__.load({
  id: 'dsh-reference-frames',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React

    const NS = 'anistyle'
    const TOKEN_KEY = 'anistyle:token'
    const BOARDS_KEY = 'anistyle:boards:v1'
    const VIEW_KEY = 'anistyle:view:v1'
    const AI_KEY = 'anistyle:ai'
    const KW_KEY = 'anistyle:keywords:v1'

    const KW_DEFAULT = { hidden: [], hiddenGroups: [], labels: {}, groups: [] }

    function loadKeywords() {
      try {
        const raw = window.localStorage.getItem(KW_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        if (!parsed || typeof parsed !== 'object') return KW_DEFAULT
        const groups = Array.isArray(parsed.groups)
          ? parsed.groups
            .filter((group) => group && typeof group.id === 'string')
            .map((group) => ({
              id: group.id,
              name: typeof group.name === 'string' && group.name ? group.name : '自定义',
              terms: Array.isArray(group.terms) ? group.terms.filter((term) => typeof term === 'string' && term) : [],
            }))
          : []
        // v1 shape: { hidden, custom } — fold the loose custom terms into one user category
        if (!groups.length && Array.isArray(parsed.custom) && parsed.custom.length) {
          groups.push({ id: 'custom', name: '自定义', terms: parsed.custom.filter((term) => typeof term === 'string') })
        }
        return {
          hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((item) => typeof item === 'string') : [],
          hiddenGroups: Array.isArray(parsed.hiddenGroups)
            ? parsed.hiddenGroups.filter((item) => typeof item === 'string')
            : [],
          labels: parsed.labels && typeof parsed.labels === 'object' ? parsed.labels : {},
          groups,
        }
      } catch { return KW_DEFAULT }
    }

    function buildKeywordGroups(groups, store) {
      const hidden = new Set(store.hidden || [])
      const hiddenGroups = new Set(store.hiddenGroups || [])
      const labels = store.labels || {}
      const out = []
      for (const group of groups || []) {
        if (hiddenGroups.has(group.id)) continue
        const values = (group.values || []).filter((value) => !hidden.has(value))
        if (!values.length) continue
        const renamed = labels[group.id]
        out.push({
          id: group.id,
          builtin: true,
          label: { zh: renamed || group.label.zh, en: renamed || group.label.en },
          values,
        })
      }
      for (const group of store.groups || []) {
        out.push({ id: group.id, builtin: false, label: { zh: group.name, en: group.name }, values: group.terms })
      }
      return out
    }

    function hasTerm(input, term) {
      const body = String(input || '').toLowerCase()
      const needle = String(term || '').toLowerCase().trim()
      return needle ? body.includes(needle) : false
    }

    function joinTerm(input, term) {
      const body = String(input || '').trim()
      const value = String(term || '').trim()
      if (!value) return body
      if (hasTerm(body, value)) return body
      if (!body) return value
      return body.replace(/[，,、;；\s]+$/, '') + '，' + value
    }

    function dropTerm(input, term) {
      const value = String(term || '').trim()
      const body = String(input || '')
      if (!value) return body
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return body
        .replace(new RegExp('[，,、;；]\\s*' + escaped, 'gi'), '')
        .replace(new RegExp(escaped + '\\s*[，,、;；]?', 'gi'), '')
        .replace(/^[，,、;；\s]+/, '')
        .replace(/[，,、;；\s]+$/, '')
    }
    const PAGE_SIZE = 24

    const I18n = React.createContext((key) => key)
    const useT = () => React.useContext(I18n)

    const DICT = {
      zh: {
        nav: "参考帧",
        discover: "发现",
        boards: "情绪板",
        placeholder: "描述你要的感觉，例如：超现实题材，电影感，雨夜的巨大城市，一个人抬头看天……",
        lensToggle: "关键词",
        untitled: "未命名情绪板",
        settings: "设置",
        settingsNote: "密钥只保存在本机浏览器，经本机路由转发，不会进入对话。",
        getToken: "获取 token",
        connected: "已连接",
        notConfigured: "未配置",
        sourceToken: "API Token",
        save: "保存",
        clear: "清除",
        close: "关闭",
        search: "检索参考帧",
        searchFail: "检索失败",
        results: "参考帧",
        more: "换一批",
        resultsEmpty: "没有检索到帧",
        resultsEmptyBody: "换个说法试试：补上画面里有什么、时间、天气，或者再多给一点情绪。",
        queryTerms: "检索词",
        retry: "重试",
        similar: "找相似的帧",
        noSimilar: "没有更多相似的帧了",
        openOriginal: "在 FrameThrower 打开原图",
        previous: "上一张",
        next: "下一张",
        pickImage: "图片",
        pickImageTip: "选择图片，也可以直接粘贴或拖进来",
        imageAttached: "以这张图检索",
        removeImage: "移除",
        imageFailed: "这张图读不出来，换一张试试",
        noToken: "还没配置 token，检索会失败",
        boardsEmptyBody: "情绪板是你选中的帧的集合。先去发现页找几张，或者现在就建一个空板。",
        newBoard: "新建情绪板",
        boardName: "情绪板名称",
        added: "已加入",
        duplicate: "这张已经在情绪板里了",
        pickBoard: "选择情绪板",
        yourBoards: "你的情绪板",
        deleteBoard: "删除情绪板",
        pin: "置顶",
        unpin: "取消置顶",
        confirmDelete: "确定删除？",
        removeFrame: "移除",
        exportMd: "导出 Markdown",
        boardEmpty: "这个情绪板还是空的",
        boardEmptyBody: "去发现页找几张参考帧，点 ＋ 就能加进来。",
        goDiscover: "去发现",
        suggestTitle: "相似推荐",
        sampleRef: "相似推荐",
        resample: "换一组",
        suggestHint: "点 ＋ 加入这个情绪板",
        addToBoard: "加入这个情绪板",
        addBoard: "加入情绪板",
        presetsInstall: "安装作者的情绪板",
        presetsAdded: "已安装情绪板",
        presetsNone: "没有新的情绪板可安装",
        presetSave: "保存为插件预设",
        presetNote: "把当前的情绪板写进插件目录，分享给其他人。",
        presetSaved: "已写入预设文件，情绪板数",
        backToBoards: "全部情绪板",
        items: "张",
        lang: "zh",
        updated: "更新于",
        palette: "色板",
        kwHint: "点关键词加进需求，可多选",
        kwManage: "管理",
        kwDone: "完成",
        kwAdd: "加词",
        kwDelete: "删除",
        kwAddGroup: "新类别",
        kwDeleteGroup: "删除类别",
        kwRestore: "恢复默认类别",
        kwEmpty: "还没有关键词",
        failAuth: "Token 无效或已过期，去设置里重新填一个",
        failCredits: "FrameThrower 额度不足（一次检索约 4 credits）",
        failTooMany: "请求太频繁了，等一下再试",
        failNetwork: "连不上 FrameThrower（网络或服务故障）",
        failRejected: "请求被上游拒绝",
        failStatus: "上游返回",
        aiNoLlm: "宿主没有挂载 AI 服务",
        aiNoModel: "没有选中默认模型",
        aiUnparsed: "模型没给出可用的帧描述",
        aiTimeout: "模型 6 秒内没回应",
        aiCallFailed: "模型调用失败",
        aiUnreachable: "连不上本机路由（宿主可能没重启）",
        aiFellBack: "已按原文检索",
        aiOff: "AI 未生效",
        aiSearch: "AI检索",
        retryLoose: "去掉作品名/画风，只按画面再搜",
        loadMore: "浏览更多",
        noMore: "没有更多了",
        aiNeeded: "需要 AI检索",
        aiNeededBody: "FrameThrower 按英文的单帧画面描述匹配，中文原文只会让它退回默认结果。打开右下角的 AI检索，让模型把它写成英文再搜。",
        aiNeededCta: "打开 AI检索并重试",
      },
      en: {
        nav: "Reference Frames",
        discover: "Discover",
        boards: "Moodboards",
        placeholder: "Describe the feeling — e.g. surreal, cinematic, a vast city at night in the rain, one person looking up…",
        lensToggle: "Keywords",
        untitled: "Untitled board",
        settings: "Settings",
        settingsNote: "Keys stay in this browser and are proxied locally; they never enter the chat.",
        getToken: "Get a token",
        connected: "Connected",
        notConfigured: "Not set",
        sourceToken: "API token",
        save: "Save",
        clear: "Clear",
        close: "Close",
        search: "Search frames",
        searchFail: "Search failed",
        results: "Reference frames",
        more: "More frames",
        resultsEmpty: "No frames found",
        resultsEmptyBody: "Try describing what is in frame — subject, time of day, weather, mood.",
        queryTerms: "Terms",
        retry: "Try again",
        similar: "More like this",
        noSimilar: "No more similar frames",
        openOriginal: "Open on FrameThrower",
        previous: "Previous",
        next: "Next",
        pickImage: "Image",
        pickImageTip: "Pick an image, or just paste / drop one",
        imageAttached: "Searching by this image",
        removeImage: "Remove",
        imageFailed: "That image could not be read",
        noToken: "No token yet — search will fail",
        boardsEmptyBody: "A moodboard is a set of frames you chose. Find a few first, or create an empty one now.",
        newBoard: "New moodboard",
        boardName: "Board name",
        added: "Added",
        duplicate: "Already in this moodboard",
        pickBoard: "Choose a moodboard",
        yourBoards: "Your moodboards",
        deleteBoard: "Delete moodboard",
        pin: "Pin to top",
        unpin: "Unpin",
        confirmDelete: "Delete this board?",
        removeFrame: "Remove",
        exportMd: "Export Markdown",
        boardEmpty: "This board is empty",
        boardEmptyBody: "Find frames on Discover, then hit ＋ to add them.",
        goDiscover: "Go to Discover",
        suggestTitle: "Similar picks",
        sampleRef: "Similar picks",
        resample: "Reshuffle",
        suggestHint: "Tap ＋ to add it to this board",
        addToBoard: "Add to this board",
        addBoard: "Add to a board",
        presetsInstall: "Install author's boards",
        presetsAdded: "Boards installed",
        presetsNone: "Nothing new to install",
        presetSave: "Save as plugin preset",
        presetNote: "Write the current moodboards into the plugin folder to share them.",
        presetSaved: "Preset file written, boards:",
        backToBoards: "All moodboards",
        items: "frames",
        lang: "en",
        updated: "Updated",
        palette: "Palette",
        kwHint: "Click a keyword to add it — pick as many as you like",
        kwManage: "Manage",
        kwDone: "Done",
        kwAdd: "Add",
        kwDelete: "Delete",
        kwAddGroup: "New category",
        kwDeleteGroup: "Delete category",
        kwRestore: "Restore defaults",
        kwEmpty: "No keywords yet",
        failAuth: "That token was rejected — update it in Settings",
        failCredits: "Out of FrameThrower credits (a search costs about 4)",
        failTooMany: "Rate limited — try again in a moment",
        failNetwork: "Can't reach FrameThrower (network or outage)",
        failRejected: "The upstream rejected the request",
        failStatus: "Upstream returned",
        aiNoLlm: "The host has no AI service mounted",
        aiNoModel: "No default model is selected",
        aiUnparsed: "The model returned no usable frame description",
        aiTimeout: "The model did not answer within 6s",
        aiCallFailed: "The model call failed",
        aiUnreachable: "Can't reach the local route (host may need a restart)",
        aiFellBack: "searched your text as-is",
        aiOff: "AI did not run",
        aiSearch: "AI search",
        retryLoose: "Search the frame description only",
        loadMore: "Browse more",
        noMore: "No more frames",
        aiNeeded: "AI search needed",
        aiNeededBody: "FrameThrower matches English frame descriptions; a Chinese brief only gets its default page back. Turn on AI search in the composer to have it written in English first.",
        aiNeededCta: "Turn on AI search and retry",
      },
    }

    // ---------------------------------------------------------------- vocabulary

    const LENS_ORDER = ['era', 'rendering', 'light', 'colour', 'mood']
    const GROUP_LABELS = {
      era: { zh: '年代', en: 'Era' },
      rendering: { zh: '渲染', en: 'Rendering' },
      light: { zh: '光线', en: 'Light' },
      colour: { zh: '色彩', en: 'Colour' },
      mood: { zh: '氛围', en: 'Mood' },
      genre: { zh: '类型', en: 'Genre' },
    }

    const stamp = (timestamp) => {
      const date = new Date(Number(timestamp) || Date.now())
      const pad = (value) => String(value).padStart(2, '0')
      return date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate())
    }

    function parseVocabulary(payload) {
      const data = payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
        ? payload.data
        : payload
      if (!data || typeof data !== 'object') return []
      const asList = (value) => {
        if (!Array.isArray(value)) return []
        return value
          .map((entry) => (typeof entry === 'string' ? entry : entry && (entry.value ?? entry.name ?? entry.id)))
          .filter((entry) => typeof entry === 'string' && entry)
      }
      const groups = []
      const raw = data.style_groups
      if (raw && typeof raw === 'object') {
        for (const [key, value] of Object.entries(raw)) {
          const values = asList(value)
          if (values.length) groups.push({ id: key, label: GROUP_LABELS[key] || { zh: key, en: key }, values })
        }
      }
      if (!groups.length) {
        const styles = asList(data.styles)
        if (styles.length) groups.push({ id: 'rendering', label: GROUP_LABELS.rendering, values: styles })
      }
      groups.sort((a, b) => {
        const ai = LENS_ORDER.indexOf(a.id)
        const bi = LENS_ORDER.indexOf(b.id)
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
      })
      return groups.slice(0, 3)
    }

    // Image sources. FrameThrower today; more can be added without touching the UI.
    const SOURCES = [
      {
        id: 'framethrower',
        label: 'FrameThrower',
        key: TOKEN_KEY,
        docs: 'https://framethrower.ai/settings?tab=api',
      },
    ]

    function readKey(key) {
      try { return window.localStorage.getItem(key) || '' } catch { return '' }
    }
    function writeKey(key, value) {
      try {
        if (value) window.localStorage.setItem(key, value)
        else window.localStorage.removeItem(key)
      } catch {}
    }
    function readToken() {
      return readKey(SOURCES[0].key)
    }

    function loadView() {
      try {
        const raw = window.localStorage.getItem(VIEW_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch { return {} }
    }

    function loadBoards() {
      try {
        const raw = window.localStorage.getItem(BOARDS_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed)
          ? parsed.filter((board) => board && typeof board.id === 'string' && Array.isArray(board.items))
          : []
      } catch { return [] }
    }

    const untitledName = (boards, label) => {
      const base = label || 'Untitled'
      const used = new Set(boards.map((board) => board.name))
      let index = 1
      while (used.has(base + ' ' + index)) index += 1
      return base + ' ' + index
    }

    const newId = () => 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const frameKey = (frame) => frame.id || frame.link || frame.thumb

    function boardPalette(items) {
      const counts = new Map()
      for (const item of items) {
        for (const color of item.palette || []) {
          const key = String(color).toUpperCase()
          counts.set(key, (counts.get(key) || 0) + 1)
        }
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color]) => color.toLowerCase())
    }

    async function api(path, body) {
      const token = readToken()
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-ft-token': token } : {}) },
        body: JSON.stringify(body || {}),
      })
      if (!response.ok) {
        let detail = ''
        try { detail = (await response.json()).error || '' } catch {}
        throw new Error(detail || `HTTP ${response.status}`)
      }
      return response.json()
    }


    function download(name, content, type) {
      const blob = new Blob([content], { type })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    }

    // ---------------------------------------------------------------- components

    function PaletteDots({ colors, size }) {
      if (!colors || !colors.length) return null
      return h('span', { className: 'ase-dots' + (size ? ' ase-dots--' + size : '') },
        colors.map((color, index) => h('i', { key: color + index, style: { background: color } })))
    }

    const warmed = new Set()
    function warmImage(url) {
      if (!url || warmed.has(url)) return
      if (typeof window === 'undefined' || typeof window.Image !== 'function') return
      warmed.add(url)
      const img = new window.Image()
      img.decoding = 'async'
      img.src = url
    }

    function readImageFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type || '')) { reject(new Error('not an image')); return }
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('read failed'))
        reader.onload = () => {
          const raw = String(reader.result || '')
          if (typeof window === 'undefined' || typeof window.Image !== 'function') {
            resolve({ dataUrl: raw, preview: raw })
            return
          }
          const image = new window.Image()
          image.onerror = () => reject(new Error('decode failed'))
          image.onload = () => {
            const max = 1024
            const width = image.width || max
            const height = image.height || max
            const scale = Math.min(1, max / Math.max(width, height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(width * scale))
            canvas.height = Math.max(1, Math.round(height * scale))
            const context = canvas.getContext('2d')
            if (!context) { resolve({ dataUrl: raw, preview: raw }); return }
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.82), preview: canvas.toDataURL('image/jpeg', 0.5) })
          }
          image.src = raw
        }
        reader.readAsDataURL(file)
      })
    }

    function FrameTile({ frame, onAdd, onSimilar, onRemove, onZoom, busy }) {
      const T = useT()
      const [broken, setBroken] = useState(false)
      const meta = [frame.title, frame.year].filter(Boolean).join(' · ')
      return h('figure', {
        className: 'ase-tile' + (busy ? ' ase-tile--busy' : ''),
        onMouseEnter: () => warmImage(frame.image),
      },
        h('div', { className: 'ase-thumb' },
          broken
            ? h('div', { className: 'ase-thumb-fallback' })
            : h('img', {
              src: frame.thumb || frame.image,
              alt: frame.caption || frame.title || 'reference frame',
              loading: 'lazy',
              className: onZoom ? 'ase-zoomable' : undefined,
              onClick: onZoom ? () => onZoom(frame) : undefined,
              onError: () => setBroken(true),
            }),
          h('div', { className: 'ase-thumb-actions' },
            onAdd ? h('button', { type: 'button', className: 'ase-mini ase-mini--solid ase-tip', 'data-tip': T('pickBoard'), 'aria-label': T('pickBoard'), onClick: () => onAdd(frame) }, '＋') : null,
            onSimilar ? h('button', { type: 'button', className: 'ase-mini ase-tip', 'data-tip': T('similar'), 'aria-label': T('similar'), onClick: () => onSimilar(frame) }, '≈') : null,
            frame.link ? h('a', { className: 'ase-mini ase-tip', 'data-tip': T('openOriginal'), 'aria-label': T('openOriginal'), href: frame.link, target: '_blank', rel: 'noreferrer' }, '↗') : null,
            onRemove ? h('button', { type: 'button', className: 'ase-mini ase-mini--danger ase-tip', 'data-tip': T('removeFrame'), 'aria-label': T('removeFrame'), onClick: () => onRemove(frame) }, '×') : null)),
        h('figcaption', null,
          meta ? h('strong', null, meta) : null,
          frame.caption ? h('p', null, frame.caption) : null,
          (frame.tags && frame.tags.length)
            ? h('div', { className: 'ase-tags' }, frame.tags.map((tag) => h('span', { key: tag }, tag)))
            : null,
          (frame.palette && frame.palette.length) ? h(PaletteDots, { colors: frame.palette, size: 'bar' }) : null))
    }

    function BoardModal({ frame, boards, onClose, onAdd, onCreate }) {
      const T = useT()
      const [creating, setCreating] = useState(false)
      const [name, setName] = useState('')
      const [added, setAdded] = useState(() => [])
      const key = frame ? frameKey(frame) : ''
      const inside = (board) => added.includes(board.id) || board.items.some((item) => frameKey(item) === key)
      const add = (boardId) => {
        setAdded((list) => (list.includes(boardId) ? list : list.concat(boardId)))
        onAdd(boardId)
      }
      const create = () => {
        const value = name.trim()
        if (!value) { setCreating(false); return }
        onCreate(value)
        setName('')
        setCreating(false)
      }
      return h('div', { className: 'ase-scrim', onClick: onClose },
        h('div', { className: 'ase-modal', onClick: (event) => event.stopPropagation(), role: 'dialog', 'aria-modal': true },
          h('button', {
            type: 'button',
            className: 'ase-modal-x',
            'aria-label': T('close'),
            'data-tip': T('close'),
            onClick: onClose,
          }, '×'),
          h('div', { className: 'ase-modal-head' },
            frame && (frame.thumb || frame.image) ? h('img', { className: 'ase-modal-thumb', src: frame.thumb || frame.image, alt: '' }) : null,
            h('div', null,
              h('h3', { className: 'ase-modal-title' }, T('pickBoard')),
              h('p', { className: 'ase-modal-sub' }, frame && frame.title ? frame.title + (frame.year ? ' · ' + frame.year : '') : T('yourBoards')))),
          h('div', { className: 'ase-chips' },
            boards.map((board) => h('button', {
              key: board.id,
              type: 'button',
              className: 'ase-chip' + (inside(board) ? ' is-in' : ''),
              onClick: () => add(board.id),
            },
              h('span', null, board.name),
              h('small', null, inside(board) ? '✓' : board.items.length + ' ' + T('items')))),
            creating
              ? h('input', {
                className: 'ase-chip-input',
                placeholder: T('boardName'),
                value: name,
                autoFocus: true,
                onChange: (event) => setName(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') { event.preventDefault(); create() }
                  else if (event.key === 'Escape') { event.preventDefault(); setName(''); setCreating(false) }
                },
                onBlur: () => { if (!name.trim()) setCreating(false) },
              })
              : h('button', {
                type: 'button',
                className: 'ase-chip ase-chip--new',
                'aria-label': T('newBoard'),
                onClick: () => setCreating(true),
              }, '＋'))))
    }

    function BoardsHome({ boards, onCreate, onOpen, onDelete, onPin, presets, onInstallPresets }) {
      const T = useT()
      return h('section', null,
        h('div', { className: 'ase-section-head' },
          h('h1', { className: 'ase-h1' }, T('boards')),
          h('div', { className: 'ase-section-actions' },
            presets && presets.length
              ? h('button', {
                type: 'button',
                className: 'ase-btn',
                onClick: onInstallPresets,
              }, T('presetsInstall') + ' · ' + presets.length)
              : null,
            h('button', { type: 'button', className: 'ase-btn ase-btn--primary', onClick: () => onCreate('') }, '＋ ' + T('newBoard')))),
        boards.length
          ? h('div', { className: 'ase-board-grid' },
            boards.map((board) => h('article', { key: board.id, className: 'ase-board-card' },
              h('button', { type: 'button', className: 'ase-board-open', onClick: () => onOpen(board.id) },
                board.items[0]
                  ? h('img', { className: 'ase-board-cover', src: board.items[0].thumb || board.items[0].image, alt: '', loading: 'lazy' })
                  : h('div', { className: 'ase-board-cover ase-board-cover--empty' }, '＋'),
                h('div', { className: 'ase-board-meta' },
                  h('strong', null, board.name),
                  h('div', { className: 'ase-board-sub' },
                    h('small', null, board.items.length + ' ' + T('items')),
                    h('small', { className: 'ase-board-date' }, T('updated') + ' ' + stamp(board.updatedAt))),
                  h(PaletteDots, { colors: boardPalette(board.items), size: 'bar' }))),
              h('div', { className: 'ase-board-actions' },
                h('button', {
                  type: 'button',
                  className: 'ase-board-act ase-board-pin ase-tip' + (board.pinned ? ' is-on' : ''),
                  'data-tip': board.pinned ? T('unpin') : T('pin'),
                  'aria-label': board.pinned ? T('unpin') : T('pin'),
                  'aria-pressed': board.pinned ? 'true' : 'false',
                  onClick: () => onPin(board.id),
                }, h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
                  h('path', { d: 'M8 13.2V4.2', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
                  h('path', { d: 'M4.7 7.4 8 4l3.3 3.4', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
                h('button', {
                  type: 'button',
                  className: 'ase-board-act ase-board-del ase-tip',
                  'data-tip': T('deleteBoard'),
                  'aria-label': T('deleteBoard'),
                  onClick: () => onDelete(board.id),
                }, '×')))))
          : h('p', { className: 'ase-hint' }, T('boardsEmptyBody')))
    }

    function BoardView({
      board, onBack, onRename, onRemoveFrame, onExport, onDiscover, onZoomItem,
      onSimilar, onSample, suggestBusy, suggests, onAddSuggest, onCloseSuggest, onZoomSuggest,
    }) {
      const T = useT()
      const palette = boardPalette(board.items)
      const inBoard = new Set(board.items.map(frameKey))
      const picks = suggests ? suggests.frames.filter((frame) => !inBoard.has(frameKey(frame))) : []
      return h('section', null,
        h('button', { type: 'button', className: 'ase-back', onClick: onBack }, '← ' + T('backToBoards')),
        h('div', { className: 'ase-board-head' },
          h('div', { className: 'ase-board-title-wrap' },
            h('input', {
              className: 'ase-board-title',
              value: board.name,
              onChange: (event) => onRename(event.target.value),
              'aria-label': T('boardName'),
            }),
            palette.length
              ? h('div', { className: 'ase-board-palette' },
                h('span', { className: 'ase-lens-label' }, T('palette')),
                h(PaletteDots, { colors: palette, size: 'bar' }),
                h('code', null, palette.join(' ')))
              : null),
          h('div', { className: 'ase-board-head-meta' },
            h('span', null, board.items.length + ' ' + T('items') + ' · ' + T('updated') + ' ' + stamp(board.updatedAt)),
            onSample
              ? h('button', { type: 'button', className: 'ase-btn', onClick: onSample }, T('sampleRef'))
              : null,
            h('button', { type: 'button', className: 'ase-btn', onClick: onExport }, T('exportMd')),
            h('button', { type: 'button', className: 'ase-btn', onClick: onDiscover }, T('goDiscover')))),
        suggests
          ? h('section', { className: 'ase-suggest' },
            h('div', { className: 'ase-suggest-head' },
              suggests.anchors && suggests.anchors.length
                ? h('div', { className: 'ase-sug-anchors' },
                  suggests.anchors.map((frame) => h('img', { key: frameKey(frame), src: frame.thumb || frame.image, alt: '' })))
                : null,
              h('h3', null, T('suggestTitle')),
              h('span', { className: 'ase-suggest-hint' }, T('suggestHint')),
              onSample
                ? h('button', { type: 'button', className: 'ase-ghost-link', onClick: onSample }, T('resample'))
                : null,
              h('button', { type: 'button', className: 'ase-ghost-link', onClick: onCloseSuggest }, T('close'))),
            suggests.loading
              ? h('p', { className: 'ase-hint' }, '…')
              : picks.length
                ? h('div', { className: 'ase-suggest-grid' },
                  picks.map((frame) => h('figure', { key: frameKey(frame), className: 'ase-sug' },
                    h('img', {
                      src: frame.thumb || frame.image,
                      alt: '',
                      loading: 'lazy',
                      onClick: () => onZoomSuggest(frame),
                    }),
                    h('button', {
                      type: 'button',
                      className: 'ase-sug-add ase-tip',
                      'data-tip': T('addToBoard'),
                      'aria-label': T('addToBoard'),
                      onClick: () => onAddSuggest(frame),
                    }, '＋'),
                    frame.title || frame.year
                      ? h('figcaption', { className: 'ase-sug-meta' }, [frame.title, frame.year].filter(Boolean).join(' · '))
                      : null)))
                : h('p', { className: 'ase-hint' }, T('noSimilar')))
          : null,
        board.items.length
          ? h('div', { className: 'ase-grid' },
            board.items.map((frame) => h(FrameTile, {
              key: frameKey(frame),
              frame,
              busy: suggestBusy === frameKey(frame),
              onSimilar: onSimilar ? () => onSimilar(frame) : null,
              onRemove: (item) => onRemoveFrame(item),
              onZoom: onZoomItem,
            })))
          : h('div', { className: 'ase-empty' },
            h('h3', null, T('boardEmpty')),
            h('p', null, T('boardEmptyBody')),
            h('button', { type: 'button', className: 'ase-btn ase-btn--primary', onClick: onDiscover }, T('goDiscover'))))
    }

    function GearIcon({ size }) {
      const edge = size || 17
      return h('svg', {
        width: edge, height: edge, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, style: { display: 'block' },
      },
        h('circle', { cx: 12, cy: 12, r: 3.1, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', {
          d: 'M19.3 14.9a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.74 2.74l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.94 1.94 0 1 1-3.88 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.74-2.74l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.17a1.94 1.94 0 1 1 0-3.88h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.74-2.74l.06.06a1.6 1.6 0 0 0 1.77.32h.08A1.6 1.6 0 0 0 9.7 3.7v-.17a1.94 1.94 0 1 1 3.88 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.74 2.74l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.94 1.94 0 1 1 0 3.88h-.09a1.6 1.6 0 0 0-1.47.97z',
          stroke: 'currentColor', strokeWidth: 1.35, strokeLinejoin: 'round',
        }))
    }

    function Settings({ drafts, configured, onDraft, onSave, onClear, onClose, onSavePreset }) {
      const T = useT()
      return h('div', { className: 'ase-scrim', onClick: onClose },
        h('div', { className: 'ase-modal ase-settings', onClick: (event) => event.stopPropagation(), role: 'dialog', 'aria-modal': true },
          h('div', { className: 'ase-settings-head' },
            h('h3', { className: 'ase-modal-title' }, T('settings')),
            h('p', { className: 'ase-modal-sub' }, T('settingsNote')),
            h('button', {
              type: 'button',
              className: 'ase-modal-x',
              'aria-label': T('close'),
              'data-tip': T('close'),
              onClick: onClose,
            }, '×')),
          SOURCES.map((source) => h('section', { key: source.id, className: 'ase-source' },
            h('div', { className: 'ase-source-head' },
              h('strong', null, source.label),
              h('span', { className: 'ase-pill' + (configured[source.id] ? ' ase-pill--on' : '') },
                configured[source.id] ? T('connected') : T('notConfigured'))),
            h('div', { className: 'ase-source-form' },
              h('input', {
                className: 'ase-input',
                type: 'password',
                placeholder: T('sourceToken'),
                value: drafts[source.id] === undefined ? '' : drafts[source.id],
                onChange: (event) => onDraft(source.id, event.target.value),
                spellCheck: false,
              }),
              h('button', { type: 'button', className: 'ase-btn ase-btn--primary', onClick: () => onSave(source) }, T('save')),
              h('button', { type: 'button', className: 'ase-btn', onClick: () => onClear(source) }, T('clear'))),
            source.docs
              ? h('a', { className: 'ase-source-docs', href: source.docs, target: '_blank', rel: 'noreferrer' }, T('getToken') + ' ↗')
              : null)),
          onSavePreset
            ? h('section', { className: 'ase-preset-row' },
              h('div', null,
                h('strong', null, T('presetSave')),
                h('p', { className: 'ase-modal-sub' }, T('presetNote'))),
              h('button', { type: 'button', className: 'ase-btn', onClick: onSavePreset }, T('presetSave')))
            : null))
    }

    function Lightbox({ frames, index, onClose, onIndex, onAdd, addLabel, isAdded }) {
      const T = useT()
      const frame = frames[index]
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
          else if (event.key === 'ArrowRight') onIndex(index + 1)
          else if (event.key === 'ArrowLeft') onIndex(index - 1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [index, onClose, onIndex])
      const imgRef = useRef(null)
      const [ready, setReady] = useState(false)
      useEffect(() => {
        setReady(false)
        const node = imgRef.current
        if (node && node.complete && node.naturalWidth) setReady(true)
      }, [index])
      useEffect(() => {
        warmImage(frame && (frame.image || frame.thumb))
        const previous = frames[index - 1]
        const next = frames[index + 1]
        if (previous) warmImage(previous.image || previous.thumb)
        if (next) warmImage(next.image || next.thumb)
      }, [frames, index])
      if (!frame) return null
      const title = [frame.title, frame.year].filter(Boolean).join(' · ')
      return h('div', { className: 'ase-zoom-view', onClick: onClose, role: 'dialog', 'aria-modal': true },
        h('button', {
          type: 'button', className: 'ase-zoom-btn ase-zoom-btn--close ase-tip',
          'data-tip': T('close'), 'aria-label': T('close'), onClick: onClose,
        }, '×'),
        index > 0
          ? h('button', {
            type: 'button', className: 'ase-zoom-btn ase-zoom-btn--prev ase-tip',
            'data-tip': T('previous'), 'aria-label': T('previous'),
            onClick: (event) => { event.stopPropagation(); onIndex(index - 1) },
          }, '‹')
          : null,
        index < frames.length - 1
          ? h('button', {
            type: 'button', className: 'ase-zoom-btn ase-zoom-btn--next ase-tip',
            'data-tip': T('next'), 'aria-label': T('next'),
            onClick: (event) => { event.stopPropagation(); onIndex(index + 1) },
          }, '›')
          : null,
        h('figure', { className: 'ase-zoom-figure', onClick: (event) => event.stopPropagation() },
          h('div', { className: 'ase-zoom-stage' + (ready ? ' is-ready' : '') },
            frame.thumb ? h('img', { className: 'ase-zoom-blur', src: frame.thumb, alt: '', 'aria-hidden': true }) : null,
            h('img', {
              ref: imgRef,
              className: 'ase-zoom-full',
              src: frame.image || frame.thumb,
              alt: frame.caption || title || '',
              decoding: 'async',
              fetchPriority: 'high',
              onLoad: () => setReady(true),
            })),
          h('figcaption', null,
            h('div', { className: 'ase-zoom-meta' },
              h('strong', null, title),
              h('span', null, (index + 1) + ' / ' + frames.length)),
            frame.caption ? h('p', null, frame.caption) : null,
            (frame.palette && frame.palette.length) ? h(PaletteDots, { colors: frame.palette, size: 'bar' }) : null,
            h('div', { className: 'ase-zoom-actions' },
              frame.link
                ? h('a', { className: 'ase-zoom-link', href: frame.link, target: '_blank', rel: 'noreferrer' }, 'FrameThrower ↗')
                : null,
              onAdd
                ? (isAdded && isAdded(frame)
                  ? h('span', { className: 'ase-zoom-added' }, '✓ ' + T('added'))
                  : h('button', {
                    type: 'button',
                    className: 'ase-zoom-add',
                    onClick: (event) => { event.stopPropagation(); onAdd(frame) },
                  }, '＋ ' + (addLabel || T('addBoard'))))
                : null))))
    }

    // -------------------------------------------------------------------- page

    function Discover({ state }) {
      const T = useT()
      const lang = T('lang') === 'en' ? 'en' : 'zh'
      const {
        query, setQuery, results, status, hint, warnings,
        submit, more, similar, hasToken, openToken, canMore, openBoardModal, openZoom, busyId,
        attachment, onAttachment, onClearAttachment, onImageError, understood, aiNote, failure,
        aiOn, onToggleAi, onAiRetry, canLoose, onLooseRetry,
        loadMore, loadingMore, canLoadMore, noMore,
        keywordGroups, addGroup, renameGroup, deleteGroup, addTerm, removeTerm, renameTerm,
        restoreKeywords, canRestore,
      } = state
      const [kwOpen, setKwOpen] = useState(false)
      const [managing, setManaging] = useState(false)
      const [termDraft, setTermDraft] = useState({})
      const [labelEdit, setLabelEdit] = useState(null)
      const [termEdit, setTermEdit] = useState(null)
      const [dropping, setDropping] = useState(false)
      const fileRef = useRef(null)
      const loading = status === 'loading'

      const pickFile = (file) => {
        if (!file) return
        readImageFile(file).then((image) => onAttachment(image), () => onImageError())
      }
      const toggleTerm = (term) => setQuery(hasTerm(query, term) ? dropTerm(query, term) : joinTerm(query, term))

      const panel = h('div', { className: 'ase-kw-panel' },
        h('div', { className: 'ase-kw-head' },
          h('span', { className: 'ase-kw-hint' }, T('kwHint')),
          h('button', {
            type: 'button',
            className: 'ase-ghost-link',
            onClick: () => { setManaging(!managing); setLabelEdit(null); setTermEdit(null) },
          }, managing ? T('kwDone') : T('kwManage'))),
        keywordGroups.length
          ? keywordGroups.map((group) => h('div', { key: group.id, className: 'ase-kw-group' },
            h('div', { className: 'ase-kw-labelcell' },
              labelEdit && labelEdit.id === group.id
                ? h('input', {
                  className: 'ase-kw-label-input',
                  value: labelEdit.value,
                  autoFocus: true,
                  onChange: (event) => setLabelEdit({ id: group.id, value: event.target.value }),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') { renameGroup(group.id, group.builtin, labelEdit.value); setLabelEdit(null) }
                    if (event.key === 'Escape') setLabelEdit(null)
                  },
                  onBlur: () => setLabelEdit(null),
                })
                : h('button', {
                  type: 'button',
                  className: 'ase-kw-label' + (managing ? ' ase-kw-label--edit' : ''),
                  onClick: () => { if (managing) setLabelEdit({ id: group.id, value: group.label[lang] || group.label.zh }) },
                }, group.label[lang] || group.label.zh),
              managing
                ? h('button', {
                  type: 'button',
                  className: 'ase-kw-groupdel ase-tip',
                  'data-tip': T('kwDeleteGroup'),
                  'aria-label': T('kwDeleteGroup'),
                  onClick: () => deleteGroup(group.id, group.builtin),
                }, '×')
                : null),
            h('div', { className: 'ase-kw-chips' },
              group.values.map((term) => (termEdit && termEdit.id === group.id && termEdit.term === term
                ? h('input', {
                  key: term,
                  className: 'ase-kw-input',
                  value: termEdit.value,
                  autoFocus: true,
                  onChange: (event) => setTermEdit({ ...termEdit, value: event.target.value }),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') { renameTerm(group.id, group.builtin, term, termEdit.value); setTermEdit(null) }
                    if (event.key === 'Escape') setTermEdit(null)
                  },
                  onBlur: () => setTermEdit(null),
                })
                : h('span', { key: term, className: 'ase-kw' + (hasTerm(query, term) ? ' ase-kw--on' : '') },
                  h('button', {
                    type: 'button',
                    className: 'ase-kw-main',
                    onClick: () => {
                      if (managing) setTermEdit({ id: group.id, term, value: term })
                      else toggleTerm(term)
                    },
                  }, term),
                  managing
                    ? h('button', {
                      type: 'button',
                      className: 'ase-kw-x',
                      'data-tip': T('kwDelete'),
                      'aria-label': T('kwDelete'),
                      onClick: () => removeTerm(group.id, group.builtin, term),
                    }, '×')
                    : null))),
              managing
                ? h('input', {
                  className: 'ase-kw-input ase-kw-add',
                  placeholder: T('kwAdd'),
                  value: termDraft[group.id] || '',
                  onChange: (event) => setTermDraft({ ...termDraft, [group.id]: event.target.value }),
                  onKeyDown: (event) => {
                    if (event.key !== 'Enter') return
                    addTerm(group.id, group.builtin, termDraft[group.id] || '')
                    setTermDraft({ ...termDraft, [group.id]: '' })
                  },
                })
                : null)))
          : h('p', { className: 'ase-kw-empty' }, T('kwEmpty')),
        managing
          ? h('button', {
            type: 'button',
            className: 'ase-ghost-link ase-kw-newgroup',
            onClick: () => {
              const created = addGroup()
              if (created) setLabelEdit({ id: created, value: T('kwAddGroup') })
            },
          }, '＋ ' + T('kwAddGroup'))
          : null,
        canRestore
          ? h('button', {
            type: 'button',
            className: 'ase-ghost-link ase-kw-restore',
            onClick: restoreKeywords,
          }, T('kwRestore'))
          : null)

      return h('section', null,
        h('div', {
          className: 'ase-ask' + (kwOpen ? ' ase-ask--open' : '') + (dropping ? ' ase-ask--drop' : ''),
          onDragOver: (event) => { event.preventDefault(); setDropping(true) },
          onDragLeave: () => setDropping(false),
          onDrop: (event) => {
            event.preventDefault()
            setDropping(false)
            pickFile((event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) || null)
          },
          onPaste: (event) => {
            const files = event.clipboardData && event.clipboardData.files
            const image = files && Array.prototype.slice.call(files).filter((file) => /^image\//.test(file.type))[0]
            if (!image) return
            event.preventDefault()
            pickFile(image)
          },
        },
          attachment
            ? h('div', { className: 'ase-attach' },
              h('img', { src: attachment, alt: '' }),
              h('span', { className: 'ase-attach-label' }, T('imageAttached')),
              h('button', { type: 'button', className: 'ase-ghost-link', onClick: onClearAttachment }, T('removeImage')))
            : null,
          h('textarea', {
            className: 'ase-textarea',
            rows: 3,
            placeholder: T('placeholder'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return
              event.preventDefault()
              submit()
            },
          }),
          kwOpen ? panel : null,
          h('div', { className: 'ase-ask-tools' },
            h('input', {
              type: 'file',
              accept: 'image/*',
              className: 'ase-file',
              ref: fileRef,
              onChange: (event) => {
                pickFile(event.target.files && event.target.files[0])
                event.target.value = ''
              },
            }),
            h('button', {
              type: 'button',
              className: 'ase-iconbtn ase-addimg ase-tip',
              'data-tip': T('pickImageTip'),
              'aria-label': T('pickImage'),
              onClick: () => { if (fileRef.current) fileRef.current.click() },
            }, h('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
              h('path', { d: 'M8 3v10M3 8h10', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }))),
            h('button', {
              type: 'button',
              className: 'ase-kw-trigger ase-tip' + (kwOpen ? ' is-open' : ''),
              'data-tip': T('lensToggle'),
              onClick: () => setKwOpen(!kwOpen),
            }, T('lensToggle') + ' ▾'),
            h('div', { className: 'ase-ai-toggle' },
              h('span', { className: 'ase-ai-label' }, T('aiSearch')),
              h('button', {
                type: 'button',
                role: 'switch',
                'aria-checked': aiOn ? 'true' : 'false',
                'aria-label': T('aiSearch'),
                'data-tip': T('aiSearch'),
                className: 'ase-switch' + (aiOn ? ' ase-switch--on' : ''),
                onClick: () => onToggleAi(!aiOn),
              }, h('span', { className: 'ase-switch-knob' }))),
            h('button', {
              type: 'button',
              className: 'ase-send ase-tip',
              'data-tip': T('search'),
              'aria-label': T('search'),
              disabled: loading || (!String(query || '').trim() && !attachment),
              onClick: submit,
            }, h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
              h('circle', { cx: 7, cy: 7, r: 4.6, stroke: 'currentColor', strokeWidth: 1.7 }),
              h('path', { d: 'M10.4 10.4 14 14', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }))))),
        !hasToken
          ? h('p', { className: 'ase-note' },
            h('span', null, T('noToken')),
            h('button', { type: 'button', className: 'ase-ghost-link', onClick: openToken }, T('settings')))
          : null,
        h('section', { className: 'ase-results' },
          h('div', { className: 'ase-results-head' },
            h('div', { className: 'ase-results-title' },
              h('h2', { className: 'ase-h2' }, T('results')),
              results.length ? h('span', { className: 'ase-results-count' }, String(results.length)) : null),
            h('div', { className: 'ase-results-actions' },
              status === 'ok' && canMore
                ? h('button', { type: 'button', className: 'ase-btn', onClick: more }, T('more'))
                : null)),
          understood && status !== 'needs-ai'
            ? h('p', { className: 'ase-understood', title: understood },
              h('span', { className: 'ase-understood-key' }, T('queryTerms')),
              understood)
            : null,
          aiNote ? h('p', { className: 'ase-warn' }, aiNoteMessage(aiNote.reason, T, aiNote.detail)) : null,
          (warnings || []).map((warning) => h('p', { key: warning, className: 'ase-warn' }, warning)),
          loading
            ? h('div', { className: 'ase-grid' },
              Array.from({ length: 8 }, (_, index) => h('div', { key: index, className: 'ase-tile ase-tile--skeleton' },
                h('div', { className: 'ase-skeleton ase-thumb' }),
                h('figcaption', null, h('div', { className: 'ase-skeleton', style: { height: 10, width: '70%' } })))))
            : null,
          status === 'needs-ai'
            ? h('div', { className: 'ase-empty' },
              h('h3', null, T('aiNeeded')),
              h('p', null, T('aiNeededBody')),
              h('button', {
                type: 'button',
                className: 'ase-btn ase-btn--primary',
                onClick: () => { onToggleAi(true); onAiRetry() },
              }, T('aiNeededCta')))
            : null,
          status === 'error'
            ? h('div', { className: 'ase-empty' },
              h('h3', null, T('searchFail')),
              understood ? h('p', { className: 'ase-fail-query' }, T('queryTerms') + ' ' + understood) : null,
              h('p', null, failureMessage(failure, T)),
              hint ? h('p', null, hint) : null,
              h('button', { type: 'button', className: 'ase-btn', onClick: submit }, T('retry')))
            : null,
          status === 'ok' && results.length
            ? h('div', { className: 'ase-grid' },
              results.map((frame) => h(FrameTile, {
                key: frameKey(frame),
                frame,
                busy: busyId === frameKey(frame),
                onAdd: openBoardModal,
                onSimilar: similar,
                onZoom: openZoom,
              })))
            : null,
          status === 'ok' && results.length
            ? (canLoadMore
              ? h('button', {
                type: 'button',
                className: 'ase-btn ase-more',
                disabled: loadingMore,
                onClick: loadMore,
              }, loadingMore ? T('loadMore') + '…' : T('loadMore'))
              : h('p', { className: 'ase-nomore' }, T('noMore')))
            : null,
          status === 'ok' && !results.length
            ? h('div', { className: 'ase-empty' },
              h('h3', null, T('resultsEmpty')),
              h('p', null, hint || failureMessage(null, T)),
              canLoose && onLooseRetry
                ? h('button', { type: 'button', className: 'ase-btn', onClick: onLooseRetry }, T('retryLoose'))
                : null)
            : null))
    }

    function Page({ translator }) {
      const t = translator
      const [restored] = useState(loadView)
      const [tab, setTab] = useState(restored.tab === 'boards' ? 'boards' : 'discover')
      const [boards, setBoards] = useState(loadBoards)
      const sortedBoards = [...boards].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt)
      const [activeBoard, setActiveBoard] = useState(typeof restored.activeBoard === 'string' ? restored.activeBoard : null)
      const [query, setQuery] = useState(typeof restored.query === 'string' ? restored.query : '')
      const [vocabulary, setVocabulary] = useState([])
      const [kwStore, setKwStore] = useState(loadKeywords)
      const [vocabVersion, setVocabVersion] = useState(0)
      const [results, setResults] = useState(Array.isArray(restored.results) ? restored.results : [])
      const [status, setStatus] = useState(Array.isArray(restored.results) && restored.results.length ? 'ok' : 'idle')
      const [hint, setHint] = useState('')
      const [warnings, setWarnings] = useState(Array.isArray(restored.warnings) ? restored.warnings : [])
      const [lastKind, setLastKind] = useState(restored.lastKind === 'similar' ? 'similar' : 'text')
      const [zoom, setZoom] = useState(null)
      const [expanding, setExpanding] = useState(null)
      const [page, setPage] = useState(Number(restored.page) || 0)
      const [loadingMore, setLoadingMore] = useState(false)
      const [noMore, setNoMore] = useState(Boolean(restored.noMore))
      const [total, setTotal] = useState(Number(restored.total) || 0)
      const lastSearch = useRef(
        restored.params && typeof restored.params === 'object' && typeof restored.params.query === 'string'
          ? restored.params
          : null,
      )
      const [attachment, setAttachment] = useState(null)
      const [understood, setUnderstood] = useState(typeof restored.understood === 'string' ? restored.understood : '')
      const [aiNote, setAiNote] = useState(null)
      const [failure, setFailure] = useState(null)
      const [aiOn, setAiOn] = useState(() => {
        try { return window.localStorage.getItem(AI_KEY) !== '0' } catch { return true }
      })
      const [modalFrame, setModalFrame] = useState(null)
      const [suggests, setSuggests] = useState(null)
      const [presets, setPresets] = useState([])
      const [suggestBusy, setSuggestBusy] = useState(null)
      const [toast, setToast] = useState('')
      const [settingsOpen, setSettingsOpen] = useState(false)
      const [drafts, setDrafts] = useState({})
      const scroller = useRef(null)

      useEffect(() => {
        const token = readToken()
        if (!token) { setVocabulary([]); return undefined }
        let alive = true
        fetch('/anistyle/vocabulary', { headers: { 'x-ft-token': token, Accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => { if (alive && data && data.source === 'vocabulary') setVocabulary(parseVocabulary(data)) })
          .catch(() => {})
        return () => { alive = false }
      }, [vocabVersion])

      useEffect(() => {
        try { window.localStorage.setItem(BOARDS_KEY, JSON.stringify(boards)) } catch {}
      }, [boards])

      useEffect(() => {
        let alive = true
        fetch('/anistyle/presets', { headers: { Accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => { if (alive && data && Array.isArray(data.boards)) setPresets(data.boards) })
          .catch(() => {})
        return () => { alive = false }
      }, [])

      useEffect(() => {
        try {
          window.localStorage.setItem(VIEW_KEY, JSON.stringify({
            tab, query, activeBoard, results, warnings, lastKind, understood,
            params: lastSearch.current, page, total, noMore,
          }))
        } catch {}
      }, [tab, query, activeBoard, results, warnings, lastKind, understood, page, total, noMore])

      useEffect(() => {
        if (!toast) return undefined
        const timer = window.setTimeout(() => setToast(''), 2400)
        return () => window.clearTimeout(timer)
      }, [toast])

      const activeBoardData = activeBoard ? boards.find((board) => board.id === activeBoard) : null

      const runSearch = useCallback(async (mode, styleValue) => {
        const text = String(mode && mode.text ? mode.text : query).trim()
        if (!text) return
        setStatus('loading')
        setHint('')
        setWarnings([])
        setResults([])
        setUnderstood('')
        setAiNote(null)
        setFailure(null)
        setLastKind('text')
        try {
          const useAi = aiOn || Boolean(mode && mode.forceAi)
          let queryText = text
          let modelStyle = ''
          let modelTitle = ''
          let modelGenre = ''
          let modelPerTitle = 3
          if (useAi) {
            try {
              const interpreted = await api('/anistyle/interpret', { text })
              const params = interpreted && interpreted.source === 'model' ? interpreted.params : null
              if (params && params.query) {
                queryText = params.query
                modelStyle = params.style || ''
                modelTitle = params.title || ''
                modelGenre = params.genre || ''
                modelPerTitle = params.perTitle || 3
              } else {
                setAiNote({ reason: (interpreted && interpreted.reason) || 'no-model', detail: (interpreted && interpreted.detail) || '' })
              }
            } catch (error) {
              setAiNote({ reason: 'unreachable', detail: String((error && error.message) || '').slice(0, 120) })
            }
          }
          if (/[\u3400-\u9fff]/.test(queryText)) {
            // the library matches English frame descriptions; a Chinese query only
            // returns its default page, so report "nothing found" instead of showing it
            setUnderstood(text)
            setStatus('needs-ai')
            return
          }
          const loose = Boolean(mode && mode.loose)
          const payload = { query: queryText, limit: PAGE_SIZE, perTitle: loose ? 3 : modelPerTitle }
          if (!loose && modelTitle) payload.title = modelTitle
          if (!loose && modelGenre) payload.genre = modelGenre
          lastSearch.current = { query: payload.query }
          if (payload.title) lastSearch.current.title = payload.title
          if (payload.genre) lastSearch.current.genre = payload.genre
          setPage(0)
          setNoMore(false)
          setTotal(0)
          setUnderstood(payload.query)
          const style = loose ? '' : styleValue === undefined ? modelStyle : styleValue
          if (style) {
            payload.style = style
            lastSearch.current.style = style
          }
          const data = await api('/anistyle/frames', payload)
          if (data.source === 'framethrower') {
            const frames = data.frames || []
            setResults(frames)
            setTotal(Number(data.total) > frames.length ? Number(data.total) : 0)
            setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
            setStatus('ok')
            return
          }
          setResults([])
          setFailure({ source: data.source, status: data.status, hint: data.hint })
          setStatus(data.source === 'unconfigured' ? 'unconfigured' : data.source === 'unauthorized' ? 'unauthorized' : 'error')
        } catch (error) {
          setStatus('error')
          setFailure({ source: 'client', hint: String(error.message || error) })
          setResults([])
        }
      }, [query, aiOn])

      const submit = useCallback((override) => {
        const image = (override && override.image) || (attachment && attachment.dataUrl)
        if (image) {
          setStatus('loading')
          setHint('')
          setWarnings([])
          setResults([])
          setUnderstood('')
          setAiNote(null)
          setFailure(null)
          setLastKind('similar')
          api('/anistyle/similar', { image, limit: 24 })
            .then((data) => {
              if (data.source === 'framethrower') { setResults(data.frames || []); setStatus('ok') }
              else {
                setResults([])
                setFailure({ source: data.source, status: data.status, hint: data.hint })
                setStatus(data.source === 'unconfigured' ? 'unconfigured' : 'error')
              }
            })
            .catch((error) => {
              setStatus('error')
              setFailure({ source: 'client', hint: String(error.message || error) })
              setResults([])
            })
          return
        }
        runSearch({ text: (override && override.text) || query })
      }, [runSearch, query, attachment])

      const loadMore = useCallback(async () => {
        if (loadingMore || !results.length || noMore) return
        // a reload restores the grid, so rebuild the request from what is on screen
        const base = lastSearch.current || (understood ? { query: understood } : null)
        if (!base) {
          setToast(t('resultsEmptyBody'))
          return
        }
        const nextPage = page + 1
        if (nextPage * PAGE_SIZE > 200) {
          setNoMore(true)
          return
        }
        setLoadingMore(true)
        try {
          const data = await api('/anistyle/frames', {
            ...base,
            limit: PAGE_SIZE,
            offset: nextPage * PAGE_SIZE,
            perTitle: base.perTitle || 3,
          })
          if (data.source === 'framethrower') {
            const seen = new Set(results.map(frameKey))
            const fresh = (data.frames || []).filter((frame) => !seen.has(frameKey(frame)))
            if (!fresh.length) setNoMore(true)
            else {
              setResults(results.concat(fresh))
              setPage(nextPage)
              const size = Number(data.total)
              if (size > 0) setTotal(size)
            }
          } else {
            // a rate limit or a bad token must stay retryable, so keep the button
            setToast(data.hint || failureMessage({ source: data.source, status: data.status }, t))
          }
        } catch (error) {
          setToast(String(error.message || error))
        } finally {
          setLoadingMore(false)
        }
      }, [loadingMore, noMore, results, page, t])

      const more = useCallback(async () => {
        if (!results.length || status !== 'ok') return
        const base = lastSearch.current || { query: query.trim() }
        const nextPage = page + 1
        setStatus('loading')
        try {
          const data = await api('/anistyle/frames', {
            ...base,
            limit: PAGE_SIZE,
            offset: nextPage * PAGE_SIZE,
            perTitle: base.perTitle || 3,
          })
          if (data.source === 'framethrower') {
            const frames = data.frames || []
            // 换一批 replaces the current grid instead of stacking another page onto it
            setResults(frames)
            setStatus('ok')
            if (!frames.length) {
              setPage(0)
              setToast(t('resultsEmpty'))
            } else {
              setPage(nextPage)
            }
          } else {
            setStatus('ok')
            setToast(data.hint || t('resultsEmpty'))
          }
        } catch (error) {
          setStatus('ok')
          setToast(String(error.message || error))
        }
      }, [results, status, query, page, t])

      const similar = useCallback((frame) => {
        if (!frame || expanding) return
        if (!frame.id) { setToast(t('noSimilar')); return }
        const anchor = frameKey(frame)
        setExpanding(anchor)
        api('/anistyle/similar', { frameId: frame.id, limit: 12 })
          .then((data) => {
            const incoming = data.source === 'framethrower' ? (data.frames || []) : []
            const have = new Set(results.map(frameKey))
            have.delete(anchor)
            const pick = incoming.find((item) => !have.has(frameKey(item)))
            if (!pick) {
              setToast(data.hint || t('noSimilar'))
              return
            }
            // swap just this card: the rest of the grid stays exactly as it was
            setResults((current) => current.map((item) => (frameKey(item) === anchor ? pick : item)))
          })
          .catch((error) => setToast(String(error.message || error)))
          .finally(() => setExpanding(null))
      }, [expanding, results, t])

      const runSuggest = useCallback((anchors) => {
        const picks = (anchors || []).filter((frame) => frame && frame.id)
        if (!picks.length) { setToast(t('noSimilar')); return }
        setSuggestBusy(picks.length === 1 ? frameKey(picks[0]) : '__multi__')
        setSuggests({ anchors: picks, frames: [], loading: true })
        api('/anistyle/similar', { frameIds: picks.map((frame) => frame.id), limit: 12 })
          .then((data) => {
            const incoming = data.source === 'framethrower' ? (data.frames || []) : []
            setSuggests({ anchors: picks, frames: incoming, loading: false })
            if (!incoming.length) setToast(data.hint || t('noSimilar'))
          })
          .catch((error) => {
            setSuggests(null)
            setToast(String(error.message || error))
          })
          .finally(() => setSuggestBusy(null))
      }, [t])

      const suggestFrom = useCallback((frame) => runSuggest([frame]), [runSuggest])

      // a few random frames of this board used together as one visual reference
      const sampleSuggest = useCallback(() => {
        const pool = (activeBoardData ? activeBoardData.items : []).filter((frame) => frame && frame.id)
        if (!pool.length) { setToast(t('noSimilar')); return }
        const rest = pool.slice()
        const picks = []
        while (picks.length < Math.min(3, rest.length)) {
          picks.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0])
        }
        runSuggest(picks)
      }, [activeBoardData, runSuggest])

      const rememberKeywords = useCallback((next) => {
        setKwStore(next)
        try { window.localStorage.setItem(KW_KEY, JSON.stringify(next)) } catch {}
      }, [])

      const addGroup = useCallback(() => {
        const id = 'g_' + Date.now().toString(36)
        rememberKeywords({ ...kwStore, groups: kwStore.groups.concat({ id, name: '新类别', terms: [] }) })
        return id
      }, [kwStore, rememberKeywords])

      const renameGroup = useCallback((groupId, builtin, next) => {
        const name = String(next || '').trim()
        if (!name) return
        if (builtin) {
          rememberKeywords({ ...kwStore, labels: { ...kwStore.labels, [groupId]: name } })
          return
        }
        rememberKeywords({
          ...kwStore,
          groups: kwStore.groups.map((group) => (group.id === groupId ? { ...group, name } : group)),
        })
      }, [kwStore, rememberKeywords])

      const deleteGroup = useCallback((groupId, builtin) => {
        if (builtin) {
          rememberKeywords({ ...kwStore, hiddenGroups: Array.from(new Set(kwStore.hiddenGroups.concat(groupId))) })
          return
        }
        rememberKeywords({ ...kwStore, groups: kwStore.groups.filter((group) => group.id !== groupId) })
      }, [kwStore, rememberKeywords])

      const addTerm = useCallback((groupId, builtin, term) => {
        const value = String(term || '').trim()
        if (!value) return
        const target = builtin ? kwStore.groups[0] : kwStore.groups.find((group) => group.id === groupId)
        if (!target) {
          rememberKeywords({
            ...kwStore,
            groups: [{ id: 'g_' + Date.now().toString(36), name: '自定义', terms: [value] }],
          })
          return
        }
        rememberKeywords({
          ...kwStore,
          groups: kwStore.groups.map((group) => (group.id === target.id
            ? { ...group, terms: Array.from(new Set(group.terms.concat(value))) }
            : group)),
        })
      }, [kwStore, rememberKeywords])

      const removeTerm = useCallback((groupId, builtin, term) => {
        if (builtin) {
          rememberKeywords({ ...kwStore, hidden: Array.from(new Set(kwStore.hidden.concat(term))) })
          return
        }
        rememberKeywords({
          ...kwStore,
          groups: kwStore.groups.map((group) => (group.id === groupId
            ? { ...group, terms: group.terms.filter((item) => item !== term) }
            : group)),
        })
      }, [kwStore, rememberKeywords])

      const renameTerm = useCallback((groupId, builtin, term, next) => {
        const value = String(next || '').trim()
        if (!value || value === term) return
        if (!builtin) {
          rememberKeywords({
            ...kwStore,
            groups: kwStore.groups.map((group) => (group.id === groupId
              ? { ...group, terms: group.terms.map((item) => (item === term ? value : item)) }
              : group)),
          })
          return
        }
        // built-in term: hide the original, keep the edited wording as your own
        removeTerm(groupId, true, term)
        addTerm('', true, value)
      }, [kwStore, rememberKeywords, removeTerm, addTerm])

      const restoreKeywords = useCallback(() => {
        rememberKeywords({ ...kwStore, hidden: [], hiddenGroups: [], labels: {} })
      }, [kwStore, rememberKeywords])

      const createBoard = useCallback((rawName) => {
        const name = String(rawName || '').trim() || untitledName(boards, t('untitled'))
        const board = { id: newId(), name, createdAt: Date.now(), updatedAt: Date.now(), items: [], pinned: false }
        setBoards((list) => [board, ...list])
        return board
      }, [boards, t])

      const togglePin = useCallback((boardId) => {
        setBoards((list) => list.map((board) => (board.id === boardId ? { ...board, pinned: !board.pinned } : board)))
      }, [])

      const installPresets = useCallback(() => {
        const names = new Set(boards.map((board) => board.name))
        const additions = presets
          .filter((board) => board && Array.isArray(board.items) && !names.has(board.name))
          .map((board) => ({
            ...board,
            id: newId(),
            pinned: false,
            createdAt: Number(board.createdAt) || Date.now(),
            updatedAt: Number(board.updatedAt) || Date.now(),
          }))
        if (!additions.length) { setToast(t('presetsNone')); return }
        setBoards((list) => additions.concat(list))
        setToast(t('presetsAdded') + ' ' + additions.length)
      }, [boards, presets, t])

      const savePresets = useCallback(() => {
        api('/anistyle/presets', { boards })
          .then((data) => setToast(t('presetSaved') + ' ' + (data?.saved ?? boards.length)))
          .catch((error) => setToast(String(error.message || error)))
      }, [boards, t])

      const addToBoard = useCallback((boardId, frame, keepOpen) => {
        if (!frame) { setModalFrame(null); return }
        const target = boards.find((board) => board.id === boardId)
        const key = frameKey(frame)
        const duplicate = Boolean(target && target.items.some((item) => frameKey(item) === key))
        if (!duplicate) {
          setBoards((list) => list.map((board) => board.id === boardId
            ? { ...board, updatedAt: Date.now(), items: [frame, ...board.items] }
            : board))
        }
        setToast(duplicate ? t('duplicate') : t('added') + ' 《' + (target ? target.name : '') + '》')
        if (!keepOpen) setModalFrame(null)
      }, [boards, t])

      const removeFromBoard = useCallback((boardId, frame) => {
        setBoards((list) => list.map((board) => board.id === boardId
          ? { ...board, updatedAt: Date.now(), items: board.items.filter((item) => frameKey(item) !== frameKey(frame)) }
          : board))
      }, [])

      const deleteBoard = useCallback((boardId) => {
        if (typeof window !== 'undefined' && !window.confirm(t('confirmDelete'))) return
        setBoards((list) => list.filter((board) => board.id !== boardId))
        if (activeBoard === boardId) setActiveBoard(null)
      }, [activeBoard, t])

      const exportMarkdown = useCallback((board) => {
        const palette = boardPalette(board.items)
        const lines = ['# ' + board.name, '', '_' + board.items.length + ' frames_', '']
        if (palette.length) lines.push('Palette: ' + palette.join(' '), '')
        board.items.forEach((frame, index) => {
          lines.push((index + 1) + '. **' + (frame.title || 'frame') + '**' + (frame.year ? ' (' + frame.year + ')' : ''))
          if (frame.caption) lines.push('   ' + frame.caption)
          if (frame.tags && frame.tags.length) lines.push('   ' + frame.tags.join(' · '))
          if (frame.palette && frame.palette.length) lines.push('   ' + frame.palette.join(' '))
          if (frame.link) lines.push('   [FrameThrower](' + frame.link + ')')
          lines.push('   ![frame](' + (frame.image || frame.thumb) + ')')
          lines.push('')
        })
        download((board.name || 'moodboard') + '.md', lines.join('\n'), 'text/markdown;charset=utf-8')
      }, [])

      const zoomInto = useCallback((frames, boardId) => (frame) => {
        const index = frames.findIndex((item) => frameKey(item) === frameKey(frame))
        setZoom({ frames, index: index < 0 ? 0 : index, boardId: boardId || null })
      }, [])

      const keywordGroups = buildKeywordGroups(vocabulary, kwStore)
      const canRestoreKeywords = Boolean(
        (kwStore.hidden && kwStore.hidden.length)
        || (kwStore.hiddenGroups && kwStore.hiddenGroups.length)
        || Object.keys(kwStore.labels || {}).length,
      )

      const hasToken = Boolean(readToken())

      return h('div', { className: 'ase-root', ref: scroller },
        h('div', { className: 'ase-wrap' },
          h('header', { className: 'ase-topbar' },
            h('div', { className: 'ase-brand' },
              h('span', { className: 'ase-dot' }),
              h('span', { className: 'ase-eyebrow' }, t('nav'))),
            h('nav', { className: 'ase-tabs' },
              h('button', { type: 'button', className: 'ase-tab' + (tab === 'discover' ? ' ase-tab--on' : ''), onClick: () => setTab('discover') }, t('discover')),
              h('button', {
                type: 'button',
                className: 'ase-tab' + (tab === 'boards' ? ' ase-tab--on' : ''),
                onClick: () => { setTab('boards'); setActiveBoard(null) },
              }, t('boards'))),
            h('button', {
              type: 'button',
              className: 'ase-iconbtn ase-tip',
              'data-tip': t('settings'),
              'aria-label': t('settings'),
              onClick: () => {
                setDrafts(Object.fromEntries(SOURCES.map((source) => [source.id, readKey(source.key)])))
                setSettingsOpen(true)
              },
            }, h(GearIcon, { size: 17 }))),
          tab === 'discover'
            ? h(Discover, {
              state: {
                query, setQuery, results, status, hint, warnings,
                submit, more, similar,
                canMore: status === 'ok' && results.length > 0 && lastKind === 'text',
                openBoardModal: (frame) => setModalFrame(frame || {}),
                openZoom: zoomInto(results),
                busyId: expanding,
                attachment,
                onAttachment: (image) => setAttachment(image),
                onClearAttachment: () => setAttachment(null),
                onImageError: () => setToast(t('imageFailed')),
                understood, aiOn, aiNote, failure,
                onToggleAi: (next) => {
                  setAiOn(next)
                  try { window.localStorage.setItem(AI_KEY, next ? '1' : '0') } catch {}
                },
                onAiRetry: () => runSearch({ text: query, forceAi: true }),
                loadMore,
                loadingMore,
                canLoadMore: status === 'ok' && results.length > 0 && lastKind === 'text' && !noMore
                  && (!total || results.length < total),
                noMore,
                canLoose: Boolean(lastSearch.current && (lastSearch.current.title || lastSearch.current.genre || lastSearch.current.style)),
                onLooseRetry: () => runSearch({ text: query, loose: true }),
                hasToken, openToken: () => {
                  setDrafts(Object.fromEntries(SOURCES.map((source) => [source.id, readKey(source.key)])))
                  setSettingsOpen(true)
                },
                keywordGroups, addGroup, renameGroup, deleteGroup, addTerm, removeTerm, renameTerm,
                restoreKeywords, canRestore: canRestoreKeywords,
              },
            })
            : activeBoardData
              ? h(BoardView, {
                board: activeBoardData,
                onBack: () => { setSuggests(null); setActiveBoard(null) },
                onRename: (name) => setBoards((list) => list.map((board) => board.id === activeBoardData.id
                  ? { ...board, name, updatedAt: Date.now() }
                  : board)),
                onRemoveFrame: (frame) => removeFromBoard(activeBoardData.id, frame),
                onExport: () => exportMarkdown(activeBoardData),
                onDiscover: () => setTab('discover'),
                onZoomItem: zoomInto(activeBoardData.items, activeBoardData.id),
                onSimilar: suggestFrom,
                onSample: sampleSuggest,
                suggestBusy,
                suggests,
                onCloseSuggest: () => setSuggests(null),
                onZoomSuggest: (frame) => {
                  if (suggests) zoomInto(suggests.frames, activeBoardData.id)(frame)
                },
                onAddSuggest: (frame) => addToBoard(activeBoardData.id, frame),
              })
              : h(BoardsHome, {
                boards: sortedBoards,
                onCreate: (name) => setActiveBoard(createBoard(name).id),
                onPin: togglePin,
                presets,
                onInstallPresets: installPresets,
                onOpen: (id) => setActiveBoard(id),
                onDelete: deleteBoard,
              }),
          ),
        modalFrame
          ? h(BoardModal, {
            frame: modalFrame,
            boards,
            onClose: () => setModalFrame(null),
            onAdd: (boardId) => addToBoard(boardId, modalFrame, true),
            onCreate: (name) => {
              const board = createBoard(name)
              const item = modalFrame && frameKey(modalFrame) ? modalFrame : null
              if (item) {
                setBoards((list) => list.map((entry) => entry.id === board.id
                  ? { ...entry, updatedAt: Date.now(), items: [item] }
                  : entry))
              }
              setToast(t('added') + ' 《' + board.name + '》')
            },
          })
          : null,
        zoom
          ? h(Lightbox, {
            frames: zoom.frames,
            index: zoom.index,
            onClose: () => setZoom(null),
            addLabel: zoom.boardId ? t('addToBoard') : null,
            isAdded: (frame) => {
              if (!zoom.boardId) return false
              const board = boards.find((item) => item.id === zoom.boardId)
              return Boolean(board && board.items.some((item) => frameKey(item) === frameKey(frame)))
            },
            onAdd: (frame) => {
              if (zoom.boardId) { addToBoard(zoom.boardId, frame); return }
              setZoom(null)
              setModalFrame(frame)
            },
            onIndex: (index) => setZoom((current) => {
              if (!current) return current
              const next = Math.max(0, Math.min(current.frames.length - 1, index))
              return next === current.index ? current : { ...current, index: next }
            }),
          })
          : null,
        settingsOpen
          ? h(Settings, {
            drafts,
            configured: Object.fromEntries(SOURCES.map((source) => [source.id, Boolean(readKey(source.key))])),
            onDraft: (id, value) => setDrafts((current) => ({ ...current, [id]: value })),
            onSave: (source) => {
              writeKey(source.key, String(drafts[source.id] || '').trim())
              setSettingsOpen(false)
              setVocabVersion((value) => value + 1)
              setToast(t('save') + ' ✓')
            },
            onClear: (source) => {
              writeKey(source.key, '')
              setDrafts((current) => ({ ...current, [source.id]: '' }))
              setVocabulary([])
            },
            onClose: () => setSettingsOpen(false),
            onSavePreset: savePresets,
          })
          : null,
        toast ? h('div', { className: 'ase-toast' }, toast) : null)
    }

    // ------------------------------------------------------------------ locale

    function failureMessage(failure, T) {
      if (!failure) return T('resultsEmptyBody')
      const status = failure.status
      if (failure.source === 'unauthorized') return T('failAuth')
      if (status === 402) return T('failCredits')
      if (status === 429) return T('failTooMany')
      if (failure.source === 'unreachable') return T('failNetwork')
      if (status === 400) return T('failRejected') + (failure.hint ? ' · ' + failure.hint : '')
      if (status) return T('failStatus') + ' ' + status + (failure.hint ? ' · ' + failure.hint : '')
      return failure.hint || T('resultsEmptyBody')
    }

    function aiNoteMessage(reason, T, detail) {
      const key = {
        'no-llm': 'aiNoLlm',
        'no-model': 'aiNoModel',
        unparsed: 'aiUnparsed',
        timeout: 'aiTimeout',
        'call-failed': 'aiCallFailed',
        unreachable: 'aiUnreachable',
      }[reason]
      const base = key ? T(key) : T('aiCallFailed')
      const extra = detail ? '（' + String(detail).slice(0, 120) + '）' : ''
      return T('aiOff') + '：' + base + extra + ' · ' + T('aiFellBack')
    }

    function createTranslator(ctx) {
      let translate = null
      try { translate = ctx.locale.bind(NS) } catch { translate = null }
      return (key) => {
        if (!translate) return DICT.zh[key] || key
        try {
          const value = translate(key)
          return typeof value === 'string' && value && value !== key ? value : (DICT.zh[key] || key)
        } catch {
          return DICT.zh[key] || key
        }
      }
    }

    function useTranslator(ctx) {
      const [version, setVersion] = useState(0)
      useEffect(() => ctx.locale.subscribe(() => setVersion((value) => value + 1)), [ctx])
      return useMemo(() => createTranslator(ctx), [ctx, version])
    }

    function Content(props) {
      const t = useTranslator(props.__ctx)
      return h(I18n.Provider, { value: t }, h(Page, { translator: t }))
    }

    function NavIcon({ size, active, label }) {
      const edge = size || 18
      return h('svg', {
        width: edge, height: edge, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, style: { display: 'block' },
      },
        h('rect', { x: 2.2, y: 4.2, width: 19.6, height: 14, rx: 3, stroke: 'currentColor', strokeWidth: active ? 1.9 : 1.6, opacity: active ? 1 : 0.85 }),
        h('path', { d: 'M7.6 4.4v13.6M16.4 4.4v13.6', stroke: 'currentColor', strokeWidth: 1.1, opacity: 0.4 }),
        label ? h('title', null, label) : null,
        h('path', { d: 'M10.4 9.1l4.4 2.4-4.4 2.4z', fill: 'currentColor', opacity: active ? 1 : 0.85 }))
    }

    // --------------------------------------------------------------------- css

    const CSS = `
.ase-root{height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.ase-wrap{max-width:1240px;margin:0 auto;padding:24px 30px 90px}
.ase-topbar{position:relative;display:flex;align-items:center;gap:20px;margin-bottom:22px}
.ase-brand{display:flex;align-items:center;gap:9px;margin-right:auto}
.ase-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
.ase-eyebrow{font:600 10.5px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);margin:0}
.ase-tabs{display:flex;gap:2px;padding:3px;border-radius:9px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}
.ase-tab{border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;padding:6px 14px;border-radius:7px;cursor:pointer}
.ase-tab:hover{color:var(--dsw-alias-label-primary)}
.ase-tab--on{background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.18)}
.ase-ghost-link{background:none;border:0;padding:4px 2px;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer;border-bottom:1px solid transparent}
.ase-ghost-link:hover{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-border-l2)}
.ase-h1{font-size:32px;line-height:1.2;font-weight:650;letter-spacing:-.022em;margin:10px 0 8px}
.ase-sub{color:var(--dsw-alias-label-secondary);font-size:13.5px;line-height:1.7;max-width:680px;margin:0}
.ase-ask{margin:6px 0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:15px;background:var(--dsw-alias-bg-layer-1);padding:14px 14px 10px;transition:border-color .16s,box-shadow .16s}
.ase-ask:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ase-textarea{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:15px;line-height:1.65;resize:none}
.ase-textarea::placeholder,.ase-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}
.ase-ask--open{box-shadow:0 20px 44px -30px rgba(0,0,0,.6)}
.ase-ask-tools{display:flex;align-items:center;gap:10px;margin-top:4px}
.ase-ai-toggle{margin-left:auto;display:flex;align-items:center;gap:6px}
.ase-ai-label{font-size:10.5px;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}
.ase-modal-x{position:absolute;top:14px;right:14px;width:26px;height:26px;border-radius:50%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:16px;line-height:1;cursor:pointer}
.ase-modal-x:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ase-send{margin-left:0;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border-radius:50%;border:0;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);cursor:pointer;transition:opacity .14s,transform .14s}
.ase-send:hover:not(:disabled){transform:translateY(-1px)}
.ase-send:disabled{opacity:.35;cursor:default}
.ase-kw-trigger{font-size:11.5px;color:var(--dsw-alias-label-secondary);border:0;background:none;padding:4px 2px;cursor:pointer}
.ase-kw-trigger:hover,.ase-kw-trigger.is-open{color:var(--dsw-alias-label-primary)}
.ase-kw-panel{margin:10px 0 2px;padding:10px 11px;border-radius:11px;background:var(--dsw-alias-bg-layer-2)}
.ase-kw-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.ase-kw-head .ase-ghost-link{margin-left:auto}
.ase-kw-hint{font-size:11px;color:var(--dsw-alias-label-secondary)}
.ase-kw-group{display:flex;align-items:flex-start;gap:8px;margin:5px 0}
.ase-kw-labelcell{flex:0 0 auto;display:flex;align-items:center;gap:2px;width:72px;padding-top:3px}
.ase-kw-label{border:0;background:none;padding:0;font:inherit;font-size:10.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;max-width:56px;cursor:default}
.ase-kw-label--edit{cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.ase-kw-label-input{width:56px;font:inherit;font-size:10.5px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:1px 3px;outline:none}
.ase-kw-groupdel{border:0;background:none;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1;padding:0 2px;cursor:pointer}
.ase-kw-groupdel:hover{color:var(--dsw-alias-brand-primary)}
.ase-kw-newgroup{margin-top:8px;font-size:11px}
.ase-kw-restore{margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.ase-kw-restore:hover{color:var(--dsw-alias-brand-primary)}
.ase-kw-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}
.ase-kw{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.ase-kw--on{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.ase-kw-main{border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:1;padding:5px 9px;cursor:pointer;white-space:nowrap}
.ase-kw--on .ase-kw-main{color:var(--dsw-alias-label-primary)}
.ase-kw-main:hover{color:var(--dsw-alias-label-primary)}
.ase-kw-x{border:0;border-left:1px solid var(--dsw-alias-border-l1);background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;padding:4px 7px;cursor:pointer}
.ase-kw-x:hover{color:var(--dsw-alias-brand-primary)}
.ase-kw-input{border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;padding:4px 9px;width:96px;outline:none}
.ase-kw-add{width:112px}
.ase-kw-empty{margin:4px 0 0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.ase-lens-label{flex:0 0 auto;font-size:10.5px;line-height:22px;color:var(--dsw-alias-label-secondary)}
.ase-ask--drop{border-color:var(--dsw-alias-brand-primary)}
.ase-attach{display:flex;align-items:center;gap:10px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:6px 10px 6px 6px}
.ase-attach img{width:54px;height:34px;object-fit:cover;border-radius:6px;display:block}
.ase-attach-label{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.ase-attach .ase-ghost-link{margin-left:auto;font-size:11px}
.ase-results-title{display:flex;align-items:baseline}
.ase-h2{font-size:13px;font-weight:600;margin:0}
.ase-setting-row{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 13px;margin-bottom:10px;background:var(--dsw-alias-bg-layer-1)}
.ase-setting-copy strong{font-size:12.5px;display:block;margin-bottom:3px}
.ase-switch{width:44px;height:26px;flex-shrink:0;border-radius:999px;border:0;background:rgba(120,120,128,.32);position:relative;cursor:pointer;padding:0;transition:background .2s ease}
.ase-switch--on{background:#0a84ff}
.ase-switch-knob{position:absolute;top:2px;left:2px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.22);transition:transform .2s cubic-bezier(.25,.1,.25,1)}
.ase-switch--on .ase-switch-knob{transform:translateX(18px)}
.ase-file{display:none}
.ase-addimg{width:32px;height:32px;border:1px solid var(--dsw-alias-border-l1)}

.ase-input{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:7px 10px;color:inherit;font:inherit;font-size:12.5px;outline:none}
.ase-input:focus{border-color:var(--dsw-alias-brand-primary)}
.ase-input--hero{width:100%;border:0;background:transparent;font-size:15px;padding:6px 2px}
.ase-input--wide{flex:1;min-width:200px;font-size:13px}
.ase-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:9px;padding:7px 14px;font:inherit;font-size:12.5px;cursor:pointer;transition:background .14s,opacity .14s}
.ase-btn:hover{background:var(--dsw-alias-bg-overlay)}
.ase-btn--primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.ase-btn--primary:disabled{opacity:.45;cursor:default}
.ase-hint{margin:10px 2px 0;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.ase-section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:8px 0 18px}
.ase-section-actions{display:flex;align-items:center;gap:8px}
.ase-preset-row{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 13px;margin-bottom:10px;background:var(--dsw-alias-bg-layer-1)}
.ase-preset-row strong{font-size:12.5px;display:block;margin-bottom:3px}
.ase-section-head .ase-h1{margin:0}
.ase-dots{display:inline-flex;border-radius:3px;overflow:hidden}
.ase-dots i{display:block;width:6px;height:11px}
.ase-dots--bar{display:flex;width:100%;height:5px;border-radius:0;margin-top:8px}
.ase-dots--bar i{flex:1;height:100%;width:auto}
.ase-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.ase-tags span{font-size:9.5px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px;white-space:nowrap}
.ase-results{margin-top:26px}
.ase-results-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.ase-results-count{margin-left:8px;font:500 11px/1 ui-monospace,Menlo,monospace;color:var(--dsw-alias-label-secondary)}
.ase-results-actions{display:flex;gap:8px}
.ase-understood-key{margin-right:6px;opacity:.65}
.ase-fail-query{margin:0 0 6px;font:400 11px/1.5 ui-monospace,Menlo,monospace;color:var(--dsw-alias-label-secondary)}
.ase-understood{margin:-6px 0 12px;font:400 11px/1.5 ui-monospace,Menlo,monospace;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ase-warn{margin:0 0 12px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.ase-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.ase-tile--busy .ase-thumb img{opacity:.4;filter:saturate(.6)}
.ase-tile--busy .ase-thumb::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.14) 50%,transparent 80%);background-size:220% 100%;animation:ase-busy-sweep 1.1s linear infinite}
@keyframes ase-busy-sweep{from{background-position:120% 0}to{background-position:-120% 0}}
.ase-tile{margin:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);transition:border-color .16s;display:flex;flex-direction:column}
.ase-tile:hover{border-color:var(--dsw-alias-border-l2)}
.ase-thumb{position:relative;aspect-ratio:16/9;background:var(--dsw-alias-bg-layer-2);overflow:hidden;flex-shrink:0}
.ase-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ase-thumb-fallback{width:100%;height:100%;background:linear-gradient(135deg,var(--dsw-alias-bg-layer-2),var(--dsw-alias-bg-overlay))}
.ase-thumb-actions{position:absolute;right:7px;top:7px;display:flex;gap:5px;opacity:0;transition:opacity .15s}
.ase-tile:hover .ase-thumb-actions{opacity:1}
.ase-mini{width:26px;height:26px;border-radius:7px;border:1px solid rgba(255,255,255,.22);background:rgba(12,12,16,.62);color:#fff;font:500 13px/1 ui-sans-serif,system-ui;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;backdrop-filter:blur(6px)}
.ase-mini:hover{background:rgba(12,12,16,.82)}
.ase-mini--solid{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.ase-mini--danger:hover{background:#c0392b;border-color:transparent}
.ase-tile figcaption{padding:9px 11px 11px;display:flex;flex-direction:column;flex:1}
.ase-tile figcaption strong{display:block;font-size:12px;font-weight:600;margin-bottom:3px}
.ase-tile figcaption p{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ase-tile--skeleton{border-style:dashed}
.ase-skeleton,.ase-tile--skeleton .ase-thumb{background:linear-gradient(100deg,var(--dsw-alias-bg-layer-2) 40%,var(--dsw-alias-bg-layer-1) 50%,var(--dsw-alias-bg-layer-2) 60%);background-size:200% 100%;animation:ase-shimmer 1.4s infinite linear}
.ase-skeleton{border-radius:10px}
@keyframes ase-shimmer{from{background-position:120% 0}to{background-position:-20% 0}}
.ase-empty{border:1px dashed var(--dsw-alias-border-l2);border-radius:14px;padding:32px 24px;text-align:center}
.ase-suggest{margin:0 0 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:13px;padding:12px;background:var(--dsw-alias-bg-layer-1)}
.ase-suggest-head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}
.ase-suggest-head h3{margin:0;font-size:12.5px;font-weight:600}
.ase-suggest-hint{font-size:11px;color:var(--dsw-alias-label-secondary)}
.ase-suggest-head .ase-ghost-link{font-size:11px}
.ase-suggest-head .ase-ghost-link:first-of-type{margin-left:auto}
.ase-suggest-head h3{margin-right:2px}
.ase-suggest-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.ase-sug{position:relative;margin:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-base)}
.ase-sug img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;cursor:zoom-in}
.ase-sug .ase-sug-add{position:absolute;right:5px;top:5px;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:50%;background:transparent;color:#fff;font-size:15px;line-height:1;cursor:pointer;opacity:0;transition:opacity .14s,transform .14s;filter:drop-shadow(0 1px 3px rgba(0,0,0,.8))}
.ase-sug:hover .ase-sug-add,.ase-sug:focus-within .ase-sug-add{opacity:1}
.ase-sug .ase-sug-add:hover{transform:scale(1.12)}
.ase-sug-anchors{display:flex;flex-shrink:0}
.ase-sug-anchors img{width:24px;height:24px;border-radius:6px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.ase-sug-anchors img + img{margin-left:-7px}
.ase-sug-meta{padding:6px 8px 7px;font-size:10.5px;line-height:1.35;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ase-more{display:block;margin:18px auto 0;min-width:120px}
.ase-nomore{margin:18px 0 0;text-align:center;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.ase-empty h3{margin:0 0 8px;font-size:16px}
.ase-empty p{margin:0 0 14px;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.6}
.ase-note{display:flex;align-items:center;gap:8px;margin:14px 0 0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.ase-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;border:1px solid transparent;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}
.ase-iconbtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.ase-settings{width:min(520px,100%)}
.ase-settings-head{margin-bottom:14px}
.ase-source{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 13px;margin-bottom:10px;background:var(--dsw-alias-bg-layer-1)}
.ase-source-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
.ase-source-head strong{font-size:12.5px}
.ase-pill{font-size:10px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px}
.ase-pill--on{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}
.ase-source-form{display:flex;gap:8px;align-items:center}
.ase-source-form .ase-input{flex:1;min-width:0}
.ase-source-docs{display:inline-block;margin-top:8px;font-size:11px;color:var(--dsw-alias-label-secondary);text-decoration:underline;text-underline-offset:2px}
.ase-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.ase-board-card{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:13px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.ase-board-card:hover{border-color:var(--dsw-alias-border-l2)}
.ase-board-open{display:block;width:100%;border:0;background:none;padding:0;cursor:pointer;text-align:left;color:inherit;font:inherit}
.ase-board-cover{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:var(--dsw-alias-bg-layer-2)}
.ase-board-cover--empty{display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--dsw-alias-label-secondary)}
.ase-board-meta{padding:10px 12px 12px}
.ase-board-meta strong{display:block;font-size:13px;margin-bottom:4px}
.ase-board-meta small{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.ase-board-sub{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.ase-board-date{margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}
.ase-board-actions{position:absolute;right:8px;top:8px;display:flex;gap:6px;opacity:0;transform:translateY(-2px);transition:opacity .14s,transform .14s}
.ase-board-card:hover .ase-board-actions,.ase-board-card:focus-within .ase-board-actions{opacity:1;transform:none}
.ase-board-act{width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(12,12,16,.6);color:#fff;cursor:pointer;font-size:13px;line-height:1;padding:0;backdrop-filter:blur(4px)}
.ase-board-pin.is-on{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.ase-board-pin:hover{background:rgba(12,12,16,.85)}
.ase-board-del:hover{background:#c0392b}
.ase-back{background:none;border:0;padding:0 0 14px;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer}
.ase-back:hover{color:var(--dsw-alias-label-primary)}
.ase-board-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:20px}
.ase-board-title-wrap{min-width:0}
.ase-board-title{background:none;border:0;outline:0;color:inherit;font:inherit;font-size:26px;font-weight:640;letter-spacing:-.02em;padding:2px 0;border-bottom:1px solid transparent;min-width:240px;max-width:520px}
.ase-board-title:hover{border-bottom-color:var(--dsw-alias-border-l2)}
.ase-board-title:focus{border-bottom-color:var(--dsw-alias-brand-primary)}
.ase-board-palette{display:flex;align-items:center;gap:8px;margin-top:8px}
.ase-board-palette .ase-dots--bar{width:120px;margin-top:0}
.ase-board-palette code{font-size:10px;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
.ase-board-head-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.ase-scrim{position:fixed;inset:0;background:rgba(8,8,12,.52);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:60;padding:24px}
.ase-modal{position:relative;width:min(460px,100%);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;padding:18px;box-shadow:0 30px 80px -30px rgba(0,0,0,.7);max-height:80vh;overflow:auto}
.ase-modal-head{display:flex;gap:12px;align-items:center;margin-bottom:14px}
.ase-modal-thumb{width:104px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.ase-modal-title{margin:0 0 4px;font-size:15px}
.ase-modal-sub{margin:0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.ase-modal-empty{font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:1.6;margin:0 0 12px}
.ase-chips{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:16px 0 2px;max-height:46vh;overflow-y:auto}
.ase-chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:8px 11px;color:inherit;font:inherit;font-size:12.5px;cursor:pointer;transition:border-color .14s,background .14s}
.ase-chip:hover{border-color:var(--dsw-alias-border-l2)}
.ase-chip span{max-width:224px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ase-chip small{font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.ase-chip.is-in{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.ase-chip.is-in small{color:var(--dsw-alias-label-primary)}
.ase-chip--new{width:34px;height:34px;justify-content:center;padding:0;border:0;border-radius:10px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);font-size:15px;line-height:1}
.ase-chip--new:hover{background:var(--dsw-alias-label-primary);opacity:.85}
.ase-chip-input{width:150px;height:34px;border:1px solid var(--dsw-alias-brand-primary);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:0 11px;outline:none}
.ase-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);padding:9px 16px;border-radius:999px;font-size:12px;box-shadow:0 14px 40px -16px rgba(0,0,0,.6);z-index:70}
.ase-zoomable{cursor:zoom-in}
.ase-tip{position:relative}
.ase-tip::after{content:attr(data-tip);position:absolute;top:calc(100% + 6px);right:0;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:11px;line-height:1;padding:5px 8px;border-radius:6px;white-space:nowrap;opacity:0;transform:translateY(-2px);transition:opacity .12s ease,transform .12s ease;pointer-events:none;z-index:6;box-shadow:0 10px 24px -12px rgba(0,0,0,.6)}
.ase-tip:hover::after{opacity:1;transform:translateY(0)}
.ase-zoom-view{position:fixed;inset:0;z-index:90;background:rgba(6,6,9,.9);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:44px}
.ase-zoom-figure{margin:0;max-width:min(1180px,92vw);display:flex;flex-direction:column;gap:11px}
.ase-zoom-stage{position:relative;display:flex;align-items:center;justify-content:center;min-width:min(70vw,520px);min-height:min(46vh,340px);border-radius:8px;overflow:hidden;background:#000}
.ase-zoom-blur{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(24px) saturate(1.15);transform:scale(1.06);opacity:.6}
.ase-zoom-full{position:relative;display:block;max-width:100%;max-height:74vh;object-fit:contain;border-radius:8px;opacity:0;transition:opacity .16s ease}
.ase-zoom-stage.is-ready .ase-zoom-full{opacity:1}
.ase-zoom-stage.is-ready .ase-zoom-blur{opacity:.25}
.ase-zoom-figure figcaption{display:flex;flex-direction:column;gap:7px;color:rgba(255,255,255,.86);font-size:12px;line-height:1.6}
.ase-zoom-figure figcaption p{margin:0;color:rgba(255,255,255,.86)}
.ase-zoom-meta{display:flex;align-items:baseline;justify-content:space-between;gap:16px;font-size:11.5px;color:rgba(255,255,255,.55)}
.ase-zoom-meta strong{font-size:13px;font-weight:600;color:#fff}
.ase-zoom-actions{display:flex;align-items:center;gap:14px;margin-top:2px}
.ase-zoom-add{margin-left:auto;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:11.5px;line-height:1;padding:7px 13px;border-radius:999px;cursor:pointer;transition:background .14s,border-color .14s}
.ase-zoom-add:hover{background:rgba(255,255,255,.17);border-color:rgba(255,255,255,.42)}
.ase-zoom-added{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;line-height:1;padding:7px 13px;border-radius:999px;border:1px solid rgba(120,220,160,.4);color:rgba(150,235,190,.95);background:rgba(60,160,110,.14)}
.ase-zoom-link{align-self:flex-start;font-size:11px;color:rgba(255,255,255,.6);text-decoration:underline;text-underline-offset:2px}
.ase-zoom-btn{position:absolute;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(22,22,26,.65);color:#fff;font-size:17px;line-height:1;cursor:pointer}
.ase-zoom-btn:hover{background:rgba(44,44,52,.85)}
.ase-zoom-btn::after{border-color:rgba(255,255,255,.14)}
.ase-zoom-btn--close{top:16px;right:16px}
.ase-zoom-btn--prev{left:18px;top:50%;transform:translateY(-50%)}
.ase-zoom-btn--next{right:18px;top:50%;transform:translateY(-50%)}
@media (hover:none){.ase-tip::after{display:none}}
@media (hover:none){.ase-thumb-actions{opacity:1}}
@media (max-width:820px){.ase-topbar{flex-wrap:wrap}.ase-board-head{flex-direction:column;align-items:flex-start}}
`

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const disposers = []
        try {
          disposers.push(ctx.locale.register(NS, 'zh', DICT.zh))
          disposers.push(ctx.locale.register(NS, 'en', DICT.en))
        } catch {}
        ctx.effect(() => () => { for (const dispose of disposers) { try { dispose() } catch {} } })

        ctx.effect(() => {
          const element = document.createElement('style')
          element.dataset.ase = 'anime-style-explorer'
          element.textContent = CSS
          document.head.appendChild(element)
          return () => element.remove()
        })

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'anistyle',
          order: 25,
          label: () => createTranslator(ctx)('nav'),
        }, (props) => h(NavIcon, { ...props, label: createTranslator(ctx)('nav') })))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'anistyle',
        }, (props) => h(Content, { ...props, __ctx: ctx })))
      },
    }
  },
})
