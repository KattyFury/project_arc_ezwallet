// LIQUIDATION ALERTS - Circle's Borrow Service POSTs here when a loan's health band changes (registered by the owner's
// 2nd PIN right after borrowing, functions/api/borrow.js alertStart/alertFinish). Body (borrow-kit README):
//   { notificationType: 'morpho.healthBandCrossed', notification: { loan_id, walletAddress, threshold, previous_threshold,
//     event_id, source_block_number, … } }
// Circle says a receiver CANNOT verify the sender yet → the body is only a PROMPT: we re-read the loan from the Borrow
// Service and act on THAT band. Delivery is at-least-once → dedupe on event_id, recorded only after the mail went out.
// We always answer 200 (a non-2xx makes Circle retry; nothing here can be fixed by a retry).
import { kit, publicLoan } from './_borrowCore.js'
import { sendMail } from './_mail.js'

const ALERT_BANDS = new Set(['WARN', 'URGENT', 'IMMINENT', 'LIQUIDATABLE'])
const done = () => new Response('ok', { status: 200 })

export async function onRequestPost(ctx) {
  try {
    const body = await ctx.request.json().catch(() => null)
    const n = body?.notification || {}
    const loanId = String(n.loan_id || n.resourceId || '')
    const eventId = String(n.event_id || '')
    const kv = ctx.env.EZ_SYNC
    if (!kv || !/^[0-9a-f-]{36}$/i.test(loanId) || !eventId) return done()
    const owner = JSON.parse(await kv.get(`loan:${loanId}`) || 'null')
    if (!owner?.email) return done()                                     // not a loan registered through ezwallet
    if (await kv.get(`loanalert:${eventId}`)) return done()              // already handled
    const r = await kit('GET', `/loans/${encodeURIComponent(loanId)}`)
    if (!r.ok) return done()
    const loan = publicLoan(r.data)
    if (String(r.data?.walletAddress || '').toLowerCase() !== owner.wallet) return done()
    if (!ALERT_BANDS.has(loan.band)) return done()
    const urgent = loan.band !== 'WARN'
    const lines = [
      `Your ezwallet loan is at risk (${loan.band}).`,
      '',
      `Borrowed: ${loan.borrowed ?? '?'} USDC · Collateral: ${loan.collateral ?? '?'} cirBTC`,
      loan.liquidationPrice ? `It can be liquidated if 1 cirBTC falls to about $${Math.round(loan.liquidationPrice).toLocaleString('en-US')}.` : '',
      '',
      'To stay safe: open ezwallet → Service hub → Lending / Borrow → Borrow, then repay part of the loan or add cirBTC.',
      'Liquidation means part of your cirBTC is sold to repay the loan.',
      '',
      'This is an automatic alert from ezwallet (support@ezwallet.cash).',
    ].filter(l => l !== '').join('\n')
    await sendMail(ctx.env, { to: owner.email, subject: `${urgent ? 'URGENT: ' : ''}your ezwallet loan is close to liquidation`, text: lines })
    await kv.put(`loanalert:${eventId}`, '1', { expirationTtl: 30 * 24 * 3600 })
    return done()
  } catch (e) {
    console.error('[borrow-alert]', e.message)
    return done()
  }
}
