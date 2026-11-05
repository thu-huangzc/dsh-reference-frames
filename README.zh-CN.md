# 参考帧 · DSH 插件

[English](README.md) · [简体中文](README.zh-CN.md)

说一句你想要的感觉，或者贴一张图，它会找出对味的真实动画参考帧，供你收进情绪板。

## 安装

前提：DeepSeek Harness，以及一个 [FrameThrower](https://framethrower.ai) token（`ft_…`，免费注册）。

```bash
git clone git@github.com:thu-huangzc/dsh-reference-frames.git
ln -s "$PWD/dsh-reference-frames" ~/.dsh/profiles/<profile>/node_modules/dsh-reference-frames
```

在 `~/.dsh/profiles/<profile>/package.json` 里登记：

```json
{
  "dependencies": { "dsh-reference-frames": "link:/绝对路径/dsh-reference-frames" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

重启 Harness，侧边栏出现 **参考帧**。首次使用在齿轮菜单里填入 token。

> 软链接名、`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client.js` 顶部的 `id`
> 必须一致，漏掉任何一个插件都会静默不加载。

## 文档

- [使用与维护](docs/GUIDE.zh-CN.md) — 检索、关键词、情绪板、预设、路由、维护
- [更新日志](CHANGELOG.md)
