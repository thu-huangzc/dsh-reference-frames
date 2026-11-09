# Guide

[English](GUIDE.md) · [简体中文](GUIDE.zh-CN.md)

## Search

One input box. Type a brief, or paste / drag / pick an image — the panel decides: text becomes a frame search; an image goes to FrameThrower as a visual-similarity search and, when the web source is on, through the vision model into web image keywords.

- **AI search** (switch in the composer, left of the search button; used by every source, and shown even when only the web source is on):
  - On — the host's default model returns two things in one call: one English single-frame description for the FrameThrower libraries (title / genre / per-title filters apply to the animation library), and 2–3 short image-search phrases for the web source (keywords, not sentences; they may stay in the brief's language or use an official English name). The model detects the brief's language first and translates the meaning into English for FrameThrower; Chinese, Japanese, Korean, French, Spanish and other languages can be typed directly. The exact terms are shown per source above the grid. With an attached image, a separate vision call reads the image (using your note as context) and produces the web phrases; FrameThrower still gets the raw image.
  - Off — your words go upstream untouched: FrameThrower needs English, the web source takes the brief as written. For an attached image, no vision call happens: the web source uses your typed note as its query, and explains that the image itself cannot be translated when the note is empty.
  - The helper asks for the model's lowest thinking level. A thinking model whose provider maps `reasoningEfforts.off` to nothing will still think for 10s+; mapping it to `off: off` makes the call return in ~2s, otherwise it times out and falls back to the raw brief.
- **Non-English briefs and image-based web search need AI.** FrameThrower matches English descriptions; a brief in Chinese, Japanese, French or any other language falls back to the default page. The AI step detects the input language and translates the meaning into English queries while keeping web phrases in the brief's language. Web image search needs a vision-capable model to turn an attached image into queries. With AI off the panel says so instead of sending a placeholder request.
- **Results always belong to the current search.** The grid is cleared first, the query is always visible, and failures (no token, credits, rate limit, unreachable, upstream status) are stated plainly.
- **Browse more** appends and de-duplicates the next page; “More frames” replaces the set instead. At the end it says “no more frames”; a failed page keeps the button and shows why.
- **Clear** sits left of “More frames” in the results header. One click — no confirmation, no toast — empties the grid, drops the persisted view cache (so a reload stays empty) and wipes the host-side search / image / interpret caches, so the next search starts fresh. The emptied grid keeps a quiet placeholder instead of leaving the middle blank.

## Sources

“Sources” sits in the composer toolbar next to “Keywords”. Clicking it opens per-source switches. The three FrameThrower libraries sit together under one group; the web source sits below them. Settings shows one token card, entered once, and its switch turns the whole FrameThrower family on or off. The choice lives in `anistyle:sources:v1`. A search only calls the sources that are on, and one source failing never hides the others' results — the reason is listed above the grid.

- **Animation frames** — animated series and films matched against English single-frame descriptions; needs a token; supports similar frames, image search and reshuffling.
- **Film stills** — live-action frames from FrameThrower's film library (`POST /search`); needs a token. Supports similar frames and reshuffling, but not image search: that endpoint only accepts a publicly reachable image URL, so an attached image is skipped with a note.
- **Commercial shots** — individual shots from ads (`POST /commercials/shots/search`), tagged with brand, spot, year, shot size and light; needs a token. Supports similar shots and image search.
- **Chrome web images** — Bing Images' server-rendered result page for every language, with DuckDuckGo Images as a fallback. No token. With AI on it searches the model's short phrases, and falls back to your wording when AI is off or fails. Attach an image and the vision model reads it first, then searches with the phrases it describes (AI off means the image cannot be translated — a typed note is used as the query instead). No similar frames. These are public web endpoints, not official APIs: they can throttle, answer a scripted request with a human check, break on redesign, or return dead image links. Images go through the local `/anistyle/img` proxy to dodge hotlink protection and mixed content.
- **Where a tile came from** — web tiles carry a “Web” badge, film tiles “Film” and commercial shots “Ad”; ↗ opens the source page. Results from every enabled source are interleaved and de-duplicated.
- Similar (≈) appears on every FrameThrower tile (animation, film and commercials). An attached image goes to the animation and commercial libraries as a visual-similarity search, and to the web source through the vision model; film stills are skipped because their API needs a public image URL. With several sources on, the result sets are interleaved.
- Film and commercials are **off on first run** so the default search stays one request at the old cost; turn them on under Sources. The animation / film / commercial switches are independent.
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

Click an image to open the lightbox: `←` `→` to move, `Esc` to close, and **＋ Add to board** at the right end of the caption row. Hover that button to unfold your boards; click one to add the frame and the lightbox stays open, ready for the next image. The bottom of the list creates a board on the spot. Opened from inside a board, the button reads **Add to this board** and drops the frame straight in. Right-click (or two-finger click on a trackpad) an image in either the frame lightbox or the attached-image preview to get a **Copy image** menu: it writes a PNG to the system clipboard, scaling down past 2400px, and says so explicitly when the browser cannot copy images.

## Moodboards

Boards start empty and are stored in this browser.

- Card actions appear on hover: pin ↑ (pinned boards sort first) and delete ×.
- Inside a board, ≈ on a frame returns recommendations in a strip above the grid. Click ＋ on a recommendation to add it; nothing is added otherwise.
- **Similar picks** (board header) samples three random frames from the board and searches with all of them at once. “Reshuffle” samples again.
- Rename, remove frames, and export Markdown (per-frame caption, palette, deep link).

## Preset moodboards

Your boards are saved to `~/.dsh/reference-frames/moodboards.json` — outside the installed package, so a plugin update never overwrites them. The first run seeds that file from the boards the package ships in `presets/moodboards.json`.

- Users: when the package's file has content, a **Community boards** button appears on the moodboards page. Same-name boards are skipped and ids are regenerated; ignoring the button changes nothing.
- Author: in a checkout, the upload icon at the right of the moodboards header (tooltip “Sync to GitHub”) writes the current boards back into `presets/moodboards.json`, then commits and pushes with your local git credentials; the icon spins while it runs. An npm install has no repo to push into, so the icon is hidden there and saving just writes the local file.

```yaml
# cordis.patch.yml
config:
  autoPush: true      # false = write the file only
  pushRemote: origin
  pushBranch: main
```

## Updates

Updates belong to Harness's **Plugins** page: the plugin is published on npm, and its bundle page lists newer versions with an **Update** button that replaces the installed copy in place. Nothing inside the panel talks to GitHub.

- Install from npm (Plugins page → 添加插件) and the version list appears on its own; a `link:` checkout gets no list, so update that with `git pull` and a restart.
- The gear menu ends with the version this copy came from — a label, no button.

## Token & cost

Gear menu → paste the `ft_…` token. It stays in browser localStorage, travels as a request header to the local route, and is forwarded host-side; it never enters the chat or the bundle. The token only affects FrameThrower; the web-image source needs none.

Animation frames cost about 4 credits per search, film stills and commercial shots about 2. A similar-frame search costs 2, or 10 when searching by image.

## Files & routes

| File | Role |
| --- | --- |
| `index.js` | Host half: proxies the three FrameThrower libraries (animation / film / commercials) and web images (DuckDuckGo / Bing fallback), image proxy, caches searches per source, caches the style vocabulary for 24h, rewrites the brief and reads attached images for web queries with the default model, reads/writes presets |
| `client.js` | Browser half: panel UI, source switches, AI switch, moodboards in localStorage |
| `cordis.patch.yml` | Plugin row and config |
| `presets/moodboards.json` | Shared moodboards shipped with the package (the live copy is `~/.dsh/reference-frames/moodboards.json`) |
| `locale/*.json` | Title and description shown in the plugin manager |

- `POST /anistyle/interpret` — `{ text }` → `{ source: 'model'|'none', params }`
- `POST /anistyle/interpret-image` — `{ image, text?, count? }` → `{ source: 'model'|'none', params: { web } }` (vision model; stores the image as a host attachment)
- `GET /anistyle/vocabulary` — style vocabulary (proxied and cached)
- `POST /anistyle/frames` — `{ source?: 'animation' | 'film' | 'commercial', query, limit, offset, ... }`; animation also takes `style` / `title` / `genre` / `perTitle`, film `film_title` / `genre`, commercial `perSpot`
- `POST /anistyle/web` — `{ query, limit, offset }` → `{ source: 'chrome', frames }` (market inferred from the query script)
- `GET /anistyle/img?u=` — image proxy (same-origin, cached, private hosts rejected, size/type limited)
- `POST /anistyle/similar` — `{ source?, frameId | frameIds | image, by?, limit }` (film needs ids; commercial maps ids to shots and an image to `/commercials/shots/image`)
- `GET /anistyle/presets` — `{ boards, checkout }`; `checkout` says whether this install can push boards back to the repo
- `POST /anistyle/presets` — write the boards to the user's data file; pushes only from a checkout
- `POST /anistyle/clear-cache` — clear all in-memory caches (frame / web / image / interpret / vocabulary)
- `GET /anistyle/last` — last upstream response (diagnostics)
- `GET /anistyle/version` — the installed version, shown at the foot of the gear menu

## Maintenance

- Two ways in: the npm copy under `~/.dsh/profiles/<profile>/node_modules/dsh-reference-frames` (what users run), or a `link:`ed checkout for development.
- In a checkout: `client.js` → refresh the page; `index.js` / `cordis.patch.yml` → restart the app. In an npm install, edit the checkout and publish — the change arrives through the Plugins page.
- Check syntax with `node --check client.js && node --check index.js`.
- Renaming requires four matching values: package `name`, `cordis.patch.yml` `name`, `client.js` `id`, and the profile entries.
- Release: bump `package.json`, add a `CHANGELOG.md` entry, commit, then push a `vX.Y.Z` tag. `.github/workflows/release.yml` publishes to npm (trusted publishing, no OTP) and opens the GitHub release titled `vX.Y.Z`.
