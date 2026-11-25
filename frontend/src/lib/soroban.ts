'use client';

import { connectFreighter, signFreighterTransaction } from '@/lib/wallets';
import { fetchPlatformConfig } from '@/lib/platformConfig';

const ENV_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || '';

async function resolveNetworkPassphrase(): Promise<string> {
  if (ENV_PASSPHRASE) return ENV_PASSPHRASE;
  const config = await fetchPlatformConfig().catch(() => null);
  return config?.networks?.stellarPassphrase || '';
}

async function signXdrWithFreighter(unsignedXdr: string, address: string): Promise<string> {
  const passphrase = await resolveNetworkPassphrase();
  if (!passphrase) {
    throw new Error('Stellar network passphrase is not configured.');
  }
  const signed = await signFreighterTransaction(unsignedXdr, {
    networkPassphrase: passphrase,
    address,
  });
  if (typeof signed === 'string') return signed;
  if (signed && typeof signed === 'object') {
    if ('error' in signed && signed.error) {
      const msg = typeof signed.error === 'string' ? signed.error : (signed.error as any)?.message;
      throw new Error(msg || 'Freighter declined signing the Soroban transaction.');
    }
    if ('signedTxXdr' in signed && signed.signedTxXdr) {
      return String(signed.signedTxXdr);
    }
  }
  throw new Error('Freighter did not return a signed XDR transaction.');
}

export async function fetchLiveSorobanSwapPool() {
  const res = await fetch('/api/v1/swap/soroban/pool', { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Failed to fetch live Soroban AMM pool');
  }
  return json.data as {
    contractId: string;
    explorerUrl: string;
    reserveXlm: number;
    reserveNxl: number;
    spotPriceXlmPerNxl: number;
    spotPriceNxlPerXlm: number;
    swapFeeBps: number;
    totalSwaps: number;
    totalEscrowsLocked: number;
    totalEscrowsReleased: number;
  };
}

export async function payOrderViaSorobanContract(params: {
  orderId: string;
  tokenAsset?: 'XLM' | 'NXL';
  amount?: number;
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
  if (!token) throw new Error('Please sign in first to settle via NexusVault smart contract.');

  const { address } = await connectFreighter();
  const tokenAsset = params.tokenAsset || 'XLM';

  const prepRes = await fetch('/api/v1/checkout/soroban/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      orderId: params.orderId,
      payerAddress: address,
      tokenAsset,
      amount: params.amount,
    }),
  });
  const prepJson = await prepRes.json();
  if (!prepRes.ok || !prepJson.success) {
    throw new Error(prepJson?.error || 'Could not prepare NexusVault settlement XDR');
  }

  const signedXdr = await signXdrWithFreighter(prepJson.data.unsignedXdr, address);

  const subRes = await fetch('/api/v1/checkout/soroban/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      orderId: params.orderId,
      signedXdr,
      tokenAsset,
    }),
  });
  const subJson = await subRes.json();
  if (!subRes.ok || !subJson.success) {
    throw new Error(subJson?.error || 'Soroban settlement failed on-chain');
  }
  return subJson.data as {
    orderId: string;
    txHash: string;
    ledger?: number;
    explorerUrl: string;
    contractId: string;
  };
}

export async function executeSorobanSwapOrBridge(params: {
  fromAsset: 'XLM' | 'NXL';
  toAsset: 'XLM' | 'NXL' | 'XRP';
  amount: number;
  userDestinationAddress?: string;
  slippagePct?: number;
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
  const { address } = await connectFreighter();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const prepRes = await fetch('/api/v1/swap/soroban/prepare', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      amount: params.amount,
      traderAddress: address,
      userDestinationAddress: params.userDestinationAddress,
      slippagePct: params.slippagePct ?? 1.0,
    }),
  });
  const prepJson = await prepRes.json();
  if (!prepRes.ok || !prepJson.success) {
    throw new Error(prepJson?.error || 'Could not simulate Soroban swap contract');
  }

  const signedXdr = await signXdrWithFreighter(prepJson.data.unsignedXdr, address);

  const subRes = await fetch('/api/v1/swap/soroban/submit', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      signedXdr,
      mode: prepJson.mode,
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      amount: params.amount,
      swapId: prepJson.data.swapId,
      xrplDestination: params.userDestinationAddress,
    }),
  });
  const subJson = await subRes.json();
  if (!subRes.ok || !subJson.success) {
    throw new Error(subJson?.error || 'Soroban transaction submission failed');
  }

  return subJson.data as {
    swapId: string;
    mode: string;
    status?: string;
    txHash: string;
    ledger?: number;
    explorerUrl: string;
    payoutTxHash?: string;
    payoutExplorerUrl?: string;
    escrowReleaseTxHash?: string;
    bridgeOperation?: {
      id: string;
      swap_id: string;
      status: string;
      mechanism: string;
      escrow_expiry_unix_sec?: number;
      retry_count?: number;
      last_error?: string;
    };
    transactions?: Array<{
      sequence: number;
      direction: 'INCOMING' | 'OUTGOING';
      stage: 'DEPOSIT' | 'INTERNAL_DEBIT' | 'AMM_SWAP' | 'INTERNAL_CREDIT' | 'ONCHAIN_PAYOUT' | 'ESCROW_RELEASE';
      label: string;
      asset: string;
      amount: number;
      rail: 'XRPL' | 'STELLAR' | 'INTERNAL_LEDGER';
      status: 'SUCCESS' | 'FAILED' | 'PENDING';
      txHash: string | null;
      explorerUrl: string | null;
      ledgerRef?: string | null;
      toAddress?: string;
      errorMessage?: string;
      timestamp: string;
    }>;
  };
}

export async function refundExpiredBridgeEscrowWithFreighter(swapId: string) {
  const { address } = await connectFreighter();
  const res = await fetch(`/api/v1/swap/bridge/${encodeURIComponent(swapId)}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callerAddress: address }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Could not build bridge escrow refund transaction');
  }
  if (json.data?.mode === 'REFUNDED_ONCHAIN') {
    return {
      txHash: json.data.txHash as string,
      explorerUrl: json.data.explorerUrl as string,
      operation: json.data.operation,
    };
  }

  const signedXdr = await signXdrWithFreighter(json.data.unsignedXdr, address);
  const subRes = await fetch('/api/v1/swap/stellar/submit-xdr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXdr }),
  });
  const subJson = await subRes.json();
  if (!subRes.ok || !subJson.success) {
    throw new Error(subJson?.error || 'Horizon submission rejected refund XDR');
  }
  return {
    txHash: subJson.txHash as string,
    explorerUrl: subJson.explorerUrl as string,
    operation: json.data?.operation,
  };
}

export async function claimBridgeTrustline(swapId: string) {
  const res = await fetch(`/api/v1/swap/bridge/${encodeURIComponent(swapId)}/claim-trustline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || 'Failed to claim pending bridge trustline');
  }
  return json;
}
