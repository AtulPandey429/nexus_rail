# 📊 NexusRail — Data Sources, Provenance & Data Flow Inventory

This document defines the real data sources, provenance models, caching mechanisms, persistence strategies, and fallback routines implemented in **NexusRail**.

---

## 1. Master Data Source Inventory

| Source Name | Category | Official URL | Integration File | Authentication | Primary Purpose |
|:---|:---|:---|:---|:---|:---|
| **MongoDB Atlas** | Database | `mongodb.com/atlas` | `apps/api/src/services/mongo.ts` | Connection String URI (`MONGODB_URI`) | Primary persistent database for users, products, cart, orders, ledger, and traces. |
| **Stellar Horizon Testnet** | Public Blockchain | `https://horizon-testnet.stellar.org` | `apps/api/src/services/crypto/stellarProvider.ts` | None (Public REST RPC) | Native XLM account verification, sequence loading, and payment validation. |
| **XRPL Altnet Node** | Public Blockchain | `wss://s.altnet.rippletest.net:51233` | `apps/api/src/services/crypto/xrplProvider.ts` | None (Public WebSocket) | XRP ledger state, account info, and `tx` engine status verification. |
| **Stripe API** | Payment Gateway | `https://api.stripe.com` | `apps/api/src/services/stripe.ts` | Secret API Key (`STRIPE_SECRET_KEY`) | Hosted card checkout sessions and asynchronous fulfillment webhooks. |
| **Groq Cloud API** | AI LLM | `https://api.groq.com/openai/v1` | `apps/api/src/services/ai/aiRouter.ts` | Bearer Token (`GROQ_API_KEY`) | Dynamic model discovery and chat completions for the AI Commerce Desk. |
| **CoinGecko Simple Price API** | Market Data | `https://api.coingecko.com/api/v3` | `apps/api/src/services/market.ts` | Optional Demo Key (`COINGECKO_API_KEY`) | Spot pricing for XRP, XLM, PAX Gold, and Kinesis Silver. |
| **Binance Public Ticker** | Market Fallback | `https://api.binance.com/api/v3` | `apps/api/src/services/market.ts` | None (Public REST) | Secondary rate fallback for XRPUSDT and XLMUSDT when CoinGecko limits fire. |
| **Pinata IPFS Gateway** | Decentralized Storage | `https://api.pinata.cloud` | `apps/api/src/services/ipfs.ts` | JWT Token (`PINATA_JWT`) | Permanent decentralized JSON archiving of finalized order receipts. |
| **In-Memory Cache Store** | Memory Store | N/A (Node.js Heap) | `apps/api/src/services/redis.ts`<br>`apps/api/src/services/market.ts` | Internal | Ephemeral caching of product catalogs (5 min) and FX rates (30 min). |
| **Supabase Postgres** | Legacy DB | `https://supabase.com` | `apps/api/src/db/supabase.ts` | Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) | Secondary storage for `guide_messages` in `/api/v1/guide`. |

---

## 2. Detailed Source Workflows & Data Pipelines

### A. MongoDB Atlas (Primary Database)
- **Data Stored:**
  - `users`: User profiles, scrypt password hashes, Web3 wallet addresses, and roles (`user` | `admin`).
  - `products`: Product catalog, SKUs, inventory, price in USD cents, upvotes.
  - `cart_items`: User shopping cart line items with SKU and quantity.
  - `orders`: Tamper-proof orders with server-calculated totals, payment rail, txHash, and IPFS CIDs.
  - `wallet_ledger`: Double-entry accounting journal (`CREDIT` and `DEBIT` entries with running balances).
  - `proposals`: Single-use AI agent purchase authorization locks with TTL expiration.
  - `auth_nonces`: Ephemeral challenge nonces for Web3 wallet signatures (5-min TTL).
  - `agent_audit_traces`: Telemetry logs of user prompts, AI responses, and inference latencies.
  - `showdowns` & `product_reviews`: Social commerce data.
- **Connection Model:** Managed connection pool (`maxPoolSize: 20`, `minPoolSize: 2`, `serverSelectionTimeoutMS: 8000`) in `MongoService`.
- **Indexing:** Automated background initialization of unique indexes (`users.email`, `products.sku`, `orders.order_number`) and native MongoDB TTL indexes (`auth_nonces.expiresAt`, `proposals.expiresAt`).

### B. Stellar Horizon Testnet (XLM Settlement)
- **Data Flow:**
  1. `createInvoice(orderId, amountCents)` calculates required XLM using live market FX rates.
  2. Derives an exact 28-character HMAC memo (`NR` + 26-char hash).
  3. Client wallet (Freighter / Albedo) sends XLM to merchant vault address (`STELLAR_MERCHANT_PUBLIC_KEY`) with the specified memo.
  4. `verifyPayment(orderId, txHash)` calls Horizon REST `GET /transactions/{txHash}` and `GET /transactions/{txHash}/operations`.
  5. Verifies: (a) Transaction succeeded (`tx.successful === true`), (b) Memo matches HMAC, (c) Destination equals merchant vault, (d) Asset is native XLM, (e) Delivered amount meets invoice requirement within 0.1% tolerance.
- **Failure Modes:** If Horizon testnet is congested, requests retry with exponential backoff or return HTTP 502 with Horizon error details.

### C. XRPL Altnet Node (XRP Settlement)
- **Data Flow:**
  1. `createInvoice(orderId, amountCents)` converts USD cents to XRP drops (1 XRP = 1,000,000 drops).
  2. Computes a deterministic 32-bit `DestinationTag` using domain-separated HMAC-SHA256 (`(tagDigest.readUInt32BE(0) % 2_000_000_000) + 100_000`).
  3. Client sends XRP to merchant address (`XRPL_MERCHANT_ADDRESS`) with the DestinationTag.
  4. `verifyPayment(orderId, txHash)` connects to XRPL WebSocket node and executes command `tx`.
  5. Verifies: (a) `meta.TransactionResult === 'tesSUCCESS'`, (b) `result.validated === true`, (c) `result.DestinationTag` matches order tag, (d) `delivered_amount` / `DeliveredAmount` matches required drops (mitigating XRPL Partial Payment exploits).
- **Failure Modes:** If WebSocket connection drops, `ensureConnected()` auto-reconnects before issuing commands.

### D. CoinGecko & Binance (FX & Commodity Rates)
- **Data Flow:**
  1. `getFxQuote()` checks in-memory cache (`fxCache`, 30-min window).
  2. If expired, triggers `coingecko('ids=ripple,stellar&vs_currencies=usd')`.
  3. If CoinGecko returns rate limit (HTTP 429) or error, automatically falls back to Binance public ticker `https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT` and `XLMUSDT`.
  4. If both fail, falls back to safe static baseline rates (`xrpUsd: 1.2972`, `xlmUsd: 0.1778`) to prevent checkout crashes.
  5. In-flight promise deduplication (`fxPendingPromise`) prevents stampedes when multiple concurrent requests trigger rate checks.
  6. `getMetalQuote()` follows an identical caching and deduplication flow for gold (`pax-gold`) and silver (`kinesis-silver`), calculating prices per gram via `troyOunce / 31.1034768`.

### E. Groq Cloud API (AI Assistant)
- **Data Flow:**
  1. `AIRouterService.chatCompletion(messages)` queries `GET https://api.groq.com/openai/v1/models` (cached 6 hours) to discover active, non-decommissioned chat models.
  2. Discards whisper, prompt-guard, and classifier models.
  3. Evaluates candidates in priority order (`liveModels` -> `env.GROQ_MODEL` -> `llama-3.3-70b-versatile` -> `llama-3.1-8b-instant`).
  4. Executes `POST /chat/completions` with low temperature (`0.2`) and max tokens (`400`).
  5. If Groq reports a model is decommissioned, invalidates model cache and automatically retries with the next candidate in the same request.

---

## 3. Data Classification Matrix

| Data Field / Entity | Data Nature | Origin / Storage | Mutability |
|:---|:---|:---|:---|
| **Product Prices** | Authoritative Master | MongoDB Atlas `products.price_cents` | Immutable during checkout |
| **Order Total** | Server-Derived | Computed: `sum(product.price_cents * qty)` | Immutable once created |
| **Crypto Invoice Amount** | Server-Derived | Calculated: `order.total_cents / fxRate` | Fixed for 30-min invoice window |
| **Memo / DestinationTag** | Server-Derived | Cryptographic HMAC-SHA256 from `orderId` | Deterministic & Immutable |
| **Transaction Hashes** | External Verified | Public Stellar / XRPL Ledgers | Verified on-chain via RPC |
| **Wallet Balances** | Computed Aggregate | Sum of credits minus sum of debits in `wallet_ledger` | Dynamic on-demand |
| **FX Rates** | External & Cached | CoinGecko / Binance API | Ephemeral (30-min TTL) |
| **Receipt CIDs** | External Verified | Pinata IPFS Gateway | Immutable IPFS Hash |
| **SuperPlatform Quotes** | Mocked / Stubbed | Hardcoded in `hyperliquidPlugin.ts` | Not mounted on public routes |
| **Passkey Sessions** | Mocked / Stubbed | Hardcoded in `privyPlugin.ts` | Not mounted on public routes |
