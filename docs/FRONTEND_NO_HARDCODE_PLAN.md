# Frontend No-Hardcode Remediation Plan

**Project:** NexusRail (MERN + Web3)
**Scope:** User storefront, checkout, swap, receipt, profile, admin console
**Status:** Awaiting approval. No further code changes will be made until approved.
**Last updated:** 2026-11-23

---

## 1. Non-negotiable rules

These rules apply to every remaining change.

1. **No hardcoded financial data.** Amounts, FX rates, fees, discounts, cashback, balances, reserves, and profit figures must come from the backend quote/config API. If the API is unavailable, the action is blocked and the UI shows `Unavailable` — never a fallback number.
2. **No hardcoded identities.** Wallet addresses, issuer addresses, vault addresses, contract IDs, asset codes, currencies, memos, and destination tags must come from the backend or `NEXT_PUBLIC_*` configuration. No invented or stale addresses.
3. **No hardcoded credentials or secrets.** Demo passwords, default passwords, and API keys must not exist in frontend source.
4. **No hardcoded environment URLs.** API base URLs, Horizon/RPC URLs, and explorer base URLs come from environment variables. Missing configuration fails closed with a clear error.
5. **No fabricated fallbacks.** No demo orders, demo receipts, demo catalog, demo votes, demo balances, or local fake transactions.
6. **No hardcoded dates.** Years and timestamps come from `new Date()` or backend data. Missing dates render `—`.
7. **UI copy is allowed.** Labels, headings, and layout constants (for example page size) may stay in components. Any copy that contains a business number must render that number from config.
8. **Single source of truth.** Public configuration is served by one backend endpoint and one frontend config module. No duplicated constants across files.

---

## 2. Already applied (uncommitted, needs review)

These changes were made before this plan was written.

| Area | Change |
|---|---|
| Swap | Removed hardcoded XRP/XLM balances (`500.0`, `3480.5`) and hardcoded default XRPL destination. Added real `GET /api/v1/crypto/balance/:chain?address=…` loading. |
| Swap | Pending XRPL claims now load from `GET /api/v1/swap/xrpl/pending-claims`; claim uses `{ swapId }` only. |
| Swap | Removed the hardcoded public “pending deposit” card data. |
| Orders | `createOrderFromCart()` now throws on API failure instead of creating a local demo order. |
| Store | Removed the 320-line `FIGMA_CATALOG` fallback. Added loading skeleton, honest error state, and Retry. |
| Hydration | `vault.ts` now reads only `NEXT_PUBLIC_*` variables. Fixed the `/swap` hydration mismatch caused by server-only env vars. |
| Docs | Added swap endpoints to `docs/API_REFERENCE.md` and `openapi.yaml`. |

**Verified:** frontend/backend TypeScript clean, `next build --no-lint` passed, admin analytics tests 4/4 passed, `/swap` hydration error gone, `/store` loads 20 real products, `/admin?tab=analytics` renders real data.

---

## 3. Hardcode inventory

### P0 — Security, payment correctness, data integrity

| # | File | Line | Hardcoded item | Risk | Required fix |
|---|---|---|---|---|---|
| 1 | `frontend/src/app/checkout/page.tsx` | 243, 262, 327–329, 814 | Stellar/XRPL payment destinations (`GAIH…`, `rp4Q…`) | Payments can be sent to a stale vault address. | Use `recipientAddress` from `POST /api/v1/checkout/:chain/create-invoice` or the order’s invoice. Never hardcode a destination. |
| 2 | `frontend/src/app/checkout/page.tsx` | 159–161 | Fallback FX rates `0.10`, `0.58`, `1.0` | Wrong crypto amount if live rates fail. | Block checkout when `xlmUsd`/`xrpUsd`/`nrSpotUsd` is missing. Use the backend quote ticket. |
| 3 | `frontend/src/app/checkout/page.tsx` | 154–155, 165, 169 | `10%` $NXL discount and `$0.02` network fee | Incorrect totals and fees. | Return discount, fee, and total from the backend quote. |
| 4 | `frontend/src/app/checkout/page.tsx` | 193, 240, 259 | Client-side HMAC memo/tag derivation with hardcoded keys | Fallback memo can fail reconciliation; keys are public. | Backend invoice returns `memo` / `destinationTag`; frontend only displays and uses them. |
| 5 | `frontend/src/lib/wallets.ts` | 223–245, 251–275, 295 | Hardcoded HMAC salts and fallback memo/tag | Payment reconciliation mismatch. | Remove client derivation. Require `memo`/`tag` in payment params from the invoice. |
| 6 | `frontend/src/app/login/page.tsx` | 72 | Fallback password `NexusRail2026!` | Account takeover / silent login with a known password. | Require a password. Remove the fallback entirely. |
| 7 | `frontend/src/app/admin/page.tsx` | 1047–1048 | Demo admin email/password shown in UI | Credential leak. | Remove the demo-credentials block. |
| 8 | `frontend/src/app/api/v1/[...path]/route.ts` | 3–7 | Hardcoded production API URL | Wrong backend in non-default environments. | Use `API_SERVER_URL` only; return `503` when missing. |
| 9 | `frontend/src/app/swap/page.tsx` | 879, 1038 | `parseFloat(payAmount) \|\| 100` | Submits 100 tokens when the input is invalid. | Validate the amount; block submit and show an error. |
| 10 | `frontend/src/app/receipt/page.tsx` | 339 | Fallback vault address `GAIH…` | Fake receipt data. | Use only order/receipt data; render `—` when missing. |
| 11 | `frontend/src/lib/wallets.ts` | 601–605 | Issuer addresses, `NXL` asset code/currency | Duplicated and can drift from env. | Read `NEXT_PUBLIC_XRPL_NR_ISSUER_ADDRESS`, `NEXT_PUBLIC_XRPL_NR_CURRENCY_CODE`, `NEXT_PUBLIC_STELLAR_NR_ISSUER_PUBLIC`, `NEXT_PUBLIC_STELLAR_NR_ASSET_CODE`; no fallback. |

### P1 — Wrong defaults and fake UI values

| # | File | Line | Hardcoded item | Required fix |
|---|---|---|---|---|
| 12 | `frontend/src/app/swap/page.tsx` | 716 | `nrSpotUsd \|\| 1.0` | Use `0`/`null`; show “Price unavailable”. |
| 13 | `frontend/src/app/swap/page.tsx` | 94, 112–113 | Default `payAmount = '100.00'`, timers `42` / `18` | Start empty; timers start at `0` and are set from quote data. |
| 14 | `frontend/src/app/checkout/page.tsx` | 58, 63 | `quoteSecondsLeft = 58`, `nrSpotUsd = 1.0` | Start at `0` / `null`; set from quote response. |
| 15 | `frontend/src/app/checkout/page.tsx` | 490, 532, 544, 564, 579, 659, 744, 820 | Fee/discount copy (`$0.02`, `10%`, `0%`) | Render from quote/config. |
| 16 | `frontend/src/app/store/page.tsx` | 75 | `maxPrice = 600` | Derive from the maximum catalog price after load. |
| 17 | `frontend/src/app/store/page.tsx` | 537 | Literal year `2026` | `new Date().getFullYear()`. |
| 18 | `frontend/src/app/profile/page.tsx` | 1109 | Fallback join year `2026` | Render `—` when `createdAt` is missing. |
| 19 | `frontend/src/app/profile/page.tsx` | 866 | Real address as placeholder | Generic placeholder, e.g. `G…`. |
| 20 | `frontend/src/app/swap/page.tsx` | 1507 | Real address as placeholder | Generic placeholder, e.g. `r…`. |
| 21 | `frontend/src/app/admin/page.tsx` | 212–215 | Fee defaults `100 / 50 / 50 / 50` bps/pct | Initialize from `GET /api/v1/admin/treasury/config`; empty until loaded. |
| 22 | `frontend/src/app/admin/page.tsx` | 232–233 | AMM deposit defaults `'5'` / `'5'` | Start empty. |
| 23 | `frontend/src/app/cart/page.tsx` | 118, 124 | Minimum `$1` discount and `2%` cashback | Return from backend config/quote. |
| 24 | `frontend/src/app/cart/page.tsx` | 337 | Hardcoded promo suggestion list | Load public promo metadata from the backend or remove. |
| 25 | `frontend/src/app/swap/page.tsx` | 1805, 2050 | Literal `0.5%` AMM fee copy | Use `nrPool.swapFeePercent` / quote value. |
| 26 | `frontend/src/app/swap/page.tsx` | 2052 | Literal `0.00001` network fee | Use backend/network config. |

### P2 — Configuration duplication and dead demo components

| # | File | Line | Hardcoded item | Required fix |
|---|---|---|---|---|
| 27 | `frontend/src/components/wallet/WalletConnectModal.tsx` | 343–344 | Stellar destination and `0.00001` amount | Use `PLATFORM_STELLAR_VAULT` and a configured minimum amount. |
| 28 | `frontend/src/app/receipt/page.tsx` | 324, 327 | Hardcoded Horizon testnet URL | Use `NEXT_PUBLIC_STELLAR_HORIZON_URL` or a backend receipt endpoint. |
| 29 | `frontend/src/app/admin/page.tsx` | 145, 148 | Hardcoded explorer base URLs | Use config/env. |
| 30 | `frontend/src/app/orders/page.tsx` | 44–45 | Hardcoded explorer base URLs | Use config/env. |
| 31 | `frontend/src/app/profile/page.tsx` | 1431, 1521 | Hardcoded explorer base URLs | Use config/env. |
| 32 | `frontend/src/components/home/ProtocolAssetFlowDiagram.tsx` | 283–296 | Hardcoded contract IDs and explorer URLs | Load from a public platform-config endpoint. |
| 33 | `frontend/src/components/home/ProtocolAssetFlowDiagram.tsx` | 307–311, 316–340 | Hardcoded economic copy (`99.5%`, `0.25%`, `2M`, `15m`, `+2%`) | Render from config; keep only static labels in code. |
| 34 | `frontend/src/components/ui/TokenTransparencyExplorer.tsx` | 112 | Hardcoded issuer address; component is orphaned | Delete the component or wire it to config. |
| 35 | `frontend/src/components/ui/ProductShowdownCard.tsx` | 7–8 | Hardcoded votes `142` / `98`; component is orphaned | Delete or load from a real showdown endpoint. |
| 36 | `frontend/src/lib/rates.ts` | 119–120, 145, 170, 196 | Hardcoded provider URLs | Move provider base URLs to env/config. |
| 37 | `frontend/src/lib/soroban.ts` | 5 | Hardcoded testnet passphrase | Move to network config. |
| 38 | `frontend/src/app/checkout/page.tsx` | 234, 286, 330 | Placeholder labels `NXL-NATIVE-BALANCE`, `NXL-AMM-TREASURY-VAULT` | Replace with backend-provided labels or neutral UI text. |

---

## 4. Proposed architecture

### 4.1 One public config endpoint

Add:

```http
GET /api/v1/platform/config
```

Public, read-only, cacheable. Returns non-secret values only:

```json
{
  "success": true,
  "data": {
    "network": "testnet",
    "assets": {
      "nxl": {
        "stellarCode": "NXL",
        "stellarIssuer": "G...",
        "xrplCurrency": "NXL",
        "xrplIssuer": "r..."
      }
    },
    "vaults": {
      "stellar": "G...",
      "xrpl": "r..."
    },
    "contracts": {
      "nexusVault": "C...",
      "nexusSwap": "C...",
      "nxlSac": "C..."
    },
    "fees": {
      "orderFeeBps": 100,
      "swapSpreadBps": 50,
      "cashoutSpreadBps": 50,
      "buybackSharePct": 50,
      "nxlCheckoutDiscountPct": 10,
      "cashbackPct": 2
    },
    "limits": {
      "nxlHardCap": 2000000,
      "bridgeEscrowMinutes": 15
    },
    "explorers": {
      "stellarTx": "https://stellar.expert/explorer/testnet/tx/",
      "stellarAccount": "https://stellar.expert/explorer/testnet/account/",
      "xrplTx": "https://testnet.xrpl.org/transactions/",
      "xrplAccount": "https://testnet.xrpl.org/accounts/"
    }
  }
}
```

The backend builds this from existing environment variables and the `platform_treasury_config` collection. No secrets are returned.

### 4.2 One frontend config module

Add `frontend/src/lib/platformConfig.ts`:

- Fetches `/api/v1/platform/config` once and caches it in memory.
- Exposes a typed object and a `usePlatformConfig()` hook.
- Returns `null` values when a field is missing — never a fallback number or address.
- Provides `requireConfig()` helpers that throw a user-facing error when a payment-critical value is missing.

### 4.3 Checkout uses the backend invoice

Refactor `frontend/src/app/checkout/page.tsx`:

1. On order load, call `POST /api/v1/checkout/:chain/create-invoice` (or `POST /api/v1/checkout/quote/refresh` for re-quotes).
2. Store the returned `destination`, `memo`, `destinationTag`, `amount`, `amountUsdCents`, `networkFeeUsd`, `discountUsd`, `expiresAt`, and `explorerUrl`.
3. Render those values directly. Do not compute rates, fees, discounts, memos, or tags in the browser.
4. If the invoice call fails, disable Pay and show the backend error.
5. Pass `memo` / `destinationTag` into `payWithFreighter` / `payWithGemWallet`; remove the client HMAC derivation.

### 4.4 Remove dead demo components

- `ProductShowdownCard.tsx`: no imports. Delete unless a real showdown endpoint is planned.
- `TokenTransparencyExplorer.tsx`: no imports. Delete unless it will be wired to config.
- `AnalyticsLedgerDashboard.tsx`: no imports and still calls the legacy analytics endpoint. Delete or mark as internal-only.

---

## 5. Implementation batches

### Batch A — P0 security and payment correctness

- Remove hardcoded checkout destinations, fallback rates, fees, and discounts.
- Wire checkout to the backend invoice/quote.
- Remove client-side memo/tag derivation.
- Remove login fallback password and admin demo credentials.
- Remove API proxy URL fallback.
- Validate swap amounts; remove `|| 100`.
- Remove receipt vault fallback.
- Move issuer/asset constants to `NEXT_PUBLIC_*` env.

**Exit test:** no payment can proceed with a missing rate, missing invoice, or invalid amount. `grep` finds no hardcoded wallet addresses in payment paths.

### Batch B — P1 defaults and fake UI values

- Swap/checkout timers start at `0`; amounts start empty.
- Store `maxPrice` derived from catalog.
- Admin fee/AMM inputs load from config.
- Cart cashback/discount from backend config.
- Swap fee copy from `nrPool.swapFeePercent`.
- Profile/store years dynamic.
- Replace real-address placeholders with generic ones.

**Exit test:** reload every page with the backend offline; no invented numbers or addresses appear.

### Batch C — P2 config centralization

- Add `GET /api/v1/platform/config`.
- Add `platformConfig.ts` + hook.
- Move vault addresses, contract IDs, explorer URLs, fee bps, cashback, caps, and bridge escrow duration to config.
- Update landing protocol diagram, admin explorer links, receipt Horizon call, wallet modal.
- Delete orphaned demo components.

**Exit test:** changing a fee or address in backend env/config updates the UI without a frontend code change.

### Batch D — Verification and report

- Frontend `npx tsc --noEmit`.
- Backend `npx tsc --noEmit`.
- `npx next build --no-lint`.
- Admin analytics tests.
- Route smoke tests for all user/admin pages.
- API smoke tests for config, invoice, quote, analytics.
- Browser console check on `/`, `/store`, `/cart`, `/checkout`, `/receipt`, `/profile`, `/swap`, `/admin`.
- Final report: problems, fixes, before/after performance, analytics, indexes, security, docs, tests, limitations.

---

## 6. Verification checklist

| Check | Expected |
|---|---|
| `grep` for Stellar/XRPL address literals in `frontend/src` | Only type/example placeholders, no payment destinations |
| `grep` for `admin123`, `NexusRail2026`, default passwords | Zero matches |
| `grep` for `\|\| 1.0`, `\|\| 0.58`, `\|\| 0.10` | Zero financial fallbacks |
| Backend offline → checkout | Pay disabled, clear error, no fallback total |
| Backend offline → store | Loading/error state, no demo catalog |
| Backend offline → swap | “Price unavailable”, no 1.0 fallback |
| Backend offline → receipt | `—` for missing vault, no fake address |
| Admin login page | No credentials shown |
| `/swap` console | No hydration mismatch |
| `/store` console | No errors, real product count |
| `/admin?tab=analytics` | Real totals, no mock values |

---

## 7. Open decisions

1. **Orphaned components:** delete `ProductShowdownCard`, `TokenTransparencyExplorer`, and `AnalyticsLedgerDashboard`, or keep them for future wiring?
2. **Config endpoint:** approve adding `GET /api/v1/platform/config` (recommended), or keep using build-time `NEXT_PUBLIC_*` variables only?
3. **Legacy `$NR` product data:** the database still contains duplicate `$NR` / `$NXL` products. Clean the DB, normalize display labels, or document as a limitation?
4. **Commit policy:** commit after verification, or leave all changes uncommitted for review?

---

## 8. Approval

Reply with:

- `Approve A+B+C+D` to execute the full plan.
- `Approve A only` to fix security/payment issues first.
- Any changes to the decisions in section 7.

No code will be changed until this plan is approved.
