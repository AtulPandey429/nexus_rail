import { MongoClient, Db, Collection } from 'mongodb';
import { env } from '../config/env.js';
import type { AssetSymbol } from '../types/index.js';

export interface MongoUserDoc {
  _id?: any;
  id: string; // UUID or string identifier for consistent API representation
  name?: string;
  email?: string;
  passwordHash?: string;
  walletAddress?: string;
  xrplAddress?: string;
  stellarAddress?: string;
  lastConnectedWallet?: {
    network: 'stellar' | 'xrpl';
    provider: string;
    address: string;
    connectedAt: string;
  };
  wallets?: Array<{
    network: 'stellar' | 'xrpl';
    address: string;
    provider: string;
    connectedAt: string;
    verified: boolean;
  }>;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface MongoNonceDoc {
  _id?: any;
  walletAddress: string;
  nonce: string;
  expiresAt: Date;
}

export interface MongoProductDoc {
  _id?: any;
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
  allocations?: Array<{
    symbol: AssetSymbol;
    label: string;
    unitQty: number;
    weightPercent?: number;
    valueCents?: number;
  }>;
  price_inr?: number;
  change_24h_percent?: number;
  oracle_source?: 'coingecko' | 'binance' | 'amm';
  price_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MongoCartItemDoc {
  _id?: any;
  user_id: string;
  sku: string;
  qty: number;
  updated_at: string;
}

export interface OrderItem {
  sku: string;
  title: string;
  qty: number;
  unit_price_cents: number;
}

export interface MongoOrderDoc {
  _id?: any;
  id: string;
  user_id: string;
  order_number: string;
  subtotal_cents?: number;
  discount_cents?: number;
  promo_code?: string;
  total_cents: number;
  cashback_credited?: boolean;
  cashback_usd_cents?: number;
  cashback_nxl_amount?: number;
  items: OrderItem[];
  payment_rail: string;
  payment_address?: string;
  payment_memo?: string;
  tx_hash?: string;
  status: 'PENDING' | 'PAID' | 'UNDERPAID' | 'FULFILLING' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
  stripe_session_id?: string;
  ipfs_cid?: string;
  quote_ticket?: any;
  slippage_percent?: number;
  underpaid_cents?: number;
  sender_wallet_address?: string;
  delivered_crypto_amount?: number;
  refund_tx_hash?: string;
  topup_reference?: string;
  nr_discount_cents?: number;
  paid_nr_micro?: number;
  nr_spot_rate_usd?: number;
  portfolio_credited?: boolean;
  portfolio_credited_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MongoSwapOrderDoc {
  _id?: any;
  swapId: string;
  user_id?: string;
  fromAsset: 'XRP' | 'XLM' | 'NXL' | 'USD';
  toAsset: 'XLM' | 'XRP' | 'NXL' | 'USD';
  payAmount: number;
  receiveAmount: number;
  exchangeRate: number;
  userSourceAddress?: string;
  userDestinationAddress: string;
  platformDepositAddress: string;
  paymentIdentifierType: 'destination_tag' | 'memo_text' | 'internal_ledger';
  paymentIdentifier: string | number;
  status: 'PENDING_DEPOSIT' | 'DEPOSIT_CONFIRMED' | 'PAYOUT_PROCESSING' | 'COMPLETED' | 'FAILED';
  depositTxHash?: string;
  payoutTxHash?: string;
  depositExplorerUrl?: string;
  payoutExplorerUrl?: string;
  journalEntry?: string;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}

export interface MongoCouponDoc {
  _id?: any;
  code: string;
  discount_percent: number;
  min_order_cents: number;
  requires_nr_holder: boolean;
  first_order_only?: boolean;
  issued_to_user_id?: string;
  active: boolean;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  description?: string;
  created_at: string;
}

export interface MongoUserHoldingDoc {
  _id?: any;
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

export type PortfolioEventType = 'ACQUIRE_ORDER' | 'CASHBACK_REWARD' | 'SWAP_IN' | 'SELL_CASHOUT';

export interface MongoPortfolioEventDoc {
  _id?: any;
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

export interface MongoWalletTxDoc {
  _id?: any;
  id: string;
  user_id: string;
  currency: 'USD' | 'XRP' | 'XLM' | 'NXL';
  amount_cents: number;
  type: 'CREDIT' | 'DEBIT';
  reference_id: string;
  balance_after: number;
  created_at: string;
}

export interface MongoWalletBalanceDoc {
  _id?: any;
  user_id: string;
  currency: 'USD' | 'XRP' | 'XLM' | 'NXL';
  available_cents: number;
  locked_cents: number;
  version: number;
  updated_at: string;
}

export interface MongoTokenPoolDoc {
  _id?: any;
  symbol: 'NXL';
  name: string;
  reserve_usd_cents: number;
  pool_nr_micro: number;
  total_supply_nr_micro: number;
  circulating_nr_micro: number;
  spot_price_cents: number;
  price_24h_open_cents: number;
  total_volume_usd_cents: number;
  cumulative_fee_injected_cents: number;
  swap_fee_bps: number;
  updated_at: string;
}

export interface MongoTokenPriceTickDoc {
  _id?: any;
  id: string;
  symbol: 'NXL';
  spot_price_cents: number;
  spot_price_usd: number;
  reserve_usd_cents: number;
  pool_nr_micro: number;
  trigger: 'GENESIS' | 'SWAP_BUY' | 'SWAP_SELL' | 'REVENUE_INJECTION' | 'ADMIN_ADJUST';
  reference_id: string;
  created_at: string;
}

export interface MongoGuideMessageDoc {
  _id?: any;
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  body: string;
  suggested_skus: string[];
  created_at: string;
}

export type ProposalAction =
  | 'PURCHASE_ORDER'
  | 'DEPOSIT_FUNDS'
  | 'PAY_ORDER'
  | 'SWAP_ASSETS'
  | 'CREATE_CUSTOM_BASKET';

export interface MongoProposalDoc {
  _id?: any;
  id: string;
  user_id: string;
  action: ProposalAction;
  payload: Record<string, unknown>;
  status: 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  expiresAt: Date;
  created_at: string;
  rejected_at?: string;
}

export interface MongoWebhookEventDoc {
  _id?: any;
  id: string;
  source: 'STRIPE';
  type: string;
  payload: any;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  retry_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentAuditTrace {
  id?: string;
  userId: string;
  sessionId: string;
  prompt: string;
  response: string;
  toolsInvoked?: string[];
  modelUsed?: string;
  latencyMs: number;
  createdAt: string;
}

// ============================================================================
// Module 4: Platform Treasury, Config, Smart Contracts & Token Issuance Schemas
// ============================================================================

export type TreasurySourceType = 'ORDER' | 'SWAP' | 'SELL_SPREAD' | 'AI_EXECUTION' | 'GAS_ARBITRAGE';

export interface MongoTreasuryEntryDoc {
  _id?: any;
  id: string; // "rev_UUID"
  source_type: TreasurySourceType;
  reference_id: string; // orderId, swapId, cashoutId, etc.
  gross_cents: number;
  fee_cents: number;
  spread_cents: number;
  gas_arbitrage_cents: number;
  total_revenue_cents: number;
  net_owner_profit_cents: number;
  nr_pool_injected_cents: number;
  rail: 'STELLAR' | 'XRPL' | 'STRIPE' | 'NXL' | 'INTERNAL';
  created_at: string;
}

export interface MongoPlatformConfigDoc {
  _id?: any;
  key: 'treasury_settings';
  order_fee_bps: number; // e.g. 100 bps = 1.0%
  swap_spread_bps: number; // e.g. 50 bps = 0.50%
  cashout_spread_bps: number; // e.g. 50 bps = 0.50%
  ai_fee_bps: number; // e.g. 25 bps = 0.25%
  gas_flat_cents: number; // e.g. 10 cents = $0.10
  nr_buyback_share_pct: number; // e.g. 50%
  cashback_pct: number; // e.g. 2%
  nxl_checkout_discount_pct: number; // e.g. 10%
  is_paused: boolean;
  updated_at: string;
  updated_by?: string;
}

export interface MongoPlatformSettingsDoc {
  _id?: any;
  id: 'global_platform_settings';
  network_mode: 'testnet' | 'mainnet';
  fees: {
    swap_fee_bps: number;             // e.g. 30 (0.30%)
    platform_order_fee_bps: number;    // e.g. 100 (1.00%)
    cashback_rate_bps: number;         // e.g. 150 (1.50%)
    slippage_tolerance_bps: number;    // e.g. 150 (1.50%)
    cashout_spread_bps: number;        // e.g. 50 (0.50%)
    nxl_discount_bps: number;          // e.g. 1000 (10.00%)
  };
  stellar: {
    networkPassphrase: string;
    horizonUrl: string;
    rpcUrl: string;
    merchantVault: string;
    distributorVault: string;
    nxlAssetCode: string;
    nxlIssuerPublic: string;
    nxlContractId: string;
    nexusVaultContractId: string;
    nexusSwapContractId: string;
    xlmSacContractId: string;
    explorerBase: string;
    explorerTxBase: string;
    explorerAccountBase: string;
    explorerContractBase: string;
  };
  xrpl: {
    wss: string;
    merchantVault: string;
    distributorVault: string;
    nxlCurrencyCode: string;
    nxlCurrencyHex: string;
    nxlIssuerAddress: string;
    nxlAmmAccount: string;
    explorerBase: string;
    explorerTxBase: string;
    explorerAccountBase: string;
  };
  updated_at: string;
  updated_by?: string;
}

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

export interface MongoPlatformTokenDoc {
  _id?: any;
  symbol: 'NXL';
  name: string;
  chain: 'STELLAR' | 'XRPL';
  asset_code: string;
  currency_hex?: string; // 40-char hex for XRPL (4E52000000000000000000000000000000000000)
  issuer_address: string;
  issuer_secret?: string;
  distribution_address: string;
  initial_mint_amount: number;
  total_supply_cap: number;
  mint_tx_hash: string;
  contract_id?: string;
  amm_account?: string;
  amm_tx_hash?: string;
  is_live_on_chain?: boolean;
  created_at: string;
  explorer_url: string;
}

export type ChainActionType =
  | 'MINT'
  | 'BURN'
  | 'REFUND'
  | 'TRUSTLINE'
  | 'AMM_CREATE'
  | 'AMM_DEPOSIT'
  | 'AMM_WITHDRAW'
  | 'AMM_SWAP'
  | 'CROSS_CHAIN_BRIDGE'
  | 'CONTRACT_SPLIT';

export interface MongoChainActionLogDoc {
  _id?: any;
  id: string; // "log_UUID"
  chain: 'STELLAR' | 'XRPL';
  action: ChainActionType;
  reference_id?: string;
  operator_id: string; // admin user or 'SYSTEM'
  tx_hash: string;
  ledger_seq?: number;
  amount_primary?: number | string;
  amount_secondary?: number | string;
  fee_charged?: number | string;
  details?: Record<string, any>;
  explorer_url: string;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string;
  created_at: string;
}

export interface MongoAmmPoolDoc {
  _id?: any;
  id: string;
  chain: 'STELLAR' | 'XRPL';
  symbol: string;
  paired_asset: string; // 'USD' on Stellar, 'XRP' on XRPL
  amm_account?: string; // XRPL AMM account
  lp_token_id?: string;
  issuer_address: string;
  vault_address: string;
  reserve_primary: number; // e.g. USD cents on Stellar, XRP drops on XRPL
  reserve_secondary: number; // NR tokens
  trading_fee_bps: number; // e.g. 50 (0.50%)
  status: 'ACTIVE' | 'PENDING' | 'PAUSED';
  created_tx_hash?: string;
  explorer_url?: string;
  created_at: string;
  updated_at: string;
}

export interface MongoTokenWithdrawalDoc {
  _id?: any;
  id: string; // "wd_UUID"
  user_id: string;
  amount_nr: number;
  destination_address: string;
  chain: 'STELLAR' | 'XRPL';
  destination_stellar_address?: string; // backward compat
  tx_hash: string;
  ledger_seq?: number;
  status: 'CONFIRMED' | 'FAILED';
  error_message?: string;
  created_at: string;
}

export class MongoService {
  private static client: MongoClient | null = null;
  private static dbInstance: Db | null = null;
  private static isConnecting = false;
  private static indexesInitialized = false;

  static async getClient(): Promise<MongoClient> {
    if (this.client) return this.client;
    if (this.isConnecting) {
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (this.client) return this.client;
    }

    this.isConnecting = true;
    try {
      const uri = env.MONGODB_URI || process.env.MONGODB_URI;
      if (!uri) throw new Error('MONGODB_URI is not set in environment');
      
      const client = new MongoClient(uri, {
        maxPoolSize: 20,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 8000,
      });

      await client.connect();
      this.client = client;
      this.dbInstance = client.db('nexusrail');
      console.log('🍃 [MongoDB Atlas] Primary Database Connected: "nexusrail"');

      // Initialize critical indexes asynchronously
      if (!this.indexesInitialized) {
        this.initIndexes(this.dbInstance).catch((err) => {
          console.warn('⚠️ [MongoDB Index Warning]:', err.message);
        });
        this.indexesInitialized = true;
      }

      return this.client;
    } finally {
      this.isConnecting = false;
    }
  }

  static async getDb(): Promise<Db> {
    if (this.dbInstance) return this.dbInstance;
    await this.getClient();
    return this.dbInstance!;
  }

  static async getCollection<T extends Record<string, any>>(name: string): Promise<Collection<T>> {
    const db = await this.getDb();
    return db.collection<T>(name);
  }

  private static async initIndexes(db: Db): Promise<void> {
    try {
      // 1. Users Indexes
      await db.collection('users').createIndex(
        { email: 1 },
        { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
      );
      await db.collection('users').createIndex(
        { walletAddress: 1 },
        { unique: true, partialFilterExpression: { walletAddress: { $type: 'string' } } }
      );
      await db.collection('users').createIndex({ id: 1 }, { unique: true });
      await db.collection('users').createIndex({ createdAt: -1 });
      await db.collection('users').createIndex({ created_at: -1 }, { sparse: true });

      // 2. Auth Nonces (auto-expire with TTL)
      await db.collection('auth_nonces').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection('auth_nonces').createIndex({ walletAddress: 1 }, { unique: true });

      // 3. Products
      await db.collection('products').createIndex({ sku: 1 }, { unique: true });
      await db.collection('products').createIndex({ active: 1, upvotes_count: -1 });

      // 4. Orders
      await db.collection('orders').createIndex({ order_number: 1 }, { unique: true });
      await db.collection('orders').createIndex({ user_id: 1, created_at: -1 });
      await db.collection('orders').createIndex({ created_at: -1 });
      await db.collection('orders').createIndex({ status: 1, created_at: -1 });
      await db.collection('orders').createIndex({ payment_rail: 1, created_at: -1 });

      // 5. Proposals (TTL auto-cleanup)
      await db.collection('proposals').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection('proposals').createIndex({ id: 1 }, { unique: true });

      // 6. Audit Traces
      await db.collection('agent_audit_traces').createIndex({ userId: 1, createdAt: -1 });

      // 7. Wallet Balances & Ledger
      await db.collection('wallet_balances').createIndex({ user_id: 1, currency: 1 }, { unique: true });
      await db.collection('wallet_ledger').createIndex({ user_id: 1, created_at: -1 });
      await db.collection('wallet_ledger').createIndex({ created_at: -1 });
      await db.collection('wallet_ledger').createIndex({ type: 1, created_at: -1 });

      // 8. Catalog Guide Messages
      await db.collection('guide_messages').createIndex({ user_id: 1, created_at: 1 });

      // 9. Webhook Events DLQ
      await db.collection('webhook_events').createIndex({ id: 1 }, { unique: true });
      await db.collection('webhook_events').createIndex({ status: 1, retry_count: 1 });

      // 10. $NR Token AMM Pool & Price History
      await db.collection('token_pool').createIndex({ symbol: 1 }, { unique: true });
      await db.collection('token_price_history').createIndex({ symbol: 1, created_at: -1 });

      // 11. User Holdings & Portfolio Events
      await db.collection('user_holdings').createIndex({ user_id: 1, symbol: 1 }, { unique: true });
      await db.collection('user_holdings').createIndex({ user_id: 1 });
      await db.collection('user_holdings').createIndex({ symbol: 1, quantity: 1 });
      await db.collection('portfolio_events').createIndex({ user_id: 1, created_at: -1 });
      await db.collection('portfolio_events').createIndex({ type: 1, created_at: -1 });

      // 12. Module 4: Platform Treasury & Revenue Ledger (Idempotent)
      await db.collection('platform_treasury').createIndex({ reference_id: 1, source_type: 1 }, { unique: true });
      await db.collection('platform_treasury').createIndex({ created_at: -1 });
      await db.collection('platform_treasury').createIndex({ source_type: 1 });

      // 13. Module 4: Dynamic Platform Configuration
      await db.collection('platform_config').createIndex({ key: 1 }, { unique: true });

      // 14. Module 4: Smart Contracts & Upgrades
      await db.collection('platform_contracts').createIndex({ contract_id: 1 }, { unique: true });
      await db.collection('platform_contracts').createIndex({ network: 1, name: 1 });

      // 15. Module 4: On-Chain Platform Tokens & Withdrawals
      await db.collection('platform_tokens').createIndex({ symbol: 1, chain: 1 }, { unique: true });
      await db.collection('token_withdrawals').createIndex({ id: 1 }, { unique: true });
      await db.collection('token_withdrawals').createIndex({ user_id: 1, created_at: -1 });
      await db.collection('token_withdrawals').createIndex({ created_at: -1 });

      // 16. Dual-Rail On-Chain Action Logs & AMM Pools
      await db.collection('platform_chain_logs').createIndex({ chain: 1, created_at: -1 });
      await db.collection('platform_chain_logs').createIndex({ created_at: -1 });
      await db.collection('platform_chain_logs').createIndex({ action: 1 });
      await db.collection('platform_chain_logs').createIndex({ tx_hash: 1 }, { unique: true, sparse: true });
      await db.collection('platform_amm_pools').createIndex({ chain: 1, symbol: 1 }, { unique: true });

      // 17. Module 6: Persistent Cross-Chain Swaps
      await db.collection('swaps').createIndex({ swapId: 1 }, { unique: true });
      await db.collection('swaps').createIndex({ user_id: 1, createdAt: -1 });
      await db.collection('swaps').createIndex({ createdAt: -1 });

      // 18. Module 7: Smart Coupons
      await db.collection('coupons').createIndex({ code: 1 }, { unique: true });

      console.log('✅ [MongoDB Atlas] Primary Collections & TTL Indexes Initialized');
    } catch (err: any) {
      console.warn('⚠️ [MongoDB Index Init Warning]:', err.message);
    }
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.dbInstance = null;
      this.indexesInitialized = false;
      console.log('🛑 [MongoDB Atlas] Connection Closed');
    }
  }
}

/**
 * Backward-compatible MongoAuditLogger
 */
export class MongoAuditLogger {
  static async logAgentTrace(trace: Omit<AgentAuditTrace, 'id' | 'createdAt'>): Promise<void> {
    const entry: AgentAuditTrace = {
      ...trace,
      createdAt: new Date().toISOString(),
    };

    try {
      const db = await MongoService.getDb();
      const res = await db.collection('agent_audit_traces').insertOne(entry);
      console.log(`🍃 [MongoDB Atlas] Telemetry Audit Trace Logged (ID: ${res.insertedId})`);
    } catch (error: any) {
      console.warn(`⚠️ [MongoDB Audit Warning]: ${error.message}`);
    }
  }
}
