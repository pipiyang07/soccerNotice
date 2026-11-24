// 一次性工具：连接 QQ Bot WebSocket，等待群里有人 @ 机器人，打印 group_openid
// 用法：node --env-file=.env scripts/get-group-openid.mjs
// 需要 .env 里配置 QQ_APP_ID / QQ_APP_SECRET
import { getAccessToken } from '../src/qqbot.mjs'

const INTENTS_GROUP_AND_C2C = 1 << 25 // GROUP_AT_MESSAGE_CREATE / C2C_MESSAGE_CREATE
const appId = process.env.QQ_APP_ID
const appSecret = process.env.QQ_APP_SECRET

if (!appId || !appSecret) {
  console.error('请先在 .env 里配置 QQ_APP_ID 与 QQ_APP_SECRET')
  process.exit(1)
}

const token = await getAccessToken(appId, appSecret)

const gwRes = await fetch('https://api.sgroup.qq.com/gateway', {
  headers: { authorization: `QQBot ${token}` },
})
if (!gwRes.ok) {
  console.error(`获取网关地址失败 HTTP ${gwRes.status}: ${(await gwRes.text()).slice(0, 200)}`)
  process.exit(1)
}
const { url } = await gwRes.json()
console.log('已连接网关，请到群里 @ 一下机器人…')

const ws = new WebSocket(url)
let heartbeat

ws.addEventListener('message', (event) => {
  const payload = JSON.parse(event.data)

  if (payload.op === 10) {
    // Hello：开始心跳并鉴权
    heartbeat = setInterval(() => {
      ws.send(JSON.stringify({ op: 1, d: null }))
    }, payload.d.heartbeat_interval)

    ws.send(
      JSON.stringify({
        op: 2,
        d: {
          token: `QQBot ${token}`,
          intents: INTENTS_GROUP_AND_C2C,
          shard: [0, 1],
          properties: {},
        },
      }),
    )
    return
  }

  if (payload.op === 0 && payload.t === 'READY') {
    console.log('鉴权成功，等待群消息事件…')
    return
  }

  if (payload.op === 0 && payload.t === 'GROUP_AT_MESSAGE_CREATE') {
    const { group_openid, content, author } = payload.d
    console.log('\n收到群 @ 消息')
    console.log('  group_openid:', group_openid)
    console.log('  发送者:', author?.member_openid ?? author?.id ?? '未知')
    console.log('  内容:', content)
    console.log('\n把上面的 group_openid 填到仓库变量 QQ_GROUP_OPENIDS 即可（多个用逗号分隔）')
    clearInterval(heartbeat)
    ws.close()
    process.exit(0)
  }

  if (payload.op === 9) {
    console.error('鉴权失败，请检查 intents 权限或 AppID/Secret')
    process.exit(1)
  }
})

ws.addEventListener('error', () => {
  console.error('WebSocket 连接出错')
  process.exit(1)
})