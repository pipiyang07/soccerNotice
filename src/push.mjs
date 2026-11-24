// S2/S3 推送主流程：读取赛程快照 → 计算待发提醒 → 发群消息 → 记录已发送
// 环境变量：QQ_APP_ID / QQ_APP_SECRET / QQ_GROUP_OPENIDS（逗号分隔的 group_openid）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { getAccessToken, sendGroupMessage } from './qqbot.mjs'
import { dueNotifications } from './notify.mjs'

const FIXTURES_FILE = 'data/fixtures.json'
const SENT_FILE = 'data/sent.json'
const MAX_SENT_KEYS = 1000 // 控制状态文件体积

const appId = process.env.QQ_APP_ID
const appSecret = process.env.QQ_APP_SECRET
const groupOpenids = (process.env.QQ_GROUP_OPENIDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!appId || !appSecret) {
  console.error('缺少 QQ_APP_ID / QQ_APP_SECRET')
  process.exit(1)
}
if (groupOpenids.length === 0) {
  console.error('缺少 QQ_GROUP_OPENIDS：先让机器人在群里被 @ 一次拿到 group_openid')
  process.exit(1)
}

function loadJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const { fixtures } = loadJson(FIXTURES_FILE, { fixtures: [] })
const sentKeys = new Set(loadJson(SENT_FILE, { sentKeys: [] }).sentKeys ?? [])

const pending = dueNotifications({ fixtures, sentKeys, groupOpenids })
console.log(`待发送 ${pending.length} 条（赛程 ${fixtures.length} 场，已发送记录 ${sentKeys.size} 条）`)

if (pending.length === 0) process.exit(0)

const token = await getAccessToken(appId, appSecret)
let ok = 0
const failures = []

for (const item of pending) {
  try {
    await sendGroupMessage(token, item.group, item.text)
    sentKeys.add(item.sentKey)
    ok += 1
    console.log(`已发送 ${item.type} → ${item.group}：${item.text.split('\n')[0]}`)
    await new Promise((r) => setTimeout(r, 3000)) // 单群 20 qpm 频控，3 秒一条
  } catch (error) {
    failures.push(`${item.sentKey} ${error.message}`)
    console.error(`发送失败 ${item.sentKey} ${error.message}`)
  }
}

mkdirSync('data', { recursive: true })
const kept = [...sentKeys].slice(-MAX_SENT_KEYS)
writeFileSync(SENT_FILE, JSON.stringify({ sentKeys: kept }, null, 2) + '\n')

console.log(`\n成功 ${ok} 条，失败 ${failures.length} 条`)
if (failures.length > 0) process.exitCode = 1