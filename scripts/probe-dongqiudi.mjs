// 诊断：懂球帝接口在不同请求特征下的响应差异
// 只在云端运行器上有意义（本地住宅 IP 通常直接 200）
const DAY = '2026-11-25 16:00:00'
const URL = `https://www.dongqiudi.com/magicball/v1/list/schedule_list?language=zh-CN&tab_type=fixture&cmp_type=soccer&start=${encodeURIComponent(DAY)}`

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

async function hit(name, headers, cookie) {
  try {
    const res = await fetch(URL, {
      headers: cookie ? { ...headers, cookie } : headers,
      signal: AbortSignal.timeout(20_000),
    })
    const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 90)
    console.log(`${res.status}  ${name.padEnd(22)} ${body}`)
    return res.status
  } catch (error) {
    console.log(`ERR ${name.padEnd(22)} ${error.message}`)
    return 0
  }
}

const base = { accept: 'application/json, text/plain, */*', 'accept-language': 'zh-CN,zh;q=0.9' }

await hit('裸请求', { 'user-agent': DESKTOP_UA, ...base })
await hit('带 referer', { 'user-agent': DESKTOP_UA, ...base, referer: 'https://www.dongqiudi.com/match' })
await hit('移动端 UA', { 'user-agent': MOBILE_UA, ...base })
await hit('curl UA', { 'user-agent': 'curl/8.4.0', accept: '*/*' })

// 先访页面拿 cookie，再带 cookie 请求
try {
  const page = await fetch('https://www.dongqiudi.com/match', {
    headers: { 'user-agent': DESKTOP_UA },
    signal: AbortSignal.timeout(20_000),
  })
  const cookies = page.headers.getSetCookie?.() ?? []
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ')
  console.log(`页面 ${page.status}，拿到 cookie: ${cookie ? cookie.slice(0, 60) : '无'}`)
  await hit('页面 cookie', { 'user-agent': DESKTOP_UA, ...base, referer: 'https://www.dongqiudi.com/match' }, cookie)
} catch (error) {
  console.log(`ERR 页面探测 ${error.message}`)
}

// 连续 3 次，观察是否触发频率限制
for (let i = 1; i <= 3; i += 1) {
  await hit(`连续第 ${i} 次`, { 'user-agent': DESKTOP_UA, ...base })
  await new Promise((r) => setTimeout(r, 1500))
}