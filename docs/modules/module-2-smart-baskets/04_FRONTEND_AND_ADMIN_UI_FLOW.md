# Module 2 (`M2`) — User Storefront & Admin Catalog UI Flows

## 1. User Storefront (`frontend/src/lib/shop.ts` & `frontend/src/app/store/page.tsx`)

### 1.1 Data & Cache Synchronization (`shop.ts`)
- Extends `CatalogItem` with `isLiveAsset`, `isBasket`, `allocations`, `priceInr`, `change24hPercent`, `oracleSource`, and `priceUpdatedAt`.
- Reduces `CATALOG_CACHE_TTL_MS` from 30 minutes to `60 * 1000` (`60s`).
- `fetchCatalog(true)` requests `/api/v1/products?refresh=true`.
- Includes the 6 new Smart Baskets & Live RWA packs in `FIGMA_CATALOG` for instant SSR/offline resilience.

### 1.2 Storefront Upgrades (`store/page.tsx`)
1. **Unrestricted Multi-Category Catalog**: Removes the 6-item `primarySix` cap and exposes:
   - `All products` (`all`)
   - `Smart Baskets` (`baskets`)
   - `Live RWA & Tokens` (`live-assets`)
   - `Hardware` (`hardware`)
   - `Workspace` (`workspace`)
   - `Essentials` (`essentials`)
2. **Widened Price Range Slider**: Increases slider ceiling from `$150` to `$600` (`maxPrice` default `600`, step `10`) so Smart Baskets and Validator Kits are visible by default.
3. **Live Oracle Header Bar**: Displays live feed status + **"Sync Live Prices"** button, plus a background `60s` polling interval.
4. **Live Basket & RWA Card Chrome**:
   - Top-right **`● LIVE ORACLE`** badge & weighted 24h percentage change pill (`+X.XX% ▲` / `-X.XX% ▼`).
   - Stacked horizontal **Composition Bar** and allocation breakdown pills (`0.5g 24K Gold (46.5%)`, `30 USDC (31.5%)`, etc.).
   - Dual-currency footer line showing approximate INR (`≈ ₹7,987`) and `$NR` checkout benefit (`Save 10% with $NR`).

---

## 2. Operator Admin Console (`frontend/src/app/admin/page.tsx`)

Inside `/admin` (`overview` and `rates` tabs):
- **Smart Baskets & Live Oracle Catalog Manager Card**:
  - Lists every basket and live asset (`BASKET-*`, `NGOLD-*`, `NSILVER-*`, `NR-PACK-*`, `NR-TOKEN`) with live USD NAV, INR value, 24h trend, allocation summary, and `ACTIVE` / `PAUSED` badge.
  - One-click **Pause / Activate** button (`PATCH /api/v1/admin/products/:sku`).
  - Inline **+ Create Smart Basket / Live Asset** drawer (`POST /api/v1/admin/products`) for configuring SKU, Title, Category, Rail, and asset quantities (`GOLD_G`, `SILVER_G`, `XRP`, `XLM`, `USDC`, `NR`).
