// Announcements from the ezwallet team (admin → functions/api/inbox.js), shown in the NotifArea like any other
// notification (24h, dismissable). Each message id is remembered per account in ez_inbox_seen_<addr> the moment it
// is added, so dismissing it does NOT bring it back on the next poll.
// Asked on mount and then at most every 5 minutes (NotifArea ticks every 5-15s, most ticks return here at once):
// every poll is a KV read multiplied by every open app, and an announcement is never urgent to the second.
import { addNotif } from './notif'
import { acct } from './store'
import { MOCK } from './mock'

const EVERY_MS = 5 * 60 * 1000
let lastAt = 0, lastAcct = null, busy = false

export function pollInbox(after) {
  const who = acct()
  if (MOCK || busy || who === 'anon') return
  if (who === lastAcct && Date.now() - lastAt < EVERY_MS) return
  busy = true; lastAt = Date.now(); lastAcct = who
  fetch('/api/inbox')
    .then(r => r.json())
    .then(({ messages = [] }) => {
      const key = `ez_inbox_seen_${who}`
      let seen
      try { seen = new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { seen = new Set() }
      const fresh = messages.filter(m => !seen.has(m.id)).sort((a, b) => a.ts - b.ts)
      if (!fresh.length) return
      fresh.forEach(m => { addNotif(m.text, 'announce', null, `inbox-${m.id}`, null, m.ts); seen.add(m.id) })
      localStorage.setItem(key, JSON.stringify([...seen].slice(-100)))
      after()
    })
    .catch(() => {})
    .finally(() => { busy = false })
}
