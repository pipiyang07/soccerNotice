// 一次性工具：向配置的群发一条测试消息，验证凭据与群 ID 是否可用
// 用法：QQ_GROUP_OPENIDS=xxx node --env-file=.env scripts/send-test.mjs
import { getAccessToken, sendGroupMessage } from '../src/qqbot.mjs'

const groupOpenids = (process.env.QQ_GROUP_OPENIDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!process.env.QQ_APP_ID || !process.env.QQ_APP_SECRET || groupOpenids.length === 0) {
  console.error('需要 QQ_APP_ID / QQ_APP_SECRET / QQ_GROUP_OPENIDS')
  process.exit(1)
}

const token = await getAccessToken(process.env.QQ_APP_ID, process.env.QQ_APP_SECRET)
const text = [
  '⚽ 中国国字号赛程提醒机器人已上线',
  '接下来会推送：赛前 24 小时提醒 + 赛后比分',
  '数据源：懂球帝赛程',
].join('\n')

for (const group of groupOpenids) {
  const result = await sendGroupMessage(token, group, text)
  console.log(`已发送到 ${group}`, JSON.stringify(result).slice(0, 160))
}