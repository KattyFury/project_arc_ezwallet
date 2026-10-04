// Temporary-inbox block (mainnet v1 plan item 6 (2026-09-27, deleted doc - git history)).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDisposable } from '../functions/api/_disposable.js'

test('real providers pass', () => {
  for (const e of ['a@gmail.com', 'b@yahoo.com', 'c@outlook.com', 'd@icloud.com', 'e@company.vn', 'f@sub.gmail.com']) assert.equal(isDisposable(e), false, e)
})
test('temp inboxes are caught, including subdomains and case', () => {
  for (const e of ['a@mailinator.com', 'B@MAILINATOR.COM', 'c@x.mailinator.com', 'd@guerrillamail.com', 'e@10minutemail.com']) assert.equal(isDisposable(e), true, e)
})
