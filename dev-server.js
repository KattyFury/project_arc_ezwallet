// Local dev server (Windows) - proxies the Circle API actions that Vite calls through /api/*.
// Do NOT use `wrangler pages dev` on Windows (the "write EOF" error - see HANDOFF).
// It imports the REAL handlers from functions/api/*.js DIRECTLY (no copy-paste) → local logic
// and the Cloudflare deploy always match, with no hand-syncing to forget.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import * as session from './functions/api/session.js'
import * as wallet from './functions/api/wallet.js'
import * as send from './functions/api/send.js'
import * as swap from './functions/api/swap.js'
import * as earn from './functions/api/earn.js'
import * as sync from './functions/api/sync.js'
import * as health from './functions/api/health.js'
import * as auth from './functions/api/auth.js'
import * as inbox from './functions/api/inbox.js'
import * as prices from './functions/api/prices.js'

const PORT = 8787

// A FAKE KV for local use (Cloudflare KV only exists on a deploy): enough of the `get`/`put`/`delete` API for sync.js.
// `expirationTtl` is genuinely honoured (nonces/session tokens expire) so the PIN-signature auth flow behaves
// locally like it does on a deploy. The data lives in RAM → restarting dev-server clears it, which is the point: local is only for trying flows.
const fakeKV = (() => {
  const m = new Map()
  return {
    get: async k => {
      const rec = m.get(k)
      if (!rec) return null
      if (rec.exp && Date.now() > rec.exp) { m.delete(k); return null }
      return rec.v
    },
    put: async (k, v, opts) => {
      m.set(k, { v, exp: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : 0 })
      console.log(`[dev-server] KV put ${k} (${v.length} bytes)`)
    },
    delete: async k => { m.delete(k) },
  }
})()

function loadEnv() {
  const env = {}
  for (const file of ['.env.txt', '.dev.vars']) {
    try {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8')
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
        if (m) env[m[1]] = m[2]
      }
    } catch {}
  }
  return env
}
const env = loadEnv()
// Mainnet is the only network (2026-10-02). Production has no default; local dev gets it here.
env.NETWORK = env.NETWORK || 'mainnet'
if (!env.API_KEY) console.warn('[dev-server] API_KEY missing from .env.txt - any flow needing the Circle API will fail')

const ROUTES = {
  '/api/session': session,
  '/api/wallet': wallet,
  '/api/send': send,
  '/api/swap': swap,
  '/api/earn': earn,
  '/api/sync': sync,
  '/api/health': health,
  '/api/auth': auth,
  '/api/inbox': inbox,
  '/api/prices': prices,
}

const server = createServer(async (req, res) => {
  const mod = ROUTES[req.url.split('?')[0]]
  if (!mod) { res.writeHead(404).end('not found'); return }

  try {
    if (req.method === 'OPTIONS') {
      const r = await mod.onRequestOptions()
      res.writeHead(r.status, Object.fromEntries(r.headers))
      res.end()
      return
    }

    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks).toString('utf8')

    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' ? undefined : (body || undefined),
    })

    const handler = req.method === 'GET' ? mod.onRequestGet : mod.onRequestPost
    if (!handler) { res.writeHead(405).end('method not allowed'); return }
    const r = await handler({ request, env: { ...env, EZ_SYNC: fakeKV } })
    const text = await r.text()
    res.writeHead(r.status, Object.fromEntries(r.headers))
    res.end(text)
  } catch (e) {
    console.error('[dev-server] error:', e)
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: e.message }))
  }
})

server.listen(PORT, () => console.log(`[dev-server] proxying the Circle API at http://localhost:${PORT}`))
