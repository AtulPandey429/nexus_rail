'use client';

import { useEffect, useState } from 'react';

/**
 * Public platform configuration served by `GET /api/v1/platform/config`.
 *
 * Every address, contract ID, fee and explorer base URL used by the UI must
 * come from this payload. Nothing here is invented client-side: when the API
 * is unavailable the values stay `null` and callers render an unavailable
 * state instead of a fallback.
 */
export interface PlatformConfig {
  environment: string;
  network: 'testnet' | 'mainnet';
  assets: {
    nxl: {
      stellarCode: string;
      stellarIssuer: string;
      stellarContractId: string;
      xrplCurrency: string;
      xrplCurrencyHex: string;
      xrplIssuer: string;
      xrplAmmAccount: string;
    };
  };
  vaults: {
    stellar: string;
    xrpl: string;
    stellarDistributor: string;
    xrplDistributor: string;
  };
  contracts: {
    nexusVault: string;
    nexusSwap: string;
    xlmSac: string;
  };
  networks: {
    stellarPassphrase: string;
    stellarHorizon: string;
    stellarRpc: string;
    xrplWss: string;
  };
  fees: {
    orderFeeBps: number;
    swapSpreadBps: number;
    cashoutSpreadBps: number;
    aiFeeBps: number;
    gasFlatCents: number;
    nrBuybackSharePct: number;
    cashbackPct: number;
    nxlCheckoutDiscountPct: number;
    isPaused: boolean;
  };
  explorers: {
    stellarTx: string;
    stellarAccount: string;
    stellarContract: string;
    xrplTx: string;
    xrplAccount: string;
  };
}

let cachedConfig: PlatformConfig | null = null;
let inFlight: Promise<PlatformConfig> | null = null;

export async function fetchPlatformConfig(forceRefresh = false): Promise<PlatformConfig> {
  if (!forceRefresh && cachedConfig) return cachedConfig;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch('/api/v1/platform/config', { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success !== true || !json?.data) {
      throw new Error(json?.error || 'Platform configuration is unavailable.');
    }
    cachedConfig = json.data as PlatformConfig;
    return cachedConfig;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(!cachedConfig);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (cachedConfig) {
      setConfig(cachedConfig);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchPlatformConfig()
      .then((data) => {
        if (!active) return;
        setConfig(data);
        setError('');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Platform configuration is unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { config, loading, error };
}

export function explorerTxUrl(
  config: PlatformConfig | null,
  rail: string | undefined,
  txHash: string | undefined
): string {
  if (!config || !txHash) return '';
  const value = (rail || '').toUpperCase();
  if (value.includes('XRPL') || value.includes('XRP') || value.includes('RLUSD')) {
    return `${config.explorers.xrplTx}${txHash}`;
  }
  if (value.includes('STELLAR') || value.includes('XLM') || value.includes('USDC')) {
    return `${config.explorers.stellarTx}${txHash}`;
  }
  return '';
}
