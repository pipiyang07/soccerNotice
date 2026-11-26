#!/bin/zsh
# 安装 launchd 定时任务：每小时第 20 分执行一次采集 + 推送
# 卸载：./scripts/install-launchd.sh uninstall
set -euo pipefail

LABEL=com.pipiyang.soccernotice
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [[ "${1:-install}" == "uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "已卸载 $LABEL"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/logs"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$PROJECT_DIR" &amp;&amp; ./scripts/run-once.sh &gt;&gt; logs/run.log 2&gt;&amp;1</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Minute</key>
      <integer>20</integer>
    </dict>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>$PROJECT_DIR/logs/launchd.err.log</string>
</dict>
</plist>
PLIST_EOF

# 已加载则先卸载，避免重复加载报错
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "已安装 $LABEL"
echo "  执行时间：每小时第 20 分（Mac 休眠错过的会在唤醒后补跑一次）"
echo "  日志文件：$PROJECT_DIR/logs/run.log"
echo "  立即试跑：launchctl kickstart -k gui/$(id -u)/$LABEL"