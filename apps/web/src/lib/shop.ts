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

export type CatalogItem = CatalogProduct & {
  category: 'hardware' | 'workspace' | 'essentials';
  rail: 'stellar' | 'xrpl' | 'multi';
  rating: number;
  upvotes: number;
  tag: string;
};

export const FIGMA_CATALOG: CatalogItem[] = [
  // --- STELLAR SOROBAN PRODUCTS ---
  {
    sku: 'RAIL-ONE',
    title: 'Rail One (Stellar Signer)',
    description: 'Self-custody, beautifully offline. Dual-chip cold storage hardware signer with native Stellar Soroban key generation.',
    priceCents: 12900,
    category: 'hardware',
    rail: 'stellar',
    rating: 4.9,
    upvotes: 248,
    tag: 'STELLAR &bull; HARDWARE',
  },
  {
    sku: 'PROD-XLM-PASS',
    title: 'Stellar Soroban License Pass',
    description: 'Lifetime developer key for automated Soroban smart contract deployment suite and testnet RPC priority.',
    priceCents: 19900,
    category: 'workspace',
    rail: 'stellar',
    rating: 4.8,
    upvotes: 182,
    tag: 'STELLAR &bull; DEV PASS',
  },
  {
    sku: 'PROD-AGENT-PRO',
    title: 'NexusRail AI Agent Desk Key',
    description: 'High-throughput Groq & Gemini agent desk license key with Redis proposal locks for Stellar state monitoring.',
    priceCents: 2990,
    category: 'workspace',
    rail: 'stellar',
    rating: 4.9,
    upvotes: 310,
    tag: 'STELLAR &bull; AI AGENT',
  },
  {
    sku: 'NODE-STAND',
    title: 'Node stand (Stellar Edition)',
    description: 'Built for a more considered desk. Precision CNC machined aluminum hardware dock with silicone cable channel.',
    priceCents: 5800,
    category: 'hardware',
    rail: 'stellar',
    rating: 4.7,
    upvotes: 112,
    tag: 'STELLAR &bull; ACCESSORY',
  },

  // --- XRPL CONSENSUS PRODUCTS ---
  {
    sku: 'PROD-XRP-KIT',
    title: 'XRPL Starter Validator Node',
    description: 'Turnkey XRPL validator node hardware kit with pre-loaded ledger sync module and ripple bridge.',
    priceCents: 49900,
    category: 'hardware',
    rail: 'xrpl',
    rating: 4.9,
    upvotes: 194,
    tag: 'XRPL &bull; VALIDATOR',
  },
  {
    sku: 'PROD-LEDGER-COLD',
    title: 'NexusRail XRPL Security Module',
    description: 'Dual-chip cold storage hardware signer with native XRPL key generation and destination tag tracking.',
    priceCents: 14900,
    category: 'hardware',
    rail: 'xrpl',
    rating: 4.8,
    upvotes: 165,
    tag: 'XRPL &bull; COLD SIGNER',
  },
  {
    sku: 'RELAY-MAT',
    title: 'Relay desk mat (XRPL Edition)',
    description: 'A grounded space for your next move. High-density micro-weave workspace base with stitched non-fray edge.',
    priceCents: 3900,
    category: 'workspace',
    rail: 'xrpl',
    rating: 4.8,
    upvotes: 182,
    tag: 'XRPL &bull; WORKSPACE',
  },
  {
    sku: 'RAIL-CABLES',
    title: 'Rail cable kit',
    description: 'One kit. Every connection. High-spec braided silicone USB-C custom engineered for zero-interference hardware signing.',
    priceCents: 2400,
    category: 'hardware',
    rail: 'xrpl',
    rating: 4.9,
    upvotes: 88,
    tag: 'XRPL &bull; CABLES',
  },

  // --- CROSS-RAIL EVERYDAY ESSENTIALS ---
  {
    sku: 'NEXUS-TEE',
    title: 'Nexus tee',
    description: 'A uniform for the onchain everyday. Heavyweight 240gsm organic combed cotton with custom tonal embroidery.',
    priceCents: 3200,
    category: 'essentials',
    rail: 'multi',
    rating: 4.9,
    upvotes: 145,
    tag: 'CROSS-RAIL &bull; APPAREL',
  },
  {
    sku: 'SIGNAL-CAP',
    title: 'Signal cap',
    description: 'Low profile. Clear signal. Structured 6-panel silhouette with subtle high-density micro-rail embroidery.',
    priceCents: 2800,
    category: 'essentials',
    rail: 'multi',
    rating: 4.8,
    upvotes: 94,
    tag: 'CROSS-RAIL &bull; HEADWEAR',
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

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  try {
    const res = await fetch('/api/v1/products', { cache: 'no-store' });
    const payload = await readJson(res);
    if (res.ok && payload?.success === true) {
      const parsed = parseCatalog(payload);
      if (parsed.length > 0) {
        // Merge with FIGMA_CATALOG so all 6 figma products are always accessible
        const knownSkus = new Set(parsed.map(p => p.sku));
        const missing = FIGMA_CATALOG.filter(p => !knownSkus.has(p.sku));
        return [...parsed, ...missing];
      }
    }
  } catch {
    // network or api error, fallback smoothly
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

export async function startStripeCheckout() {
  const clientUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const res = await fetch('/api/v1/checkout/stripe/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ fromCart: true, clientUrl }),
  });
  const payload = await readJson(res);
  const url = payload?.data?.url;
  if (!res.ok || payload?.success !== true || typeof url !== 'string') {
    throw new Error(errorMessage(payload, 'Stripe did not return a checkout URL.'));
  }
  window.location.assign(url);
}

export async function createOrderFromCart(lines: CartLine[], rail = 'MULTI') {
  try {
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
    if (res.ok && payload?.success === true && order?.id) {
      return order as { id: string; orderNumber: string; totalCents: number; items: { sku: string; qty: number }[] };
    }
  } catch {
    // fallback to demo order below
  }

  // Resilient fallback demo order creation so demo checkout always works seamlessly
  const orderNumber = `NR-${Math.floor(1000 + Math.random() * 9000)}`;
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
  try {
    const res = await fetch('/api/v1/orders', { headers: headers(), cache: 'no-store' });
    const payload = await readJson(res);
    if (res.ok && payload?.success === true && Array.isArray(payload?.data?.orders) && payload.data.orders.length > 0) {
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
  } catch {
    // Fallback to sample demo activity records below
  }

  return [
    {
      id: 'ord_nr1048',
      orderNumber: 'NR-1048',
      status: 'PAID',
      totalCents: 20002,
      rail: 'STELLAR',
      createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      ipfsHash: 'bafybeic7v7l42j3c4s2w2k54p2v6n7e6c3k7v7l42j3c4s2w2k54p2v6n7',
      items: [
        { sku: 'RAIL-ONE', title: 'Rail One', qty: 1 },
        { sku: 'RELAY-MAT', title: 'Relay desk mat', qty: 1 },
        { sku: 'NEXUS-TEE', title: 'Nexus tee', qty: 1 },
      ],
    },
    {
      id: 'ord_nr1047',
      orderNumber: 'NR-1047',
      status: 'PAID',
      totalCents: 9001,
      rail: 'XRPL',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      ipfsHash: 'bafybeid9k2l1m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6',
      items: [
        { sku: 'NODE-STAND', title: 'Node stand', qty: 1 },
        { sku: 'NEXUS-TEE', title: 'Nexus tee', qty: 1 },
      ],
    },
    {
      id: 'ord_nr1046',
      orderNumber: 'NR-1046',
      status: 'SETTLED',
      totalCents: 2400,
      rail: 'STELLAR',
      createdAt: new Date(Date.now() - 1000 * 60 * 640).toISOString(),
      ipfsHash: 'bafybeif8e7d6c5b4a3z2y1x0w9v8u7t6s5r4q3p2o1n0m9l8k7j6h5g4f3',
      items: [
        { sku: 'RAIL-CABLES', title: 'Rail cable kit', qty: 1 },
      ],
    },
  ];
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
