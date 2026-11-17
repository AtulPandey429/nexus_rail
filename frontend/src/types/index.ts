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

export type PaymentRail = 'STRIPE' | 'WALLET' | 'XRPL' | 'STELLAR' | 'NXL_TOKEN';
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
export type WalletCurrency = 'USD' | 'XRP' | 'XLM' | 'NXL';
export type TransactionType = 'CREDIT' | 'DEBIT';

export type AssetSymbol = 'GOLD_G' | 'SILVER_G' | 'XRP' | 'XLM' | 'USDC' | 'NXL';

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
  symbol: 'NXL';
  name: string;
  chain: 'STELLAR' | 'XRPL';
  assetCode: string;
  currencyHex?: string;
  issuerAddress: string;
  distributionAddress: string;
  initialMintAmount: number;
  totalSupplyCap: number;
  mintTxHash: string;
  contractId?: string;
  ammAccount?: string;
  ammTxHash?: string;
  createdAt: string;
  explorerUrl: string;
}

export interface ChainActionLogDTO {
  id: string;
  chain: 'STELLAR' | 'XRPL';
  action: 'MINT' | 'TRUSTLINE' | 'AMM_CREATE' | 'AMM_DEPOSIT' | 'AMM_WITHDRAW' | 'CROSS_CHAIN_BRIDGE' | 'CONTRACT_SPLIT';
  reference_id?: string;
  operator_id: string;
  tx_hash: string;
  ledger_seq?: number;
  amount_primary?: number | string;
  amount_secondary?: number | string;
  fee_charged?: number | string;
  details?: Record<string, any>;
  explorer_url: string;
  status: 'SUCCESS' | 'FAILED';
  created_at: string;
}

export interface DualRailTokenSummaryDTO {
  stellar: {
    assetCode: string;
    issuerAddress: string;
    contractId: string;
    distributionVault: string;
    supplyCap: number;
    explorerUrl: string;
    status: string;
  };
  xrpl: {
    currencyCode: string;
    currencyHex: string;
    issuerAddress: string;
    distributionVault: string;
    ammAccount: string;
    reserveXrp: number;
    reserveNr: number;
    tradingFeeBps: number;
    ammTxHash: string;
    explorerUrl: string;
    status: string;
  };
  parity: {
    stellarCirculating: number;
    xrplCirculating: number;
    totalSupplyCap: number;
    isBalanced: boolean;
    invariantString: string;
  };
  recentLogs: ChainActionLogDTO[];
}

export interface OnChainWithdrawalRequest {
  amount: number;
  chain?: 'STELLAR' | 'XRPL';
  destinationAddress: string;
  destinationStellarAddress?: string; // backward compat
}

export interface OnChainWithdrawalResponse {
  success: boolean;
  withdrawalId: string;
  amountNr: number;
  chain: 'STELLAR' | 'XRPL';
  destinationAddress: string;
  txHash: string;
  ledgerSeq?: number;
  remainingNrBalance: number;
  explorerUrl: string;
}

// ============================================================================
// Admin Analytics (real aggregates from orders, treasury, users and custody)
// ============================================================================

export type AdminAnalyticsRangeKey = '7d' | '30d' | '90d' | '1y' | 'all';
export type AdminAnalyticsGranularity = 'day' | 'week' | 'month';

export interface AdminAnalyticsBucket {
  bucket: string;
  label: string;
  orderVolumeCents: number;
  settledOrders: number;
  totalOrders: number;
  revenueCents: number;
  ownerProfitCents: number;
  newUsers: number;
}

export interface AdminAnalyticsBreakdownRow {
  key: string;
  label: string;
  count: number;
  volumeCents: number;
}

export interface AdminAnalyticsRevenueRow {
  key: string;
  label: string;
  grossCents: number;
  revenueCents: number;
}

export interface AdminAnalyticsTopProduct {
  sku: string;
  title: string;
  quantity: number;
  revenueCents: number;
}

export interface AdminAnalyticsRecentOrder {
  id: string;
  orderNumber: string;
  buyerEmail: string;
  buyerName?: string;
  status: string;
  rail: string;
  totalCents: number;
  createdAt: string;
}

export interface AdminAnalyticsResponse {
  range: {
    key: AdminAnalyticsRangeKey;
    label: string;
    from: string | null;
    to: string;
    days: number | null;
    granularity: AdminAnalyticsGranularity;
  };
  generatedAt: string;
  overview: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    userGrowthPct: number | null;
    totalOrders: number;
    settledOrders: number;
    pendingOrders: number;
    failedOrders: number;
    successRatePct: number;
    orderVolumeCents: number;
    averageOrderValueCents: number;
    grossTreasuryVolumeCents: number;
    revenueCents: number;
    feeCents: number;
    spreadCents: number;
    gasArbitrageCents: number;
    ownerProfitCents: number;
    nrPoolInjectedCents: number;
    zeroSumDifferenceCents: number;
    isBalanced: boolean;
    custodyUsdCents: number;
    nrPoolReserveUsdCents: number;
    walletCreditsCents: number;
    walletDebitsCents: number;
    tokenWithdrawalsCount: number;
    tokenWithdrawalUnits: number;
  };
  lifetime: {
    orderVolumeCents: number;
    settledOrders: number;
    totalOrders: number;
    revenueCents: number;
    ownerProfitCents: number;
    grossTreasuryVolumeCents: number;
    totalUsers: number;
  };
  series: AdminAnalyticsBucket[];
  statusBreakdown: AdminAnalyticsBreakdownRow[];
  railBreakdown: AdminAnalyticsBreakdownRow[];
  revenueBreakdown: AdminAnalyticsRevenueRow[];
  topProducts: AdminAnalyticsTopProduct[];
  custodyAssets: PlatformAUCResponse['assets'];
  recentOrders: AdminAnalyticsRecentOrder[];
  dataQuality: {
    notes: string[];
    unavailableMetrics: Array<{
      metric: string;
      reason: string;
      requiredChange: string;
    }>;
  };
}

