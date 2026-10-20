// Locks the owner's type scale (2026-10-03, src/index.css :root --fs-*): every font size must come from a
// --fs-* token, and no token may be smaller than 14px. Fails on a literal size like fontSize: 'calc(18 * var(--u))',
// fontSize: 18, '18px' or font-size: calc(...) outside the token block.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = []
;(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(jsx?|css)$/.test(n)) files.push(p)
  }
})('src')

test('every font size uses a --fs-* token', () => {
  const bad = []
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*--fs-[a-z0-9-]+:/.test(line)) return   // the token definitions themselves
      for (const m of line.matchAll(/(?:fontSize|font-size)\s*:\s*([^,;}]+)/g)) {
        const v = m[1].trim().replace(/^['"]|['"]$/g, '')
        if (/^var\(--fs-[a-z0-9-]+\)/.test(v)) continue
        if (/^(fitSize|NOTIF_FS|inherit)\b/.test(v)) continue   // auto-fit amounts / the notification constant
        bad.push(`${f}:${i + 1}  ${m[0].trim()}`)
      }
    })
  }
  assert.deepEqual(bad, [], 'literal font sizes found - use a --fs-* token from src/index.css')
})

// 2026-10-20 (owner): the iOS-based scale of the nguyen0xhieu design system - no other size allowed.
const SCALE = [14, 16, 18, 22, 28, 34, 48]

test('every font token is on the design-system scale', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const sizes = [...css.matchAll(/--fs-([a-z0-9-]+):\s*calc\(([0-9.]+) \* var\(--u\)\)/g)].map(m => [m[1], Number(m[2])])
  assert.ok(sizes.length >= 10)
  for (const [name, px] of sizes) assert.ok(SCALE.includes(px), `--fs-${name} is ${px}px - not in ${SCALE.join('/')}`)
})

// 2026-10-20 (owner): line heights come in pairs with the sizes (14/20 16/24 18/24 22/28 28/36 34/40 48/56) and are
// never set by hand - only the --lh-* tokens, or the paired value useFitFontSize returns for auto-fit amounts.
const LINE = { 14: 20, 16: 24, 18: 24, 22: 28, 28: 36, 34: 40, 48: 56 }

test('every --lh-* token is the pair of its --fs-* token', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const fs = Object.fromEntries([...css.matchAll(/--fs-([a-z0-9-]+):\s*calc\(([0-9.]+) \* var\(--u\)\)/g)].map(m => [m[1], Number(m[2])]))
  const lh = Object.fromEntries([...css.matchAll(/--lh-([a-z0-9-]+):\s*calc\(([0-9.]+) \* var\(--u\)\)/g)].map(m => [m[1], Number(m[2])]))
  for (const [name, px] of Object.entries(fs)) assert.equal(lh[name], LINE[px], `--lh-${name} should be ${LINE[px]} for --fs-${name} ${px}`)
})

test('no hand-set line heights', () => {
  const bad = []
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      for (const m of line.matchAll(/(?:lineHeight|line-height)\s*:\s*([^,;}]+)/g)) {
        const v = m[1].trim()
        if (/^var\(--lh-[a-z0-9-]+\)/.test(v) || v === 'fitLine') continue
        bad.push(`${f}:${i + 1}  ${m[0].trim()}`)
      }
    })
  }
  assert.deepEqual(bad, [], 'use the --lh-* token paired with the font size')
})

// 2026-10-20 (owner): every padding / margin / gap in the screens is on the 8-grid (PctSlider's track internals and
// negative hit-area margins excepted).
test('spacing is a multiple of 8', () => {
  const bad = []
  for (const f of files) {
    if (!f.endsWith('.jsx') || f.endsWith('PctSlider.jsx')) continue
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return
      for (const m of line.matchAll(/\b(?:padding|margin|gap|rowGap|columnGap)(?:Top|Bottom|Left|Right)?\s*:\s*['`]([^'`]*)['`]/g))
        for (const k of m[1].matchAll(/calc\(([0-9.]+) \* var\(--u\)\)/g))
          if (Number(k[1]) % 8) bad.push(`${f}:${i + 1}  ${m[0]}`)
    })
  }
  assert.deepEqual(bad, [], 'spacing must be a multiple of 8')
})
