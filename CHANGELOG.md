# Changelog

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
