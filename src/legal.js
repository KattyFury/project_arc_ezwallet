// THE LEGAL PAGES (About → Terms of Use / Privacy Policy). Text = the owner's draft of 2026-10-06 (Desktop
// ezwallet-LEGAL-DRAFT.md), built from what the code actually does + Circle's docs + data-protection law. Rules:
// - every sentence must stay TRUE of the app: change the code (new data, new provider, new fee) → change this file.
// - plain English for members; "non-custodial" and "open-source", never "decentralized" (there is a small server).
// - live on every host since 2026-10-06 (owner: "áp dụng vào main luôn, mình duyệt sau") - the owner still reviews the text.
// Contact = GitHub Issues until the owner's support email exists (owner 2026-10-06: "email cung cấp sau").
export const LEGAL_UPDATED = '6 October 2026'
export const CONTACT_URL = 'https://github.com/KattyFury/project_arc_ezwallet/issues'
const CONTACT = 'GitHub Issues (github.com/KattyFury/project_arc_ezwallet/issues). A dedicated email address is coming.'

export const TERMS = {
  title: 'Terms of Use',
  sections: [
    ['1. What ezwallet is', [
      'ezwallet is an app for holding, sending and receiving USDC, EURC and cirBTC on the Arc network.',
      'Your wallet is created and secured by Circle (a "user-controlled" wallet): only you can approve a transaction, with your PIN. ezwallet never holds your money and never sees your PIN.',
      'ezwallet is a free, non-profit, open-source project (MIT licence, source code on GitHub) published by an individual volunteer. Nobody earns money from it: there are no app fees, no ads and no data sales.',
    ]],
    ['2. Who can use it', [
      'You must be 18 or older. You may not use ezwallet if you are on a sanctions list or in a place where using it is illegal.',
      'You are responsible for following the laws where you live (see section 8).',
    ]],
    ['3. Your account and PIN', [
      'You sign in with your email. Your PIN and security questions are set inside Circle\'s secure window. Keep them private.',
      'If you forget your PIN, you can reset it with your security questions through Circle. Nobody at ezwallet can reset it for you or move your money.',
    ]],
    ['4. Transactions are final', [
      'A transaction you confirm with your PIN cannot be cancelled or reversed. Check the address and the amount.',
      'ezwallet works on the Arc network only. Money sent to your address on another network may be lost.',
    ]],
    ['5. Fees', [
      'ezwallet charges no app fee. Every transaction pays an Arc network fee in USDC; the app shows the maximum before you confirm.',
      'Other services may charge their own fees, shown where possible: the swap provider (0.02%), lending-vault fees set by the vault curator, and meme-token buy/sell taxes set by each token.',
    ]],
    ['6. Services from other companies', [
      'Some features run on services ezwallet does not control: Circle (wallet, swap, lending), Morpho (lending vaults), Uniswap and Argus (meme tokens), and price data from CoinGecko/GeckoTerminal and Binance.',
      'Their own terms apply. If they stop, change or fail, a feature may stop working.',
    ]],
    ['7. Risks - please read', [
      'Stablecoins can lose their peg. Smart contracts can have bugs.',
      'Lending: your deposit is lent to borrowers. Withdrawals can be delayed when a vault has no free cash, and in extreme markets the value can fall.',
      'Memes: prices can drop to zero in minutes, and copycat tokens use real names. The app\'s sell check lowers the risk of tokens that cannot be sold; it does not remove it.',
      'Prices and rankings come from other services and can be wrong or late. Nothing in ezwallet is financial advice.',
    ]],
    ['8. Your local law', [
      'Crypto rules differ from country to country. Some countries only allow crypto trading through licensed local providers (for example, Vietnam under Resolution 05/2025/NQ-CP).',
      'ezwallet is not licensed as a crypto exchange or broker anywhere. Before you swap, lend or trade memes, check that it is allowed where you live - that responsibility is yours.',
    ]],
    ['9. Things you must not do', [
      'Break the law, use stolen funds, attack or overload the app, or act for anyone on a sanctions list.',
      'Circle blocks transactions with sanctioned addresses and may restrict a wallet while it reviews.',
    ]],
    ['10. Changes and availability', [
      'Features (including test features) may change, pause or stop. Your money stays in your wallet on the blockchain even if the app stops, and you keep access through Circle.',
    ]],
    ['11. No warranty', [
      'ezwallet is free open-source software provided "as is", without warranty - the same terms as its MIT licence.',
      'To the extent the law allows, the person who publishes it is not liable for losses caused by blockchain networks, other services, market prices, bugs, or your own mistakes (a wrong address, a lost PIN).',
    ]],
    ['12. Open-source software', [
      'ezwallet is open-source software, not a company or a financial service. These terms do not choose a country\'s law; the rules that protect you where you live still apply.',
      'If something goes wrong, please tell us first - we will try to sort it out.',
    ]],
    ['13. Contact', [CONTACT]],
  ],
}

export const PRIVACY = {
  title: 'Privacy Policy',
  sections: [
    ['Who is responsible', [
      'The individual who publishes the ezwallet open-source project. ezwallet is non-profit: your data is never sold or used for ads.',
    ]],
    ['1. What we collect and why', [
      'Email - to send your sign-in code and security alerts (new account, PIN change or reset) and to link your Circle wallet.',
      'Sign-in code - stored only as a scrambled (hashed) value, for 10 minutes.',
      'IP address - to stop people flooding sign-in codes; kept for 1 hour.',
      'Wallet address and Circle user id - to show your balance and run transactions.',
      'Contacts (name + address) and saved QR codes - backed up only after you unlock the app with your PIN, so they come back on a new device. Contact photos never leave your phone.',
      'We do not collect your PIN, your private key, your phone number or your location.',
    ]],
    ['2. Why we may use it', [
      'Your consent when you sign up, and what is needed to provide the wallet you asked for.',
    ]],
    ['3. Who receives it', [
      'Circle - creates and secures your wallet (see Circle\'s Privacy Policy).',
      'Cloudflare - hosts the app and stores the codes, limits and backups above.',
      'Resend - delivers our emails.',
      'The Arc blockchain - every transaction is public and permanent; anyone can see a wallet address\'s history.',
      'Price services (CoinGecko, Binance) receive no personal data.',
    ]],
    ['4. Data sent abroad', [
      'Circle, Cloudflare and Resend run servers in several countries, mainly the United States, so your data may be processed outside the country where you live.',
    ]],
    ['5. How long we keep it', [
      'Sign-in codes 10 minutes · IP counters 1 hour · sign-in token 30 days, on your device · backups until you delete them or ask us to · blockchain records forever (nobody can delete them).',
    ]],
    ['6. Your rights', [
      'You can ask to know how your data is used, give or withdraw consent, get a copy, correct it, delete it, limit or object to its use, and complain to your data-protection authority. These follow Vietnam\'s Law 91/2025/QH15 and match the main rights in other privacy laws such as the EU GDPR.',
      'Deleting your ezwallet data does not delete your Circle wallet or anything on the blockchain.',
    ]],
    ['7. Security', [
      'Your PIN stays inside Circle\'s secure window; our servers never see it. Backups can only be opened with a signature from your own wallet.',
    ]],
    ['8. Age', ['ezwallet is for people 18 and over.']],
    ['9. Changes', ['We will update the date above and, for important changes, tell you in the app.']],
    ['10. Contact', [CONTACT]],
  ],
}
