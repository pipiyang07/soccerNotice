import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEvent, mergeFixtures } from '../src/normalize.mjs'

function fakeEvent(overrides = {}) {
  return {
    id: 12345,
    startTimestamp: Date.parse('2026-11-26T07:00:00Z') / 1000,
    homeTeam: { name: 'China U17' },
    awayTeam: { name: 'Fiji U17' },
    tournament: { name: 'U17 FIFA World Cup, Group H' },
    status: { type: 'notstarted' },
    ...overrides,
  }
}

test('normalizeEvent 映射到内部字段', () => {
  const f = normalizeEvent(fakeEvent(), 'U17')
  assert.equal(f.key, 'sofascore:12345')
  assert.equal(f.team, 'U17')
  assert.equal(f.start, '2026-11-26T07:00:00.000Z')
  assert.equal(f.home, 'China U17')
  assert.equal(f.away, 'Fiji U17')
  assert.equal(f.tournament, 'U17 FIFA World Cup, Group H')
  assert.equal(f.state, 'scheduled')
  assert.equal(f.score, null)
})

test('已结束比赛带出比分', () => {
  const f = normalizeEvent(
    fakeEvent({ status: { type: 'finished' }, homeScore: { current: 2 }, awayScore: { current: 1 } }),
    '成年队',
  )
  assert.equal(f.state, 'finished')
  assert.equal(f.score, '2-1')
})

test('mergeFixtures 同一场比赛只保留一条并合并字段', () => {
  const scheduled = normalizeEvent(fakeEvent(), 'U17')
  const finished = normalizeEvent(
    fakeEvent({ status: { type: 'finished' }, homeScore: { current: 2 }, awayScore: { current: 0 } }),
    'U17',
  )
  const merged = mergeFixtures([scheduled], [finished])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].state, 'finished')
  assert.equal(merged[0].score, '2-0')
})

test('mergeFixtures 按 keepFrom 丢弃过旧的比赛', () => {
  const old = normalizeEvent(fakeEvent({ id: 1, startTimestamp: Date.parse('2026-11-01T00:00:00Z') / 1000 }), '成年队')
  const fresh = normalizeEvent(fakeEvent({ id: 2 }), '成年队')
  const merged = mergeFixtures([old, fresh], [], { keepFrom: '2026-11-10T00:00:00.000Z' })
  assert.deepEqual(merged.map((f) => f.id), [2])
})
