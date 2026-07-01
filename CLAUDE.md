# AD SCRAPE — 广告爬取归档（Claude 项目指令）

> 任何人在本目录打开 Claude Code，Claude 自动按这套流程干活。详细版见 `scripts/AD_SCRAPE_SOP.md`。

## 一句话
主理人/团队扔广告链接（FB / IG / Google Drive 视频）→ Claude 自动：下载 → 转录/OCR → 分析 → 写进 Notion「广告灵感库」→ 回战报。

## 默认触发规则
- 用户直接发链接 = 跑这条。
- Notion 行 `Transcript` 空 + `广告链接` 非空 = 默认跑全套，不再问。

## 三条路径
- **A 公开视频**（FB Ad Library / FB share video / IG Reel / 任意 yt-dlp 可下）：
  `./scripts/scrape_ad.sh "<URL>" "<slug>"` → 得到 `ad_inspiration/<slug>/transcript.txt` + `video.info.json`。
- **B 图片/静态帖**（yt-dlp 报无视频）：Chrome MCP `navigate` + `get_page_text` 抓文案；创意图用 JS canvas（`crossOrigin='anonymous'`）重取 → `<a download>` 存本地 → 复制进 `ad_inspiration/<slug>/screenshot.jpg`。
- **C 登录受限 / Google Drive**：
  - IG 需登录 → 脚本已自动带 `--cookies-from-browser chrome`（前提：本机 Chrome 登了 IG）。
  - Google Drive 视频 → `curl -sL "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t" -o video.mp4` 后走路径 A 的后两步（ffmpeg + whisper）。视频用 ffmpeg 抽关键帧当封面。

## 图片/封面放进 Notion（Notion 接口不能传本地文件）
本地图 → Higgsfield `media_upload` + curl PUT + `media_confirm` 拿 CloudFront 公开网址 → `notion-update-page` insert_content `![](url)`。本地另存 `screenshot.jpg` 兜底。
（没配 Higgsfield 图床的同事：跳过自动嵌图，改为在 Notion 行内手动拖入 `ad_inspiration/<slug>/screenshot.jpg`。）

## Notion 数据库（团队共享）
- Page「🎬 广告灵感库」：`38b82b424496809e8ef0ef29143b1183`
- Data source ID：`47782b42-4496-8215-b307-87a6acf835bf`
- 18 字段：一句话概括(title)/广告链接/来源（账号/链接）/平台/广告形式/Header/Caption/Transcript/钩子（Hook）/核心痛点/卖什么解决方法？/受众/证据/框架/CTA/我想借鉴的点/适用产品/场景/记录日期
- 字段分工：**Header**=标题(yt-dlp title / 图上大标题)；**Caption**=完整广告文案(平台文案原文)；**Transcript**=纯口播逐字稿(whisper) 或 图片帖的图上 OCR 文字。
- `框架` 选项：PAS / AIDA / Before/After/Bridge / 问题→痛点→方案→证据→结果→CTA
- `广告形式` 选项：口播 / UGC / 字幕 / 开箱 / 对比 / 剧情 / 直播切片 / 图片
- `平台` 选项：Facebook / Instagram / TikTok / YouTube / 小红书 / LinkedIn / Google Ads

> 每个人连自己的 Notion 连接器，但都指向上面这个**共享** data source ID（团队同一个库）。若某团队要独立库，改成自己的 ID 即可。

## 写完回战报
每条一句话总结（Hook/痛点/方案/框架）+ 最值得借鉴的点；存够多条时给跨广告规律观察。

## 依赖 / 前置（新机器）
先跑 `./setup.sh`（装 yt-dlp/ffmpeg/whisper-cpp + 下模型）。连接器：Notion（必需）、Google Drive（要处理 Drive 链接时）、Higgsfield 或其他图床（要自动嵌图时）。IG 链接前先在 Chrome 登录 IG。

## 常见坑
- whisper 中文偶有音近错字（如「马丁」→「马天」）→ 回填后扫一眼专有名词。
- IG 报 `empty media response` / `You need to log in` → Chrome 没登 IG 或 session 过期，重登 Chrome。
- Google Drive 大文件 base64 太大 → 用上面的 `usercontent.google.com/download` 直连。
