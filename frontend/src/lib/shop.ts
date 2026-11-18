import type { ProductAllocation } from '@/types';

export type SessionUser = {
  id: string;
  name?: string;
  email?: string;
  walletAddress?: string;
  stellarAddress?: string;
  xrplAddress?: string;
  lastConnectedWallet?: {
    network: 'stellar' | 'xrpl';
    provider: string;
    address: string;
    connectedAt: string;
  } | null;
  wallets?: Array<{
    network: 'stellar' | 'xrpl';
    address: string;
    provider: string;
    connectedAt: string;
    verified?: boolean;
  }>;
  role: 'user' | 'admin';
};

export type CatalogProduct = {
  sku: string;
  title: string;
  description: string;
  priceCents: number;
};

export type CartLine = CatalogProduct & { qty: number; priced: boolean };

export type GuideMessage = {
  role: 'user' | 'assistant';
  body: string;
  suggestedSkus?: string[];
};

const SESSION_EVENT = 'nexus-session';
export const CART_EVENT = 'nexus-cart';

export function readSession(): { user: SessionUser | null; token: string | null } {
  if (typeof window === 'undefined') return { user: null, token: null };
  const token = localStorage.getItem('nexus_token');
  const raw = localStorage.getItem('nexus_user');
  if (!raw) return { user: null, token };
  try {
    const user = JSON.parse(raw) as SessionUser;
    if (!user?.id || (user.role !== 'admin' && user.role !== 'user')) {
      return { user: null, token };
    }
    return { user, token };
  } catch {
    return { user: null, token };
  }
}

export function notifySession() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EVENT));
}

export function notifyCart() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_EVENT));
}

export function onSessionChange(listener: () => void) {
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function saveSession(user: SessionUser, token: string = 'nexus_session_token') {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(user));
    notifySession();
  }
}

export function clearSession() {
  localStorage.removeItem('nexus_token');
  localStorage.removeItem('nexus_user');
  notifySession();
}

export async function verifySession() {
  const { token } = readSession();
  if (!token) return null;
  const res = await fetch('/api/v1/auth/me', { headers: headers(), cache: 'no-store' });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true || !payload.user?.id) {
    clearSession();
    return null;
  }
  localStorage.setItem('nexus_user', JSON.stringify(payload.user));
  notifySession();
  return payload.user as SessionUser;
}

function headers(): HeadersInit {
  const { user, token } = readSession();
  const result: Record<string, string> = {};
  if (token) result.Authorization = `Bearer ${token}`;
  if (user?.id) result['x-user-id'] = user.id;
  return result;
}

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

function errorMessage(payload: { error?: unknown } | null, fallback: string) {
  if (typeof payload?.error === 'string' && payload.error) return payload.error;
  if (payload?.error && typeof payload.error === 'object' && 'message' in payload.error) {
    const message = (payload.error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function asProduct(raw: unknown): CatalogProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const sku = typeof row.sku === 'string' ? row.sku : '';
  const title = typeof row.title === 'string' ? row.title : '';
  const price = row.priceCents ?? row.price_cents;
  if (!sku || !title || typeof price !== 'number') return null;
  return {
    sku,
    title,
    description: typeof row.description === 'string' ? row.description : '',
    priceCents: price,
  };
}

export function parseCatalog(payload: unknown): CatalogProduct[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as Record<string, unknown>;
  const data = body.data;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { products?: unknown[] }).products)
      ? (data as { products: unknown[] }).products
      : [];
  return rows.map(asProduct).filter((item): item is CatalogProduct => item !== null);
}

export type CatalogCategory =
  | 'baskets'
  | 'live-assets'
  | 'hardware'
  | 'workspace'
  | 'essentials'
  | 'crypto'
  | 'software'
  | 'subscription';

export type CatalogItem = CatalogProduct & {
  category: CatalogCategory;
  rail: 'stellar' | 'xrpl' | 'multi';
  rating: number;
  upvotes: number;
  tag: string;
  isLiveAsset?: boolean;
  isBasket?: boolean;
  allocations?: ProductAllocation[];
  priceInr?: number;
  change24hPercent?: number;
  oracleSource?: 'coingecko' | 'binance' | 'amm';
  priceUpdatedAt?: string;
};

export const FIGMA_CATALOG: CatalogItem[] = [
  // --- MODULE 2: MULTI-RAIL SMART BASKETS (LIVE ORACLE NAV) ---
  {
    sku: 'BASKET-INFLATION-SHIELD',
    title: 'Inflation Shield Basket',
    description: 'Cross-asset store-of-value combo: 0.50g 24K Gold (PAXG), 30 USDC reserve, and 20g Silver (KAG).',
    priceCents: 12227,
    priceInr: 11490,
    change24hPercent: 0.44,
    oracleSource: 'binance',
    isLiveAsset: true,
    isBasket: true,
    category: 'baskets',
    rail: 'stellar',
    rating: 5.0,
    upvotes: 640,
    tag: 'SMART BASKET • RWA HEDGE',
    allocations: [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 0.5, weightPercent: 50.6, valueCents: 6183 },
      { symbol: 'SILVER_G', label: 'Allocated Silver (KAG)', unitQty: 20, weightPercent: 24.9, valueCents: 3044 },
      { symbol: 'USDC', label: 'USDC Reserve', unitQty: 30, weightPercent: 24.5, valueCents: 3000 },
    ],
  },
  {
    sku: 'BASKET-DUAL-RAIL',
    title: 'Dual-Rail Flash Pack',
    description: 'Simultaneous XRPL + Stellar liquidity combo combining 25 XRP and 150 XLM at live multi-rail oracle spot pricing.',
    priceCents: 4494,
    priceInr: 4223,
    change24hPercent: 1.57,
    oracleSource: 'binance',
    isLiveAsset: true,
    isBasket: true,
    category: 'baskets',
    rail: 'multi',
    rating: 4.9,
    upvotes: 585,
    tag: 'SMART BASKET • XRPL + XLM',
    allocations: [
      { symbol: 'XRP', label: 'XRP (XRPL Native)', unitQty: 25, weightPercent: 53.5, valueCents: 2403 },
      { symbol: 'XLM', label: 'XLM (Stellar Native)', unitQty: 150, weightPercent: 46.5, valueCents: 2091 },
    ],
  },
  {
    sku: 'BASKET-AI-ALPHA',
    title: 'AI Dynamic Alpha Basket',
    description: 'Diversified combo pairing 0.40g Gold, 25 $NXL AMM Tokens, 15 XRP, and 100 XLM priced live every 60s.',
    priceCents: 10282,
    priceInr: 9662,
    change24hPercent: 0.78,
    oracleSource: 'binance',
    isLiveAsset: true,
    isBasket: true,
    category: 'baskets',
    rail: 'multi',
    rating: 5.0,
    upvotes: 720,
    tag: 'SMART BASKET • ALPHA',
    allocations: [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 0.4, weightPercent: 48.1, valueCents: 4946 },
      { symbol: 'NXL', label: '$NXL Protocol Token', unitQty: 25, weightPercent: 24.3, valueCents: 2500 },
      { symbol: 'XRP', label: 'XRP (XRPL Native)', unitQty: 15, weightPercent: 14.0, valueCents: 1442 },
      { symbol: 'XLM', label: 'XLM (Stellar Native)', unitQty: 100, weightPercent: 13.6, valueCents: 1394 },
    ],
  },
  // --- MODULE 2: LIVE RWA & PROTOCOL TOKENS ---
  {
    sku: 'NGOLD-1G',
    title: '1g 24K Digital Gold (nGOLD)',
    description: '1.00g allocated digital gold vault unit tracked directly to live PAXG USD & INR market feeds.',
    priceCents: 12366,
    priceInr: 11621,
    change24hPercent: 0.74,
    oracleSource: 'binance',
    isLiveAsset: true,
    isBasket: false,
    category: 'live-assets',
    rail: 'stellar',
    rating: 4.9,
    upvotes: 460,
    tag: 'LIVE ORACLE • 1G GOLD',
    allocations: [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 1, weightPercent: 100, valueCents: 12366 },
    ],
  },
  {
    sku: 'NSILVER-10G',
    title: '10g Digital Silver (nSILVER)',
    description: '10.00g tokenized physical silver bullion tracked directly to live KAG spot oracle feeds.',
    priceCents: 1522,
    priceInr: 1430,
    change24hPercent: 0,
    oracleSource: 'binance',
    isLiveAsset: true,
    isBasket: false,
    category: 'live-assets',
    rail: 'stellar',
    rating: 4.8,
    upvotes: 340,
    tag: 'LIVE ORACLE • 10G SILVER',
    allocations: [
      { symbol: 'SILVER_G', label: 'Allocated Silver (KAG)', unitQty: 10, weightPercent: 100, valueCents: 1522 },
    ],
  },
  {
    sku: 'NR-PACK-50',
    title: '50 $NXL Protocol Pack',
    description: 'Instant 50 $NXL token allocation priced live against the dual-rail AMM with 10% checkout utility.',
    priceCents: 5000,
    priceInr: 4699,
    change24hPercent: 0,
    oracleSource: 'amm',
    isLiveAsset: true,
    isBasket: false,
    category: 'live-assets',
    rail: 'multi',
    rating: 5.0,
    upvotes: 550,
    tag: 'AMM LIVE • 50 $NXL',
    allocations: [
      { symbol: 'NXL', label: '$NXL Protocol Token', unitQty: 50, weightPercent: 100, valueCents: 5000 },
    ],
  },
  // --- STELLAR SOROBAN PRODUCTS ---
  {
    sku: 'RAIL-ONE',
    title: 'Rail One (Stellar Signer)',
    description: 'Self-custody, beautifully offline. Dual-chip cold storage hardware signer with native Stellar Soroban key generation.',
    priceCents: 12788,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'hardware',
    rail: 'stellar',
    rating: 4.9,
    upvotes: 248,
    tag: 'STELLAR &bull; HARDWARE',
    allocations: [
      { symbol: 'USDC', label: 'Hardware Base', unitQty: 100, weightPercent: 78.2, valueCents: 10000 },
      { symbol: 'XLM', label: 'Stellar Stake', unitQty: 200, weightPercent: 21.8, valueCents: 2788 },
    ],
  },
  {
    sku: 'PROD-XLM-PASS',
    title: 'Stellar Soroban License Pass',
    description: 'Lifetime developer key for automated Soroban smart contract deployment suite and testnet RPC priority.',
    priceCents: 19788,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'workspace',
    rail: 'stellar',
    rating: 4.8,
    upvotes: 182,
    tag: 'STELLAR &bull; DEV PASS',
    allocations: [
      { symbol: 'USDC', label: 'Soroban License Base', unitQty: 170, weightPercent: 85.9, valueCents: 17000 },
      { symbol: 'XLM', label: 'Soroban Gas Reserve', unitQty: 200, weightPercent: 14.1, valueCents: 2788 },
    ],
  },
  {
    sku: 'PROD-AGENT-PRO',
    title: 'NexusRail AI Agent Desk Key',
    description: 'High-throughput Groq & Gemini agent desk license key with Redis proposal locks for Stellar state monitoring.',
    priceCents: 3000,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'workspace',
    rail: 'stellar',
    rating: 4.9,
    upvotes: 310,
    tag: 'STELLAR &bull; AI AGENT',
    allocations: [
      { symbol: 'USDC', label: 'AI Compute Quota', unitQty: 15, weightPercent: 50, valueCents: 1500 },
      { symbol: 'NXL', label: '$NXL Agent Credits', unitQty: 15, weightPercent: 50, valueCents: 1500 },
    ],
  },
  {
    sku: 'NODE-STAND',
    title: 'Node stand (Stellar Edition)',
    description: 'Built for a more considered desk. Precision CNC machined aluminum hardware dock with silicone cable channel.',
    priceCents: 5794,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'hardware',
    rail: 'stellar',
    rating: 4.7,
    upvotes: 112,
    tag: 'STELLAR &bull; ACCESSORY',
    allocations: [
      { symbol: 'USDC', label: 'CNC Hardware Base', unitQty: 44, weightPercent: 75.9, valueCents: 4400 },
      { symbol: 'XLM', label: 'Stellar Stake', unitQty: 100, weightPercent: 24.1, valueCents: 1394 },
    ],
  },

  // --- XRPL CONSENSUS PRODUCTS ---
  {
    sku: 'PROD-XRP-KIT',
    title: 'XRPL Starter Validator Node',
    description: 'Turnkey XRPL validator node hardware kit with pre-loaded ledger sync module and ripple bridge.',
    priceCents: 49612,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'hardware',
    rail: 'xrpl',
    rating: 4.9,
    upvotes: 194,
    tag: 'XRPL &bull; VALIDATOR',
    allocations: [
      { symbol: 'USDC', label: 'Validator Node Hardware', unitQty: 400, weightPercent: 80.6, valueCents: 40000 },
      { symbol: 'XRP', label: 'XRPL Validator Reserve', unitQty: 100, weightPercent: 19.4, valueCents: 9612 },
    ],
  },
  {
    sku: 'PROD-LEDGER-COLD',
    title: 'NexusRail XRPL Security Module',
    description: 'Dual-chip cold storage hardware signer with native XRPL key generation and destination tag tracking.',
    priceCents: 14884,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'hardware',
    rail: 'xrpl',
    rating: 4.8,
    upvotes: 165,
    tag: 'XRPL &bull; COLD SIGNER',
    allocations: [
      { symbol: 'USDC', label: 'HSM Hardware Base', unitQty: 120, weightPercent: 80.6, valueCents: 12000 },
      { symbol: 'XRP', label: 'XRPL Signer Reserve', unitQty: 30, weightPercent: 19.4, valueCents: 2884 },
    ],
  },
  {
    sku: 'RELAY-MAT',
    title: 'Relay desk mat (XRPL Edition)',
    description: 'A grounded space for your next move. High-density micro-weave workspace base with stitched non-fray edge.',
    priceCents: 3922,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'workspace',
    rail: 'xrpl',
    rating: 4.8,
    upvotes: 182,
    tag: 'XRPL &bull; WORKSPACE',
    allocations: [
      { symbol: 'USDC', label: 'Workspace Base', unitQty: 20, weightPercent: 51.0, valueCents: 2000 },
      { symbol: 'XRP', label: 'XRPL Fuel', unitQty: 20, weightPercent: 49.0, valueCents: 1922 },
    ],
  },
  {
    sku: 'RAIL-CABLES',
    title: 'Rail cable kit',
    description: 'One kit. Every connection. High-spec braided silicone USB-C custom engineered for zero-interference hardware signing.',
    priceCents: 2397,
    isLiveAsset: true,
    oracleSource: 'binance',
    category: 'hardware',
    rail: 'xrpl',
    rating: 4.9,
    upvotes: 88,
    tag: 'XRPL &bull; CABLES',
    allocations: [
      { symbol: 'USDC', label: 'Cable Kit Base', unitQty: 17, weightPercent: 70.9, valueCents: 1700 },
      { symbol: 'XLM', label: 'Stellar Stake', unitQty: 50, weightPercent: 29.1, valueCents: 697 },
    ],
  },

  // --- CROSS-RAIL EVERYDAY ESSENTIALS ---
  {
    sku: 'NEXUS-TEE',
    title: 'Nexus tee',
    description: 'A uniform for the onchain everyday. Heavyweight 240gsm organic combed cotton with custom tonal embroidery.',
    priceCents: 3200,
    isLiveAsset: true,
    oracleSource: 'amm',
    category: 'essentials',
    rail: 'multi',
    rating: 4.9,
    upvotes: 145,
    tag: 'CROSS-RAIL &bull; APPAREL',
    allocations: [
      { symbol: 'USDC', label: 'Apparel Base', unitQty: 22, weightPercent: 68.8, valueCents: 2200 },
      { symbol: 'NXL', label: '$NXL Protocol Stake', unitQty: 10, weightPercent: 31.2, valueCents: 1000 },
    ],
  },
  {
    sku: 'SIGNAL-CAP',
    title: 'Signal cap',
    description: 'Low profile. Clear signal. Structured 6-panel silhouette with subtle high-density micro-rail embroidery.',
    priceCents: 2800,
    isLiveAsset: true,
    oracleSource: 'amm',
    category: 'essentials',
    rail: 'multi',
    rating: 4.8,
    upvotes: 94,
    tag: 'CROSS-RAIL &bull; HEADWEAR',
    allocations: [
      { symbol: 'USDC', label: 'Headwear Base', unitQty: 18, weightPercent: 64.3, valueCents: 1800 },
      { symbol: 'NXL', label: '$NXL Protocol Stake', unitQty: 10, weightPercent: 35.7, valueCents: 1000 },
    ],
  },
];

const LOCAL_CART_KEY = 'nexus_local_cart';

function getLocalCart(): { sku: string; qty: number }[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCart(items: { sku: string; qty: number }[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
  notifyCart();
}

const CATALOG_STORAGE_KEY = 'nexus_products_catalog_cache_v3';
const CATALOG_CACHE_TTL_MS = 60 * 1000; // 60 seconds live oracle cache window

export interface CachedCatalogData {
  products: CatalogItem[];
  expiresAt: number;
  cachedAt: string;
  source: 'api' | 'cache';
}

export function getCachedCatalog(): CachedCatalogData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed: CachedCatalogData = JSON.parse(raw);
    if (parsed.expiresAt && parsed.expiresAt > Date.now() && Array.isArray(parsed.products) && parsed.products.length > 0) {
      return { ...parsed, source: 'cache' };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function fetchCatalog(forceRefresh = false): Promise<CatalogItem[]> {
  if (!forceRefresh) {
    const cached = getCachedCatalog();
    if (cached) return cached.products;
  }

  try {
    const res = await fetch(`/api/v1/products${forceRefresh ? '?refresh=true' : ''}`, { cache: 'no-store' });
    const payload = await readJson(res);
    if (res.ok && payload?.success === true && Array.isArray(payload.data)) {
      const items: CatalogItem[] = payload.data.map((doc: any) => ({
        sku: String(doc.sku),
        title: String(doc.title),
        description: String(doc.description || ''),
        priceCents: Number(doc.price_cents || doc.priceCents || 0),
        category: (doc.category as CatalogCategory) || 'hardware',
        rail: (doc.rail as any) || (doc.sku.includes('XRP') || doc.sku === 'RELAY-MAT' || doc.sku === 'PROD-LEDGER-COLD' ? 'xrpl' : doc.sku.includes('XLM') || doc.sku === 'RAIL-ONE' || doc.sku === 'NODE-STAND' || doc.sku === 'RAIL-CABLES' || doc.sku === 'PROD-AGENT-PRO' ? 'stellar' : 'multi'),
        tag: String(doc.tag || (doc.category === 'hardware' ? 'Hardware' : 'Official')),
        rating: Number(doc.rating || 4.9),
        upvotes: Number(doc.upvotes_count || doc.upvotes || 100),
        isLiveAsset: Boolean(doc.is_live_asset),
        isBasket: Boolean(doc.is_basket),
        allocations: Array.isArray(doc.allocations) ? doc.allocations : undefined,
        priceInr: typeof doc.price_inr === 'number' ? doc.price_inr : undefined,
        change24hPercent: typeof doc.change_24h_percent === 'number' ? doc.change_24h_percent : undefined,
        oracleSource: (doc.oracle_source === 'coingecko' || doc.oracle_source === 'binance' || doc.oracle_source === 'amm') ? doc.oracle_source : undefined,
        priceUpdatedAt: typeof doc.price_updated_at === 'string' ? doc.price_updated_at : undefined,
      }));

      if (items.length > 0) {
        if (typeof window !== 'undefined') {
          const cachePayload: CachedCatalogData = {
            products: items,
            expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
            cachedAt: new Date().toISOString(),
            source: 'api',
          };
          localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(cachePayload));
          window.dispatchEvent(new CustomEvent('nexus-catalog-updated', { detail: cachePayload }));
        }
        return items;
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not fetch product catalog from API, falling back:', err);
  }

  // Graceful fallback to stale cache or FIGMA_CATALOG if API is offline
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (raw) {
        const stale: CachedCatalogData = JSON.parse(raw);
        if (Array.isArray(stale.products) && stale.products.length > 0) return stale.products;
      }
    } catch {}
  }

  return FIGMA_CATALOG;
}

export async function fetchCartLines(): Promise<CartLine[]> {
  const catalog = await fetchCatalog().catch(() => FIGMA_CATALOG);
  const bySku = new Map(catalog.map((product) => [product.sku, product]));

  const { token } = readSession();
  if (token) {
    try {
      const cartRes = await fetch('/api/v1/cart', { headers: headers(), cache: 'no-store' });
      const payload = await readJson(cartRes);
      if (cartRes.ok && payload?.success === true && Array.isArray(payload?.data?.items)) {
        return payload.data.items
          .filter((item: { sku?: string; qty?: number }) => item?.sku && typeof item.qty === 'number' && item.qty > 0)
          .map((item: { sku: string; qty: number }) => {
            const product = bySku.get(item.sku);
            return {
              sku: item.sku,
              title: product?.title || item.sku,
              description: product?.description || '',
              priceCents: product?.priceCents || 0,
              qty: item.qty,
              priced: Boolean(product),
            };
          });
      }
    } catch {
      // fallback to local cart if api fails
    }
  }

  // Local storage cart fallback
  const localItems = getLocalCart();
  return localItems.map((item) => {
    const product = bySku.get(item.sku);
    return {
      sku: item.sku,
      title: product?.title || item.sku,
      description: product?.description || '',
      priceCents: product?.priceCents || 0,
      qty: item.qty,
      priced: Boolean(product),
    };
  });
}

export async function setCartQty(sku: string, qty: number) {
  const { token } = readSession();
  let serverUpdated = false;

  if (token) {
    try {
      const res = await fetch('/api/v1/cart/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ sku, qty }),
      });
      const payload = await readJson(res);
      if (res.ok && payload?.success === true) {
        serverUpdated = true;
      }
    } catch {
      // server down or offline
    }
  }

  // Always keep local cart in sync
  const local = getLocalCart();
  const existingIdx = local.findIndex((i) => i.sku === sku);
  if (qty <= 0) {
    if (existingIdx >= 0) local.splice(existingIdx, 1);
  } else {
    if (existingIdx >= 0) {
      local[existingIdx].qty = qty;
    } else {
      local.push({ sku, qty });
    }
  }
  setLocalCart(local);
  notifyCart();
}

export async function addSkuToCart(sku: string) {
  const current = await fetchCartLines().catch(() => [] as CartLine[]);
  const existing = current.find((line) => line.sku === sku);
  await setCartQty(sku, (existing?.qty || 0) + 1);
}

export async function removeCartSku(sku: string) {
  const { token } = readSession();
  if (token) {
    try {
      await fetch(`/api/v1/cart/items/${encodeURIComponent(sku)}`, {
        method: 'DELETE',
        headers: headers(),
      });
    } catch {
      // ignore server errors
    }
  }
  const local = getLocalCart().filter((i) => i.sku !== sku);
  setLocalCart(local);
  notifyCart();
}

export async function clearCart() {
  const { token } = readSession();
  if (token) {
    try {
      await fetch('/api/v1/cart', {
        method: 'DELETE',
        headers: headers(),
      });
    } catch {}
  }
  setLocalCart([]);
  notifyCart();
}

export async function startStripeCheckout(promoCode?: string) {
  const clientUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const res = await fetch('/api/v1/checkout/stripe/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ fromCart: true, clientUrl, ...(promoCode ? { promoCode } : {}) }),
  });
  const payload = await readJson(res);
  const url = payload?.data?.url;
  if (!res.ok || payload?.success !== true || typeof url !== 'string') {
    throw new Error(errorMessage(payload, 'Stripe did not return a checkout URL.'));
  }
  window.location.assign(url);
}

export interface CouponValidationData {
  valid: boolean;
  code: string;
  discountPercent: number;
  subtotalCents: number;
  discountCents: number;
  finalTotalCents: number;
  estimatedCashbackUsdCents: number;
  estimatedCashbackNxl: number;
  message: string;
}

export async function validateCouponApi(code: string, subtotalCents: number): Promise<CouponValidationData> {
  const res = await fetch('/api/v1/orders/validate-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ code, subtotalCents }),
  });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true || !payload?.data) {
    throw new Error(errorMessage(payload, 'Promo code could not be applied.'));
  }
  return payload.data as CouponValidationData;
}

export async function createOrderFromCart(lines: CartLine[], rail = 'MULTI', promoCode?: string) {
  try {
    const res = await fetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({
        rail,
        fromCart: true,
        ...(promoCode ? { promoCode } : {}),
        items: lines.map((line) => ({
          sku: line.sku,
          qty: line.qty,
          unitPriceCents: line.priceCents,
        })),
      }),
    });
    const payload = await readJson(res);
    const order = payload?.data?.order;
    if (res.ok && payload?.success === true && order?.id) {
      return order as { id: string; orderNumber: string; totalCents: number; items: { sku: string; qty: number }[] };
    }
  } catch {
    // fallback to demo order below
  }

  // Resilient fallback demo order creation with short, professional #NR8K2P9X format
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randCode = '';
  for (let i = 0; i < 6; i++) randCode += chars[Math.floor(Math.random() * chars.length)];
  const orderNumber = `#NR${randCode}`;
  const totalCents = lines.reduce((acc, line) => acc + line.priceCents * line.qty, 0);
  const demoOrder = {
    id: `ord_${orderNumber.toLowerCase()}`,
    orderNumber,
    totalCents,
    status: 'PENDING',
    rail,
    items: lines.map((line) => ({ sku: line.sku, title: line.title, qty: line.qty, unitPriceCents: line.priceCents })),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(`nexus_order_${demoOrder.id}`, JSON.stringify(demoOrder));
  }
  return demoOrder;
}

export async function fetchOrders() {
  const res = await fetch('/api/v1/orders', { headers: headers(), cache: 'no-store' });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true || !Array.isArray(payload?.data?.orders)) {
    throw new Error(errorMessage(payload, 'Could not load your orders.'));
  }

  return payload.data.orders as Array<{
    id: string;
    orderNumber?: string;
    status: string;
    totalCents?: number;
    cashbackUsdCents?: number;
    rail?: string;
    createdAt?: string;
    txHash?: string;
    ipfsHash?: string;
    underpaidCents?: number;
    items?: { sku?: string; title?: string; qty?: number; unit_price_cents?: number }[];
  }>;
}

export async function fetchGuideMessages(): Promise<GuideMessage[]> {
  const res = await fetch('/api/v1/guide/messages', { headers: headers(), cache: 'no-store' });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true || !Array.isArray(payload?.data?.messages)) {
    throw new Error(errorMessage(payload, 'Could not load the catalog guide.'));
  }
  return payload.data.messages.map((message: GuideMessage) => ({
    role: message.role,
    body: message.body,
    suggestedSkus: message.suggestedSkus || [],
  }));
}

export async function sendGuideMessage(message: string): Promise<GuideMessage[]> {
  const res = await fetch('/api/v1/guide/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ message }),
  });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true || !Array.isArray(payload?.data?.messages)) {
    throw new Error(errorMessage(payload, 'The catalog guide did not answer.'));
  }
  return payload.data.messages;
}

export type CommodityPrices = {
  goldUsd: number;
  goldInr: number;
  silverUsd: number;
  silverInr: number;
};

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseCommodityPrices(data: unknown): CommodityPrices | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, any>;
  const goldUsd = num(row.goldUsd ?? row.gold?.priceUsdPerGram);
  const goldInr = num(row.goldInr ?? row.gold?.priceInrPerGram);
  const silverUsd = num(row.silverUsd ?? row.silver?.priceUsdPerGram);
  const silverInr = num(row.silverInr ?? row.silver?.priceInrPerGram);
  if (goldUsd == null || goldInr == null || silverUsd == null || silverInr == null) return null;
  return { goldUsd, goldInr, silverUsd, silverInr };
}

export async function fetchCommodityPrices(): Promise<CommodityPrices> {
  const res = await fetch('/api/v1/rwa/live-prices', { cache: 'no-store' });
  const payload = await readJson(res);
  const prices = parseCommodityPrices(payload?.data);
  if (!res.ok || payload?.success !== true || !prices) {
    throw new Error(errorMessage(payload, 'Live gold and silver prices are unavailable.'));
  }
  return prices;
}

export async function issueCommodityToken(assetCode: 'nGOLD' | 'nSILVER', amountGrams: number) {
  const res = await fetch('/api/v1/rwa/issue-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ assetCode, amountGrams }),
  });
  const payload = await readJson(res);
  const data = payload?.data;
  const txHash = data?.txHash || data?.stellarTestnetTxHash;
  const explorerUrl = data?.explorerUrl || data?.stellarExplorerUrl;
  if (!res.ok || payload?.success !== true || !txHash || !explorerUrl) {
    throw new Error(errorMessage(payload, 'Token issuance did not return a network transaction.'));
  }
  return {
    assetCode: data.assetCode || assetCode,
    amountGrams: data.amountGrams || amountGrams,
    txHash: String(txHash),
    explorerUrl: String(explorerUrl),
  };
}

export async function resolveUnderpaidOrderApi(
  orderId: string,
  mode: 'TOPUP_USD' | 'TOPUP_NXL' | 'REFUND_ONCHAIN' | 'REFUND_WALLET'
): Promise<{ orderStatus: 'PAID' | 'REFUNDED'; message: string; refundTxHash?: string }> {
  const { token } = readSession();
  if (!token) throw new Error('Please sign in first.');
  const res = await fetch(`/api/v1/checkout/orders/${encodeURIComponent(orderId)}/resolve-underpaid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode }),
  });
  const payload = await readJson(res);
  if (!res.ok || !payload?.success) {
    throw new Error(errorMessage(payload, 'Could not complete order resolution.'));
  }
  return payload.data;
}
