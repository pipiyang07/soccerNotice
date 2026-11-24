// 归一化与合并：纯函数，便于单测
// 懂球帝字段 → 项目内部统一结构

/**
 * @typedef {object} Fixture
 * @property {string} key        去重键：source:id
 * @property {string} source     数据源标识
 * @property {string} id         数据源内比赛 ID
 * @property {string} team       归属的国字号队伍（成年队 / U23 / …）
 * @property {string} start      ISO 时间（UTC）
 * @property {string} home
 * @property {string} away
 * @property {string} tournament
 * @property {'scheduled'|'live'|'finished'|'other'} state
 * @property {string|null} score "2-1"，仅已结束的比赛有
 */

// 只认「中国」「中国U23」这类写法；「中国台北」「中国香港」「中国澳门」不会被匹配
const NATIONAL_TEAM = /^中国(U\d{2})?$/

/**
 * 从队名解析国字号队伍标识
 * @returns {string|null} 成年队 / U23 / null（不是中国国字号）
 */
export function parseNationalTeam(name) {
  if (typeof name !== 'string') return null
  if (name.includes('女')) return null
  const matched = NATIONAL_TEAM.exec(name.trim())
  if (!matched) return null
  return matched[1] ?? '成年队'
}

const STATE_MAP = {
  Fixture: 'scheduled',
  Played: 'finished',
  Playing: 'live',
  Live: 'live',
}

/**
 * 懂球帝比赛 → 内部结构；与中国国字号无关的比赛返回 null
 * @param {object} match 懂球帝接口返回的 match 对象
 */
export function normalizeMatch(match, source = 'dongqiudi') {
  const home = match.team_A?.name ?? ''
  const away = match.team_B?.name ?? ''
  const team = parseNationalTeam(home) ?? parseNationalTeam(away)
  if (!team) return null

  const state = STATE_MAP[match.status] ?? 'other'
  return {
    key: `${source}:${match.match_id}`,
    source,
    id: String(match.match_id),
    team,
    start: new Date(match.match_timestamp * 1000).toISOString(),
    home,
    away,
    tournament: match.competition?.name ?? '',
    state,
    score:
      state === 'finished' ? `${match.team_A?.fs ?? ''}-${match.team_B?.fs ?? ''}` : null,
  }
}

/**
 * 合并新旧赛程。以 key 为唯一标识：
 * - 新数据覆盖旧数据（比分、状态会变化）
 * - 旧数据里仍然有效（未过期）的比赛保留
 * 返回按开赛时间升序排列的数组。
 */
export function mergeFixtures(existing, incoming, { keepFrom } = {}) {
  const map = new Map()
  for (const f of existing) {
    if (keepFrom && f.start < keepFrom) continue
    map.set(f.key, f)
  }
  for (const f of incoming) {
    const prev = map.get(f.key)
    map.set(f.key, { ...prev, ...f })
  }
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start))
}
