# Module 2 (`M2`) — Research & Smart Basket NAV Mathematics

## 1. Multi-Rail Smart Basket Concept

Because NexusRail supports **Stellar (XLM, USDC, Soroban)**, **XRPL (XRP)**, **Fiat (Stripe)**, and the **`$NR` Native AMM (`M1`)**, shoppers can buy multi-asset combo packs in one checkout without managing multiple DEXs or bridges.

### Catalog Design

| SKU | Title | Category | Allocation Formula (Per 1 Unit) | Settlement Rail |
| :--- | :--- | :--- | :--- | :--- |
| **`BASKET-INFLATION-SHIELD`** | Inflation Shield Basket | `baskets` | `0.50g` 24K Gold (`PAXG`) + `30.00` `USDC` + `20.00g` Silver (`KAG`) | `stellar` |
| **`BASKET-DUAL-RAIL`** | Dual-Rail Flash Pack | `baskets` | `25.00 XRP` + `150.00 XLM` | `multi` |
| **`BASKET-AI-ALPHA`** | AI Dynamic Alpha Basket | `baskets` | `0.40g` 24K Gold + `25.00 $NR` + `15.00 XRP` + `100.00 XLM` | `multi` |
| **`NGOLD-1G`** | 1g 24K Digital Gold (`nGOLD`) | `live-assets` | `1.00g` Allocated Gold (`PAXG` Oracle) | `stellar` |
| **`NSILVER-10G`** | 10g Digital Silver (`nSILVER`) | `live-assets` | `10.00g` Allocated Silver (`KAG` Oracle) | `stellar` |
| **`NR-PACK-50`** | 50 `$NR` Protocol Pack | `live-assets` | `50.00 $NR` (`NrTokenService` AMM Spot Price) | `multi` |

*(All 12 pre-existing SKUs — including `RAIL-ONE`, `RELAY-MAT`, `NEXUS-TEE`, `NODE-STAND`, `SIGNAL-CAP`, `RAIL-CABLES`, `PROD-XRP-KIT`, `PROD-XLM-PASS`, `PROD-AGENT-PRO`, `PROD-LEDGER-COLD`, `NR-TOKEN`, and `NGOLD-TOKEN` — remain active for backward compatibility.)*

---

## 2. Live Net Asset Value (NAV) & Weight Equations

For any live-hydrated product/basket $\mathcal{B}$ containing components $\{(s_i, Q_i)\}_{i=1}^n$:

### 2.1 Component Unit Valuation ($P_i(t)$ in USD Cents)
- `GOLD_G`: $P_{\text{GOLD\_G}}(t) = \text{round}(\text{goldUsdPerGram} \times 100)$
- `SILVER_G`: $P_{\text{SILVER\_G}}(t) = \text{round}(\text{silverUsdPerGram} \times 100)$
- `XRP`: $P_{\text{XRP}}(t) = \text{round}(\text{xrpUsd} \times 100)$
- `XLM`: $P_{\text{XLM}}(t) = \text{round}(\text{xlmUsd} \times 100)$
- `USDC`: $P_{\text{USDC}}(t) = 100$ (`$1.00`)
- `NR`: $P_{\text{NR}}(t) = \max(1, \text{NrTokenService.getPoolStats().spotPriceCents})$

Each allocation line value (in integer USD cents):
$$V_i(t) = \max\!\big(1, \text{round}(Q_i \cdot P_i(t))\big)$$

### 2.2 Total Basket Live NAV ($\text{Price}_{\mathcal{B}}(t)$)
$$\text{Price}_{\mathcal{B}}(t) = \sum_{i=1}^{n} V_i(t) \quad \text{(USD cents)}$$

### 2.3 Dynamic Allocation Weight ($w_i(t)$)
$$w_i(t) = \text{round}_1\!\left(\frac{V_i(t)}{\text{Price}_{\mathcal{B}}(t)} \times 100\right)\%$$

### 2.4 Weighted 24-Hour Change ($\Delta_{24\text{h}, \mathcal{B}}\%$)
$$\Delta_{24\text{h}, \mathcal{B}}\% = \text{round}_2\!\left(\sum_{i=1}^{n} \frac{V_i(t)}{\text{Price}_{\mathcal{B}}(t)} \cdot \Delta_{24\text{h}, s_i}\%\right)$$
Where $\Delta_{24\text{h}, \text{USDC}}\% = 0$.

### 2.5 INR Conversion Preview
Using live CoinGecko `PAXG` USD vs INR prices:
$$\text{usdInrRate} = \frac{\text{goldInrPerGram}}{\text{goldUsdPerGram}}, \qquad \text{price\_inr} = \text{round}\!\left(\frac{\text{Price}_{\mathcal{B}}(t)}{100} \times \text{usdInrRate}\right)$$

---

## 3. Worked Baseline Example

Assuming baseline quotes (`goldUsdPerGram = $88.50`, `silverUsdPerGram = $1.05`, `xrpUsd = $1.30`, `xlmUsd = $0.18`, `$NR = $1.00`, `usdInrRate = 83.85`):
- **`BASKET-INFLATION-SHIELD`**:
  - $0.50\text{g Gold} = 4425\text{¢}$ + $30\text{ USDC} = 3000\text{¢}$ + $20\text{g Silver} = 2100\text{¢}$
  - Total NAV = **$9,525¢ (`$95.25` $\approx$ `₹7,987`)**
- **`BASKET-DUAL-RAIL`**:
  - $25\text{ XRP} = 3250\text{¢}$ + $150\text{ XLM} = 2700\text{¢}$
  - Total NAV = **$5,950¢ (`$59.50`)**
- **`BASKET-AI-ALPHA`**:
  - $0.40\text{g Gold} = 3540\text{¢}$ + $25\text{ NR} = 2500\text{¢}$ + $15\text{ XRP} = 1950\text{¢}$ + $100\text{ XLM} = 1800\text{¢}$
  - Total NAV = **$9,790¢ (`$97.90`)**
