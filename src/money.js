// AMOUNT + ADDRESS VALIDATION - shared by the client (src/*) and the Pages Functions (functions/api/*).
// MAINNET-AUDIT.md H1/H6. The rules:
//   · An amount travels as a DECIMAL STRING from the keypad/QR all the way to the server, and only the server
//     turns it into base units - with integer math (viem parseUnits), never floats.
//   · Too many decimal places, zero, negatives, exponents ("1e3"), stray characters → REJECTED, never rounded.
//     (The old path sent toFixed(2): "0.004" typed or scanned left the wallet as 0, "0.009" as 0.01.)
//   · Addresses must be 0x + 40 hex; a MIXED-case address must also pass its EIP-55 checksum, which catches a
//     single mistyped character. All-lower/all-upper case carries no checksum and is accepted as is.
import { isAddress, parseUnits } from 'viem'

const AMOUNT_RE = /^(0|[1-9]\d*)(\.\d+)?$/

// Why an amount string is unacceptable for a token with `decimals` places, or null when it is fine.
export function amountProblem(str, decimals) {
  const s = String(str ?? '').trim()
  if (!AMOUNT_RE.test(s)) return 'Invalid amount'
  const frac = s.split('.')[1] || ''
  if (frac.length > decimals) return `At most ${decimals} decimal places`
  if (parseUnits(s, decimals) <= 0n) return 'Amount must be greater than 0'
  return null
}

// Decimal string → base units (bigint). Throws with a readable message instead of rounding.
export function toBaseUnits(str, decimals) {
  const problem = amountProblem(str, decimals)
  if (problem) throw new Error(problem)
  return parseUnits(String(str).trim(), decimals)
}

// A JS number the UI computed (slider %, balance share) → the decimal string to send, rounded DOWN to the
// token's decimals so it can never exceed what the user saw or holds. Integers stay integers.
export function toAmountString(num, decimals) {
  if (!(num > 0)) return '0'
  const scaled = Math.floor(num * 10 ** decimals + 1e-9)
  const s = (scaled / 10 ** decimals).toFixed(decimals)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

// Keypad input tidy-up before sending: "5." → "5", "007" never happens (the keypad blocks it).
export function normalizeTyped(str) {
  return String(str ?? '').replace(/\.$/, '')
}

export function isValidAddress(addr) {
  return isAddress(String(addr ?? '').trim(), { strict: true })
}

// A TOKEN amount for display only (owner 2026-10-06): 6 significant digits, so a huge meme balance does not show 18
// decimals and a small BTC amount keeps the decimals that matter - 1250000.123 → "1,250,000", 1234.5678 → "1,234.56",
// 0.00054912 → "0.00054912". Always rounded DOWN (never shows more than the real amount); `cut` = digits were dropped,
// so the screen can say "≈". The exact string is still what gets sent. Fiat ($/€/₫) has its own formatting (data.js).
export function fmtAmountShort(str, sig = 6) {
  const s = String(str ?? '').trim()
  if (!/^\d+(\.\d*)?$/.test(s)) return { text: s, cut: false }
  const [rawI, f = ''] = s.split('.')
  const i = rawI.replace(/^0+(?=\d)/, '')
  const intDigits = i === '0' ? 0 : i.length
  const keep = intDigits >= sig ? 0 : intDigits > 0 ? Math.max(2, sig - intDigits) : (f.match(/^0*/)[0].length + sig)
  const kept = f.slice(0, keep).replace(/0+$/, '')
  const cut = /[1-9]/.test(f.slice(keep))
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return { text: kept ? `${int}.${kept}` : int, cut }
}
