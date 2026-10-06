// The network this BUILD targets (VITE_NETWORK in .env.development / .env.mock / .env.production, or the Pages
// build environment). getNetwork throws on an unset/unknown name - a misbuilt app fails closed instead of
// quietly talking to the wrong chain. See src/network.js.
import { getNetwork, checkNetwork } from './network'
import { MOCK } from './mock'

export const NET = getNetwork(import.meta.env.VITE_NETWORK)

// ── The send/swap guard (MAINNET-AUDIT.md C2) ──
// Asks the server once which network it runs, then checks the chain FROM THE BROWSER (right chainId + contract code
// at every configured address). Not on the server: the public Arc RPC rate-limits Cloudflare Functions - see
// functions/api/health.js. Money is only allowed to move when BOTH sides agree and the check passed. Only a passed
// check is cached for the session; any failure is retried on the next attempt.
let _health = null
export function netHealth() {
  if (MOCK) return Promise.resolve({ ok: true, problems: [] })
  if (!_health) {
    _health = fetch('/api/health')
      .then(r => r.json())
      .then(async h => {
        if (h.error) return { ok: false, problems: [h.error] }
        if (h.network !== NET.key) return { ok: false, problems: [`server runs ${h.network}, this app was built for ${NET.key}`] }
        return checkNetwork(NET)
      })
      .catch(e => ({ ok: false, problems: [`cannot verify the network (${e.message})`] }))
      .then(r => { if (!r.ok) _health = null; return r })
  }
  return _health
}

// Throws a plain-English error when money must not move. Call it BEFORE creating any Circle challenge.
export async function assertNetworkReady() {
  const h = await netHealth()
  if (!h.ok) throw new Error(`Sending is paused for safety: ${h.problems[0]}`)
}

// THE NETWORK WARNING - one sentence, the SAME everywhere it appears (owner 2026-10-06), always red (--color-error /
// #FF383C on images): Home notification card, QR scanner, ShowQR, and every shared QR image. It is the most important
// line on those screens: money sent on another chain is lost.
export const NETWORK_NOTE = `Only available network: ${NET.label}`
