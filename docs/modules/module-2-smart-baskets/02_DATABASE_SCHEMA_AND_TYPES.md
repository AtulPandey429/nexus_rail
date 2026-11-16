# Module 2 (`M2`) — Database Schema & Shared Type Contracts

## 1. Shared TypeScript Definitions
Embedded symmetrically in both:
- `backend/src/types/index.ts`
- `frontend/src/types/index.ts`

```ts
export type AssetSymbol = 'GOLD_G' | 'SILVER_G' | 'XRP' | 'XLM' | 'USDC' | 'NR';

export interface ProductAllocation {
  symbol: AssetSymbol;
  label: string;
  unitQty: number;
  weightPercent?: number;
  valueCents?: number;
}
```

### Extended `DbProduct` Fields
```ts
export interface DbProduct {
  id: string;
  sku: string;
  title: string;
  description?: string;
  price_cents: number;
  category: string;
  stock_quantity: number;
  active: boolean;
  upvotes_count: number;
  rail?: 'stellar' | 'xrpl' | 'multi';
  tag?: string;
  rating?: number;
  is_live_asset?: boolean;
  is_basket?: boolean;
  allocations?: ProductAllocation[];
  price_inr?: number;
  change_24h_percent?: number;
  oracle_source?: 'coingecko' | 'binance' | 'amm';
  price_updated_at?: string;
  created_at: string;
}
```

---

## 2. MongoDB `products` Collection Schema (`backend/src/services/mongo.ts`)

`MongoProductDoc` stores the static configuration (including `allocations` quantities). Live USD `price_cents`, `price_inr`, allocation `weightPercent` / `valueCents`, `change_24h_percent`, and `price_updated_at` are hydrated dynamically at read time via `ProductService` so stale values never persist at checkout.

| Field | Type | Description |
| :--- | :--- | :--- |
| `sku` | `string` | Unique catalog identifier (e.g. `BASKET-INFLATION-SHIELD`). |
| `category` | `string` | `'baskets' | 'live-assets' | 'hardware' | 'workspace' | 'essentials' | ...` |
| `is_basket` | `boolean?` | `true` for multi-asset Smart Baskets. |
| `is_live_asset` | `boolean?` | `true` for any live oracle/AMM-hydrated product. |
| `allocations` | `ProductAllocation[]?` | Component quantities (`symbol`, `label`, `unitQty`). |
| `price_cents` | `number` | Baseline fallback price in DB; overwritten at read time when `allocations` exist. |
