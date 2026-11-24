import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNationalTeam, normalizeMatch, mergeFixtures } from '../src/normalize.mjs'

function fakeMatch(overrides = {}) {
  return {
    match_id: '54590293',
    competition: { name: 'U17亚洲杯' },
    status: 'Fixture',
    match_timestamp: Date.parse('2026-11-26T15:00:00Z') / 1000,
    team_A: { name: '中国U17', fs: '0' },
    team_B: { name: '斐济U17', fs: '0' },
    ...overrides,
  }
}

test('parseNationalTeam 识别国字号并排除港澳台与女足', () => {
  assert.equal(parseNationalTeam('中国'), '成年队')
  assert.equal(parseNationalTeam('中国U19'), 'U19')
  assert.equal(parseNationalTeam('中国U15'), 'U15')
  assert.equal(parseNationalTeam('中国台北'), null)
  assert.equal(parseNationalTeam('中国香港U17'), null)
  assert.equal(parseNationalTeam('中国女足U17'), null)
  assert.equal(parseNationalTeam('斐济U17'), null)
})

test('normalizeMatch 映射到内部字段', () => {
  const f = normalizeMatch(fakeMatch())
  assert.equal(f.key, 'dongqiudi:54590293')
  assert.equal(f.team, 'U17')
  assert.equal(f.start, '2026-11-26T15:00:00.000Z')
  assert.equal(f.home, '中国U17')
  assert.equal(f.away, '斐济U17')
  assert.equal(f.tournament, 'U17亚洲杯')
  assert.equal(f.state, 'scheduled')
  assert.equal(f.score, null)
})

test('normalizeMatch 跳过非国字号比赛', () => {
  assert.equal(normalizeMatch(fakeMatch({ team_A: { name: '保乙A' }, team_B: { name: '保乙B' } })), null)
})

test('已结束比赛带出比分', () => {
  const f = normalizeMatch(
    fakeMatch({ status: 'Played', team_A: { name: '中国U19', fs: '2' }, team_B: { name: '韩国U19', fs: '1' } }),
  )
  assert.equal(f.state, 'finished')
  assert.equal(f.score, '2-1')
})

test('mergeFixtures 同一场比赛只保留一条并合并字段', () => {
  const scheduled = normalizeMatch(fakeMatch())
  const finished = normalizeMatch(
    fakeMatch({ status: 'Played', team_A: { name: '中国U17', fs: '2' }, team_B: { name: '斐济U17', fs: '0' } }),
  )
  const merged = mergeFixtures([scheduled], [finished])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].state, 'finished')
  assert.equal(merged[0].score, '2-0')
})

test('mergeFixtures 按 keepFrom 丢弃过旧的比赛', () => {
  const old = normalizeMatch(
    fakeMatch({ match_id: '1', match_timestamp: Date.parse('2026-11-01T00:00:00Z') / 1000 }),
  )
  const fresh = normalizeMatch(
    fakeMatch({ match_id: '2', match_timestamp: Date.parse('2026-11-26T00:00:00Z') / 1000 }),
  )
  const merged = mergeFixtures([old, fresh], [], { keepFrom: '2026-11-10T00:00:00.000Z' })
  assert.deepEqual(merged.map((f) => f.id), ['2'])
})
