// 本地运行编排：采集 → 推送，带失败退避与连续失败告警
// 用法：node --env-file=.env src/run.mjs（由 scripts/run-once.sh 调用）
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { getAccessToken, sendGroupMessage } from './qqbot.mjs'
import { alertText } from './notify.mjs'

const HEALTH_FILE = 'data/health.json'
const BACKOFF_HOURS = [1, 3, 6] // 连续失败后的重试间隔，超出则一直用最后一个
const ALERT_THRESHOLD = 3 // 连续失败多少次开始告警
const ALERT_COOLDOWN_HOURS = 12 // 同一次故障最多每 12 小时提醒一次
const HOUR = 3600_000

function loadHealth() {
  try {
    return JSON.parse(readFileSync(HEALTH_FILE, 'utf8'))
  } catch {
    return { consecutiveFailures: 0, nextAllowedAt: null }
  }
}

function loadLastError() {
  try {
    const { reasons } = JSON.parse(readFileSync('data/last-error.json', 'utf8'))
    return Array.isArray(reasons) && reasons.length > 0 ? reasons[0] : null
  } catch {
    return null
  }
}

function saveHealth(health) {
  mkdirSync('data', { recursive: true })
  writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2) + '\n')
}

async function alert(failures, health, backoffHours) {
  const appId = process.env.QQ_APP_ID
  const appSecret = process.env.QQ_APP_SECRET
  const groups = (process.env.QQ_GROUP_OPENIDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!appId || !appSecret || groups.length === 0) {
    console.error('缺少凭据，跳过群告警')
    return
  }

  const text = alertText({
    failures,
    lastSuccessAt: health.lastSuccessAt,
    lastError: loadLastError(),
    backoffHours,
  })

  try {
    const token = await getAccessToken(appId, appSecret)
    for (const group of groups) {
      await sendGroupMessage(token, group, text)
    }
    console.log('已发送群告警')
  } catch (error) {
    console.error(`群告警发送失败：${error.message}`)
  }
}

const health = loadHealth()
const now = Date.now()

if (health.nextAllowedAt && now < Date.parse(health.nextAllowedAt)) {
  console.log(
    `退避中：${new Date(health.nextAllowedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} 之后才重试` +
      `（连续失败 ${health.consecutiveFailures} 次）`,
  )
  process.exit(0)
}

const collect = spawnSync(process.execPath, ['src/collect.mjs'], { stdio: 'inherit' })

if (collect.status !== 0) {
  const failures = (health.consecutiveFailures ?? 0) + 1
  const backoff = BACKOFF_HOURS[Math.min(failures - 1, BACKOFF_HOURS.length - 1)]
  health.consecutiveFailures = failures
  health.lastFailureAt = new Date(now).toISOString()
  health.nextAllowedAt = new Date(now + backoff * HOUR).toISOString()

  if (failures >= ALERT_THRESHOLD) {
    const lastAlert = health.alertedAt ? Date.parse(health.alertedAt) : 0
    if (now - lastAlert > ALERT_COOLDOWN_HOURS * HOUR) {
      await alert(failures, health, backoff)
      health.alertedAt = new Date(now).toISOString()
    }
  }

  saveHealth(health)
  console.error(`采集失败（连续 ${failures} 次），${backoff} 小时后重试`)
  process.exit(1)
}

health.consecutiveFailures = 0
health.nextAllowedAt = null
health.lastSuccessAt = new Date(now).toISOString()
health.alertedAt = null
saveHealth(health)

const push = spawnSync(process.execPath, ['src/push.mjs'], { stdio: 'inherit' })
process.exit(push.status ?? 0)