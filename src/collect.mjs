// S1 采集器：按日期拉取懂球帝赛程，筛出中国国字号比赛后合并落盘
// 运行：node src/collect.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchMatches, bjToday, addDays } from './dongqiudi.mjs'
import { normalizeMatch, mergeFixtures } from './normalize.mjs'

const DATA_FILE = 'data/fixtures.json'
const RETAIN_DAYS = 7 // 已结束的比赛保留天数，够推比分和群内查询即可

// 抓取范围：昨天（补凌晨结束的比赛）至后天（覆盖“提前 24 小时提醒”窗口）
const FUTURE_DAYS = [-1, 0, 1, 2]
// 比分只需要今天和昨天（跨时区补漏）
const RESULT_DAYS = [-1, 0]

function loadPrevious() {
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return { updatedAt: null, fixtures: [] }
  }
}

const today = bjToday()
const t0 = new Date(`${today}T00:00:00+08:00`).getTime()

const previous = loadPrevious()
const keepFrom = new Date(t0 - RETAIN_DAYS * 864e5).toISOString()

const incoming = []
const failed = []
let requests = 0

async function collect(date, tab) {
  requests += 1
  try {
    const matches = await fetchMatches(date, tab)
    const hits = matches.map((m) => normalizeMatch(m)).filter(Boolean)
    incoming.push(...hits)
    console.log(`${date} ${tab.padEnd(8)} 共 ${matches.length} 场，国字号 ${hits.length} 场`)
  } catch (error) {
    failed.push(`${date}/${tab}: ${error.message}`)
    console.error(`${date} ${tab.padEnd(8)} 采集失败 ${error.message}`)
  }
}

for (const offset of FUTURE_DAYS) await collect(addDays(today, offset), 'fixture')
for (const offset of RESULT_DAYS) await collect(addDays(today, offset), 'schedule')

// 全部请求失败说明接口不可达（而非个别日期缺数据），保留旧数据并让流程失败以便告警
if (failed.length === requests) {
  // 记录失败原因，供 run.mjs 写进告警文案
  mkdirSync('data', { recursive: true })
  writeFileSync(
    'data/last-error.json',
    JSON.stringify({ at: new Date().toISOString(), reasons: failed }, null, 2) + '\n',
  )
  console.error(`\n全部 ${requests} 个请求失败，保留原有赛程不覆盖`)
  process.exitCode = 1
} else {
  const fixtures = mergeFixtures(previous.fixtures ?? [], incoming, { keepFrom })
  mkdirSync('data', { recursive: true })
  writeFileSync(
    DATA_FILE,
    JSON.stringify({ updatedAt: new Date().toISOString(), fixtures }, null, 2) + '\n',
  )
  const scheduled = fixtures.filter((f) => f.state === 'scheduled').length
  console.log(
    `\n共 ${fixtures.length} 场（待赛 ${scheduled} 场），失败 ${failed.length}/${requests} 个请求，已写入 ${DATA_FILE}`,
  )
}
