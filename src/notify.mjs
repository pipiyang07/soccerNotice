// 提醒判定与文案生成：纯函数，便于单测
const HOUR = 3600_000

/**
 * 赛前提醒的触发窗口：[提前 24h 前 1 小时, 提前 24h 后 1 小时]
 * 用窗口而非精确时间点，是为了容忍定时任务被平台延迟执行
 */
const DEFAULT_LEAD_HOURS = 24
const DEFAULT_WINDOW_MINUTES = 60
// 只推 24 小时内结束的比赛，避免首次上线时把历史比分一次性刷到群里
const DEFAULT_POST_WINDOW_HOURS = 24

function formatBeijing(iso) {
  return new Date(iso).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function teamLabel(fixture) {
  return `中国${fixture.team === '成年队' ? '' : ' ' + fixture.team}`
}

export function preMatchText(fixture) {
  return [
    `⚽ ${teamLabel(fixture)} 赛前提醒`,
    `${fixture.home} vs ${fixture.away}`,
    `赛事：${fixture.tournament}`,
    `开球：${formatBeijing(fixture.start)}（北京时间）`,
  ].join('\n')
}

export function postMatchText(fixture) {
  return [
    `🏁 ${teamLabel(fixture)} 比赛结束`,
    `${fixture.home} ${fixture.score} ${fixture.away}`,
    `赛事：${fixture.tournament}`,
  ].join('\n')
}

/**
 * 计算当前需要发送的提醒
 * @param {object} params
 * @param {Array} params.fixtures 赛程列表
 * @param {Set<string>} params.sentKeys 已发送过的 sentKey 集合
 * @param {string[]} params.groupOpenids 目标群
 * @param {number} params.now 当前时间戳（毫秒），便于测试注入
 * @returns {Array<{group:string, type:string, sentKey:string, text:string}>}
 */
export function dueNotifications({
  fixtures,
  sentKeys,
  groupOpenids,
  now = Date.now(),
  leadHours = DEFAULT_LEAD_HOURS,
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  postWindowHours = DEFAULT_POST_WINDOW_HOURS,
}) {
  const windowMs = windowMinutes * 60_000
  const startedMs = new Date(fixture.start).getTime()
  const out = []

  for (const fixture of fixtures) {
    let type = null
    let text = ''
    if (fixture.state === 'scheduled') {
      const lead = new Date(fixture.start).getTime() - now
      const target = leadHours * HOUR
      if (lead <= target + windowMs && lead >= target - windowMs) {
        type = 'pre'
        text = preMatchText(fixture)
      }
    } else if (fixture.state === 'finished' && fixture.score) {
      const sinceStart = now - startedMs
      if (sinceStart >= 0 && sinceStart <= postWindowHours * HOUR) {
        type = 'post'
        text = postMatchText(fixture)
      }
    }
    if (!type) continue

    for (const group of groupOpenids) {
      const sentKey = `${fixture.key}:${type}:${group}`
      if (sentKeys.has(sentKey)) continue
      out.push({ group, type, sentKey, text })
    }
  }
  return out
}