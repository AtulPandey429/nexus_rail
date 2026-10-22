# Module 1 — Implementation Plan, Automated Test Matrix & Living Change Log

> **Parent Module:** [`module-1-nr-token/README.md`](./README.md)  
> **Target Verification:** Zero TypeScript errors across `@nexusrail/shared`, `@nexusrail/api`, `@nexusrail/web` + all unit/integration tests passing  

---

## 1. Ordered 8-Step Implementation Plan

| Step | Layer | Status | Target Files | Exact Work & Verification |
| :--- | :--- | :---: | :--- | :--- |
| **`1.1`** | Shared Types | `[x]` | `packages/shared/src/types/database.ts` | Add `'NR'` to `WalletCurrency` and `'NR_TOKEN'` to `PaymentRail`. Verified with `npm run build:shared`. |
| **`1.2`** | DB Schema | `[x]` | `apps/api/src/services/mongo.ts` | Add `MongoTokenPoolDoc`, `MongoTokenPriceTickDoc`, `'NR'` to wallet interfaces, `$NR` fields to `MongoOrderDoc`, and indexes (`token_pool`, `token_price_history`). |
| **`1.3`** | Wallet Ledger | `[x]` | `apps/api/src/services/wallet.ts` | Support `'NR'` in `getBalance()` and `applyEntry()` with `10^6` micro-NR precision and currency-aware error messages. |
| **`1.4`** | AMM Core | `[x]` | `apps/api/src/services/nrTokenService.ts` | Implement `NrTokenService` with `BigInt` $x \cdot y = k$ math, optimistic concurrency retries, `ClientSession` transactions, `payOrderWithNr()`, `injectRevenueToPool()`, and `adminAdjustReserve()`. |
| **`1.5`** | Backend Routes | `[x]` | `apps/api/src/routes/swap.ts`<br>`apps/api/src/routes/checkout.ts`<br>`apps/api/src/routes/admin.ts`<br>`apps/api/src/services/products.ts`<br>`apps/api/src/routes/agent.ts` | Add `GET /api/v1/swap/nr-pool`, extend `/swap/quote` + `/initiate` + `/execute` for `NR`/`USD`, add `POST /api/v1/checkout/nr/pay`, add `GET /api/v1/admin/nr-pool` + `POST /api/v1/admin/nr-pool/adjust-reserve`, sync `NR-TOKEN` live price in `ProductService`, and wire real `$NR` holdings in `agent.ts`. |
| **`1.6`** | User Frontend | `[x]` | `apps/web/src/app/swap/page.tsx`<br>`apps/web/src/app/checkout/page.tsx` | Add `'NR'` & `'USD'` selectors to `/swap`, Tokenomics Banner + AMM quote impact + internal ledger swap mode, replace disabled `EVM` rail on `/checkout` with `$NR Token (Save 10% · 0% Fee)`. |
| **`1.7`** | Admin UI | `[x]` | `apps/web/src/app/admin/page.tsx` | Add Live `$NR` AMM Pool & Reserve Backing Card inside `overview` & `rails` tabs + Operator Reserve Injection form. |
| **`1.8`** | Tests & Docs | `[x]` | `apps/api/test/nr-token-amm.test.ts`<br>`docs/modules/module-1-nr-token/*` | Created and executed `nr-token-amm.test.ts` (7/7 subtests passing covering `T1.1`–`T1.8`), verified TypeScript builds (`shared`, `api`, `web`), and updated Living Change Log. |

---

## 2. Automated Verification Test Matrix (`apps/api/test/nr-token-amm.test.ts`)

| Test ID | Test Case Description | Expected Assertion |
| :--- | :--- | :--- |
| **`T1.1`** | Genesis pool initialization | `R_USD = 10_000_000`, `S_NR = 100_000_000_000`, `spotPriceUsd === 1.00`. |
| **`T1.2`** | Constant-product Buy quote & invariant | Buying `$1,000` of `$NR` returns `~985.197287 NR`, $R''_{\text{USD}} \times S'_{\text{NR}} > k$, and `spotPriceAfterUsd > 1.00`. |
| **`T1.3`** | Sell quote & exit fee math | Selling `$NR` back calculates `BigInt` ceiling invariant, deducts `0.5%` fee, and injects `50%` of fee into `reserve_usd_cents`. |
| **`T1.4`** | Revenue injection floor-price growth | Calling `injectRevenueToPool(50000, 'TEST-REV')` increases `spotPriceUsd` while keeping `pool_nr_micro` constant. |
| **`T1.5`** | Atomic overdraft defense on `NR` debit | Debiting more `'NR'` than `wallet_balances` holds throws `Insufficient NR balance` without mutating `wallet_ledger`. |
| **`T1.6`** | `POST /api/v1/checkout/nr/pay` discount | Order of `$100.00` charges `$90.00` equivalent of `$NR` (`10%` discount, `0%` fee), sets `status = 'PAID'`, and stores `nr_discount_cents = 1000`. |
| **`T1.7`** | Replay/Double-pay guard on `/checkout/nr/pay` | Calling `/checkout/nr/pay` twice on the same order rejects the second request (`400`) without double-debiting `$NR`. |
| **`T1.8`** | Admin RBAC guard on `/api/v1/admin/nr-pool/adjust-reserve` | Non-admin JWT receives `403 Forbidden`; Admin JWT adjusts reserve and writes an `'ADMIN_ADJUST'` tick. |

---

## 3. Living Change Log

> Whenever any file in Module 1 is implemented, fixed, or refactored, append a row here and update any affected doc (`01`–`04`).

| Version | Date | Stage | Code Files Changed | Docs Updated | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`v1.0.0`** | `2026-11-16` | Specification | *(None — Docs Only)* | `README.md`, `01`–`05` | Initial 2026 research, AMM `BigInt` math, Mongo schema, 3-layer API/User UI/Admin UI design, and test matrix created. |
| **`v1.1.0`** | `2026-11-16` | Implemented & Verified | `packages/shared/src/types/database.ts`, `mongo.ts`, `wallet.ts`, `crossChainSwapService.ts`, `nrTokenService.ts`, `products.ts`, `swap.ts`, `checkout.ts`, `admin.ts`, `agent.ts`, `swap/page.tsx`, `checkout/page.tsx`, `admin/page.tsx`, `nr-token-amm.test.ts` | `05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md` | Full 3-layer Module 1 implementation completed. `nr-token-amm.test.ts` passed 7/7 subtests (`T1.1`–`T1.8`); `@nexusrail/shared` and `@nexusrail/api` compiled with 0 errors. |
| **`v1.2.0`** | `2026-11-16` | Restructured Architecture | `frontend/`, `backend/`, `package.json`, `vercel.json`, `render.yaml` | `README.md`, `05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md` | Flattened `apps/web` -> `frontend/` and `apps/api` -> `backend/`, removed `packages/shared` (embedded types into `frontend/src/types` & `backend/src/types`), eliminated duplicate `src/app/app/*` routes via Next.js rewrites, and organized `frontend/src/components/` into 5 domain subfolders. |
