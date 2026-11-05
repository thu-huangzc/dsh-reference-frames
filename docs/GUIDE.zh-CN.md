# 使用与维护

[English](GUIDE.md) · [简体中文](GUIDE.zh-CN.md)

## 检索

只有一个输入框。可以写一句需求，也可以粘贴 / 拖入 / 选择一张图——面板自己判断：有图按图找相似帧，没图走文字检索。

- **AI检索**（输入框内、搜索按钮左侧的开关）：
  - 开——宿主用默认模型把需求整理成一条英文「单帧画面描述」，可选带上作品名 / 类型 / 每部作品取几张。结果区上方显示实际发出的句子。
  - 关——原样发给上游。
- **中文需求必须开 AI。** FrameThrower 按英文描述匹配，中文只会得到默认结果。关着 AI 输入中文时面板停在「需要 AI检索」，不发请求、不拿默认结果凑数，并提供一键重试。
- **结果永远属于这一次检索。** 每次先清空网格，检索词始终可见；失败时直接说明原因（无 token / 额度 / 限流 / 连不上 / 上游状态码）。
- **浏览更多**追加下一页并去重，「换一批」则是换一组。翻到底显示「没有更多了」；某一页失败会保留按钮并说明原因。

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
| ≈ | 只把**这一张**换成视觉上相似的帧，其他帧不动 |
| ↗ | 在 FrameThrower 打开这一帧 |

点图片进入灯箱：`←` `→` 翻页，`Esc` 关闭，说明行右端有「＋ 加入情绪板」。

## 情绪板

情绪板从空开始，存在本机浏览器。

- 卡片悬停出现：置顶 ↑（置顶排最前）、删除 ×。
- 进入情绪板后，帧上的 ≈ 会在网格上方给出「相似推荐」，点 ＋ 才加入，不点什么都不发生。
- 板头「相似推荐」从板里随机抽 3 帧作为一次多图参考，「换一组」重新抽样。
- 支持重命名、移除帧、导出 Markdown（逐帧描述、色板、deep link）。

## 预设情绪板

`presets/moodboards.json` 是可选的分享用情绪板。

- 用户：文件有内容时，情绪板页会出现「安装作者的情绪板 · N」。同名跳过、id 重新生成；不点则完全不受影响。
- 作者：齿轮菜单 →「保存为插件预设」，写入该文件，默认还会用本机 git 凭据提交并推送。

```yaml
# cordis.patch.yml
config:
  autoPush: true      # false = 只写文件
  pushRemote: origin
  pushBranch: main
```

## Token 与费用

齿轮菜单里粘贴 `ft_…`。token 只存在浏览器 localStorage，随请求头发给本机路由，由宿主转发；不进对话，也不进打包产物。

帧检索约 4 credits，相似帧 2 credits（以图检索 10）。

## 文件与路由

| 文件 | 作用 |
| --- | --- |
| `index.js` | 宿主半：代理 FrameThrower、缓存检索、缓存 24h 画风词表、用默认模型改写需求、读写预设 |
| `client.js` | 浏览器半：面板 UI、AI 开关、情绪板（localStorage） |
| `cordis.patch.yml` | 插件行与配置 |
| `presets/moodboards.json` | 可选的分享情绪板 |
| `styles.json` | 36 条策展画风，暂不参与匹配 |
| `locale/*.json` | 插件管理页显示的标题与描述 |

- `POST /anistyle/interpret` — `{ text }` → `{ source: 'model'|'none', params }`
- `GET /anistyle/vocabulary` — 画风词表（转发并缓存）
- `POST /anistyle/frames` — `{ query, style?, title?, genre?, limit, offset, perTitle }`
- `POST /anistyle/similar` — `{ frameId | frameIds | image, by?, limit }`
- `GET /anistyle/presets` / `POST /anistyle/presets` — 读取 / 写入预设文件
- `GET /anistyle/library`、`GET /anistyle/last` — 旧目录接口与最近一次上游响应（诊断）

## 维护

- 插件目录软链接进 profile，代码只有一份。
- 改 `client.js` 刷新页面；改 `index.js` / `cordis.patch.yml` 要重启应用。
- 语法自检：`node --check client.js && node --check index.js`。
- 改名要同步四处：`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client.js` 的 `id`，以及 profile 里的软链接与登记。
- 发布：改 `package.json` 版本、写 `CHANGELOG.md`、`git tag -a vX.Y.Z`，然后推分支和 tag。
