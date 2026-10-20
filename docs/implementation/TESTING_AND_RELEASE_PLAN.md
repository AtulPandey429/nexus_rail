# 🧪 NexusRail Testing & Release Plan

This document establishes the mandatory quality gates, local testing protocol, and release procedures for the NexusRail platform.

---

## 1. Quality Assurance Protocol

```
Local Code Implementation
        │
        ▼
Static Analysis & Type Checks (`tsc --noEmit`)
        │
        ▼
Next.js Production Build (`pnpm --filter web build`)
        │
        ▼
Backend API Unit & Integration Tests (`node --test ...`)
        │
        ▼
Local Multi-Process Server Launch (API: 4000, Web: 3000)
        │
        ▼
Manual Browser Verification (Store, Cart, Checkout, Swap, Admin, Receipt)
        │
        ▼
Customer Verification & Final Report
        │
        ▼
🔒 RELEASE GATE: Await Explicit User Authorization Before Any Remote Push/Deploy
```

---

## 2. Test Execution Matrix

### Test Suite 1: Automated Unit & Integration Tests
* **Command**: `pnpm --filter api test` or direct `node --import tsx --test apps/api/test/*.test.ts`
* **Target Suites**:
  1. `crossChainSwap.test.ts` - On-chain swap execution, Stellar/XRPL payouts, balanced ledger.
  2. `crypto-memo.test.ts` - HMAC-SHA256 Stellar memo & XRPL destination tag derivation.
  3. `jwt.test.ts` - HMAC-SHA256 token generation and validation.
  4. `stellar-usdc.test.ts` - Circle USDC invoice creation & payment XDR.
  5. `agent-proposal.test.ts` - Autonomous proposal locks and operator approvals.
  6. `wallet-auth.test.ts` - Multi-chain challenge-response signature verification.

### Test Suite 2: Build & Type Safety
* **Command**: `pnpm --filter web build`
* **Assertion**: 27/27 static & dynamic Next.js routes compile with 0 TypeScript/ESLint errors.

### Test Suite 3: Manual Browser Journey Verification Checklist
1. **Landing Page (`/`)**:
   - Verify black & gold palette: `#08090C` background, `#D4AF37` gold accents.
   - Verify 3D particle canvas responsiveness and performance.
   - Assert no tacky "DEMO / TESTNET" banners in customer view.
2. **Catalog & Store (`/store`)**:
   - Verify product cards render in `#171A20` with `#2B2E36` borders.
   - Verify add to cart updates badge instantly without page reload.
3. **Cart & Checkout (`/cart`, `/checkout`)**:
   - Verify line items, pricing, subtotal, and tax/fee calculation.
   - Verify Freighter (XLM) and GemWallet (XRP) payment selection.
   - Assert cart is cleared ONLY upon verified payment confirmation.
4. **Receipt Page (`/receipt`)**:
   - Verify Black & Gold official layout.
   - Verify on-chain transaction hash links to live testnet explorer.
   - Test "Print Receipt / Download PDF" (`Ctrl+P` / print dialogue) renders clean, unclipped, single/two-page output with sharp vector typography and QR code.
5. **Cross-Chain Swap (`/swap`)**:
   - Test XRP -> XLM and XLM -> XRP quote calculations.
   - Verify GemWallet drops conversion (`2 XRP` = `2,000,000 drops`).
   - Verify Freighter sign transaction popup triggers.
6. **Admin Console (`/admin`)**:
   - Verify non-admin cannot access admin console.
   - Verify admin authentication gate opens for unauthenticated users.
   - Verify 1-click Demo Operator login (`admin@nexusrail.com`) unlocks full dashboard.
7. **AI Agent Desk**:
   - Verify chat drawer opens with black and gold aesthetic.
   - Ask for catalog products, order status, and swap quotes.

---

## 3. Strict Release Gate Confirmation

In accordance with strict operating guidelines:
- **No changes will be pushed to GitHub (`origin/main`) or deployed to production without explicit confirmation from the user.**
- Local verification will be executed and local testing URLs provided:
  - Frontend: `http://localhost:3000`
  - Backend: `http://localhost:4000`
  - Health Endpoint: `http://localhost:4000/api/v1/health`
