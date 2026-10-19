import { MongoClient, Db, Collection } from 'mongodb';
import { env } from '../config/env.js';

export interface MongoUserDoc {
  _id?: any;
  id: string; // UUID or string identifier for consistent API representation
  email?: string;
  passwordHash?: string;
  walletAddress?: string;
  xrplAddress?: string;
  stellarAddress?: string;
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
  total_cents: number;
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
  created_at: string;
  updated_at: string;
}

export interface MongoWalletTxDoc {
  _id?: any;
  id: string;
  user_id: string;
  currency: 'USD' | 'XRP' | 'XLM';
  amount_cents: number;
  type: 'CREDIT' | 'DEBIT';
  reference_id: string;
  balance_after: number;
  created_at: string;
}

export interface MongoWalletBalanceDoc {
  _id?: any;
  user_id: string;
  currency: 'USD' | 'XRP' | 'XLM';
  available_cents: number;
  locked_cents: number;
  version: number;
  updated_at: string;
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

export interface MongoProposalDoc {
  _id?: any;
  id: string;
  user_id: string;
  action: 'PURCHASE_ORDER' | 'DEPOSIT_FUNDS';
  payload: Record<string, unknown>;
  status: 'PROPOSED' | 'CONFIRMED' | 'EXPIRED';
  expiresAt: Date;
  created_at: string;
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
  latencyMs: number;
  createdAt: string;
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

      // 2. Auth Nonces (auto-expire with TTL)
      await db.collection('auth_nonces').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection('auth_nonces').createIndex({ walletAddress: 1 }, { unique: true });

      // 3. Products
      await db.collection('products').createIndex({ sku: 1 }, { unique: true });
      await db.collection('products').createIndex({ active: 1, upvotes_count: -1 });

      // 4. Orders
      await db.collection('orders').createIndex({ order_number: 1 }, { unique: true });
      await db.collection('orders').createIndex({ user_id: 1, created_at: -1 });

      // 5. Proposals (TTL auto-cleanup)
      await db.collection('proposals').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection('proposals').createIndex({ id: 1 }, { unique: true });

      // 6. Audit Traces
      await db.collection('agent_audit_traces').createIndex({ userId: 1, createdAt: -1 });

      // 7. Wallet Balances & Ledger
      await db.collection('wallet_balances').createIndex({ user_id: 1, currency: 1 }, { unique: true });
      await db.collection('wallet_ledger').createIndex({ user_id: 1, created_at: -1 });

      // 8. Catalog Guide Messages
      await db.collection('guide_messages').createIndex({ user_id: 1, created_at: 1 });

      // 9. Webhook Events DLQ
      await db.collection('webhook_events').createIndex({ id: 1 }, { unique: true });
      await db.collection('webhook_events').createIndex({ status: 1, retry_count: 1 });

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
