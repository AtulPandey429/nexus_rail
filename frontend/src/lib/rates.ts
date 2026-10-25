// ============================================================================
// NexusRail Live FX & Rates Oracle Engine
// Fetches live testnet/mainnet rates with strict 30-minute client caching
// ============================================================================

import { useEffect, useState, useCallback } from 'react';

export interface ExchangeRatesData {
  xlmUsd: number;
  xrpUsd: number;
  source: 'nexus-api' | 'binance' | 'coingecko' | 'cache' | 'fallback';
  fromCache: boolean;
  fetchedAt: string;
  expiresAt: number; // Unix timestamp in ms (30 mins from fetch)
  ttlMinutesRemaining: number;
}

const RATES_STORAGE_KEY = 'nexus_fx_rates_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache window

// Default reasonable baseline only in case of complete internet disconnection
const DEFAULT_RATES: ExchangeRatesData = {
  xlmUsd: 0.1778,
  xrpUsd: 1.2972,
  source: 'fallback',
  fromCache: false,
  fetchedAt: new Date().toISOString(),
  expiresAt: Date.now() + CACHE_TTL_MS,
  ttlMinutesRemaining: 30,
};

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
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT').then((r) => r.json()),
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT').then((r) => r.json()),
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
      // Binance blocked or unreachable, fallback to CoinGecko
    }

    // 3. Direct CoinGecko Public API Fallback
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar,ripple&vs_currencies=usd');
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

    // 4. Return existing cache even if expired as graceful degradation
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

    return DEFAULT_RATES;
  })().finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}

/**
 * React Hook for live rates with automatic 30-min sync and cache management
 */
export function useLiveExchangeRates() {
  const [rates, setRates] = useState<ExchangeRatesData>(() => {
    const cached = getCachedRates();
    return cached || DEFAULT_RATES;
  });
  const [loading, setLoading] = useState<boolean>(false);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const fresh = await fetchLiveRates(force);
      setRates(fresh);
    } catch {
      // keep current
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
    refreshRates: () => refresh(true),
    xlmUsd: rates.xlmUsd,
    xrpUsd: rates.xrpUsd,
    source: rates.source,
    fromCache: rates.fromCache,
    ttlMinutes: rates.ttlMinutesRemaining,
  };
}
