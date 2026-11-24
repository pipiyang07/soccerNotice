# 3. 改用懂球帝赛程接口作为主数据源

- **Status**: Accepted
- **Context**:
  ADR 0002 选择了 SofaScore + GitHub Actions + Playwright。S0 验证结果推翻了它：
  GitHub Actions 运行器访问 sofascore 时被直接重定向到 `captcha.html`，七支队伍全部返回 403；
  本地住宅 IP 虽然能抓到，但连续约 30 次请求后触发 IP 限流，10 分钟内不恢复。
  也就是说 "零成本 + Serverless + SofaScore" 三者不可兼得。
  随后实测候选中文源在 Actions 运行器上全部可达（HTTP 200，无验证页）：
  中国足协官网、懂球帝、网易彩票、雷速、维基百科。
  其中懂球帝的赛程接口 `www.dongqiudi.com/magicball/v1/list/schedule_list` 表现最好：
  纯 HTTP 可调用、按日期返回当日全部足球赛事、字段齐全（比赛 ID、赛事名、开始时间戳、
  双方队名与比分、状态 Fixture/Played），并且实测覆盖 `中国`、`中国U19`、`中国U17`、
  `中国U15` 以及"中国之队邀请赛""熊猫杯"等友谊赛。
- **Decision**:
  主数据源改为懂球帝赛程接口，运行环境保持 GitHub Actions（纯 HTTP，无需浏览器）。
  `tab_type=fixture` 取未来赛程，`tab_type=schedule` 取已完赛比分。
- **Consequences**:
  - 更易：零成本，无需浏览器与代理，Actions 单次运行从 90 秒降到约 10 秒。
  - 更易：赛程与比分来自同一接口同一套 ID，去重和状态更新都简单。
  - 更难：懂球帝是非公开接口，字段可能随时调整，需要保留字段缺失时的容忍与告警。
  - 更难：远期赛程覆盖不全（实测 2027 年 1 月亚洲杯小组赛未录入），
    因此推送只能依赖"提前 1–2 天发现"，不能依赖赛季初的完整赛历。
  - 替代/兜底：中国足协官网（权威公告）、网易彩票（国内青少年赛事）留作补充源，
    维基百科可用于核对正式赛事日程。
