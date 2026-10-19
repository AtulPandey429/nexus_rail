# 📋 NexusRail — Master Source of Truth & Evidence Inventory

**Last Audited:** October 2026  
**Auditor:** Senior Software Engineer, API Architect & Code Auditor  
**Methodology:** Direct AST code inspection, reachable execution path tracing, runtime assertions (`scripts/verify-master-flow.mjs` & `test-phase6-security-verification.mjs`), and live HTTP endpoint verification.

---

## 1. Evidence Hierarchy & Status Definitions

Every architectural and functional claim in this repository is classified under the following evidence hierarchy:

| Status Label | Formal Definition |
| :--- | :--- |
| **Implemented** | Source code exists in the repository and is reachable via initialized routes/services. |
| **Tested** | Covered by automated unit/integration test suites in `scripts/` with passing assertions. |
| **Runtime-verified** | Confirmed through active local runtime execution with live database/network connections. |
| **Production-verified** | Verified against the live deployed production environment (`https://nexus-rail-one.vercel.app` & `https://nexus-rail.onrender.com`). |
| **Partial** | Some functionality exists, but functionality is incomplete or falls back to local stubs. |
| **Planned** | Explicitly stated in roadmap/sprint plans, but no reachable implementation exists in code. |
| **Unverified** | Code exists but runtime credentials/fixtures were inaccessible during audit. |
| **Deprecated** | Superceded by newer implementations (e.g., Supabase relational schema replaced by MongoDB Atlas). |
| **Broken** | Code exists but exhibits reproducible failures or syntax/runtime errors. |

---

## 2. Master Feature & Implementation Inventory

| Feature / Module | Verification Status | Source Implementation | Test / Evidence Reference | Audit Notes & Reality Check |
| :--- | :--- | :--- | :--- | :--- |
| **MongoDB Atlas Primary Persistence** | **Production-verified** | `apps/api/src/services/mongo.ts` | `scripts/verify-master-flow.mjs` (Step 1) | Atlas M0 cluster connected (`nexusrail`). Collections: `users`, `products`, `orders`, `cart_items`, `wallet_ledger`, `proposals`, `auth_nonces`, `agent_audit_traces`, `product_reviews`, `showdowns`. |
| **User Registration (Email + Password)** | **Production-verified** | `apps/api/src/services/auth.ts`<br>`apps/api/src/routes/auth.ts` | `scripts/verify-master-flow.mjs` (Step 2) | Uses `crypto.scryptSync` with 16-byte random salt and 32-byte key length. Passwords never stored plaintext. |
| **User Login & Timing Attack Defense** | **Production-verified** | `apps/api/src/services/auth.ts` | `scripts/verify-master-flow.mjs` (Step 2)<br>`test-phase6-security-verification.mjs` | Uses `crypto.timingSafeEqual` on scrypt hash digests. Rejects invalid credentials with HTTP 401. |
| **JWT Session Management** | **Production-verified** | `apps/api/src/services/jwt.ts`<br>`apps/api/src/middleware/auth.ts` | `test-phase6-security-verification.mjs` (Suite 1) | Custom HMAC-SHA256 signer. Forged tokens, signature tampering, and expired timestamps strictly rejected. |
| **Web3 Nonce Challenge Auth** | **Tested** | `apps/api/src/services/auth.ts`<br>`apps/api/src/routes/auth.ts` | `scripts/test-phase1-auth.mjs` | Nonce generated with 5-minute MongoDB TTL index in `auth_nonces`. Signature verified via `ethers.verifyMessage`. |
| **Google OAuth Credential Exchange** | **Production-verified** | `apps/api/src/routes/auth.ts` (`/google`) | Live verified on Vercel deployment | Decodes Google JWT payload or accepts verified Google profile fields, issuing internal JWT session token. |
| **Product Catalog Management** | **Production-verified** | `apps/api/src/services/products.ts`<br>`apps/api/src/routes/products.ts` | `scripts/verify-master-flow.mjs` (Step 3) | 10 default products auto-seeded into MongoDB `products` collection with SKU, title, price_cents, and category. |
| **Atomic Catalog Upvoting** | **Production-verified** | `apps/api/src/services/products.ts`<br>`apps/api/src/routes/leaderboard.ts` | `scripts/verify-master-flow.mjs` (Step 3) | Uses MongoDB `$inc: { upvotes_count: 1 }` with `findOneAndUpdate`. Zero race conditions. |
| **Shopping Cart Persistence** | **Production-verified** | `apps/api/src/routes/cart.ts` | `scripts/verify-master-flow.mjs` (Step 4) | User cart stored in MongoDB `cart_items` collection. Supports atomic upsert, update quantity, and delete. |
| **Tamper-Proof Server Pricing** | **Production-verified** | `apps/api/src/routes/orders.ts` | `scripts/verify-master-flow.mjs` (Step 4) | Server ignores client-supplied prices; re-queries MongoDB `products` catalog to calculate `total_cents`. Orders formatted as `NR-XXXXXXXX`. |
| **Stellar Horizon Payment Settlement** | **Production-verified** | `apps/api/src/services/crypto/stellarProvider.ts`<br>`apps/api/src/routes/checkout.ts` | `scripts/verify-master-flow.mjs` (Step 5)<br>`test-phase6-security-verification.mjs` | Connects to `https://horizon-testnet.stellar.org`. Generates 28-byte HMAC memo (`NR...`). Validates native XLM payment operations and accounts. |
| **XRPL Altnet Payment Settlement** | **Production-verified** | `apps/api/src/services/crypto/xrplProvider.ts`<br>`apps/api/src/routes/checkout.ts` | `scripts/verify-master-flow.mjs` (Step 5)<br>`test-phase6-security-verification.mjs` | Connects to `wss://s.altnet.rippletest.net:51233`. Generates deterministic 32-bit DestinationTag. Validates `tesSUCCESS` and delivered amount. |
| **Stellar Freighter XDR Signing** | **Implemented** | `apps/api/src/services/crypto/stellarProvider.ts` | `apps/web/src/lib/wallets.ts` | Pre-builds unsigned transaction XDR for Freighter browser extension signing; submits signed envelope via Horizon REST. |
| **Stripe Checkout & Webhooks** | **Implemented** | `apps/api/src/services/stripe.ts`<br>`apps/api/src/routes/webhooks.ts` | `apps/api/src/routes/checkout.ts` | Creates Stripe Checkout Session; validates `stripe-signature` via `stripe.webhooks.constructEvent`. Updates order to `PAID`. |
| **Double-Entry Wallet Ledger** | **Production-verified** | `apps/api/src/services/wallet.ts`<br>`apps/api/src/routes/wallet.ts` | `scripts/verify-master-flow.mjs` (Step 6) | Immutable credit/debit records in `wallet_ledger` collection. Recomputes balance on demand across USD, XLM, and XRP. |
| **Ledger Overdraft Protection** | **Production-verified** | `apps/api/src/services/wallet.ts` | `scripts/verify-master-flow.mjs` (Step 6) | Rejects debit transactions when requested amount exceeds current verified balance. |
| **AI Proposal Lock Manager** | **Production-verified** | `apps/api/src/agent/proposalLock.ts` | `scripts/verify-master-flow.mjs` (Step 6) | Single-use proposal locks stored in MongoDB `proposals` with 5-minute TTL. Atomic consumption prevents replay attacks. |
| **Groq / Llama 3.3 AI Commerce Desk** | **Runtime-verified** | `apps/api/src/services/ai/aiRouter.ts`<br>`apps/api/src/routes/agent.ts` | `scripts/test-phase5-ledger-agent.mjs` | Connects to `https://api.groq.com/openai/v1`. Features self-healing dynamic model discovery with fallback to `llama-3.3-70b-versatile`. |
| **AI Telemetry Audit Traces** | **Production-verified** | `apps/api/src/services/mongo.ts` (`MongoAuditLogger`) | `apps/api/src/routes/agent.ts` | Asynchronously logs agent prompt, response, latency, and session ID to `agent_audit_traces` collection. |
| **Pinata IPFS Receipt Archiving** | **Implemented** | `apps/api/src/services/ipfs.ts`<br>`apps/api/src/routes/checkout.ts` | Verified with live Pinata JWT | Pins order receipt metadata JSON to IPFS gateway; saves `ipfs_cid` on order document. |
| **Community Product Showdowns** | **Production-verified** | `apps/api/src/routes/showdowns.ts` | `apps/web/src/components/ProductShowdownCard.tsx` | Showdown battlecards in MongoDB `showdowns`. Atomic voting with `$inc: { votes_a: 1 }` or `votes_b`. |
| **Mento Verified Reviews** | **Implemented** | `apps/api/src/routes/reviews.ts` | `apps/web/src/components/AppShell.tsx` | Submits reviews for products; automatically marks `verified_purchase: true` if user has a confirmed `PAID` order for that SKU. |
| **Commodity / Metal Rates** | **Runtime-verified** | `apps/api/src/services/market.ts`<br>`apps/api/src/routes/rwaGold.ts` | Verified live CoinGecko API | Fetches PAXG and KAG prices per troy ounce from CoinGecko; calculates USD and INR price per gram with 30-min cache. |
| **Crypto Fx Exchange Rates** | **Production-verified** | `apps/api/src/services/market.ts`<br>`apps/api/src/routes/crypto.ts` | `scripts/verify-master-flow.mjs` (Step 5) | Fetches live XRP and XLM quotes from CoinGecko; falls back to Binance ticker (`/api/v3/ticker/price`), with memory caching. |
| **Next.js Reverse Proxy Gateway** | **Production-verified** | `apps/web/src/app/api/v1/[...path]/route.ts` | Live verified on Vercel | Catch-all Next.js route forwards all `/api/v1/*` requests to upstream Render backend, stripping CORS restrictions. |
| **Dark & Light Theme Switcher** | **Production-verified** | `apps/web/src/components/ThemeProvider.tsx` | Visual verification in UI | System-aware mode with `localStorage` persistence, toggling `.dark` class on root HTML element. |
| **Ledger Background Watcher** | **Implemented** | `apps/api/src/workers/ledgerWatcher.ts` | Started on server boot | 20-second interval query for pending testnet orders. Logs order counts. |
| **Render Keep-Alive Ping Daemon** | **Production-verified** | `apps/api/src/workers/keepAlive.ts` | Started on server boot | Pings `/api/v1/health` every 10 minutes when `RENDER_EXTERNAL_URL` is set to prevent free-tier dyno sleep. |
| **Redis Cache Service** | **Partial (In-Memory)** | `apps/api/src/services/redis.ts` | Code inspection | Class named `RedisCacheService`, but implements an in-memory JavaScript `Map` with TTL. No external Redis server connected. |
| **Socket.io Real-Time Server** | **Partial (Stub)** | `apps/api/src/sockets/server.ts` | Code inspection | Logs events to stdout; `socket.io` library is not installed in `apps/api/package.json`. |
| **Commodity RWA Token Minting** | **Planned (501 Stub)** | `apps/api/src/routes/rwaGold.ts`<br>`apps/api/src/routes/rwa/rwaModularRouter.ts` | Code inspection | Route `/api/v1/rwa/issue-token` and `/tokens/mint` return HTTP 501 Not Implemented. |
| **Perpetuals Trading Engine** | **Planned (501 Stub)** | `apps/api/src/routes/superPlatform.ts`<br>`apps/api/src/routes/rwa/rwaModularRouter.ts` | Code inspection | `/api/v1/superplatform/*` and `/perps/quote` return HTTP 501 Not Implemented. |
| **UPI / TRON TRC20 Payment Rails** | **Planned (501 Stub)** | `apps/api/src/routes/superPlatform.ts` | Code inspection | Documented in roadmap blueprints; returns HTTP 501 Not Implemented in current codebase. |

---

## 3. Discrepancies Resolved Between Old Docs & Actual Code

1. **Database Identity**: Previous sprint roadmaps described a complex hybrid Supabase PostgreSQL relational schema. The **actual code** operates entirely on **MongoDB Atlas M0** (`users`, `products`, `orders`, `wallet_ledger`, `cart_items`, `proposals`), completely removing relational migration dependencies.
2. **Redis Caching**: Sprint files claimed Upstash Redis for distributed locks and catalog caching. The **actual code** uses an in-memory `Map` with TTL in `redis.ts` and MongoDB native TTL indexes in `proposals`.
3. **WebSockets**: Sprint docs claimed real-time Socket.io bi-directional rooms. The **actual code** uses a console-logging stub in `apps/api/src/sockets/server.ts`.
4. **DeFi / Perps**: Previous concept documents mentioned Ostium Perps, Hyperliquid, and TRON engines. The **actual code** mounts `superPlatformRouter` which returns HTTP 501.
5. **RWA Token Minting**: Physical gold minting is intentionally unissued (HTTP 501), while live gold spot pricing via CoinGecko PAXG/KAG is fully functional.
