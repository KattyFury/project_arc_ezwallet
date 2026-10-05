import { netFrom, netError } from './_net.js'
import { toBaseUnits, isValidAddress } from '../../src/money.js'
import {
  readBalances, planConvert, buildConvertBatch, payCall, simulateConvertSend, convertSources,
  usdcBaseCeil, baseToDecimal, SEND_RESERVE_BASE,
} from './_convertCore.js'
import { resolveTokenIn } from './_swapCore.js'

const CIRCLE_API = 'https://api.circle.com/v1/w3s'

// ERC-20 transfer ABI function signature
const TRANSFER_SIG = 'transfer(address,uint256)'

// Arc Transaction Memos - the predeployed Memo contract (address per network in src/network.js)
// memo(address target, bytes data, bytes32 memoId, bytes memoData) → forward call through
// the CallFrom precompile (preserving msg.sender) + emitting a Memo event on chain.
const MEMO_SIG = 'memo(address,bytes,bytes32,bytes)'

// Encode the ERC-20 transfer(address,uint256) calldata by hand (selector + 2 32-byte words)
function encodeTransfer(to, amountRaw) {
  const selector = 'a9059cbb'
  const addr = to.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  const amt = BigInt(amountRaw).toString(16).padStart(64, '0')
  return '0x' + selector + addr + amt
}

function utf8ToHex(str) {
  const bytes = new TextEncoder().encode(str)
  return '0x' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

// memoId: a random bytes32 so the Memo event can be looked up later
function randomMemoId() {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return '0x' + [...b].map(x => x.toString(16).padStart(2, '0')).join('')
}

async function circleReq(method, path, body, apiKey, userToken) {
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  if (userToken) headers['X-User-Token'] = userToken
  const res = await fetch(`${CIRCLE_API}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS })

// The wallet's address as CIRCLE knows it for walletId (GET /v1/w3s/wallets, X-User-Token) - never an address from the
// request: the simulation must run for the account Circle will actually sign with.
async function walletAddressOf(net, apiKey, userToken, walletId) {
  const d = await circleReq('GET', '/wallets', null, apiKey, userToken)
  const w = (d?.data?.wallets || []).find(x => x.id === walletId && x.blockchain === net.circleBlockchain)
  return w?.address || null
}

// Circle's MEDIUM fee estimate for a Multicall3From batch → { feeMax (base units), feeMaxStr, feeNow } or { error }.
async function batchFee(net, apiKey, userToken, walletId, batchData) {
  const est = await circleReq('POST', '/transactions/contractExecution/estimateFee',
    { walletId, contractAddress: net.contracts.multicall3From, callData: batchData }, apiKey, userToken)
  const m = est?.data?.medium
  if (!m?.networkFee) return { error: est?.message || 'could not estimate the fee', code: est?.code }
  return { feeMax: usdcBaseCeil(m.networkFee), feeMaxStr: m.networkFee, feeNow: m.networkFeeRaw || null }
}

// The auto-convert path of /api/send (docs/SWAP-PLAN.md section 6). Returns a Response, or null = the wallet holds
// enough USDC after all → the caller does the plain send.
async function convertSend({ net, apiKey, userToken, walletId, toAddress, amountBase, memoText, isFee, legsIn, idemKey, refId }) {
  const wallet = await walletAddressOf(net, apiKey, userToken, walletId)
  if (!wallet) return reply({ error: 'Could not find your wallet - please try again.' }, 502)
  let bal
  try { bal = await readBalances(net, wallet) } catch (e) {
    console.error('[send convert] balances:', e.message)
    return reply({ error: 'Could not check your balance right now - nothing was sent. Please try again in a moment.' }, 503)
  }
  if (bal.USDC >= amountBase + SEND_RESERVE_BASE) return null
  const memoHex = memoText ? utf8ToHex(memoText) : null
  const pay = payCall(net, toAddress, amountBase, memoHex, memoHex ? randomMemoId() : null)
  const usdcFee = (fee) => `Not enough USDC for the network fee (up to ${Number(fee.feeMaxStr).toFixed(3)})`

  if (isFee) {
    // Plan for amount + reserve, ask Circle the fee of that exact batch, re-plan for amount + fee; repeat while the
    // fee grows (it barely depends on the amounts - normally 2 rounds).
    let missing = amountBase + SEND_RESERVE_BASE - bal.USDC
    for (let round = 0; round < 3; round++) {
      const plan = await planConvert({ net, apiKey, wallet, balances: bal, missing })
      if (plan.error) return reply({ error: 'Not enough money for this payment.', code: 'NOT_ENOUGH' }, 400)
      const built = await buildConvertBatch({ net, apiKey, wallet, legs: plan.legs, pay })
      if (built.error) {
        console.error('[send convert fee] build:', built.error, JSON.stringify(built.detail))
        return reply({ error: 'Could not prepare the conversion right now. Please try again in a moment.' }, 502)
      }
      const fee = await batchFee(net, apiKey, userToken, walletId, built.batchData)
      if (fee.error) {
        console.error('[send convert fee] estimateFee:', fee.error)
        return reply({ error: fee.error, code: fee.code }, 502)
      }
      if (bal.USDC < fee.feeMax) return reply({ error: usdcFee(fee), code: 'NO_USDC_FOR_FEE' }, 400)
      // + ONE MORE feeMax kept as USDC (owner 2026-10-05): the fee is held up front, so a wallet left with less than
      // feeMax USDC could not auto-convert the next time (measured: 0.036 left after two real sends, next feeMax 0.042).
      const need = amountBase + 2n * fee.feeMax - bal.USDC
      if (need <= missing) {
        return reply({ feeMax: fee.feeMaxStr, feeNow: fee.feeNow, convert: plan.legs.map(l => ({
          token: l.token, amountIn: baseToDecimal(l.amountIn, net.tokens[l.token].decimals), minOut: baseToDecimal(l.minOut, 6),
        })) })
      }
      missing = need
    }
    return reply({ error: 'Could not prepare the conversion right now. Please try again in a moment.' }, 502)
  }

  // EXECUTE: exactly the legs the Confirm screen showed (from 'fee'), re-checked end to end before any PIN.
  const sources = convertSources(net)
  if (!Array.isArray(legsIn) || !legsIn.length || legsIn.length > sources.length) {
    return reply({ error: 'The amount changed - please check again.', code: 'RECHECK' }, 409)
  }
  let legs
  try {
    const seen = new Set()
    legs = legsIn.map(l => {
      if (!sources.includes(l?.token) || seen.has(l.token)) throw new Error('bad token')
      seen.add(l.token)
      return { token: l.token, amountIn: toBaseUnits(String(l.amountIn), net.tokens[l.token].decimals), minOut: toBaseUnits(String(l.minOut), 6) }
    })
  } catch (e) { return reply({ error: `invalid conversion: ${e.message}` }, 400) }
  const built = await buildConvertBatch({ net, apiKey, wallet, legs, pay })
  if (built.error === 'moved') return reply({ error: 'The price moved - please check the new amount.', code: 'RECHECK' }, 409)
  if (built.error) {
    console.error('[send convert] build:', built.error, JSON.stringify(built.detail))
    return reply({ error: 'This conversion could not be verified - nothing was sent.' }, 502)
  }
  const fee = await batchFee(net, apiKey, userToken, walletId, built.batchData)
  if (fee.error) return reply({ error: fee.error, code: fee.code }, 502)
  const minTotal = legs.reduce((a, l) => a + l.minOut, 0n)
  if (bal.USDC < fee.feeMax) return reply({ error: usdcFee(fee), code: 'NO_USDC_FOR_FEE' }, 400)
  if (bal.USDC + minTotal < amountBase + fee.feeMax) return reply({ error: 'The price or fee changed - please check again.', code: 'RECHECK' }, 409)
  const sim = await simulateConvertSend(net, wallet, toAddress, built.batchData, amountBase, fee.feeMax)
  if (sim.error) {
    console.error('[send convert] simulate:', sim.error)
    return reply({ error: 'Could not check this payment right now - nothing was sent. Please try again in a moment.' }, 503)
  }
  if (!sim.ok) {
    console.error('[send convert] simulation refused:', JSON.stringify({ ...sim, delta: String(sim.delta), walletAfter: String(sim.walletAfter) }))
    return reply({ error: 'This payment would not arrive in full - nothing was sent.' }, 502)
  }
  const tx = await circleReq('POST', '/user/transactions/contractExecution', {
    idempotencyKey: idemKey, walletId, contractAddress: net.contracts.multicall3From, callData: built.batchData,
    feeLevel: 'MEDIUM', refId,
  }, apiKey, userToken)
  const challengeId = tx?.data?.challengeId
  if (!challengeId) {
    console.error('[send convert] contractExecution returned no challengeId:', JSON.stringify(tx))
    return reply({ error: tx?.message || (tx?.code ? `Circle error ${tx.code}` : 'no challengeId') }, 500)
  }
  return reply({ challengeId })
}

export async function onRequestPost(ctx) {
  let net
  try { net = netFrom(ctx) } catch (e) { return netError(e) }
  const apiKey = ctx.env.API_KEY || ctx.env.CIRCLE_API_KEY
  const { action, userToken, walletId, toAddress, token, amountDecimal, memo, idempotencyKey, refId, allowConvert, convert } = await ctx.request.json()
  const isFee = action === 'fee'
  // A fixed idempotencyKey from the client → Circle dedupes, so a repeated call does not create 2 transactions
  const idemKey = idempotencyKey || crypto.randomUUID()

  // refId = the client's confirmation id (a UUID). Circle stores it on the transaction, so after the PIN the client
  // can find THIS transaction and learn its real state - the basis of "no double send" (MAINNET-AUDIT C3/C4).
  if (!isFee && (!refId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refId))) {
    return new Response(JSON.stringify({ error: 'refId (uuid) required' }), { status: 400, headers: JSON_HEADERS })
  }
  if (!userToken || !walletId || !toAddress || !token || !amountDecimal) {
    return new Response(JSON.stringify({ error: 'missing params' }), { status: 400, headers: JSON_HEADERS })
  }

  // A listed symbol, or (owner 2026-10-05) the ADDRESS of an unverified token the wallet holds - its decimals are read
  // on chain (resolveTokenIn), never taken from the request. Anything else → rejected.
  const tokenInfo = await resolveTokenIn(net, token)
  if (!tokenInfo) return new Response(JSON.stringify({ error: 'unknown token' }), { status: 400, headers: JSON_HEADERS })

  // MAINNET-AUDIT H1/H6: validate, never round. The memo path hand-encodes calldata, so a malformed address
  // must never reach encodeTransfer (padStart would silently turn it into a DIFFERENT address).
  if (!isValidAddress(toAddress)) {
    return new Response(JSON.stringify({ error: 'invalid recipient address' }), { status: 400, headers: JSON_HEADERS })
  }
  let amountRaw
  try { amountRaw = toBaseUnits(amountDecimal, tokenInfo.decimals).toString() }
  catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: JSON_HEADERS }) }

  const memoText = (memo || '').trim()

  // AUTO-CONVERT (docs/SWAP-PLAN.md section 6): the client asks for it only on a USD/USDC send it thinks is short of
  // USDC; the server re-checks on chain and falls through to the plain send below when the USDC is there after all.
  if (allowConvert && token === 'USDC') {
    const res = await convertSend({ net, apiKey, userToken, walletId, toAddress, amountBase: BigInt(amountRaw),
      memoText, isFee, legsIn: convert, idemKey, refId })
    if (res) return res
  }

  let execBody
  if (memoText) {
    // With a note → send through the Memo contract (Arc Transaction Memos)
    const transferData = encodeTransfer(toAddress, amountRaw)
    execBody = {
      idempotencyKey: idemKey,
      walletId,
      contractAddress: net.contracts.memo,
      abiFunctionSignature: MEMO_SIG,
      abiParameters: [tokenInfo.address, transferData, randomMemoId(), utf8ToHex(memoText)],
      feeLevel: 'MEDIUM',
      refId,
    }
  } else {
    // Without a note → a direct transfer (the path already verified on chain)
    execBody = {
      idempotencyKey: idemKey,
      walletId,
      contractAddress: tokenInfo.address,
      abiFunctionSignature: TRANSFER_SIG,
      abiParameters: [toAddress, amountRaw],
      feeLevel: 'MEDIUM',
      refId,
    }
  }

  // 'fee' = THE NETWORK FEE OF THIS EXACT SEND (owner 2026-10-04: no guessed numbers). Same contract call as below,
  // asked to Circle POST /v1/w3s/transactions/contractExecution/estimateFee (user-controlled-wallets OpenAPI) - no
  // challenge, no PIN. feeMax = medium.networkFee (gasLimit × maxFee, "the maximum … you will pay"), feeNow =
  // networkFeeRaw. Measured 2026-10-04 on the owner's wallet: 0.1 USDC 0.0031 / with a note 0.0043 / EURC 0.0041.
  if (isFee) {
    const { idempotencyKey: _i, refId: _r, feeLevel: _f, ...call } = execBody
    const est = await circleReq('POST', '/transactions/contractExecution/estimateFee', call, apiKey, userToken)
    const m = est?.data?.medium   // the send itself uses feeLevel MEDIUM
    if (!m?.networkFee) {
      console.error('[send fee] estimateFee failed:', JSON.stringify(est))
      return new Response(JSON.stringify({ error: est?.message || 'could not estimate the fee', code: est?.code }), { status: 502, headers: JSON_HEADERS })
    }
    return new Response(JSON.stringify({ feeMax: m.networkFee, feeNow: m.networkFeeRaw || null }), { headers: JSON_HEADERS })
  }

  const txResp = await circleReq('POST', '/user/transactions/contractExecution', execBody, apiKey, userToken)

  const challengeId = txResp?.data?.challengeId
  if (!challengeId) {
    // A missing challengeId in txResp.data means Circle rejected the request (balance, parameters, rate limit...).
    // Log the full response for investigation, and return Circle's real message instead of a vague "no challengeId".
    console.error('[send] contractExecution returned no challengeId:', JSON.stringify(txResp))
    const msg = txResp?.message || txResp?.error?.message || (txResp?.code ? `Circle error ${txResp.code}` : 'no challengeId')
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: JSON_HEADERS })
  }

  return new Response(JSON.stringify({ challengeId }), { headers: JSON_HEADERS })
}

