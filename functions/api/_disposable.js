// TEMPORARY-INBOX BLOCK (mainnet v1 plan item 6 (2026-09-27, deleted doc - git history), owner decision 2026-09-29: free bundled list, both networks).
// The wallet is tied to the email: a temp inbox dies within hours, and with it the only way back into the wallet
// (sign-in codes go to that inbox). So a NEW account may not use one.
// An email that is ALREADY a Circle user keeps signing in - blocking it would lock someone out of their money.
import { DISPOSABLE_DOMAINS } from './_disposableDomains.js'

const SET = new Set(DISPOSABLE_DOMAINS.split('\n'))

// true for a listed domain or any subdomain of one (x.mailinator.com).
export function isDisposable(email) {
  const parts = String(email || '').toLowerCase().split('@').pop().split('.')
  for (let i = 0; i < parts.length - 1; i++) if (SET.has(parts.slice(i).join('.'))) return true
  return false
}

export async function isExistingCircleUser(email, apiKey) {
  const res = await fetch(`https://api.circle.com/v1/w3s/users/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  })
  return res.status === 200
}

export const DISPOSABLE_MESSAGE =
  'Please use a permanent email address. Temporary inboxes stop working, and you would lose access to your wallet.'
