export type SessionUser = {
  id: string;
  email?: string;
  walletAddress?: string;
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

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const res = await fetch('/api/v1/products', { cache: 'no-store' });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true) throw new Error(errorMessage(payload, 'Catalog is unavailable.'));
  return parseCatalog(payload);
}

export async function fetchCartLines(): Promise<CartLine[]> {
  const [cartRes, catalog] = await Promise.all([
    fetch('/api/v1/cart', { headers: headers(), cache: 'no-store' }),
    fetchCatalog().catch(() => [] as CatalogProduct[]),
  ]);
  const payload = await readJson(cartRes);
  if (!cartRes.ok || payload?.success !== true || !Array.isArray(payload?.data?.items)) {
    throw new Error(errorMessage(payload, 'Could not load your cart.'));
  }
  const bySku = new Map(catalog.map((product) => [product.sku, product]));
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

export async function setCartQty(sku: string, qty: number) {
  const res = await fetch('/api/v1/cart/items', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ sku, qty }),
  });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true) {
    throw new Error(errorMessage(payload, 'Could not update the cart.'));
  }
  notifyCart();
}

export async function addSkuToCart(sku: string) {
  const current = await fetchCartLines().catch(() => [] as CartLine[]);
  const existing = current.find((line) => line.sku === sku);
  await setCartQty(sku, (existing?.qty || 0) + 1);
}

export async function removeCartSku(sku: string) {
  const res = await fetch(`/api/v1/cart/items/${encodeURIComponent(sku)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true) {
    throw new Error(errorMessage(payload, 'Could not remove that item.'));
  }
  notifyCart();
}

export async function startStripeCheckout() {
  const res = await fetch('/api/v1/checkout/stripe/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ fromCart: true }),
  });
  const payload = await readJson(res);
  const url = payload?.data?.url;
  if (!res.ok || payload?.success !== true || typeof url !== 'string') {
    throw new Error(errorMessage(payload, 'Stripe did not return a checkout URL.'));
  }
  window.location.assign(url);
}

export async function createOrderFromCart(lines: CartLine[], rail = 'MULTI') {
  const res = await fetch('/api/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({
      rail,
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
    throw new Error(errorMessage(payload, 'Could not create the order.'));
  }
  return order as { id: string; orderNumber: string; totalCents: number; items: { sku: string; qty: number }[] };
}

export async function fetchOrders() {
  const res = await fetch('/api/v1/orders', { headers: headers(), cache: 'no-store' });
  const payload = await readJson(res);
  if (!res.ok || payload?.success !== true || !Array.isArray(payload?.data?.orders)) {
    throw new Error(errorMessage(payload, 'Could not load orders.'));
  }
  return payload.data.orders as Array<{
    id: string;
    orderNumber?: string;
    status: string;
    totalCents?: number;
    rail?: string;
    createdAt?: string;
    ipfsHash?: string;
    items?: { sku?: string; title?: string; qty?: number }[];
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

export type PerpQuote = {
  pair: string;
  leverage: number;
  indexPrice: number;
  sizeUsd: number;
  marginUsd: number;
  liquidationPrice: number;
};

export async function fetchPerpQuote(pair: string, leverage: number, size: string): Promise<PerpQuote> {
  const params = new URLSearchParams({ pair, leverage: String(leverage), size });
  const res = await fetch(`/api/v1/rwa-modular/perps/quote?${params.toString()}`, { cache: 'no-store' });
  const payload = await readJson(res);
  const data = payload?.data;
  const indexPrice = num(data?.indexPriceUsd ?? data?.spotPrice ?? data?.entryPriceUsd);
  const marginUsd = num(data?.marginUsd ?? data?.requiredMarginUsd);
  const liquidationPrice = num(data?.liquidationPrice ?? data?.liquidationPriceUsd);
  const sizeUsd = num(data?.sizeUsd) ?? num(Number(size));
  if (!res.ok || payload?.success !== true || indexPrice == null || marginUsd == null || liquidationPrice == null || sizeUsd == null) {
    throw new Error(errorMessage(payload, 'Could not load a price quote.'));
  }
  return {
    pair: data.pair || pair,
    leverage: data.leverage || leverage,
    indexPrice,
    sizeUsd,
    marginUsd,
    liquidationPrice,
  };
}
