// 诊断脚本：检查候选中文数据源在“无浏览器、纯 HTTP”环境下是否可达
// 云端运行器（GitHub Actions / 云函数）与本地住宅网络的拦截策略不同，必须分别验证
// 运行：node scripts/probe-sources.mjs
const SOURCES = [
  ['足协官网首页', 'https://www.thecfa.cn/'],
  ['足协青少年竞赛库', 'https://www.thecfa.cn/qsnjssjk/index.html'],
  ['懂球帝 API tabs', 'https://api.dongqiudi.com/app/tabs/android/1.json'],
  ['懂球帝网页赛程', 'https://www.dongqiudi.com/match'],
  ['网易彩票 U13 赛程', 'https://sports.163.com/caipiao/league/football/7337'],
  ['雷速首页', 'https://www.leisu.com/'],
  ['维基中文国家队', 'https://zh.wikipedia.org/w/api.php?action=query&format=json&titles=%E4%B8%AD%E5%9B%BD%E5%9B%BD%E5%AE%B6%E8%B6%B3%E7%90%83%E9%98%9F'],
  ['SofaScore 对照组', 'https://api.sofascore.com/api/v1/team/4755/events/next/0'],
]

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const rows = []
for (const [name, url] of SOURCES) {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/json,*/*' },
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
    })
    const body = await res.text()
    rows.push({
      name,
      status: res.status,
      bytes: body.length,
      ms: Date.now() - started,
      type: (res.headers.get('content-type') || '').split(';')[0],
      // 出现这些字样说明是验证/挑战页而不是真实内容
      challenge: /captcha|Just a moment|安全验证|滑动验证|aliyunFP/i.test(body.slice(0, 4000)),
      head: body.replace(/\s+/g, ' ').slice(0, 80),
    })
  } catch (error) {
    rows.push({ name, status: 'ERR', bytes: 0, ms: Date.now() - started, error: error.message })
  }
}

for (const r of rows) {
  console.log(
    `${String(r.status).padEnd(4)} ${String(r.bytes).padStart(7)}B ${String(r.ms).padStart(6)}ms ${r.name}` +
      (r.challenge ? '  [疑似验证页]' : '') +
      (r.error ? `  ${r.error}` : ''),
  )
}
