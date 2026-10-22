# Module 1 — 2026 Research & `$NR` Tokenomics Mathematics

> **Parent Module:** [`module-1-nr-token/README.md`](./README.md)  
> **Protocol Alignment:** XRPL `XLS-30` AMM Invariant, XRPL `MPTokensV1` (`XLS-89`) Asset Metadata, Stellar Issued Assets & Protocol 22  

---

## 1. 2026 Protocol Research & Architectural Grounding

### 1.1 XRPL `XLS-30` AMM & `MPTokensV1` (`XLS-89`)
- **Automated Market Makers (`XLS-30` / `fixAMMClawbackRounding`)**: On XRPL, AMM pools enforce a strict constant-product invariant ($x \cdot y = k$) with protocol-level rounding safety so liquidity providers never suffer rounding drains on pool exits. Module 1 adopts integer arithmetic with ceiling rounding ($\lceil k / x' \rceil$) on pool outputs so $R'_{\text{USD}} \times S'_{\text{NR}} \ge k$ is strictly preserved after every swap.
- **Multi-Purpose Tokens (`MPTokensV1` / `XLS-89`)**: Modern tokens on XRPL store structured metadata (`ticker`, `desc`, `asset_scale`, `max_supply`, `transfer_fee_bps`) directly alongside issuance records. Module 1 mirrors this structure inside `token_pool` (`symbol`, `name`, `total_supply_nr_micro`, `spot_price_cents`, `reserve_usd_cents`) so the Admin Console and public API always expose auditable token supply and reserve backing.

### 1.2 Stellar Horizon & Protocol 22 Compatibility
- Stellar accounts natively track issued assets with **7 decimal places (`10^-7` stroops)**, while internal NexusRail fiat accounting uses integer cents (`10^-2`).
- By anchoring `$NR` swap accounting in deterministic USD cents (`reserve_usd_cents`) and micro-NR (`10^-6`, `pool_nr_micro`) inside MongoDB `ClientSession` transactions—and settling ingress/egress payments via Stellar (`G...` + 28-byte HMAC memo) and XRPL (`r...` + 32-bit DestinationTag)—`$NR` remains 100% compatible with future Soroban Stellar Asset Contract (SAC) wrapping.

### 1.3 Why `$NR` Gains Value Organically (Closed-Loop Flywheel)
1. **Utility Demand**: Holding/spending `$NR` gives shoppers **10% off + 0% routing fee** at `/checkout` (`POST /api/v1/checkout/nr/pay`), plus unlocks the `NRHOLDER20` (20% off) tier in Module 7.
2. **Bonding Curve Appreciation**: Each buy removes `$NR` from `pool_nr_micro` and adds USD liquidity to `reserve_usd_cents`, pushing the spot price up along $x \cdot y = k$.
3. **Revenue Buyback Injection**: **50% of swap fees** and **50% of external platform revenue** (`M4`) are injected directly into `reserve_usd_cents` without minting new `$NR`, permanently raising the **floor price** of every circulating `$NR` token.

---

## 2. Mathematical Model & Exact Formulas

### 2.1 State Variables & Genesis Parameters
Let the global `$NR` pool state in MongoDB (`token_pool`) track:
- $R_{\text{USD}}$ (`reserve_usd_cents`): USD backing reserve in integer cents.
- $S_{\text{NR}}$ (`pool_nr_micro`): `$NR` tokens held in the AMM pool in integer micro-NR (`1.000000 NR = 1,000,000` micro-NR).
- $S_{\text{max}}$ (`total_supply_nr_micro`): Hard supply cap $= 1{,}000{,}000 \times 10^6 = 10^{12}$ micro-NR.
- $S_{\text{circ}}$: Circulating `$NR` held outside the pool (initially $0$, plus loyalty/cashback reserve allocations).
- **Invariant**:
  $$k = R_{\text{USD}} \times S_{\text{NR}}$$

**Genesis Initialization State:**
- $R_{\text{USD}}^{(0)} = \$100{,}000.00 = 10{,}000{,}000\text{ cents}$
- $S_{\text{NR}}^{(0)} = 100{,}000.000000\text{ NR} = 100{,}000{,}000{,}000\text{ micro-NR}$
- $k^{(0)} = 10^7 \times 10^{11} = 10^{18}$
- **Genesis Spot Price**:
  $$P_{\text{NR}}(\text{cents}) = \frac{R_{\text{USD}} \times 10^6}{S_{\text{NR}}} = \frac{10{,}000{,}000 \times 1{,}000{,}000}{100{,}000{,}000{,}000} = 100\text{ cents} = \$1.00 / \text{NR}$$

---

### 2.2 Buy `$NR` Formula (`USD / XLM / XRP -> $NR`)
Suppose a user inputs an amount worth $V_{\text{in}}$ USD cents (where for crypto inputs, $V_{\text{in}} = \text{round}(\text{amountAsset} \times P_{\text{oracle}} \times 100)$ via `getFxQuote()`):

1. **AMM Swap Fee ($0.5\%$ / `50 bps`)**:
   $$\text{Fee}_{\text{cents}} = \max\big(1,\; \text{round}(V_{\text{in}} \times 0.005)\big)$$
   $$\Delta_{\text{USD}} = V_{\text{in}} - \text{Fee}_{\text{cents}}$$
2. **Constant-Product Output (using `BigInt` in TypeScript to prevent `Number.MAX_SAFE_INTEGER` overflow!)**:
   *Critical Engineering Note:* Since $k^{(0)} = 10^{18} > 2^{53} - 1 \approx 9.007 \times 10^{15}$, JavaScript `number` loses precision on $R_{\text{USD}} \times S_{\text{NR}}$. All $x \cdot y = k$ divisions **must use `BigInt` (`10000000n * 100000000000n = 10n**18n`)**:
   $$k = \text{BigInt}(R_{\text{USD}}) \times \text{BigInt}(S_{\text{NR}})$$
   $$R'_{\text{USD}} = R_{\text{USD}} + \Delta_{\text{USD}}$$
   $$S'_{\text{NR}} = \left\lceil \frac{k}{R'_{\text{USD}}} \right\rceil = \frac{k + R'_{\text{USD}} - 1}{R'_{\text{USD}}}$$
   $$\Delta_{\text{NR\_out}} = S_{\text{NR}} - S'_{\text{NR}} \quad (\text{in micro-NR})$$
3. **50 / 50 Fee Allocation (Pool Reserve Injection + Owner Profit)**:
   $$\text{Fee}_{\text{pool}} = \lfloor 0.5 \times \text{Fee}_{\text{cents}} \rfloor, \quad \text{Fee}_{\text{owner}} = \text{Fee}_{\text{cents}} - \text{Fee}_{\text{pool}}$$
   $$R''_{\text{USD}} = R'_{\text{USD}} + \text{Fee}_{\text{pool}}$$
   Notice that $S'_{\text{NR}}$ stays unchanged during the $\text{Fee}_{\text{pool}}$ injection, so the effective post-swap invariant grows to $k'' = R''_{\text{USD}} \times S'_{\text{NR}} > k$.
4. **Price Impact %**:
   $$\text{EffectiveExecutionPrice} = \frac{V_{\text{in}}}{\Delta_{\text{NR\_out}} / 10^6}, \quad \text{PriceImpact}_{\%} = \left(\frac{\text{EffectiveExecutionPrice} - P_{\text{NR}}^{\text{before}}}{P_{\text{NR}}^{\text{before}}}\right) \times 100$$

#### Worked Numerical Example (Buy `$1,000.00` of `$NR` at Genesis)
- $V_{\text{in}} = 100{,}000\text{ cents}$ (`$1,000.00`), $P_{\text{NR}}^{\text{before}} = \$1.0000$
- $\text{Fee}_{\text{cents}} = 500\text{ cents}$ (`$5.00`): $\text{Fee}_{\text{pool}} = \$2.50$, $\text{Fee}_{\text{owner}} = \$2.50$
- $\Delta_{\text{USD}} = 99{,}500\text{ cents}$ (`$995.00`)
- $R'_{\text{USD}} = 10{,}099{,}500\text{ cents}$
- $S'_{\text{NR}} = \lceil 10^{18} / 10{,}099{,}500 \rceil = 99{,}014{,}802{,}713\text{ micro-NR}$
- **User Receives**: $\Delta_{\text{NR\_out}} = 985{,}197{,}287\text{ micro-NR} = \mathbf{985.197287\text{ NR}}$ (or `98,519` centi-NR units)
- **Reserve After 50% Fee Injection**: $R''_{\text{USD}} = 10{,}099{,}750\text{ cents}$ (`$100,997.50`)
- **New Spot Price**:
  $$P_{\text{NR}}^{\text{after}} = \frac{10{,}099{,}750 \times 10^6}{99{,}014{,}802{,}713} \approx 102.002\text{ cents} = \mathbf{\$1.0200 / \text{NR}} \quad (\mathbf{+2.00\%})$$

---

### 2.3 Sell `$NR` Formula (`$NR -> USD / XLM / XRP`)
Suppose a user sells $\Delta_{\text{NR\_in}}$ micro-NR back to the AMM pool:
1. Compute gross USD cents released by the curve (using `BigInt`):
   $$S'_{\text{NR}} = S_{\text{NR}} + \Delta_{\text{NR\_in}}$$
   $$R'_{\text{USD}} = \left\lceil \frac{k}{S'_{\text{NR}}} \right\rceil$$
   $$\text{Gross}_{\text{USD}} = R_{\text{USD}} - R'_{\text{USD}}$$
2. Deduct $0.5\%$ exit fee ($\text{Fee}_{\text{cents}} = \max(1, \text{round}(\text{Gross}_{\text{USD}} \times 0.005))$):
   $$\text{NetPayout}_{\text{USD}} = \text{Gross}_{\text{USD}} - \text{Fee}_{\text{cents}}$$
3. Allocate $50\%$ of $\text{Fee}_{\text{cents}}$ back into $R'_{\text{USD}}$:
   $$R''_{\text{USD}} = R'_{\text{USD}} + \lfloor 0.5 \times \text{Fee}_{\text{cents}} \rfloor$$
4. If target asset is `XLM` or `XRP`, convert $\text{NetPayout}_{\text{USD}}$ using live `getFxQuote()` and disburse via `CrossChainSwapService`. If target is `USD`, credit `wallet_balances` atomically inside the same `ClientSession`.

#### Worked Numerical Example (Selling `500.00 NR` when $R = \$100{,}997.50$, $S = 99{,}014.80\text{ NR}$)
- $\Delta_{\text{NR\_in}} = 500{,}000{,}000\text{ micro-NR}$
- $S'_{\text{NR}} = 99{,}514{,}802{,}713\text{ micro-NR}$
- $R'_{\text{USD}} = \lceil (10{,}099{,}750 \times 99{,}014{,}802{,}713) / 99{,}514{,}802{,}713 \rceil = 10{,}049{,}003\text{ cents}$
- $\text{Gross}_{\text{USD}} = 10{,}099{,}750 - 10{,}049{,}003 = 50{,}747\text{ cents}$ (`$507.47`)
- $\text{Fee}_{\text{cents}} = 254\text{ cents}$ (`$2.54`); User receives **`$504.93`** net (`+ $127` injected back into reserve).

---

### 2.4 Revenue-Backed Floor Growth (Platform Revenue Injection)
When any store purchase, `XRP <-> XLM` swap, or portfolio cashout settles across NexusRail, $50\%$ of the net fee (`halfFeeCents`) is injected directly into `token_pool.reserve_usd_cents` via `NrTokenService.injectRevenueToPool()`:
$$R_{\text{USD}} \leftarrow R_{\text{USD}} + \text{halfFeeCents}, \quad S_{\text{NR}} \leftarrow S_{\text{NR}}\text{ (unchanged)}$$
$$\Delta P_{\text{NR}} = \frac{\text{halfFeeCents} \times 10^6}{S_{\text{NR}}} > 0$$
This creates a **mathematically guaranteed upward backing pressure** whenever NexusRail commerce volume grows.
