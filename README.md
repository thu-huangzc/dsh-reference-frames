# 参考帧 / Reference Frames

一个 DeepSeek Harness 插件：**先说感觉 → 检索真实动画参考帧 → 把看中的帧存进情绪板**。
情绪板从空开始，随你的选择逐渐长成一个可复用的方向。

入口：左侧栏「参考帧」图标（整页面板）。

## 工作流

1. **发现**：只有一个输入框。可以直接写中文需求（「雨夜的巨大城市，一个人抬头看天」），
   也可以把一张图**粘贴、拖入或选进来**——面板不问你用文字还是图片，自己判断：
   有图就按图找相似的帧，没图就走文字检索，返回 24 帧真实参考；
   网格底部「浏览更多」追加下一页（去重，「换一批」则是换一组新的）；
   翻到底时按钮位置直接写「没有更多了」，失败则保留按钮并提示原因，不会无声无息。
   开着「AI 理解需求」时，宿主用默认模型把这段描述整理成一条英文的「单帧画面描述」——
   和 FrameThrower 自己的 `search_animation_frames` 工具要求一致（“the scene or character,
   as a description of one frame”），结果区会显示它最终用了什么句子。
   关掉这个开关，英文需求就**原样**丢给上游检索，一个字都不改；中文需求会直接停在
   「需要 AI检索」，**不会**把上游的默认结果当成绩展示——搜不到就是搜不到，按钮一键打开 AI 重搜。
   模型没跑起来时会明确写出原因（没选默认模型 / 超时 / 输出不可用 / 宿主没重启），
   并标注「已按原文检索」——不会静默地假装成功。
   AI 开关就在输入框右下角，搜索图标左边；设置窗口右上角 × 关闭。
3. **结果永远对应当前这次需求**：每次检索先清空旧网格，结果区顶部固定显示
   「检索词 · 实际发出的 query」；失败时显示失败原因（无 token / 额度不足 / 限流 /
   连不上 / 上游 HTTP 码），不会拿上一次的图来占位。
2. **关键词（可选）**：输入框里的「关键词」展开是一排按类别分组的词（年代 / 渲染 / 光线 …）。
   点一下是**把词写进需求里**（不是立刻检索），可以连着点多个；再点一下取消。
   「管理」里可以改词名、删词、加词，也可以**自己建类别**（改名、往类别里加词、删掉整个类别），
   全部存在本机（`anistyle:keywords:v1`）。
3. **挑选**：每帧显示作品 / 年份、画面描述、镜头标签和这张帧自己的色板。
   点 ＋ 打开情绪板选择器：已有情绪板是自适应宽度的标签，点一个就加进去（可连续加进多个），
   已加入的显示 ✓；末尾的黑色 ＋ 点开就地输入名字，回车建板并直接加入。右上角 × 关闭。
   ≈ 用这一帧的图像找相似帧，只替换这一张卡片，网格里其他帧不动；↗ 打开 FrameThrower 原页。
   点图片放大后，说明文字那一行的右端有「＋ 加入情绪板」：在发现页打开选板器，在情绪板里则直接加进当前板，
   加完就地变成绿色的「✓ 已加入」。
   情绪板卡片：悬停右上角出现「置顶 ↑」和「删除 ×」；置顶的板排在最前。
   进入情绪板后，每帧的 ≈ 用它自己的图像检索相似帧；板头的「相似推荐」从板里随机抽 3 帧
   合起来当一次参考（多图取中心）——结果都以「相似参考」给出，挑中的点 ＋ 才加进这个情绪板，
   「换一组」重新抽样，不挑就什么都不发生。
4. **情绪板**：从空板开始，可以重命名、移除帧、导出 Markdown（含逐帧描述、色板、deep link）、
   所有情绪板存在本机浏览器，随时可以继续往里加。

每帧的数据都来自 FrameThrower。官方文档与 OpenAPI 用了两套字段名，宿主都读：
`thumbUrl|thumbnail`、`imageUrl`、`deepLink|url`、`film{title,year}`、
`metadata.sceneDescription|prompt`、`metadata.colors|colorPalette`、`metadata.*` 镜头标签。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：代理 FrameThrower（token 不进浏览器）、缓存检索结果、24h 缓存画风词表、用默认模型把需求整理成一条单帧描述。 |
| `client.js` | 浏览器半：面板 UI、需求→英文检索词、情绪板（localStorage）。 |
| `cordis.patch.yml` | 插件行；`config.apiToken` 可放服务端 token（可选，面板里填的优先）。 |
| `styles.json` | 36 条策展画风目录，**当前不参与匹配**，留作后续「检索预设」素材。 |
| `locale/*.json` | 插件管理页显示的标题与描述。 |

路由：

- `POST /anistyle/interpret` — `{ text }` → `{ source: 'model'|'none', params }`（模型不可用时 `none`，客户端自行回退）
- `GET /anistyle/library` — 画风目录 + `hasToken`
- `GET /anistyle/vocabulary` — 画风词表（转发 + 缓存）
- `POST /anistyle/frames` — `{ query, style?, limit, offset, perTitle }`
- `POST /anistyle/similar` — `{ frameId | frameIds | image, by?, limit }`
- `GET /anistyle/last` — 最近一次上游响应的形状（诊断用）

## Token

面板右上角的齿轮 → 设置，在图片源里粘贴 `ft…` token。密钥存在浏览器 localStorage，
随请求头发给本机路由，由宿主转发给 FrameThrower，不进对话、不进前端包。
设置按「图片源」分区，后续接入别的检索站只需要在 `SOURCES` 里加一条。

一次帧检索约 4 credits，相似帧 2 credits（以图片找 10）。

## 安装

插件目录被软链接进当前 profile，宿主按 `cordis.patch.yml` 挂载：

包名 / 仓库名：**dsh-reference-frames**（插件 id `reference-frames`）。

```
~/.dsh/profiles/<profile>/node_modules/dsh-reference-frames
  → …/default-workspace/anime-style-explorer
```

换一台机器时，把本仓库放到任意目录，然后：

```bash
ln -s /path/to/dsh-reference-frames ~/.dsh/profiles/<profile>/node_modules/dsh-reference-frames
```

重启 Harness 即可；面板入口在「参考帧」标签。`cordis.patch.yml` 会以
`dsh-reference-frames` 这个名字插入插件，所以软链接名必须与 `package.json` 的 `name` 一致。

## 维护

- **唯一源码**就是这个目录，profile 里是软链接，改完立即生效，不存在「两份代码」。
- `client.js`（浏览器半）改完 **刷新页面** 即可；`index.js` / `cordis.patch.yml`（宿主半）需要 **重启应用**。
- 本地自检：`node --check client.js && node --check index.js`，以及 `/tmp/ase` 下的无头渲染脚本
  （输入框、关键词、选板器、灯箱、分页、失败态等逐条断言）。
- 版本号在 `package.json`，`cordis.patch.yml` 里的 `config.apiToken` 建议留空，token 由面板写入浏览器。
