# Module 3 Implementation Plan & Living Change Log

> **Status:** Implementation Active  
> **Target Monorepo:** `backend/` and `frontend/`  
> **Test Suite:** `backend/test/portfolio-pnl.test.ts`  

---

## 1. Step-by-Step Implementation Checklist

- [x] **Phase 1: Architecture & Research Documentation**
  - [x] Create `docs/modules/module-3-portfolio-pnl/README.md`
  - [x] Create `01_RESEARCH_AND_PNL_MATH.md` (Weighted Average Cost Basis, Unrealized/Realized P&L, 0.5% Cashout Spread)
  - [x] Create `02_DATABASE_SCHEMA_AND_TYPES.md` (`user_holdings`, `portfolio_events`, `MongoOrderDoc.portfolio_credited`)
  - [x] Create `03_BACKEND_API_AND_FLOW.md` (`PortfolioService` API contracts and settlement hooks)
  - [x] Create `04_FRONTEND_AND_ADMIN_UI_FLOW.md` (`/profile`, `/activity`, and `/admin` ledger tab)
  - [x] Create `05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md`

- [x] **Phase 2: Database Schema & Core Service (`backend/`)**
  - [x] Add `MongoUserHoldingDoc`, `MongoPortfolioEventDoc`, and `portfolio_credited?: boolean` on `MongoOrderDoc` in `backend/src/services/mongo.ts`.
  - [x] Add indexes for `{ user_id: 1, symbol: 1 }` and `{ user_id: 1, created_at: -1 }`.
  - [x] Define shared interfaces in `backend/src/types/index.ts` and `frontend/src/types/index.ts`.
  - [x] Implement `PortfolioService` (`backend/src/services/portfolioService.ts`):
    - `creditOrderAllocations(order, session?)` with strict idempotency guard
    - `getUserPortfolio(userId)` with live oracle hydration
    - `sellHolding(userId, { symbol, quantity })` with atomic condition `{ quantity: { $gte: quantity } }`, 0.5% spread, and USD balance credit
    - `getPlatformAUC()` for admin aggregation

- [x] **Phase 3: Hooking Payment Settlement Rails (`backend/`)**
  - [x] Wire `creditOrderAllocations` into `checkout.ts` (`verifyPayment` and `/nr/pay`).
  - [x] Wire into `stripe.ts` (`fulfillOrderFromSession`).
  - [x] Wire into `ledgerWatcher.ts` (`reconcilePendingOrders`).
  - [x] Wire into `agent.ts` (`POST /confirm`).

- [x] **Phase 4: API Routes (`backend/`)**
  - [x] Create `backend/src/routes/portfolio.ts` mounting `GET /api/v1/portfolio` and `POST /api/v1/portfolio/sell`.
  - [x] Register `portfolioRouter` in `backend/src/server.ts`.
  - [x] Add `GET /api/v1/admin/portfolios` in `backend/src/routes/admin.ts`.

- [x] **Phase 5: User Storefront UI (`frontend/`)**
  - [x] Upgrade `frontend/src/app/profile/page.tsx`:
    - Add Live Portfolio & P&L Summary Strip (Invested Value, Live Value, Unrealized P&L pill, INR conversion).
    - Render Holding Cards with Cost Basis vs Current Price, 24h change, and "1-Click Cashout" button.
    - Build 1-Click Cashout modal with quick percentage buttons (25%, 50%, 75%, 100%) and spread calculation.
  - [x] Update `frontend/src/app/activity/page.tsx` with Portfolio Events tab.

- [x] **Phase 6: Admin Console (`frontend/admin`)**
  - [x] Populate missing `{activeTab === 'ledger'}` view in `frontend/src/app/admin/page.tsx` with AUC vs Hot Vault Reserves and live liquidations feed.

- [x] **Phase 7: Automated Testing & Verification**
  - [x] Create `backend/test/portfolio-pnl.test.ts` testing:
    - Order decomposition and holding creation for smart baskets and asset packs.
    - Weighted-Average Cost Basis calculation across multiple purchases.
    - Idempotency guard: duplicate calls to `creditOrderAllocations` do not double-credit.
    - Atomic sell rejects overdraft (`quantity > owned`), computes 0.5% spread, and credits USD wallet.
    - Admin AUC aggregation.
  - [x] Verify clean builds: `npm run build:backend` (0 errors) and `npm run build:frontend` (22/22 routes, 0 errors).
  - [x] 24/24 tests passing across M1, M2, M3, and FX test suites.

---

## 2. Living Change Log

| Date | Commit / Step | Changes & Additions | Status |
| :--- | :--- | :--- | :--- |
| **2026-11-16** | **Phase 1** | Completed full architectural documentation suite for Module 3 in `docs/modules/module-3-portfolio-pnl/`. | **Complete** |
| **2026-11-16** | **Phase 2 & 3** | Implemented `user_holdings`, `portfolio_events`, and `PortfolioService` with Weighted-Average Cost basis math and idempotency guards across checkout, Stripe, LedgerWatcher, and AI Desk. | **Complete** |
| **2026-11-16** | **Phase 4** | Mounted `GET /api/v1/portfolio`, `POST /api/v1/portfolio/sell`, and `GET /api/v1/admin/portfolios`. | **Complete** |
| **2026-11-16** | **Phase 5 & 6** | Upgraded `/profile` with live P&L dashboard & 1-click cashout modal; upgraded `/activity` with portfolio events; resolved empty `{activeTab === 'ledger'}` in `/admin` with live AUC console. | **Complete** |
| **2026-11-16** | **Phase 7** | Created `backend/test/portfolio-pnl.test.ts` (7/7 tests passing; 24/24 overall). Both backend and frontend builds verified cleanly. | **Complete** |
