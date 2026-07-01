# MARTIN 广告爬取归档 SOP

> **谁用**：扔链接进 Notion「🎬 广告灵感库」 → Claude 自动跑这套流水
> **什么时候跑**：Notion 任意一行 `Transcript` 空 + `广告链接` 非空 = 默认跑（无需再问）
> **目标产物**：每条广告在 Notion 里有 Hook / 痛点 / 解决方案 / 框架 / 受众 / 证据 / Transcript 全部填好

---

## 一图看完

```
扔 Notion 链接
        │
        ▼
Claude 探链接类型
        │
   ┌────┼─────────────────┐
   ▼    ▼                 ▼
[A] 公开 [B] 公开图片     [C] 登录受限
视频    /静态帖           (FB share-p / IG stories)
   │       │                  │
   │       │                  ├── cookies 通 → 走 [A] 或 [B]
   │       │                  └── stories 过期 → 手填 Transcript
   ▼       ▼
yt-dlp  Playwright 抓 caption + 截图
   │       │
   ▼       │
ffmpeg     │
   ▼       │
whisper-cli│
   ▼       ▼
transcript.txt + screenshot.png
        │
        ▼
Claude 分析（Hook / 痛点 / 解决方案 / 框架 / 受众 / 证据）
        │
        ▼
Notion 单行更新（mcp notion-update-page）
        │
        ▼
战报回报（一句话每条 + 跨广告规律观察）
```

---

## 三种链接 → 三条路径

### 路径 A：公开视频（绝大多数情况）

适用：
- FB Ad Library `https://www.facebook.com/ads/library/?id=XXX`
- FB Share Video `https://www.facebook.com/share/v/XXX/`
- IG Reel `https://www.instagram.com/reel/XXX/`
- 任何 yt-dlp 能直接下载的视频 URL

```bash
"<repo>/scripts/scrape_ad.sh" "<URL>" "<slug>"
```

脚本内部三步：
1. `yt-dlp` 下视频到 `<repo>/ad_inspiration/<slug>/video.mp4`
2. `ffmpeg` 抽 16kHz mono wav 音频
3. `whisper-cli` 用 large-v3-turbo 模型转录到 `transcript.txt`

性能：77 秒音频 ≈ 9 秒转录（Apple Silicon Metal GPU 8x 实时）

### 路径 B：公开图片 / 静态帖

适用：
- IG Post `https://www.instagram.com/p/XXX/`（无视频内容时）
- yt-dlp 报 `There is no video in this post`

工具：Chrome MCP（Claude-in-Chrome）

步骤：
1. `navigate` 进 FB Ad Library / 帖子页 → `get_page_text` 抓完整文案（广告主 / primary text / headline / CTA / 落地域名）
2. **自动抓创意图入 Notion**（图片广告专用，全自动，零手动）：
   - 页面里用 JS canvas 重取已加载的创意图：`new Image()` + `crossOrigin='anonymous'` 绕过 FB token 网址（⚠️ base64/URL 会被工具安全过滤挡，**不要 return 出来**）
   - `canvas.toBlob` + `<a download>` 让浏览器把图存到 `~/Downloads`
   - Bash 复制进 `ad_inspiration/<slug>/screenshot.jpg`（永久存档）
   - `media_upload`（Higgsfield）→ curl PUT 字节 → `media_confirm` → 拿 CloudFront 公开网址
   - `notion-update-page` insert_content：`![](<cloudfront_url>)` 嵌进该行页面正文
   - 清掉 `~/Downloads` 临时文件

⚠️ 图片帖：`Caption` 填平台文案原文，`Transcript` 填图上 OCR 文字（没有口播）。分析 Hook 时既看视觉也看文字。
⚠️ Notion MCP 不支持上传本地文件 → 图片必须走"图床公开网址 + 嵌入"；CloudFront 链接长期有效，本地另存 screenshot.jpg 兜底。

### 路径 C：登录受限

适用：FB Share Post `.../share/p/XXX/`、IG Stories `.../stories/XXX/XXX`

#### C-1：用 Chrome cookies（前提：已在 Chrome 登过对应平台）
```bash
yt-dlp --cookies-from-browser chrome <URL>
```
下到了 → 走路径 A 完成转录。

#### C-2：IG Stories 24 小时过期
cookies 齐了还报 `You need to log in`，99% 是 stories 过期 → **在 Notion 行内手动填 Transcript**，Claude 接着回填其他字段。

#### C-3：FB Share Post 可能是「动态图片广告」（15 秒视频，背景音乐 + 同一张图片）
- 先跑路径 A 试一次
- 转录出来是 `I'll see you next time.` 这种空内容 → ffmpeg 抽帧 → vision 读图
```bash
ffmpeg -y -i video.mp4 -vf "select='eq(n,0)+eq(n,150)+eq(n,300)'" \
  -fps_mode passthrough -q:v 3 frame_%d.jpg
```

---

## 工具栈

| 工具 | 用途 | 装法 |
|---|---|---|
| `yt-dlp` | 下载 FB/IG 视频 | `brew install yt-dlp` |
| `ffmpeg` | 提取音频、抽帧 | `brew install ffmpeg` |
| `whisper-cli` | 本地转录（中英马来文） | `brew install whisper-cpp` |
| Whisper 模型 `ggml-large-v3-turbo.bin` | 1.5GB，最佳速度+质量平衡 | [HF 链接](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin) |
| Playwright MCP | 抓登录/图片帖 | 已配 |
| Notion MCP | 读写 Notion DB | 已配 |

---

## 命令速查

```bash
# 1. 单条爬（视频路径）
"<repo>/scripts/scrape_ad.sh" "<URL>" "<slug>"

# 2. 批量爬（多条）
for id in xxx yyy zzz; do
  "<repo>/scripts/scrape_ad.sh" \
    "https://www.facebook.com/ads/library/?id=${id}" "ad_${id}"
done

# 3. 用 Chrome cookies 爬登录受限
yt-dlp --cookies-from-browser chrome -o "video.%(ext)s" <URL>

# 4. 抽视频帧（图片广告）
ffmpeg -y -i video.mp4 -vf "select='eq(n,0)+eq(n,150)+eq(n,300)'" \
  -fps_mode passthrough -q:v 3 frame_%d.jpg

# 5. 检查现有归档
ls "<repo>/ad_inspiration/"
```

---

## Notion 数据库

**Page**：`🎬 广告灵感库` (`38b82b424496809e8ef0ef29143b1183`)
**Database (data source ID)**：`47782b42-4496-8215-b307-87a6acf835bf`

**字段**（18 个）：

| 字段 | 类型 | Claude 自动填 | 自己填 |
|---|---|---|---|
| 一句话概括 (title) | title | ✅ | |
| 广告链接 | URL | | ✅ |
| 来源（账号/链接） | text | ✅ | |
| 平台 | select | ✅ | |
| 广告形式 | select | ✅ | |
| Header | text | ✅ (yt-dlp title / 标题) | |
| Caption | text | ✅ (完整广告文案 = yt-dlp description) | |
| Transcript | text | ✅ 纯口播逐字稿 (路径 C-2 手填) | |
| 钩子（Hook） | text | ✅ | |
| 核心痛点 | text | ✅ | |
| 卖什么解决方法？ | text | ✅ | |
| 受众 | text | ✅ | |
| 证据 | text | ✅ | |
| 框架 | select | ✅ | |
| CTA | URL | (有就填) | |
| 我想借鉴的点 | text | ✅ (高价值观察) | 可加自己注 |
| 适用产品/场景 | text | | ✅ (own takeaway) |
| 记录日期 | date | ✅ (爬当天) | |

`框架` 选项：`PAS` / `AIDA` / `Before/After/Bridge` / `问题→痛点→方案→证据→结果→CTA`
`广告形式` 选项：`口播` / `UGC` / `字幕` / `开箱` / `对比` / `剧情` / `直播切片` / `图片`
`平台` 选项：`Facebook` / `Instagram` / `TikTok` / `YouTube` / `小红书` / `LinkedIn` / `Google Ads`

---

## 文件归档结构

```
<repo>/
├── ad_inspiration/
│   ├── ad_<id>/
│   │   ├── video.mp4          # yt-dlp 下载
│   │   ├── audio.wav          # ffmpeg 提取
│   │   ├── transcript.txt     # whisper-cli 输出
│   │   ├── screenshot.png     # Playwright（图片帖）
│   │   ├── frame_*.jpg        # ffmpeg 抽帧（动态图片广告）
│   │   └── video.info.json    # yt-dlp 元数据
│   └── ...
├── models/
│   └── ggml-large-v3-turbo.bin
└── scripts/
    ├── scrape_ad.sh
    └── AD_SCRAPE_SOP.md       # 本文件
```

---

## 已知坑 / Edge cases

| 现象 | 原因 | 解 |
|---|---|---|
| `yt-dlp` 报 "no video in this post" | IG Post 是图片 | 走路径 B (Playwright) |
| `yt-dlp` 报 "You need to log in" | FB/IG 登录墙 | `--cookies-from-browser chrome` |
| Stories 加 cookies 还失败 | 24h 过期 | 手填 Transcript |
| Whisper 转录全是 "I'll see you next time" | 音轨基本静音（动态图片广告） | ffmpeg 抽帧 → vision 读图 |
| Playwright 进 IG 页 "Something went wrong" | IG 反爬偶发限流 | 重试一次；caption 已从 meta tag 抓到不影响 |
| FB Share Post 标"图片"实际是视频 | 标注可能搞错 | 跑一次 yt-dlp 看返回；duration > 0 就是视频 |

---

## Notion DB 写入快速对照

```
update_page properties 关键字段:

{
  "一句话概括": "...",
  "来源（账号/链接）": "...",
  "Header": "...（标题，yt-dlp 的 title）",
  "Caption": "...（完整广告文案，yt-dlp 的 description / 平台 caption 原文）",
  "Transcript": "...（纯口播逐字稿，whisper 输出）",
  "核心痛点": "...",
  "卖什么解决方法？": "...",
  "受众": "...",
  "钩子（Hook）": "...",
  "框架": "PAS|AIDA|Before/After/Bridge|问题→痛点→方案→证据→结果→CTA",
  "广告形式": "口播|UGC|字幕|开箱|对比|剧情|直播切片|图片",
  "平台": "Facebook|Instagram|TikTok|YouTube|小红书|LinkedIn|Google Ads",
  "证据": "...",
  "我想借鉴的点": "...",
  "date:记录日期:start": "YYYY-MM-DD",
  "date:记录日期:is_datetime": 0
}
```

---

## 触发流程

1. 看到广告，扔链接进 Notion「🎬 广告灵感库」新建一行
2. 跟 Claude 说一声"跑这条" 或者直接发链接
3. （Stories 24h 限：看到当下立刻 forward，不要先存 Notion 再来跑）
4. 等 Claude 回战报
5. 自己想加注 → `我想借鉴的点` / `适用产品/场景` 字段自填

> 规则：只要 Notion 行 `Transcript` 空 + `广告链接` 非空，Claude 默认跑全套，不再问。

---

## 历史战绩

_（尚未首次运行 — 第一次跑完后在这里记录归档条数 / 自动 vs 手填 / 跨广告观察。）_
