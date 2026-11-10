# Module 3 Database Schema & Shared Type Definitions

> **Topic:** MongoDB Collections (`user_holdings`, `portfolio_events`), Order Idempotency, and TypeScript Interfaces  
> **Target Files:** `backend/src/services/mongo.ts`, `backend/src/types/index.ts`, `frontend/src/types/index.ts`  

---

## 1. MongoDB Collections

### 1.1 `user_holdings` Collection (`MongoUserHoldingDoc`)
Represents an individual user's aggregated position in a specific underlying asset.

```ts
export interface MongoUserHoldingDoc {
  _id?: any;
  id: string;                     // Deterministic UUID / string key
  user_id: string;                // Owner user ID
  symbol: AssetSymbol;            // 'GOLD_G' | 'SILVER_G' | 'XRP' | 'XLM' | 'USDC' | 'NR'
  label: string;                  // Display name (e.g. 'Physical 24K Gold (nGOLD)')
  quantity: number;               // Current owned quantity (floating point, e.g. 2.50)
  total_cost_cents: number;       // Cumulative acquisition cost basis (USD cents)
  avg_buy_price_cents: number;    // Weighted Average Cost per unit (USD cents)
  realized_pnl_cents: number;     // Cumulative realized P&L from historical sells
  updated_at: string;             // ISO-8601 timestamp
}
```

#### MongoDB Indexes
- **Compound Unique Index**: `{ user_id: 1, symbol: 1 }`, `{ unique: true }`  
  Guarantees each user has at most one record per asset symbol.
- **Query Index**: `{ user_id: 1 }`

---

### 1.2 `portfolio_events` Collection (`MongoPortfolioEventDoc`)
Append-only audit trail capturing every asset inflow, outflow, and liquidation.

```ts
export type PortfolioEventType = 
  | 'ACQUIRE_ORDER'     // Credited from paid order or basket purchase
  | 'CASHBACK_REWARD'   // Credited from 2% $NR cashback drop
  | 'SWAP_IN'           // Acquired via cross-chain swap
  | 'SELL_CASHOUT';     // Liquidated for USD or crypto cashout

export interface MongoPortfolioEventDoc {
  _id?: any;
  id: string;
  user_id: string;
  type: PortfolioEventType;
  symbol: AssetSymbol;
  quantity_delta: number;         // Positive for acquisitions, negative for sells
  unit_price_cents: number;       // Live price at time of event
  total_usd_cents: number;        // Gross USD value of transaction
  fee_cents: number;              // 0.5% liquidation spread or 0 for buys
  reference_id: string;           // Associated order_number or swap_id
  created_at: string;             // ISO-8601 timestamp
}
```

#### MongoDB Indexes
- **History Query Index**: `{ user_id: 1, created_at: -1 }`
- **Global Audit Index**: `{ type: 1, created_at: -1 }`

---

### 1.3 `orders` Collection Schema Extension (`MongoOrderDoc`)
To protect against race conditions, webhook retries, and background reconciliation loops, an idempotency boolean flag is added to orders:

```ts
export interface MongoOrderDoc {
  // Existing fields ...
  portfolio_credited?: boolean;   // True if assets have been credited to user_holdings
  portfolio_credited_at?: string; // Timestamp of crediting
}
```

---

## 2. API Data Transfer Objects (DTOs)

### 2.1 Hydrated User Portfolio Response (`UserPortfolioResponse`)
```ts
export interface HydratedHolding {
  symbol: AssetSymbol;
  label: string;
  quantity: number;
  total_cost_cents: number;
  avg_buy_price_cents: number;
  current_price_cents: number;
  current_value_cents: number;
  unrealized_pnl_cents: number;
  unrealized_pnl_percent: number;
  realized_pnl_cents: number;
  change_24h_percent?: number;
  oracle_source: 'binance' | 'coingecko' | 'amm';
  updated_at: string;
}

export interface UserPortfolioResponse {
  user_id: string;
  total_cost_cents: number;
  total_current_value_cents: number;
  total_unrealized_pnl_cents: number;
  total_unrealized_pnl_percent: number;
  total_realized_pnl_cents: number;
  inr_total_current_value: number;
  holdings: HydratedHolding[];
  recent_events: MongoPortfolioEventDoc[];
}
```

### 2.2 Cashout Sell Request & Response DTOs
```ts
export interface SellHoldingRequest {
  symbol: AssetSymbol;
  quantity: number;
}

export interface SellHoldingResponse {
  success: boolean;
  event_id: string;
  symbol: AssetSymbol;
  quantity_sold: number;
  gross_proceeds_cents: number;
  spread_fee_cents: number;       // 0.50% platform spread
  net_payout_cents: number;       // Credited to user USD wallet
  realized_pnl_cents: number;
  remaining_quantity: number;
  new_usd_balance_cents: number;
  transaction_hash?: string;
}
```
