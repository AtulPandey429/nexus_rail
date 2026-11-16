# Module 2 (`M2`) — Implementation Checklist, Test Matrix & Living Change Log

## 1. Implementation Checklist

- [x] **Step 2.1**: Upgrade `backend/src/services/market.ts` (`60s` live TTL, strictly live Binance 24h Tickers, Gold-API `XAU`/`XAG`, Coinbase `USD/INR`, and CoinGecko secondary oracle — zero hardcoded `'fallback'` pricing).
- [x] **Step 2.2**: Extend shared types (`backend/src/types/index.ts`, `frontend/src/types/index.ts`) and Mongo schema (`backend/src/services/mongo.ts`) with `AssetSymbol`, `ProductAllocation`, and live catalog fields (`oracle_source?: 'coingecko' | 'binance' | 'amm'`).
- [x] **Step 2.3**: Upgrade `backend/src/services/products.ts` (seed 3 Smart Baskets + 3 Live Assets, attach live rail allocations to all SKUs, implement `computeHydratedProduct()`, `getAllProductsForAdmin()`, `upsertAdminProduct()`, `patchProductBySku()`).
- [x] **Step 2.4**: Update `backend/src/routes/products.ts` (`60s` Redis cache + `?refresh=true`) and `backend/src/routes/admin.ts` (`GET`/`POST`/`PATCH` `/admin/products`).
- [x] **Step 2.5**: Upgrade Storefront (`frontend/src/lib/shop.ts`, `frontend/src/app/store/page.tsx`) with Smart Baskets & Live RWA categories, composition bars, `60s` sync, and `$600` price ceiling.
- [x] **Step 2.6**: Add **Smart Baskets & Live Oracle Catalog Manager** to `frontend/src/app/admin/page.tsx`.
- [x] **Step 2.7**: Add and pass automated test suite `backend/test/live-baskets.test.ts` and verify `npm run build:backend` + `npm run build:frontend`.

---

## 2. Automated Test Matrix (`backend/test/live-baskets.test.ts`)

| Test ID | Assertion Scope |
| :--- | :--- |
| **`T2.1`** | `computeHydratedProduct()` computes `BASKET-INFLATION-SHIELD` NAV as $\sum \text{round}(Q_i \cdot P_i)$, weights summing to ~100%, weighted 24h change, and `price_inr`. |
| **`T2.2`** | `computeHydratedProduct()` dynamically reacts when `$NR` AMM spot price doubles or FX quotes shift (`BASKET-DUAL-RAIL`, `BASKET-AI-ALPHA`). |
| **`T2.3`** | Single live asset packs (`NGOLD-1G`, `NSILVER-10G`, `NR-PACK-50`) hydrate linearly (`NR-PACK-50` = `50 * spotPriceCents`). |
| **`T2.4`** | All SKUs hydrate strictly with `'binance' | 'coingecko' | 'amm'` (zero `'static'` or `'fallback'` pricing). |
| **`T2.5`** | `getExtendedMarketSnapshot()` returns positive finite live quotes (`'coingecko' | 'binance'`) and 24h changes for Gold, Silver, XRP, XLM, and `usdInrRate`. |
| **`T2.6`** | `GET /api/v1/products?refresh=true` serves live Smart Baskets and `POST /api/v1/orders` ignores tampered `unitPriceCents`. |
| **`T2.7`** | `POST /api/v1/admin/products` & `PATCH /api/v1/admin/products/:sku` enforce Admin RBAC, create custom baskets, and toggle active visibility. |

---

## 3. Living Change Log

| Date | Change Summary | Files Updated | Verification |
| :--- | :--- | :--- | :--- |
| `2026-10-27` | Created Module 2 deep-dive documentation suite | `docs/modules/module-2-smart-baskets/*` | Spec Review Complete |
| `2026-11-16` | Implemented full-stack Module 2 (`M2`) across DB, Oracle Backend, Storefront UI, and Admin Console | `market.ts`, `products.ts`, `mongo.ts`, `routes/products.ts`, `routes/admin.ts`, `shop.ts`, `store/page.tsx`, `admin/page.tsx`, `live-baskets.test.ts` | `22/22` tests pass; `build:backend` & `build:frontend` pass |
| `2026-11-16` | Eliminated `'fallback'` and `'static'` oracle modes in favor of strictly live Binance/Gold-API/Coinbase/CoinGecko/`$NR` AMM feeds | `types/index.ts`, `market.ts`, `products.ts`, `shop.ts`, `store/page.tsx`, `admin/page.tsx`, `live-baskets.test.ts`, `market-rates.test.ts` | `22/22` backend tests pass (`0` failures); `next build` (`22/22` routes) pass |
