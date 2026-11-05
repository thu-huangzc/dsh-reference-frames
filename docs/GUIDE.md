# Guide

[English](GUIDE.md) · [简体中文](GUIDE.zh-CN.md)

## Search

One input box. Type a brief, or paste / drag / pick an image — the panel decides: an image becomes a look-alike search, text becomes a frame search.

- **AI search** (switch in the composer, left of the search button; used by both sources, and shown even when only the web source is on):
  - On — the host's default model returns two things in one call: one English single-frame description for FrameThrower (with optional title / genre / per-title), and 2–3 short image-search phrases for the web source (keywords, not sentences; they may stay Chinese or use an official English name). The exact terms are shown per source above the grid.
  - Off — your words go upstream untouched: FrameThrower needs English, the web source takes the brief as written.
  - The helper asks for the model's lowest thinking level. A thinking model whose provider maps `reasoningEfforts.off` to nothing will still think for 10s+; mapping it to `off: off` makes the call return in ~2s, otherwise it times out and falls back to the raw brief.
- **Chinese briefs need AI.** FrameThrower matches English descriptions; a Chinese query returns its default page. With AI off the panel stops at “AI search needed” — no request, no placeholder results — and offers a one-click retry.
- **Results always belong to the current search.** The grid is cleared first, the query is always visible, and failures (no token, credits, rate limit, unreachable, upstream status) are stated plainly.
- **Browse more** appends and de-duplicates the next page; “More frames” replaces the set instead. At the end it says “no more frames”; a failed page keeps the button and shows why.

## Sources

“Sources” sits in the composer toolbar next to “Keywords”. Clicking it opens per-source switches. Settings only lists sources that need a token, so the web source does not take a settings card. The choice lives in `anistyle:sources:v1`. A search only calls the sources that are on, and one source failing never hides the other source's results — the reason is listed above the grid.

- **FrameThrower** — animation frames matched against English single-frame descriptions; needs a token; supports similar frames, image search and reshuffling.
- **Chrome web images** — Bing image search, no token, Chinese works as-is; with AI on it searches the model's short phrases, and falls back to your wording when AI is off or fails. No similar frames. Bing retired its public image-search API in August 2025, so this reads the public web endpoint instead: an unofficial interface that can throttle, break on redesign, or return dead image links. Images go through the local `/anistyle/img` proxy to dodge hotlink protection and mixed content.
- **Where a tile came from** — web tiles carry a “Web” badge and ↗ opens the source page; results from both sources are interleaved and de-duplicated.
- Similar (≈) only appears on FrameThrower tiles; image search also uses FrameThrower only.

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

Click an image to open the lightbox: `←` `→` to move, `Esc` to close, and **＋ Add to board** at the right end of the caption row.

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

## Token & cost

Gear menu → paste the `ft_…` token. It stays in browser localStorage, travels as a request header to the local route, and is forwarded host-side; it never enters the chat or the bundle. The token only affects FrameThrower; the web-image source needs none.

A frame search costs about 4 credits, a similar-frame search 2 (10 when searching by image).

## Files & routes

| File | Role |
| --- | --- |
| `index.js` | Host half: proxies FrameThrower and Bing web images, image proxy, caches searches, caches the style vocabulary for 24h, rewrites the brief with the default model, reads/writes presets |
| `client.js` | Browser half: panel UI, source switches, AI switch, moodboards in localStorage |
| `cordis.patch.yml` | Plugin row and config |
| `presets/moodboards.json` | Optional shared moodboards |
| `styles.json` | 36 curated style entries, not used for matching yet |
| `locale/*.json` | Title and description shown in the plugin manager |

- `POST /anistyle/interpret` — `{ text }` → `{ source: 'model'|'none', params }`
- `GET /anistyle/vocabulary` — style vocabulary (proxied and cached)
- `POST /anistyle/frames` — `{ query, style?, title?, genre?, limit, offset, perTitle }`
- `POST /anistyle/web` — `{ query, limit, offset, lang }` → `{ source: 'chrome', frames }`
- `GET /anistyle/img?u=` — image proxy (same-origin, cached, private hosts rejected, size/type limited)
- `POST /anistyle/similar` — `{ frameId | frameIds | image, by?, limit }`
- `GET /anistyle/presets` / `POST /anistyle/presets` — read / write the preset file
- `GET /anistyle/library`, `GET /anistyle/last` — legacy catalog and last upstream response (diagnostics)

## Maintenance

- The plugin directory is symlinked into the profile; there is only one copy of the code.
- `client.js` → refresh the page. `index.js` / `cordis.patch.yml` → restart the app.
- Check syntax with `node --check client.js && node --check index.js`.
- Renaming requires four matching values: package `name`, `cordis.patch.yml` `name`, `client.js` `id`, and the symlink / profile entries.
- Release: bump `package.json`, add a `CHANGELOG.md` entry, `git tag -a vX.Y.Z`, then push the branch and the tag.
