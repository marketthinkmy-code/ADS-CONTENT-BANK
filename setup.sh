#!/usr/bin/env bash
# ── AD SCRAPE 一键安装（macOS / Apple Silicon 或 Intel）──
# 新同事只需在项目根目录跑一次： ./setup.sh
# 装工具 + 下 whisper 模型 + 建目录。之后打开 Claude Code 即可用。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "项目根目录: $ROOT"

# 1) Homebrew
if ! command -v brew >/dev/null 2>&1; then
  echo "① 没检测到 Homebrew，开始安装（会要你输开机密码）..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
# 把 brew 加进当前 PATH（Apple Silicon / Intel 两种位置都试）
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
echo "① Homebrew: $(brew --version | head -1)"

# 2) 工具
echo "② 安装 yt-dlp / ffmpeg / whisper-cpp ..."
brew install yt-dlp ffmpeg whisper-cpp

# 3) whisper 模型（1.5GB，已存在就跳过）
MODEL="$ROOT/models/ggml-large-v3-turbo.bin"
mkdir -p "$ROOT/models"
if [ -f "$MODEL" ] && [ "$(stat -f%z "$MODEL" 2>/dev/null || echo 0)" -gt 1000000000 ]; then
  echo "③ 模型已存在，跳过下载。"
else
  echo "③ 下载 whisper 模型 large-v3-turbo（约 1.5GB，视网速几分钟）..."
  curl -L -f --retry 3 -o "$MODEL" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"
fi

# 4) 目录
mkdir -p "$ROOT/ad_inspiration"
chmod +x "$ROOT/scripts/scrape_ad.sh" 2>/dev/null || true

echo
echo "✅ 安装完成！自检："
for t in yt-dlp ffmpeg whisper-cli; do
  printf "   %-11s %s\n" "$t" "$(command -v $t || echo '❌ 缺失')"
done
printf "   %-11s %s\n" "model" "$([ -f "$MODEL" ] && echo "$MODEL ($(du -h "$MODEL"|cut -f1))" || echo '❌ 缺失')"
echo
echo "下一步看 README.md：连 Notion / Google Drive 连接器、Chrome 登 IG，然后在本目录打开 Claude Code。"
