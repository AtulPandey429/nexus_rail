# 🧪 NexusRail Testing & Release Plan

**Document ID:** `TESTING_AND_RELEASE_PLAN.md`  
**Version:** 1.0.0  
**Status:** DRAFT (Awaiting Approval)  
**Lead Architect:** Principal QA & DevOps Engineer  

---

## 1. Testing Philosophy & Verification Gateways

To guarantee zero regressions in multi-rail commerce settlement, every remediation task and feature must navigate an evidence-based testing pipeline before task closure:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 1. Plan &    │ ──► │ 2. Local TDD │ ──► │ 3. Build &   │ ──► │ 4. Review &  │
│ Pre-Test Spec│     │ Implementation│     │ Type-Check   │     │ Safe Commit  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 8. Task      │ ◄── │ 7. Live E2E  │ ◄── │ 6. Live API  │ ◄── │ 5. Deploy to │
│ Signoff & Log│     │ User Journey │     │ Verification │     │ Environment  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Testing Framework & Tool Selection

NexusRail prioritizes lightweight, standard tooling already aligned with Node.js 22 and Next.js 15:

* **Unit & Integration Test Runner:** Node.js 22 native test runner (`node --test`) paired with `tsx`.
  * *Why:* Fast, zero extra devDependencies required, native ES module support, built-in assertion module (`node:assert/strict`).
* **Type-Checking & Build Validation:** `tsc --noEmit` across all workspaces (`packages/shared`, `apps/api`, `apps/web`).
* **Frontend Component & Linting:** `next lint` (ESLint) and React 19 testing harnesses.
* **End-to-End & Network Verification:** Automated HTTP test scripts (`scripts/test-phase*.mjs` and live test suites) exercising real testnet nodes and MongoDB Atlas.

---

## 3. Test Suites by Task & Feature

---

### Suite T-01: Stellar Memo Derivation & Frontend Alignment (FIX-01)
* **Type:** Unit + Integration Test
* **Test Case 1.1 (Unit):** Verify authoritative memo derivation formula.
  * Inputs: Order ID `NR-TEST-ORDER-1234`.
  * Expected Output: 28-character uppercase string starting with `NR` followed by 26 hex characters matching `crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex').slice(0, 26).toUpperCase()`.
* **Test Case 1.2 (Integration):** Verify `apps/web/src/app/checkout/page.tsx` calls backend invoice endpoint and passes memo to Freighter.
  * Assert: `payWithFreighter` receives the exact backend-derived memo.
* **Test Case 1.3 (Verification):** Submit signed transaction to `/api/v1/checkout/stellar/verify-payment`.
  * Assert: Response `{ success: true, verified: true }`.

---

### Suite T-02: Active Background Ledger Reconciliation (FIX-02)
* **Type:** Integration & Background Worker Test
* **Test Case 2.1 (Worker Loop):** Seed a pending order in `orders` collection with rail `STELLAR` and generated HMAC memo.
  * Trigger: Call `LedgerWatcherWorker.reconcilePendingOrders()`.
  * Expected Output: Worker queries Stellar Horizon payments for merchant vault, matches record, updates order status to `PAID`, and logs audit trace.
* **Test Case 2.2 (XRPL Matching):** Seed a pending order with rail `XRPL` and deterministic DestinationTag.
  * Trigger: Run worker tick.
  * Expected Output: Worker queries `account_tx`, matches destination tag, validates delivered amount, updates order to `PAID`.
* **Test Case 2.3 (Negative Test):** Worker inspects order with unpaid tag or transaction with insufficient drops.
  * Expected Output: Order status remains `PENDING`.

---

### Suite T-03: Atomic Wallet Balances & Overdraft Prevention (FIX-03 & FIX-04)
* **Type:** Concurrency & Transaction Stress Test
* **Test Case 3.1 (Atomic Debit):** Seed `wallet_balances` with $50.00 USD (5000 cents).
  * Concurrency: Fire 10 simultaneous debit requests of $40.00 USD (4000 cents).
  * Expected Output: Exactly 1 request succeeds with HTTP 200; 9 requests fail with HTTP 400 (`Insufficient USD balance`).
  * Final State: Available balance equals 1000 cents ($10.00). Ledger contains exactly one debit row.
* **Test Case 3.2 (Rollback on Agent Confirm Failure):** In `/api/v1/agent/confirm`, inject a mock error into `ordersCol.insertOne`.
  * Expected Output: Transaction aborts. Proposal status remains `PROPOSED`. Wallet balance is not deducted.

---

### Suite T-04: Guide Migration & Database Uniformity (FIX-05)
* **Type:** Data Migration & Regression Test
* **Test Case 4.1 (MongoDB Persistence):** Unset `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
  * Action: Send `POST /api/v1/guide/messages` with `{ message: "Recommend hardware wallets" }`.
  * Expected Output: HTTP 200 returned. User question and AI assistant reply are saved in MongoDB collection `guide_messages`.
* **Test Case 4.2 (Retrieval):** Send `GET /api/v1/guide/messages`.
  * Expected Output: Returns full chat thread history ordered by `created_at ASC`.

---

### Suite T-05: Server-Sent Events (SSE) Live Checkout Stream (FEAT-01)
* **Type:** Real-Time Stream & Network Test
* **Test Case 5.1 (Connection & Keepalive):** Open `GET /api/v1/checkout/orders/:orderId/stream`.
  * Expected Output: Response headers `Content-Type: text/event-stream`. Receives initial `:connected` comment.
* **Test Case 5.2 (Push on Settlement):** While SSE connection is active, trigger order update to `PAID`.
  * Expected Output: Client receives event payload `data: {"status":"PAID","txHash":"..."}` within 150ms. Connection closes cleanly.

---

### Suite T-06: Cryptographic Quote Ticket & Slippage Protection (FEAT-02)
* **Type:** Crypto Financial Contract Test
* **Test Case 6.1 (Quote Validity):** Request invoice quote.
  * Expected Output: Returns quote ticket signed by HMAC secret, expiring in 300 seconds.
* **Test Case 6.2 (Slippage Rejection):** Attempt verification on an expired quote ticket where spot price dropped 4%.
  * Expected Output: Verification rejects payment with `UNDERPAID_SLIPPAGE_EXCEEDED` and prompts for price delta adjustment.

---

## 4. Release & Deployment Pipeline

### Step-by-Step Gateways:

1. **Local Pre-Flight Checks:**
   ```bash
   npm run build:shared
   npm run build:api
   npm run build:web
   npm test
   ```
2. **Commit Standards:**
   - Commit messages must follow Conventional Commits:  
     `fix(wallet): atomic balance locks and overdraft defense [FIX-03]`  
     `feat(checkout): server-sent events real-time settlement stream [FEAT-01]`
3. **Deployment Strategy:**
   - **Backend:** Automatic deployment to Render Web Service (`https://nexus-rail.onrender.com`).
   - **Frontend:** Automatic deployment to Vercel (`https://nexus-rail-one.vercel.app`).
   - Reversible commits with non-breaking database schema changes (additive fields only).

---

## 5. Live Environment Verification Checklist

Following any deployment, execute the following live validation battery:

- [ ] `GET /api/v1/health` returns status `ok` and valid uptime.
- [ ] `GET /api/v1/crypto/providers` returns both Stellar Horizon and XRPL Altnet providers with positive vault balances.
- [ ] `POST /api/v1/checkout/stellar/create-invoice` generates an authentic 28-byte HMAC memo.
- [ ] `POST /api/v1/checkout/xrpl/create-invoice` generates a deterministic 32-bit DestinationTag.
- [ ] Live UI at `https://nexus-rail-one.vercel.app/checkout` accurately reflects active invoice parameters and stream status.
