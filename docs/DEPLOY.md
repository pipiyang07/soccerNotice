# 部署手册

从零到"群里收到比赛提醒"的完整步骤，含实际踩过的坑。

## 架构现状

```
本机 Mac（住宅 IP）
  └─ launchd 每小时第 20 分
       └─ src/run.mjs
            ├─ src/collect.mjs  抓懂球帝赛程 → data/fixtures.json
            └─ src/push.mjs     判定并推送 → QQ 群，记录 data/sent.json

GitHub Actions（仅探测，不影响主链路）
  └─ probe-collect 每小时跑一次采集，失败即红，用来判断云端是否恢复可达
```

为什么不用云端跑，见 `docs/adr/0004-run-locally-on-mac.md`。

## 0. 前置条件

| 项 | 说明 |
|---|---|
| 一台常开的 Mac | 住宅网络，这是能访问懂球帝的关键 |
| QQ 开放平台账号 | 个人主体即可，实名认证 |
| QQ 群 | 你必须是**群主**（个人主体只能把机器人加进自己管理的群） |
| Node.js | 本项目用 `/opt/homebrew/bin/node`，装 Homebrew 版即可 |

## 1. 创建 QQ 机器人

1. 打开 [q.qq.com](https://q.qq.com)，用 QQ 登录
2. 「机器人」→「创建机器人」，选择个人主体并完成实名
3. 创建后进入机器人详情页，记下 **AppID** 与 **AppSecret**
4. 把机器人**添加进目标群**（移动端扫码添加更稳）

## 2. 配置凭据

`.env` 已在 `.gitignore` 中，不会提交：

```zsh
cd ~/projects/soccerNotice
cat > .env <<'EOF'
QQ_APP_ID=你的AppID
QQ_APP_SECRET=你的AppSecret
QQ_GROUP_OPENIDS=你的group_openid
EOF
```

## 3. 拿到群的 group_openid

`group_openid` 无法手动查询，只能从机器人收到的事件里取。用 WebSocket 短连接获取，**不需要公网服务器**：

```zsh
node --env-file=.env scripts/get-group-openid.mjs
```

脚本启动后到群里 @ 机器人发一条消息，终端会打印：

```
  group_openid: 687BA91DB3F1AE385F8B1AFC4308E911
```

把值填进 `.env` 的 `QQ_GROUP_OPENIDS`（多个群用英文逗号分隔）。

## 4. 授予群权限（最容易漏的一步）

在**手机 QQ** 里：群设置 → 群成员 → 点机器人头像 → 打开

- **「主动推送消息能力」**：允许机器人主动发言（定时推送必需）
- **「接收全量消息能力」**：允许机器人接收群内全部消息（群内命令查询需要）

> 未开启时调用发消息接口会返回 `code 40034105 主动消息失败, 无权限`。
> 这个开关不在开放平台后台，而在手机 QQ 的群机器人资料页里。

## 5. 安装定时任务

```zsh
./scripts/install-launchd.sh          # 安装（每小时第 20 分执行）
./scripts/install-launchd.sh uninstall # 卸载
```

装完即生效，重启、重新登录都自动加载，不需要手动启动任何进程。

确认状态：

```zsh
launchctl list | grep soccernotice    # 第一列是 PID，"-" 表示当前没在跑（正常）
tail -f logs/run.log                  # 实时看每次执行结果
launchctl kickstart -k gui/$(id -u)/com.pipiyang.soccernotice  # 立刻跑一次
```

## 6. 验证

```zsh
# 本地完整跑一次（采集 + 推送）
./scripts/run-once.sh

# 发一条测试消息，验证凭据与群权限
node --env-file=.env scripts/send-test.mjs

# 补推某场比赛（auto 判断赛前/赛后）
npm run replay -- 54463381
```

## 7. 运行行为

| 情况 | 表现 |
|---|---|
| 正常 | 每小时采集一次，命中提醒窗口就发群消息 |
| 采集失败 | 自动退避 1h → 3h → 6h 后重试 |
| 连续失败 3 次 | 往群里发一条告警（同一次故障 12 小时内不重复打扰） |
| Mac 睡眠/关机 | 唤醒后补跑一次；赛前提醒窗口是 ±6 小时，避免漏发 |

状态文件（都在 `.gitignore` 中，只存在本地）：

| 文件 | 内容 |
|---|---|
| `data/fixtures.json` | 已采集的赛程快照（保留最近 7 天的已结束比赛） |
| `data/sent.json` | 已发送记录，用于去重 |
| `data/health.json` | 连续失败次数与下次允许执行时间 |

## 8. 本地调试命令

```zsh
npm test                       # 全部单元测试
npm run collect                # 只采集，不推送
npm run replay -- 54463381     # 手动补推某场比赛
npm run probe-sources          # 检查数据源可达性
node scripts/probe-dongqiudi.mjs # 懂球帝 403 时的对照诊断
```

## 已知坑

| 现象 | 原因 | 解决 |
|---|---|---|
| 采集返回 403，响应体含 `DQD-server` | 当前出口 IP 被懂球帝风控（云服务器 IP 几乎必封） | 换回住宅网络；等待退避结束后自动恢复 |
| `40034105 主动消息失败, 无权限` | 群主未在手机 QQ 开启「主动推送消息能力」 | 见第 4 步 |
| `40034101 机器人非群成员` | 机器人被移出群，或 group_openid 属于别的群 | 重新获取 group_openid |
| `gh variable set NAME "value"` 报 `accepts at most 1 arg(s)` | 变量值要用 `--body` 传入 | `gh variable set NAME --body "value"` |
| Actions 上 collect 每小时失败 | 云 IP 被封，属预期 | 不影响主链路，仅作探测信号 |
| `launchctl` 里无进程 | 定时任务没在跑（未到点） | 用 `launchctl kickstart` 立即触发验证 |
| 改了代码后行为没变 | launchd 每次执行都重新读文件，不需要重载 | 直接 `kickstart` 验证即可 |

## 换机器怎么办

1. 克隆仓库
2. 复制 `data/` 目录（保留 sent.json 才不会重复推送历史提醒）
3. 重建 `.env`
4. 重新执行 `./scripts/install-launchd.sh`
