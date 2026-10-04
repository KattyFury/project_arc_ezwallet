// SECURITY EMAILS (mainnet v1 plan item 3 (2026-09-27, deleted doc - git history)): the owner of a wallet hears about it at once when someone touches the
// account - account created, PIN change requested, PIN reset (forgot PIN) started. Informational only: nothing is
// locked after a reset (owner decision). Sent in the background (ctx.waitUntil) - a mail problem never blocks
// sign-in or the PIN flow. At most one mail per kind per email every 10 minutes (KV EZ_SYNC `secmail:`).
// Wording says "requested"/"started" for PIN mails: the server only sees the request - the PIN itself is entered
// inside Circle's iframe, so the server cannot know whether the change was completed.
import { sendMail } from './_mail.js'

const RATE_S = 600
const FOOTER = 'ezwallet will never ask for your PIN, your sign-in code or your security answers.'

const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function securityMail(kind, netLabel, when = new Date()) {
  const at = `${when.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  const ifNotYou = {
    created: 'If it was not you: someone was able to read a sign-in code sent to this inbox. Change your email password now.',
    pinChange: 'If it was not you: change your email password now, and never share your PIN or sign-in codes with anyone.',
    pinReset: 'If it was not you: change your email password now. Anyone who can read your email and knows your security answers can reset your PIN.',
  }[kind]
  const what = {
    created: ['Your ezwallet account was created', `An ezwallet wallet was just created for this email address on ${netLabel} (${at}).`],
    pinChange: ['PIN change requested on your ezwallet wallet', `Someone asked to change the PIN of your ezwallet wallet on ${netLabel} (${at}). The change needs your current PIN.`],
    pinReset: ['PIN reset started on your ezwallet wallet', `Someone started a PIN reset for your ezwallet wallet on ${netLabel} (${at}), using your security questions instead of your PIN.`],
  }[kind]
  if (!what) throw new Error(`unknown security mail: ${kind}`)
  const paras = [what[1], 'If this was you, there is nothing to do.', ifNotYou]
  return {
    subject: what[0],
    text: `${paras.join('\n\n')}\n\n--\n${FOOTER}`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#000">`
      + paras.map(p => `<p style="margin:0 0 16px">${esc(p)}</p>`).join('')
      + `<p style="color:#667085;font-size:14px;margin:24px 0 0">${esc(FOOTER)}</p></div>`,
  }
}

export async function sendSecurityMail(env, { kind, email, netLabel }) {
  const kv = env.EZ_SYNC
  if (kv) {
    const key = `secmail:${kind}:${email}`
    if (await kv.get(key)) return
    await kv.put(key, '1', { expirationTtl: RATE_S })
  }
  await sendMail(env, { to: email, ...securityMail(kind, netLabel) })
}

// The account's email from Circle itself (userId = email), never from the request body.
// GET /v1/w3s/user (X-User-Token). ⚠️ VERIFIED LIVE 2026-09-29: the user is at `data.id` - the API reference says
// `data.user.id`, which does not exist (the first build read that and silently sent nothing). Both are accepted.
// Returns null if it does not look like an email.
export async function emailFromUserToken(apiKey, userToken) {
  const res = await fetch('https://api.circle.com/v1/w3s/user', {
    headers: { Authorization: `Bearer ${apiKey}`, 'X-User-Token': userToken, Accept: 'application/json' },
  })
  if (!res.ok) return null
  const d = (await res.json().catch(() => ({})))?.data
  const id = d?.id ?? d?.user?.id
  return typeof id === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) ? id.toLowerCase() : null
}

// Fire-and-forget from a request handler: runs after the response, errors only logged.
export function inBackground(ctx, promise) {
  const p = promise.catch(e => console.error('[securityMail]', e.message))
  if (ctx.waitUntil) ctx.waitUntil(p)
}
