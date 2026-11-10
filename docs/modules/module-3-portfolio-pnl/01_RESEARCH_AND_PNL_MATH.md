# Module 3 Research & Portfolio Mathematics

> **Topic:** Weighted-Average Cost Basis (`WAC`), Unrealized P&L, Realized P&L, and 1-Click Liquidation Spread  
> **Authors:** NexusRail Core Engineering Team  
> **Target Production Standard:** November 2026 Double-Entry Accounting Invariants  

---

## 1. Weighted-Average Cost Basis (Acquisition & Buy Phase)

When a user acquires assets through single packs, smart baskets, or promo rewards, acquisitions often occur at varying market prices over time. Rather than complex tax-lot FIFO matching which bloats database state, NexusRail implements the globally accepted **Weighted-Average Cost (`WAC`)** standard.

### 1.1 Mathematical Formulation
Let:
- $Q_{\text{old}}$ = Existing asset quantity held by the user (floating point, e.g., grams of gold or tokens).
- $C_{\text{old}}$ = Existing cumulative cost basis in integer USD cents ($\mathbb{Z}_{\ge 0}$).
- $\Delta Q$ = Newly delivered asset quantity from an order or reward ($\Delta Q > 0$).
- $P_{\text{buy}}$ = Acquisition unit price at settlement time in USD cents per unit.

The acquisition cost increment $\Delta C$ is computed as:
$$\Delta C = \text{round}(\Delta Q \cdot P_{\text{buy}})$$

The updated position parameters become:
$$Q_{\text{new}} = Q_{\text{old}} + \Delta Q$$
$$C_{\text{new}} = C_{\text{old}} + \Delta C$$
$$\text{AvgBuyPrice}_{\text{cents}} = \frac{C_{\text{new}}}{Q_{\text{new}}}$$

### 1.2 Multi-Asset Basket Decomposition
When a user buys $N$ units of a **Smart Basket** (e.g., `BASKET-INFLATION-SHIELD`) composed of allocations $\{(\text{symbol}_i, \text{unitQty}_i)\}_{i=1}^k$:
For each constituent asset $i$:
$$\Delta Q_i = N \cdot \text{unitQty}_i$$
$$P_{\text{buy},i} = P_{\text{live},i}(t)$$
$$\Delta C_i = \text{round}(\Delta Q_i \cdot P_{\text{buy},i})$$

This guarantees that basket purchases break down into genuine, verifiable physical and crypto custody allocations.

---

## 2. Real-Time Valuation & Unrealized P&L

At any observation timestamp $t$, the system queries the live oracle registry (`market.ts` for Gold/Silver/XRP/XLM/USDC and `NrTokenService` for `$NR` spot price):

Let $P_{\text{live}}(t)$ be the live oracle price in USD cents per unit.

### 2.1 Current Market Value
$$\text{CurrentValue}_{\text{cents}}(t) = \text{round}(Q_{\text{current}} \cdot P_{\text{live}}(t))$$

### 2.2 Net Unrealized Profit / Loss
$$\text{UnrealizedPnL}_{\text{cents}}(t) = \text{CurrentValue}_{\text{cents}}(t) - C_{\text{current}}$$

$$\text{UnrealizedPnL}_{\%}(t) = \begin{cases} \left( \frac{\text{UnrealizedPnL}_{\text{cents}}(t)}{C_{\text{current}}} \right) \times 100 & \text{if } C_{\text{current}} > 0 \\ 0 & \text{if } C_{\text{current}} = 0 \end{cases}$$

### 2.3 Portfolio Aggregation
Across all active user holdings $\{H_1, H_2, \dots, H_m\}$:
$$\text{TotalInvestedCents} = \sum_{j=1}^m C_j$$
$$\text{TotalCurrentValueCents} = \sum_{j=1}^m \text{CurrentValue}_{\text{cents}, j}$$
$$\text{NetUnrealizedPnLCents} = \text{TotalCurrentValueCents} - \text{TotalInvestedCents}$$
$$\text{NetUnrealizedPnL}_{\%} = \begin{cases} \left( \frac{\text{NetUnrealizedPnLCents}}{\text{TotalInvestedCents}} \right) \times 100 & \text{if } \text{TotalInvestedCents} > 0 \\ 0 & \text{if } \text{TotalInvestedCents} = 0 \end{cases}$$

---

## 3. 1-Click Cashout & Liquidation Spread Math

When a user chooses to liquidate $\Delta Q_{\text{sell}}$ units of a holding ($0 < \Delta Q_{\text{sell}} \le Q_{\text{current}}$):

### 3.1 Gross Liquidation Value
$$\text{Gross}_{\text{cents}} = \text{round}(\Delta Q_{\text{sell}} \cdot P_{\text{live}}(t))$$

### 3.2 Platform Liquidation Spread ($0.50\%$ / `50 bps`)
To cover cross-rail settlement friction and protocol revenue:
$$\text{Spread}_{\text{cents}} = \text{round}(\text{Gross}_{\text{cents}} \times 0.005)$$
$$\text{NetPayout}_{\text{cents}} = \text{Gross}_{\text{cents}} - \text{Spread}_{\text{cents}}$$

### 3.3 Proportional Cost Basis Relinquishment
When selling a partial position, the cost basis is reduced strictly in proportion to the quantity liquidated:
$$\text{CostRemoved}_{\text{cents}} = \text{round}\left( C_{\text{current}} \cdot \frac{\Delta Q_{\text{sell}}}{Q_{\text{current}}} \right)$$
$$Q_{\text{after}} = Q_{\text{current}} - \Delta Q_{\text{sell}}$$
$$C_{\text{after}} = \max(0, C_{\text{current}} - \text{CostRemoved}_{\text{cents}})$$

### 3.4 Realized Profit / Loss
$$\text{RealizedPnL}_{\text{cents}} = \text{NetPayout}_{\text{cents}} - \text{CostRemoved}_{\text{cents}}$$

The cumulative realized P&L on the holding is updated:
$$\text{RealizedPnL}_{\text{total, new}} = \text{RealizedPnL}_{\text{total, old}} + \text{RealizedPnL}_{\text{cents}}$$

---

## 4. Double-Entry Invariants & Overdraft Defenses

To ensure institutional financial integrity:
1. **Holding Positivity Invariant**: For every asset holding, $Q \ge 0$ and $C \ge 0$. Any sell request with $\Delta Q_{\text{sell}} > Q_{\text{current}}$ is rejected with HTTP `400 Bad Request ("Insufficient asset holding balance")`.
2. **MongoDB Atomic Filter Guard**: Liquidation updates execute with atomic conditional query:
   ```ts
   { user_id: userId, symbol: symbol, quantity: { $gte: quantityToSell } }
   ```
   If a concurrent request attempts double-liquidation, exactly one succeeds and the second modifies 0 documents, triggering an immediate rollback.
3. **Internal USD Wallet Credit**: Net payout USD cents are atomically credited to the user's primary internal balance via `WalletService.creditBalance(userId, netPayoutCents, 'USD', ...)` inside a database session.
