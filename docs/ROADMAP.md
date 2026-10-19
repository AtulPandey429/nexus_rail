# 🗺️ NexusRail — Prioritized Improvement Roadmap

**Status:** Proposed Architecture & Recommendations (Not Implemented)  
**Basis of Recommendations:** Gaps, stubbed modules, and technical risks identified during codebase audit.

---

## 1. Roadmap Overview & Priority Matrix

| Priority | Initiative | Complexity | Target Area | Primary Value |
|:---:|:---|:---:|:---|:---|
| **P0** | **Real Distributed Redis Integration** | Low | `services/redis.ts` | Replaces in-memory `Map` with Upstash/Redis for multi-instance caching & locks. |
| **P0** | **Live WebSocket Server Integration (Socket.io / ws)** | Medium | `sockets/server.ts` | Replaces console-stub with real push updates for instant order finality. |
| **P1** | **Migrate Catalog Guide from Supabase to MongoDB** | Low | `routes/guide.ts` | Eliminates secondary database dependency; unifies storage under MongoDB Atlas. |
| **P1** | **On-Chain Server-Sent Events (SSE) Stream Listener** | Medium | `workers/ledgerWatcher.ts` | Replaces 20-second polling interval with event-driven block streaming on Stellar & XRPL. |
| **P2** | **Native Web3 Wallet Passkey Authentication (Privy / Web3Auth)** | Medium | `plugins/privyPlugin.ts` | Replaces manual wallet entry with one-click biometric passkey logins. |
| **P2** | **Stellar Soroban Smart Contract Escrow** | High | `services/soroban.ts` | Cryptographic escrow release triggered upon verified physical courier delivery. |
| **P3** | **Interactive Swagger / OpenAPI UI Explorer** | Low | `server.ts` | Mounts interactive API documentation on `/api/v1/docs` using `swagger-ui-express`. |

---

## 2. Detailed Technical Proposals

### P0 — Real Distributed Redis Integration
1. **Problem Solved:** Currently, `RedisCacheService` uses an in-memory JS `Map`. In a multi-dyno production cluster, cache entries and locks are not shared.
2. **Why It Matters:** Scaling the API across multiple containers will cause cache inconsistencies and race conditions.
3. **Expected Benefit:** Seamless multi-instance horizontal scaling with shared TTL cache and cluster-wide proposal locking.
4. **Dependencies:** `npm install @upstash/redis` or `ioredis`.
5. **Complexity:** Low.
6. **Priority:** **P0** (Critical for production horizontal scaling).
7. **Risks & Trade-Offs:** Requires a Redis instance (free tier available via Upstash Redis).
8. **Relevant Files:** `apps/api/src/services/redis.ts`, `apps/api/src/config/env.ts`.
9. **Implementation Outline:**
   - Add `REDIS_URL` or `UPSTASH_REDIS_REST_URL` to `env.ts`.
   - Update `RedisCacheService.getCache`, `setCache`, and `invalidateCache` to use the Redis client.

---

### P0 — Live WebSocket Server Integration
1. **Problem Solved:** `SocketService` currently logs events to `console.log`. The frontend checkout terminal must poll the API to discover when a crypto payment settles.
2. **Why It Matters:** Polling adds unnecessary HTTP request overhead and delays UI feedback by several seconds.
3. **Expected Benefit:** Sub-second instant UI feedback when an on-chain transaction confirms on Stellar or XRPL.
4. **Dependencies:** `npm install socket.io` in `apps/api`, `npm install socket.io-client` in `apps/web`.
5. **Complexity:** Medium.
6. **Priority:** **P0** (Core user experience bottleneck in checkout).
7. **Risks & Trade-Offs:** Requires stateful WebSocket connection handling and reconnection logic on the client.
8. **Relevant Files:** `apps/api/src/server.ts`, `apps/api/src/sockets/server.ts`, `apps/web/src/app/checkout/page.tsx`.
9. **Implementation Outline:**
   - Wrap Express `app` with Node `http.createServer(app)`.
   - Initialize `new Server(httpServer, { cors: ... })` in `SocketService`.
   - Emit `order:paid` event inside `verifyPayment()` and `stripeWebhookHandler`.
   - Connect client socket in `apps/web/src/components/MultiRailCheckoutSelector.tsx`.

---

### P1 — Migrate Catalog Guide from Supabase to MongoDB
1. **Problem Solved:** `/api/v1/guide` requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, creating an unnecessary dual-database architecture.
2. **Why It Matters:** All other services have been migrated to MongoDB Atlas. Retaining Supabase solely for `guide_messages` creates operational overhead.
3. **Expected Benefit:** Single database architecture (MongoDB Atlas), simplifying deployment and environment variable management.
4. **Dependencies:** None.
5. **Complexity:** Low.
6. **Priority:** **P1** (Reduces operational complexity).
7. **Risks & Trade-Offs:** None.
8. **Relevant Files:** `apps/api/src/routes/guide.ts`, `apps/api/src/services/mongo.ts`, `apps/api/src/db/supabase.ts`.
9. **Implementation Outline:**
   - Add `guide_messages` collection to `MongoService`.
   - Replace `db().from('guide_messages')` calls in `guide.ts` with `MongoService.getCollection('guide_messages')`.
   - Deprecate `supabase.ts`.

---

### P1 — On-Chain Server-Sent Events (SSE) Stream Listener
1. **Problem Solved:** `LedgerWatcherWorker` currently polls MongoDB on a 20-second timer.
2. **Why It Matters:** Polling introduces a 0–20s delay before detecting on-chain payments.
3. **Expected Benefit:** Payments detected within milliseconds of ledger confirmation.
4. **Dependencies:** Existing `@stellar/stellar-sdk` and `xrpl` SDKs.
5. **Complexity:** Medium.
6. **Priority:** **P1**.
7. **Risks & Trade-Offs:** Streaming connections require graceful reconnect handlers if testnet nodes restart.
8. **Relevant Files:** `apps/api/src/workers/ledgerWatcher.ts`, `apps/api/src/services/crypto/stellarProvider.ts`, `apps/api/src/services/crypto/xrplProvider.ts`.
9. **Implementation Outline:**
   - In `StellarTestnetProvider`, attach `this.horizonServer.payments().cursor('now').stream({ onmessage: ... })`.
   - In `XrplTestnetProvider`, send `subscribe` command for transactions on the merchant account.
   - On incoming payment event, verify memo/tag and update order to `PAID` immediately.

---

### P2 — Native Web3 Wallet Passkey Authentication
1. **Problem Solved:** Users without browser extension wallets (Freighter or GemWallet) must manually paste public addresses.
2. **Why It Matters:** Manual address entry has friction on mobile devices.
3. **Expected Benefit:** Seamless one-click login for non-crypto users creating an embedded wallet via biometric passkey (FaceID / TouchID).
4. **Dependencies:** Privy or Web3Auth SDK.
5. **Complexity:** Medium.
6. **Priority:** **P2**.
7. **Relevant Files:** `apps/api/src/plugins/privyPlugin.ts`, `apps/web/src/components/WalletConnectModal.tsx`.

---

### P3 — Interactive Swagger / OpenAPI UI Explorer
1. **Problem Solved:** Developers and partners inspecting the API must read static markdown files or postman collections.
2. **Why It Matters:** An interactive UI enables one-click endpoint testing and schema exploration directly from the browser.
3. **Expected Benefit:** Enhanced developer experience and faster integration for third-party merchants.
4. **Dependencies:** `npm install swagger-ui-express yamljs`.
5. **Complexity:** Low.
6. **Priority:** **P3**.
7. **Relevant Files:** `apps/api/src/server.ts`, `openapi.yaml`.
8. **Implementation Outline:**
   - Read `openapi.yaml` in `server.ts`.
   - Mount `app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))`.
