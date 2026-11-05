// One headless Chrome over CDP, shared by shoot-auth.mjs and detect.mjs.
//
// The rules this file exists to keep in one place: one Chrome per RUN (not per
// route, not per agent), a hard renderer cap and heap cap, and Chrome is
// killed on every exit path — an orphaned headless Chrome once ran for six
// days after an agent died mid-run.
import { spawn, execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The two macOS app paths, then CHROME_BIN, then google-chrome / chromium on
// PATH. Returns null when none is found; callers decide the message and code.
export function findChrome() {
  const app = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].find((c) => { try { return statSync(c).isFile() } catch { return false } })
  if (app) return app
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN
  for (const name of ['google-chrome', 'chromium']) {
    try {
      const p = execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (p) return p
    } catch {}
  }
  return null
}

export function launchChrome({ width = 1280, profileDir, chrome = findChrome() }) {
  if (!chrome) throw new Error('no Chrome/Chromium found; set CHROME_BIN')
  const port = 9333 + Math.floor(Math.random() * 500)
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--disable-extensions', '--disable-background-networking', '--mute-audio',
    '--renderer-process-limit=1', '--js-flags=--max-old-space-size=256',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
    `--window-size=${width},900`, 'about:blank',
  ], { stdio: 'ignore' })

  // Every exit path kills Chrome: normal end, thrown error, SIGTERM/SIGINT from
  // a parent that gives up, and the parent dying (Chrome is not detached).
  let killed = false
  const kill = () => { if (!killed) { killed = true; try { proc.kill('SIGKILL') } catch {} } }
  process.on('exit', kill)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { kill(); process.exit(130) })
  return { proc, port, kill }
}

async function getWsUrl(port) {
  for (let i = 0; i < 50; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl }
    catch { await sleep(200) }
  }
  throw new Error('chrome did not start')
}

// A CDP client on the browser endpoint. `attach(url, { width })` opens one
// page target and returns the session helpers both scripts use.
export async function connect(port) {
  const ws = new WebSocket(await getWsUrl(port))
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

  async function attach(url = 'about:blank', { width = 1280 } = {}) {
    const { targetId } = await send('Target.createTarget', { url })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const s = (m, p) => send(m, p, sessionId)
    await s('Page.enable'); await s('Runtime.enable')
    const viewport = (height) => s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await viewport(900)
    const evalJs = async (expr) => (await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value
    // Waits up to 20 s for the load event, then settles. Returns the
    // navigate result (errorText is set when the page could not load) and
    // whether the load event fired; shoot-auth ignores both.
    async function nav(target, settle = 1500) {
      const result = await s('Page.navigate', { url: target })
      const t0 = Date.now()
      let loaded = false
      while (Date.now() - t0 < 20000) {
        if (events.some((e) => e.method === 'Page.loadEventFired' && e.sessionId === sessionId)) { loaded = true; break }
        await sleep(100)
      }
      events.length = 0
      await sleep(settle)
      return { ...result, loaded }
    }
    // Hide the Next.js dev badge (critics score it) and apply dark mode if asked.
    const prepare = ({ dark = false } = {}) => evalJs(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); if (${dark ? 'true' : 'false'}) document.documentElement.classList.add("dark"); return true })()`)
    // Page height, capped at 6000 px.
    const pageHeight = async () => Math.min(await evalJs('Math.ceil(document.documentElement.scrollHeight)'), 6000)
    // fullPage: grow the viewport to the capped page height, capture, then
    // return to 900. Returns { data: Buffer, height } (height is the capped
    // page height, which may be under the 900 px minimum viewport).
    async function screenshot(fullPage = true) {
      if (!fullPage) {
        const { data } = await s('Page.captureScreenshot', { format: 'png' })
        return { data: Buffer.from(data, 'base64'), height: 900 }
      }
      const height = await pageHeight()
      await viewport(Math.max(height, 900))
      await sleep(400)
      const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      await viewport(900)
      return { data: Buffer.from(data, 'base64'), height }
    }
    return { s, sessionId, evalJs, nav, viewport, prepare, pageHeight, screenshot }
  }

  return { ws, send, events, attach, close: () => ws.close() }
}
