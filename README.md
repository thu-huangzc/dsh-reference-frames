# 【DSH Plugin】Reference Frames

描述想要的感觉，从真实动画里找出对味的参考帧，把看中的存进情绪板。

## 安装

前提：
* DeepSeek Harness
* [FrameThrower](https://framethrower.ai) token

```bash
git clone git@github.com:thu-huangzc/dsh-reference-frames.git
ln -s "$PWD/dsh-reference-frames" ~/.dsh/profiles/<profile>/node_modules/dsh-reference-frames
```

更新 profile，编辑 `~/.dsh/profiles/<profile>/package.json`：

```json
{
  "dependencies": { "dsh-reference-frames": "link:/绝对路径/dsh-reference-frames" },
  "dsh": { "profile": { "bundles": ["…", "dsh-reference-frames"] } }
}
```

重启 Harness，左侧栏出现「参考帧」；首次使用点右上角齿轮填入 token。

> 软链接名、`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client.js` 顶部的 `id`
> 必须一致，四者缺一插件都不会出现。

使用说明、代码结构、路由与维护方式见 **[docs/GUIDE.md](docs/GUIDE.md)**。
