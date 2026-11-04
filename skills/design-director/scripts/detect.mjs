#!/usr/bin/env node
// Deterministic design measurements for one page via ONE headless Chrome + CDP.
//
// Usage: node detect.mjs <url-or-file> [--brief <path.md>] [--previous <png>]
//                        [--shot <out.png>] [--width 1280] [--json]
//   exit 0  no findings
//   exit 2  findings
//   exit 1  error (no Chrome, unreadable brief, page failed to load)
//
// What it is: a measurer, not a critic. It opens the page, reads the rendered
// DOM (colors, type, spacing, contrast, decoration) and the full-page PNG
// (perceptual hash, whitespace, edge density), compiles the brief's
// `machine:` rules, and reports a short list of findings. Same page, same
// numbers, every run.
//
// Why no model: these are the checks a model is worst at and a renderer is
// best at: 11 px captions, 140-character lines, a 2.8:1 gray, every gap the
// same 16 px. A critic squinting at a screenshot guesses at them; the
// computed style knows. Spending tokens on arithmetic buys noise.
//
// Why its output never reaches a critic: anchoring. A critic told "contrast
// fails, spacing is monotonous" scores the list, not the screen, and every
// round converges on whatever this file happens to measure. The critic sees
// the screenshot and the brief only; this output goes to the agent building
// the page and to the design record. It never scores, and nothing in it is a
// score, a grade or a rating.
//
// Shaped like shoot-auth.mjs: one Chrome per run (one launch produces the PNG
// and the measurements), hard renderer and heap caps, Chrome killed on every
// exit path (lib/chrome.mjs).
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, realpathSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { inflateSync } from 'node:zlib'
import { findChrome, launchChrome, connect } from './lib/chrome.mjs'

const NO_CHROME = 'no Chrome/Chromium found; screenshot in the preview browser and describe it instead'
const USAGE = 'usage: detect.mjs <url-or-file> [--brief <path.md>] [--previous <png>] [--shot <out.png>] [--width 1280] [--json]'

// ---------------------------------------------------------------- thresholds
const T = {
  tinyPx: 12,             // text under this is tiny
  longCh: 90,             // rendered line length over this is long
  aa: 4.5, aaLarge: 3.0,  // WCAG 2 AA
  deltaE: 12,             // CIE76 cluster / palette-snap radius
  monotonousMin: 12,      // gaps needed before spacing can be monotonous
  monotonousShare: 0.6,   // dominant gap share that makes it monotonous
  flatRatio: 1.5,         // largest / body under this is flat
  flatMinText: 5,         // text elements needed before hierarchy can be flat
  unchangedBits: 3,       // pHash Hamming distance at or under this is unchanged
}

// ------------------------------------------------------------- color helpers
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`
const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
function normHex(h) {
  h = h.toLowerCase()
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
function lab(hex) {
  const [r, g, b] = fromHex(hex).map(lin)
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 1.0
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
function hsl(hex) {
  const [r, g, b] = fromHex(hex).map((c) => c / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { s, l }
}
const luminance = (hex) => { const [r, g, b] = fromHex(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrastRatio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const r2 = (n) => Math.round(n * 100) / 100

// --------------------------------------------------------- layer 1, in page
// Runs inside the page via Runtime.evaluate. One pass over the visible
// elements with a computed-style cache; returns raw tallies, the per-text
// records and the histograms. Everything that is arithmetic on those happens
// in Node below.
function pageMeasure() {
  const MAX = 5000, TOPCAP = 6000
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE'])
  const csCache = new Map()
  const cs = (el) => { let c = csCache.get(el); if (!c) { c = getComputedStyle(el); csCache.set(el, c) } return c }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const colorCache = new Map()
  function parseColor(str) {
    if (!str) return [0, 0, 0, 0]
    let c = colorCache.get(str); if (c) return c
    const m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/)
    if (m) c = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])]
    else if (str === 'transparent') c = [0, 0, 0, 0]
    else { // modern color syntaxes: let the canvas resolve them to sRGB
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = str; ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data; c = [d[0], d[1], d[2], d[3] / 255]
    }
    colorCache.set(str, c); return c
  }
  const comp = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const h2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  const hex = (c) => `#${h2(c[0])}${h2(c[1])}${h2(c[2])}`
  // Effective background: composite background-color alpha up the ancestors
  // until opaque; any background-image met on the way makes it undecidable.
  const bgMemo = new Map()
  function effBg(el) {
    if (!el) return { rgb: [255, 255, 255], und: false }
    let v = bgMemo.get(el); if (v) return v
    const s = cs(el)
    const c = parseColor(s.backgroundColor)
    const img = !!s.backgroundImage && s.backgroundImage !== 'none'
    if (c[3] >= 1) v = { rgb: c.slice(0, 3), und: img }
    else { const p = effBg(el.parentElement); v = { rgb: c[3] > 0 ? comp(c, p.rgb) : p.rgb, und: img || p.und } }
    bgMemo.set(el, v); return v
  }
  const opMemo = new Map()
  function opacity(el) {
    if (!el) return 1
    let v = opMemo.get(el); if (v !== undefined) return v
    v = parseFloat(cs(el).opacity) * opacity(el.parentElement)
    opMemo.set(el, v); return v
  }
  function where(el) {
    const parts = []
    for (let e = el, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) {
      let p = e.tagName.toLowerCase()
      if (e.id) { parts.unshift(`${p}#${e.id}`); break }
      if (e.classList.length) p += '.' + [...e.classList].slice(0, 2).join('.')
      parts.unshift(p)
    }
    return parts.join(' > ')
  }
  const chCache = new Map()
  function chWidth(s) {
    const font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
    let w = chCache.get(font)
    if (w === undefined) { ctx.font = font; w = ctx.measureText('0').width || parseFloat(s.fontSize) * 0.5; chCache.set(font, w) }
    return w
  }
  const px = (v) => parseFloat(v) || 0

  const vis = []
  let truncated = false
  for (const el of document.querySelectorAll('body, body *')) {
    if (SKIP.has(el.tagName)) continue
    if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue
    const s = cs(el)
    if (s.display === 'none' || s.visibility !== 'visible') continue
    if (!(opacity(el) > 0)) continue
    const b = el.getBoundingClientRect()
    if (!(b.width > 0 && b.height > 0)) continue
    const top = b.top + scrollY
    if (top >= TOPCAP) continue
    if (vis.length >= MAX) { truncated = true; break }
    vis.push({ el, s, r: { top, left: b.left + scrollX, bottom: b.bottom + scrollY, right: b.right + scrollX, w: b.width, h: b.height } })
  }

  const tally = new Map()
  const add = (rgb, kind, el) => {
    const h = hex(rgb), k = `${h}|${kind}`
    let t = tally.get(k); if (!t) tally.set(k, (t = { hex: h, where: kind, count: 0, sample: where(el) }))
    t.count++
  }
  const texts = [], longLines = [], kids = new Map()
  const dec = { gradients: 0, shadows: 0, textShadows: 0, radii: {}, borderWeights: {} }
  const sides = ['Top', 'Right', 'Bottom', 'Left']

  for (const { el, s, r } of vis) {
    // direct, non-whitespace text
    let txt = ''
    for (const n of el.childNodes) if (n.nodeType === 3) txt += n.nodeValue
    txt = txt.replace(/\s+/g, ' ').trim()
    const bg = effBg(el)
    if (txt) {
      const fg = parseColor(s.color)
      const fgHex = hex(comp(fg, bg.rgb))
      add(comp(fg, bg.rgb), 'text', el)
      const size = px(s.fontSize)
      texts.push({ px: Math.round(size * 10) / 10, weight: parseInt(s.fontWeight, 10) || 400, family: s.fontFamily, chars: txt.length, fg: fgHex, bg: hex(bg.rgb), und: bg.und, where: where(el), sample: txt.slice(0, 60) })
      // long lines: block-level text boxes only
      if (s.display !== 'inline' && s.display !== 'contents') {
        const full = (el.textContent || '').replace(/\s+/g, ' ').trim()
        const content = r.w - px(s.paddingLeft) - px(s.paddingRight) - px(s.borderLeftWidth) - px(s.borderRightWidth)
        const capacity = content / chWidth(s)
        const ws = s.whiteSpace
        let lineCh
        if (ws === 'nowrap' || ws === 'pre') lineCh = Math.max(...(el.textContent || '').split('\n').map((l) => (ws === 'pre' ? l : l.replace(/\s+/g, ' ').trim()).length))
        else lineCh = capacity > 0 ? Math.min(full.length, capacity) : 0
        if (lineCh > 90) longLines.push({ ch: Math.round(lineCh), where: where(el), sample: full.slice(0, 60) })
      }
    }
    const bc = parseColor(s.backgroundColor)
    if (bc[3] > 0) add(comp(bc, effBg(el.parentElement).rgb), 'background', el)
    const borderHex = new Set()
    let maxBorder = 0
    for (const side of sides) {
      const w = px(s[`border${side}Width`]), st = s[`border${side}Style`]
      if (w > 0 && st !== 'none' && st !== 'hidden') {
        maxBorder = Math.max(maxBorder, w)
        const c = parseColor(s[`border${side}Color`])
        if (c[3] > 0) borderHex.add(hex(comp(c, bg.rgb)))
      }
    }
    for (const h of borderHex) add(h.match(/[0-9a-f]{2}/g).map((x) => parseInt(x, 16)), 'border', el)
    if (maxBorder > 0) { const k = Math.round(maxBorder * 10) / 10; dec.borderWeights[k] = (dec.borderWeights[k] || 0) + 1 }
    if (s.backgroundImage && s.backgroundImage.includes('gradient(')) dec.gradients++
    if (s.boxShadow && s.boxShadow !== 'none') dec.shadows++
    if (s.textShadow && s.textShadow !== 'none') dec.textShadows++
    let maxR = 0
    for (const c of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']) {
      const v = (s[c] || '0').split(' ')[0]
      const n = v.endsWith('%') ? (parseFloat(v) / 100) * Math.min(r.w, r.h) : px(v)
      maxR = Math.max(maxR, Math.min(n, Math.min(r.w, r.h) / 2))
    }
    if (maxR > 0) { const k = Math.round(maxR); dec.radii[k] = (dec.radii[k] || 0) + 1 }
    // children in normal flow, for sibling gaps (inline boxes are text flow, not layout)
    if (s.position !== 'absolute' && s.position !== 'fixed' && s.float === 'none' && s.display !== 'inline' && el.parentElement) {
      let a = kids.get(el.parentElement); if (!a) kids.set(el.parentElement, (a = [])); a.push(r)
    }
  }

  const gaps = {}
  for (const a of kids.values()) {
    if (a.length < 3) continue
    for (let i = 1; i < a.length; i++) {
      const p = a[i - 1], n = a[i]
      let g = null
      if (n.top >= p.bottom - 0.5) g = n.top - p.bottom
      else if (n.left >= p.right - 0.5) g = n.left - p.right
      if (g === null) continue
      g = Math.round(g)
      if (g > 0 && g < 400) gaps[g] = (gaps[g] || 0) + 1
    }
  }
  return {
    url: location.href, title: document.title, elements: vis.length, truncated,
    docHeight: Math.ceil(document.documentElement.scrollHeight),
    colorTally: [...tally.values()], texts, longLines, gaps, decoration: dec,
  }
}

// ----------------------------------------------------- layer 1, arithmetic
const SERIF = ['georgia', 'times', 'times new roman', 'garamond', 'eb garamond', 'baskerville', 'libre baskerville', 'palatino', 'palatino linotype', 'book antiqua', 'cambria', 'iowan old style', 'charter', 'bitstream charter', 'source serif pro', 'source serif 4', 'merriweather', 'playfair display', 'lora', 'pt serif', 'new york', 'didot', 'bodoni 72', 'hoefler text', 'big caslon', 'noto serif', 'ui-serif', 'serif']
const SANS = ['arial', 'helvetica', 'helvetica neue', 'inter', 'roboto', 'segoe ui', '-apple-system', 'blinkmacsystemfont', 'system-ui', 'sf pro', 'sf pro text', 'sf pro display', 'verdana', 'tahoma', 'trebuchet ms', 'open sans', 'lato', 'montserrat', 'noto sans', 'avenir', 'avenir next', 'gill sans', 'futura', 'ibm plex sans', 'source sans pro', 'ubuntu', 'cantarell', 'ui-sans-serif', 'sans-serif']
const MONO = ['menlo', 'monaco', 'consolas', 'courier', 'courier new', 'sf mono', 'jetbrains mono', 'fira code', 'fira mono', 'source code pro', 'ibm plex mono', 'roboto mono', 'ui-monospace', 'monospace']
const GENERIC = { serif: 'serif', 'ui-serif': 'serif', 'sans-serif': 'sans', 'ui-sans-serif': 'sans', 'system-ui': 'sans', monospace: 'mono', 'ui-monospace': 'mono', cursive: 'other', fantasy: 'other' }
const familyList = (stack) => stack.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase()).filter(Boolean)
function classify(stack) {
  const list = familyList(stack)
  const first = list[0] || ''
  if (SERIF.includes(first)) return 'serif'
  if (SANS.includes(first)) return 'sans'
  if (MONO.includes(first)) return 'mono'
  for (let i = list.length - 1; i >= 0; i--) if (GENERIC[list[i]]) return GENERIC[list[i]]
  return 'other'
}
const firstFamily = (stack) => (stack.split(',')[0] || '').trim().replace(/^["']|["']$/g, '')

function analyzeType(texts, longLines) {
  const fam = new Map(), sizes = {}
  for (const t of texts) {
    const f = firstFamily(t.family)
    const e = fam.get(f) || { family: f, generic: classify(t.family), chars: 0 }
    e.chars += t.chars; fam.set(f, e)
    sizes[t.px] = (sizes[t.px] || 0) + t.chars
  }
  let body = null, best = -1
  for (const [k, v] of Object.entries(sizes)) if (v > best || (v === best && +k < body)) { best = v; body = +k }
  const largest = texts.length ? Math.max(...texts.map((t) => t.px)) : null
  const tiny = texts.filter((t) => t.px < T.tinyPx)
  return {
    families: [...fam.values()].sort((a, b) => b.chars - a.chars),
    sizes, body, largest,
    hierarchyRatio: body ? r2(largest / body) : null,
    displayCount: body ? texts.filter((t) => t.px >= 2 * body).length : 0,
    textElements: texts.length,
    tinyText: { count: tiny.length, samples: tiny.slice(0, 10).map((t) => ({ px: t.px, text: t.sample, where: t.where })) },
    longLines: { count: longLines.length, samples: longLines.slice(0, 10) },
  }
}

function analyzeContrast(texts) {
  const pairs = new Map()
  let undecidable = 0
  for (const t of texts) {
    if (t.und) { undecidable++; continue }
    const large = t.px >= 24 || (t.px >= 18.66 && t.weight >= 700)
    const k = `${t.fg}|${t.bg}|${large}`
    if (!pairs.has(k)) pairs.set(k, { fg: t.fg, bg: t.bg, large, ratio: r2(contrastRatio(t.fg, t.bg)), px: t.px, where: t.where, sample: t.sample, count: 0 })
    pairs.get(k).count++
  }
  const list = [...pairs.values()]
  const failing = list.filter((p) => p.ratio < (p.large ? T.aaLarge : T.aa))
    .map(({ fg, bg, ratio, px, where, sample }) => ({ fg, bg, ratio, px, where, sample }))
  return {
    pairs: list.map(({ fg, bg, large, ratio, count }) => ({ fg, bg, large, ratio, count })),
    failing, undecidable,
    minRatio: list.length ? Math.min(...list.map((p) => p.ratio)) : null,
  }
}

function analyzeColors(tally, palette) {
  const byHex = new Map()
  for (const t of tally) byHex.set(t.hex, (byHex.get(t.hex) || 0) + t.count)
  const clusters = []
  for (const [hex, count] of [...byHex].sort((a, b) => b[1] - a[1])) {
    const c = clusters.find((k) => deltaE(k.hex, hex) <= T.deltaE)
    if (c) { c.count += count; c.members.push(hex) } else clusters.push({ hex, count, members: [hex] })
  }
  const accents = clusters.filter((c) => { const { s, l } = hsl(c.hex); return s > 0.25 && l > 0.15 && l < 0.85 }).map((c) => c.hex)
  let offPalette = null, onPalette = null
  if (palette && palette.length) {
    offPalette = []; onPalette = {}
    for (const t of tally) {
      let best = null, bd = Infinity
      for (const p of palette) { const d = deltaE(p, t.hex); if (d < bd) { bd = d; best = p } }
      if (bd <= T.deltaE) onPalette[best] = (onPalette[best] || 0) + t.count
      else offPalette.push({ hex: t.hex, count: t.count, where: t.where, sample: t.sample })
    }
    offPalette.sort((a, b) => b.count - a.count)
  }
  return {
    distinct: clusters.length,
    used: [...byHex].sort((a, b) => b[1] - a[1]).map(([hex, count]) => ({ hex, count })),
    clusters: clusters.map(({ hex, count, members }) => ({ hex, count, members })),
    accents, offPalette, onPalette,
  }
}

function analyzeSpacing(gaps) {
  const total = Object.values(gaps).reduce((a, b) => a + b, 0)
  let dominant = null
  for (const [k, v] of Object.entries(gaps)) if (!dominant || v > dominant.count) dominant = { px: +k, count: v }
  const share = dominant ? r2(dominant.count / total) : 0
  return {
    histogram: gaps, total,
    dominant: dominant ? { px: dominant.px, share } : null,
    monotonous: total >= T.monotonousMin && share >= T.monotonousShare,
  }
}

function analyzeDecoration(d) {
  const keys = (h) => Object.keys(h).map(Number)
  return {
    gradients: d.gradients, shadows: d.shadows, textShadows: d.textShadows,
    radii: d.radii, maxRadius: keys(d.radii).length ? Math.max(...keys(d.radii)) : 0,
    borderWeights: d.borderWeights, maxBorderWeight: keys(d.borderWeights).length ? Math.max(...keys(d.borderWeights)) : 0,
  }
}

// ------------------------------------------------------ layer 2, the PNG
function decodePngBuiltin(buf) {
  const SIG = '89504e470d0a1a0a'
  if (buf.subarray(0, 8).toString('hex') !== SIG) throw new Error('not a PNG')
  let off = 8, w, h, depth, ctype, interlace
  const idat = []
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    off += 12 + len
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype]
  if (depth !== 8 || interlace !== 0 || !ch) throw new Error(`unsupported PNG (depth ${depth}, color type ${ctype}, interlace ${interlace})`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(w * h * 4)
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride)
  for (let y = 0, p = 0; y < h; y++) {
    const ft = raw[p++]
    for (let i = 0; i < stride; i++) {
      const x = raw[p++]
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0
      let v
      switch (ft) {
        case 0: v = x; break
        case 1: v = x + a; break
        case 2: v = x + b; break
        case 3: v = x + ((a + b) >> 1); break
        case 4: { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break }
        default: throw new Error(`bad PNG filter ${ft}`)
      }
      cur[i] = v & 255
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch
      if (ch >= 3) { out[o] = cur[i]; out[o + 1] = cur[i + 1]; out[o + 2] = cur[i + 2]; out[o + 3] = ch === 4 ? cur[i + 3] : 255 }
      else { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = ch === 2 ? cur[i + 1] : 255 }
    }
    ;[prev, cur] = [cur, prev]
  }
  return { data: out, width: w, height: h }
}

// sharp when it can be imported (an optional dependency), else the builtin
// decoder, which handles Chrome's own output. Both yield the same RGBA bytes.
let sharpMod
async function decodePng(buf) {
  if (sharpMod === undefined) {
    try { sharpMod = (await import('sharp')).default } catch { sharpMod = null }
  }
  if (sharpMod) {
    try {
      const { data, info } = await sharpMod(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      return { data, width: info.width, height: info.height, decoder: 'sharp' }
    } catch {}
  }
  return { ...decodePngBuiltin(buf), decoder: 'builtin' }
}

// 32x32 area-averaged grayscale, DCT-II, top-left 8x8 minus DC, median
// threshold. 64 bits; the DC bit is always 0.
function phash(cells) {
  const N = 32
  const cos = []
  for (let u = 0; u < 8; u++) { cos.push([]); for (let x = 0; x < N; x++) cos[u].push(Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))) }
  const coef = []
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
    let sum = 0
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) sum += cells[y * N + x] * cos[u][y] * cos[v][x]
    const cu = u === 0 ? Math.SQRT1_2 : 1, cv = v === 0 ? Math.SQRT1_2 : 1
    coef.push((2 / N) * cu * cv * sum)
  }
  const med = coef.slice(1).sort((a, b) => a - b)[31] // 63 AC values; index 31 is the median
  let bits = ''
  for (let i = 0; i < 64; i++) bits += i === 0 ? '0' : coef[i] > med ? '1' : '0'
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}
function hamming(a, b) {
  let d = 0
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    let x = parseInt(a[i] || '0', 16) ^ parseInt(b[i] || '0', 16)
    while (x) { d += x & 1; x >>= 1 }
  }
  return d
}

function analyzePixels({ data, width: W, height: H }) {
  const total = W * H
  const gray = new Uint8Array(total)
  const buckets = new Uint32Array(4096)
  const sums = new Float64Array(4096 * 3)
  const cellSum = new Float64Array(1024), cellCnt = new Uint32Array(1024)
  for (let y = 0, i = 0; y < H; y++) {
    const cy = Math.min(31, Math.floor((y * 32) / H)) * 32
    for (let x = 0; x < W; x++, i++) {
      const o = i * 4, r = data[o], g = data[o + 1], b = data[o + 2]
      const l = 0.299 * r + 0.587 * g + 0.114 * b
      gray[i] = l
      const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      buckets[q]++; sums[q * 3] += r; sums[q * 3 + 1] += g; sums[q * 3 + 2] += b
      const c = cy + Math.min(31, Math.floor((x * 32) / W))
      cellSum[c] += l; cellCnt[c]++
    }
  }
  let mode = 0
  for (let q = 1; q < 4096; q++) if (buckets[q] > buckets[mode]) mode = q
  const mr = sums[mode * 3] / buckets[mode], mg = sums[mode * 3 + 1] / buckets[mode], mb = sums[mode * 3 + 2] / buckets[mode]
  let ws = 0, edges = 0
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const o = i * 4
      if (Math.abs(data[o] - mr) <= 10 && Math.abs(data[o + 1] - mg) <= 10 && Math.abs(data[o + 2] - mb) <= 10) ws++
      const dx = x + 1 < W ? Math.abs(gray[i + 1] - gray[i]) : 0
      const dy = y + 1 < H ? Math.abs(gray[i + W] - gray[i]) : 0
      if (dx + dy > 40) edges++
    }
  }
  let quantized = 0
  for (let q = 0; q < 4096; q++) if (buckets[q] >= total * 0.0005) quantized++
  const cells = Array.from(cellSum, (s, i) => (cellCnt[i] ? s / cellCnt[i] : 0))
  return {
    width: W, height: H, hash: phash(cells),
    whitespaceRatio: Math.round((ws / total) * 1000) / 1000,
    edgeDensity: Math.round((edges / total) * 1000) / 1000,
    quantizedColors: quantized,
  }
}

// ------------------------------------------------------- layer 3, the brief
const HEADING = /^(?:#{1,6}\s+\S.*|[A-Za-z][^:\n]*:\s*)$/
function section(lines, startRe) {
  const i = lines.findIndex((l) => startRe.test(l))
  if (i < 0) return null
  const out = []
  for (let j = i + 1; j < lines.length; j++) { if (HEADING.test(lines[j])) break; out.push(lines[j]) }
  return { start: i, lines: out }
}
const HEX_RE = /#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi

export function parseBrief(md) {
  const lines = md.split(/\r?\n/)
  const palette = new Set()
  const tr = section(lines, /^(?:#+\s*)?Translation:?\s*$/i)
  if (tr) for (const l of tr.lines) for (const m of l.matchAll(HEX_RE)) palette.add(normHex(m[0]))
  // A code palette: any heading naming "palette", or a fenced block whose
  // info string does.
  lines.forEach((l, i) => {
    if (HEADING.test(l) && /palette/i.test(l) && i !== (tr && tr.start)) {
      for (let j = i + 1; j < lines.length && !HEADING.test(lines[j]); j++) for (const m of lines[j].matchAll(HEX_RE)) palette.add(normHex(m[0]))
    }
    if (/^\s*```.*palette/i.test(l)) {
      for (let j = i + 1; j < lines.length && !/^\s*```/.test(lines[j]); j++) for (const m of lines[j].matchAll(HEX_RE)) palette.add(normHex(m[0]))
    }
  })

  const rules = []
  const start = lines.findIndex((l) => /^Rules:\s*$/.test(l) || /^#+\s*Rules\b/i.test(l))
  if (start >= 0) {
    let cur = null
    for (let j = start + 1; j < lines.length; j++) {
      const l = lines[j]
      if (/^\s*```/.test(l) && !cur) continue
      const num = l.match(/^\s*(\d+)\.\s+(.*)$/)
      const mach = l.match(/^\s*(?:[-*]\s*)?`?machine:\s*(.*?)`?\s*$/i)
      if (mach && cur) { if (cur.machine === null) cur.machine = mach[1].trim(); continue }
      if (num) { cur = { n: +num[1], text: num[2].trim(), machine: null }; rules.push(cur); continue }
      if (!l.trim()) continue
      if (HEADING.test(l) || /^\s*```/.test(l)) break
      if (cur && cur.machine === null && /^\s+/.test(l)) cur.text += ' ' + l.trim()
    }
  }
  return { palette: [...palette], rules }
}

function bandShare(texts, body, band, generic) {
  const inBand = texts.filter((t) => (band === 'display' ? t.px >= 1.5 * body : Math.abs(t.px - body) <= 1))
  const chars = inBand.reduce((a, t) => a + t.chars, 0)
  const hit = inBand.filter((t) => classify(t.family) === generic).reduce((a, t) => a + t.chars, 0)
  return { chars, share: chars ? hit / chars : 0 }
}

function evalRule(rule, ctx) {
  const out = (status, evidence) => ({ n: rule.n, text: rule.text, machine: rule.machine, status, evidence })
  if (rule.machine === null) return out('critic-only', 'no machine line')
  const e = rule.machine.toLowerCase().replace(/\s+/g, ' ').trim()
  const { page, palette, texts } = ctx
  let m
  if (e === 'none') return out('critic-only', 'machine: none')
  if ((m = e.match(/^accent-colors ?<= ?(\d+)$/))) {
    const a = page.colors.accents
    return out(a.length <= +m[1] ? 'pass' : 'fail', `${a.length} accent color(s)${a.length ? ': ' + a.join(' ') : ''} (limit ${m[1]})`)
  }
  if (e === 'palette-only') {
    if (!palette.length) return out('unparsed', 'palette-only needs a palette; the brief names none')
    const off = page.colors.offPalette
    return out(off.length ? 'fail' : 'pass', off.length ? `${off.length} off-palette: ${[...new Set(off.map((o) => o.hex))].slice(0, 6).join(' ')}` : `all colors within ΔE ${T.deltaE} of the palette`)
  }
  if ((m = e.match(/^families ?== ?\{(.*)\}$/))) {
    const pairs = m[1].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.match(/^(serif|sans|mono) ?: ?(display|body)$/))
    if (!pairs.length || pairs.some((p) => !p)) return out('unparsed', `unparsed: "${rule.machine}"`)
    const body = page.type.body
    if (!body) return out('fail', 'no text on the page')
    let ok = true
    const ev = pairs.map(([, generic, band]) => {
      const { chars, share } = bandShare(texts, body, band, generic)
      if (!chars || share < 0.8) ok = false
      return chars ? `${band} ${Math.round(share * 100)}% ${generic} of ${chars} chars` : `${band}: no text in band`
    })
    return out(ok ? 'pass' : 'fail', ev.join('; '))
  }
  if (/^no gradients?$/.test(e)) { const n = page.decoration.gradients; return out(n === 0 ? 'pass' : 'fail', `${n} gradient(s)`) }
  if (/^no shadows?$/.test(e)) { const n = page.decoration.shadows; return out(n === 0 ? 'pass' : 'fail', `${n} box-shadow(s)`) }
  if ((m = e.match(/^radius ?<= ?(\d+(?:\.\d+)?) ?px$/))) { const v = page.decoration.maxRadius; return out(v <= +m[1] ? 'pass' : 'fail', `max radius ${v}px (limit ${m[1]}px)`) }
  if ((m = e.match(/^border-weight ?<= ?(\d+(?:\.\d+)?) ?px$/))) { const v = page.decoration.maxBorderWeight; return out(v <= +m[1] ? 'pass' : 'fail', `max border ${v}px (limit ${m[1]}px)`) }
  if ((m = e.match(/^min-text ?>= ?(\d+(?:\.\d+)?) ?px$/))) {
    const under = texts.filter((t) => t.px < +m[1])
    const min = texts.length ? Math.min(...texts.map((t) => t.px)) : null
    return out(under.length ? 'fail' : 'pass', `smallest text ${min ?? 'n/a'}px; ${under.length} element(s) under ${m[1]}px`)
  }
  if (/^contrast ?>= ?aa$/.test(e)) {
    const f = page.contrast.failing
    return out(f.length ? 'fail' : 'pass', `${f.length} AA failure(s); min ratio ${page.contrast.minRatio ?? 'n/a'}; ${page.contrast.undecidable} undecidable`)
  }
  return out('unparsed', `unparsed: "${rule.machine}"`)
}

// -------------------------------------------------------------- findings
function findings(page, brief, rules) {
  const f = []
  const t = page.type
  if (t.tinyText.count) {
    const min = Math.min(...t.tinyText.samples.map((s) => s.px)), s = t.tinyText.samples[0]
    f.push({ id: 'tiny-text', message: `${t.tinyText.count} text element(s) under ${T.tinyPx}px, smallest ${min}px, e.g. "${s.text.slice(0, 40)}"`, where: s.where, count: t.tinyText.count })
  }
  if (t.longLines.count) {
    const top = [...t.longLines.samples].sort((a, b) => b.ch - a.ch)[0]
    f.push({ id: 'long-lines', message: `${t.longLines.count} text block(s) over ${T.longCh}ch, longest ${top.ch}ch`, where: top.where, count: t.longLines.count })
  }
  if (page.contrast.failing.length) {
    const w = [...page.contrast.failing].sort((a, b) => a.ratio - b.ratio)[0]
    f.push({ id: 'contrast', message: `${page.contrast.failing.length} text color pair(s) below WCAG AA, lowest ${w.ratio}:1 (${w.fg} on ${w.bg} at ${w.px}px)`, where: w.where, count: page.contrast.failing.length })
  }
  if (page.spacing.monotonous) {
    const d = page.spacing.dominant
    f.push({ id: 'monotonous-spacing', message: `${Math.round(d.share * 100)}% of ${page.spacing.total} sibling gaps are ${d.px}px`, count: page.spacing.total })
  }
  if (t.textElements >= T.flatMinText && t.hierarchyRatio !== null && t.hierarchyRatio < T.flatRatio) {
    f.push({ id: 'flat-hierarchy', message: `largest text is ${t.hierarchyRatio}x body (${t.largest}px over ${t.body}px), under ${T.flatRatio}x` })
  }
  if (brief && brief.palette.length && page.colors.offPalette && page.colors.offPalette.length) {
    const o = page.colors.offPalette
    f.push({ id: 'off-palette', message: `${new Set(o.map((x) => x.hex)).size} color(s) outside the brief palette, e.g. ${o[0].hex} (${o[0].where})`, where: o[0].sample, count: o.length })
  }
  for (const r of rules) if (r.status === 'fail') f.push({ id: 'rule-failed', rule: r.n, message: `rule ${r.n} failed: ${r.evidence}` })
  return f
}

// ------------------------------------------------------------------ CLI
function parseArgs(argv) {
  const o = { width: 1280, json: false, brief: null, previous: null, shot: null, src: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const val = () => { if (i + 1 >= argv.length) throw new Error(`${a} needs a value`); return argv[++i] }
    if (a === '--json') o.json = true
    else if (a === '--brief') o.brief = val()
    else if (a === '--previous') o.previous = val()
    else if (a === '--shot') o.shot = val()
    else if (a === '--width') { o.width = Number(val()); if (!(o.width > 0)) throw new Error('--width must be a positive number') }
    else if (a.startsWith('--')) throw new Error(`unknown flag ${a}`)
    else if (!o.src) o.src = a
    else throw new Error(`unexpected argument ${a}`)
  }
  if (!o.src) throw new Error('missing <url-or-file>')
  return o
}

function toUrl(src) {
  if (/^(https?|file):\/\//i.test(src)) return src
  const abs = resolve(src)
  if (!existsSync(abs)) throw new Error(`page failed to load: no such file ${abs}`)
  return pathToFileURL(abs).href
}

async function main() {
  let opts
  try { opts = parseArgs(process.argv.slice(2)) } catch (e) { console.error(`detect: ${e.message}\n${USAGE}`); return 1 }

  let brief = null
  if (opts.brief) {
    let md
    try { md = readFileSync(opts.brief, 'utf8') } catch (e) { console.error(`detect: cannot read brief ${opts.brief}: ${e.message}`); return 1 }
    brief = { path: opts.brief, ...parseBrief(md) }
  }
  let previousPng = null
  if (opts.previous) {
    try { previousPng = readFileSync(opts.previous) } catch (e) { console.error(`detect: cannot read --previous ${opts.previous}: ${e.message}`); return 1 }
  }
  let url
  try { url = toUrl(opts.src) } catch (e) { console.error(`detect: ${e.message}`); return 1 }

  const chrome = findChrome()
  if (!chrome) { console.error(NO_CHROME); return 1 }

  const profileDir = mkdtempSync(join(tmpdir(), 'design-director-detect-'))
  const { proc, port, kill } = launchChrome({ width: opts.width, profileDir, chrome })
  let raw, png, height
  try {
    const client = await connect(port)
    const tab = await client.attach('about:blank', { width: opts.width })
    const res = await tab.nav(url)
    if (res.errorText) throw new Error(`page failed to load: ${res.errorText} (${url})`)
    await tab.prepare()
    // Measure at the same viewport the full-page PNG is taken at, so the
    // DOM numbers and the pixels describe the same layout.
    height = await tab.pageHeight()
    await tab.viewport(Math.max(height, 900))
    await new Promise((r) => setTimeout(r, 400))
    raw = await tab.evalJs(`(${pageMeasure.toString()})()`)
    if (!raw) throw new Error('page measurement returned nothing')
    png = (await tab.screenshot(true)).data
    // Ask Chrome to close itself so its helpers exit with it; the kill
    // below is the guarantee, this is the courtesy.
    await Promise.race([client.send('Browser.close').catch(() => {}), new Promise((r) => setTimeout(r, 1000))])
    client.close()
  } catch (e) {
    console.error(`detect: ${e.message}`)
    return 1
  } finally {
    kill()
    await Promise.race([new Promise((r) => proc.once('exit', r)), new Promise((r) => setTimeout(r, 3000))])
    try { rmSync(profileDir, { recursive: true, force: true }) } catch {}
  }

  if (opts.shot) {
    try { mkdirSync(dirname(resolve(opts.shot)), { recursive: true }); writeFileSync(opts.shot, png) }
    catch (e) { console.error(`detect: cannot write --shot ${opts.shot}: ${e.message}`); return 1 }
  }

  const palette = brief ? brief.palette : []
  const page = {
    url: raw.url, title: raw.title, elements: raw.elements, truncated: raw.truncated, height: raw.docHeight,
    colors: analyzeColors(raw.colorTally, palette),
    type: analyzeType(raw.texts, raw.longLines),
    spacing: analyzeSpacing(raw.gaps),
    contrast: analyzeContrast(raw.texts),
    decoration: analyzeDecoration(raw.decoration),
  }

  let screenshot
  try {
    const img = await decodePng(png)
    screenshot = { decoder: img.decoder, ...analyzePixels(img), previous: null }
    if (previousPng) {
      const prev = await decodePng(previousPng)
      const hash = analyzePixels(prev).hash
      const distance = hamming(screenshot.hash, hash)
      screenshot.previous = { path: opts.previous, hash, distance, unchanged: distance <= T.unchangedBits }
    }
  } catch (e) { console.error(`detect: screenshot analysis failed: ${e.message}`); return 1 }

  const rules = brief ? brief.rules.map((r) => evalRule(r, { page, palette, texts: raw.texts })) : []
  const found = findings(page, brief, rules)
  const count = (s) => rules.filter((r) => r.status === s).length
  const summary = {
    findings: found.length,
    rules: { passed: count('pass'), compiled: count('pass') + count('fail'), criticOnly: count('critic-only'), unparsed: count('unparsed') },
    unchanged: screenshot.previous ? screenshot.previous.unchanged : null,
  }
  const doc = {
    version: 1, source: opts.src, width: opts.width, shot: opts.shot || null,
    page, screenshot,
    brief: brief ? { path: brief.path, palette: brief.palette, rules } : null,
    findings: found, summary,
  }

  if (opts.json) process.stdout.write(JSON.stringify(doc, null, 2) + '\n')
  else {
    const out = []
    for (const f of found) out.push(`finding  ${f.id}  ${f.message}${f.where ? `  [${f.where}]` : ''}`)
    for (const r of rules) out.push(`rule ${r.n}  ${r.status}  ${r.evidence}`)
    const d = screenshot.previous ? screenshot.previous.distance : 'n/a'
    out.push(`summary  ${found.length} findings · rules ${summary.rules.passed}/${summary.rules.compiled} · critic-only ${summary.rules.criticOnly} · hash distance ${d}`)
    process.stdout.write(out.join('\n') + '\n')
  }
  return found.length ? 2 : 0
}

export { evalRule }

// Exit only after stdout drains: a piped consumer must get the whole JSON.
// Imported (by the tests) rather than run, it only exports.
const isMain = (() => { try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href } catch { return false } })()
if (isMain) main().then(
  (code) => process.stdout.write('', () => process.exit(code)),
  (e) => { console.error(`detect: ${e && e.stack ? e.stack : e}`); process.exit(1) },
)
