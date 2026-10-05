// LABS = features still being tried by the owner (Lending/Borrow, Memes - Service hub, 2026-10-05).
// Owner decision: the code goes to BOTH branches as usual, but these features are ON only on the hosts below.
// ezwallet.cash stays OFF until the owner is happy → turning it on = adding 'ezwallet.cash' and 'www.ezwallet.cash' here.
// Imported by the client (src/*) AND the Pages Functions (functions/api/*), so both sides apply the same rule.
export const LABS_HOSTS = ['test.ezwallet.cash', 'localhost', '127.0.0.1']

export const isLabsHost = (hostname) => LABS_HOSTS.includes(String(hostname || '').toLowerCase())
