#!/usr/bin/env bash
# 广告爬取脚本 — 视频路径（路径 A）
# 用法: scrape_ad.sh "<URL>" "<slug>"
# 三步: yt-dlp 下视频 → ffmpeg 抽 16kHz mono wav → whisper-cli 转录
#
# 路径自动推导：脚本在 <repo>/scripts/ 下，ROOT 即仓库根目录。
# 换电脑 / 换克隆位置都不用改。
set -euo pipefail

# 让脚本无论从哪调用都能找到 Homebrew 工具
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="$ROOT/models/ggml-large-v3-turbo.bin"

URL="${1:?用法: scrape_ad.sh <URL> <slug>}"
SLUG="${2:?用法: scrape_ad.sh <URL> <slug>}"

# 依赖自检
for t in yt-dlp ffmpeg whisper-cli; do
  command -v "$t" >/dev/null 2>&1 || { echo "❌ 缺 $t，请先跑 ./setup.sh" >&2; exit 3; }
done
[ -f "$MODEL" ] || { echo "❌ 缺 whisper 模型 $MODEL，请先跑 ./setup.sh" >&2; exit 3; }

OUT="$ROOT/ad_inspiration/$SLUG"
mkdir -p "$OUT"

echo "==> [1/3] yt-dlp 下载视频到 $OUT ..."
# 登录受限（IG/部分 FB）自动带 Chrome cookies；公开视频不受影响
yt-dlp --cookies-from-browser chrome \
  -o "$OUT/video.%(ext)s" --write-info-json --merge-output-format mp4 "$URL" \
  || yt-dlp -o "$OUT/video.%(ext)s" --write-info-json --merge-output-format mp4 "$URL"

VIDEO="$OUT/video.mp4"
if [ ! -f "$VIDEO" ]; then
  VIDEO="$(find "$OUT" -maxdepth 1 -name 'video.*' ! -name '*.info.json' | head -1)"
fi
if [ -z "${VIDEO:-}" ] || [ ! -f "$VIDEO" ]; then
  echo "❌ 没找到视频文件。可能是图片帖（走路径 B）或需要登录（走路径 C）。" >&2
  exit 2
fi

echo "==> [2/3] ffmpeg 抽 16kHz mono wav ..."
ffmpeg -y -i "$VIDEO" -ar 16000 -ac 1 -c:a pcm_s16le "$OUT/audio.wav"

echo "==> [3/3] whisper-cli 转录（自动识别中/英/马来）..."
whisper-cli -m "$MODEL" -f "$OUT/audio.wav" -l auto -otxt -of "$OUT/transcript"

echo "✅ 完成: $OUT/transcript.txt"
echo "----- transcript 预览 -----"
head -c 500 "$OUT/transcript.txt" || true
echo
