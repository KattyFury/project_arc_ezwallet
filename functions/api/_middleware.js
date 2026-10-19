// Cloudflare's edge REPLACES the body of any 502 a Function returns with the plain text "error code: 502" (measured
// 2026-10-19 on ezwallet.cash: /api/wallet historyPage with a bad token → our JSON {error, code: 155105} never reached the
// browser; 503 and 4xx bodies pass through untouched). The client then fails on r.json() and can never see Circle's
// error code - History sat on "Loading..." forever instead of minting a fresh token. Every "Circle said no" 502 in
// functions/api/* therefore leaves as 503 with its JSON intact. /api/sync is left alone: there 503 = "sync disabled".
export async function onRequest(ctx) {
  const res = await ctx.next()
  if (res.status !== 502 || new URL(ctx.request.url).pathname.startsWith('/api/sync')) return res
  return new Response(res.body, { status: 503, statusText: 'Upstream error', headers: res.headers })
}
