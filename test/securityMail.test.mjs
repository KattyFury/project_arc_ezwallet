// Security mails (mainnet v1 plan item 3 (2026-09-27, deleted doc - git history)): right wording per kind, input escaped.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { securityMail } from '../functions/api/_securityMail.js'

test('each kind renders', () => {
  const at = new Date('2026-09-29T07:15:00Z')
  const c = securityMail('created', 'Arc', at), p = securityMail('pinChange', 'Arc', at), r = securityMail('pinReset', 'Arc', at)
  assert.match(c.subject, /created/); assert.match(p.subject, /PIN change requested/); assert.match(r.subject, /PIN reset started/)
  for (const m of [c, p, r]) { assert.match(m.text, /2026-09-29 07:15 UTC/); assert.match(m.text, /never ask for your PIN/) }
  assert.match(securityMail('created', '<b>x</b>', at).html, /&lt;b&gt;/)
  assert.throws(() => securityMail('nope', 'Arc'))
})
