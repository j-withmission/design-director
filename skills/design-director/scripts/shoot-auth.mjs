#!/usr/bin/env node
// Authenticated full-page screenshots via ONE headless Chrome + CDP.
//
// Usage: node shoot-auth.mjs <outDir> <baseUrl> <route> [<route> ...]
//   env: SHOT_EMAIL / SHOT_PASSWORD  credentials for a /login form with
//                                    input[type=email] + input[type=password]
//        SHOT_LOGIN_PATH             default /login
//        SHOT_WIDTH                  default 1280 (390 for mobile)
//        SHOT_DARK=1                 add the `dark` class to <html> before capture
//
// Why this exists: shot.sh cannot see logged-in pages. Why it is shaped this
// way: one Chrome per RUN (not per route, not per agent), a hard renderer
// cap, and Chrome is killed on every exit path — an orphaned headless Chrome
// once ran for six days after an agent died mid-run.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [outDir, base, ...routes] = process.argv.slice(2)
if (!outDir || !base || routes.length === 0) {
  console.error('usage: shoot-auth.mjs <outDir> <baseUrl> <route...>')
  process.exit(1)
}
const width = Number(process.env.SHOT_WIDTH || 1280)
const loginPath = process.env.SHOT_LOGIN_PATH || '/login'
const chrome = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((c) => { try { return statSync(c).isFile() } catch { return false } })
  ?? process.env.CHROME_BIN
if (!chrome) { console.error('no Chrome/Chromium found; set CHROME_BIN'); process.exit(2) }

const port = 9333 + Math.floor(Math.random() * 500)
mkdirSync(outDir, { recursive: true })
const proc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--disable-extensions', '--disable-background-networking', '--mute-audio',
  '--renderer-process-limit=1', '--js-flags=--max-old-space-size=256',
  `--remote-debugging-port=${port}`, `--user-data-dir=${join(outDir, '.chrome-profile')}`,
  `--window-size=${width},900`, 'about:blank',
], { stdio: 'ignore' })

// Every exit path kills Chrome: normal end, thrown error, SIGTERM/SIGINT from
// a parent that gives up, and the parent dying (Chrome is not detached).
let killed = false
const killChrome = () => { if (!killed) { killed = true; try { proc.kill('SIGKILL') } catch {} } }
process.on('exit', killChrome)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { killChrome(); process.exit(130) })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl }
    catch { await sleep(200) }
  }
  throw new Error('chrome did not start')
}

try {
  const ws = new WebSocket(await getWsUrl())
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  const events = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id)
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
    } else if (msg.method) events.push(msg)
  }
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej })
    ws.send(JSON.stringify({ id: i, method, params, sessionId }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const s = (m, p) => send(m, p, sessionId)
  await s('Page.enable'); await s('Runtime.enable')
  const viewport = (height) => s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await viewport(900)
  const evalJs = async (expr) => (await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value
  async function nav(url, settle = 1500) {
    await s('Page.navigate', { url })
    const t0 = Date.now()
    while (Date.now() - t0 < 20000) {
      if (events.some((e) => e.method === 'Page.loadEventFired' && e.sessionId === sessionId)) break
      await sleep(100)
    }
    events.length = 0
    await sleep(settle)
  }

  await nav(`${base}${loginPath}`)
  if ((await evalJs('location.pathname')).startsWith(loginPath)) {
    const { SHOT_EMAIL: email, SHOT_PASSWORD: password } = process.env
    if (!email || !password) throw new Error('not logged in and no SHOT_EMAIL/SHOT_PASSWORD')
    await evalJs(`(() => {
      const setVal = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
      setVal(document.querySelector('input[type=email], input[name=email]'), ${JSON.stringify(email)})
      setVal(document.querySelector('input[type=password], input[name=password]'), ${JSON.stringify(password)})
      const btn = document.querySelector('button[type=submit]'); btn && btn.click(); return true })()`)
    let after = loginPath
    for (let i = 0; i < 45 && after.startsWith(loginPath); i++) { await sleep(1000); after = await evalJs('location.pathname') }
    if (after.startsWith(loginPath)) {
      const why = await evalJs('(document.body.innerText || "").slice(0, 400)')
      throw new Error(`login failed, still on ${loginPath}\n--- page text ---\n${why}`)
    }
    console.error('logged in ->', after)
  }

  for (const route of routes) {
    await nav(route.startsWith('http') ? route : `${base}${route}`)
    const path = await evalJs('location.pathname')
    // Hide the Next.js dev badge (critics score it) and apply dark mode if asked.
    await evalJs(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); if (${process.env.SHOT_DARK ? 'true' : 'false'}) document.documentElement.classList.add("dark"); return true })()`)
    const height = Math.min(await evalJs('Math.ceil(document.documentElement.scrollHeight)'), 6000)
    await viewport(Math.max(height, 900))
    await sleep(400)
    const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    const name = (route.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root') + '.png'
    writeFileSync(join(outDir, name), Buffer.from(data, 'base64'))
    console.log(`${name}  <- ${path}  (${width}x${height})`)
    await viewport(900)
  }
  ws.close()
} finally {
  killChrome()
}
