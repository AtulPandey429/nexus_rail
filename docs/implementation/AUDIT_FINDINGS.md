# 🔍 NexusRail Master Code Audit & Gap Findings

**Audit Date:** October 2026  
**Auditors:** Principal Software Engineer, FinTech Architect, QA Automation Lead, DevOps Engineer  
**Codebase Targets:** 
- `apps/api` (Node.js 22, Express 4.21, MongoDB Atlas 7.7, Stellar SDK 13.3, XRPL 4.7, Stripe 18.5)
- `apps/web` (Next.js 15.2 App Router, React 19, Tailwind CSS)
- `packages/shared` (TypeScript Contracts & Types)

---

## 1. Executive Summary & Audit Methodology

This audit was conducted using direct AST source inspection, reachable execution path analysis, network topology verification, and reconciliation against the authoritative specification. 

Every finding is classified strictly into:
- **Confirmed Bug**: Verified code flaw with reproducible failure mode.
- **Integration Gap**: Divergence between frontend expectations and backend contracts.
- **Architectural Bottleneck**: Scalability, latency, or concurrency hazard.
- **Operational Risk**: Single points of failure, missing retries, or dependency fragility.

---

## 2. Comprehensive Findings Registry

---

### ISSUE-001: Phantom Background Ledger Watcher Causes Orphaned Crypto Orders

* **Category:** Confirmed Bug / Operational Failure
* **Affected Files & Endpoints:**
  - File: [`apps/api/src/workers/ledgerWatcher.ts:18-32`](file:///d:/live/nexus-rail/apps/api/src/workers/ledgerWatcher.ts#L18-L32)
  - Endpoint: Background Daemon (started in [`apps/api/src/server.ts:14`](file:///d:/live/nexus-rail/apps/api/src/server.ts#L14))
* **Current Observed Behavior:**
  The `LedgerWatcherWorker` runs every 20 seconds via `setInterval`. It queries up to 5 pending crypto orders from MongoDB:
  ```typescript
  const pendingCryptoOrders = await ordersCol.find({
    status: 'PENDING',
    payment_rail: { $in: ['XLM', 'XRP', 'STELLAR', 'XRPL'] },
  }).limit(5).toArray();

  if (pendingCryptoOrders.length > 0) {
    console.log(`🔍 [LedgerWatcher] Watching ${pendingCryptoOrders.length} pending testnet orders...`);
  }
  ```
  The worker logs the count to stdout and exits the tick. It **never calls** `stellarProvider.verifyPayment()` or `xrplProvider.verifyPayment()`, and **never** updates `ordersCol` to `PAID`.
* **Expected Behavior:**
  The worker must actively scan recent ledger transactions for the merchant vault on Stellar Horizon and XRPL Altnet, match transaction memos or destination tags to pending orders, verify delivered amounts against order requirements, and atomically mark matched orders as `PAID` with their confirmed `tx_hash`.
* **Reproduction Steps:**
  1. Create an order via `POST /api/v1/checkout/stellar/create-invoice` for order `NR-TEST-001`.
  2. Send XLM on Stellar Horizon testnet to the merchant vault with the specified HMAC memo.
  3. Wait 5 minutes for the ledger watcher to run multiple intervals.
  4. Query `GET /api/v1/orders/NR-TEST-001`.
  5. **Result:** The order remains stuck in `PENDING` indefinitely.
* **Actual Impact:**
  Any customer paying via external wallet, mobile wallet QR code scan, or who closes their browser before manual verification has their funds collected in the merchant vault while their order remains unfulfilled.
* **Severity:** **Critical**
* **Priority:** **P0** (Core financial reconciliation failure).
* **Dependencies & Risks:** Requires access to Stellar Horizon and XRPL node endpoints.
* **Suggested Solution:** Implement automated account payment inspection in `LedgerWatcherWorker` using `horizonServer.payments().forAccount()` and XRPL `account_tx`.
* **Verification Method:** Create pending testnet orders, broadcast on-chain testnet transfers, and verify the background worker transitions orders to `PAID` within 30 seconds without user interaction.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-002: Memo Format Mismatch Between Frontend Checkout Page and Backend Stellar Verification

* **Category:** Confirmed Bug / Integration Failure
* **Affected Files & Endpoints:**
  - Frontend: [`apps/web/src/app/checkout/page.tsx:154`](file:///d:/live/nexus-rail/apps/web/src/app/checkout/page.tsx#L154)
  - Backend: [`apps/api/src/services/crypto/stellarProvider.ts:57-58, 137-142`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/stellarProvider.ts#L57-L58)
  - Endpoint: `POST /api/v1/checkout/stellar/verify-payment`
* **Current Observed Behavior:**
  In `apps/web/src/app/checkout/page.tsx`, the Freighter payment handler passes a hand-rolled memo:
  ```typescript
  memo: `NR-${orderId.replace(/-/g, '').slice(0, 25).toUpperCase()}`
  ```
  However, the backend authoritative invoice generator creates:
  ```typescript
  const memoHash = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex');
  const memoText = (`NR${memoHash}`).slice(0, 28).toUpperCase();
  ```
  And backend `verifyPayment` strictly checks:
  ```typescript
  const memoMatches = Boolean(tx.memo && tx.memo.toUpperCase() === expectedMemo);
  ```
* **Expected Behavior:**
  The frontend must obtain the exact expected memo from the backend invoice endpoint (`/api/v1/checkout/stellar/create-invoice` or `/api/v1/checkout/stellar/prepare-xdr`) and pass that exact string to Freighter or GemWallet.
* **Reproduction Steps:**
  1. Open `/checkout?orderId=NR-1048`.
  2. Sign payment with Freighter testnet extension.
  3. Submit transaction hash to `POST /api/v1/checkout/stellar/verify-payment`.
  4. **Result:** Verification rejected with error: `"Transaction memo does not match order payment specification"`.
* **Actual Impact:**
  100% of real Freighter extension checkouts executed from `/checkout` will fail backend verification and be rejected as fraudulent/unmatched payments.
* **Severity:** **Critical**
* **Priority:** **P0** (Blocks live Web3 wallet checkout).
* **Dependencies & Risks:** Low risk fix; requires frontend page to consume backend invoice memo.
* **Suggested Solution:** Refactor `apps/web/src/app/checkout/page.tsx` to call `/api/v1/checkout/stellar/create-invoice` or use the shared memo derivation utility.
* **Verification Method:** Generate invoice, sign with Freighter, submit txHash to backend `/verify-payment`, assert `verified: true`.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-003: Internal Wallet Debit Race Condition & Concurrency Overdraft Vulnerability

* **Category:** Confirmed Bug / Financial Security Vulnerability
* **Affected Files & Endpoints:**
  - File: [`apps/api/src/services/wallet.ts:22-68`](file:///d:/live/nexus-rail/apps/api/src/services/wallet.ts#L22-L68)
  - Endpoints: `POST /api/v1/wallet/debit`, `POST /api/v1/agent/confirm`
* **Current Observed Behavior:**
  `WalletService.applyEntry()` performs a check-then-act sequence without isolation:
  ```typescript
  const currentBalances = await this.getBalance(userId);
  const currentBalance = currentBalances[currency] || 0;

  if (type === 'DEBIT' && currentBalance < amountCents) {
    throw new Error(`Insufficient ${currency} balance...`);
  }

  const balanceAfter = type === 'CREDIT' ? currentBalance + amountCents : currentBalance - amountCents;
  // Non-atomic insert
  await col.insertOne(txDoc);
  ```
* **Expected Behavior:**
  Debits must be executed within an atomic MongoDB transaction session with conditional criteria (`{ available_cents: { $gte: amountCents } }`) or optimistic locking to prevent concurrent requests from driving balances below zero.
* **Reproduction Steps:**
  1. Seed user wallet balance to $50.00 USD (5000 cents).
  2. Dispatch two simultaneous HTTP requests to debit $40.00 USD.
  3. Both requests evaluate `currentBalance (5000) >= 4000` simultaneously before either inserts a debit.
  4. Both insert debit rows.
  5. **Result:** Net balance becomes -$30.00 USD.
* **Actual Impact:**
  Malicious or rapid double-click users can overdraft their internal wallet balance and purchase products without sufficient funds.
* **Severity:** **High**
* **Priority:** **P1** (Financial double-spend vulnerability).
* **Dependencies & Risks:** MongoDB Atlas supports replica set transactions (`MongoClient.startSession()`).
* **Suggested Solution:** Introduce an atomic balance document collection (`wallet_balances`) with conditional `$inc` and MongoDB session transactions wrapping ledger insertions.
* **Verification Method:** Automated concurrent test issuing 10 parallel debit requests against a fixed balance; verify that exactly the authorized count succeed and balance never drops below zero.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-004: O(N) Historical Ledger Table Scan on Every Balance Lookup

* **Category:** Architectural Bottleneck / Performance Defect
* **Affected Files & Endpoints:**
  - File: [`apps/api/src/services/wallet.ts:8-20`](file:///d:/live/nexus-rail/apps/api/src/services/wallet.ts#L8-L20)
  - Endpoints: `GET /api/v1/wallet/balance`, `POST /api/v1/agent/chat`
* **Current Observed Behavior:**
  ```typescript
  async getBalance(userId: string): Promise<Record<WalletCurrency, number>> {
    const col = await MongoService.getCollection<MongoWalletTxDoc>('wallet_ledger');
    const txs = await col.find({ user_id: userId }).toArray();

    const balance: Record<WalletCurrency, number> = { USD: 0, XRP: 0, XLM: 0 };
    for (const tx of txs) {
      if (!currencies.includes(tx.currency)) continue;
      const sign = tx.type === 'CREDIT' ? 1 : -1;
      balance[tx.currency] += sign * Number(tx.amount_cents);
    }
    return balance;
  }
  ```
* **Expected Behavior:**
  Balance lookups must be \(O(1)\) reads from an indexed state record. `wallet_ledger` must remain an immutable audit log, not an operational calculation table.
* **Reproduction Steps:**
  1. Populate 5,000 ledger entries for a test user.
  2. Execute `GET /api/v1/wallet/balance`.
  3. Measure latency and memory allocation.
  4. **Result:** Request latency scales linearly with ledger history, causing server CPU spikes and database network bandwidth exhaustion.
* **Actual Impact:**
  High-frequency users or automated AI agents experience compounding latency that eventually triggers HTTP request timeouts (504).
* **Severity:** **High**
* **Priority:** **P1** (Scalability barrier).
* **Suggested Solution:** Maintain a materialized `wallet_balances` collection updated atomically alongside ledger inserts.
* **Verification Method:** Benchmark `getBalance` with 1,000 ledger rows; verify execution latency remains < 10ms.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-005: Non-Atomic Multi-Step Agent Proposal Confirmation

* **Category:** Confirmed Bug / Data Inconsistency
* **Affected Files & Endpoints:**
  - File: [`apps/api/src/routes/agent.ts:121-165`](file:///d:/live/nexus-rail/apps/api/src/routes/agent.ts#L121-L165)
  - Endpoint: `POST /api/v1/agent/confirm`
* **Current Observed Behavior:**
  In `agentRouter.post('/confirm')`:
  1. `ProposalLockManager.consumeProposal(proposalId, userId)` sets proposal status to `CONFIRMED`.
  2. `walletService.debitBalance(...)` inserts debit into ledger.
  3. `ordersCol.insertOne(orderDoc)` inserts paid order.
  These 3 steps run as separate non-transactional database operations.
* **Expected Behavior:**
  All three operations must succeed or fail as a single atomic unit. If order insertion fails, the debit must be rolled back and the proposal unlocked/restored.
* **Reproduction Steps:**
  1. Trigger proposal confirmation when MongoDB `orders` collection encounters a constraint violation or network timeout.
  2. Observe that the user's wallet is debited and the proposal is consumed, but no order document is created in the database.
* **Actual Impact:**
  Customers lose wallet balance without an order being created, leading to support escalations and accounting desynchronization.
* **Severity:** **High**
* **Priority:** **P1** (Data integrity & consumer fund safety).
* **Suggested Solution:** Wrap `consumeProposal`, `debitBalance`, and `insertOne` in `session.withTransaction()`.
* **Verification Method:** Simulate failure in order insertion step; verify wallet balance remains untouched and proposal state rolls back.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-006: In-Memory RedisCacheService Unbounded Map Memory Leak & Cluster Partitioning

* **Category:** Architectural Risk / State Volatility
* **Affected Files & Endpoints:**
  - File: [`apps/api/src/services/redis.ts:1-24`](file:///d:/live/nexus-rail/apps/api/src/services/redis.ts#L1-L24)
* **Current Observed Behavior:**
  `cacheStore = new Map<string, { value: any; expiresAt: number }>()` stores cache entries without a background eviction timer or maximum size limit. Items are only removed if read after expiration (`getCache`).
  In a multi-process or containerized deployment, cache invalidations are strictly local to that container.
* **Expected Behavior:**
  Cache must either connect to real Redis/Upstash (when configured via `REDIS_URL`) or implement an active TTL sweep + LRU bound, with fallback to MongoDB for shared distributed state.
* **Severity:** **High**
* **Priority:** **P2** (Operational stability in clustered environments).
* **Suggested Solution:** Enhance `RedisCacheService` to actively purge expired keys on an interval, enforce maximum entry capacity (e.g. 5,000 entries), and support standard Redis client connections when `REDIS_URL` is set.
* **Verification Method:** Populate 10,000 keys with 1-second TTL, wait 2 seconds, verify heap memory drops and expired keys are deleted without read access.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-007: Console.log Socket.io Stub Deprives Frontend of Real-Time Settlement Feeds

* **Category:** Missing Requirement / Stale UI
* **Affected Files & Endpoints:**
  - File: [`apps/api/src/sockets/server.ts:1-18`](file:///d:/live/nexus-rail/apps/api/src/sockets/server.ts#L1-L18)
* **Current Observed Behavior:**
  `SocketService` methods only execute `console.log`. `socket.io` is not installed in `apps/api/package.json`. Frontend has no mechanism to receive push notifications when payments confirm on-chain.
* **Expected Behavior:**
  Server must provide real-time push events to client checkout screens so users see immediate confirmation when their payment settles on-chain.
* **Severity:** **Medium**
* **Priority:** **P2** (User checkout experience).
* **Suggested Solution:** Implement HTTP Server-Sent Events (SSE) on `GET /api/v1/checkout/orders/:orderId/stream` to provide reliable real-time push without the overhead and firewall issues of uninstalled WebSockets.
* **Verification Method:** Connect EventSource client to SSE route; trigger status update on backend; assert client receives event within 100ms.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-008: Single XRPL WebSocket Connection Lacks Heartbeat & Auto-Reconnect

* **Category:** Operational Risk / Single Point of Failure
* **Affected Files & Endpoints:**
  - File: [`apps/api/src/services/crypto/xrplProvider.ts:18-49`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/xrplProvider.ts#L18-L49)
* **Current Observed Behavior:**
  The XRPL provider instantiates a single `Client` pointing to `wss://s.altnet.rippletest.net:51233`. If the connection is broken by testnet resets or idle socket timeouts, mid-flight requests throw unhandled exceptions returning 502 Bad Gateway to clients.
* **Expected Behavior:**
  The provider must implement ping/pong heartbeats, automatic reconnection with exponential backoff, and a list of alternative testnet endpoints.
* **Severity:** **Medium**
* **Priority:** **P2** (Testnet reliability).
* **Suggested Solution:** Wrap `ensureConnected()` with retry logic, keepalive ping, and error boundary.
* **Verification Method:** Simulate socket disconnection; verify subsequent balance or invoice request automatically recovers without throwing 502.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-009: Legacy Supabase Dependency in `/api/v1/guide` Breaches Database Uniformity

* **Category:** Architectural Inconsistency / Dependency Fragility
* **Affected Files & Endpoints:**
  - Files: [`apps/api/src/routes/guide.ts:10-55`](file:///d:/live/nexus-rail/apps/api/src/routes/guide.ts#L10-L55), [`apps/api/src/db/supabase.ts:1-16`](file:///d:/live/nexus-rail/apps/api/src/db/supabase.ts#L1-L16)
  - Endpoint: `GET /api/v1/guide/messages`, `POST /api/v1/guide/messages`
* **Current Observed Behavior:**
  All user, product, cart, order, and agent data has been migrated to MongoDB Atlas. However, `/api/v1/guide` still instantiates `@supabase/supabase-js` to read/write `guide_messages`. If Supabase credentials are missing or expired, the guide assistant fails completely.
* **Expected Behavior:**
  `guide_messages` should be stored in MongoDB Atlas, unifying all persistence under a single connection pool and eliminating Supabase configuration overhead.
* **Severity:** **Medium**
* **Priority:** **P2** (Operational simplicity & credential minimization).
* **Suggested Solution:** Migrate `guide_messages` queries to MongoDB Atlas collection `guide_messages` using `MongoService.getCollection()`.
* **Verification Method:** Post and retrieve guide messages with `SUPABASE_URL` unset; verify successful persistence and retrieval from MongoDB.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-010: Frontend `/checkout` Hardcodes Mock XRPL DestinationTag and Simulation Shortcuts

* **Category:** Confirmed Defect / Mock Bypass in UI
* **Affected Files & Endpoints:**
  - File: [`apps/web/src/app/checkout/page.tsx:160-174`](file:///d:/live/nexus-rail/apps/web/src/app/checkout/page.tsx#L160-L174)
* **Current Observed Behavior:**
  In `apps/web/src/app/checkout/page.tsx`:
  - GemWallet payment passes a hardcoded `destinationTag: 104857`.
  - When GemWallet/Freighter are uninstalled, lines 167-174 simulate testnet payment with `Math.random()` and directly write a pseudo-receipt to `localStorage` without contacting the backend API.
* **Expected Behavior:**
  The `/checkout` page must call `POST /api/v1/checkout/xrpl/create-invoice` to retrieve the authentic deterministic destination tag, pass it to GemWallet, and poll or await backend verification before routing to `/receipt`.
* **Severity:** **Medium**
* **Priority:** **P2** (Prevents fake order confirmation in UI).
* **Suggested Solution:** Unify `checkout/page.tsx` with the real multi-rail backend invoice flow implemented in `MultiRailCheckoutSelector.tsx`.
* **Verification Method:** Trace network requests on `/checkout`; ensure `create-invoice` is called and GemWallet receives the server-derived tag.
* **Confidence Level:** 100% (Confirmed by code inspection).

---

### ISSUE-011: Missing Standard Test Runner (`npm test`) in Monorepo

* **Category:** Developer Experience & CI/CD Gap
* **Affected Files & Endpoints:**
  - Files: [`package.json`](file:///d:/live/nexus-rail/package.json), [`apps/api/package.json`](file:///d:/live/nexus-rail/apps/api/package.json)
* **Current Observed Behavior:**
  There is no standard `npm test` script in root `package.json` or `apps/api/package.json`. Verification scripts in `scripts/` exist as loose `.mjs` scripts targeting `apps/api/dist/`.
* **Expected Behavior:**
  A developer or CI system should be able to run `npm test` and execute unit and integration suites using Node.js 22 built-in test runner (`node --test`).
* **Severity:** **Medium**
* **Priority:** **P2** (Prerequisite for safe refactoring).
* **Suggested Solution:** Add `"test": "node --test --import tsx 'src/**/*.test.ts'"` to `apps/api/package.json` and root `package.json`.
* **Verification Method:** Run `npm test` and assert all unit tests execute and pass.
* **Confidence Level:** 100%.

---

### ISSUE-012: Express Stripe Webhook Route Parsing Redundancy

* **Category:** Potential Vulnerability / Middleware Edge Case
* **Affected Files & Endpoints:**
  - Files: [`apps/api/src/server.ts:53, 72`](file:///d:/live/nexus-rail/apps/api/src/server.ts#L53-L72), [`apps/api/src/routes/webhooks.ts:8`](file:///d:/live/nexus-rail/apps/api/src/routes/webhooks.ts#L8)
  - Endpoint: `POST /api/v1/webhooks/stripe`
* **Current Observed Behavior:**
  `server.ts` mounts `app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler)` at line 53, before `express.json()`. However, line 72 mounts `app.use('/api/v1/webhooks', webhooksRouter)`, which also registers `webhooksRouter.post('/stripe', stripeWebhookHandler)`.
  In `webhooks.ts`, line 8 attempts a fallback: `Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}))`. If a request hits the second router after JSON parsing, signature validation fails because JSON key order is not preserved.
* **Expected Behavior:**
  Deduplicate the route definitions. Remove the redundant route from `webhooksRouter` and strictly require raw buffer parsing for all Stripe webhook payloads.
* **Severity:** **Low**
* **Priority:** **P3** (Middleware hygiene).
* **Suggested Solution:** Remove `/stripe` route from `webhooksRouter` and maintain the single dedicated raw buffer endpoint at `server.ts:53`.
* **Verification Method:** Send simulated Stripe webhook with signed raw payload; assert 100% signature verification success.
* **Confidence Level:** 100%.

---

## 3. Severity & Priority Classification Matrix

| Issue ID | Title | Severity | Priority | Risk Category |
| :--- | :--- | :--- | :--- | :--- |
| **ISSUE-001** | Phantom Background Ledger Watcher (Orphaned Orders) | **Critical** | **P0** | Revenue Loss / Order Fulfillment |
| **ISSUE-002** | Memo Format Mismatch in Frontend Stellar Checkout | **Critical** | **P0** | Payment Verification Failure |
| **ISSUE-003** | Internal Wallet Debit Race Condition & Overdraft | **High** | **P1** | Financial Ledger Double-Spend |
| **ISSUE-004** | \(O(N)\) Historical Ledger Table Scan on Balance Read | **High** | **P1** | Latency Explosion & Memory Bloat |
| **ISSUE-005** | Non-Atomic Agent Proposal Confirmation Flow | **High** | **P1** | Fund Loss without Order Record |
| **ISSUE-006** | In-Memory RedisCacheService Memory Leak & Desync | **High** | **P2** | Container Memory Crash |
| **ISSUE-007** | Stubbed Console.log Socket.io Server | **Medium** | **P2** | Stale User Experience |
| **ISSUE-008** | XRPL WebSocket Connection Fragility & Drops | **Medium** | **P2** | Unhandled 502 Errors |
| **ISSUE-009** | Legacy Supabase Dependency in `/guide` | **Medium** | **P2** | Database Fragmentation |
| **ISSUE-010** | Mock DestinationTag & Bypass in `checkout/page.tsx` | **Medium** | **P2** | Faked UI Order State |
| **ISSUE-011** | Missing Unified `npm test` Test Runner | **Medium** | **P2** | Regression Safety |
| **ISSUE-012** | Stripe Webhook Route Parsing Redundancy | **Low** | **P3** | Middleware Cleanliness |
