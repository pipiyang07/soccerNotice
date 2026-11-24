# 2. 用 GitHub Actions + Playwright 抓 SofaScore，而非付费 API

- **Status**: Accepted
- **Context**:
  SofaScore 对中国七支国字号队伍的覆盖最好（实测可拿到成年队 2027 亚洲杯小组赛、U17 世界杯、
  U19/U20/U15 友谊赛），但它是非官方接口，站点在 Cloudflare 后面，按 TLS 指纹拦截非浏览器客户端：
  实测 `curl`（完整 Chrome 头）与 `node fetch` 访问 `api.sofascore.com` 均返回 403。
  Serverless 的常见形态（云函数、Workers 的普通 fetch）因此拿不到数据。
  官方 API 中，`api-football` 的端点可直接 HTTP 调用（实测返回 JSON 错误而非挑战页），
  但它对中国青年队的**临时友谊赛**覆盖不确定，且需每月 $19。
- **Decision**:
  主数据源 = SofaScore；运行方式 = GitHub Actions 定时任务 + Playwright 启动真实 Chromium 抓取。
  付费 API 暂不引入，作为备选保留。抓取与解析逻辑独立成模块，便于日后替换数据源。
- **Consequences**:
  - 更易：零成本，覆盖最全，可拿到国内媒体不一定报道的青年队热身赛。
  - 更难：Playwright 单次运行约 1 分钟，免费额度（私有仓库 2000 分钟/月）只支持约每小时一次轮询，
    因此"开赛瞬间推送"不可行，只保留赛前约 24 小时提醒与赛后比分。
  - 更难：Actions 的 cron 在整点高峰会延迟 5–30 分钟，提醒逻辑必须按"时间窗口"判定，
    而不是"恰好到点"。
  - 更难：仓库 60 天无活动会停用定时任务，需靠每次运行回写状态文件保持活跃。
  - 风险：GitHub 运行器 IP 段的信誉可能被 Cloudflare 降级导致抓取失败，上线前必须做可行性验证（见 S0）。