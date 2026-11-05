// Known-answer tests for detect.mjs. Each fixture under fixtures/detect/ has
// one expected set of findings; detect runs as a child process exactly as an
// agent would run it, one Chrome per run.
//
// Run: node skills/design-director/scripts/detect.test.mjs
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findChrome } from './lib/chrome.mjs'
import { parseBrief, evalRule } from './detect.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const DETECT = join(here, 'detect.mjs')
const FX = join(here, 'fixtures', 'detect')
const fx = (name) => join(FX, name)
const BRIEF = fx('brief-strict.md')
const NO_CHROME = 'no Chrome/Chromium found; screenshot in the preview browser and describe it instead'

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [DETECT, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    p.stdout.on('data', (d) => (stdout += d))
    p.stderr.on('data', (d) => (stderr += d))
    const timer = setTimeout(() => { p.kill('SIGTERM'); reject(new Error(`detect timed out: ${args.join(' ')}`)) }, 45000)
    p.on('error', reject)
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
  })
}
const docs = []
async function json(args) {
  const r = await run([...args, '--json'])
  let doc
  try { doc = JSON.parse(r.stdout) } catch { throw new Error(`no JSON (exit ${r.code}): ${r.stderr || r.stdout}`) }
  docs.push(doc)
  return { ...r, doc }
}
const ids = (doc) => [...new Set(doc.findings.map((f) => f.id))].sort()
const statuses = (doc) => Object.fromEntries(doc.brief.rules.map((r) => [r.n, r.status]))
function keys(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keys(x, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keys(x, out) }
  return out
}

if (!findChrome()) {
  test('chrome is available', () => assert.fail(NO_CHROME))
} else {
  const tmp = mkdtempSync(join(tmpdir(), 'detect-test-'))
  const cleanPng = join(tmp, 'clean.png')
  after(() => rmSync(tmp, { recursive: true, force: true }))

  test('brief parsing: palette from Translation, ten rules, machine lines', () => {
    const b = parseBrief(readFileSync(BRIEF, 'utf8'))
    assert.deepEqual([...b.palette].sort(), ['#111111', '#c65a2e', '#f6f4ef'])
    assert.equal(b.rules.length, 10)
    assert.equal(b.rules[0].machine, 'accent-colors <= 1')
    assert.equal(b.rules[9].machine, 'none')
  })

  test('unknown machine expressions are unparsed, never thrown', () => {
    const r = evalRule({ n: 1, text: 'x', machine: 'wobble <= 3' }, { page: {}, palette: [], texts: [] })
    assert.equal(r.status, 'unparsed')
    assert.match(r.evidence, /wobble/)
    const p = evalRule({ n: 2, text: 'x', machine: 'palette-only' }, { page: {}, palette: [], texts: [] })
    assert.equal(p.status, 'unparsed')
  })

  test('missing page exits 1 without launching Chrome', async () => {
    const r = await run([fx('does-not-exist.html')])
    assert.equal(r.code, 1)
    assert.equal(r.stdout, '')
  })

  test('clean.html: no findings, exit 0, full-page shot written', async () => {
    const { code, doc } = await json([fx('clean.html'), '--shot', cleanPng])
    assert.deepEqual(ids(doc), [])
    assert.equal(code, 0)
    assert.ok(existsSync(cleanPng))
    assert.equal(doc.shot, cleanPng)
    assert.equal(doc.screenshot.decoder, 'builtin')
    assert.match(doc.screenshot.hash, /^[0-9a-f]{16}$/)
    assert.equal(doc.summary.unchanged, null)
  })

  test('tiny-and-long.html: tiny-text and long-lines', async () => {
    const { code, doc } = await json([fx('tiny-and-long.html')])
    assert.deepEqual(ids(doc), ['long-lines', 'tiny-text'])
    assert.equal(code, 2)
    assert.ok(doc.page.type.tinyText.samples.some((s) => s.px === 10))
    assert.ok(doc.page.type.longLines.samples[0].ch > 120)
  })

  test('low-contrast.html: contrast', async () => {
    const { code, doc } = await json([fx('low-contrast.html')])
    assert.deepEqual(ids(doc), ['contrast'])
    assert.equal(code, 2)
    assert.ok(doc.page.contrast.failing.some((f) => f.fg === '#999999' && f.bg === '#ffffff'))
  })

  test('monotonous.html: monotonous-spacing and flat-hierarchy', async () => {
    const { code, doc } = await json([fx('monotonous.html')])
    assert.deepEqual(ids(doc), ['flat-hierarchy', 'monotonous-spacing'])
    assert.equal(code, 2)
    assert.equal(doc.page.spacing.dominant.px, 16)
  })

  test('decorated.html: no findings on its own, decoration measured', async () => {
    const { code, doc } = await json([fx('decorated.html')])
    assert.deepEqual(ids(doc), [])
    assert.equal(code, 0)
    const d = doc.page.decoration
    assert.ok(d.gradients >= 1, `gradients ${d.gradients}`)
    assert.ok(d.shadows >= 1, `shadows ${d.shadows}`)
    assert.ok(d.maxRadius >= 24, `maxRadius ${d.maxRadius}`)
    assert.ok(d.maxBorderWeight >= 3, `maxBorderWeight ${d.maxBorderWeight}`)
    assert.ok(doc.page.colors.accents.length >= 3, `accents ${doc.page.colors.accents}`)
    assert.equal(doc.brief, null)
  })

  test('decorated.html against brief-strict.md: compiled rules fail', async () => {
    const { code, doc } = await json([fx('decorated.html'), '--brief', BRIEF])
    assert.deepEqual(statuses(doc), {
      1: 'fail', 2: 'fail', 3: 'fail', 4: 'fail', 5: 'fail', 6: 'fail', 7: 'fail', 8: 'fail',
      9: 'pass', // nothing on the page fails AA, so the contrast rule holds
      10: 'critic-only',
    })
    assert.deepEqual(doc.summary.rules, { passed: 1, compiled: 9, criticOnly: 1, unparsed: 0 })
    // Failed compiled rules are warnings, not findings; off-palette is the one finding.
    assert.deepEqual(ids(doc), ['off-palette'])
    assert.deepEqual(doc.warnings.map((w) => w.rule), [1, 2, 3, 4, 5, 6, 7, 8])
    assert.equal(doc.summary.warnings, 8)
    assert.equal(code, 2)
  })

  test('clean.html against brief-warn.md: failed compiled rules exit 0 without --strict, 2 with it', async () => {
    const warn = fx('brief-warn.md')
    const a = await json([fx('clean.html'), '--brief', warn])
    assert.deepEqual(statuses(a.doc), { 1: 'fail', 2: 'fail', 3: 'critic-only' })
    assert.deepEqual(ids(a.doc), [])
    assert.deepEqual(a.doc.warnings.map((w) => w.rule), [1, 2])
    assert.equal(a.doc.strict, false)
    assert.equal(a.code, 0)
    const b = await json([fx('clean.html'), '--brief', warn, '--strict'])
    assert.deepEqual(ids(b.doc), ['rule-failed'])
    assert.deepEqual(b.doc.findings.map((f) => f.rule), [1, 2])
    assert.deepEqual(b.doc.warnings, [])
    assert.equal(b.doc.strict, true)
    assert.equal(b.code, 2)
    const t = await run([fx('clean.html'), '--brief', warn])
    assert.equal(t.code, 0)
    assert.ok(t.stdout.split('\n').some((l) => /^warning {2}rule-failed {2}rule 1 failed/.test(l)))
  })

  test('clean.html against brief-strict.md: compiled rules pass; same page hashes the same', async () => {
    const { code, doc } = await json([fx('clean.html'), '--brief', BRIEF, '--previous', cleanPng])
    assert.deepEqual(statuses(doc), { 1: 'pass', 2: 'pass', 3: 'pass', 4: 'pass', 5: 'pass', 6: 'pass', 7: 'pass', 8: 'pass', 9: 'pass', 10: 'critic-only' })
    assert.deepEqual(doc.summary.rules, { passed: 9, compiled: 9, criticOnly: 1, unparsed: 0 })
    assert.deepEqual(ids(doc), [])
    assert.equal(code, 0)
    assert.equal(doc.screenshot.previous.distance, 0)
    assert.equal(doc.screenshot.previous.unchanged, true)
    assert.equal(doc.summary.unchanged, true)
  })

  test('changed.html: pHash distance from clean.html is over 3', async () => {
    const { doc } = await json([fx('changed.html'), '--previous', cleanPng])
    assert.ok(doc.screenshot.previous.distance > 3, `distance ${doc.screenshot.previous.distance}`)
    assert.equal(doc.screenshot.previous.unchanged, false)
    assert.equal(doc.summary.unchanged, false)
  })

  test('text mode prints findings, rules and one summary line', async () => {
    const r = await run([fx('decorated.html'), '--brief', BRIEF])
    assert.equal(r.code, 2)
    const lines = r.stdout.trim().split('\n')
    assert.match(lines.at(-1), /^summary {2}1 findings · 8 warnings · rules 1\/9 · critic-only 1 · hash distance n\/a$/)
    assert.ok(lines.some((l) => /^finding {2}off-palette {2}/.test(l)))
    assert.ok(lines.some((l) => /^warning {2}rule-failed {2}/.test(l)))
    assert.ok(lines.some((l) => /^rule 10 {2}critic-only {2}/.test(l)))
    assert.ok(!r.stdout.includes('{'), 'text mode prints no JSON')
  })

  test('no score, grade or rating anywhere in the JSON', () => {
    assert.ok(docs.length >= 10)
    for (const doc of docs) {
      const k = keys(doc)
      for (const banned of ['score', 'grade', 'rating']) assert.ok(![...k].some((x) => x.toLowerCase() === banned), `key ${banned} in ${doc.source}`)
    }
  })

  test('every Chrome the tests started is gone', async () => {
    const mine = () => {
      let out = ''
      try { out = execFileSync('pgrep', ['-fl', 'remote-debugging-port'], { encoding: 'utf8' }) } catch {}
      return out.split('\n').filter((l) => l.includes('design-director-detect-'))
    }
    // A renderer helper can outlive its killed browser by a moment.
    let left = mine()
    for (let i = 0; i < 25 && left.length; i++) { await new Promise((r) => setTimeout(r, 200)); left = mine() }
    assert.deepEqual(left, [])
  })
}
