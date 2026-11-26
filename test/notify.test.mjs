import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dueNotifications, preMatchText, postMatchText, alertText } from '../src/notify.mjs'

const START = '2026-11-26T15:00:00.000Z'
const START_MS = Date.parse(START)
const HOUR = 3600_000

const scheduled = {
  key: 'dongqiudi:1',
  id: '1',
  team: 'U17',
  start: START,
  home: '中国U17',
  away: '斐济U17',
  tournament: 'U17世界杯',
  state: 'scheduled',
  score: null,
}

const finished = {
  ...scheduled,
  key: 'dongqiudi:2',
  id: '2',
  state: 'finished',
  score: '2-2',
}

test('赛前提醒在 24h 窗口内触发', () => {
  const out = dueNotifications({
    fixtures: [scheduled],
    sentKeys: new Set(),
    groupOpenids: ['G1'],
    now: START_MS - 24 * HOUR,
  })
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'pre')
  assert.equal(out[0].sentKey, 'dongqiudi:1:pre:G1')
})

test('窗口边界外不触发', () => {
  for (const hours of [16, 32]) {
    const out = dueNotifications({
      fixtures: [scheduled],
      sentKeys: new Set(),
      groupOpenids: ['G1'],
      now: START_MS - hours * HOUR,
    })
    assert.equal(out.length, 0, `${hours}h 不应触发`)
  }
})

test('已发送过的提醒不重复发送', () => {
  const out = dueNotifications({
    fixtures: [scheduled],
    sentKeys: new Set(['dongqiudi:1:pre:G1']),
    groupOpenids: ['G1'],
    now: START_MS - 24 * HOUR,
  })
  assert.equal(out.length, 0)
})

test('多个群各生成一条', () => {
  const out = dueNotifications({
    fixtures: [scheduled],
    sentKeys: new Set(),
    groupOpenids: ['G1', 'G2'],
    now: START_MS - 24 * HOUR,
  })
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((o) => o.group), ['G1', 'G2'])
})

test('已结束且有比分的比赛推送比分', () => {
  const out = dueNotifications({
    fixtures: [finished],
    sentKeys: new Set(),
    groupOpenids: ['G1'],
    now: START_MS + 5 * HOUR,
  })
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'post')
})

test('超过 24 小时前的比赛不再推送比分', () => {
  const out = dueNotifications({
    fixtures: [finished],
    sentKeys: new Set(),
    groupOpenids: ['G1'],
    now: START_MS + 30 * HOUR,
  })
  assert.equal(out.length, 0)
})

test('文案包含队伍、赛事与北京时间', () => {
  const pre = preMatchText(scheduled)
  assert.match(pre, /中国 U17/)
  assert.match(pre, /中国U17 vs 斐济U17/)
  assert.match(pre, /U17世界杯/)
  assert.match(pre, /11\/26 23:00/)

  const post = postMatchText(finished)
  assert.match(post, /2-2/)
  assert.match(post, /比赛结束/)
})
test('告警文案带上失败原因与数据源', () => {
  const text = alertText({
    failures: 3,
    lastSuccessAt: '2026-11-26T07:54:53.435Z',
    lastError: '2026-11-26/fixture: HTTP 403 DQD-server/1.17.8.2',
    backoffHours: 6,
  })
  assert.match(text, /连续失败：3 次/)
  assert.match(text, /数据源：懂球帝/)
  assert.match(text, /HTTP 403/)
  assert.match(text, /6 小时后重试/)
  assert.match(text, /11\/26 15:54/)
})
