# Reference Frames · DSH plugin

[English](README.md) · [简体中文](README.zh-CN.md)

Describe the feeling you want — or paste an image — and it returns real animation frames that match, which you can keep in moodboards.

## Install

Requirements: DeepSeek Harness and a [FrameThrower](https://framethrower.ai) token (`ft_…`, free to create).

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
