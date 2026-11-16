export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email?: string;
  walletAddress?: string;
  xrplAddress?: string;
  passkeyId?: string;
  privyDid?: string;
  role: UserRole;
  createdAt: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

export type PaymentRail = 'STRIPE' | 'WALLET' | 'XRPL' | 'STELLAR' | 'NR_TOKEN';
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
export type WalletCurrency = 'USD' | 'XRP' | 'XLM' | 'NR';
export type TransactionType = 'CREDIT' | 'DEBIT';

export type AssetSymbol = 'GOLD_G' | 'SILVER_G' | 'XRP' | 'XLM' | 'USDC' | 'NR';

export interface ProductAllocation {
  symbol: AssetSymbol;
  label: string;
  unitQty: number;
  weightPercent?: number;
  valueCents?: number;
}

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

export interface DbOrder {
  id: string;
  user_id: string;
  order_number: string;
  total_cents: number;
  payment_rail: PaymentRail;
  payment_address?: string;
  payment_memo?: string;
  status: OrderStatus;
  ipfs_cid?: string;
  created_at: string;
}

export interface DbWalletTransaction {
  id: string;
  user_id: string;
  currency: WalletCurrency;
  amount_cents: number;
  type: TransactionType;
  reference_id?: string;
  balance_after: number;
  created_at: string;
}
