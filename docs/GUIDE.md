# Guide

[English](GUIDE.md) · [简体中文](GUIDE.zh-CN.md)

## Search

One input box. Type a brief, or paste / drag / pick an image — the panel decides: text becomes a frame search; an image goes to FrameThrower as a visual-similarity search and, when the web source is on, through the vision model into web image keywords.

- **AI search** (switch in the composer, left of the search button; used by both sources, and shown even when only the web source is on):
  - On — the host's default model returns two things in one call: one English single-frame description for FrameThrower (with optional title / genre / per-title), and 2–3 short image-search phrases for the web source (keywords, not sentences; they may stay in the brief's language or use an official English name). The model detects the brief's language first and translates the meaning into English for FrameThrower; Chinese, Japanese, Korean, French, Spanish and other languages can be typed directly. The exact terms are shown per source above the grid. With an attached image, a separate vision call reads the image (using your note as context) and produces the web phrases; FrameThrower still gets the raw image.
  - Off — your words go upstream untouched: FrameThrower needs English, the web source takes the brief as written. For an attached image, no vision call happens: the web source uses your typed note as its query, and explains that the image itself cannot be translated when the note is empty.
  - The helper asks for the model's lowest thinking level. A thinking model whose provider maps `reasoningEfforts.off` to nothing will still think for 10s+; mapping it to `off: off` makes the call return in ~2s, otherwise it times out and falls back to the raw brief.
- **Non-English briefs and image-based web search need AI.** FrameThrower matches English descriptions; a brief in Chinese, Japanese, French or any other language falls back to the default page. The AI step detects the input language and translates the meaning into English queries while keeping web phrases in the brief's language. Web image search needs a vision-capable model to turn an attached image into queries. With AI off the panel says so instead of sending a placeholder request.
- **Results always belong to the current search.** The grid is cleared first, the query is always visible, and failures (no token, credits, rate limit, unreachable, upstream status) are stated plainly.
- **Browse more** appends and de-duplicates the next page; “More frames” replaces the set instead. At the end it says “no more frames”; a failed page keeps the button and shows why.
- **Clear** sits left of “More frames” in the results header. One click — no confirmation, no toast — empties the grid, drops the persisted view cache (so a reload stays empty) and wipes the host-side search / image / interpret caches, so the next search starts fresh. The emptied grid keeps a quiet placeholder instead of leaving the middle blank.

## Sources

“Sources” sits in the composer toolbar next to “Keywords”. Clicking it opens per-source switches. Settings only lists sources that need a token, so the web source does not take a settings card. The choice lives in `anistyle:sources:v1`. A search only calls the sources that are on, and one source failing never hides the other source's results — the reason is listed above the grid.

- **FrameThrower** — animation frames matched against English single-frame descriptions; needs a token; supports similar frames, image search and reshuffling.
- **Chrome web images** — DuckDuckGo Images (Bing-backed) for every language, with direct Bing as a fallback. No token. With AI on it searches the model's short phrases, and falls back to your wording when AI is off or fails. Attach an image and the vision model reads it first, then searches with the phrases it describes (AI off means the image cannot be translated — a typed note is used as the query instead). No similar frames. These are public web endpoints, not official APIs: they can throttle, break on redesign, or return dead image links. Images go through the local `/anistyle/img` proxy to dodge hotlink protection and mixed content.
- **Where a tile came from** — web tiles carry a “Web” badge and ↗ opens the source page; results from both sources are interleaved and de-duplicated.
- Similar (≈) only appears on FrameThrower tiles. An attached image goes to FrameThrower as a visual-similarity search, and to the web source through the vision model; with both sources on, the two result sets are interleaved.
### Why not Pinterest

Pinterest's only public keyword search is `GET /v5/search/partner/pins`: a closed beta for invited/approved partners, capped at the top 10 results; `GET /v5/search/pins` only searches your own account's Pins. Access requires a business account, application review (Trial is rate-limited per day and tokens expire in 24h), Standard access, and OAuth 2. Pinterest's ToS also forbids automated scraping without permission. So this release does not integrate Pinterest; the only viable routes are partner + official API, or letting users paste board links themselves.

## Keywords

“Keywords” under the input opens chips grouped by category (era, rendering, lighting …).

- Clicking a chip inserts it into the brief — it does not search. Click again to remove it.
- Manage mode: rename or delete a term, add a term, rename a category, add a category, delete a category. Built-in categories come back with “restore defaults”.
- Everything is stored locally in `anistyle:keywords:v1`.

## Frames

Each frame shows title / year, its caption, shot tags and its own palette. Three buttons appear on hover:

| Button | Action |
| --- | --- |
| ＋ | Open the board picker. Click a board to add it — the picker stays open for more boards; the trailing ＋ takes a name and creates a board on the spot |
| ≈ | Replace **this tile only** with a visually similar frame (FrameThrower tiles only) |
| ↗ | Open the frame's source page |

Click an image to open the lightbox: `←` `→` to move, `Esc` to close, and **＋ Add to board** at the right end of the caption row. Right-click (or two-finger click on a trackpad) an image in either the frame lightbox or the attached-image preview to get a **Copy image** menu: it writes a PNG to the system clipboard, scaling down past 2400px, and says so explicitly when the browser cannot copy images.

## Moodboards

Boards start empty and are stored in this browser.

- Card actions appear on hover: pin ↑ (pinned boards sort first) and delete ×.
- Inside a board, ≈ on a frame returns recommendations in a strip above the grid. Click ＋ on a recommendation to add it; nothing is added otherwise.
- **Similar picks** (board header) samples three random frames from the board and searches with all of them at once. “Reshuffle” samples again.
- Rename, remove frames, and export Markdown (per-frame caption, palette, deep link).

## Preset moodboards

`presets/moodboards.json` holds optional boards to share.

- Users: when the file has content, a **Community boards** button appears on the moodboards page. Same-name boards are skipped and ids are regenerated; ignoring the button changes nothing.
- Author: the upload icon at the right of the moodboards header (tooltip “Sync to GitHub”) writes the current boards to that file, then commits and pushes with your local git credentials by default; the icon spins while it runs.

```yaml
# cordis.patch.yml
config:
  autoPush: true      # false = write the file only
  pushRemote: origin
  pushBranch: main
```

## Updates

The plugin is a git checkout on your machine, so the panel can check for updates itself.

- On load the panel quietly asks the host to `git fetch` and compare local `HEAD` with `origin/<default branch>`; the host caches the answer for 10 minutes.
- When the branch has moved, a round brand-blue button with a downward arrow appears left of the Discover / Moodboards tabs. Hovering it reads “New version available”.
- One click is the whole flow: the button turns into a spinner while the host fast-forwards (`git merge --ff-only`) — uncommitted local edits are never touched and history is never rewritten.
- What happens next depends on what changed:
  - a client-only change (`client.js`, `locale/`, docs …) reloads the panel, and the new code is live;
  - a change to host files (`index.js`, `cordis.patch.yml`, `package.json`, …) makes the host relaunch the desktop app (quit, then reopen by bundle id) so both halves boot from the new checkout. There is no confirmation dialog in this path.
- If a task or an armed reminder is running, the app is not killed: the button becomes “Restart to apply” and one more click restarts once the work is done.
- Opened in a plain browser rather than the desktop window, the app is never quit; a toast asks you to restart DeepSeek Harness yourself.
- Failures (offline, a merge blocked by local changes, a diverged branch, not on the default branch) are reported in a toast and the button returns to its normal state.
- The gear menu ends with the current version and **Check for updates**, which forces a check past the cache.

It reuses `pushRemote` / `pushBranch` from `cordis.patch.yml` (defaults `origin` / `main`).

## Token & cost

Gear menu → paste the `ft_…` token. It stays in browser localStorage, travels as a request header to the local route, and is forwarded host-side; it never enters the chat or the bundle. The token only affects FrameThrower; the web-image source needs none.

A frame search costs about 4 credits, a similar-frame search 2 (10 when searching by image).

## Files & routes

| File | Role |
| --- | --- |
| `index.js` | Host half: proxies FrameThrower and web images (DuckDuckGo / Bing fallback), image proxy, caches searches, caches the style vocabulary for 24h, rewrites the brief and reads attached images for web queries with the default model, reads/writes presets |
| `client.js` | Browser half: panel UI, source switches, AI switch, moodboards in localStorage |
| `cordis.patch.yml` | Plugin row and config |
| `presets/moodboards.json` | Optional shared moodboards |
| `locale/*.json` | Title and description shown in the plugin manager |

- `POST /anistyle/interpret` — `{ text }` → `{ source: 'model'|'none', params }`
- `POST /anistyle/interpret-image` — `{ image, text?, count? }` → `{ source: 'model'|'none', params: { web } }` (vision model; stores the image as a host attachment)
- `GET /anistyle/vocabulary` — style vocabulary (proxied and cached)
- `POST /anistyle/frames` — `{ query, style?, title?, genre?, limit, offset, perTitle }`
- `POST /anistyle/web` — `{ query, limit, offset }` → `{ source: 'chrome', frames }` (market inferred from the query script)
- `GET /anistyle/img?u=` — image proxy (same-origin, cached, private hosts rejected, size/type limited)
- `POST /anistyle/similar` — `{ frameId | frameIds | image, by?, limit }`
- `GET /anistyle/presets` / `POST /anistyle/presets` — read / write the preset file
- `POST /anistyle/clear-cache` — clear all in-memory caches (frame / web / image / interpret / vocabulary)
- `GET /anistyle/last` — last upstream response (diagnostics)
- `GET /anistyle/update` — `{ ok, current, latest, behind, ahead, commits, head }`, cached host-side for 10 minutes; `?refresh=1` forces a check
- `POST /anistyle/update` — fast-forward the checkout to `origin/<branch>`; returns `{ ok, from, to, action }` (`reload` / `restart` / `busy` / `manual`) or why it did not happen
- `POST /anistyle/restart` — quit and relaunch the desktop app when nothing is running, so the host loads the new code

## Maintenance

- The plugin directory is symlinked into the profile; there is only one copy of the code.
- `client.js` → refresh the page. `index.js` / `cordis.patch.yml` → restart the app.
- Check syntax with `node --check client.js && node --check index.js`.
- Renaming requires four matching values: package `name`, `cordis.patch.yml` `name`, `client.js` `id`, and the symlink / profile entries.
- Release: bump `package.json`, add a `CHANGELOG.md` entry, `git tag -a vX.Y.Z`, then push the branch and the tag.
