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

export type PortfolioEventType = 'ACQUIRE_ORDER' | 'CASHBACK_REWARD' | 'SWAP_IN' | 'SELL_CASHOUT';

export interface DbUserHolding {
  id: string;
  user_id: string;
  symbol: AssetSymbol;
  label: string;
  quantity: number;
  total_cost_cents: number;
  avg_buy_price_cents: number;
  realized_pnl_cents: number;
  updated_at: string;
}

export interface DbPortfolioEvent {
  id: string;
  user_id: string;
  type: PortfolioEventType;
  symbol: AssetSymbol;
  quantity_delta: number;
  unit_price_cents: number;
  total_usd_cents: number;
  fee_cents: number;
  reference_id: string;
  created_at: string;
}

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
  recent_events: DbPortfolioEvent[];
}

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
  spread_fee_cents: number;
  net_payout_cents: number;
  realized_pnl_cents: number;
  remaining_quantity: number;
  new_usd_balance_cents: number;
}

export interface PlatformAUCResponse {
  total_custody_usd_cents: number;
  assets: {
    symbol: AssetSymbol;
    label: string;
    total_quantity: number;
    current_price_cents: number;
    valuation_usd_cents: number;
    user_count: number;
  }[];
  recent_liquidations: DbPortfolioEvent[];
  total_spread_earned_cents: number;
}

// ============================================================================
// Module 4: Platform Treasury, Smart Contract & On-Chain Types
// ============================================================================

export interface TreasurySummaryResponse {
  totalGrossVolumeCents: number;
  totalRevenueCents: number;
  netOwnerProfitCents: number;
  netOwnerProfitUsd: number;
  nrPoolInjectedCents: number;
  nrPoolInjectedUsd: number;
  revenue24hCents: number;
  ownerProfit24hCents: number;
  breakdown: {
    orderFeesCents: number;
    swapSpreadsCents: number;
    cashoutSpreadsCents: number;
    aiFeesCents: number;
    gasSurplusCents: number;
  };
  zeroSumDifferenceCents: number;
  isBalanced: boolean;
  updatedAt: string;
}

export interface PlatformConfigDTO {
  order_fee_bps: number;
  swap_spread_bps: number;
  cashout_spread_bps: number;
  ai_fee_bps: number;
  gas_flat_cents: number;
  nr_buyback_share_pct: number;
  cashback_pct: number;
  is_paused: boolean;
  updated_at: string;
  updated_by?: string;
}

export interface SmartContractDTO {
  contractId: string;
  name: string;
  network: 'testnet' | 'mainnet';
  protocolVersion: number;
  currentWasmHash: string;
  adminAddress: string;
  treasuryAddress: string;
  nrReserveAddress: string;
  feeBps: number;
  ownerSplitPct: number;
  status: 'ACTIVE' | 'PAUSED' | 'DEPRECATED';
  deployedAt: string;
  explorerUrl: string;
  upgrades?: Array<{
    wasm_hash: string;
    upgraded_at: string;
    admin_id?: string;
    tx_hash?: string;
    notes?: string;
  }>;
}

export interface OnChainTokenDTO {
  symbol: 'NR';
  name: string;
  chain: 'STELLAR';
  assetCode: 'NR';
  issuerAddress: string;
  distributionAddress: string;
  initialMintAmount: number;
  totalSupplyCap: number;
  mintTxHash: string;
  createdAt: string;
  explorerUrl: string;
}

export interface OnChainWithdrawalRequest {
  amount: number;
  destinationStellarAddress: string;
}

export interface OnChainWithdrawalResponse {
  success: boolean;
  withdrawalId: string;
  amountNr: number;
  destinationStellarAddress: string;
  txHash: string;
  ledgerSeq?: number;
  remainingNrBalance: number;
  explorerUrl: string;
}

