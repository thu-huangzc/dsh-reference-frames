# Reference Frames · DSH plugin

[English](README.md) · [简体中文](docs/README.zh-CN.md)

Describe the feeling you want — or paste an image — and it returns real reference frames that match, which you can keep in moodboards. Two retrieval sources ship in the box: FrameThrower (animation) and web image search, and you pick which ones a search uses. Type in any language: AI search translates the brief for FrameThrower and keeps web search in the brief's own language.

## Install

Requirements: DeepSeek Harness. A [FrameThrower](https://framethrower.ai) token (`ft_…`, free to create) unlocks the animation source; the web-image source needs no token, so the plugin still works without one.

```bash
git clone git@github.com:thu-huangzc/dsh-reference-frames.git
ln -s "$PWD/dsh-reference-frames" ~/.dsh/profiles/<profile>/node_modules/dsh-reference-frames
```

Register it in `~/.dsh/profiles/<profile>/package.json`:

```json
{
  "dependencies": { "dsh-reference-frames": "link:/absolute/path/to/dsh-reference-frames" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

Restart Harness — **Reference Frames** appears in the sidebar. Paste the token in the gear menu on first use.

> The symlink name, the package `name`, `cordis.patch.yml`'s `name` and the `id` at the top of `client.js`
> must match. Miss one and the plugin silently never loads.

## Docs

- [Guide](docs/GUIDE.md) — search, keywords, moodboards, presets, routes, maintenance
- [Changelog](CHANGELOG.md)
