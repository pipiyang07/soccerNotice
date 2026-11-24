// S0 探针：用真实 Chromium 验证 SofaScore 赛程接口在无人值守环境下的可达性
// 运行：node scripts/probe.mjs
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const TEAMS = {
  成年队: 4755,
  U23: 49032,
  U20: 22677,
  U19: 22496,
  U17: 468402,
  U16: 1086688,
  U15: 1160196,
}

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
const page = await browser.newPage({ locale: 'zh-CN' })

// 先进站点拿到同源上下文，之后的接口请求才会带上正常的浏览器指纹
await page.goto('https://www.sofascore.com/football/team/china-u23/49032', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
})

const result = await page.evaluate(async (teams) => {
  const out = {}
  for (const [name, id] of Object.entries(teams)) {
    const entry = {}
    for (const kind of ['next', 'last']) {
      const res = await fetch(`/api/v1/team/${id}/events/${kind}/0`, {
        headers: { accept: 'application/json' },
      })
      const ok = (res.headers.get('content-type') || '').includes('json')
      if (res.status === 404) {
        // SofaScore 对“没有该类赛事”直接返回 404，属于正常空结果
        entry[kind] = []
        continue
      }
      if (!res.ok || !ok) {
        entry[kind] = { status: res.status, error: 'not-json-or-forbidden' }
        continue
      }
      const json = await res.json()
      entry[kind] = (json.events || []).map((e) => ({
        id: e.id,
        start: new Date(e.startTimestamp * 1000).toISOString(),
        home: e.homeTeam?.name,
        away: e.awayTeam?.name,
        tournament: e.tournament?.name,
        status: e.status?.type,
        score:
          e.status?.type === 'finished'
            ? `${e.homeScore?.current}-${e.awayScore?.current}`
            : null,
      }))
    }
    out[name] = { id, ...entry }
  }
  return out
}, TEAMS)

await browser.close()

mkdirSync('out', { recursive: true })
const file = `out/probe-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(file, JSON.stringify(result, null, 2))

let total = 0
for (const [name, data] of Object.entries(result)) {
  const next = data.next.length ?? 0
  const last = data.last.length ?? 0
  const bad = data.next.error || data.last.error
  total += next
  console.log(`${name.padEnd(6)} next=${next} last=${last} ${bad ? 'FAIL ' + JSON.stringify(bad) : 'OK'}`)
}
console.log(`\n未来赛事共 ${total} 场，明细写入 ${file}`)