# 使用与维护

[English](GUIDE.md) · [简体中文](GUIDE.zh-CN.md)

## 检索

只有一个输入框。可以写一句需求，也可以粘贴 / 拖入 / 选择一张图——面板自己判断：文字走帧检索；有图时 FrameThrower 按图找相似帧，网页源开着则先让多模态模型读图、生成网页检索词。

- **AI检索**（输入框内、搜索按钮左侧的开关，两个源都用；只开网页源时也会出现）：
  - 开——宿主用默认模型一次给出两组词：FrameThrower 用的英文「单帧画面描述」（可带作品名 / 类型 / 每部取几张），以及网页图片用的 2-3 条短检索词（关键词而不是句子，可以保留原文语言或官方英文名）。模型会先识别输入语言，再把内容翻译成英文供 FrameThrower 使用；中文、日文、韩文、法文、西班牙文等都可以直接输入。结果区上方按源逐行显示实际发出的词。贴图时会另起一次多模态调用读图（输入的文字作为补充语境）生成网页检索词；FrameThrower 仍然直接拿原图找相似帧。
  - 关——原文直接发给各源：FrameThrower 需要英文，网页图片则是你写的原话。贴图时不会调用模型：网页源改用你输入的文字检索；没有文字时直接说明图片无法转成检索词。
  - 选的是模型的「最低思考档」。如果默认模型是思考型、且 provider 里 `reasoningEfforts.off` 映射为空，它仍会先思考十几秒；把该映射改成 `off: off` 后，生词约 2 秒返回，否则会超时并退回原文。
- **非英文需求和网页以图检索都需要 AI。** FrameThrower 按英文描述匹配；中文、日文、法文等任何非英文原文都会退回默认结果。AI 会先识别输入语言，把语义翻译成英文检索词，同时让网页检索词保持原文语言。网页源要把图片变成检索词，必须有能读图的多模态模型。关着 AI 时面板会直接说明，不发占位请求。
- **结果永远属于这一次检索。** 每次先清空网格，检索词始终可见；失败时直接说明原因（无 token / 额度 / 限流 / 连不上 / 上游状态码）。
- **浏览更多**追加下一页并去重，「换一批」则是换一组。翻到底显示「没有更多了」；某一页失败会保留按钮并说明原因。
- 结果区标题右侧、「换一批」左边有「**清空**」：点一下即可（没有确认框、没有提示），清空当前参考帧、浏览器里保存的结果缓存（刷新也不会恢复），以及宿主侧的检索 / 图片 / 改写缓存，让下一次检索从零开始。清空后结果区留有一段克制的占位提示，中间不会变成一片空白。

## 检索源

「检索源」在输入框工具栏、关键词右侧，点开可以逐个开关；状态存在本机 `anistyle:sources:v1`。设置里只放需要 token 的源，网页源不占设置版面。每次检索只打开发着的源，一个源失败不会挡住另一个源的结果，失败原因会作为一行提示列在结果上方。

- **FrameThrower** — 动画帧库，按英文单帧描述匹配，需要 token；支持相似帧、按图检索、换一批。
- **Chrome 网页图片** — 所有语言都用 DuckDuckGo 图片（Bing 索引），直连 Bing 兜底；不需要 token。开 AI 时用模型给的短检索词，关 AI 或模型失败时退回原文；没有相似帧。贴图时先让多模态模型读图、生成网页检索词再搜；关掉 AI 时图片无法转成检索词，只会拿你输入的文字去搜。这些都是网页端公开结果，属于非官方接口：可能限流、改版失效，图片也可能 404。图片统一经本机 `/anistyle/img` 代理，避免防盗链和混合内容。
- **结果的来源** — 网页帧卡片会标「网页」，↗ 打开原始页面；两种源的卡片交替混排并去重。
- 相似帧（≈）只对 FrameThrower 的帧出现。贴图会同时走两条路：FrameThrower 做视觉相似帧，网页源用多模态模型把图片转成检索词再搜网页图片；两个源都开时结果交替混排。

### 为什么没有 Pinterest

Pinterest 官方 API 的公开关键词搜索只有 `GET /v5/search/partner/pins`，属于 closed beta，只对受邀/申请通过的 partner 开放，且只回前 10 条；`GET /v5/search/pins` 只能搜自己账号的 Pin。接入还要商业账号 + 应用审核（Trial 按天限流、token 24 小时过期）→ Standard access，以及 OAuth 2 授权。同时 Pinterest ToS 明确禁止未经许可的自动化抓取。所以这一版不接 Pinterest；要做只能走「申请 partner + 官方 API」或「用户主动粘贴板链接」。

## 关键词

输入框下方的「关键词」展开是按类别分组的词（年代、渲染、光线……）。

- 点词是**写进需求**，不会触发检索；再点一次取消。
- 管理模式：改词名、删词、加词、改类别名、新建类别、删除类别。内置类别可用「恢复默认」找回。
- 全部存在本机 `anistyle:keywords:v1`。

## 帧

每帧显示作品 / 年份、画面描述、镜头标签和它自己的色板。悬停出现三个按钮：

| 按钮 | 作用 |
| --- | --- |
| ＋ | 打开选板器。点一个板就加入，选板器不会关，可以连续加；末尾的 ＋ 现场输名字新建 |
| ≈ | 只把**这一张**换成视觉上相似的帧，其他帧不动（仅 FrameThrower 帧） |
| ↗ | 打开这一帧所在的来源页 |

点图片进入灯箱：`←` `→` 翻页，`Esc` 关闭，说明行右端有「＋ 加入情绪板」。在图片上点右键或触控板双指点按，会弹出「复制图片」菜单：把当前图转成 PNG 写进系统剪贴板，超过 2400px 会等比缩小；浏览器不支持 Clipboard 图片写入时会明确提示。

## 情绪板

情绪板从空开始，存在本机浏览器。

- 卡片悬停出现：置顶 ↑（置顶排最前）、删除 ×。
- 进入情绪板后，帧上的 ≈ 会在网格上方给出「相似推荐」，点 ＋ 才加入，不点什么都不发生。
- 板头「相似推荐」从板里随机抽 3 帧作为一次多图参考，「换一组」重新抽样。
- 支持重命名、移除帧、导出 Markdown（逐帧描述、色板、deep link）。

## 预设情绪板

`presets/moodboards.json` 是可选的分享用情绪板。

- 用户：文件有内容时，情绪板页会出现「社区情绪板」。同名跳过、id 重新生成；不点则完全不受影响。
- 作者：情绪板页右上角的上传图标（悬停提示「同步至 GitHub」），点击后把当前情绪板写入该文件，默认用本机 git 凭据提交并推送；上传过程中图标变成转圈。

```yaml
# cordis.patch.yml
config:
  autoPush: true      # false = 只写文件
  pushRemote: origin
  pushBranch: main
```

## Token 与费用

齿轮菜单里粘贴 `ft_…`。token 只存在浏览器 localStorage，随请求头发给本机路由，由宿主转发；不进对话，也不进打包产物。token 只影响 FrameThrower 源；网页图片源不需要 token。

帧检索约 4 credits，相似帧 2 credits（以图检索 10）。

## 文件与路由

| 文件 | 作用 |
| --- | --- |
| `index.js` | 宿主半：代理 FrameThrower、网页图片（DuckDuckGo / Bing 兜底）与图片代理、缓存检索、缓存 24h 画风词表、用默认模型改写需求、读图生成网页检索词、读写预设 |
| `client.js` | 浏览器半：面板 UI、检索源开关、AI 开关、情绪板（localStorage） |
| `cordis.patch.yml` | 插件行与配置 |
| `presets/moodboards.json` | 可选的分享情绪板 |
| `locale/*.json` | 插件管理页显示的标题与描述 |

- `POST /anistyle/interpret` — `{ text }` → `{ source: 'model'|'none', params }`
- `POST /anistyle/interpret-image` — `{ image, text?, count? }` → `{ source: 'model'|'none', params: { web } }`（多模态模型；图片会先存入宿主附件库）
- `GET /anistyle/vocabulary` — 画风词表（转发并缓存）
- `POST /anistyle/frames` — `{ query, style?, title?, genre?, limit, offset, perTitle }`
- `POST /anistyle/web` — `{ query, limit, offset }` → `{ source: 'chrome', frames }`（检索市场按查询文本的语种判断）
- `GET /anistyle/img?u=` — 图片代理（同源、带缓存、拒绝内网地址、限制大小与类型）
- `POST /anistyle/similar` — `{ frameId | frameIds | image, by?, limit }`
- `GET /anistyle/presets` / `POST /anistyle/presets` — 读取 / 写入预设文件
- `POST /anistyle/clear-cache` — 清空全部内存缓存（帧 / 网页 / 图片 / 改写 / 画风词表）
- `GET /anistyle/last` — 最近一次上游响应（诊断）

## 维护

- 插件目录软链接进 profile，代码只有一份。
- 改 `client.js` 刷新页面；改 `index.js` / `cordis.patch.yml` 要重启应用。
- 语法自检：`node --check client.js && node --check index.js`。
- 改名要同步四处：`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client.js` 的 `id`，以及 profile 里的软链接与登记。
- 发布：改 `package.json` 版本、写 `CHANGELOG.md`、`git tag -a vX.Y.Z`，然后推分支和 tag。
