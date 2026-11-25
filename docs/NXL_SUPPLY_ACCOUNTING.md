# $NXL Unified Supply Accounting & Reconciliation Spec

> **Model:** Canonical Global Max Cap = `2,000,000.000000 NXL` (`D1 Option A`)  
> **Primary Service:** [`SupplyReconciliationService`](file:///d:/live/nexus-rail/backend/src/services/supplyReconciliation.service.ts)  
> **Cap Coordinator:** [`GlobalSupplyCoordinator`](file:///d:/live/nexus-rail/backend/src/services/globalSupplyCoordinator.service.ts)  
> **Admin Endpoint:** `GET /api/v1/admin/tokenomics/reconciliation?refresh=true`

---

## 1. Accounting Equations

### 1.1 Per-Chain On-Chain Total Supply
- **Stellar `$NXL` On-Chain Total Supply (`S_stellar`):**
  $$\text{S}_{\text{stellar}} = \text{Horizon } /assets \text{ (authorized + contracts\_amount)} \equiv \text{NexusVault.circulating\_nxl} = \text{TotalNxlMinted} - \text{TotalNxlBurned}$$
  Verified exact match on live Testnet (`vaultHorizonDeltaNxl = 0`, `isExactStroopMatch = true`) using direct JSON-RPC `simulateTransaction` in [`SorobanService.simulateReadOnly`](file:///d:/live/nexus-rail/backend/src/services/soroban.ts#L237-L287).

- **XRPL `$NXL` On-Chain Total Supply (`S_xrpl`):**
  $$\text{S}_{\text{xrpl}} = \text{gateway\_balances.obligations} + \text{hotwallet\_distributor\_nxl}$$
  Queried live from XRPL Altnet `gateway_balances` on Issuer `rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU` (with hotwallet `rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp`), replacing stale static MongoDB `platform_tokens.initial_mint_amount` assumptions.

### 1.2 True External User Circulating Supply
Protocol-held inventory (Treasury distributor + Buyback Reserve + AMM Liquidity Pools) is excluded from **External User Circulating Supply**:
$$\text{Circulating}_{\text{external, stellar}} = S_{\text{stellar}} - B_{\text{treasury}} - B_{\text{buyback\_reserve}} - B_{\text{NexusSwap\_LP}}$$
$$\text{Circulating}_{\text{external, xrpl}} = S_{\text{xrpl}} - B_{\text{xrpl\_distributor}} - B_{\text{xrpl\_AMM}}$$
$$\text{Combined External User Circulating} = \text{Circulating}_{\text{external, stellar}} + \text{Circulating}_{\text{external, xrpl}}$$

### 1.3 Effective Global Cap & Remaining Mintable Headroom
Because buyback burns are permanently deflationary (`HIGH-02`), while bridge burns preserve 1:1 cross-chain headroom:
$$\text{Effective Global Cap} = \text{CANONICAL\_MAX\_SUPPLY\_NXL} \ (2{,}000{,}000) - \text{TotalBuybackBurned}$$
$$\text{Remaining Global Headroom} = \max\Big(0,\; \text{Effective Global Cap} - (S_{\text{stellar}} + S_{\text{xrpl}} + R_{\text{pending}})\Big)$$
where $R_{\text{pending}}$ is the sum of non-expired `RESERVED` documents in MongoDB `global_supply_reservations`.

---

## 2. Internal Ledger Backing Invariant

Off-chain user claims stored in MongoDB `wallet_balances` (`currency: "NXL"` in `10^6` micro-NXL) must remain 100% backed by protocol-controlled on-chain reserves:
$$\text{Total Internal Liability} = \sum \big(\text{available\_nxl} + \text{locked\_nxl}\big)$$
$$\text{Protocol On-Chain Reserve} = B_{\text{stellar\_treasury}} + B_{\text{xrpl\_distributor}}$$
$$\text{Backing Coverage Ratio} = \frac{\text{Protocol On-Chain Reserve}}{\text{Total Internal Liability}} \times 100\%$$
`isFullyBacked = Protocol On-Chain Reserve >= Total Internal Liability`. If `isFullyBacked === false`, `SupplyReconciliationService` flags critical anomaly `UNDERBACKED_INTERNAL_LEDGER` and blocks internal withdrawals via `verifyReserveForWithdrawal`.

---

## 3. Anomaly Detection Matrix

| Anomaly Code | Trigger Condition | Severity |
|---|---|---|
| `NR_RESERVE_ISSUER_COLLISION` | `vault.nr_reserve === STELLAR_NXL_ISSUER_PUBLIC` *(Cleared after rotating `nr_reserve` to `GDFXI6...5GJWW`)* | `HIGH` |
| `STELLAR_VAULT_HORIZON_DRIFT` | `\|S_stellar - vault.circulating_nxl\| > 0.0001` | `CRITICAL` |
| `UNDERBACKED_INTERNAL_LEDGER` | `totalInternalLiabilityNxl > protocolOnChainReserveNxl` | `CRITICAL` |
| `SUPPLY_CAP_EXCEEDED` | `(S_stellar + S_xrpl) > effectiveSupplyCapNxl` | `CRITICAL` |
| `TREASURY_TRUSTLINE_NEAR_LIMIT` | Treasury `$NXL` trustline headroom `< 5,000 NXL` | `MEDIUM` |
| `SINGLE_KEYPAIR_RBAC` | `admin === relayer === pauser === treasury` | `MEDIUM` |
| `XRPL_DB_MINT_MISMATCH` | MongoDB `platform_tokens.initial_mint_amount` differs from live `S_xrpl` | `MEDIUM` |
| `CHAIN_RPC_UNREACHABLE` | Horizon, Soroban RPC, or XRPL node query failed | `HIGH` |

---

## 4. Virtual DB AMM Pool vs. Real On-Chain Accounting

| Ledger Layer | Purpose | Real Supply Impact? | Where Visible in Admin |
|---|---|---|---|
| **MongoDB `token_pool` + `platform_treasury`** | Internal off-chain swap pricing & fee split bookkeeping (`virtualTreasuryPoolInjectedUsd`) | **No** (does not burn SAC) | `TreasuryTab` → **Virtual DB AMM pool injected** |
| **Stellar SAC + `NexusVault.burn_nxl`** | Real on-chain `BuybackService` swaps (`XLM -> NXL`) & SAC burns | **Yes** (reduces on-chain supply & cap) | `TreasuryTab` → **Confirmed on-chain burns** & **On-Chain Buyback & SAC Burn** |
