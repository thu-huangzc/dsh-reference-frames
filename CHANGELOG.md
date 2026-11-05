# Changelog

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
