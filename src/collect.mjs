// S1 采集器：抓取七支国字号队伍的赛程，归一化合并后落盘 data/fixtures.json
// 运行：node src/collect.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { TEAMS, withSofaPage, fetchTeamEvents } from './sofascore.mjs'
import { normalizeEvent, mergeFixtures } from './normalize.mjs'

const DATA_FILE = 'data/fixtures.json'
const RETAIN_DAYS = 7 // 已结束的比赛保留天数，够推比分和群内查询即可

function loadPrevious() {
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return { updatedAt: null, fixtures: [] }
  }
}

const previous = loadPrevious()
const keepFrom = new Date(Date.now() - RETAIN_DAYS * 864e5).toISOString()

const incoming = []
const failed = []

await withSofaPage(async (page) => {
  for (const [team, id] of Object.entries(TEAMS)) {
    try {
      const { next, last } = await fetchTeamEvents(page, id)
      for (const event of [...next, ...last]) {
        incoming.push(normalizeEvent(event, team))
      }
      console.log(`${team.padEnd(4)} 新增/更新 ${next.length + last.length} 场`)
    } catch (error) {
      failed.push(`${team}: ${error.message}`)
      console.error(`${team.padEnd(4)} 采集失败 ${error.message}`)
    }
  }
})

// 全部失败说明是数据源不可达（而非个别队伍缺数据），保留旧数据并让流程失败以便告警
if (failed.length === Object.keys(TEAMS).length) {
  console.error(`\n全部 ${failed.length} 支队伍采集失败，保留原有赛程不覆盖`)
  process.exitCode = 1
} else {
  const fixtures = mergeFixtures(previous.fixtures ?? [], incoming, { keepFrom })
  mkdirSync('data', { recursive: true })
  writeFileSync(
    DATA_FILE,
    JSON.stringify({ updatedAt: new Date().toISOString(), fixtures }, null, 2) + '\n',
  )
  const upcoming = fixtures.filter((f) => f.state === 'scheduled').length
  console.log(`\n共 ${fixtures.length} 场（待赛 ${upcoming} 场），失败 ${failed.length} 支，已写入 ${DATA_FILE}`)
}