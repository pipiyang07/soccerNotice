// 懂球帝赛程接口客户端
// 接口：GET /magicball/v1/list/schedule_list?tab_type=fixture|schedule&start=YYYY-MM-DD HH:mm:ss
// start 是「北京时间当天 00:00」对应的 UTC 时间字符串（即前一天 16:00:00）
const BASE = 'https://www.dongqiudi.com/magicball/v1/list/schedule_list'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * 把北京时间日期转成接口要求的 start 参数
 * @param {string} bjDate YYYY-MM-DD
 */
export function startParam(bjDate) {
  const utcMs = Date.parse(`${bjDate}T00:00:00+08:00`)
  if (Number.isNaN(utcMs)) throw new Error(`非法日期: ${bjDate}`)
  return new Date(utcMs).toISOString().slice(0, 19).replace('T', ' ')
}

/** 北京时间的今天（YYYY-MM-DD） */
export function bjToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
}

/** 北京时间日期加减天数 */
export function addDays(bjDate, days) {
  const base = Date.parse(`${bjDate}T00:00:00+08:00`)
  return new Date(base + days * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
}

/**
 * 拉取某一天的比赛列表
 * @param {string} bjDate YYYY-MM-DD（北京时间）
 * @param {'fixture'|'schedule'} tab fixture=未开赛及未来，schedule=已开赛/完赛
 */
export async function fetchMatches(bjDate, tab) {
  const url = `${BASE}?language=zh-CN&tab_type=${tab}&cmp_type=soccer&start=${encodeURIComponent(startParam(bjDate))}`
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.code !== 0) throw new Error(`接口返回 code=${json.code} ${json.message ?? ''}`)
  return json.data?.matches ?? []
}
