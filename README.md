# Reference Frames · DSH plugin

Describe the feeling you want — or just paste an image — and it pulls real animation frames that match, then lets you keep the ones that land in moodboards.

## Install

Requirements: DeepSeek Harness, and a [FrameThrower](https://framethrower.ai) token (`ft_…`, free to create).

```bash
git clone git@github.com:thu-huangzc/dsh-reference-frames.git
ln -s "$PWD/dsh-reference-frames" ~/.dsh/profiles/<profile>/node_modules/dsh-reference-frames
```

Then let the profile know about it — edit `~/.dsh/profiles/<profile>/package.json`:

```json
{
  "dependencies": { "dsh-reference-frames": "link:/absolute/path/to/dsh-reference-frames" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

Restart Harness: a **Reference Frames** entry shows up in the sidebar. Paste the `ft_…` token into the gear menu the first time you use it.

> The symlink name, the package `name`, the `name` in `cordis.patch.yml` and the `id` at the top of `client.js`
> must all match — miss one and the plugin silently never loads.

Usage notes, architecture, routes and maintenance live in **[docs/GUIDE.md](docs/GUIDE.md)** (Chinese).
