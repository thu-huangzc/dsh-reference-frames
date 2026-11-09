# 参考帧 · DSH 插件

[English](../README.md) · [简体中文](README.zh-CN.md)

说一句你想要的感觉，它会找出对味的真实参考帧，供你收进情绪板。

## 安装

前提：DeepSeek Harness。[FrameThrower](https://framethrower.ai) token（`ft_…`，免费注册）用于动画帧源；网页图片源不需要 token，所以没有 token 也能用。

`dsh-reference-frames` 已发布到 npm。在 **插件** 页安装，并由该页负责更新。

**从 npm 安装。** 插件页 → 添加插件 → `dsh-reference-frames`，或在 `~/.dsh/profiles/<profile>/package.json` 里写：

```json
{
  "dependencies": { "dsh-reference-frames": "^1.6.0" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

装好后依赖保存为精确版本，插件详情页的「版本」区块会列出更新的版本，并带 **更新** 按钮。

**从源码安装。** 改为链接本机目录：

```json
{
  "dependencies": { "dsh-reference-frames": "link:/绝对路径/dsh-reference-frames" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

```bash
cd ~/.dsh/profiles/<profile> && pnpm install
```

链接安装不会在插件页显示版本列表 —— 改完 `git pull` 再重启 Harness 即可。

两种情况都要重启 Harness，侧边栏才会出现 **参考帧**。首次使用在齿轮菜单里填入 token。

> `package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client.js` 顶部的 `id` 必须一致，
> 漏掉任何一个插件都会静默不加载。

## 文档

- [使用与维护](GUIDE.zh-CN.md) — 检索、关键词、情绪板、预设、路由、维护
- [更新日志](../CHANGELOG.md)
