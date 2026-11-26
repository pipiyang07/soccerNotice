#!/bin/zsh
# 本地一次完整运行：采集 → 推送（含失败退避与告警）
# 由 launchd 每小时调用，也可手动执行
set -euo pipefail

cd "$(dirname "$0")/.."
NODE=/opt/homebrew/bin/node

if [[ ! -f .env ]]; then
  echo "缺少 .env，请先配置 QQ_APP_ID / QQ_APP_SECRET / QQ_GROUP_OPENIDS" >&2
  exit 1
fi

echo "=== $(date '+%Y-%m-%d %H:%M:%S') 运行开始 ==="
"$NODE" --env-file=.env src/run.mjs
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 运行结束 ==="