// The QR format itself, as pure functions of a network config (src/network.js) - no browser/Vite imports, so
// node tests can load it (test/qr.test.mjs). The app uses the NET-bound wrappers in src/qr.js.
//
// FORMAT = EIP-681 (owner decision 2026-10-03: "sửa QR thành chuẩn EVM", so MetaMask & co. can scan it; the
// "only send on Arc" warning lives in the app's notifications). Spec: https://eips.ethereum.org/EIPS/eip-681
//   plain address : ethereum:<addr>@<chainId>
//   with amount   : ethereum:<token>@<chainId>/transfer?address=<addr>&uint256=<base units>
// USDC/EURC are ERC-20 contracts on Arc (6 decimals), so an amount QR is a token `transfer`, never `value=`.
import { formatUnits } from 'viem'
import { amountProblem, toAmountString, toBaseUnits, isValidAddress } from './money.js'

// App currency code → token: 'USD' = USDC (the friendly label), a token symbol (USDC/EURC/cirBTC) = itself, and the
// legacy 'EUR' = EURC. Bug fixed 2026-10-06: only USD/EUR were mapped, so a QR made in USDC/EURC/cirBTC on Create QR
// carried NO amount at all (a bare address QR).
const TOKEN_OF = { USD: 'USDC', EUR: 'EURC' }
const tokenFor = (net, currency) => net.tokens[currency] ? currency : TOKEN_OF[currency || 'USD']
// Token read from a QR → the currency code the Send screen uses ('USD' | 'EURC' | 'cirBTC'). Was 'EUR', which Send does
// not list, so a scanned EURC QR lost its amount (bug 2026-10-06).
const CUR_OF = (sym) => sym === 'USDC' ? 'USD' : sym

export function buildQRFor(net, addr, { amount, currency } = {}) {
  const amt = Number(amount)
  const token = net.tokens[tokenFor(net, currency)]
  if (!(amt > 0) || !token) return `ethereum:${addr}@${net.chainId}`
  const units = toBaseUnits(toAmountString(amt, token.decimals), token.decimals)
  return `ethereum:${token.address}@${net.chainId}/transfer?address=${addr}&uint256=${units}`
}

// Returns { address, amount, currency } · null if unreadable · { wrongChain: <id> } when the QR names another chain
// (so the scan screen can say why, instead of a vague "invalid QR").
//
// Accepts, in order:
//   1. ethereum:[pay-]<token>@<chainId>/transfer?address=<addr>&uint256=<n>  ← amount QR (ours, or another wallet's)
//   2. ethereum:[pay-]<addr>[@<chainId>][?…]                                  ← plain address QR (other params ignored)
//   3. ezwallet:<addr>[@<chainId>][?amount=&cur=]   ← the app's OWN format until 2026-10-03 (and before 08-13 without
//      @chain). STILL ACCEPTED: QRs users already printed/saved/sent as images must keep working.
//   4. bare 0x…                                     ← an address QR from an outside source (exchange, other wallet).
// A missing @chainId means "no chain stated" → read as this network, like a bare address.
// Default currency 'USD' - never 'VND' (bug 08-12).
export function parseQRFor(net, text) {
  const raw = String(text || '').trim()

  const e = raw.match(/^ethereum:(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?(\/[A-Za-z]\w*)?(?:\?(.*))?$/)
  if (e) {
    const chain = e[2] ? Number(e[2]) : net.chainId
    if (chain !== net.chainId) return { wrongChain: chain }
    if (!isValidAddress(e[1])) return null
    const params = new URLSearchParams(e[4] || '')
    if (!e[3]) return { address: e[1], amount: null, currency: 'USD' }
    if (e[3] !== '/transfer') return null
    // Token transfer: e[1] is the TOKEN contract, the recipient is ?address=. Only our own tokens are understood -
    // an unknown token would otherwise open the amount screen in USDC for a different asset.
    const sym = Object.keys(net.tokens).find(s => net.tokens[s].address.toLowerCase() === e[1].toLowerCase())
    const to = params.get('address')
    if (!sym || !isValidAddress(to)) return null
    const dec = net.tokens[sym].decimals
    const n = params.get('uint256')
    const amount = n && /^\d+$/.test(n) ? formatUnits(BigInt(n), dec) : null
    return { address: to, amount: amount && !amountProblem(amount, dec) ? amount : null, currency: CUR_OF(sym) }
  }

  const m = raw.match(/^ezwallet:(0x[0-9a-fA-F]{40})(?:@(\d+))?(?:\?amount=([\d.]+))?(?:&cur=(\w+))?$/)
  if (m) {
    const chain = m[2] ? Number(m[2]) : net.chainId
    if (chain !== net.chainId) return { wrongChain: chain }
    if (!isValidAddress(m[1])) return null   // a mistyped/forged mixed-case address fails its checksum
    // The QR amount stays a STRING and must be a clean decimal with ≤ 6 places (USDC/EURC) - otherwise it is
    // dropped and the user types the amount (MAINNET-AUDIT H1: "0.004" used to be sent as 0).
    const amount = m[3] && !amountProblem(m[3], 6) ? m[3] : null
    return { address: m[1], amount, currency: m[4] === 'EUR' ? 'EURC' : (m[4] || 'USD') }
  }

  if (isValidAddress(raw)) return { address: raw, amount: null, currency: 'USD' }
  return null
}
