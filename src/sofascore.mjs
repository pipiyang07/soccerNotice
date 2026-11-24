// SofaScore 抓取封装：真实浏览器打开站点拿到同源上下文，再在页面内请求接口
// 纯 HTTP 客户端会被 Cloudflare 按 TLS 指纹拦截（403），因此必须走浏览器
import { chromium } from 'playwright'

export const TEAMS = {
  成年队: 4755,
  U23: 49032,
  U20: 22677,
  U19: 22496,
  U17: 468402,
  U16: 1086688,
  U15: 1160196,
}

/** 打开浏览器并回调，回调结束后自动关闭 */
export async function withSofaPage(fn) {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  })
  try {
    const page = await browser.newPage({ locale: 'zh-CN' })
    await page.goto('https://www.sofascore.com/football/team/china-u23/49032', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    return await fn(page)
  } finally {
    await browser.close()
  }
}

/** 取某支队伍的未来赛事（next）与最近赛事（last） */
export async function fetchTeamEvents(page, teamId, { lastLimit = 5 } = {}) {
  return page.evaluate(
    async ({ teamId, lastLimit }) => {
      async function get(kind) {
        const res = await fetch(`/api/v1/team/${teamId}/events/${kind}/0`, {
          headers: { accept: 'application/json' },
        })
        // 没有该类赛事时 SofaScore 返回 404，视为空结果
        if (res.status === 404) return []
        if (!res.ok) throw new Error(`${kind} HTTP ${res.status}`)
        const json = await res.json()
        return json.events || []
      }
      const next = await get('next')
      const last = await get('last')
      // last 按时间升序返回，取末尾若干场即为最近的比赛
      return { next, last: last.slice(-lastLimit) }
    },
    { teamId, lastLimit },
  )
}
