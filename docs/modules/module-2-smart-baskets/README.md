# Module 2 (`M2`): Live Multi-Rail Smart Baskets & Real-Time Oracle Store

> **Module Folder:** `docs/modules/module-2-smart-baskets/`  
> **Status:** Implemented & Verified (`v1.0.0`)  
> **3-Layer Scope:** Database & Shared Types (`backend/src/types/index.ts`, `frontend/src/types/index.ts`, MongoDB) + Backend API (`backend/`) + User UI (`frontend/src/app/store/page.tsx`) + Operator Admin Dashboard (`frontend/src/app/admin/page.tsx`)

---

## 1. Executive Summary

Module 2 upgrades NexusRail's `/store` from a hardcoded 6-item merch grid into a **Live Market-Hydrated Multi-Rail Asset & Smart Basket Store** powered by real-time **CoinGecko**, **Binance 24h**, and the **Module 1 `$NR` AMM Pool**.

### What Module 2 Delivers Across All 3 Layers
1. **Layer 1 — Database & Backend (`backend/`)**:
   - Adds `AssetSymbol`, `ProductAllocation`, and live oracle pricing fields (`is_live_asset`, `is_basket`, `allocations`, `price_inr`, `change_24h_percent`, `oracle_source`, `price_updated_at`) to `DbProduct` and `MongoProductDoc`.
   - Upgrades `market.ts` (`getExtendedMarketSnapshot()`) to pull strictly live quotes (`'binance' | 'coingecko'`) via Binance 24h Tickers, Gold-API (`XAU`/`XAG`), Coinbase `USD/INR`, and CoinGecko with a `60s` live cache window and zero fake `'fallback'` prices.
   - Seeds 3 Multi-Rail Smart Baskets (`BASKET-INFLATION-SHIELD`, `BASKET-DUAL-RAIL`, `BASKET-AI-ALPHA`) and 3 Live RWA/Token Packs (`NGOLD-1G`, `NSILVER-10G`, `NR-PACK-50`) while hydrating all SKUs (`'binance' | 'coingecko' | 'amm'`) with zero `'static'` pricing.
   - Reduces `GET /api/v1/products` Redis cache TTL to `60s` with `?refresh=true` bypass, and ensures `POST /api/v1/orders` charges the live server-hydrated NAV.
2. **Layer 2 — Shopper Frontend (`frontend/src/app/store/page.tsx`, `frontend/src/lib/shop.ts`)**:
   - Removes the hardcoded `primarySix` filter so Smart Baskets, Live RWA & Tokens, and Hardware/Workspace/Essentials are all browsable.
   - Widens the price range slider to `$0–$600` (`default = $600`), adds `Smart Baskets` and `Live RWA & Tokens` category tabs, `● LIVE ORACLE` + 24h % pills, stacked allocation bars, INR conversion previews, and `60s` auto-refresh + manual **Sync Live Prices** trigger.
3. **Layer 3 — Operator Admin Dashboard (`frontend/src/app/admin/page.tsx`, `backend/src/routes/admin.ts`)**:
   - Upgrades `GET /api/v1/admin/products` to list both active and paused SKUs with live NAV, INR value, and 24h change %.
   - Adds `POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/:sku` (`requireAuth`, `requireAdmin`) with automatic cache invalidation.
   - Adds a **Smart Baskets & Live Oracle Catalog Manager** panel inside `/admin` (`overview` & `rates` tabs) to pause/activate items and create custom multi-rail baskets.

---

## 2. Module 2 Documentation Index

| File | Purpose |
| :--- | :--- |
| [**`01_RESEARCH_AND_BASKET_NAV_MATH.md`**](./01_RESEARCH_AND_BASKET_NAV_MATH.md) | 2026 XRPL/CoinGecko/Binance oracle standards, Smart Basket NAV formulas, weighted 24h change math, and worked examples. |
| [**`02_DATABASE_SCHEMA_AND_TYPES.md`**](./02_DATABASE_SCHEMA_AND_TYPES.md) | Shared `AssetSymbol`, `ProductAllocation`, `DbProduct`, and `MongoProductDoc` schemas. |
| [**`03_BACKEND_API_AND_FLOW.md`**](./03_BACKEND_API_AND_FLOW.md) | `market.ts`, `products.ts` (`computeHydratedProduct`, `ProductService`), `routes/products.ts`, `routes/admin.ts`, and Mermaid flow diagrams. |
| [**`04_FRONTEND_AND_ADMIN_UI_FLOW.md`**](./04_FRONTEND_AND_ADMIN_UI_FLOW.md) | Storefront `shop.ts` & `store/page.tsx` upgrades plus `/admin` Smart Baskets Manager UI flows. |
| [**`05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md`**](./05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md) | Step-by-step build checklist (`Step 2.1`–`2.7`), automated test matrix (`live-baskets.test.ts`), and Living Change Log. |

---

## 3. Living Documentation Sync Policy (Mandatory)

Whenever any developer modifies Module 2 files (`backend/src/services/market.ts`, `backend/src/services/products.ts`, `backend/src/routes/products.ts`, `backend/src/routes/admin.ts`, `frontend/src/lib/shop.ts`, `frontend/src/app/store/page.tsx`, or `frontend/src/app/admin/page.tsx`):
1. Schema/type changes $\rightarrow$ update **`02_DATABASE_SCHEMA_AND_TYPES.md`**.
2. Oracle source, cache TTL, or Admin API changes $\rightarrow$ update **`03_BACKEND_API_AND_FLOW.md`**.
3. UI cards, sliders, or Admin catalog panel changes $\rightarrow$ update **`04_FRONTEND_AND_ADMIN_UI_FLOW.md`**.
4. Tick completed checklist steps and log verified changes in **`05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md`**.
