# Changelog

## v1.6.1 — 2026-11-09

The guide and changelog now ship with the npm package.

- **`docs/*.md` and `CHANGELOG.md` are in the tarball.** 1.6.0 shipped the README, whose links point at `docs/GUIDE.md` and `CHANGELOG.md` — both were missing from the package, so those links 404'd for anyone installing from npm. They now travel with the package.
- Nothing else changes; the plugin code is byte-identical to 1.6.0.

## v1.6.0 — 2026-11-09

The plugin is on npm; updates are now Harness's Plugins page.

- **Published to npm.** `dsh-reference-frames` installs from the Plugins page, which saves it as an exact version and then lists newer releases with an **Update** button. The clone-and-symlink recipe becomes the development path instead of the only path.
- **The in-plugin updater is gone.** The `git fetch` check, the round pill left of the tabs, `GET` / `POST /anistyle/update`, `POST /anistyle/restart` and the desktop relaunch helper are removed. The gear menu ends with the version this copy came from, read from the new `GET /anistyle/version`, and nothing in the panel contacts GitHub.
- **Saved boards moved out of the package.** They live in `~/.dsh/reference-frames/moodboards.json`, seeded on first run from the boards the package ships in `presets/moodboards.json`, so a plugin update no longer overwrites them. The "Sync to GitHub" icon appears only in a git checkout — an npm install has no repo to push to, and saving just writes the local file there (`GET /anistyle/presets` reports `checkout`).
- **Release automation.** Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`: it checks the tag against `package.json`, publishes with npm trusted publishing plus provenance, and opens a GitHub release titled `vX.Y.Z` whose notes are that CHANGELOG section.

## v1.5.1 — 2026-11-09

The loading sweep is back in the light theme.

- **Skeleton cards shimmer again in light mode.** Both `--dsw-alias-bg-layer-1` and `--dsw-alias-bg-layer-2` resolve to `#fff` in the light theme, so the skeleton gradient collapsed into three identical stops and the sweep was invisible while a search was running; the dark theme, where the two layers differ, was unaffected. The light theme now builds its highlight from `label-primary` at 4% — a soft `#f5f5f5` band, matched to the contrast the dark theme always had — and the dark theme keeps its original `layer-1` band behind `[data-ds-dark-theme]`, so it looks exactly as before.
- The busy sweep shown while a frame is being added hard-coded `rgba(255,255,255,.14)`, which was equally invisible on white. It now uses `label-primary` at 14% — the same white in the dark theme, a visible sweep in the light one.

## v1.5.0 — 2026-11-07

FrameThrower is now three selectable reference sources, and the lightbox picks a moodboard on hover.

- **Film stills and commercial shots are independent sources.** The Sources picker groups Animation frames, Film stills and Commercial shots under FrameThrower; the three switches are independent and use the existing `ft_…` token. Film calls `POST /search`; commercial shots call `POST /commercials/shots/search`. Both are **off on first run**, so the default search stays one request at the old cost — turn them on under Sources.
- Film and commercial results are normalized into the existing tile shape: title / brand, year, caption, shot tags, palette and link. Film tiles carry a “Film” badge, commercial shots “Ad”, and the markdown export names the library.
- Similar frames (≈) now works per library: `/similar` for film and `/commercials/shots/similar` for commercial. A mixed moodboard asks each library once and interleaves the answers. Attached-image search covers the animation and commercial libraries; film is skipped because `/search/image` only accepts a publicly reachable image URL, and the grid explains the skip.
- Paging is per source with each endpoint's offset cap; a source whose first page is empty is not paged again, so a quiet library does not spend credits on every “Browse more”. The host cache is keyed per source.
- Settings keeps one FrameThrower card — one token field — whose switch turns the whole animation / film / commercial family on or off; the per-library switches stay in the composer. The settings card enters the token once for all three.
- `/anistyle/frames` and `/anistyle/similar` gain a `source` field (`animation`, `film`, `commercial`); responses keep `source: "framethrower"` and each frame now carries `kind`. Normalization also reads camelCase film metadata and flat or nested commercial fields (brand, spot, still, palette).
- **The lightbox picks a board on hover.** Hovering 「＋ 加入情绪板」 unfolds the board list instead of opening the modal: each board shows its frame count and a ✓ when this frame is already in it, and one click adds the frame — the lightbox stays open, so the next image is one arrow key away. The foot of the list creates a board inline. Opened from inside a board, the button still adds straight to that board.

## v1.4.1 — 2026-11-06

Web image search works again, and the Discover top bar drops its brand line.

- Bing's `/images/async` fragment — the fallback added in 1.4.0 — now answers a plain request with a script-only stub and no result markup, so every query parsed to zero frames while the panel said 「没有返回图片」. The web source reads Bing's full server-rendered `/images/search` page again (still no key, still every language), and DuckDuckGo stays as the fallback for when Bing shows a human check. The Bing page is parsed with the same `iusc` markup as before, now tolerant of extra classes on the tile.
- A Bing human-check page is reported as a rate-limit hint instead of looking like "this query has no images".
- The image proxy sniffs the first bytes when a host labels a real image as `application/octet-stream` (naruto-official.com does this with its webp art), so those tiles no longer leave holes in the grid; anything that is not actually an image still gets a 415.
- The Discover top bar no longer repeats the plugin name: the dot + “Reference Frames” line is gone and the Discover / Moodboards tabs sit flush right, so the page starts with the results.

## v1.4.0 — 2026-11-06

Updates land from the panel with a single click, next to a round of search and copy fixes.

- AI interpretation is now language-agnostic. The helper prompt detects the brief's language and translates its meaning into English FrameThrower queries, while keeping web search phrases in the brief's language (Chinese, Japanese, Korean, French, Spanish and others). The client no longer assumes Chinese when deciding whether a brief needs AI — non-Latin scripts and accented Latin text are recognised — and web search picks its market from the query script instead of the panel UI. The “needs AI” copy now says “non-English” rather than “Chinese”.
- Web image search now starts with DuckDuckGo's Bing-backed image endpoint for every language, with direct Bing as a fallback. This fixes the empty 「网页图片 · 没有返回图片」 warning caused by Bing's bot-challenge page (and its habit of mapping names such as 「奶龙」 to unrelated homophones). A partial empty now reads 「部分检索词没有返回图片」 instead of claiming the whole source returned nothing.
- Author metadata is now declared: `package.json` gains `author` and a `contributors` entry for [DeepSeek](https://github.com/deepseek-ai).
- The Chinese README moved to `docs/README.zh-CN.md`; the language switcher in both readmes points at the new path, and its guide / changelog links are now relative to `docs/`.
- A **「清空」/ Clear** button now sits to the left of 「换一批」 in the results header. One click — no confirmation, no toast — clears the visible reference frames, the persisted view cache (so a reload stays empty) and the host-side frame / web / image / interpret / vocabulary caches, so the next search or reshuffle starts fresh. Adds `POST /anistyle/clear-cache`. An in-flight request can no longer repopulate a grid that was just cleared. The emptied grid keeps a quiet placeholder — a stacked-frame mark with a one-line prompt — so the page never reads as a blank middle. The placeholder fills the scrollport exactly, so it does not introduce a stray scrollbar.
- **One-click updates in the panel.** The plugin is a git checkout, so the panel compares local `HEAD` with `origin/main` on load — a quiet `git fetch`, cached for 10 minutes host-side — and shows a round brand-blue button with a downward arrow left of the Discover / Moodboards tabs when the branch has moved; hovering it reads 「检测到新版本」. One click fast-forwards (`git merge --ff-only`, so uncommitted local edits are never touched and history is never rewritten) and the button turns into a spinner. A client-only change reloads the page; a change to host files makes the host relaunch the desktop app (quit, then reopen by bundle id) so both halves boot from the new checkout — no confirmation dialog on this path. If a task or an armed reminder is running, the app is left alone and the button becomes 「重启生效」 until the work finishes. In a plain browser the app is never quit; a toast asks for a manual restart instead. Offline, a merge blocked by local changes and a diverged branch are reported in a toast. Settings ends with the current version and a 「检查更新」 action. Adds `GET /anistyle/update`, `POST /anistyle/update` and `POST /anistyle/restart`.

## v1.3.2 — 2026-11-06

Image input now reaches the web source, and the attached image has a real preview.

- Upstream warnings now name their source, e.g. `FrameThrower · No animation title called “Arcane”.`, so a note from one source is never mistaken for the other's.
- The pasted / dropped image now actually renders in the composer: the thumbnail was pointing at the attachment object instead of its `preview` data URL. The attachment is a square thumbnail with a circular × that only appears on hover, matching the host chat composer — no caption or "remove" text, no focus ring from clicking it.
- Clicking the attached thumbnail (cursor: zoom-in) opens the image in a full-screen lightbox; close it with ×, a click outside, or Escape.
- Right-click (or two-finger click on a trackpad) an enlarged image — in the attachment preview or the frame lightbox — to get a small **Copy image** menu. The image is normalized to a PNG (longest side capped at 2400px) and written through the Clipboard API; a toast confirms success or explains a failure, including unsupported browsers.
- **Image search now reaches the web source.** With Chrome web images enabled, the default vision model reads the attached image and turns it into Bing search phrases; FrameThrower still gets the raw image for its native visual similarity. Both result sets are interleaved when both sources are on. With AI off, a typed note is used as the web query and an empty note explains why the image cannot be translated. Adds `POST /anistyle/interpret-image`; the image is admitted through the host attachment store so it can be sent as a real image block.

## v1.3.1 — 2026-11-05

Housekeeping.

- Remove the unused `styles.json` catalog and its legacy `GET /anistyle/library` route; style keywords keep coming from FrameThrower's `/animation/vocabulary`.

## v1.3.0 — 2026-11-05

Multiple retrieval sources, and a source the user can switch per search.

- **AI directions** — the AI switch takes x1 / x2 / x3 and asks the model for that many distinct readings of the brief, interleaving their pages instead of searching one description.
- **Community boards** — the preset button now opens a browser with cover previews and per-board install (the old button installed everything at once).
- **Language switch** — 简体中文 / English directly in Settings.
- **Inline keyword management** — add, rename and delete terms and categories from the keyword panel; a new term commits on blur or Enter.
- **Sources picker** in the composer (next to Keywords); Settings keeps the token fields and switches only for token-based sources. Everything that is on joins the search; a source that is off (or has no token) is skipped, and a source that fails only adds a warning line — the other source's results still show.
- **Chrome web images**: a second source backed by Bing image search. No token, Chinese briefs work as-is, paging via “Browse more”. Results carry a “Web” badge, open the source page, and are interleaved + de-duplicated with FrameThrower frames.
- **Faster AI helper calls**: the interpret step now asks for the model's cheapest reasoning level, reserves enough output tokens for reasoning + JSON (1200), and allows 15s, so a thinking default no longer trips the old 8s cap. A provider whose `reasoningEfforts.off` maps to nothing can still think for 10s+; mapping it to `off` makes the helper return in ~2s.
- **AI search feeds both sources**: one model call now returns English frame descriptions for FrameThrower *and* 2–3 short image-search phrases for the web source (keywords, not sentences; Chinese or official English names allowed). The AI switch also appears when only the web source is on, and the web source falls back to the raw brief when AI is off or the call fails.
- **Preset sync moved to the moodboards header**: the “save as plugin preset” row is gone from Settings. A small upload icon now sits left of “Community boards”, shows a spinner while saving, and hints “Sync to GitHub” on hover.
- **Clean web card text**: Bing wraps matched terms in private-use highlight markers (U+E000/U+E001), which rendered as tofu/⏸ blocks. They are stripped at parse time and again at render time, so frames already saved in moodboards clean up on refresh; results with no Bing title fall back to the source domain, and the redundant “web” tag chip is gone.
- Images from the web source are fetched through a local `/anistyle/img` proxy (cached, private hosts rejected, type/size checked) so hotlink protection and http-only hosts no longer leave holes in the grid.
- Source-aware UI: the ↗ tooltip and lightbox link no longer say “FrameThrower”; similarity (≈) and image search stay FrameThrower-only and hide on web tiles. Markdown export writes each frame's original image URL and source.
- Without a token the plugin still works: enable only the web source, or leave both on — FrameThrower is skipped until a token is saved.
- **Pinterest is not integrated**; the reasoning (partner-only search, ToS) is documented in the guide.

## v1.2.0 — 2026-11-05

First public release.

- Prompt-first discovery: type a feeling in Chinese or English, or drop / paste an image; the panel decides which path to take.
- **AI search** switch in the composer: the host's default model turns the brief into one English single-frame description (with optional title / genre / per-title in the margin). Off means the words go upstream untouched; a Chinese brief then stops at “AI search needed” instead of showing the upstream default page.
- Honest results: the grid is cleared on every search, the exact query is always shown, and failures (no token, credits, rate limit, upstream status) are stated instead of padded with stale frames.
- Keywords as editable chips grouped by category, inserted into the brief rather than fired as a search; categories, terms and renames are all user-managed and stored locally.
- Moodboards: create / rename / delete / pin, hover-only card actions, per-frame add picker that stays open for multi-board adds, Markdown export.
- Per-card ≈ swaps just that tile with a visually similar frame; inside a board ≈ returns recommendations you can accept one by one, and “Similar picks” samples three random frames as one multi-image reference.
- Lightbox with ← → navigation and an add-to-board action that knows which board you are in.
- “Browse more” appends the next page, de-duplicates, survives reloads, and says “no more” instead of going silent.
- Optional preset moodboards: `presets/moodboards.json` ships nothing by default; a user can install the author's boards with one click, and the author saves + auto-pushes them from the settings panel using local git credentials.
