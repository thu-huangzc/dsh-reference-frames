# 使用与维护

## 界面

### 发现

只有一个输入框。可以直接写中文（「雨夜的巨大城市，一个人抬头看天」），也可以把一张图
**粘贴、拖入或选进来**——面板不问你用文字还是图片，自己判断：有图就按图找相似的帧，
没图就走文字检索。

- **AI检索**（输入框右下角，搜索图标左侧的蓝色开关）：开着时，宿主用默认模型把需求整理成
  一条英文的「单帧画面描述」——和 FrameThrower 自己的 `search_animation_frames` 工具要求一致
  （“the scene or character, as a description of one frame”），结果区会显示最终用了什么句子。
  关掉时英文需求**原样**发给上游，一个字都不改。
- **中文需求必须开 AI**：上游按英文描述匹配，中文原文只会让它返回默认结果。所以关着 AI 输入中文，
  面板直接停在「需要 AI检索」，不发请求、不展示默认结果，并提供一键打开 AI 重搜。
- **结果永远对应当前这次需求**：每次检索先清空旧网格，顶部固定显示「检索词 · 实际发出的 query」；
  失败时写明原因（无 token / 额度不足 / 限流 / 连不上 / 上游 HTTP 码）。模型没跑起来也会写明
  （没有默认模型 / 超时 / 输出不可用 / 宿主没重启），并标注「已按原文检索」。
- **浏览更多**：网格底部追加下一页并去重；「换一批」是换一组新的。翻到底写「没有更多了」，
  失败则保留按钮并提示原因。

### 关键词（可选）

输入框里的「关键词」展开是一排按类别分组的词（年代 / 渲染 / 光线 …）。点一下是**把词写进需求里**
（不是立刻检索），可以连着点多个，再点一下取消。「管理」里能改词名、删词、加词，也能自己建类别
（改名、加词、删类别，内置类别可删可恢复）。全部存在本机 `anistyle:keywords:v1`。

### 帧与情绪板

每帧显示作品 / 年份、画面描述、镜头标签和它自己的色板。悬停卡片右上角有三个按钮：

| 按钮 | 行为 |
| --- | --- |
| ＋ | 打开选板器：已有情绪板是自适应宽度的标签，点一个就加进去（可连续加多块），已加入显示 ✓；末尾黑色 ＋ 就地输入名字，回车建板并直接加入 |
| ≈ | 用这一帧的图像找相似帧，**只替换这一张卡片**，网格其他帧不动 |
| ↗ | 打开 FrameThrower 原页 |

点图片放大后，说明行的右端有「＋ 加入情绪板」：在发现页打开选板器，在情绪板里则直接加进当前板，
加完变成绿色的「✓ 已加入」。

情绪板卡片：悬停右上角出现「置顶 ↑」和「删除 ×」，置顶的排最前。进入情绪板后：

- 每帧的 ≈ 用它自己的图像检索，结果以顶部的「相似推荐」横条给出；点 ＋ 才加进当前板，不点什么都不变
- 板头「相似推荐」从板里**随机抽 3 帧**合起来当一次参考（多图取中心），「换一组」重新抽样
- 支持重命名、移除帧、导出 Markdown（含逐帧描述、色板、deep link）

每帧的数据都来自 FrameThrower。官方文档与 OpenAPI 用了两套字段名，宿主都读：
`thumbUrl|thumbnail`、`imageUrl`、`deepLink|url`、`film{title,year}`、
`metadata.sceneDescription|prompt`、`metadata.colors|colorPalette`、`metadata.*` 镜头标签。

## 预设情绪板（可选）

仓库里可以带一份作者的情绪板：`presets/moodboards.json`。装了插件的人在「情绪板」页会看到一个
**「安装作者的情绪板 · N」** 按钮，点了才会合并进自己本机，同名的不重复加、id 会重新生成；
不点就完全不受影响。文件缺失或为空时按钮不出现。

作者这边：设置（右上角齿轮）→「保存为插件预设」，会把当前本机情绪板写进
`presets/moodboards.json`，随后 `git commit && git push` 即可分享。

## Token 与费用

面板右上角齿轮 → 设置，粘贴 `ft…` token。密钥只存在浏览器 localStorage，随请求头发给本机路由，
由宿主转发给 FrameThrower，不进对话、不进前端包。设置按「图片源」分区，以后接别的检索站
只需要在 `SOURCES` 里加一条。

一次帧检索约 4 credits，相似帧 2 credits（以图片找 10）。

## 代码结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：代理 FrameThrower（token 不进浏览器）、缓存检索结果、24h 缓存画风词表、用默认模型把需求整理成单帧描述 |
| `client.js` | 浏览器半：面板 UI、AI 开关、情绪板（localStorage） |
| `cordis.patch.yml` | 插件行；`config.apiToken` 可放服务端 token（可选，面板里填的优先） |
| `presets/moodboards.json` | 可选分享的情绪板预设 |
| `styles.json` | 36 条策展画风目录，**当前不参与匹配**，留作后续「检索预设」素材 |
| `locale/*.json` | 插件管理页显示的标题与描述 |

路由：

- `POST /anistyle/interpret` — `{ text }` → `{ source: 'model'|'none', params }`（模型不可用时 `none`，客户端自行回退）
- `GET /anistyle/library` — 画风目录 + `hasToken`
- `GET /anistyle/vocabulary` — 画风词表（转发 + 缓存）
- `POST /anistyle/frames` — `{ query, style?, limit, offset, perTitle }`
- `POST /anistyle/similar` — `{ frameId | frameIds | image, by?, limit }`
- `GET /anistyle/last` — 最近一次上游响应的形状（诊断用）
- `GET /anistyle/presets` — 读取 `presets/moodboards.json`
- `POST /anistyle/presets` — `{ boards }` 写回同一文件（作者导出用）

## 维护

- **唯一源码**就是这个仓库，profile 里是软链接，改完立即生效，不存在「两份代码」。
- `client.js`（浏览器半）改完**刷新页面**；`index.js` / `cordis.patch.yml`（宿主半）需要**重启应用**。
- 自检：`node --check client.js && node --check index.js`。
- **改名要同步四处**：`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client.js` 顶部的 `id`，
  以及 profile 里的软链接名 / `package.json` / `bundles`。漏掉任何一处，插件会静默消失。
- 版本号在 `package.json`；`cordis.patch.yml` 里的 `config.apiToken` 建议留空，token 由面板写入浏览器。
- 发布：`git push`；仓库不含任何密钥（token 只在浏览器）。
