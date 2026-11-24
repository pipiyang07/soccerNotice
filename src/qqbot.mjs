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

/**
 * 向群发送纯文本消息
 * 不传 msg_id 即为主动消息，受平台频控（个人认证 60 qpm，单群每天上限 1000 条）
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
  if (!res.ok) throw new Error(`发群消息失败 HTTP ${res.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : {}
}