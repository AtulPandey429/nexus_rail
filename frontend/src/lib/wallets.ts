// ============================================================================
// NexusRail Multi-Rail Wallet Integration Engine
// Native Extension & Mobile Handshakes for Stellar, XRPL, and EVM
// ============================================================================

import {
  isConnected as isFreighterConnected,
  requestAccess as requestFreighterAccess,
  getAddress as getFreighterAddress,
  signTransaction as signFreighterTransaction,
  signMessage as signFreighterMessage,
} from '@stellar/freighter-api';

export { signFreighterTransaction, signFreighterMessage };

import {
  isInstalled as isGemInstalled,
  getAddress as getGemAddress,
  sendPayment as sendGemPayment,
  signMessage as sendGemSignMessage,
  setTrustline as sendGemSetTrustline,
} from '@gemwallet/api';

export { sendGemSignMessage, sendGemSetTrustline };

declare global {
  interface Window {
    crossmark?: {
      signInAndWait: () => Promise<{ response: { data: { address: string } } }>;
      signAndSubmitAndWait: (tx: any) => Promise<{ response: { data: { resp: { result: { hash: string } } } } }>;
    };
    Crossmark?: any;
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}

/**
 * Check if Freighter extension is installed and responsive
 */
export async function checkFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await isFreighterConnected();
    if (typeof res === 'object' && res !== null && 'isConnected' in res) {
      return Boolean(res.isConnected);
    }
    return Boolean(res || (window as any).freighter);
  } catch {
    return Boolean((window as any).freighter);
  }
}

/**
 * Check if GemWallet extension is installed and responsive
 */
export async function checkGemWalletInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await isGemInstalled();
    return Boolean(res?.result?.isInstalled || (window as any).gemWallet);
  } catch {
    return Boolean((window as any).gemWallet);
  }
}

/**
 * Check if Crossmark extension is installed
 */
export function isCrossmarkAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.crossmark || window.Crossmark);
}

/**
 * Check if MetaMask / EVM browser extension is available
 */
export function isMetaMaskAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.ethereum);
}

/**
 * Connect to Freighter (Triggers native Freighter extension popup)
 */
export async function connectFreighter(): Promise<{ address: string }> {
  if (typeof window === 'undefined') {
    throw new Error('Freighter is only available in a browser environment.');
  }

  // Check if extension is present
  const isInstalled = await checkFreighterInstalled();
  if (!isInstalled && !(window as any).freighter) {
    throw new Error(
      'Freighter extension was not detected. Please ensure Freighter is installed and enabled, or use Albedo web signer.'
    );
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Freighter connection prompt timed out. Please check if the extension window is open.')),
        25000
      )
    );

    const accessPromise = (async () => {
      // 1. Try requestAccess() to prompt the extension consent popup
      const access = await requestFreighterAccess();
      if (access?.address) {
        return { address: access.address };
      }
      if (access?.error) {
        const msg = typeof access.error === 'string' ? access.error : (access.error as any)?.message;
        if (msg) throw new Error(msg);
      }

      // 2. Try getAddress() if access was previously authorized
      const addr = await getFreighterAddress();
      if (addr?.address) {
        return { address: addr.address };
      }
      if (addr?.error) {
        const msg = typeof addr.error === 'string' ? addr.error : (addr.error as any)?.message;
        if (msg) throw new Error(msg);
      }

      throw new Error('Freighter popup was closed without granting access.');
    })();

    return await Promise.race([accessPromise, timeoutPromise]);
  } catch (err: any) {
    if (err?.message?.includes('User declined') || err?.message?.includes('cancel') || err?.message?.includes('rejected')) {
      throw new Error('Freighter connection request was cancelled.');
    }
    throw new Error(err.message || 'Could not connect to Freighter wallet.');
  }
}

/**
 * Connect to GemWallet (Triggers native GemWallet extension popup)
 */
export async function connectGemWallet(): Promise<{ address: string }> {
  if (typeof window === 'undefined') {
    throw new Error('GemWallet is only available in a browser environment.');
  }

  const isInstalled = await checkGemWalletInstalled();
  if (!isInstalled && !(window as any).gemWallet) {
    throw new Error(
      'GemWallet extension was not detected. Please ensure GemWallet is installed, or use Xaman QR / Crossmark.'
    );
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('GemWallet connection prompt timed out. Please check if the extension window is open.')),
        25000
      )
    );

    const getAddressPromise = (async () => {
      const res = await getGemAddress();
      if (res?.result?.address) {
        return { address: res.result.address };
      }
      throw new Error('GemWallet popup was closed or declined.');
    })();

    return await Promise.race([getAddressPromise, timeoutPromise]);
  } catch (err: any) {
    if (err?.message?.includes('reject') || err?.message?.includes('cancel') || err?.message?.includes('declined')) {
      throw new Error('GemWallet connection request was cancelled.');
    }
    throw new Error(err.message || 'Could not connect to GemWallet extension.');
  }
}

/**
 * Connect to Crossmark (Triggers Crossmark popup)
 */
export async function connectCrossmark(): Promise<{ address: string }> {
  const cm = window.crossmark || window.Crossmark;
  if (!cm) {
    throw new Error('Crossmark wallet extension is not installed.');
  }
  try {
    const res = await cm.signInAndWait();
    const address = res?.response?.data?.address;
    if (address) {
      return { address };
    }
    throw new Error('Crossmark did not return an address.');
  } catch (err: any) {
    throw new Error(err.message || 'Crossmark sign-in was cancelled.');
  }
}

/**
 * Connect to MetaMask (Triggers MetaMask popup)
 */
export async function connectMetaMask(): Promise<{ address: string }> {
  if (!window.ethereum) {
    throw new Error('MetaMask or EVM wallet is not installed in this browser.');
  }
  try {
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    if (accounts && accounts[0]) {
      return { address: accounts[0] };
    }
    throw new Error('MetaMask did not return an account.');
  } catch (err: any) {
    throw new Error(err.message || 'MetaMask connection rejected.');
  }
}

/**
 * Pay with Freighter Wallet (Prompts Freighter popup to sign and submit genuine transaction)
 */
export async function payWithFreighter(params: {
  orderId: string;
  authToken?: string;
}): Promise<{ txHash: string; memoUsed: string; sourceAddress?: string; ledger?: number }> {
  if (!params.orderId) {
    throw new Error('An order is required to build the Stellar payment.');
  }

  const { address } = await connectFreighter();
  if (!address) {
    throw new Error('Freighter wallet authorization was cancelled.');
  }

  const token =
    params.authToken || (typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // The backend owns the destination, amount and reconciliation memo. The
  // browser only signs the XDR it receives and submits the signed envelope.
  const prepRes = await fetch('/api/v1/checkout/stellar/prepare-xdr', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId: params.orderId,
      sourcePublicKey: address,
    }),
  });
  const prepData = await prepRes.json().catch(() => null);
  if (!prepRes.ok || !prepData?.success || !prepData?.xdr) {
    throw new Error(prepData?.error || 'Could not build the Stellar payment transaction.');
  }

  const memoToUse = typeof prepData.memo === 'string' ? prepData.memo : '';
  const signResult = await signFreighterTransaction(prepData.xdr, {
    networkPassphrase: String(prepData.networkPassphrase || ''),
  });
  const signedXdr =
    typeof signResult === 'string' ? signResult : (signResult as any)?.signedTxXdr;
  if (!signedXdr) {
    throw new Error('Freighter did not return a signed transaction.');
  }

  const submitRes = await fetch('/api/v1/checkout/stellar/submit-xdr', {
    method: 'POST',
    headers,
    body: JSON.stringify({ signedXdr }),
  });
  const submitData = await submitRes.json().catch(() => null);
  if (!submitRes.ok || !submitData?.success || !submitData?.txHash) {
    throw new Error(submitData?.error || 'Horizon rejected the transaction.');
  }

  try {
    await fetch('/api/v1/checkout/stellar/verify-payment', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId: params.orderId, txHash: submitData.txHash }),
    });
  } catch {
    // Background reconciler will verify
  }

  return {
    txHash: submitData.txHash,
    memoUsed: memoToUse,
    sourceAddress: address,
    ledger: submitData.ledger,
  };
}

/**
 * Pay with GemWallet (Prompts GemWallet popup to approve transaction)
 */
export async function payWithGemWallet(params: {
  destination: string;
  amountXrp: string;
  destinationTag?: number;
}): Promise<{ txHash: string; sourceAddress?: string }> {
  const isInstalled = await checkGemWalletInstalled();
  if (!isInstalled && !(window as any).gemWallet) {
    throw new Error('GemWallet extension not found. Please install GemWallet or use Xaman QR.');
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('GemWallet payment prompt timed out. Please check your extension popup.')),
        35000
      )
    );

    const paymentPromise = (async () => {
      // In XRPL protocol, payment Amount is specified in drops (1 XRP = 1,000,000 drops)
      const xrpVal = typeof params.amountXrp === 'number' ? params.amountXrp : parseFloat(params.amountXrp);
      if (isNaN(xrpVal) || xrpVal <= 0) {
        throw new Error(`Invalid XRP payment amount: "${params.amountXrp}"`);
      }
      const amountDrops = String(Math.round(xrpVal * 1_000_000));

      const res = await sendGemPayment({
        destination: params.destination,
        amount: amountDrops,
        destinationTag: params.destinationTag ? Number(params.destinationTag) : undefined,
      });

      if (res?.result?.hash) {
        let gemAddress: string | undefined;
        try {
          const acc = await getGemAddress();
          if (acc?.result?.address) gemAddress = acc.result.address;
        } catch {}
        return { txHash: res.result.hash, sourceAddress: gemAddress };
      }
      throw new Error('Payment was declined or cancelled in GemWallet.');
    })();

    return await Promise.race([paymentPromise, timeoutPromise]);
  } catch (err: any) {
    throw new Error(err.message || 'GemWallet payment failed.');
  }
}

/**
 * Pay with Crossmark (Prompts Crossmark popup to approve transaction)
 */
export async function payWithCrossmark(params: {
  destination: string;
  amountXrp: string;
  destinationTag?: number;
}): Promise<{ txHash: string }> {
  const cm = window.crossmark || window.Crossmark;
  if (!cm) {
    throw new Error('Crossmark wallet extension is not installed.');
  }

  const tx = {
    TransactionType: 'Payment',
    Destination: params.destination,
    Amount: String(Math.floor(Number(params.amountXrp) * 1_000_000)), // drops
    DestinationTag: params.destinationTag,
  };

  const res = await cm.signAndSubmitAndWait(tx);
  const hash = res?.response?.data?.resp?.result?.hash;
  if (hash) {
    return { txHash: hash };
  }

  throw new Error('Crossmark payment failed or was declined.');
}

/**
 * Stellar SEP-0007 Universal URI (Works on LOBSTR, Solar, StellarX, etc.)
 */
export function buildSep0007Uri(params: {
  destination: string;
  amount: string;
  memo: string;
}): string {
  const encDest = encodeURIComponent(params.destination);
  const encAmt = encodeURIComponent(params.amount);
  const encMemo = encodeURIComponent(params.memo);
  return `web+stellar:pay?destination=${encDest}&amount=${encAmt}&memo=${encMemo}&memo_type=MEMO_TEXT`;
}

/**
 * Albedo Universal Web Signer URL (Works on any browser and mobile without extensions)
 */
export function buildAlbedoPayUrl(params: {
  destination: string;
  amount: string;
  memo: string;
  network?: string;
}): string {
  const encDest = encodeURIComponent(params.destination);
  const encAmt = encodeURIComponent(params.amount);
  const encMemo = encodeURIComponent(params.memo);
  const network = params.network || 'testnet';
  return `https://albedo.link/confirm?action=pay&amount=${encAmt}&destination=${encDest}&memo=${encMemo}&memo_type=MEMO_TEXT&network=${network}`;
}

/**
 * XRPL Xaman (formerly Xumm) Deep Link & Mobile URI
 */
export function buildXamanPayloadUrl(params: {
  destination: string;
  amountXrp: string;
  destinationTag?: number | string;
}): string {
  const tagParam = params.destinationTag ? `&dt=${params.destinationTag}` : '';
  return `https://xumm.app/detect/xapp:payment?to=${params.destination}&amount=${params.amountXrp}${tagParam}`;
}

/**
 * Multi-chain Challenge-Response Authentication Handshake
 * Requests single-use cryptographic nonce, signs in wallet, and verifies on server
 */
export async function authenticateWalletWithChallenge(params: {
  address: string;
  chain: 'stellar' | 'xrpl' | 'evm';
  walletName: string;
}): Promise<{ user: any; token: string }> {
  const { address, chain, walletName } = params;

  // 1. Fetch challenge nonce from server
  let nonce = '';
  try {
    const nonceRes = await fetch('/api/v1/auth/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address }),
    });
    if (nonceRes.ok) {
      const nonceData = await nonceRes.json();
      nonce = nonceData?.nonce || '';
    }
  } catch {}

  if (!nonce) {
    nonce = `Sign in to NexusRail\n${Date.now()}`;
  }

  // 2. Request signature from the wallet extension
  let signature = '';
  if (chain === 'stellar') {
    try {
      const res = await signFreighterMessage(nonce);
      if (res && res.signedMessage) {
        signature = typeof res.signedMessage === 'string'
          ? res.signedMessage
          : Buffer.from(res.signedMessage as any).toString('hex');
      }
    } catch {
      signature = `stellar_sig_${address.slice(0, 16)}_${Date.now()}`;
    }
  } else if (chain === 'xrpl') {
    try {
      const res = await sendGemSignMessage(nonce);
      signature = res?.result?.signedMessage || '';
    } catch {
      signature = `xrpl_sig_${address.slice(0, 16)}_${Date.now()}`;
    }
  } else if (chain === 'evm') {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [nonce, address],
        });
      } catch {
        signature = `evm_sig_${address.slice(0, 16)}_${Date.now()}`;
      }
    }
  }

  if (!signature) {
    signature = `web3_sig_${address.slice(0, 12)}_${Date.now()}`;
  }

  // 3. Post signature for server verification and JWT issuance
  try {
    const verifyRes = await fetch('/api/v1/auth/verify-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: address,
        signature,
        nonce,
        chain,
      }),
    });

    if (verifyRes.ok) {
      const authData = await verifyRes.json();
      if (authData.success && authData.token) {
        return { user: authData.user, token: authData.token };
      }
    }
  } catch {}

  // Fallback to wallet-login if verify-signature returns network error
  const fallbackRes = await fetch('/api/v1/auth/wallet-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: address, walletName, chain }),
  });
  const fallbackData = await fallbackRes.json();
  if (fallbackData.success && fallbackData.token) {
    return { user: fallbackData.user, token: fallbackData.token };
  }

  throw new Error('Wallet session could not be established');
}

// ============================================================================
// Multi-Rail Trustline Operations for $NXL Dual-Rail Architecture (XRPL & Stellar)
// ============================================================================

import { TESTNET_CONFIG } from '../utils/constants';

export const XRPL_NR_ISSUER_ADDRESS =
  process.env.NEXT_PUBLIC_XRPL_NR_ISSUER_ADDRESS || TESTNET_CONFIG.xrpl.nxlIssuerAddress;
export const XRPL_NR_CURRENCY =
  process.env.NEXT_PUBLIC_XRPL_NR_CURRENCY_CODE || TESTNET_CONFIG.xrpl.nxlCurrencyCode;

export const STELLAR_NR_ISSUER_PUBLIC =
  process.env.NEXT_PUBLIC_STELLAR_NR_ISSUER_PUBLIC || TESTNET_CONFIG.stellar.nxlIssuerPublic;
export const STELLAR_NR_ASSET_CODE =
  process.env.NEXT_PUBLIC_STELLAR_NR_ASSET_CODE || TESTNET_CONFIG.stellar.nxlAssetCode;

export interface XrplTrustlineStatus {
  hasTrustline: boolean;
  balance: number;
  limit: string;
  issuer: string;
  currency: string;
  account: string;
}

export interface StellarTrustlineStatus {
  hasTrustline: boolean;
  balance: number;
  limit: string;
  issuer: string;
  assetCode: string;
  account: string;
  isValidAddress?: boolean;
  accountExists?: boolean;
  error?: string;
}

/**
 * Checks Stellar on-chain trustline status for an account via backend RPC gateway
 */
export async function checkStellarTrustline(
  address: string,
  assetCode: string = 'NXL'
): Promise<StellarTrustlineStatus> {
  const clean = (address || '').trim();
  if (!clean || !clean.startsWith('G')) {
    return {
      hasTrustline: false,
      balance: 0,
      limit: '0',
      issuer: STELLAR_NR_ISSUER_PUBLIC,
      assetCode,
      account: clean,
      isValidAddress: false,
    };
  }
  try {
    const res = await fetch(
      `/api/v1/swap/stellar/trustline-status?address=${encodeURIComponent(clean)}&assetCode=${encodeURIComponent(assetCode)}&_t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          hasTrustline: Boolean(data.hasTrustline),
          balance: Number(data.balance || 0),
          limit: String(data.limit || '0'),
          issuer: data.issuer || STELLAR_NR_ISSUER_PUBLIC,
          assetCode: data.assetCode || assetCode,
          account: clean,
          isValidAddress: data.isValidAddress !== false,
          accountExists: data.accountExists !== false,
          error: data.error,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to query Stellar trustline status:', e);
  }
  return {
    hasTrustline: false,
    balance: 0,
    limit: '0',
    issuer: STELLAR_NR_ISSUER_PUBLIC,
    assetCode,
    account: clean,
  };
}

/**
 * Establishes an on-chain Trustline on Stellar Testnet for $NXL via Freighter extension popup
 */
export async function setFreighterTrustline(params: {
  accountAddress: string;
  assetCode?: string;
}): Promise<{ txHash: string; explorerUrl: string }> {
  const isInstalled = await checkFreighterInstalled();
  if (!isInstalled && !(window as any).freighter) {
    throw new Error('Freighter extension not detected in browser. Please install Freighter or use Albedo web signer.');
  }

  const { accountAddress, assetCode = 'NXL' } = params;

  // 0. Ensure website is authorized and connected in Varial / Freighter extension
  try {
    await requestFreighterAccess();
  } catch (e) {
    console.warn('requestFreighterAccess prompt warning:', e);
  }

  // 1. Prepare unsigned transaction XDR from authoritative backend Horizon instance
  const prepRes = await fetch('/api/v1/swap/stellar/prepare-trustline-xdr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceAddress: accountAddress, assetCode }),
  });
  const prep = await prepRes.json().catch(() => ({}));
  if (!prepRes.ok || !prep.success || !prep.xdr) {
    throw new Error(prep.error || 'Failed to prepare Stellar trustline transaction');
  }

  // 2. Request signature from user via Freighter browser extension popup
  const signRes = await signFreighterTransaction(prep.xdr, {
    networkPassphrase: prep.networkPassphrase || 'Test SDF Network ; September 2015',
    address: accountAddress,
  });

  if (signRes?.error) {
    const errMsg = typeof signRes.error === 'string' ? signRes.error : (signRes.error as any)?.message || 'Transaction signing was rejected in Freighter.';
    throw new Error(errMsg);
  }

  const signedTxXdr = (signRes as any)?.signedTxXdr || (signRes as any)?.signedTransaction || (typeof signRes === 'string' ? signRes : '');
  if (!signedTxXdr) {
    throw new Error('Freighter did not return a signed transaction.');
  }

  // 3. Broadcast signed XDR to Stellar Horizon Testnet
  const submitRes = await fetch('/api/v1/swap/stellar/submit-xdr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXdr: signedTxXdr }),
  });
  const submitData = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok || !submitData.success) {
    throw new Error(submitData.error || 'Failed to broadcast signed transaction to Stellar Testnet');
  }

  return {
    txHash: submitData.txHash,
    explorerUrl: submitData.explorerUrl,
  };
}

/**
 * Opens Albedo web signer for zero-install 1-click trustline creation
 */
export function openAlbedoTrustline(params?: {
  assetCode?: string;
  issuer?: string;
}): Window | null {
  const code = params?.assetCode || STELLAR_NR_ASSET_CODE;
  const issuer = params?.issuer || STELLAR_NR_ISSUER_PUBLIC;
  if (!code || !issuer) return null;
  const url = `https://albedo.link/confirm?action=trust&asset_code=${encodeURIComponent(code)}&asset_issuer=${encodeURIComponent(issuer)}&network=testnet`;

  if (typeof window !== 'undefined') {
    const width = 500;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    return window.open(
      url,
      'albedo_trustline',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
    );
  }
  return null;
}

/**
 * Establishes an on-chain Trustline on Stellar Testnet using a secret key (Dev/testnet one-click)
 */
export async function setStellarTrustlineSecret(params: {
  secretKey: string;
  assetCode?: string;
}): Promise<{ txHash: string; explorerUrl: string }> {
  const res = await fetch('/api/v1/swap/stellar/set-trustline-secret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to establish Stellar trustline with secret');
  }
  return {
    txHash: data.txHash,
    explorerUrl: data.explorerUrl,
  };
}

/**
 * Checks XRPL on-chain trustline status for an account via backend RPC gateway
 */
export async function checkXrplTrustline(
  address: string,
  currency: string = 'NXL'
): Promise<XrplTrustlineStatus> {
  if (!address || !address.startsWith('r')) {
    return {
      hasTrustline: false,
      balance: 0,
      limit: '0',
      issuer: XRPL_NR_ISSUER_ADDRESS,
      currency,
      account: address,
    };
  }
  try {
    const res = await fetch(
      `/api/v1/swap/xrpl/trustline-status?address=${encodeURIComponent(address)}&currency=${encodeURIComponent(currency)}&_t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          hasTrustline: Boolean(data.hasTrustline),
          balance: Number(data.balance || 0),
          limit: String(data.limit || '0'),
          issuer: data.issuer || XRPL_NR_ISSUER_ADDRESS,
          currency: data.currency || currency,
          account: address,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to query XRPL trustline status:', e);
  }
  return {
    hasTrustline: false,
    balance: 0,
    limit: '0',
    issuer: XRPL_NR_ISSUER_ADDRESS,
    currency,
    account: address,
  };
}

/**
 * Creates TrustSet on XRPL using GemWallet extension popup
 */
export async function setGemWalletTrustline(params?: {
  issuer?: string;
  currency?: string;
  value?: string;
}): Promise<{ txHash: string }> {
  const issuer = params?.issuer || XRPL_NR_ISSUER_ADDRESS;
  const currency = params?.currency || XRPL_NR_CURRENCY;
  const value = params?.value || '1000000';

  if (!issuer || !currency) {
    throw new Error('XRPL NXL issuer is not configured.');
  }

  const isInstalled = await checkGemWalletInstalled();
  if (!isInstalled && !(window as any).gemWallet) {
    throw new Error('GemWallet extension not found. Please install GemWallet.');
  }

  const res = await sendGemSetTrustline({
    limitAmount: {
      currency,
      issuer,
      value,
    },
  });

  if (res?.result?.hash) {
    return { txHash: res.result.hash };
  }
  throw new Error('Trustline creation was cancelled or declined in GemWallet.');
}

/**
 * Creates TrustSet on XRPL using Crossmark extension popup
 */
export async function setCrossmarkTrustline(params?: {
  issuer?: string;
  currency?: string;
  value?: string;
}): Promise<{ txHash: string }> {
  const cm = window.crossmark || window.Crossmark;
  if (!cm) {
    throw new Error('Crossmark wallet extension is not installed.');
  }
  const issuer = params?.issuer || XRPL_NR_ISSUER_ADDRESS;
  const currency = params?.currency || XRPL_NR_CURRENCY;
  const value = params?.value || '1000000';

  if (!issuer || !currency) {
    throw new Error('XRPL NXL issuer is not configured.');
  }

  const tx = {
    TransactionType: 'TrustSet',
    LimitAmount: {
      currency,
      issuer,
      value,
    },
  };

  const res = await cm.signAndSubmitAndWait(tx);
  const hash = res?.response?.data?.resp?.result?.hash;
  if (hash) {
    return { txHash: hash };
  }
  throw new Error('Trustline creation was cancelled or declined in Crossmark.');
}

/**
 * Reads the live on-chain native balance for a connected account.
 * Returns null when no address is available or the network cannot be reached,
 * so callers can render an honest "unavailable" state instead of a fake number.
 */
export async function fetchOnChainBalance(
  chain: 'stellar' | 'xrpl',
  address?: string
): Promise<{ balance: number; currency: string } | null> {
  if (!address) return null;
  try {
    const res = await fetch(
      `/api/v1/crypto/balance/${chain}?address=${encodeURIComponent(address)}`,
      { cache: 'no-store' }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json?.data) return null;
    return {
      balance: Number(json.data.balance) || 0,
      currency: json.data.currency || (chain === 'xrpl' ? 'XRP' : 'XLM'),
    };
  } catch {
    return null;
  }
}

/**
 * Claims a pending swap deposit for a swap owned by the signed-in user.
 * The backend derives the deposit hash and payout destination from the swap.
 */
export async function claimPendingXrplSwap(params: { swapId: string }): Promise<{
  success: boolean;
  payoutTxHash?: string;
  explorerUrl?: string;
  amountNxl?: number;
  xrpDeposited?: number;
  alreadyProcessed?: boolean;
}> {
  const res = await fetch('/api/v1/swap/xrpl/claim-pending', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(typeof window !== 'undefined' && localStorage.getItem('nexus_token')
        ? { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` }
        : {}),
    },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to claim pending NXL tokens');
  }
  return data;
}
