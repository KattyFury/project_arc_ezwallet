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
