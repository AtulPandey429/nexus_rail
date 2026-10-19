# 🚀 NexusRail Feature Implementation Plan

**Document ID:** `FEATURE_IMPLEMENTATION_PLAN.md`  
**Version:** 1.0.0  
**Status:** DRAFT (Awaiting Approval)  
**Lead Architect:** Principal Software Engineer & FinTech Architect  

---

## 1. Feature Strategy & Guiding Principles

This plan introduces 4 practical, production-ready fintech commerce features designed to elevate NexusRail from a testnet prototype to an institutional-grade multi-rail commerce platform. 

**Selection Rules:**
1. **Zero Theoretical Fluff:** No quantum algorithms, no synthetic AI wrappers, no unbuildable hype.
2. **Standard Stack Compatibility:** Must run on Node.js 22, Express 4, React 19, Next.js 15, and MongoDB Atlas.
3. **Solves Verified Merchant & Consumer Friction:** Focuses on real-time checkout feedback, currency volatility mitigation, dollar-stable settlement, and guaranteed webhook ingestion.

---

## 2. Feature Specifications

---

### FEATURE-01: Server-Sent Events (SSE) Real-Time Settlement Stream & Auto-Confirm UI

#### 1. Feature ID & Name
* **ID:** `FEAT-01`
* **Name:** `SSE Real-Time Settlement Stream & Auto-Confirm Checkout`

#### 2. User Problem & Expected Benefit
* **Problem:** Currently, when a customer sends XLM or XRP via mobile QR code or desktop wallet, they must manually locate their transaction hash, paste it into an input box on `MultiRailCheckoutSelector`, and click "Verify". If they close the browser tab or misplace the hash, their order sits in `PENDING` limbo.
* **Benefit:** When a customer pays from their mobile device, the desktop checkout screen detects the on-chain confirmation within seconds, plays a confirmation sound/animation, and seamlessly routes them to their IPFS-backed receipt—with zero manual typing.

#### 3. Evidence Supporting the Need
* Code inspection of [`apps/web/src/components/MultiRailCheckoutSelector.tsx:117-144`](file:///d:/live/nexus-rail/apps/web/src/components/MultiRailCheckoutSelector.tsx#L117-L144) demonstrates that manual verification is the only client-side path.
* `apps/api/src/sockets/server.ts` is an uninstalled mock that only calls `console.log`.

#### 4. Current Implementation Status
* **Status:** Planned / Not Implemented.

#### 5. Proposed User Experience & Behavior
1. User selects Stellar (XLM) or XRPL (XRP) in `MultiRailCheckoutSelector`.
2. A QR code and payment address appear alongside a live pulsating badge: `"Listening for on-chain settlement..."`.
3. The browser opens a native `EventSource` connection to `/api/v1/checkout/orders/:orderId/stream`.
4. As soon as the background reconciler (`LedgerWatcherWorker`) detects the matching transaction, it pushes `{ event: 'settled', txHash: '...', status: 'PAID' }`.
5. The UI automatically displays a green checkmark and forwards the customer to `/receipt?orderId=...`.

#### 6. Frontend Changes
* File: [`apps/web/src/components/MultiRailCheckoutSelector.tsx`](file:///d:/live/nexus-rail/apps/web/src/components/MultiRailCheckoutSelector.tsx)
  * Add `useEffect` hook listening to `EventSource('/api/v1/checkout/orders/' + activeOrderId + '/stream')`.
  * Display a live settlement radar spinner while awaiting transaction.
  * Auto-invoke `onPaymentSuccess(data)` upon receiving the settlement event.
  * Cleanly close `eventSource.close()` on component unmount or rail change.

#### 7. Backend Changes & API Contracts
* File: [`apps/api/src/routes/checkout.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/checkout.ts)
* New Endpoint: `GET /api/v1/checkout/orders/:orderId/stream`
  * **Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
  * **Authentication:** Validated via query token `?token=...` or standard `Authorization` header.
  * **Behavior:** Keeps connection open; registers client in an in-memory event emitter mapped by `orderId`. Emits keepalive ping every 15 seconds. Closes on client disconnect or order settlement.

#### 8. Database & Migration Requirements
* None required (uses existing MongoDB `orders` collection).

#### 9. Data Sources & External Dependencies
* Pure native standard HTTP streams (standard Node.js `res.write` and browser `window.EventSource`). Zero new npm packages.

#### 10. Security & Edge Cases
* **Authorization:** Only the user who owns `order.user_id` (or an admin) may open the stream.
* **Stream Timeout:** Automatically terminates after 15 minutes of inactivity to prevent connection leaks.
* **Pre-Settled Check:** If order is already `PAID` upon connecting, immediately emit `{ status: 'PAID' }` and close.

#### 11. Required Tests
* Unit test: Open SSE connection to mock order; emit order update; assert client receives valid formatted event.
* Integration test: Complete order payment via testnet; verify SSE client receives event and exits cleanly.

#### 12. Acceptance Criteria
* Browser automatically navigates to receipt screen within 3 seconds of transaction confirmation on testnet without user typing a transaction hash.

#### 13. Complexity & Priority
* **Complexity:** **Medium** (1.5 days).
* **Priority:** **High** (Dramatically improves Web3 checkout conversion).

---

### FEATURE-02: Cryptographic Quote Ticket & Slippage Protection Engine

#### 1. Feature ID & Name
* **ID:** `FEAT-02`
* **Name:** `Cryptographic Dynamic Quote Ticket & Slippage Guard`

#### 2. User Problem & Expected Benefit
* **Problem:** Invoices currently lock the XLM or XRP price for 30 minutes. If the asset depreciates 5% within that half-hour, the merchant suffers financial loss upon delivery.
* **Benefit:** Issues a cryptographic 5-minute Quote Ticket. If payment arrives after ticket expiration, the system checks whether the delivered crypto value satisfies the dollar value at the current spot rate. If slippage exceeds 1.5%, the order is safely quarantined as `UNDERPAID_PENDING_ADJUSTMENT`.

#### 3. Evidence Supporting the Need
* [`apps/api/src/services/crypto/stellarProvider.ts:59`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/stellarProvider.ts#L59) hardcodes a 30-minute expiration window without checking price movement upon payment arrival.
* [`apps/web/src/app/checkout/page.tsx:60, 95-100`](file:///d:/live/nexus-rail/apps/web/src/app/checkout/page.tsx#L60) already renders a 60-second visual countdown, but it is not backed by server-enforced slippage logic.

#### 4. Current Implementation Status
* **Status:** Planned / Not Implemented.

#### 5. Proposed User Experience & Behavior
1. In the checkout modal, the crypto quote displays a dynamic countdown timer (e.g. `04:59`).
2. If the user completes the transfer while the quote is valid, settlement is instantaneous.
3. If the quote expires before broadcast, the UI automatically requests a refreshed quote ticket with updated token quantities.
4. If a payment arrives late on-chain during a market crash, the user receives clear guidance to pay the delta or request a refund.

#### 6. Frontend Changes
* Files:
  - [`apps/web/src/components/MultiRailCheckoutSelector.tsx`](file:///d:/live/nexus-rail/apps/web/src/components/MultiRailCheckoutSelector.tsx)
  - [`apps/web/src/lib/rates.ts`](file:///d:/live/nexus-rail/apps/web/src/lib/rates.ts)
* Display real-time quote validity bar; automatically trigger quote renewal when the timer expires.

#### 7. Backend Changes & API Contracts
* File: [`apps/api/src/services/rates.ts`](file:///d:/live/nexus-rail/apps/api/src/services/rates.ts)
  * Add `generateQuoteTicket(orderId: string, amountUsdCents: number, assetSymbol: string)`:
    * Returns `{ ticketId, rate, cryptoAmount, expiresAt, signature }`.
    * Signature is an HMAC-SHA256 digest of `orderId + amountUsdCents + cryptoAmount + expiresAt`.
* File: [`apps/api/src/routes/checkout.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/checkout.ts)
  * In `/:chain/create-invoice`, include the signed `quoteTicket`.
  * In `/:chain/verify-payment`, validate that `Date.now() <= quoteTicket.expiresAt`. If expired, fetch fresh spot rate; calculate delivered value:
    * If `deliveredUsd >= orderTotalUsd * 0.985` (within 1.5% tolerance), accept and mark `PAID`.
    * Otherwise, mark `status: 'UNDERPAID'` and record required adjustment amount.

#### 8. Database & Migration Requirements
* Add optional fields to `MongoOrderDoc`:
  - `quote_ticket`: `{ rate: number; expires_at: string; signature: string }`
  - `slippage_usd_cents`: `number`

#### 9. Data Sources & Dependencies
* Uses existing `RatesService` / CoinGecko / Binance feeds. Node standard `crypto`. Zero new npm packages.

#### 10. Security & Edge Cases
* Prevents forged quotes: Signature verifies ticket was created by NexusRail with the exact order ID.
* High volatility safeguard: If price drops > 5% within 10 seconds, rates service triggers a fresh quote.

#### 11. Required Tests
* Unit test: Generate quote ticket, verify signature verification passes; verify tampered ticket fails.
* Integration test: Verify payment with simulated expired quote ticket under acceptable vs excessive slippage.

#### 12. Acceptance Criteria
* Quotes refresh automatically in UI upon expiration.
* Underpaid transactions exceeding 1.5% slippage are quarantined rather than marked fully paid.

#### 13. Complexity & Priority
* **Complexity:** **Medium** (1.5 days).
* **Priority:** **Medium - High** (Merchant revenue protection).

---

### FEATURE-03: Native USDC Stablecoin Settlement Rail on Stellar Horizon

#### 1. Feature ID & Name
* **ID:** `FEAT-03`
* **Name:** `Native Stellar USDC Settlement Rail`

#### 2. User Problem & Expected Benefit
* **Problem:** Institutional clients and mainstream buyers do not want crypto volatility for physical hardware purchases ($129 USD Rail One, etc.). XLM testnet fluctuations create friction.
* **Benefit:** Allows checkout in Circle Testnet USDC on Stellar with guaranteed 1:1 USD valuation, sub-cent transaction fees, and instant finality—eliminating all FX conversion risk.

#### 3. Evidence Supporting the Need
* Currently, [`apps/api/src/services/crypto/stellarProvider.ts:98`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/stellarProvider.ts#L98) only issues transactions using `Asset.native()` (XLM).
* Circle maintains an official Stellar Testnet USDC contract with high testnet liquidity (`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`).

#### 4. Current Implementation Status
* **Status:** Planned / Not Implemented.

#### 5. Proposed User Experience & Behavior
1. In `MultiRailCheckoutSelector`, user sees a dedicated "Stellar USDC" option with the USDC badge.
2. Price displays as: `$129.00 USD = 129.00 USDC` (Zero conversion spread).
3. User signs with Freighter; transaction delivers Circle USDC directly to the merchant vault.
4. Receipt displays asset as `USDC (Stellar)`.

#### 6. Frontend Changes
* Files:
  - [`apps/web/src/components/MultiRailCheckoutSelector.tsx`](file:///d:/live/nexus-rail/apps/web/src/components/MultiRailCheckoutSelector.tsx)
  - [`apps/web/src/lib/wallets.ts`](file:///d:/live/nexus-rail/apps/web/src/lib/wallets.ts)
* Add payment rail `STELLAR_USDC`.
* Display 1:1 pricing badge with Circle USDC logo.

#### 7. Backend Changes & API Contracts
* File: [`apps/api/src/services/crypto/stellarProvider.ts`](file:///d:/live/nexus-rail/apps/api/src/services/crypto/stellarProvider.ts)
  * Define `USDC_TESTNET_ASSET = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')`.
  * Support `assetSymbol: 'USDC' | 'XLM'` in `createInvoice()`, `buildPaymentXdr()`, and `verifyPayment()`.
  * In `verifyPayment()`, inspect `paymentOp.asset_code === 'USDC'` and issuer address matches Circle testnet.
* File: [`apps/api/src/routes/checkout.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/checkout.ts)
  * Add route `/api/v1/checkout/stellar-usdc/*`.

#### 8. Database & Migration Requirements
* Update `MongoOrderDoc.payment_rail` enum to include `'STELLAR_USDC'`.

#### 9. Data Sources & External Dependencies
* Native `@stellar/stellar-sdk` (already installed).

#### 10. Security & Edge Cases
* **Trustline Verification:** Check whether source and destination accounts have established a trustline for USDC before building XDR.
* **Issuer Verification:** Ensure payment operation specifically references Circle's verified issuer address to reject counterfeit USDC assets.

#### 11. Required Tests
* Unit test: Build payment XDR for USDC asset; assert operation type is payment, asset code is USDC, and issuer matches.
* Integration test: Verify mock Horizon transaction containing USDC payment record; assert order marked `PAID`.

#### 12. Acceptance Criteria
* Freighter can sign and submit 1:1 USDC transactions on Stellar testnet.
* Backend verifies USDC payment operation, asset code, and exact USD cents amount delivered.

#### 13. Complexity & Priority
* **Complexity:** **Low - Medium** (1 day).
* **Priority:** **High** (High utility institutional rail).

---

### FEATURE-04: Idempotent Webhook Dead-Letter Queue (DLQ) & Auto-Reconciler

#### 1. Feature ID & Name
* **ID:** `FEAT-04`
* **Name:** `Webhook Ingestion Dead-Letter Queue (DLQ) & Auto-Reconciler`

#### 2. User Problem & Expected Benefit
* **Problem:** If MongoDB Atlas encounters a transient connection timeout when Stripe dispatches `checkout.session.completed`, Express returns 500, dropping the webhook. The card is charged, but the order remains unfulfilled until Stripe's delayed retry.
* **Benefit:** Guarantees zero dropped Stripe card orders by persisting raw webhook payloads in an idempotent queue and running background retry sweeps.

#### 3. Evidence Supporting the Need
* [`apps/api/src/routes/webhooks.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/webhooks.ts) executes inline database updates synchronously inside the webhook HTTP request lifecycle. A single database hiccup fails the webhook.

#### 4. Current Implementation Status
* **Status:** Planned / Not Implemented.

#### 5. Proposed User Experience & Behavior
* Transparent to the end user: 100% card checkout reliability with guaranteed order fulfillment even during brief database maintenance or high traffic spikes.

#### 6. Frontend Changes
* None required.

#### 7. Backend Changes & API Contracts
* File: [`apps/api/src/services/mongo.ts`](file:///d:/live/nexus-rail/apps/api/src/services/mongo.ts)
  * Add `webhook_events` collection:
    ```typescript
    export interface MongoWebhookEventDoc {
      id: string; // Stripe evt_xxx
      source: 'STRIPE';
      type: string;
      payload: any;
      status: 'PENDING' | 'PROCESSED' | 'FAILED';
      retry_count: number;
      last_error?: string;
      created_at: string;
      updated_at: string;
    }
    ```
  * Create unique index on `{ id: 1 }` for deduplication.
* File: [`apps/api/src/routes/webhooks.ts`](file:///d:/live/nexus-rail/apps/api/src/routes/webhooks.ts)
  * On incoming webhook: verify signature, insert into `webhook_events` with status `PENDING`, return HTTP 200 `{ received: true }` within 50ms.
  * Asynchronously invoke `StripeService.markCheckoutPaid()`. If successful, mark `PROCESSED`.
* File: [`apps/api/src/workers/keepAlive.ts`](file:///d:/live/nexus-rail/apps/api/src/workers/keepAlive.ts)
  * Add a 60-second sweeper that queries `webhook_events` with `status: 'FAILED'` and `retry_count < 5` and retries processing.

#### 8. Database & Migration Requirements
* Add collection `webhook_events` with index `{ id: 1 }` (unique) and `{ status: 1, retry_count: 1 }`.

#### 9. Data Sources & Dependencies
* Native Stripe SDK and MongoDB Atlas.

#### 10. Security & Edge Cases
* Deduplication: If Stripe delivers the same `evt_xxx` twice, the unique index rejects the second insert, preventing duplicate ledger crediting.
* Tamper resistance: Webhook signatures are verified before saving to the DLQ.

#### 11. Required Tests
* Integration test: Dispatch duplicate Stripe webhook payloads; assert exactly one order fulfillment occurs.
* Failure recovery test: Simulate database error during initial processing; verify background sweeper succeeds on next tick.

#### 12. Acceptance Criteria
* Webhooks respond HTTP 200 in < 50ms.
* Failed webhooks automatically retry and succeed within 60 seconds of database recovery.

#### 13. Complexity & Priority
* **Complexity:** **Low** (1 day).
* **Priority:** **Medium** (Enterprise card fulfillment guarantee).

---

## 3. Feature Sequencing & Implementation Matrix

| Feature ID | Feature Name | Primary Risk Addressed | Complexity | Target Phase |
| :--- | :--- | :--- | :--- | :--- |
| **FEAT-01** | SSE Real-Time Settlement Stream | Manual txHash friction & abandoned checkouts | **Medium** | Phase 5.2 |
| **FEAT-02** | Cryptographic Quote Ticket & Slippage Guard | Currency volatility revenue loss | **Medium** | Phase 5.3 |
| **FEAT-03** | Native Stellar USDC Settlement Rail | Testnet crypto volatility friction | **Low-Med** | Phase 5.4 |
| **FEAT-04** | Webhook Dead-Letter Queue (DLQ) | Dropped Stripe card fulfillments | **Low** | Phase 5.5 |
