// /api/session (email flow): a returning user costs ONE Circle call (POST /users/token); the user is created only when
// Circle answers 155102 "Cannot find the userId" (lag fix 2026-10-07).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/session.js'
import { issueToken } from '../functions/api/_auth.js'

const SECRET = 'x'.repeat(40)
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const TOKEN = { data: { userToken: 'ut', encryptionKey: 'ek' } }

async function run(answers) {
  const calls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const path = String(url).replace('https://api.circle.com/v1/w3s', '')
    calls.push(path)
    const next = answers.shift()
    if (!next) throw new Error(`unexpected call ${path}`)
    assert.equal(path, next[0])
    return json(next[1], next[2])
  }
  try {
    const authToken = await issueToken(SECRET, 'bob@example.com')
    const res = await onRequestPost({
      env: { API_KEY: 'k', AUTH_SECRET: SECRET, NETWORK: 'mainnet' },
      request: new Request('https://x/api/session', { method: 'POST', body: JSON.stringify({ authToken }) }),
      waitUntil() {},
    })
    return { status: res.status, body: await res.json(), calls }
  } finally { globalThis.fetch = realFetch }
}

test('returning user → one Circle call (token only)', async () => {
  const r = await run([['/users/token', 200, TOKEN]])
  assert.deepEqual(r.calls, ['/users/token'])
  assert.deepEqual(r.body, { userToken: 'ut', encryptionKey: 'ek' })
})

test('new user (155102) → create, then token', async () => {
  const r = await run([
    ['/users/token', 404, { code: 155102, message: 'Cannot find the userId in the system.' }],
    ['/users', 201, { data: { id: 'bob@example.com' } }],
    ['/users/token', 200, TOKEN],
  ])
  assert.deepEqual(r.calls, ['/users/token', '/users', '/users/token'])
  assert.equal(r.body.userToken, 'ut')
})

test('create fails for another reason → error, no second token call', async () => {
  const r = await run([
    ['/users/token', 404, { code: 155102, message: 'Cannot find the userId in the system.' }],
    ['/users', 400, { code: 2, message: 'boom' }],
  ])
  assert.equal(r.status, 400)
  assert.match(r.body.error, /Could not create the account: boom/)
})

test('other token error → returned as is, user not created', async () => {
  const r = await run([['/users/token', 400, { code: 155105, message: 'bad' }]])
  assert.deepEqual(r.calls, ['/users/token'])
  assert.equal(r.status, 400)
  assert.equal(r.body.error, 'bad')
})
