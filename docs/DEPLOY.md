# 部署手册

从零到"群里收到比赛提醒"的完整步骤，含实际踩过的坑。

## 0. 前置条件

| 项 | 说明 |
|---|---|
| GitHub 仓库 | 公开仓库（Actions 分钟数不限制），本项目为 `pipiyang07/soccerNotice` |
| QQ 开放平台账号 | 个人主体即可，实名认证 |
| QQ 群 | 你必须是**群主**（个人主体只能把机器人加进自己管理的群） |
| 一台能扫码登录 QQ 的手机 | 用于给机器人授权群权限 |

## 1. 创建 QQ 机器人

1. 打开 [q.qq.com](https://q.qq.com)，用 QQ 登录
2. 「机器人」→「创建机器人」，选择个人主体并完成实名
3. 创建后进入机器人详情页，记下 **AppID** 与 **AppSecret**
4. 把机器人**添加进目标群**（移动端扫码添加更稳）

## 2. 配置凭据

本地开发（`.env` 已在 `.gitignore` 中，不会提交）：

```zsh
cd ~/projects/soccerNotice
cat > .env <<'EOF'
QQ_APP_ID=你的AppID
QQ_APP_SECRET=你的AppSecret
EOF
```

仓库端（Actions 使用）：

```zsh
gh secret set QQ_APP_ID --body "你的AppID" --repo <owner>/soccerNotice
gh secret set QQ_APP_SECRET --body "你的AppSecret" --repo <owner>/soccerNotice
```

## 3. 拿到群的 group_openid

`group_openid` 无法手动查询，只能从机器人收到的事件里取。本项目用 WebSocket 短连接获取，**不需要公网服务器**：

```zsh
node --env-file=.env scripts/get-group-openid.mjs
```

脚本启动后，到群里 @ 机器人发一条消息，终端会打印：

```
  group_openid: 687BA91DB3F1AE385F8B1AFC4308E911
```

## 4. 授予群权限（这一步最容易漏）

在**手机 QQ** 里：群设置 → 群成员 → 点机器人头像 → 打开

- **「主动推送消息能力」**：允许机器人主动发言（定时推送必需）
- **「接收全量消息能力」**：允许机器人接收群内全部消息（群内命令查询需要）

> 未开启时调用发消息接口会返回 `code 40034105 主动消息失败, 无权限`。
> 这个开关不在开放平台后台，而在手机 QQ 的群机器人资料页里。

## 5. 配置群变量

```zsh
gh variable set QQ_GROUP_OPENIDS --body "687BA91DB3F1AE385F8B1AFC4308E911" --repo <owner>/soccerNotice
```

多个群用英文逗号分隔。

## 6. 验证

```zsh
# 本地验证凭据与群权限
QQ_GROUP_OPENIDS=你的group_openid node --env-file=.env scripts/send-test.mjs

# 云端验证推送链路（无待发提醒时会输出 0 条并正常退出）
gh workflow run push --repo <owner>/soccerNotice
```

## 7. 定时任务

仓库内已有两个 workflow，无需额外配置：

| workflow | 时间 | 作用 |
|---|---|---|
| `collect.yml` | 每小时第 17 分 | 抓懂球帝赛程，回写 `data/fixtures.json` |
| `push.yml` | 每小时第 22 分 | 计算待发提醒，发群消息，回写 `data/sent.json` |

两个 workflow 都会把数据文件提交回仓库，因此仓库始终保持活跃，不会被 Actions 因"60 天无活动"停用。

## 8. 本地调试命令

```zsh
npm test                      # 全部单元测试
npm run collect               # 手动采集一次赛程
node scripts/probe-sources.mjs # 检查数据源可达性（含云端差异）
```

## 已知坑

| 现象 | 原因 | 解决 |
|---|---|---|
| `40034105 主动消息失败, 无权限` | 群主未在手机 QQ 开启「主动推送消息能力」 | 见第 4 步 |
| `40034101 机器人非群成员` | 机器人被移出群，或 group_openid 属于别的群 | 重新获取 group_openid |
| `gh variable set NAME "value"` 报 `accepts at most 1 arg(s)` | 变量值要用 `--body` 传入 | `gh variable set NAME --body "value"` |
| SofaScore 在 Actions 上 403 / 跳 captcha | 云 IP 段被 Cloudflare 拦截 | 已改用懂球帝，见 ADR 0003 |
| 懂球帝远期赛程查不到 | 接口只提供临近日期的赛程 | 属已知限制，提醒依赖"赛前 1–2 天发现" |