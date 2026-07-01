# 🎬 AD SCRAPE — 广告爬取归档工具

主理人/团队扔广告链接 → Claude 自动下载、转录、分析、写进 Notion「广告灵感库」。
支持 **Facebook / Instagram / Google Drive 视频**，以及 **Facebook 图片广告**。

---

## 新同事上手（一次性，约 10 分钟）

### 1. 克隆项目
```bash
git clone <团队仓库地址> "AD SCRAPE"
cd "AD SCRAPE"
```

### 2. 一键安装工具 + 模型
```bash
./setup.sh
```
装 `yt-dlp` / `ffmpeg` / `whisper-cpp`，下载 whisper 模型（1.5GB）。会用到 Homebrew（没有会自动装，要你输一次开机密码）。
> 仅支持 macOS。Apple Silicon 会自动用 Metal GPU 加速（约 8x 实时）。

### 3. 在 Claude Code 里连好连接器
在你自己的 Claude 里连：
- **Notion**（必需）—— 读写共享的「广告灵感库」
- **Google Drive**（要处理 Drive 链接时）
- **图床**（要让图片/封面自动出现在 Notion 时；我们用 Higgsfield MCP。没有就手动拖图，见下）

### 4. Instagram 链接：先在 Chrome 登录 IG
IG reel/帖需要登录。用 **Google Chrome**（不是 Arc/Safari）打开 instagram.com 登录一次即可，脚本会自动读 Chrome 的 cookies。

---

## 怎么用

在本目录打开 Claude Code，直接把广告链接发给它，例如：
```
https://www.facebook.com/ads/library/?id=XXXXXXXX
https://www.instagram.com/reel/XXXXXXXX/
https://drive.google.com/file/d/XXXXXXXX/view
```
Claude 会自动跑完整流程并回一份战报。也可以在 Notion 库里新建行、填好「广告链接」，Claude 会默认跑（`Transcript` 空 + `广告链接` 非空 = 跑）。

Claude 的完整行为定义在 `CLAUDE.md`，详细 SOP 在 `scripts/AD_SCRAPE_SOP.md`。

---

## 手动跑（不经过 Claude，只要转录）
```bash
./scripts/scrape_ad.sh "<视频URL>" "<slug>"
# 产物在 ad_inspiration/<slug>/transcript.txt
```

## 图片进 Notion 的两种方式
- **自动**（配了图床连接器）：Claude 抓图 → 传图床 → 嵌进 Notion 记录正文。
- **手动**（没配图床）：跑完后本地有 `ad_inspiration/<slug>/screenshot.jpg`，在 Notion 那条记录里拖进去即可。

---

## 常见问题
| 现象 | 解 |
|---|---|
| `缺 yt-dlp/ffmpeg/whisper-cli` | 跑 `./setup.sh` |
| IG 报 `You need to log in` / `empty media response` | 用 Chrome 重新登录 IG |
| whisper 中文有音近错字（如「马丁」→「马天」） | 回填后扫一眼专有名词 |
| Google Drive 大文件下不动 | 脚本/Claude 用 `usercontent.google.com/download` 直连 |

## Notion 库
「🎬 广告灵感库」data source ID：`47782b42-4496-8215-b307-87a6acf835bf`（团队共享，同一个库）。
