// Memes (Service hub → Memes) - buy/sell Argus launch tokens on Arc's Uniswap v4. Core + rules: ./_memeCore.js.
// LABS feature (src/labs.js): answers only on the labs hosts until the owner turns it on for ezwallet.cash.
// Actions: top · inspect · portfolio · quote · fee · execute (a contractExecution challenge → one PIN).
import { MEME_MAX_BUY_USD, MEME_SLIPPAGE_BPS, inspect, buySellCheck, simulate, swapBatch } from './_memeCore.js'
import { netFrom, netError } from './_net.js'
import { amountProblem, toBaseUnits } from '../../src/money.js'
import { isLabsHost } from '../../src/labs.js'

const W3S_API = 'https://api.circle.com/v1/w3s'
const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ok = (body) => new Response(JSON.stringify(body, (k, v) => typeof v === 'bigint' ? v.toString() : v), { headers: JSON_HEADERS })
const err = (msg, detail, status = 500) => {
  if (detail) console.error('[meme]', msg, JSON.stringify(detail, (k, v) => typeof v === 'bigint' ? v.toString() : v))
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS })
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || ''))
const ONE_USDC = 1000000n
const TOP_KV = 'memes:top:v1'
const TOP_FRESH_MS = 5 * 60 * 1000
// What the screen shows for a token (the pool key stays on the server).
const pub = ({ pool, hook, ...i }) => i

export async function onRequestPost(ctx) {
  let net
  try { net = netFrom(ctx) } catch (e) { return netError(e) }
  if (!isLabsHost(new URL(ctx.request.url).hostname)) return err('Memes is not available yet', null, 503)
  try {
    const body = await ctx.request.json()
    const { action, token, side, amount, walletAddress, walletId, userToken, minOut, refId } = body

    // TOP ARGUS MEMES (owner 2026-10-06: the dashboard on rows 5-8). Source = CoinGecko's on-chain API (GeckoTerminal
    // data, dex id 'argus' on network 'arc', sorted by 24h volume), Demo key server-side (COINGECKO_API), one result
    // cached in KV for 5 minutes for everyone (same budget rule as /api/prices). Tokens that NAME themselves like a
    // verified token (a "USDC" meme was #7 when measured 2026-10-06) are dropped - a copycat name is a scam signal.
    if (action === 'top') {
      const kv = ctx.env.EZ_SYNC
      let cached = null
      try { cached = kv ? JSON.parse(await kv.get(TOP_KV) || 'null') : null } catch {}
      if (cached && Date.now() - cached.ts < TOP_FRESH_MS) return ok(cached)
      const key = ctx.env.COINGECKO_API
      if (!key) return cached ? ok(cached) : err('COINGECKO_API not configured', null, 503)
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/onchain/networks/arc/dexes/argus/pools?sort=h24_volume_usd_desc&include=base_token', {
          headers: { 'x-cg-demo-api-key': key, 'User-Agent': 'ezwallet.cash memes', 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) })
        if (!r.ok) throw new Error(`CoinGecko ${r.status}`)
        const j = await r.json()
        const tokens = Object.fromEntries((j.included || []).map(t => [t.id, t.attributes]))
        const verified = new Set(Object.keys(net.tokens).map(s => s.toLowerCase()))
        const seen = new Set()
        const list = []
        for (const p of j.data || []) {
          const a = p.attributes, baseId = p.relationships?.base_token?.data?.id || '', quoteId = p.relationships?.quote_token?.data?.id || ''
          const addr = baseId.replace(/^arc_/, '')
          if (!isAddr(addr) || !quoteId.toLowerCase().endsWith(net.tokens.USDC.address.toLowerCase())) continue
          const meta = tokens[baseId] || {}
          const symbol = meta.symbol || (a.name || '').split(' / ')[0]
          if (verified.has(String(symbol).toLowerCase()) || seen.has(addr.toLowerCase())) continue
          seen.add(addr.toLowerCase())
          const n = (x) => x == null ? null : Number(x)
          list.push({ token: addr, symbol, name: meta.name || symbol, priceUsd: n(a.base_token_price_usd), change24h: n(a.price_change_percentage?.h24),
            volume24h: n(a.volume_usd?.h24), liquidityUsd: n(a.reserve_in_usd), fdvUsd: n(a.fdv_usd) })
        }
        const out = { ts: Date.now(), source: 'GeckoTerminal (CoinGecko)', tokens: list.slice(0, 15) }
        if (kv) { try { await kv.put(TOP_KV, JSON.stringify(out)) } catch {} }
        return ok(out)
      } catch (e) {
        if (cached) return ok({ ...cached, stale: true })
        return err('Could not load the top memes right now.', { message: e.message }, 502)
      }
    }

    if (!isAddr(walletAddress)) return err('missing wallet', null, 400)

    // One token (the screen after pasting a CA): what it is + the honeypot guard (buy 1 USDC → sell all, simulated).
    if (action === 'inspect') {
      const i = await inspect(net, token, walletAddress)
      if (!i.supported) return ok(i)
      const check = await buySellCheck(net, walletAddress, i.token, i.pool, ONE_USDC)
      return ok({ ...pub(i), sellable: check.ok, roundTripLossPct: check.ok ? check.lossPct : null, why: check.ok ? null : check.why })
    }

    // The wallet's memes: supported + the whole balance sells in simulation → shown; anything else → Hidden (owner:
    // scam tokens other people send in).
    if (action === 'portfolio') {
      const list = (Array.isArray(body.tokens) ? body.tokens : []).filter(isAddr).slice(0, 30)
      const out = await Promise.all(list.map(async (t) => {
        try {
          const i = await inspect(net, t, walletAddress)
          if (!i.supported) return { token: t, hidden: true, reason: i.reason }
          const held = BigInt(i.held)
          if (held === 0n) return null   // no longer held → not listed at all
          const dl = Math.floor(Date.now() / 1000) + 600
          const s = await simulate(net, walletAddress, t, [swapBatch(net, i.pool, t, held, 1n, dl)])
          const back = s[1].usdc - s[0].usdc
          if (!s[1].ok || back <= 0n) return { ...pub(i), hidden: true, reason: 'cannot be sold' }
          return { ...pub(i), hidden: false, sellValueUsdc: Number(back) / 1e6 }
        } catch (e) { return { token: t, hidden: true, reason: 'could not check', unresolved: true } }
      }))
      return ok({ tokens: out.filter(Boolean) })
    }

    // Everything below = one buy or sell of one token.
    if (side !== 'buy' && side !== 'sell') return err('unknown side', null, 400)
    const i = await inspect(net, token, walletAddress)
    if (!i.supported) return err(`Not supported: ${i.reason}`, null, 400)
    const usdc = net.tokens.USDC.address
    const inDec = side === 'buy' ? net.tokens.USDC.decimals : i.decimals
    const problem = amountProblem(String(amount), inDec)
    if (problem) return err(problem, null, 400)
    const amountIn = toBaseUnits(String(amount), inDec)
    if (side === 'buy') {
      if (amountIn > BigInt(MEME_MAX_BUY_USD) * ONE_USDC) return err(`At most $${MEME_MAX_BUY_USD} per buy.`, null, 400)
      if (i.snipeTaxBps > 0) return err('This token just launched (opening tax active) - try again in a few seconds.', null, 409)
    }
    const tokenIn = side === 'buy' ? usdc : i.token
    const dl = Math.floor(Date.now() / 1000) + 600

    // The exact output of this trade right now (simulated with minOut 1), and the minimum we will sign for.
    const sim = await simulate(net, walletAddress, i.token, [swapBatch(net, i.pool, tokenIn, amountIn, 1n, dl)], side === 'buy' ? amountIn : 0n)
    if (!sim[1].ok) return err('This trade would fail right now - nothing was sent.', sim[1], 409)
    const out = side === 'buy' ? sim[1].token - sim[0].token : sim[1].usdc - sim[0].usdc
    if (out <= 0n) return err('This trade would return nothing.', null, 409)
    const floorOut = out * BigInt(10000 - MEME_SLIPPAGE_BPS) / 10000n

    if (action === 'quote') return ok({ out: out.toString(), minOut: floorOut.toString(), outDecimals: side === 'buy' ? i.decimals : net.tokens.USDC.decimals })

    if (action !== 'fee' && action !== 'execute') return err('unknown action', null, 400)
    const apiKey = ctx.env.API_KEY || ctx.env.CIRCLE_API_KEY
    if (!apiKey) return err('API_KEY not configured')
    if (!userToken || !walletId) return err('missing params', null, 400)

    if (action === 'fee') {
      const r = await fetch(`${W3S_API}/transactions/contractExecution/estimateFee`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
        body: JSON.stringify({ walletId, contractAddress: net.contracts.multicall3From, callData: swapBatch(net, i.pool, tokenIn, amountIn, floorOut, dl) }),
      })
      let fd; try { fd = await r.json() } catch { fd = {} }
      const m = fd?.data?.medium
      if (!r.ok || !m?.networkFee) return err(fd?.message || `Circle estimateFee ${r.status}`, fd, r.status === 401 ? 401 : 502)
      return ok({ feeMax: m.networkFee, feeNow: m.networkFeeRaw || null })
    }

    // execute: the minimum the screen showed (never less), the honeypot guard again for a buy, and the exact batch must
    // deliver at least that minimum in simulation - else nothing is signed.
    if (!UUID.test(String(refId || ''))) return err('refId (uuid) required', null, 400)   // MAINNET-AUDIT C3
    let shownMin
    try { shownMin = BigInt(String(minOut)) } catch { return err('minOut required', null, 400) }
    if (shownMin <= 0n) return err('minOut required', null, 400)
    if (shownMin > out) return err('The price moved. Check the new amount and try again.', { shownMin, out }, 409)
    if (side === 'buy') {
      const check = await buySellCheck(net, walletAddress, i.token, i.pool, ONE_USDC)
      if (!check.ok) return err('This token cannot be sold - buying is blocked.', check, 409)
    }
    const batch = swapBatch(net, i.pool, tokenIn, amountIn, shownMin, dl)
    const verify = await simulate(net, walletAddress, i.token, [batch])
    const got = side === 'buy' ? verify[1].token - verify[0].token : verify[1].usdc - verify[0].usdc
    if (!verify[1].ok || got < shownMin) return err('This trade would not deliver the amount shown - nothing was sent.', verify[1], 502)

    const txRes = await fetch(`${W3S_API}/user/transactions/contractExecution`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), walletId, contractAddress: net.contracts.multicall3From, callData: batch, feeLevel: 'MEDIUM', refId }),
    })
    const txData = await txRes.json()
    const challengeId = txData?.data?.challengeId
    if (!challengeId) return err(`${txData?.message || 'no challengeId'} (HTTP ${txRes.status})`, txData)
    return ok({ challengeId })
  } catch (e) {
    return err('unhandled', { message: e.message, stack: e.stack?.slice(0, 300) })
  }
}
