export type PaymentRail = 'STRIPE' | 'WALLET' | 'XRPL' | 'STELLAR';
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
export type WalletCurrency = 'USD' | 'XRP' | 'XLM';
export type TransactionType = 'CREDIT' | 'DEBIT';

export interface DbUser {
  id: string;
  email?: string;
  password_hash?: string;
  wallet_address?: string;
  xrpl_address?: string;
  privy_did?: string;
  role: 'user' | 'admin';
  created_at: string;
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

export interface DbProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  verified_purchase: boolean;
  created_at: string;
}
