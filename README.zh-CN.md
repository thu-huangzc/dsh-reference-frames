# 参考帧 · DSH 插件

[English](README.md) · [简体中文](README.zh-CN.md)

说一句你想要的感觉，或者贴一张图，它会找出对味的真实参考帧，供你收进情绪板。内置两个检索源：FrameThrower（动画帧）和网页图片，检索时自己决定用哪些。输入支持任意语言：AI检索会把需求翻译成英文检索词交给 FrameThrower，同时让网页检索保持原文语言。

## 安装

前提：DeepSeek Harness。[FrameThrower](https://framethrower.ai) token（`ft_…`，免费注册）用于动画帧源；网页图片源不需要 token，所以没有 token 也能用。

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
