// 归一化与合并：纯函数，便于单测
// 数据源字段 → 项目内部统一结构

/**
 * @typedef {object} Fixture
 * @property {string} key          去重键：source:id
 * @property {string} source       数据源标识
 * @property {number} id           数据源内的比赛 ID
 * @property {string} team         归属的国字号队伍
 * @property {string} start        ISO 时间（UTC）
 * @property {string} home
 * @property {string} away
 * @property {string} tournament
 * @property {'scheduled'|'live'|'finished'|'other'} state
 * @property {string|null} score   "2-1"，仅已结束的比赛有
 */

const STATE_MAP = {
  notstarted: 'scheduled',
  inprogress: 'live',
  finished: 'finished',
}

export function normalizeEvent(event, team, source = 'sofascore') {
  return {
    key: `${source}:${event.id}`,
    source,
    id: event.id,
    team,
    start: new Date(event.startTimestamp * 1000).toISOString(),
    home: event.homeTeam?.name ?? '',
    away: event.awayTeam?.name ?? '',
    tournament: event.tournament?.name ?? '',
    state: STATE_MAP[event.status?.type] ?? 'other',
    score:
      event.status?.type === 'finished'
        ? `${event.homeScore?.current}-${event.awayScore?.current}`
        : null,
  }
}

/**
 * 合并新旧赛程。以 key 为唯一标识：
 * - 新数据覆盖旧数据（比分、状态会变化）
 * - 旧数据里仍然有效（未过期）的比赛保留
 * 返回按开赛时间升序排列的数组。
 */
export function mergeFixtures(existing, incoming, { keepFrom, until } = {}) {
  const map = new Map()
  for (const f of existing) {
    if (keepFrom && f.start < keepFrom) continue
    map.set(f.key, f)
  }
  for (const f of incoming) {
    const prev = map.get(f.key)
    map.set(f.key, { ...prev, ...f })
  }
  return [...map.values()]
    .filter((f) => !until || f.start < until)
    .sort((a, b) => a.start.localeCompare(b.start))
}
