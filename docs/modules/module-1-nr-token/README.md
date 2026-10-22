# Module 1 (`M1`): `$NR` Native Protocol Token & Constant-Product AMM

> **Module Folder:** `docs/modules/module-1-nr-token/`  
> **Status:** Specification Approved for Review (`v1.0.0` — Pending Implementation)  
> **3-Layer Scope:** Database & Shared Types (`@nexusrail/shared`, MongoDB) + Backend API (`apps/api`) + User UI (`/swap`, `/checkout`, `/store`) + Operator Admin Dashboard (`/admin`)  

---

## 1. Executive Summary

Module 1 transforms **`$NR` (NexusRail Protocol Token)** from a static `$25.00` placeholder SKU into a genuine, live-priced **Native Protocol Economy** modeled after **XRPL Native AMM (`XLS-30`)**, **XRPL `MPTokensV1` (`XLS-89`)**, and **Stellar Issued Assets**.

### What Module 1 Delivers Across All 3 Layers
1. **Layer 1 — Database & Backend (`packages/shared`, `apps/api`)**:
   - Extends `WalletCurrency` to include `'NR'` and `PaymentRail` to include `'NR_TOKEN'`.
   - Introduces MongoDB collections `token_pool` and `token_price_history` implementing a **Constant-Product AMM ($R_{\text{USD}} \times S_{\text{NR}} = k$)** where buying `$NR` increases its spot price and **50% of all swap fees + platform revenue** permanently backs the reserve $R_{\text{USD}}$.
   - Exposes `NrTokenService`, `$NR` swap routes (`/api/v1/swap/nr-pool`, `/quote`, `/initiate`, `/execute`), `$NR` checkout route (`POST /api/v1/checkout/nr/pay` with **10% discount + 0% fee**), and Admin liquidity endpoints (`GET /api/v1/admin/nr-pool`, `POST /api/v1/admin/nr-pool/adjust-reserve`).
2. **Layer 2 — Shopper Frontend (`apps/web`)**:
   - Upgrades `/swap` to support **`XRP`, `XLM`, `USD`, and `$NR`** with a live `$NR` Tokenomics Banner, 24h SVG price sparkline, price impact %, and post-swap spot price preview.
   - Upgrades `/checkout` by replacing the disabled `EVM (COMING SOON)` card in the 2x2 rail grid with **`$NR Protocol Token` (Save 10% • 0% Fee)**.
   - Hydrates `NR-TOKEN` pricing dynamically in `/store` via `ProductService`.
3. **Layer 3 — Operator Admin Dashboard (`apps/web/src/app/admin/page.tsx`)**:
   - Adds a **Live `$NR` AMM Pool & Reserve Backing Monitor** inside `overview` and `rails` tabs displaying live Spot Price, Reserve USD, Pool Supply, Circulating Supply, Invariant $k$, and Cumulative Revenue Injected, plus an **Adjust Reserve Liquidity** control.

---

## 2. Module 1 Documentation Index

| File | Purpose |
| :--- | :--- |
| [**`01_RESEARCH_AND_TOKENOMICS_MATH.md`**](./01_RESEARCH_AND_TOKENOMICS_MATH.md) | 2026 XRPL/Stellar research, constant-product bonding curve equations, worked numerical examples, and floor-price revenue mechanics. |
| [**`02_DATABASE_SCHEMA_AND_TYPES.md`**](./02_DATABASE_SCHEMA_AND_TYPES.md) | Shared TypeScript enums, MongoDB `token_pool` / `token_price_history` / `wallet_balances` / `orders` schemas, precision scales, and ER diagram. |
| [**`03_BACKEND_API_AND_FLOW.md`**](./03_BACKEND_API_AND_FLOW.md) | `NrTokenService` method contracts, REST API endpoints, Zod schemas, error codes, and Mermaid sequence diagrams. |
| [**`04_FRONTEND_AND_ADMIN_UI_FLOW.md`**](./04_FRONTEND_AND_ADMIN_UI_FLOW.md) | Exact UI state machines, line-level audit of `/swap`, `/checkout`, `/store`, and `/admin`, plus wireframe specs. |
| [**`05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md`**](./05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md) | Ordered 8-step build checklist (`Step 1.1` – `1.8`), 8-case automated test matrix, and the **Living Change Log**. |

---

## 3. Living Documentation Sync Policy (Mandatory)

> **Rule:** Documentation in `docs/modules/module-1-nr-token/` is a live engineering artifact, not write-once text.

Whenever any developer or AI step modifies Module 1 code (`packages/shared/src/types/database.ts`, `apps/api/src/services/mongo.ts`, `wallet.ts`, `nrTokenService.ts`, `swap.ts`, `checkout.ts`, `admin.ts`, `apps/web/src/app/swap/page.tsx`, `checkout/page.tsx`, or `admin/page.tsx`):
1. If a schema field, index, or scale changes $\rightarrow$ update **`02_DATABASE_SCHEMA_AND_TYPES.md`**.
2. If an API path, payload, or fee parameter changes $\rightarrow$ update **`03_BACKEND_API_AND_FLOW.md`**.
3. If a UI flow or Admin tab layout changes $\rightarrow$ update **`04_FRONTEND_AND_ADMIN_UI_FLOW.md`**.
4. Tick the completed step and append a dated row to the **Living Change Log** table in **`05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md`**.
