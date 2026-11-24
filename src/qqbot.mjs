// QQ 开放平台 Bot 接口封装
// token 接口：https://bots.qq.com/app/getAppAccessToken（有效期 7200 秒）
// 发消息：https://api.sgroup.qq.com/v2/groups/{group_openid}/messages
const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken'
const API_BASE = 'https://api.sgroup.qq.com'

/** 获取 access_token */
export async function getAccessToken(appId, clientSecret) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appId, clientSecret }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`取 token 失败 HTTP ${res.status}`)
  const json = await res.json()
  if (!json.access_token) throw new Error(`取 token 返回异常: ${JSON.stringify(json)}`)
  return json.access_token
}

// 平台错误码 → 可操作的提示（来自官方文档与 FAQ）
const ERROR_HINTS = {
  40034105: '群主尚未在手机 QQ 里给机器人开启「主动推送消息能力」',
  40034101: '机器人不在该群内，或已被移出群聊',
  40034100: '主动消息超出频控（单群 20 qpm / 每天 1000 条）',
  40034024: 'msg_id 无效或越权',
}

/**
 * 向群发送纯文本消息
 * 不传 msg_id 即为主动消息，受平台频控（个人认证 60 qpm，单群每天上限 1000 条）
 * 注意：主动消息需要群主在手机 QQ 内给机器人授予「主动推送消息能力」
 */
export async function sendGroupMessage(token, groupOpenid, content) {
  const res = await fetch(`${API_BASE}/v2/groups/${groupOpenid}/messages`, {
    method: 'POST',
    headers: {
      authorization: `QQBot ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content, msg_type: 0 }),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  if (!res.ok) {
    let code = null
    try {
      code = JSON.parse(text).code
    } catch {
      // 非 JSON 响应，保持原始文本
    }
    const hint = ERROR_HINTS[code]
    throw new Error(
      `发群消息失败 HTTP ${res.status}${code ? ` code=${code}` : ''}` +
        (hint ? `：${hint}` : '') +
        ` | ${text.slice(0, 160)}`,
    )
  }
  return text ? JSON.parse(text) : {}
}