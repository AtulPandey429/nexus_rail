# Module 4 — Database Schema & Shared Type Contracts

> **Module:** `M4` Platform Owner Profit Engine, Database Ledger & Stellar Protocol 22 Smart Contract  
> **Database:** MongoDB Atlas Primary Cluster (`nexusrail`)  
> **Collections Added:** `platform_treasury`, `platform_config`, `platform_contracts`, `platform_tokens`, `token_withdrawals`

---

## 1. MongoDB Collections Specification

### 1.1 `platform_treasury` Collection

Tracks every discrete revenue event across all order, swap, cashout, and AI workflows.

```typescript
export interface MongoTreasuryEntryDoc {
  _id?: any;
  id: string; // "rev_UUID"
  source_type: 'ORDER' | 'SWAP' | 'SELL_SPREAD' | 'AI_EXECUTION' | 'GAS_ARBITRAGE';
  reference_id: string; // orderId, swapId, cashoutId, etc.
  gross_cents: number; // Gross transaction value
  fee_cents: number; // Platform fee
  spread_cents: number; // FX or liquidation spread
  gas_arbitrage_cents: number; // Network gas surplus
  total_revenue_cents: number; // fee + spread + gas
  net_owner_profit_cents: number; // 50% to Owner Profit
  nr_pool_injected_cents: number; // 50% to $NR Liquidity Pool
  rail: 'STELLAR' | 'XRPL' | 'STRIPE' | 'NR' | 'INTERNAL';
  created_at: string; // ISO 8601
}
```

#### Indexes:
- `{ reference_id: 1, source_type: 1 }` (Unique): **Strict Idempotency Guard** — prevents duplicate revenue logging if webhooks or reconciliation timers re-fire.
- `{ created_at: -1 }`: Rapid timeseries aggregation for 24h metrics and audit logs.
- `{ source_type: 1 }`: Breakdown filtering.

---

### 1.2 `platform_config` Collection

Stores dynamic platform configuration parameters editable directly via the Admin Console.

```typescript
export interface MongoPlatformConfigDoc {
  _id?: any;
  key: 'treasury_settings';
  order_fee_bps: number; // e.g. 100 bps = 1.0%
  swap_spread_bps: number; // e.g. 50 bps = 0.5%
  cashout_spread_bps: number; // e.g. 50 bps = 0.5%
  ai_fee_bps: number; // e.g. 25 bps = 0.25%
  gas_flat_cents: number; // e.g. 10 cents ($0.10)
  nr_buyback_share_pct: number; // e.g. 50%
  cashback_pct: number; // e.g. 2%
  is_paused: boolean;
  updated_at: string;
  updated_by?: string;
}
```

#### Indexes:
- `{ key: 1 }` (Unique).

---

### 1.3 `platform_contracts` Collection

Maintains full on-chain lifecycle, deployment metadata, and version audit trail for smart contracts.

```typescript
export interface ContractUpgradeEntry {
  wasm_hash: string;
  upgraded_at: string;
  tx_hash: string;
  upgraded_by: string;
  protocol_version: number;
  notes?: string;
}

export interface MongoSmartContractDoc {
  _id?: any;
  contract_id: string; // "C..." Stellar Soroban Contract ID
  name: string; // "NexusVault"
  network: 'testnet' | 'mainnet';
  rpc_url: string; // "https://soroban-testnet.stellar.org"
  protocol_version: number; // 22
  current_wasm_hash: string;
  admin_address: string; // "G..."
  treasury_address: string; // "G..."
  nr_reserve_address: string; // "G..."
  fee_bps: number;
  owner_split_pct: number;
  upgrades: ContractUpgradeEntry[];
  status: 'ACTIVE' | 'PAUSED' | 'DEPRECATED';
  deployed_at: string;
  last_verified_at: string;
  explorer_url: string;
}
```

#### Indexes:
- `{ contract_id: 1 }` (Unique).
- `{ network: 1, name: 1 }`.

---

### 1.4 `platform_tokens` Collection

Stores the authoritative on-chain token issuance parameters for `$NR`.

```typescript
export interface MongoPlatformTokenDoc {
  _id?: any;
  symbol: 'NR';
  name: string; // "NexusRail Protocol Token"
  chain: 'STELLAR';
  asset_code: 'NR';
  issuer_address: string; // "G..."
  distribution_address: string; // "G..."
  initial_mint_amount: number;
  total_supply_cap: number;
  mint_tx_hash: string;
  created_at: string;
  explorer_url: string;
}
```

#### Indexes:
- `{ symbol: 1, chain: 1 }` (Unique).

---

### 1.5 `token_withdrawals` Collection

Logs every internal-to-external blockchain withdrawal of `$NR` tokens.

```typescript
export interface MongoTokenWithdrawalDoc {
  _id?: any;
  id: string; // "wd_UUID"
  user_id: string;
  amount_nr: number;
  destination_stellar_address: string;
  tx_hash: string;
  ledger_seq?: number;
  status: 'CONFIRMED' | 'FAILED';
  error_message?: string;
  created_at: string;
}
```

#### Indexes:
- `{ id: 1 }` (Unique).
- `{ user_id: 1, created_at: -1 }`.
