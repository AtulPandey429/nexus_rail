const TROY_OUNCE_GRAMS = 31.1034768;

export type MetalQuote = {
  goldUsdPerGram: number;
  goldInrPerGram: number;
  gold24hChange?: number;
  silverUsdPerGram: number;
  silverInrPerGram: number;
  silver24hChange?: number;
  usdInrRate?: number;
  source: 'binance' | 'coingecko';
  fromCache: boolean;
  fetchedAt: string;
};

export type FxQuote = {
  usd: 1;
  xrpUsd: number;
  xlmUsd: number;
  xrp24hChange?: number;
  xlm24hChange?: number;
  source: 'binance' | 'coingecko';
  fromCache: boolean;
  fetchedAt: string;
};

export interface ExtendedMarketSnapshot {
  goldUsdPerGram: number;
  goldInrPerGram: number;
  gold24hChange: number;
  silverUsdPerGram: number;
  silverInrPerGram: number;
  silver24hChange: number;
  xrpUsd: number;
  xrp24hChange: number;
  xlmUsd: number;
  xlm24hChange: number;
  usdInrRate: number;
  source: 'binance' | 'coingecko';
  fetchedAt: string;
}

// In-memory cache with 60-second live oracle TTL
let metalCache: { data: MetalQuote; expiresAt: number } | null = null;
let fxCache: { data: FxQuote; expiresAt: number } | null = null;

// In-flight promise deduplication
let metalPendingPromise: Promise<MetalQuote> | null = null;
let fxPendingPromise: Promise<FxQuote> | null = null;

const CACHE_TTL_MS = 60 * 1000; // 60 seconds live cache window

async function fetchJson<T = any>(url: string, headers: Record<string, string> = { accept: 'application/json' }, retries = 1): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} from ${url}: ${detail.slice(0, 120)}`);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Failed to fetch from ${url}`);
}

async function coingecko(query: string): Promise<any> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  return fetchJson(`https://api.coingecko.com/api/v3/simple/price?${query}`, headers, 1);
}

function perGram(ouncePrice: number): number {
  return Number((ouncePrice / TROY_OUNCE_GRAMS).toFixed(4));
}

function roundChange(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) ? Number(val.toFixed(2)) : 0;
}

export async function getMetalQuote(forceRefresh = false): Promise<MetalQuote> {
  const now = Date.now();
  if (!forceRefresh && metalCache && metalCache.expiresAt > now) {
    return { ...metalCache.data, fromCache: true };
  }

  if (!forceRefresh && metalPendingPromise) return metalPendingPromise;

  metalPendingPromise = (async () => {
    try {
      // 1. Primary Live Exchange Oracle: Binance PAXGUSDT + Gold-API XAU/XAG + Coinbase USD/INR
      const [paxgRes, xagRes, cbRes] = await Promise.allSettled([
        fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT'),
        fetchJson('https://api.gold-api.com/price/XAG'),
        fetchJson('https://api.coinbase.com/v2/exchange-rates?currency=USD'),
      ]);

      let goldOzUsd = paxgRes.status === 'fulfilled' ? parseFloat(paxgRes.value?.lastPrice ?? paxgRes.value?.price) : NaN;
      let gold24hChange = paxgRes.status === 'fulfilled' ? roundChange(parseFloat(paxgRes.value?.priceChangePercent)) : 0;
      const silverOzUsd = xagRes.status === 'fulfilled' ? Number(xagRes.value?.price) : NaN;
      const usdInrRate = cbRes.status === 'fulfilled' ? parseFloat(cbRes.value?.data?.rates?.INR) : NaN;

      if (!Number.isFinite(goldOzUsd) || goldOzUsd <= 0) {
        const xauRes = await fetchJson('https://api.gold-api.com/price/XAU');
        goldOzUsd = Number(xauRes?.price);
      }

      if (Number.isFinite(goldOzUsd) && goldOzUsd > 0 && Number.isFinite(silverOzUsd) && silverOzUsd > 0 && Number.isFinite(usdInrRate) && usdInrRate > 0) {
        const goldUsdPerGram = perGram(goldOzUsd);
        const silverUsdPerGram = perGram(silverOzUsd);
        const quote: MetalQuote = {
          goldUsdPerGram,
          goldInrPerGram: Number((goldUsdPerGram * usdInrRate).toFixed(2)),
          gold24hChange,
          silverUsdPerGram,
          silverInrPerGram: Number((silverUsdPerGram * usdInrRate).toFixed(2)),
          silver24hChange: 0,
          usdInrRate: Number(usdInrRate.toFixed(4)),
          source: 'binance',
          fromCache: false,
          fetchedAt: new Date().toISOString(),
        };
        metalCache = { data: quote, expiresAt: Date.now() + CACHE_TTL_MS };
        return quote;
      }

      // 2. Secondary Live Exchange Oracle: CoinGecko PAXG + KAG
      const data = await coingecko('ids=pax-gold,kinesis-silver&vs_currencies=usd,inr&include_24hr_change=true');
      const goldUsd = data?.['pax-gold']?.usd;
      const goldInr = data?.['pax-gold']?.inr;
      const silverUsd = data?.['kinesis-silver']?.usd;
      const silverInr = data?.['kinesis-silver']?.inr;

      if ([goldUsd, goldInr, silverUsd, silverInr].some((value) => typeof value !== 'number' || value <= 0)) {
        throw new Error('CoinGecko metal response did not include valid live USD/INR prices');
      }

      const quote: MetalQuote = {
        goldUsdPerGram: perGram(goldUsd),
        goldInrPerGram: perGram(goldInr),
        gold24hChange: roundChange(data?.['pax-gold']?.usd_24h_change),
        silverUsdPerGram: perGram(silverUsd),
        silverInrPerGram: perGram(silverInr),
        silver24hChange: roundChange(data?.['kinesis-silver']?.usd_24h_change),
        usdInrRate: Number((goldInr / goldUsd).toFixed(4)),
        source: 'coingecko',
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };

      metalCache = { data: quote, expiresAt: Date.now() + CACHE_TTL_MS };
      return quote;
    } catch (error) {
      if (metalCache) return { ...metalCache.data, fromCache: true };
      throw error instanceof Error ? error : new Error('Live metal oracle feeds unreachable');
    } finally {
      metalPendingPromise = null;
    }
  })();

  return metalPendingPromise;
}

export async function getFxQuote(forceRefresh = false): Promise<FxQuote> {
  const now = Date.now();
  if (!forceRefresh && fxCache && fxCache.expiresAt > now) {
    return { ...fxCache.data, fromCache: true };
  }

  if (!forceRefresh && fxPendingPromise) return fxPendingPromise;

  fxPendingPromise = (async () => {
    try {
      // 1. Primary Live Exchange Oracle: Binance 24hr Ticker API (low latency, high quota)
      try {
        const [xrpRes, xlmRes] = await Promise.all([
          fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT'),
          fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=XLMUSDT'),
        ]);
        const xrpUsd = parseFloat(xrpRes.lastPrice ?? xrpRes.price);
        const xlmUsd = parseFloat(xlmRes.lastPrice ?? xlmRes.price);
        if (Number.isFinite(xrpUsd) && Number.isFinite(xlmUsd) && xrpUsd > 0 && xlmUsd > 0) {
          const quote: FxQuote = {
            usd: 1,
            xrpUsd,
            xlmUsd,
            xrp24hChange: roundChange(parseFloat(xrpRes.priceChangePercent)),
            xlm24hChange: roundChange(parseFloat(xlmRes.priceChangePercent)),
            source: 'binance',
            fromCache: false,
            fetchedAt: new Date().toISOString(),
          };
          fxCache = { data: quote, expiresAt: Date.now() + CACHE_TTL_MS };
          return quote;
        }
      } catch {
        // Fall through to live CoinGecko API
      }

      // 2. Secondary Live Exchange Oracle: CoinGecko API
      const data = await coingecko('ids=ripple,stellar&vs_currencies=usd&include_24hr_change=true');
      const xrpUsd = data?.ripple?.usd;
      const xlmUsd = data?.stellar?.usd;

      if (typeof xrpUsd !== 'number' || typeof xlmUsd !== 'number' || xrpUsd <= 0 || xlmUsd <= 0) {
        throw new Error('Live FX oracle did not return valid XRP and XLM prices');
      }

      const quote: FxQuote = {
        usd: 1,
        xrpUsd,
        xlmUsd,
        xrp24hChange: roundChange(data?.ripple?.usd_24h_change),
        xlm24hChange: roundChange(data?.stellar?.usd_24h_change),
        source: 'coingecko',
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };

      fxCache = { data: quote, expiresAt: Date.now() + CACHE_TTL_MS };
      return quote;
    } catch (error) {
      if (fxCache) return { ...fxCache.data, fromCache: true };
      throw error instanceof Error ? error : new Error('Live FX oracle feeds unreachable');
    } finally {
      fxPendingPromise = null;
    }
  })();

  return fxPendingPromise;
}

export async function getExtendedMarketSnapshot(forceRefresh = false): Promise<ExtendedMarketSnapshot> {
  const [metal, fx] = await Promise.all([
    getMetalQuote(forceRefresh),
    getFxQuote(forceRefresh),
  ]);

  const usdInrRate =
    metal.usdInrRate && metal.usdInrRate > 0
      ? metal.usdInrRate
      : Number((metal.goldInrPerGram / metal.goldUsdPerGram).toFixed(4));

  const source: 'binance' | 'coingecko' =
    metal.source === 'coingecko' && fx.source === 'coingecko' ? 'coingecko' : 'binance';

  return {
    goldUsdPerGram: metal.goldUsdPerGram,
    goldInrPerGram: metal.goldInrPerGram,
    gold24hChange: metal.gold24hChange ?? 0,
    silverUsdPerGram: metal.silverUsdPerGram,
    silverInrPerGram: metal.silverInrPerGram,
    silver24hChange: metal.silver24hChange ?? 0,
    xrpUsd: fx.xrpUsd,
    xrp24hChange: fx.xrp24hChange ?? 0,
    xlmUsd: fx.xlmUsd,
    xlm24hChange: fx.xlm24hChange ?? 0,
    usdInrRate,
    source,
    fetchedAt: fx.fetchedAt || metal.fetchedAt,
  };
}

export async function usdCentsToAsset(cents: number, asset: 'XRP' | 'XLM'): Promise<number> {
  const fx = await getFxQuote();
  const usd = cents / 100;
  const price = asset === 'XRP' ? fx.xrpUsd : fx.xlmUsd;
  if (price <= 0) throw new Error(`Non-positive price for ${asset}`);
  return Number((usd / price).toFixed(6));
}
