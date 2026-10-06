import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { MOCK, seedMockSession, installMockFetch } from './mock'

// MOCK MODE (npm run mock): skips Login/PIN, blocks the network, feeds fake data. NEVER in production.
if (MOCK) { seedMockSession(); installMockFetch() }

// A NEW DEPLOY WHILE THE APP IS OPEN (owner report 2026-10-06, "bản test đang bị crash"): screens are lazy chunks with
// hashed names; after a deploy the old names are gone, so opening a not-yet-loaded screen fails and the ErrorBoundary
// showed. Vite fires `vite:preloadError` for exactly this (vite.dev/guide/build#load-error-handling) → reload once to pick
// up the new build. The 30-second guard stops a reload loop if the chunk is missing for another reason.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('ez_chunk_reload') || 0)
    if (Date.now() - last < 30000) return
    sessionStorage.setItem('ez_chunk_reload', String(Date.now()))
  } catch {}
  e.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
