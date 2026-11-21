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

  let fetchError: unknown = null;
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

      if (typeof window !== 'undefined' && items.length > 0) {
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
    fetchError = new Error(errorMessage(payload, 'Could not load the product catalog.'));
  } catch (err) {
    fetchError = err;
  }

  // Serve the last known-good catalog fetched from the API (never fabricated data).
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (raw) {
        const stale: CachedCatalogData = JSON.parse(raw);
        if (Array.isArray(stale.products) && stale.products.length > 0) return stale.products;
      }
    } catch {}
  }

  throw fetchError instanceof Error ? fetchError : new Error('Could not load the product catalog.');
}

export async function fetchCartLines(): Promise<CartLine[]> {
  const catalog = await fetchCatalog();
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
  if (!res.ok || payload?.success !== true || !order?.id) {
    throw new Error(errorMessage(payload, 'Could not create your order. Please try again.'));
  }
  return order as { id: string; orderNumber: string; totalCents: number; items: { sku: string; qty: number }[] };
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
