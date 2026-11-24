// 手动补推：把指定比赛的提醒立刻发到群里（用于验证或补漏）
// 用法：node --env-file=.env scripts/replay-notify.mjs <比赛ID> [pre|post]
// 比赛ID 可以是 data/fixtures.json 里的 id（如 54463381）或完整 key（dongqiudi:54463381）
import { readFileSync, writeFileSync } from 'node:fs'
import { getAccessToken, sendGroupMessage } from '../src/qqbot.mjs'
import { preMatchText, postMatchText } from '../src/notify.mjs'

const [target, typeArg] = process.argv.slice(2)
if (!target) {
  console.error('用法：node --env-file=.env scripts/replay-notify.mjs <比赛ID> [pre|post]')
  process.exit(1)
}

const groupOpenids = (process.env.QQ_GROUP_OPENIDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (!process.env.QQ_APP_ID || !process.env.QQ_APP_SECRET || groupOpenids.length === 0) {
  console.error('需要 QQ_APP_ID / QQ_APP_SECRET / QQ_GROUP_OPENIDS')
  process.exit(1)
}

const load = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const { fixtures } = load('data/fixtures.json', { fixtures: [] })
const fixture = fixtures.find((f) => f.id === target || f.key === target)
if (!fixture) {
  console.error(`未找到比赛 ${target}，可用 ID 见 data/fixtures.json`)
  process.exit(1)
}

const type = typeArg ?? (fixture.state === 'finished' ? 'post' : 'pre')
const text = type === 'post' ? postMatchText(fixture) : preMatchText(fixture)

const token = await getAccessToken(process.env.QQ_APP_ID, process.env.QQ_APP_SECRET)
const sentKeys = new Set(load('data/sent.json', { sentKeys: [] }).sentKeys ?? [])

for (const group of groupOpenids) {
  await sendGroupMessage(token, group, text)
  sentKeys.add(`${fixture.key}:${type}:${group}`)
  console.log(`已推送到 ${group}：`)
  console.log(text)
}

writeFileSync(
  'data/sent.json',
  JSON.stringify({ sentKeys: [...sentKeys].slice(-1000) }, null, 2) + '\n',
)