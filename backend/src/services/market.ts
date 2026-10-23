const TROY_OUNCE_GRAMS = 31.1034768;

export type MetalQuote = {
  goldUsdPerGram: number;
  goldInrPerGram: number;
  silverUsdPerGram: number;
  silverInrPerGram: number;
  source: 'coingecko' | 'fallback';
  fromCache: boolean;
  fetchedAt: string;
};

export type FxQuote = {
  usd: 1;
  xrpUsd: number;
  xlmUsd: number;
  source: 'coingecko' | 'binance' | 'fallback';
  fromCache: boolean;
  fetchedAt: string;
};

// In-memory cache with 60-second TTL
let metalCache: { data: MetalQuote; expiresAt: number } | null = null;
let fxCache: { data: FxQuote; expiresAt: number } | null = null;

// In-flight promise deduplication
let metalPendingPromise: Promise<MetalQuote> | null = null;
let fxPendingPromise: Promise<FxQuote> | null = null;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache window

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      if (res.status === 429 && attempt < retries) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw new Error(`Failed to fetch from ${url}`);
}

async function coingecko(query: string): Promise<any> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  const res = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?${query}`, headers);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`CoinGecko returned ${res.status}: ${detail.slice(0, 120)}`);
  }
  return res.json();
}

function perGram(ouncePrice: number): number {
  return Number((ouncePrice / TROY_OUNCE_GRAMS).toFixed(4));
}

export async function getMetalQuote(): Promise<MetalQuote> {
  const now = Date.now();
  if (metalCache && metalCache.expiresAt > now) {
    return { ...metalCache.data, fromCache: true };
  }

  if (metalPendingPromise) return metalPendingPromise;

  metalPendingPromise = (async () => {
    try {
      const data = await coingecko('ids=pax-gold,kinesis-silver&vs_currencies=usd,inr');
      const goldUsd = data?.['pax-gold']?.usd;
      const goldInr = data?.['pax-gold']?.inr;
      const silverUsd = data?.['kinesis-silver']?.usd;
      const silverInr = data?.['kinesis-silver']?.inr;

      if ([goldUsd, goldInr, silverUsd, silverInr].some((value) => typeof value !== 'number')) {
        throw new Error('CoinGecko metal response did not include usd and inr prices');
      }

      const quote: MetalQuote = {
        goldUsdPerGram: perGram(goldUsd),
        goldInrPerGram: perGram(goldInr),
        silverUsdPerGram: perGram(silverUsd),
        silverInrPerGram: perGram(silverInr),
        source: 'coingecko',
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };

      metalCache = { data: quote, expiresAt: now + CACHE_TTL_MS };
      return quote;
    } catch (error) {
      if (metalCache) return { ...metalCache.data, fromCache: true };
      // Fallback baseline for commodity test quoting
      return {
        goldUsdPerGram: 88.50,
        goldInrPerGram: 7420.00,
        silverUsdPerGram: 1.05,
        silverInrPerGram: 88.00,
        source: 'fallback',
        fromCache: true,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      metalPendingPromise = null;
    }
  })();

  return metalPendingPromise;
}

export async function getFxQuote(): Promise<FxQuote> {
  const now = Date.now();
  if (fxCache && fxCache.expiresAt > now) {
    return { ...fxCache.data, fromCache: true };
  }

  if (fxPendingPromise) return fxPendingPromise;

  fxPendingPromise = (async () => {
    try {
      const data = await coingecko('ids=ripple,stellar&vs_currencies=usd');
      const xrpUsd = data?.ripple?.usd;
      const xlmUsd = data?.stellar?.usd;

      if (typeof xrpUsd !== 'number' || typeof xlmUsd !== 'number') {
        throw new Error('CoinGecko did not return XRP and XLM usd prices');
      }

      const quote: FxQuote = {
        usd: 1,
        xrpUsd,
        xlmUsd,
        source: 'coingecko',
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };

      fxCache = { data: quote, expiresAt: now + CACHE_TTL_MS };
      return quote;
    } catch (error) {
      if (fxCache) return { ...fxCache.data, fromCache: true };

      // Secondary fallback to public Binance ticker API
      try {
        const [xrpRes, xlmRes] = await Promise.all([
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT').then((r) => r.json()),
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT').then((r) => r.json()),
        ]);
        const xrpUsd = parseFloat(xrpRes.price);
        const xlmUsd = parseFloat(xlmRes.price);
        if (Number.isFinite(xrpUsd) && Number.isFinite(xlmUsd)) {
          const quote: FxQuote = {
            usd: 1,
            xrpUsd,
            xlmUsd,
            source: 'binance',
            fromCache: false,
            fetchedAt: new Date().toISOString(),
          };
          fxCache = { data: quote, expiresAt: now + CACHE_TTL_MS };
          return quote;
        }
      } catch {
        // Continue to baseline fallback
      }

      // Safe baseline fallback so checkout invoices never crash on rate limits
      return {
        usd: 1,
        xrpUsd: 1.2972,
        xlmUsd: 0.1778,
        source: 'fallback',
        fromCache: true,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      fxPendingPromise = null;
    }
  })();

  return fxPendingPromise;
}

export async function usdCentsToAsset(cents: number, asset: 'XRP' | 'XLM'): Promise<number> {
  const fx = await getFxQuote();
  const usd = cents / 100;
  const price = asset === 'XRP' ? fx.xrpUsd : fx.xlmUsd;
  if (price <= 0) throw new Error(`Non-positive price for ${asset}`);
  return Number((usd / price).toFixed(6));
}
