import { z } from 'zod';

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

export interface DbUser {
  id: string;
  email?: string;
  password_hash?: string;
  wallet_address?: string;
  xrpl_address?: string;
  passkey_id?: string;
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
  rail?: 'stellar' | 'xrpl' | 'multi';
  tag?: string;
  rating?: number;
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

export const LoginWithEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const Web3AuthChallengeSchema = z.object({
  walletAddress: z.string().min(10),
});

export const Web3VerifySignatureSchema = z.object({
  walletAddress: z.string().min(10),
  signature: z.string().min(10),
  nonce: z.string().min(10),
});

export type LoginWithEmailInput = z.infer<typeof LoginWithEmailSchema>;
export type Web3AuthChallengeInput = z.infer<typeof Web3AuthChallengeSchema>;
export type Web3VerifySignatureInput = z.infer<typeof Web3VerifySignatureSchema>;

export type ChainNetwork = 'testnet' | 'sandbox' | 'mainnet';

export interface ChainInvoice {
  orderId: string;
  chain: string;
  network: ChainNetwork;
  recipientAddress: string;
  paymentIdentifierType: 'memo_text' | 'destination_tag';
  paymentIdentifier: string | number;
  amountAsset: number;
  assetSymbol: string;
  amountDropsOrStroops?: string;
  amountUsdCents: number;
  fxRateUsd: number;
  expiresAt: string;
  explorerUrl?: string;
  qrPayload?: string;
}

export interface ChainVerificationResult {
  verified: boolean;
  txHash: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amountDelivered?: number;
  assetSymbol: string;
  ledgerIndex?: number;
  timestamp?: string;
  network: ChainNetwork;
  error?: string;
}

export interface IChainProvider {
  readonly chainId: string;
  readonly assetSymbol: string;
  readonly network: ChainNetwork;

  getAccountBalance(address?: string): Promise<{ balance: number; currency: string }>;
  createInvoice(orderId: string, amountUsdCents: number): Promise<ChainInvoice>;
  verifyPayment(orderId: string, txHash: string, expectedAmountAsset?: number): Promise<ChainVerificationResult>;
  getExplorerUrl(txHash: string): string;
  validateAddress(address: string): boolean;
}

export interface AgentToolPlugin {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface PaymentRailPlugin {
  id: string;
  name: string;
  createInvoice(orderId: string, amountCents: number): Promise<unknown>;
  verifyPayment(txHash: string): Promise<boolean>;
}
