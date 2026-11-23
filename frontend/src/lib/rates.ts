// ============================================================================
// NexusRail Live FX & Rates Oracle Engine
// Fetches live testnet/mainnet rates with strict 30-minute client caching
// ============================================================================

import { useEffect, useState, useCallback } from 'react';

export interface ExchangeRatesData {
  xlmUsd: number;
  xrpUsd: number;
  xlm24hChange?: number;
  xrp24hChange?: number;
  goldUsdPerGram?: number | null;
  gold24hChange?: number | null;
  silverUsdPerGram?: number | null;
  silver24hChange?: number | null;
  usdInrRate?: number | null;
  source: 'nexus-api' | 'binance' | 'coingecko' | 'cache';
  fromCache: boolean;
  fetchedAt: string;
  expiresAt: number; // Unix timestamp in ms (30 mins from fetch)
  ttlMinutesRemaining: number;
}

const RATES_STORAGE_KEY = 'nexus_fx_rates_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache window

const BINANCE_API_URL = process.env.NEXT_PUBLIC_BINANCE_API_URL || 'https://api.binance.com';
const KRAKEN_API_URL = process.env.NEXT_PUBLIC_KRAKEN_API_URL || 'https://api.kraken.com';
const COINBASE_API_URL = process.env.NEXT_PUBLIC_COINBASE_API_URL || 'https://api.coinbase.com';
const COINGECKO_API_URL = process.env.NEXT_PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com';

let inFlightPromise: Promise<ExchangeRatesData> | null = null;

/**
 * Read cached rates from localStorage if not expired
 */
function getCachedRates(): ExchangeRatesData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed: ExchangeRatesData = JSON.parse(raw);
    const now = Date.now();
    if (parsed.expiresAt && parsed.expiresAt > now && parsed.xlmUsd > 0 && parsed.xrpUsd > 0) {
      return {
        ...parsed,
        fromCache: true,
        ttlMinutesRemaining: Math.max(1, Math.round((parsed.expiresAt - now) / 60000)),
      };
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

/**
 * Save rates to localStorage with 30-minute expiration
 */
function setCachedRates(rates: ExchangeRatesData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
    // Dispatch custom event to sync all tabs and components
    window.dispatchEvent(new CustomEvent('nexus-rates-updated', { detail: rates }));
  } catch {
    // Ignore storage quota
  }
}

/**
 * Fetch live rates from Backend API, with fast fallback to Binance / CoinGecko
 */
export async function fetchLiveRates(forceRefresh = false): Promise<ExchangeRatesData> {
  if (!forceRefresh) {
    const cached = getCachedRates();
    if (cached) return cached;
  }

  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = (async () => {
    const now = Date.now();
    const expiresAt = now + CACHE_TTL_MS;

    // 1. Try Backend API first (/api/v1/crypto/rates)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for cold start
      const res = await fetch('/api/v1/crypto/rates', { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data?.XLM && json?.data?.XRP) {
          const rates: ExchangeRatesData = {
            xlmUsd: Number(json.data.XLM),
            xrpUsd: Number(json.data.XRP),
            xlm24hChange: typeof json.data.xlm24hChange === 'number' ? json.data.xlm24hChange : undefined,
            xrp24hChange: typeof json.data.xrp24hChange === 'number' ? json.data.xrp24hChange : undefined,
            goldUsdPerGram: typeof json.data.goldUsdPerGram === 'number' ? json.data.goldUsdPerGram : null,
            gold24hChange: typeof json.data.gold24hChange === 'number' ? json.data.gold24hChange : null,
            silverUsdPerGram: typeof json.data.silverUsdPerGram === 'number' ? json.data.silverUsdPerGram : null,
            silver24hChange: typeof json.data.silver24hChange === 'number' ? json.data.silver24hChange : null,
            usdInrRate: typeof json.data.usdInrRate === 'number' ? json.data.usdInrRate : null,
            source: 'nexus-api',
            fromCache: false,
            fetchedAt: json.data.timestamp || new Date().toISOString(),
            expiresAt,
            ttlMinutesRemaining: 30,
          };
          setCachedRates(rates);
          return rates;
        }
      }
    } catch {
      // Backend may be waking up on Render, fallback to Binance
    }

    // 2. Direct Binance Public Ticker API Fallback
    try {
      const [xlmRes, xrpRes] = await Promise.all([
        fetch(`${BINANCE_API_URL}/api/v3/ticker/price?symbol=XLMUSDT`).then((r) => r.json()),
        fetch(`${BINANCE_API_URL}/api/v3/ticker/price?symbol=XRPUSDT`).then((r) => r.json()),
      ]);

      const xlmPrice = parseFloat(xlmRes?.price);
      const xrpPrice = parseFloat(xrpRes?.price);

      if (Number.isFinite(xlmPrice) && Number.isFinite(xrpPrice) && xlmPrice > 0 && xrpPrice > 0) {
        const rates: ExchangeRatesData = {
          xlmUsd: xlmPrice,
          xrpUsd: xrpPrice,
          source: 'binance',
          fromCache: false,
          fetchedAt: new Date().toISOString(),
          expiresAt,
          ttlMinutesRemaining: 30,
        };
        setCachedRates(rates);
        return rates;
      }
    } catch {
      // Binance blocked or unreachable, fallback to Kraken
    }

    // 3. Direct Kraken Public Ticker API Fallback (US-compliant, CORS enabled, no rate limits)
    try {
      const res = await fetch(`${KRAKEN_API_URL}/0/public/Ticker?pair=XRPUSD,XLMUSD`);
      if (res.ok) {
        const json = await res.json();
        const xrpPrice = parseFloat(json?.result?.XXRPZUSD?.c?.[0]);
        const xlmPrice = parseFloat(json?.result?.XXLMZUSD?.c?.[0]);
        if (Number.isFinite(xrpPrice) && Number.isFinite(xlmPrice) && xrpPrice > 0 && xlmPrice > 0) {
          const rates: ExchangeRatesData = {
            xlmUsd: xlmPrice,
            xrpUsd: xrpPrice,
            source: 'binance',
            fromCache: false,
            fetchedAt: new Date().toISOString(),
            expiresAt,
            ttlMinutesRemaining: 30,
          };
          setCachedRates(rates);
          return rates;
        }
      }
    } catch {
      // Kraken unreachable, fallback to Coinbase
    }

    // 4. Direct Coinbase Public Exchange Rates API Fallback (CORS enabled, no rate limits)
    try {
      const res = await fetch(`${COINBASE_API_URL}/v2/exchange-rates?currency=USD`);
      if (res.ok) {
        const json = await res.json();
        const ratesMap = json?.data?.rates;
        const xrpPrice = ratesMap?.XRP ? 1 / parseFloat(ratesMap.XRP) : NaN;
        const xlmPrice = ratesMap?.XLM ? 1 / parseFloat(ratesMap.XLM) : NaN;
        if (Number.isFinite(xrpPrice) && Number.isFinite(xlmPrice) && xrpPrice > 0 && xlmPrice > 0) {
          const rates: ExchangeRatesData = {
            xlmUsd: xlmPrice,
            xrpUsd: xrpPrice,
            source: 'binance',
            fromCache: false,
            fetchedAt: new Date().toISOString(),
            expiresAt,
            ttlMinutesRemaining: 30,
          };
          setCachedRates(rates);
          return rates;
        }
      }
    } catch {
      // Coinbase unreachable, fallback to CoinGecko
    }

    // 5. Direct CoinGecko Public API Fallback (Safely guarded against HTTP 429)
    try {
      const res = await fetch(`${COINGECKO_API_URL}/api/v3/simple/price?ids=stellar,ripple&vs_currencies=usd`);
      if (res.ok) {
        const json = await res.json();
        const xlmPrice = json?.stellar?.usd;
        const xrpPrice = json?.ripple?.usd;

        if (Number.isFinite(xlmPrice) && Number.isFinite(xrpPrice) && xlmPrice > 0 && xrpPrice > 0) {
          const rates: ExchangeRatesData = {
            xlmUsd: xlmPrice,
            xrpUsd: xrpPrice,
            source: 'coingecko',
            fromCache: false,
            fetchedAt: new Date().toISOString(),
            expiresAt,
            ttlMinutesRemaining: 30,
          };
          setCachedRates(rates);
          return rates;
        }
      }
    } catch {
      // Network completely disconnected
    }

    // 6. Return existing real cache if available
    if (typeof window !== 'undefined') {
      try {
        const staleRaw = localStorage.getItem(RATES_STORAGE_KEY);
        if (staleRaw) {
          const stale: ExchangeRatesData = JSON.parse(staleRaw);
          return { ...stale, fromCache: true, ttlMinutesRemaining: 0 };
        }
      } catch {
        // Ignore
      }
    }

    throw new Error('Live crypto exchange rates are currently unreachable. Please check connection and retry.');
  })().finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}

/**
 * React Hook for live rates with automatic 30-min sync and cache management
 */
export function useLiveExchangeRates() {
  const [rates, setRates] = useState<ExchangeRatesData | null>(() => {
    return getCachedRates();
  });
  const [loading, setLoading] = useState<boolean>(!rates);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const fresh = await fetchLiveRates(force);
      setRates(fresh);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch live rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount
    refresh(false);

    // Listen for cross-tab or component rate updates
    const onRatesUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<ExchangeRatesData>;
      if (customEvent.detail) {
        setRates(customEvent.detail);
      }
    };

    window.addEventListener('nexus-rates-updated', onRatesUpdated);

    // Check freshness every minute
    const interval = setInterval(() => {
      const cached = getCachedRates();
      if (!cached) {
        // Expired, fetch new rates
        refresh(true);
      } else {
        setRates(cached);
      }
    }, 60 * 1000);

    return () => {
      window.removeEventListener('nexus-rates-updated', onRatesUpdated);
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    rates,
    loading,
    error,
    refreshRates: () => refresh(true),
    xlmUsd: rates?.xlmUsd ?? 0,
    xrpUsd: rates?.xrpUsd ?? 0,
    source: rates?.source ?? 'nexus-api',
    fromCache: rates?.fromCache ?? false,
    ttlMinutes: rates?.ttlMinutesRemaining ?? 0,
  };
}
