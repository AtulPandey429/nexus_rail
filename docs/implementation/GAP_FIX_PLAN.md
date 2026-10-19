# 🛠️ NexusRail Gap-Fix & Remediation Plan

**Document ID:** `GAP_FIX_PLAN.md`  
**Version:** 1.0.0  
**Status:** DRAFT (Awaiting Approval)  
**Lead Architect:** Principal Software Engineer & FinTech Architect  

---

## 1. Remediation Sequencing Rationale

Fixes must follow a strict engineering hierarchy:
1. **P0 (Phase A: Critical Financial Settlement & Verification)**: Fix the frontend memo generation mismatch and make the background ledger watcher actively reconcile on-chain payments. Without this, customers' payments fail verification or are abandoned.
2. **P1 (Phase B: Ledger Concurrency & ACID Integrity)**: Implement atomic balance snapshotting and transaction sessions across the internal wallet and agent proposal executions. This prevents concurrent double-spends and removes the \(O(N)\) latency bottleneck.
3. **P2 (Phase C: Resilience, Unified Database & Test Infrastructure)**: Migrate the legacy Supabase guide route to MongoDB Atlas, add XRPL WebSocket keepalive/retry logic, fix the in-memory cache leak, and establish the Node.js 22 built-in test runner.
4. **P3 (Phase D: Middleware & Route Deduplication)**: Clean up Stripe webhook mounting and ensure 100% reliable raw buffer parsing.

---

## 2. Prioritized Task & Remediation Register

---

### Task FIX-01: Fix Frontend Memo Derivation on `/checkout` Page (ISSUE-002)
* **Priority:** **P0 (Blocker)**
* **Why First:** Freighter testnet transactions submitted from `/checkout` fail backend verification because the memo does not match the backend HMAC-SHA256 digest.
* **Affected Files:**
  - [`apps/web/src/app/checkout/page.tsx`](file:///d:/live/nexus-rail/apps/web/src/app/checkout/page.tsx)
  - [`apps/web/src/lib/wallets.ts`](file:///d:/live/nexus-rail/apps/web/src/lib/wallets.ts)
* **Proposed Implementation:**
  - Before requesting Freighter signing, call `POST /api/v1/checkout/stellar/create-invoice` or `POST /api/v1/checkout/stellar/prepare-xdr` to retrieve the server's authoritative 28-byte HMAC memo string.
  - Pass the returned `invoice.paymentIdentifier` directly to `payWithFreighter()`.
* **Required Tests:**
  - Unit test in `apps/web`: Assert invoice memo returned from API is preserved and passed to Freighter payload without string mutation.
  - Integration test: Submit the resulting transaction to `/api/v1/checkout/stellar/verify-payment`; assert `verified: true`.
* **Acceptance Criteria:**
  - Freighter payment on `/checkout` signs with the exact 28-byte `NR<HMAC>` memo.
  - Backend `verifyPayment` confirms the transaction and flips order status to `PAID`.
* **Complexity:** **Low**
* **Regression Risks:** None; fixes a completely broken path.
* **Blockers:** None.

---

### Task FIX-02: Implement Active Blockchain Reconciliation in `LedgerWatcherWorker` (ISSUE-001)
* **Priority:** **P0 (Critical Settlement)**
* **Why Second:** Resolves orphaned payments where users pay via QR code or mobile wallet without manual browser verification.
* **Affected Files:**
  - [`apps/api/src/workers/ledgerWatcher.ts`](file:///d:/live/nexus-rail/apps/api/src/workers/ledgerWatcher.ts)
  - [`apps/api/src/services/crypto/stellarProvider.ts`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/stellarProvider.ts)
  - [`apps/api/src/services/crypto/xrplProvider.ts`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/xrplProvider.ts)
* **Proposed Implementation:**
  - In `LedgerWatcherWorker`, on each 20-second tick:
    1. Fetch `PENDING` orders with crypto payment rails created in the last 60 minutes.
    2. Stellar: Query `horizonServer.payments().forAccount(merchantAddress).order('desc').limit(25).call()`. For each payment record, check if its transaction has an HMAC memo matching a pending order.
    3. XRPL: Query `client.request({ command: 'account_tx', account: merchantAddress, limit: 25 })`. Match incoming transactions where `DestinationTag` equals a pending order's tag and amount delivered is sufficient.
    4. When matched: Call `ordersCol.updateOne({ id: order.id, status: 'PENDING' }, { $set: { status: 'PAID', tx_hash: txHash, updated_at: now } })`.
* **Required Tests:**
  - Mocked Horizon/XRPL integration test: Inject an unconfirmed order, simulate an incoming ledger payment record, assert order status automatically transitions to `PAID`.
* **Acceptance Criteria:**
  - An order paid on-chain transitions to `PAID` within 20-30 seconds with no client-side API call.
* **Complexity:** **Medium**
* **Regression Risks:** Ensure rate-limiting on Horizon/XRPL APIs is respected (do not spam if there are no pending orders).
* **Blockers:** Access to Stellar Horizon testnet and XRPL Altnet WebSocket.

---

### Task FIX-03: Eliminate Double-Spend Race Condition & $O(N)$ Scan with Atomic Wallet Balances (ISSUE-003, ISSUE-004)
* **Priority:** **P1 (Financial Integrity)**
* **Why Third:** Protects internal ledger from concurrent overdrafts and stops latency degradation.
* **Affected Files:**
  - [`apps/api/src/services/mongo.ts`](file:///d:/live/nexus-rail/apps/api/src/services/mongo.ts)
  - [`apps/api/src/services/wallet.ts`](file:///d:/live/nexus-rail/apps/api/src/services/wallet.ts)
  - [`apps/api/src/routes/wallet.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/wallet.ts)
* **Proposed Implementation:**
  1. Add `wallet_balances` collection to `MongoService`:
     ```typescript
     export interface MongoWalletBalanceDoc {
       user_id: string;
       currency: 'USD' | 'XRP' | 'XLM';
       available_cents: number;
       version: number;
       updated_at: string;
     }
     ```
  2. Create unique compound index `{ user_id: 1, currency: 1 }`.
  3. Refactor `WalletService.applyEntry()` to use a MongoDB transaction session:
     ```typescript
     const session = (await MongoService.getClient()).startSession();
     try {
       await session.withTransaction(async () => {
         const filter = type === 'DEBIT'
           ? { user_id: userId, currency, available_cents: { $gte: amountCents } }
           : { user_id: userId, currency };

         const inc = type === 'DEBIT' ? -amountCents : amountCents;
         const res = await balancesCol.findOneAndUpdate(
           filter,
           { $inc: { available_cents: inc, version: 1 }, $set: { updated_at: new Date().toISOString() } },
           { session, returnDocument: 'after' }
         );
         if (!res) throw new Error(`Insufficient ${currency} balance`);
         await ledgerCol.insertOne(txDoc, { session });
       });
     } finally {
       await session.endSession();
     }
     ```
  4. Refactor `getBalance()` to do a direct \(O(1)\) lookup from `wallet_balances`.
* **Required Tests:**
  - Concurrency test: Fire 10 parallel debit requests of $40 against a $50 balance; assert exactly 1 succeeds and 9 fail with HTTP 400. Final balance must equal $10.
* **Acceptance Criteria:**
  - Zero balance overdrafts under concurrent requests.
  - `getBalance()` latency drops to < 5ms.
* **Complexity:** **Medium**
* **Regression Risks:** Replica set transactions require MongoDB Atlas (supported in production M0 cluster).
* **Blockers:** None.

---

### Task FIX-04: Atomic Transaction Wrapper for Agent Proposal Confirmation (ISSUE-005)
* **Priority:** **P1 (Financial Integrity)**
* **Why Fourth:** Depends on Task FIX-03 (MongoDB sessions in wallet service).
* **Affected Files:**
  - [`apps/api/src/routes/agent.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/agent.ts)
  - [`apps/api/src/agent/proposalLock.ts`](file:///d:/live/nexus-rail/apps/api/src/agent/proposalLock.ts)
* **Proposed Implementation:**
  - Refactor `/api/v1/agent/confirm` to execute within a single MongoDB session:
    ```typescript
    await session.withTransaction(async () => {
      // 1. Consume proposal
      await ProposalLockManager.consumeProposal(proposalId, userId, session);
      // 2. Debit wallet balance
      await walletService.debitBalance(userId, priceCents, 'USD', proposalId, session);
      // 3. Insert paid order
      await ordersCol.insertOne(orderDoc, { session });
    });
    ```
* **Required Tests:**
  - Unit test: Abort order insertion artificially; assert wallet balance remains unchanged and proposal remains valid.
* **Acceptance Criteria:**
  - All-or-nothing atomicity across proposal status, wallet debit, and order insertion.
* **Complexity:** **Low - Medium**
* **Regression Risks:** None.
* **Blockers:** Task FIX-03 must be completed first.

---

### Task FIX-05: Migrate `/api/v1/guide` from Legacy Supabase to MongoDB Atlas (ISSUE-009)
* **Priority:** **P2 (Architecture Uniformity)**
* **Why Fifth:** Eliminates dual-database SPOF.
* **Affected Files:**
  - [`apps/api/src/routes/guide.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/guide.ts)
  - [`apps/api/src/db/supabase.ts`](file:///d:/live/nexus-rail/apps/api/src/db/supabase.ts)
* **Proposed Implementation:**
  - Create MongoDB collection `guide_messages` with index `{ user_id: 1, created_at: 1 }`.
  - Replace `db().from('guide_messages')` calls with `MongoService.getCollection('guide_messages')`.
  - Deprecate and remove Supabase client initialization.
* **Required Tests:**
  - Integration test: Execute `POST /api/v1/guide/messages` and `GET /api/v1/guide/messages` without Supabase credentials. Verify messages are persisted and retrieved from MongoDB Atlas.
* **Acceptance Criteria:**
  - Catalog guide assistant operates with zero errors when `SUPABASE_URL` is omitted.
* **Complexity:** **Low**
* **Regression Risks:** None.
* **Blockers:** None.

---

### Task FIX-06: Add XRPL WebSocket Heartbeat, Auto-Reconnect & Fallback (ISSUE-008)
* **Priority:** **P2 (Operational Resilience)**
* **Why Sixth:** Protects XRPL settlement from transient altnet WebSocket disconnects.
* **Affected Files:**
  - [`apps/api/src/services/crypto/xrplProvider.ts`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/xrplProvider.ts)
* **Proposed Implementation:**
  - Configure array of testnet WebSocket endpoints:
    `['wss://s.altnet.rippletest.net:51233', 'wss://testnet.xrpl-labs.com']`.
  - Attach listener for `disconnected` event: automatically trigger exponential backoff reconnection.
  - Implement a 30-second ping heartbeat in `ensureConnected()`.
* **Required Tests:**
  - Unit test: Call `disconnect()` on underlying client; assert subsequent `getAccountBalance()` automatically reconnects.
* **Acceptance Criteria:**
  - Provider auto-reconnects within 3 seconds of a socket drop without throwing 502 to user requests.
* **Complexity:** **Low - Medium**
* **Regression Risks:** None.
* **Blockers:** None.

---

### Task FIX-07: In-Memory RedisCacheService Active TTL Pruning & Bound Capacity (ISSUE-006)
* **Priority:** **P2 (Operational Stability)**
* **Why Seventh:** Prevents Node.js heap exhaustion in prolonged container runs.
* **Affected Files:**
  - [`apps/api/src/services/redis.ts`](file:///d:/live/nexus-rail/apps/api/src/services/redis.ts)
* **Proposed Implementation:**
  - Set a maximum capacity limit (e.g. 5,000 items). If exceeded, evict the oldest entry (FIFO/LRU).
  - Implement a 60-second active cleanup timer via `setInterval.unref()` that iterates over `cacheStore` and deletes entries where `expiresAt < Date.now()`.
  - If `REDIS_URL` or `UPSTASH_REDIS_REST_URL` is configured in environment, optionally delegate to real Redis.
* **Required Tests:**
  - Unit test: Insert 100 expired keys; trigger cleanup tick; assert map size drops to 0.
* **Acceptance Criteria:**
  - Expired keys are purged from memory within 60 seconds without requiring a read call.
* **Complexity:** **Low**
* **Regression Risks:** Low.
* **Blockers:** None.

---

### Task FIX-08: Setup Unified Node.js 22 Test Suite (`npm test`) (ISSUE-011)
* **Priority:** **P2 (Quality & Regression Harness)**
* **Why Eighth:** Provides a standardized CI test harness for all subsequent code changes.
* **Affected Files:**
  - [`package.json`](file:///d:/live/nexus-rail/package.json)
  - [`apps/api/package.json`](file:///d:/live/nexus-rail/apps/api/package.json)
  - Add test files: `apps/api/src/**/*.test.ts`
* **Proposed Implementation:**
  - Use Node.js 22 built-in test runner (`node --test`). Zero new third-party test runners needed.
  - Add `"test": "tsx --test src/**/*.test.ts"` in `apps/api/package.json`.
  - Add root `"test": "npm run test --workspace=apps/api"` in `package.json`.
* **Required Tests:**
  - Verify that running `npm test` executes all test files and exits with code 0.
* **Acceptance Criteria:**
  - `npm test` runs all unit tests cleanly in under 5 seconds.
* **Complexity:** **Low**
* **Regression Risks:** None.
* **Blockers:** None.

---

### Task FIX-09: Deduplicate Stripe Webhook Routes & Validate Raw Body Buffer (ISSUE-012)
* **Priority:** **P3 (Middleware Hygiene)**
* **Why Ninth:** Polishes webhook pipeline and prevents signature verification failure.
* **Affected Files:**
  - [`apps/api/src/server.ts`](file:///d:/live/nexus-rail/apps/api/src/server.ts)
  - [`apps/api/src/routes/webhooks.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/webhooks.ts)
* **Proposed Implementation:**
  - Remove duplicate `webhooksRouter.post('/stripe', stripeWebhookHandler)` from `routes/webhooks.ts`.
  - Keep the dedicated `app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler)` before `express.json()`.
* **Required Tests:**
  - Integration test: Send raw Buffer payload with mock Stripe signature header; assert handler receives raw buffer.
* **Acceptance Criteria:**
  - Stripe webhook handler only receives unparsed `Buffer` instances.
* **Complexity:** **Low**
* **Regression Risks:** None.
* **Blockers:** None.

---

## 3. Implementation Order & Dependencies Summary

```
[FIX-08: Setup npm test harness]
       │
       ▼
[FIX-01: Fix Frontend Memo Mismatch] ──► [FIX-02: Active Ledger Watcher]
       │
       ▼
[FIX-03: Atomic Wallet Balances] ─────► [FIX-04: Atomic Agent Confirm]
       │
       ▼
[FIX-05: Migrate Guide to MongoDB]
       │
       ▼
[FIX-06: XRPL WebSocket Auto-Reconnect]
       │
       ▼
[FIX-07: Redis Active TTL Cleanup]
       │
       ▼
[FIX-09: Stripe Webhook Route Cleanup]
```

---

## 4. Required Credentials & Environment Pre-requisites

| Credential / Variable | Purpose | Status in Environment |
| :--- | :--- | :--- |
| `MONGODB_URI` | Multi-document replica set transactions | Present in `.env` |
| `STELLAR_MERCHANT_PUBLIC_KEY` | Stellar merchant payment address | Configured with valid default |
| `XRPL_MERCHANT_ADDRESS` | XRPL merchant payment address | Configured with live faucet funded account |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe Card verification | Present in `.env` |
| `GROQ_API_KEY` | Groq Llama 3.3 dynamic routing | Present in `.env` |
