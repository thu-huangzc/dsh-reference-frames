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
    const AI_COUNT_KEY = 'anistyle:ai-count'
    const KW_KEY = 'anistyle:keywords:v1'

    const KW_DEFAULT = { hidden: [], hiddenGroups: [], labels: {}, extra: {}, groups: [] }

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
        const extra = {}
        if (parsed.extra && typeof parsed.extra === 'object') {
          for (const key of Object.keys(parsed.extra)) {
            const list = parsed.extra[key]
            if (!Array.isArray(list)) continue
            extra[key] = list.filter((term) => typeof term === 'string' && term)
          }
        }
        return {
          hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((item) => typeof item === 'string') : [],
          hiddenGroups: Array.isArray(parsed.hiddenGroups)
            ? parsed.hiddenGroups.filter((item) => typeof item === 'string')
            : [],
          labels: parsed.labels && typeof parsed.labels === 'object' ? parsed.labels : {},
          extra,
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
        const values = Array.from(new Set(
          (group.values || []).concat((store.extra && store.extra[group.id]) || []),
        )).filter((value) => !hidden.has(value))
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
        placeholder: "描述你想象的画面感觉",
        lensToggle: "关键词",
        untitled: "未命名情绪板",
        settings: "设置",
        language: "语言",
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
        openOriginal: "打开原图",
        previous: "上一张",
        next: "下一张",
        pickImage: "图片",
        pickImageTip: "选择图片，也可以直接粘贴或拖进来",
        imageAttached: "以这张图检索",
        removeImage: "移除",
        imageFailed: "这张图读不出来，换一张试试",
        noToken: "还没配置 token，检索会失败",
        sources: "检索源",
        sourcesHint: "选择参与这次检索的来源",
        noSources: "没有可用的检索源，先在“检索源”里开启一个",
        noTokenHint: "先给 FrameThrower 填一个 token，或在“检索源”里开启网页图片",
        srcSkipped: "未配置 token，这次跳过",
        noSetup: "无需配置",
        webBadge: "网页",
        failWebNetwork: "连不上网页图片源（网络或服务故障）",
        failWebEmpty: "网页图片源没有返回图片",
        failWebPartial: "部分检索词没有返回图片",
        srcOn: "已开启",
        srcOff: "已关闭",
        srcFramethrower: "FrameThrower",
        srcWeb: "网页图片",
        imageNeedsFrames: "以图检索只走 FrameThrower，先开启它并填好 token",
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
        syncPreset: "同步至 GitHub",
        presetsInstall: "社区情绪板",
        presetsNote: "作者分享的情绪板，挑喜欢的加进你自己的情绪板。",
        presetsAdded: "已安装情绪板",
        presetsNone: "暂时没有可加入的社区情绪板",
        add: "加入",
        presetSaved: "已写入预设文件，情绪板数",
        presetPushed: "已写入并成功推送",
        presetPushFailed: "已写入，但推送失败",
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
        aiTimeout: "模型 15 秒内没回应",
        aiCallFailed: "模型调用失败",
        aiUnreachable: "连不上本机路由（宿主可能没重启）",
        aiFellBack: "已按原文检索",
        aiOff: "AI 未生效",
        aiSearch: "AI检索",
        aiDirections: "AI 方向数",
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
        placeholder: "Describe the feeling of the image in your mind",
        lensToggle: "Keywords",
        untitled: "Untitled board",
        settings: "Settings",
        language: "Language",
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
        openOriginal: "Open original",
        previous: "Previous",
        next: "Next",
        pickImage: "Image",
        pickImageTip: "Pick an image, or just paste / drop one",
        imageAttached: "Searching by this image",
        removeImage: "Remove",
        imageFailed: "That image could not be read",
        noToken: "No token yet — search will fail",
        sources: "Sources",
        sourcesHint: "Pick which sources join this search",
        noSources: "No source is available — enable one under Sources",
        noTokenHint: "Add a FrameThrower token first, or enable web images under Sources",
        srcSkipped: "no token — skipped this search",
        noSetup: "No setup",
        webBadge: "Web",
        failWebNetwork: "Can't reach the web image source",
        failWebEmpty: "The web image source returned nothing",
        failWebPartial: "some search phrases returned no images",
        srcOn: "On",
        srcOff: "Off",
        srcFramethrower: "FrameThrower",
        srcWeb: "Web images",
        imageNeedsFrames: "Image search uses FrameThrower — enable it and add a token first",
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
        syncPreset: "Sync to GitHub",
        presetsInstall: "Community boards",
        presetsNote: "Moodboards shared by the author — add any you like to your own.",
        presetsAdded: "Boards installed",
        presetsNone: "No community boards to add right now",
        add: "Add",
        presetSaved: "Preset file written, boards:",
        presetPushed: "Saved and pushed",
        presetPushFailed: "Written, push failed",
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
        aiTimeout: "The model did not answer within 15s",
        aiCallFailed: "The model call failed",
        aiUnreachable: "Can't reach the local route (host may need a restart)",
        aiFellBack: "searched your text as-is",
        aiOff: "AI did not run",
        aiSearch: "AI search",
        aiDirections: "AI directions",
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

    // Retrieval backends. Each source is independent: the user picks which ones
    // take part in a search, and one failing never blocks the others.
    const SOURCES = [
      {
        id: 'framethrower',
        label: { zh: 'FrameThrower', en: 'FrameThrower' },
        kind: 'token',
        key: TOKEN_KEY,
        docs: 'https://framethrower.ai/settings?tab=api',
      },
      {
        id: 'chrome',
        label: { zh: 'Chrome 网页图片', en: 'Chrome web images' },
        kind: 'web',
      },
    ]
    const SOURCE_IDS = SOURCES.map((source) => source.id)
    const SRC_KEY = 'anistyle:sources:v1'
    const sourceLabel = (source, lang) => (source.label && (source.label[lang] || source.label.zh)) || source.id

    function readKey(key) {
      try { return window.localStorage.getItem(key) || '' } catch { return '' }
    }
    function writeKey(key, value) {
      try {
        if (value) window.localStorage.setItem(key, value)
        else window.localStorage.removeItem(key)
      } catch {}
    }
    function loadSources() {
      try {
        const raw = window.localStorage.getItem(SRC_KEY)
        if (!raw) return SOURCE_IDS.slice()
        const parsed = JSON.parse(raw)
        const list = parsed && Array.isArray(parsed.enabled) ? parsed.enabled : null
        if (!list) return SOURCE_IDS.slice()
        return list.filter((id) => SOURCE_IDS.includes(id))
      } catch { return SOURCE_IDS.slice() }
    }
    function saveSources(list) {
      try { window.localStorage.setItem(SRC_KEY, JSON.stringify({ enabled: list })) } catch {}
    }
    function readToken() {
      return readKey(TOKEN_KEY)
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
    // older web results stored Bing highlight markers; strip them at render time too
    const stripGlyphs = (value) => String(value == null ? '' : value)
      .replace(/[\uE000-\uF8FF\u200B\uFEFF\u00AD]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Interleave several searches round by round so one interpretation cannot
    // take over the whole grid, skipping frames that repeat across the sets.
    function mergeGroups(groups) {
      const seen = new Set()
      const out = []
      const lists = (groups || []).filter((list) => Array.isArray(list))
      const length = lists.reduce((max, list) => Math.max(max, list.length), 0)
      for (let index = 0; index < length; index += 1) {
        for (const list of lists) {
          const frame = list[index]
          if (!frame) continue
          const key = frameKey(frame)
          if (seen.has(key)) continue
          seen.add(key)
          out.push(frame)
        }
      }
      return out
    }

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
      const meta = [stripGlyphs(frame.title), frame.year].filter(Boolean).join(' · ')
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
          h('div', { className: 'ase-tile-head' },
            meta ? h('strong', null, meta) : null,
            frame.src === 'chrome' ? h('span', { className: 'ase-badge' }, T('webBadge')) : null),
          stripGlyphs(frame.caption) ? h('p', null, stripGlyphs(frame.caption)) : null,
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

    function BoardsHome({ boards, onCreate, onOpen, onDelete, onPin, presets, onOpenPresets, onSavePreset, savingPreset }) {
      const T = useT()
      return h('section', null,
        h('div', { className: 'ase-section-head' },
          h('h1', { className: 'ase-h1' }, T('boards')),
          h('div', { className: 'ase-section-actions' },
            onSavePreset
              ? h('button', {
                type: 'button',
                className: 'ase-iconbtn ase-tip ase-tip--top',
                'data-tip': T('syncPreset'),
                'aria-label': T('syncPreset'),
                disabled: Boolean(savingPreset),
                onClick: onSavePreset,
              }, savingPreset
                ? h('svg', { className: 'ase-spin', width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
                  h('circle', { cx: 8, cy: 8, r: 5.6, stroke: 'currentColor', strokeWidth: 1.6, strokeDasharray: '26 9', strokeLinecap: 'round' }))
                : h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
                  h('path', { d: 'M8 10.6V2.7', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
                  h('path', { d: 'M5.2 5.4 8 2.6l2.8 2.8', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
                  h('path', { d: 'M2.8 10.1v2.2c0 .6.5 1.1 1.1 1.1h8.2c.6 0 1.1-.5 1.1-1.1v-2.2', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' })))
              : null,
            presets && presets.length
              ? h('button', {
                type: 'button',
                className: 'ase-btn',
                onClick: onOpenPresets,
              }, T('presetsInstall'))
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

    function CommunityBoards({ presets, existingNames, onAdd, onClose }) {
      const T = useT()
      const [openKey, setOpenKey] = useState(null)
      const open = openKey ? presets.find((board) => (board.id || board.name) === openKey) : null
      const openItems = open && Array.isArray(open.items) ? open.items : []
      const openAdded = open ? existingNames.has(open.name) : false

      const detail = open
        ? h('div', { className: 'ase-community-detail' },
          h('div', { className: 'ase-community-actions' },
            h('button', {
              type: 'button',
              className: 'ase-btn' + (openAdded ? '' : ' ase-btn--primary'),
              disabled: openAdded,
              onClick: () => onAdd(open),
            }, openAdded ? T('added') : T('add'))),
          openItems.length
            ? h('div', { className: 'ase-community-frames' },
              openItems.map((frame) => h('div', {
                key: frameKey(frame),
                className: 'ase-community-frame',
              }, h('img', { src: frame.thumb || frame.image, alt: frame.caption || '', loading: 'lazy' }))))
            : h('p', { className: 'ase-modal-empty' }, T('boardEmpty')))
        : null

      const cards = presets.map((board) => {
        const items = Array.isArray(board.items) ? board.items : []
        const key = board.id || board.name
        const added = existingNames.has(board.name)
        return h('article', { key, className: 'ase-community-card' },
          h('button', {
            type: 'button',
            className: 'ase-community-shot',
            'aria-label': board.name,
            onClick: () => setOpenKey(key),
          },
          items[0] ? h('img', { src: items[0].thumb || items[0].image, alt: '', loading: 'lazy' }) : null,
          h('span', { className: 'ase-community-badge' }, items.length + ' ' + T('items'))),
          h('div', { className: 'ase-community-foot' },
            h('button', {
              type: 'button',
              className: 'ase-community-name',
              onClick: () => setOpenKey(key),
            }, board.name),
            h('button', {
              type: 'button',
              className: 'ase-btn' + (added ? '' : ' ase-btn--primary'),
              disabled: added,
              onClick: () => onAdd(board),
            }, added ? T('added') : T('add'))))
      })

      const grid = presets.length
        ? h('div', { className: 'ase-community-grid' }, cards)
        : h('p', { className: 'ase-modal-empty' }, T('presetsNone'))

      return h('div', { className: 'ase-scrim', onClick: onClose },
        h('div', {
          className: 'ase-modal ase-community',
          onClick: (event) => event.stopPropagation(),
          role: 'dialog',
          'aria-modal': true,
        },
          h('div', { className: 'ase-modal-head' },
            h('div', null,
              open
                ? h('button', {
                  type: 'button',
                  className: 'ase-ghost-link ase-community-back',
                  onClick: () => setOpenKey(null),
                }, '← ' + T('presetsInstall'))
                : null,
              h('h2', { className: 'ase-modal-title' }, open ? open.name : T('presetsInstall')),
              h('p', { className: 'ase-modal-sub' }, open ? (openItems.length + ' ' + T('items')) : T('presetsNote'))),
            h('button', { type: 'button', className: 'ase-modal-x', onClick: onClose, 'aria-label': T('close') }, '×')),
          open ? detail : grid))
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
              onSimilar: onSimilar && frame.src !== 'chrome' ? () => onSimilar(frame) : null,
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

    function Settings({ drafts, configured, enabled, onToggle, onDraft, onSave, onClear, onClose, lang, onChooseLang }) {
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
          h('section', { className: 'ase-source' },
            h('div', { className: 'ase-source-head' }, h('strong', null, T('language'))),
            h('div', { className: 'ase-lang-opts' },
              h('button', {
                type: 'button',
                className: 'ase-btn' + (lang === 'zh' ? ' ase-btn--primary' : ''),
                onClick: () => onChooseLang('zh'),
              }, '简体中文'),
              h('button', {
                type: 'button',
                className: 'ase-btn' + (lang === 'en' ? ' ase-btn--primary' : ''),
                onClick: () => onChooseLang('en'),
              }, 'English'))),
          SOURCES.filter((source) => source.kind === 'token').map((source) => {
            const on = (enabled || []).includes(source.id)
            const ready = Boolean(configured[source.id])
            return h('section', { key: source.id, className: 'ase-source' },
              h('div', { className: 'ase-source-head' },
                h('div', { className: 'ase-source-title' },
                  h('strong', null, sourceLabel(source, lang)),
                  h('span', { className: 'ase-pill' + (ready ? ' ase-pill--on' : '') },
                    ready ? T('connected') : T('notConfigured'))),
                h('button', {
                  type: 'button',
                  role: 'switch',
                  'aria-checked': on ? 'true' : 'false',
                  'aria-label': sourceLabel(source, lang),
                  'data-tip': on ? T('srcOn') : T('srcOff'),
                  className: 'ase-switch' + (on ? ' ase-switch--on' : ''),
                  onClick: () => onToggle(source.id),
                }, h('span', { className: 'ase-switch-knob' }))),
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
                : null)
          })))
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
      const title = [stripGlyphs(frame.title), frame.year].filter(Boolean).join(' · ')
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
            stripGlyphs(frame.caption) ? h('p', null, stripGlyphs(frame.caption)) : null,
            (frame.palette && frame.palette.length) ? h(PaletteDots, { colors: frame.palette, size: 'bar' }) : null,
            h('div', { className: 'ase-zoom-actions' },
              frame.link
                ? h('a', { className: 'ase-zoom-link', href: frame.link, target: '_blank', rel: 'noreferrer' }, T('openOriginal') + ' ↗')
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
        aiCount, onAiCount,
        loadMore, loadingMore, canLoadMore, noMore,
        keywordGroups, addGroup, renameGroup, deleteGroup, addTerm, removeTerm, renameTerm,
        restoreKeywords, canRestore,
        enabledSources, onToggleSource,
      } = state
      const [kwOpen, setKwOpen] = useState(false)
      const [srcOpen, setSrcOpen] = useState(false)
      const [managing, setManaging] = useState(false)
      const [termDraft, setTermDraft] = useState({})
      const [addingGroup, setAddingGroup] = useState(null)
      const [labelEdit, setLabelEdit] = useState(null)
      const [termEdit, setTermEdit] = useState(null)
      const [dropping, setDropping] = useState(false)
      const [countOpen, setCountOpen] = useState(false)
      const fileRef = useRef(null)
      const panelRef = useRef(null)
      const triggerRef = useRef(null)
      const srcRef = useRef(null)
      const srcTriggerRef = useRef(null)
      const scrollRef = useRef(null)
      const skipCommitRef = useRef(false)
      const countRef = useRef(null)
      const loading = status === 'loading'

      useEffect(() => {
        if (!countOpen) return undefined
        const onPointerDown = (event) => {
          if (countRef.current && countRef.current.contains(event.target)) return
          setCountOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setCountOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [countOpen])

      useEffect(() => {
        if (!kwOpen) return undefined
        const onPointerDown = (event) => {
          const inPanel = panelRef.current && panelRef.current.contains(event.target)
          const inTrigger = triggerRef.current && triggerRef.current.contains(event.target)
          if (inPanel || inTrigger) return
          setKwOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setKwOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [kwOpen])

      useEffect(() => {
        if (!srcOpen) return undefined
        const onPointerDown = (event) => {
          const inPanel = srcRef.current && srcRef.current.contains(event.target)
          const inTrigger = srcTriggerRef.current && srcTriggerRef.current.contains(event.target)
          if (inPanel || inTrigger) return
          setSrcOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setSrcOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [srcOpen])

      useEffect(() => {
        if (status === 'loading' && scrollRef.current) scrollRef.current.scrollTop = 0
      }, [status])

      const pickFile = (file) => {
        if (!file) return
        readImageFile(file).then((image) => onAttachment(image), () => onImageError())
      }
      const toggleTerm = (term) => setQuery(hasTerm(query, term) ? dropTerm(query, term) : joinTerm(query, term))
      const runSubmit = () => { setKwOpen(false); submit() }
      const commitTerm = (group) => {
        const value = String(termDraft[group.id] || '').trim()
        if (value && !(group.values || []).includes(value)) addTerm(group.id, group.builtin, value)
        setTermDraft({ ...termDraft, [group.id]: '' })
        setAddingGroup(null)
      }

      const panel = h('div', { className: 'ase-kw-panel', ref: panelRef },
        h('div', { className: 'ase-kw-head' },
          h('span', { className: 'ase-kw-hint' }, T('kwHint')),
          h('button', {
            type: 'button',
            className: 'ase-ghost-link',
            onClick: () => { setManaging(!managing); setLabelEdit(null); setTermEdit(null); setAddingGroup(null) },
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
                  className: 'ase-kw-groupdel ase-tip ase-tip--right',
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
                ? (addingGroup === group.id
                  ? h('input', {
                    className: 'ase-kw-input',
                    placeholder: T('kwAdd'),
                    autoFocus: true,
                    value: termDraft[group.id] || '',
                    onChange: (event) => setTermDraft({ ...termDraft, [group.id]: event.target.value }),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') { event.preventDefault(); commitTerm(group) }
                      else if (event.key === 'Escape') {
                        skipCommitRef.current = true
                        setAddingGroup(null)
                        setTermDraft({ ...termDraft, [group.id]: '' })
                      }
                    },
                    onBlur: () => {
                      if (skipCommitRef.current) { skipCommitRef.current = false; return }
                      commitTerm(group)
                    },
                  })
                  : h('button', {
                    type: 'button',
                    className: 'ase-kw-add',
                    'aria-label': T('kwAdd'),
                    onClick: () => { skipCommitRef.current = false; setAddingGroup(group.id) },
                  }, h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none', 'aria-hidden': true },
                    h('path', { d: 'M6 1.7v8.6M1.7 6h8.6', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }))))
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

      const aiAvailable = enabledSources.includes('chrome')
        || (enabledSources.includes('framethrower') && Boolean(readToken()))
      const aiToggle = aiAvailable
        ? h('div', { className: 'ase-ai-toggle' },
          h('span', { className: 'ase-ai-label' }, T('aiSearch')),
          h('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': aiOn ? 'true' : 'false',
            'aria-label': T('aiSearch'),
            'data-tip': T('aiSearch'),
            className: 'ase-switch' + (aiOn ? ' ase-switch--on' : ''),
            onClick: () => { setCountOpen(false); onToggleAi(!aiOn) },
          }, h('span', { className: 'ase-switch-knob' })),
          aiOn
            ? h('div', { className: 'ase-ai-count', ref: countRef },
              h('button', {
                type: 'button',
                className: 'ase-ai-count-btn',
                'aria-haspopup': 'listbox',
                'aria-expanded': countOpen ? 'true' : 'false',
                'aria-label': T('aiDirections'),
                onClick: () => setCountOpen(!countOpen),
              }, 'x' + aiCount,
              h('svg', { className: 'ase-ai-count-chevron', width: 8, height: 8, viewBox: '0 0 10 10', fill: 'none', 'aria-hidden': true },
                h('path', { d: 'M1.7 3.4 5 6.7l3.3-3.3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
              countOpen
                ? h('div', { className: 'ase-ai-count-menu', role: 'listbox', 'aria-label': T('aiDirections') },
                  [1, 2, 3].map((option) => h('button', {
                    key: option,
                    type: 'button',
                    role: 'option',
                    'aria-selected': option === aiCount ? 'true' : 'false',
                    className: 'ase-ai-count-option' + (option === aiCount ? ' is-on' : ''),
                    onClick: () => { onAiCount(option); setCountOpen(false) },
                  }, 'x' + option)))
                : null)
            : null)
        : null

      const compose = h('div', {
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
              // Enter always submits, even when the text has not changed; Shift+Enter makes a new line
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return
              event.preventDefault()
              runSubmit()
            },
          }),
          h('div', { className: 'ase-ask-tools' + (aiToggle ? '' : ' ase-ask-tools--no-ai') },
            kwOpen ? panel : null,
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
              className: 'ase-iconbtn ase-addimg ase-tip ase-tip--right',
              'data-tip': T('pickImageTip'),
              'aria-label': T('pickImage'),
              onClick: () => { if (fileRef.current) fileRef.current.click() },
            }, h('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
              h('path', { d: 'M8 3v10M3 8h10', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }))),
            h('button', {
              type: 'button',
              ref: triggerRef,
              className: 'ase-kw-trigger' + (kwOpen ? ' is-open' : ''),
              'aria-expanded': kwOpen ? 'true' : 'false',
              onClick: () => { setSrcOpen(false); setKwOpen(!kwOpen) },
            },
            h('span', { className: 'ase-kw-trigger-label' }, T('lensToggle')),
            h('svg', { className: 'ase-kw-chevron', width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', 'aria-hidden': true },
              h('path', { d: 'M1.7 3.4 5 6.7l3.3-3.3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
            h('div', { className: 'ase-src-wrap' },
              h('button', {
                type: 'button',
                ref: srcTriggerRef,
                className: 'ase-kw-trigger ase-src-trigger' + (srcOpen ? ' is-open' : ''),
                'aria-expanded': srcOpen ? 'true' : 'false',
                'aria-haspopup': 'true',
                onClick: () => { setKwOpen(false); setSrcOpen(!srcOpen) },
              },
              h('svg', { className: 'ase-src-icon', width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
                h('path', { d: 'M8 2.3 13.9 5.4 8 8.5 2.1 5.4 8 2.3Z', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' }),
                h('path', { d: 'M2.6 8.6 8 11.3 13.4 8.6', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
              h('span', { className: 'ase-kw-trigger-label' }, T('sources')),
              h('svg', { className: 'ase-kw-chevron', width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', 'aria-hidden': true },
                h('path', { d: 'M1.7 3.4 5 6.7l3.3-3.3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
              srcOpen
                ? h('div', { className: 'ase-src-panel', ref: srcRef, role: 'group', 'aria-label': T('sources') },
                  h('div', { className: 'ase-src-head' },
                    h('span', { className: 'ase-src-title' }, T('sources')),
                    h('span', { className: 'ase-src-hint' }, T('sourcesHint'))),
                  SOURCES.map((source) => {
                    const on = enabledSources.includes(source.id)
                    const ready = source.kind === 'token' ? Boolean(readToken()) : true
                    return h('button', {
                      key: source.id,
                      type: 'button',
                      role: 'switch',
                      'aria-checked': on ? 'true' : 'false',
                      className: 'ase-src-row' + (on ? ' is-on' : ''),
                      onClick: () => onToggleSource(source.id),
                    },
                      h('span', { className: 'ase-src-check' }, on ? '✓' : ''),
                      h('span', { className: 'ase-src-name' }, sourceLabel(source, lang)),
                      h('span', { className: 'ase-src-state' }, ready ? (source.kind === 'token' ? T('connected') : T('noSetup')) : T('notConfigured')))
                  }))
                : null),
            aiToggle,
            h('button', {
              type: 'button',
              className: 'ase-send ase-tip',
              'data-tip': T('search'),
              'aria-label': T('search'),
              disabled: loading || (!String(query || '').trim() && !attachment),
              onClick: runSubmit,
            }, h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
              h('circle', { cx: 7, cy: 7, r: 4.6, stroke: 'currentColor', strokeWidth: 1.7 }),
              h('path', { d: 'M10.4 10.4 14 14', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' })))))
      return h('section', { className: 'ase-discover' },
        h('div', { className: 'ase-scroll', ref: scrollRef },
        !hasToken && enabledSources.includes('framethrower') && !enabledSources.includes('chrome')
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
            ? h('div', { className: 'ase-understood' },
              h('span', { className: 'ase-understood-key' }, T('queryTerms')),
              h('div', { className: 'ase-understood-lines' },
                String(understood).split('\n').filter(Boolean).map((line, index) => h('p', {
                  key: index,
                  className: 'ase-understood-line',
                }, line))))
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
                onSimilar: frame.src === 'chrome' ? null : similar,
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
            : null)),
        h('div', { className: 'ase-dock' }, compose))
    }

    function Page({ translator, lang, onChooseLang }) {
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
      const lastSearchText = useRef('')
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
      const [aiCount, setAiCount] = useState(() => {
        try {
          const saved = Number(window.localStorage.getItem(AI_COUNT_KEY))
          return saved === 1 || saved === 2 || saved === 3 ? saved : 3
        } catch { return 3 }
      })
      const [modalFrame, setModalFrame] = useState(null)
      const [suggests, setSuggests] = useState(null)
      const [presets, setPresets] = useState([])
      const [savingPreset, setSavingPreset] = useState(false)
      const [suggestBusy, setSuggestBusy] = useState(null)
      const [toast, setToast] = useState('')
      const [settingsOpen, setSettingsOpen] = useState(false)
      const [communityOpen, setCommunityOpen] = useState(false)
      const [drafts, setDrafts] = useState({})
      const [enabledSources, setEnabledSources] = useState(loadSources)
      const scroller = useRef(null)

      const toggleSource = useCallback((id) => {
        setEnabledSources((list) => {
          const next = list.includes(id)
            ? list.filter((item) => item !== id)
            : SOURCE_IDS.filter((sourceId) => list.includes(sourceId) || sourceId === id)
          saveSources(next)
          return next
        })
      }, [])

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
        // pressing Enter again on the same words must start a fresh search,
        // so let the interpret step re-roll instead of reading its cache
        const repeated = lastSearchText.current === text
        lastSearchText.current = text
        setStatus('loading')
        setHint('')
        setWarnings([])
        setResults([])
        setUnderstood('')
        setAiNote(null)
        setFailure(null)
        setLastKind('text')
        setPage(0)
        setNoMore(false)
        setTotal(0)

        // a source that is on but not configured (no token) is skipped, not fatal
        const chosen = enabledSources.filter((id) => id === 'chrome' || Boolean(readToken()))
        if (!chosen.length) {
          const missingToken = enabledSources.includes('framethrower') && !readToken()
          setStatus('error')
          setFailure({ source: 'unconfigured', hint: missingToken ? t('noTokenHint') : t('noSources') })
          return
        }

        const useAi = aiOn || Boolean(mode && mode.forceAi)
        let aiParams = null
        let aiNote = null
        if (useAi) {
          try {
            const interpreted = await api('/anistyle/interpret', { text, count: aiCount, refresh: repeated })
            aiParams = interpreted && interpreted.source === 'model' ? interpreted.params : null
            if (!aiParams) {
              aiNote = { reason: (interpreted && interpreted.reason) || 'no-model', detail: (interpreted && interpreted.detail) || '' }
            }
          } catch (error) {
            aiNote = { reason: 'unreachable', detail: String((error && error.message) || '').slice(0, 120) }
          }
        }
        const wanted = aiCount === 1 || aiCount === 2 ? aiCount : 3
        const modelQueries = aiParams && Array.isArray(aiParams.queries)
          ? aiParams.queries.filter((item) => typeof item === 'string' && item.trim())
          : []
        if (!modelQueries.length && aiParams && aiParams.query) modelQueries.push(aiParams.query)
        const modelWeb = aiParams && Array.isArray(aiParams.web)
          ? aiParams.web.filter((item) => typeof item === 'string' && item.trim()).slice(0, wanted)
          : []

        const runFrames = async () => {
          const queryText = modelQueries[0] || (aiParams && aiParams.query) || text
          const modelStyle = (aiParams && aiParams.style) || ''
          const modelTitle = (aiParams && aiParams.title) || ''
          const modelGenre = (aiParams && aiParams.genre) || ''
          const modelPerTitle = (aiParams && aiParams.perTitle) || 3
          if (/[\u3400-\u9fff]/.test(queryText)) {
            // the library matches English frame descriptions; a Chinese query only
            // returns its default page, so report "nothing found" instead of showing it
            return {
              id: 'framethrower',
              ok: false,
              needsAi: true,
              frames: [],
              understood: t('srcFramethrower') + ' · ' + text,
              aiNote,
            }
          }
          const loose = Boolean(mode && mode.loose)
          const queries = loose
            ? [queryText]
            : (modelQueries.length ? modelQueries.slice(0, wanted) : [queryText])
          // split one page between the readings, then interleave them below
          const perQuery = queries.length > 1 ? Math.max(6, Math.ceil(PAGE_SIZE / queries.length)) : PAGE_SIZE
          const shared = { limit: perQuery, offset: 0, perTitle: loose ? 3 : modelPerTitle }
          if (!loose && modelTitle) shared.title = modelTitle
          if (!loose && modelGenre) shared.genre = modelGenre
          const style = loose ? '' : styleValue === undefined ? modelStyle : styleValue
          if (style) shared.style = style
          const params = { text, queries, perQuery, query: queries[0], perTitle: shared.perTitle }
          if (shared.title) params.title = shared.title
          if (shared.genre) params.genre = shared.genre
          if (shared.style) params.style = shared.style
          const responses = await Promise.all(queries.map((item) => api('/anistyle/frames', { ...shared, query: item })
            .catch((error) => ({ source: 'client', hint: String((error && error.message) || error) }))))
          const usable = responses.filter((item) => item && item.source === 'framethrower')
          if (!usable.length) {
            const first = responses[0] || {}
            return {
              id: 'framethrower',
              ok: false,
              frames: [],
              failure: { source: first.source, status: first.status, hint: first.hint },
              params,
              aiNote,
            }
          }
          const frames = mergeGroups(usable.map((item) => item.frames || []))
          const sum = usable.reduce((total, item) => total + (Number(item.total) || 0), 0)
          const warningList = []
          for (const item of usable) {
            for (const warning of item.warnings || []) {
              if (!warningList.includes(warning)) warningList.push(warning)
            }
          }
          return {
            id: 'framethrower',
            ok: true,
            frames,
            total: sum,
            warnings: warningList,
            params,
            aiNote,
            understood: t('srcFramethrower') + ' · ' + queries.join(' · '),
          }
        }

        const runWeb = async () => {
          // the model supplies image-search phrases; without them the brief goes as-is
          const webQueries = modelWeb.length ? modelWeb.slice(0, wanted) : [text]
          const perQuery = webQueries.length > 1 ? Math.max(8, Math.ceil(PAGE_SIZE / webQueries.length)) : PAGE_SIZE
          const responses = await Promise.all(webQueries.map((query) => api('/anistyle/web', { query, limit: perQuery, offset: 0, lang })
            .catch((error) => ({ source: 'client', hint: String((error && error.message) || error) }))))
          const usable = responses.filter((item) => item && item.source === 'chrome')
          if (!usable.length) {
            const first = responses.find(Boolean) || {}
            return {
              id: 'chrome',
              ok: false,
              frames: [],
              failure: { source: first.source || 'unreachable', status: first.status, hint: first.hint },
              aiNote,
            }
          }
          const warnings = []
          for (const item of usable) {
            for (const warning of item.warnings || []) {
              const line = warning === 'web-empty' ? t('failWebEmpty') : warning
              if (!warnings.includes(line)) warnings.push(line)
            }
          }
          if (responses.some((item) => !item || item.source !== 'chrome')) {
            warnings.push(t('srcWeb') + ' · ' + t('failWebPartial'))
          }
          return {
            id: 'chrome',
            ok: true,
            frames: mergeGroups(usable.map((item) => item.frames || [])),
            total: 0,
            warnings,
            params: { webQueries, webLimit: perQuery },
            aiNote,
            understood: t('srcWeb') + ' · ' + webQueries.join(' · '),
          }
        }

        try {
          const tasks = []
          if (chosen.includes('framethrower')) tasks.push(runFrames())
          if (chosen.includes('chrome')) tasks.push(runWeb())
          const outcomes = await Promise.all(tasks)
          const ok = outcomes.filter((outcome) => outcome.ok)
          const failed = outcomes.filter((outcome) => !outcome.ok)

          const warningList = []
          for (const outcome of ok) {
            for (const warning of outcome.warnings || []) {
              if (!warningList.includes(warning)) warningList.push(warning)
            }
          }
          for (const outcome of failed) {
            const line = sourceFailureLine(outcome, t)
            if (line && !warningList.includes(line)) warningList.push(line)
          }
          if (enabledSources.includes('framethrower') && !readToken()) {
            warningList.push(t('srcFramethrower') + ' · ' + t('srcSkipped'))
          }

          if (ok.length) {
            const params = { text, sources: chosen.slice(), query: text }
            for (const outcome of ok) {
              if (outcome.params) Object.assign(params, outcome.params)
            }
            params.sources = chosen.slice()
            params.query = Array.isArray(params.queries) && params.queries.length ? params.queries[0] : text
            lastSearch.current = params
            setResults(mergeGroups(ok.map((outcome) => outcome.frames)))
            // the web source has no total, so the count is only meaningful for FrameThrower
            const total = chosen.includes('chrome')
              ? 0
              : ok.reduce((sum, outcome) => sum + (Number(outcome.total) || 0), 0)
            setTotal(total)
            setWarnings(warningList)
            setUnderstood(ok.map((outcome) => outcome.understood).filter(Boolean).join('\n'))
            const firstNote = ok.map((outcome) => outcome.aiNote).find(Boolean) || aiNote
            if (firstNote) setAiNote(firstNote)
            setNoMore(ok.every((outcome) => !(outcome.frames && outcome.frames.length)))
            setStatus('ok')
            return
          }

          const needsAi = failed.some((outcome) => outcome.needsAi)
          const primary = failed.find((outcome) => !outcome.needsAi) || failed[0] || {}
          setResults([])
          setUnderstood(failed.map((outcome) => outcome.understood).filter(Boolean).join('\n'))
          setFailure(primary.failure || null)
          const firstNote = failed.map((outcome) => outcome.aiNote).find(Boolean) || aiNote
          if (firstNote) setAiNote(firstNote)
          setStatus(!primary.failure && needsAi ? 'needs-ai' : 'error')
        } catch (error) {
          setStatus('error')
          setFailure({ source: 'client', hint: String(error.message || error) })
          setResults([])
        }
      }, [query, aiOn, aiCount, enabledSources, lang, t])

      const submit = useCallback((override) => {
        const image = (override && override.image) || (attachment && attachment.dataUrl)
        if (image) {
          // visual search is a FrameThrower feature; the web source has no equivalent
          if (!enabledSources.includes('framethrower') || !readToken()) {
            setStatus('error')
            setFailure({ source: 'unconfigured', hint: t('imageNeedsFrames') })
            return
          }
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
      }, [runSearch, query, attachment, enabledSources, t])

      // Next-page requests for every source that took part in the last search.
      // FrameThrower pages by query batch; the web source pages by result offset.
      const pageRequests = useCallback((base, nextPage) => {
        const sources = Array.isArray(base.sources) && base.sources.length ? base.sources : ['framethrower']
        const batches = Array.isArray(base.queries) && base.queries.length
          ? base.queries.slice(0, 3)
          : (base.query ? [base.query] : [])
        const requests = []
        if (sources.includes('framethrower') && batches.length) {
          const perQuery = base.perQuery || Math.ceil(PAGE_SIZE / batches.length)
          if (nextPage * perQuery <= 200) {
            const shared = { limit: perQuery, offset: nextPage * perQuery, perTitle: base.perTitle || 3 }
            if (base.title) shared.title = base.title
            if (base.genre) shared.genre = base.genre
            if (base.style) shared.style = base.style
            for (const item of batches) {
              requests.push(api('/anistyle/frames', { ...shared, query: item })
                .then((data) => (data && data.source === 'framethrower' ? data : null))
                .catch(() => null))
            }
          }
        }
        if (sources.includes('chrome')) {
          const limit = base.webLimit || PAGE_SIZE
          const list = Array.isArray(base.webQueries) && base.webQueries.length
            ? base.webQueries.slice(0, 3)
            : [base.webQuery || base.text || base.query].filter(Boolean)
          if (list.length && nextPage * limit <= 200) {
            for (const query of list) {
              requests.push(api('/anistyle/web', { query, limit, offset: nextPage * limit, lang })
                .then((data) => (data && data.source === 'chrome' ? data : null))
                .catch(() => null))
            }
          }
        }
        return requests
      }, [lang])

      const loadMore = useCallback(async () => {
        if (loadingMore || !results.length || noMore) return
        // a reload restores the grid, so rebuild the request from what is on screen
        const base = lastSearch.current || (query.trim()
          ? { text: query.trim(), query: query.trim(), sources: enabledSources.slice() }
          : null)
        if (!base) {
          setToast(t('resultsEmptyBody'))
          return
        }
        const nextPage = page + 1
        const requests = pageRequests(base, nextPage)
        if (!requests.length) { setNoMore(true); return }
        setLoadingMore(true)
        try {
          const settled = (await Promise.all(requests)).filter(Boolean)
          const seen = new Set(results.map(frameKey))
          const fresh = mergeGroups(settled.map((item) => item.frames || []))
            .filter((frame) => !seen.has(frameKey(frame)))
          if (!fresh.length) {
            setNoMore(true)
            if (!settled.length) setToast(t('resultsEmpty'))
          } else {
            setResults(results.concat(fresh))
            setPage(nextPage)
            const sources = Array.isArray(base.sources) && base.sources.length ? base.sources : ['framethrower']
            const sum = settled
              .filter((item) => item.source === 'framethrower')
              .reduce((total, item) => total + (Number(item.total) || 0), 0)
            if (sources.includes('chrome')) setTotal(0)
            else if (sum > 0) setTotal(sum)
          }
        } catch (error) {
          setToast(String(error.message || error))
        } finally {
          setLoadingMore(false)
        }
      }, [loadingMore, noMore, results, page, query, enabledSources, pageRequests, t])

      const more = useCallback(async () => {
        if (!results.length || status !== 'ok') return
        const base = lastSearch.current || { query: query.trim(), sources: enabledSources.slice() }
        const nextPage = page + 1
        const requests = pageRequests(base, nextPage)
        if (!requests.length) {
          setToast(t('noMore'))
          return
        }
        setStatus('loading')
        try {
          const settled = (await Promise.all(requests)).filter(Boolean)
          const frames = mergeGroups(settled.map((item) => item.frames || []))
          // 换一批 replaces the current grid instead of stacking another page onto it
          setResults(frames)
          setStatus('ok')
          if (!frames.length) {
            setPage(0)
            setToast(t('resultsEmpty'))
          } else {
            setPage(nextPage)
          }
        } catch (error) {
          setStatus('ok')
          setToast(String(error.message || error))
        }
      }, [results, status, query, page, enabledSources, pageRequests, t])

      const similar = useCallback((frame) => {
        if (!frame || expanding) return
        // visual similarity is a FrameThrower endpoint; web tiles have no equivalent
        if (!frame.id || frame.src === 'chrome') { setToast(t('noSimilar')); return }
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
        const picks = (anchors || []).filter((frame) => frame && frame.id && frame.src !== 'chrome')
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
        const pool = (activeBoardData ? activeBoardData.items : []).filter((frame) => frame && frame.id && frame.src !== 'chrome')
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
        rememberKeywords({ ...kwStore, groups: kwStore.groups.concat({ id, name: t('kwAddGroup'), terms: [] }) })
        return id
      }, [kwStore, rememberKeywords, t])

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
        if (builtin) {
          const own = (kwStore.extra && kwStore.extra[groupId]) || []
          rememberKeywords({
            ...kwStore,
            hidden: (kwStore.hidden || []).filter((item) => item !== value),
            extra: { ...(kwStore.extra || {}), [groupId]: Array.from(new Set(own.concat(value))) },
          })
          return
        }
        const target = kwStore.groups.find((group) => group.id === groupId)
        if (!target) return
        rememberKeywords({
          ...kwStore,
          groups: kwStore.groups.map((group) => (group.id === target.id
            ? { ...group, terms: Array.from(new Set(group.terms.concat(value))) }
            : group)),
        })
      }, [kwStore, rememberKeywords])

      const removeTerm = useCallback((groupId, builtin, term) => {
        if (builtin) {
          const own = (kwStore.extra && kwStore.extra[groupId]) || []
          if (own.includes(term)) {
            rememberKeywords({
              ...kwStore,
              extra: { ...kwStore.extra, [groupId]: own.filter((item) => item !== term) },
            })
            return
          }
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
        // built-in term: drop the original, keep the edited wording in the same group
        removeTerm(groupId, true, term)
        addTerm(groupId, true, value)
      }, [kwStore, rememberKeywords, removeTerm, addTerm])

      const restoreKeywords = useCallback(() => {
        rememberKeywords({ ...kwStore, hidden: [], hiddenGroups: [], labels: {}, extra: {} })
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

      const addPresetBoard = useCallback((preset) => {
        if (!preset || !preset.name || !Array.isArray(preset.items)) return
        if (boards.some((board) => board.name === preset.name)) return
        const board = {
          ...preset,
          id: newId(),
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setBoards((list) => [board, ...list])
        setToast(t('added') + ' 《' + preset.name + '》')
      }, [boards, t])

      const savePresets = useCallback(() => {
        if (savingPreset) return
        setSavingPreset(true)
        api('/anistyle/presets', { boards })
          .then((data) => {
            const count = data?.saved ?? boards.length
            if (data?.pushed) setToast(t('presetPushed'))
            else if (data?.pushError) setToast(t('presetPushFailed') + ' · ' + data.pushError)
            else setToast(t('presetSaved') + ' ' + count)
          })
          .catch((error) => setToast(String(error.message || error)))
          .finally(() => setSavingPreset(false))
      }, [boards, savingPreset, t])

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
          lines.push((index + 1) + '. **' + (stripGlyphs(frame.title) || 'frame') + '**' + (frame.year ? ' (' + frame.year + ')' : ''))
          if (stripGlyphs(frame.caption)) lines.push('   ' + stripGlyphs(frame.caption))
          if (frame.tags && frame.tags.length) lines.push('   ' + frame.tags.join(' · '))
          if (frame.palette && frame.palette.length) lines.push('   ' + frame.palette.join(' '))
          if (frame.link) lines.push('   [' + (frame.src === 'chrome' ? 'web' : 'FrameThrower') + '](' + frame.link + ')')
          lines.push('   ![frame](' + (frame.original || frame.image || frame.thumb) + ')')
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
        || Object.keys(kwStore.labels || {}).length
        || Object.keys(kwStore.extra || {}).length,
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
                aiCount,
                onAiCount: (next) => {
                  if (next !== 1 && next !== 2 && next !== 3) return
                  setAiCount(next)
                  try { window.localStorage.setItem(AI_COUNT_KEY, String(next)) } catch {}
                },
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
                enabledSources, onToggleSource: toggleSource,
                hasToken, openToken: () => {
                  setDrafts(Object.fromEntries(SOURCES.map((source) => [source.id, readKey(source.key)])))
                  setSettingsOpen(true)
                },
                keywordGroups, addGroup, renameGroup, deleteGroup, addTerm, removeTerm, renameTerm,
                restoreKeywords, canRestore: canRestoreKeywords,
              },
            })
            : h('div', { className: 'ase-scroll ase-boards' },
              activeBoardData
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
                onOpenPresets: () => setCommunityOpen(true),
                onSavePreset: savePresets,
                savingPreset,
                onOpen: (id) => setActiveBoard(id),
                onDelete: deleteBoard,
              })),
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
            configured: Object.fromEntries(SOURCES.map((source) => [source.id, Boolean(source.key && readKey(source.key))])),
            enabled: enabledSources,
            onToggle: toggleSource,
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
            lang,
            onChooseLang,
          })
          : null,
        communityOpen
          ? h(CommunityBoards, {
            presets,
            existingNames: new Set(boards.map((board) => board.name)),
            onAdd: addPresetBoard,
            onClose: () => setCommunityOpen(false),
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

    function sourceFailureLine(outcome, T) {
      if (!outcome) return ''
      if (outcome.needsAi) return T('srcFramethrower') + ' · ' + T('aiNeeded')
      const failure = outcome.failure || {}
      if (outcome.id === 'chrome') {
        if (failure.source === 'unreachable') return T('srcWeb') + ' · ' + T('failWebNetwork')
        if (failure.source === 'rate-limited' || failure.status === 429) return T('srcWeb') + ' · ' + T('failTooMany')
        if (failure.status) return T('srcWeb') + ' · ' + T('failStatus') + ' ' + failure.status
        return T('srcWeb') + ' · ' + (failure.hint || T('failWebEmpty'))
      }
      return T('srcFramethrower') + ' · ' + failureMessage(failure, T)
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

    function createTranslator(ctx, lang) {
      let translate = null
      try { translate = ctx.locale.bind(NS) } catch { translate = null }
      const dict = DICT[lang] || null
      return (key) => {
        if (dict && dict[key] !== undefined) return dict[key]
        if (!translate) return DICT.zh[key] || key
        try {
          const value = translate(key)
          return typeof value === 'string' && value && value !== key ? value : ((dict || DICT.zh)[key] || key)
        } catch {
          return (dict || DICT.zh)[key] || key
        }
      }
    }

    function Content(props) {
      const ctx = props.__ctx
      const [version, setVersion] = useState(0)
      useEffect(() => ctx.locale.subscribe(() => setVersion((value) => value + 1)), [ctx])
      const lang = useMemo(() => {
        try {
          const active = String(ctx.locale.getLocale().active || '')
          return /^en/i.test(active) ? 'en' : 'zh'
        } catch { return 'zh' }
      }, [ctx, version])
      const t = useMemo(() => createTranslator(ctx, lang), [ctx, version, lang])
      const chooseLang = useCallback((next) => {
        if (next !== 'zh' && next !== 'en') return
        try {
          const snapshot = ctx.locale.getLocale()
          const definitions = Array.isArray(snapshot && snapshot.locales) ? snapshot.locales : []
          const exact = definitions.find((definition) => definition.id === next)
          const prefixed = definitions.find((definition) => String(definition.id).toLowerCase().indexOf(next + '-') === 0)
          ctx.locale.setLocale(exact ? exact.id : (prefixed ? prefixed.id : next))
        } catch {}
      }, [ctx])
      return h(I18n.Provider, { value: t }, h(Page, { translator: t, lang, onChooseLang: chooseLang }))
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
.ase-root{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.ase-wrap{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;width:100%;max-width:1240px;margin:0 auto;padding:24px 90px 0;box-sizing:border-box}
.ase-discover{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}
.ase-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:12px}
.ase-dock{position:relative;z-index:6;flex:0 0 auto;padding:0 0 18px;background:var(--dsw-alias-bg-base)}
.ase-discover > .ase-scroll{padding:0 16px 24px}
.ase-boards{padding-top:28px}
.ase-topbar{position:relative;flex:0 0 auto;display:flex;align-items:center;gap:20px;margin-bottom:16px}
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
.ase-ask{position:relative;margin:0;border:1px solid var(--dsw-alias-border-l2);border-radius:15px;background:var(--dsw-alias-bg-layer-1);padding:14px 14px 10px;transition:border-color .16s,box-shadow .16s}
.ase-ask:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ase-textarea{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:15px;line-height:1.65;resize:none}
.ase-textarea::placeholder,.ase-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}
.ase-ask--open{box-shadow:0 20px 44px -30px rgba(0,0,0,.6)}
.ase-ask-tools{position:relative;display:flex;align-items:center;gap:10px;margin-top:4px}
.ase-ask-tools--no-ai .ase-send{margin-left:auto}
.ase-ai-toggle{margin-left:auto;display:flex;align-items:center;gap:6px}
.ase-ai-label{font-size:10.5px;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}
.ase-ai-count{position:relative;display:inline-flex;align-items:center}
.ase-ai-count-btn{display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;cursor:pointer;transition:border-color .14s,color .14s,background .14s}
.ase-ai-count-btn:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.ase-ai-count-chevron{opacity:.65;transition:transform .16s ease}
.ase-ai-count-btn[aria-expanded="true"] .ase-ai-count-chevron{transform:rotate(180deg)}
.ase-ai-count-menu{position:absolute;right:0;bottom:calc(100% + 6px);z-index:25;min-width:64px;padding:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-overlay);box-shadow:0 16px 36px -20px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:1px}
.ase-ai-count-option{border:0;background:none;text-align:left;padding:5px 8px;border-radius:6px;font:inherit;font-size:11px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.ase-ai-count-option:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ase-ai-count-option.is-on{color:var(--dsw-alias-brand-primary)}
.ase-modal-x{position:absolute;top:14px;right:14px;width:26px;height:26px;border-radius:50%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:16px;line-height:1;cursor:pointer}
.ase-modal-x:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ase-send{margin-left:0;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border-radius:50%;border:0;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);cursor:pointer;transition:opacity .14s,transform .14s}
.ase-send:hover:not(:disabled){transform:translateY(-1px)}
.ase-send:disabled{opacity:.35;cursor:default}
.ase-kw-trigger{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:12.5px;line-height:1;color:var(--dsw-alias-label-secondary);border:0;background:none;padding:6px 7px;border-radius:7px;cursor:pointer;transition:color .14s,background .14s}
.ase-kw-trigger:hover,.ase-kw-trigger.is-open{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.ase-kw-trigger svg{display:block;flex:0 0 auto}
.ase-kw-trigger-label{white-space:nowrap}
.ase-kw-chevron{opacity:.7;transition:transform .16s ease}
.ase-kw-trigger.is-open .ase-kw-chevron{transform:rotate(180deg)}
.ase-src-wrap{position:relative;display:flex;align-items:center}
.ase-src-icon{display:block;flex:0 0 auto;opacity:.8}
.ase-src-panel{position:absolute;left:0;bottom:calc(100% + 8px);z-index:22;width:min(300px,calc(100vw - 60px));padding:10px 11px 8px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 60px -28px rgba(0,0,0,.65);box-sizing:border-box}
.ase-src-head{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
.ase-src-title{font-size:11.5px;font-weight:600}
.ase-src-hint{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.ase-src-row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 6px;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer;transition:background .14s}
.ase-src-row:hover{background:var(--dsw-alias-bg-layer-1)}
.ase-src-check{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;font-size:10px;line-height:1;color:var(--dsw-alias-bg-base)}
.ase-src-row.is-on .ase-src-check{background:var(--dsw-alias-brand-primary);border-color:transparent}
.ase-src-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ase-src-state{flex:0 0 auto;font-size:10px;color:var(--dsw-alias-label-secondary)}
.ase-kw-panel{position:absolute;left:44px;bottom:calc(100% + 8px);z-index:20;width:min(620px,calc(100% - 44px));max-height:min(52vh,440px);overflow-y:auto;overscroll-behavior:contain;margin:0;padding:12px 13px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 60px -28px rgba(0,0,0,.65);box-sizing:border-box}
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
.ase-kw-input:focus{border-color:var(--dsw-alias-brand-primary)}
.ase-kw-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.8}
.ase-kw-add{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:1px dashed var(--dsw-alias-border-l2);border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:border-color .14s,color .14s,background .14s}
.ase-kw-add:hover{border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.ase-kw-add svg{display:block}
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
.ase-section-head .ase-h1{margin:0}
.ase-dots{display:inline-flex;border-radius:3px;overflow:hidden}
.ase-dots i{display:block;width:6px;height:11px}
.ase-dots--bar{display:flex;width:100%;height:5px;border-radius:0;margin-top:8px}
.ase-dots--bar i{flex:1;height:100%;width:auto}
.ase-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.ase-tags span{font-size:9.5px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px;white-space:nowrap}
.ase-results{margin:2px 0 0}
.ase-results-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.ase-results-count{margin-left:8px;font:500 11px/1 ui-monospace,Menlo,monospace;color:var(--dsw-alias-label-secondary)}
.ase-results-actions{display:flex;gap:8px}
.ase-understood-key{margin-right:6px;opacity:.65}
.ase-fail-query{margin:0 0 6px;font:400 11px/1.5 ui-monospace,Menlo,monospace;color:var(--dsw-alias-label-secondary)}
.ase-understood{display:flex;align-items:flex-start;gap:6px;margin:-6px 0 12px;font:400 11px/1.5 ui-monospace,Menlo,monospace;color:var(--dsw-alias-label-secondary)}
.ase-understood-key{flex:0 0 auto;margin-right:0;white-space:nowrap;opacity:.65}
.ase-understood-lines{display:flex;flex-direction:column;gap:1px;min-width:0}
.ase-understood-line{margin:0;line-height:1.7;word-break:break-word}
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
.ase-tile-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px}
.ase-badge{flex:0 0 auto;font:500 9.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 5px}
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
.ase-source-title{display:flex;align-items:center;gap:8px;min-width:0}
.ase-lang-opts{display:flex;gap:8px}
.ase-source-docs{display:inline-block;margin-top:8px;font-size:11px;color:var(--dsw-alias-label-secondary);text-decoration:underline;text-underline-offset:2px}
.ase-spin{animation:ase-spin .9s linear infinite}
@keyframes ase-spin{to{transform:rotate(360deg)}}
.ase-iconbtn:disabled{opacity:.5;cursor:default}
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
.ase-community{width:min(640px,100%)}
.ase-community .ase-modal-head{align-items:flex-start;padding-right:26px}
.ase-community-back{margin:0 0 2px;padding:0;font-size:11.5px}
.ase-community-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:2px}
.ase-community-card{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.ase-community-shot{position:relative;display:block;width:100%;aspect-ratio:16/9;padding:0;border:0;background:var(--dsw-alias-bg-layer-2);cursor:pointer;overflow:hidden}
.ase-community-shot img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .22s ease}
.ase-community-shot:hover img{transform:scale(1.035)}
.ase-community-badge{position:absolute;left:8px;bottom:8px;padding:2px 7px;border-radius:999px;background:rgba(12,12,16,.62);color:#fff;font-size:10.5px;line-height:1.4;backdrop-filter:blur(4px)}
.ase-community-foot{display:flex;align-items:center;gap:8px;padding:7px 8px}
.ase-community-name{flex:1;min-width:0;border:0;background:none;padding:0;font:inherit;font-size:12px;font-weight:600;color:inherit;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.ase-community-name:hover{color:var(--dsw-alias-brand-primary)}
.ase-community-foot .ase-btn{flex:0 0 auto;padding:4px 9px;font-size:11px;border-radius:7px}
.ase-community-detail{display:flex;flex-direction:column;gap:10px}
.ase-community-actions{display:flex;justify-content:flex-end}
.ase-community-frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-height:52vh;overflow-y:auto}
.ase-community-frame{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);aspect-ratio:16/9}
.ase-community-frame img{width:100%;height:100%;object-fit:cover;display:block}
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
.ase-tip--right::after{right:auto;left:0}
.ase-tip--top::after{top:auto;bottom:calc(100% + 6px);right:auto;left:50%;transform:translate(-50%,2px)}
.ase-tip--top:hover::after{transform:translate(-50%,0)}
.ase-ask-tools .ase-tip::after{top:auto;bottom:calc(100% + 6px)}
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
