# Reference Frames · DSH plugin

[English](README.md) · [简体中文](docs/README.zh-CN.md)

Describe the feeling you want and it returns real reference frames that match, which you can keep in moodboards.

## Install

Requirements: DeepSeek Harness. One [FrameThrower](https://framethrower.ai) token (`ft_…`, free to create) unlocks three independent sources — animation frames, film stills and commercial shots; the web-image source needs no token, so the plugin still works without one.

`dsh-reference-frames` is on npm. Install it from the **Plugins** page and let that page update it.

**From npm.** Plugins page → 添加插件 → `dsh-reference-frames`, or in `~/.dsh/profiles/<profile>/package.json`:

```json
{
  "dependencies": { "dsh-reference-frames": "^1.6.0" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

The bundle is saved as an exact version, and the Plugins page then lists newer releases with an **Update** button.

**From a checkout.** Link the folder instead:

```json
{
  "dependencies": { "dsh-reference-frames": "link:/absolute/path/to/dsh-reference-frames" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

```bash
cd ~/.dsh/profiles/<profile> && pnpm install
```

A linked checkout gets no version list on the Plugins page — `git pull` and restart Harness to pick up changes.

Either way, restart Harness and **Reference Frames** appears in the sidebar. Paste the token in the gear menu on first use.

> The package `name`, `cordis.patch.yml`'s `name` and the `id` at the top of `client.js` must match.
> Miss one and the plugin silently never loads.

## Docs

- [Guide](docs/GUIDE.md) — search, keywords, moodboards, presets, routes, maintenance
- [Changelog](CHANGELOG.md)
