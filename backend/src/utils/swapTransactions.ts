import { STELLAR_TESTNET, XRPL_TESTNET } from './constants.js';

export type SwapRail = 'XRPL' | 'STELLAR' | 'INTERNAL_LEDGER';

export type SwapLegStage =
  | 'DEPOSIT'
  | 'INTERNAL_DEBIT'
  | 'AMM_SWAP'
  | 'INTERNAL_CREDIT'
  | 'ONCHAIN_PAYOUT'
  | 'ESCROW_RELEASE';

export type SwapSettlementType = 'ON_CHAIN' | 'INTERNAL_LEDGER' | 'HYBRID' | 'FAILED';

export interface SwapTransactionLeg {
  sequence: number;
  direction: 'INCOMING' | 'OUTGOING';
  stage: SwapLegStage;
  label: string;
  asset: string;
  amount: number;
  rail: SwapRail;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  txHash: string | null;
  explorerUrl: string | null;
  ledgerRef?: string | null;
  fromAddress?: string;
  toAddress?: string;
  errorMessage?: string;
  timestamp: string;
}

const ONCHAIN_TX_HASH_REGEX = /^[0-9a-fA-F]{64}$/;

/**
 * Returns true ONLY for real 64-character hex on-chain transaction hashes (XRPL / Stellar).
 * Rejects synthetic/fake IDs such as nr_ledger_out_*, stellar_payout_*, xrpl_payout_*, JE-*, etc.
 */
export function isRealOnChainTxHash(hash?: string | null): boolean {
  if (typeof hash !== 'string') return false;
  return ONCHAIN_TX_HASH_REGEX.test(hash.trim());
}

/**
 * Normalizes a real on-chain transaction hash, returning null for fake or malformed hashes.
 */
export function sanitizeOnChainTxHash(hash?: string | null): string | null {
  if (!isRealOnChainTxHash(hash)) return null;
  return hash!.trim();
}

/**
 * Builds an explorer URL only for real on-chain rails with a valid 64-hex hash.
 */
export function buildExplorerTxUrl(rail: SwapRail, txHash?: string | null): string | null {
  if (rail === 'INTERNAL_LEDGER') return null;
  const clean = sanitizeOnChainTxHash(txHash);
  if (!clean) return null;
  return rail === 'XRPL'
    ? `${XRPL_TESTNET.explorerTxBase}${clean}`
    : `${STELLAR_TESTNET.explorerTxBase}${clean}`;
}

export function inferAssetRail(asset: string, address?: string): SwapRail {
  const upper = (asset || '').toUpperCase();
  if (upper === 'XRP') return 'XRPL';
  if (upper === 'XLM') return 'STELLAR';
  if (upper === 'NXL') {
    const clean = (address || '').trim();
    if (clean.startsWith('r')) return 'XRPL';
    if (clean.startsWith('G')) return 'STELLAR';
  }
  return 'INTERNAL_LEDGER';
}

/**
 * Derives sequential transaction legs for legacy swap records that predate `transactions[]`,
 * stripping any synthetic/fake hashes and never fabricating explorer URLs.
 */
export function deriveFallbackLegs(doc: {
  fromAsset: string;
  toAsset: string;
  payAmount: number;
  receiveAmount: number;
  depositTxHash?: string;
  payoutTxHash?: string;
  status?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  platformDepositAddress?: string;
  userDestinationAddress?: string;
  journalEntry?: string;
  transactions?: SwapTransactionLeg[];
}): SwapTransactionLeg[] {
  if (Array.isArray(doc.transactions) && doc.transactions.length > 0) {
    return doc.transactions.map((leg, index) => {
      const cleanHash = leg.rail === 'INTERNAL_LEDGER' ? null : sanitizeOnChainTxHash(leg.txHash);
      return {
        ...leg,
        sequence: leg.sequence || index + 1,
        txHash: cleanHash,
        explorerUrl: buildExplorerTxUrl(leg.rail, cleanHash),
      };
    });
  }

  const legs: SwapTransactionLeg[] = [];
  const createdAt = doc.createdAt || new Date().toISOString();
  const updatedAt = doc.updatedAt || createdAt;
  const fromRail = inferAssetRail(doc.fromAsset);
  const toRail = inferAssetRail(doc.toAsset, doc.userDestinationAddress);
  const cleanDepositHash = fromRail === 'INTERNAL_LEDGER' ? null : sanitizeOnChainTxHash(doc.depositTxHash);
  const cleanPayoutHash = toRail === 'INTERNAL_LEDGER' ? null : sanitizeOnChainTxHash(doc.payoutTxHash);
  const overallFailed = doc.status === 'FAILED';
  const awaitingTrustline = doc.status === 'AWAITING_TRUSTLINE';

  // Leg 1: Incoming deposit or internal debit
  const leg1Failed = overallFailed && !cleanPayoutHash && fromRail !== 'INTERNAL_LEDGER' && Boolean(cleanDepositHash) === false;
  if (fromRail === 'INTERNAL_LEDGER') {
    legs.push({
      sequence: 1,
      direction: 'INCOMING',
      stage: 'INTERNAL_DEBIT',
      label: `NexusRail Wallet Debit (${doc.fromAsset})`,
      asset: doc.fromAsset,
      amount: doc.payAmount,
      rail: 'INTERNAL_LEDGER',
      status: leg1Failed ? 'FAILED' : 'SUCCESS',
      txHash: null,
      explorerUrl: null,
      ledgerRef: doc.journalEntry || null,
      toAddress: doc.platformDepositAddress,
      timestamp: createdAt,
    });
  } else {
    legs.push({
      sequence: 1,
      direction: 'INCOMING',
      stage: 'DEPOSIT',
      label: `User Deposit (${doc.fromAsset} on ${fromRail})`,
      asset: doc.fromAsset,
      amount: doc.payAmount,
      rail: fromRail,
      status: cleanDepositHash ? 'SUCCESS' : overallFailed ? 'FAILED' : 'PENDING',
      txHash: cleanDepositHash,
      explorerUrl: buildExplorerTxUrl(fromRail, cleanDepositHash),
      toAddress: doc.platformDepositAddress,
      errorMessage: !cleanDepositHash && overallFailed ? doc.errorMessage : undefined,
      timestamp: createdAt,
    });
  }

  // Leg 2: Outgoing internal credit or on-chain payout
  if (toRail === 'INTERNAL_LEDGER') {
    legs.push({
      sequence: 2,
      direction: 'OUTGOING',
      stage: 'INTERNAL_CREDIT',
      label: `NexusRail Internal Wallet Credit (${doc.toAsset})`,
      asset: doc.toAsset,
      amount: doc.receiveAmount,
      rail: 'INTERNAL_LEDGER',
      status: doc.status === 'COMPLETED' ? 'SUCCESS' : overallFailed ? 'FAILED' : 'PENDING',
      txHash: null,
      explorerUrl: null,
      ledgerRef: doc.journalEntry || null,
      toAddress: doc.userDestinationAddress,
      errorMessage: overallFailed ? doc.errorMessage : undefined,
      timestamp: updatedAt,
    });
  } else {
    const leg2Status: SwapTransactionLeg['status'] = cleanPayoutHash
      ? overallFailed
        ? 'FAILED'
        : 'SUCCESS'
      : awaitingTrustline
      ? 'PENDING'
      : overallFailed
      ? 'FAILED'
      : 'PENDING';

    legs.push({
      sequence: 2,
      direction: 'OUTGOING',
      stage: 'ONCHAIN_PAYOUT',
      label: `Server Payout (${doc.toAsset} on ${toRail})`,
      asset: doc.toAsset,
      amount: doc.receiveAmount,
      rail: toRail,
      status: leg2Status,
      txHash: cleanPayoutHash,
      explorerUrl: buildExplorerTxUrl(toRail, cleanPayoutHash),
      toAddress: doc.userDestinationAddress,
      errorMessage: leg2Status === 'FAILED' ? doc.errorMessage : undefined,
      timestamp: updatedAt,
    });
  }

  return legs;
}
