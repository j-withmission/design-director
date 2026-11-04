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
// once ran for six days after an agent died mid-run. The launch, the caps and
// the kill handlers live in lib/chrome.mjs, shared with detect.mjs.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findChrome, launchChrome, connect, sleep } from './lib/chrome.mjs'

const [outDir, base, ...routes] = process.argv.slice(2)
if (!outDir || !base || routes.length === 0) {
  console.error('usage: shoot-auth.mjs <outDir> <baseUrl> <route...>')
  process.exit(1)
}
const width = Number(process.env.SHOT_WIDTH || 1280)
const loginPath = process.env.SHOT_LOGIN_PATH || '/login'
const chrome = findChrome()
if (!chrome) { console.error('no Chrome/Chromium found; set CHROME_BIN'); process.exit(2) }

mkdirSync(outDir, { recursive: true })
const { port, kill: killChrome } = launchChrome({ width, profileDir: join(outDir, '.chrome-profile'), chrome })

try {
  const client = await connect(port)
  const { evalJs, nav, prepare, screenshot } = await client.attach('about:blank', { width })

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
    await prepare({ dark: !!process.env.SHOT_DARK })
    const { data, height } = await screenshot(true)
    const name = (route.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root') + '.png'
    writeFileSync(join(outDir, name), data)
    console.log(`${name}  <- ${path}  (${width}x${height})`)
  }
  client.close()
} finally {
  killChrome()
}
