'use client';

import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  XCircle,
} from 'lucide-react';

export type SwapRail = 'XRPL' | 'STELLAR' | 'INTERNAL_LEDGER';

export type SwapKind = 'SAME_CHAIN' | 'CROSS_CHAIN' | 'INTERNAL_LEDGER';

export interface SwapHistoryClassificationInput {
  swapKind?: SwapKind;
  settlementType?: 'ON_CHAIN' | 'INTERNAL_LEDGER' | 'HYBRID' | 'FAILED';
  chain?: string;
  destinationAddress?: string;
  amount?: string;
  transactions?: SwapTransactionLeg[];
  details?: {
    fromAsset?: string;
    toAsset?: string;
    direction?: string;
    mode?: string;
  };
}

function inferFrontendRail(asset?: string, address?: string): SwapRail {
  const upper = (asset || '').trim().toUpperCase();
  if (upper === 'XRP') return 'XRPL';
  if (upper === 'XLM') return 'STELLAR';
  if (upper === 'NXL') {
    const clean = (address || '').trim();
    if (clean.startsWith('r')) return 'XRPL';
    if (clean.startsWith('G')) return 'STELLAR';
  }
  return 'INTERNAL_LEDGER';
}

function parseAssetsFromAmount(amount?: string): { fromAsset?: string; toAsset?: string } {
  if (typeof amount !== 'string') return {};
  const match = amount.match(/^\s*[\d.,]+\s+([A-Za-z0-9]+)\s*(?:->|→)\s*[\d.,]+\s+([A-Za-z0-9]+)/);
  if (!match) return {};
  return { fromAsset: match[1], toAsset: match[2] };
}

/**
 * Resolves whether a swap history entry is an internal ledger swap, a same-chain swap,
 * or a cross-chain bridge across two distinct blockchains.
 */
export function resolveSwapKind(entry: SwapHistoryClassificationInput): SwapKind {
  if (entry.settlementType === 'INTERNAL_LEDGER' || entry.swapKind === 'INTERNAL_LEDGER') {
    return 'INTERNAL_LEDGER';
  }
  if (entry.swapKind === 'SAME_CHAIN' || entry.swapKind === 'CROSS_CHAIN') {
    return entry.swapKind;
  }

  const direction = String(entry.details?.direction || '').toUpperCase();
  if (direction === 'XRPL_TO_STELLAR' || direction === 'STELLAR_TO_XRPL') {
    return 'CROSS_CHAIN';
  }
  const mode = String(entry.details?.mode || '').toUpperCase();
  if (mode === 'SOROBAN_BRIDGE_BURN' || mode === 'SOROBAN_BRIDGE_ESCROW') {
    return 'CROSS_CHAIN';
  }

  const legs = Array.isArray(entry.transactions) ? entry.transactions : [];
  const parsed = parseAssetsFromAmount(entry.amount);
  const fromAsset = entry.details?.fromAsset || parsed.fromAsset;
  const toAsset = entry.details?.toAsset || parsed.toAsset;

  const incomingLeg = legs.find((l) => l.direction === 'INCOMING');
  const outgoingOnChainLeg = [...legs].reverse().find((l) => l.direction === 'OUTGOING' && l.rail !== 'INTERNAL_LEDGER');
  const lastOutgoingLeg = [...legs].reverse().find((l) => l.direction === 'OUTGOING');

  const fromRail: SwapRail = incomingLeg?.rail || inferFrontendRail(fromAsset);
  const toRail: SwapRail =
    outgoingOnChainLeg?.rail || lastOutgoingLeg?.rail || inferFrontendRail(toAsset, entry.destinationAddress);

  if (fromRail === 'INTERNAL_LEDGER' && toRail === 'INTERNAL_LEDGER') {
    return 'INTERNAL_LEDGER';
  }
  if (fromRail !== 'INTERNAL_LEDGER' && toRail !== 'INTERNAL_LEDGER' && fromRail !== toRail) {
    return 'CROSS_CHAIN';
  }
  return 'SAME_CHAIN';
}

/**
 * Returns the human-readable label for a swap history entry.
 */
export function getSwapTypeLabel(entry: SwapHistoryClassificationInput): string {
  const kind = resolveSwapKind(entry);
  if (kind === 'INTERNAL_LEDGER') return 'Internal Ledger Swap';
  if (kind === 'CROSS_CHAIN') return 'Cross-Chain Bridge';
  return 'Same-Chain Swap';
}

export type SwapLegStage =
  | 'DEPOSIT'
  | 'INTERNAL_DEBIT'
  | 'AMM_SWAP'
  | 'INTERNAL_CREDIT'
  | 'ONCHAIN_PAYOUT'
  | 'ESCROW_RELEASE';

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

function railLabel(rail: SwapRail): string {
  if (rail === 'XRPL') return 'XRPL Testnet';
  if (rail === 'STELLAR') return 'Stellar Testnet';
  return 'NexusRail Internal Ledger';
}

interface SwapTransactionTimelineProps {
  transactions: SwapTransactionLeg[];
  compact?: boolean;
}

export function SwapTransactionTimeline({
  transactions,
  compact = false,
}: SwapTransactionTimelineProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-3 rounded-xl nexus-glass-surface border border-[var(--border)] text-[11px] font-mono text-[var(--muted)]">
        No transaction steps recorded yet.
      </div>
    );
  }

  const ordered = [...transactions].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const handleCopy = (val: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(val);
      setCopiedHash(val);
      setTimeout(() => setCopiedHash(null), 1800);
    }
  };

  return (
    <div className={compact ? 'space-y-2 font-mono text-xs' : 'space-y-2.5 font-mono text-xs'}>
      {ordered.map((leg, idx) => {
        const seq = leg.sequence || idx + 1;
        const isIncoming = leg.direction === 'INCOMING';
        const isSuccess = leg.status === 'SUCCESS';
        const isFailed = leg.status === 'FAILED';
        const hasRealHash = isRealOnChainTxHash(leg.txHash);
        const clickableUrl =
          hasRealHash && leg.rail !== 'INTERNAL_LEDGER' ? leg.explorerUrl : null;

        return (
          <div
            key={`${seq}-${leg.stage}-${idx}`}
            className={`rounded-xl border transition-colors ${
              compact ? 'p-2.5' : 'p-3.5'
            } ${
              isFailed
                ? 'bg-rose-500/5 border-rose-500/30'
                : isSuccess
                ? 'nexus-glass-surface border-[var(--border)]'
                : 'bg-amber-500/5 border-amber-500/30'
            }`}
          >
            {/* Header row: Sequence + Direction + Label + Status */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface-solid)] border border-[var(--border)] text-[11px] font-bold text-[var(--gold)] shrink-0">
                  #{seq}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${
                    isIncoming
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                  }`}
                >
                  {isIncoming ? (
                    <ArrowDownLeft className="w-3 h-3" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3" />
                  )}
                  <span>{leg.direction}</span>
                </span>

                <span className="text-[var(--foreground)] font-semibold truncate text-[11px]">
                  {leg.label}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-bold text-[var(--foreground)]">
                  {leg.amount} {leg.asset}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    isSuccess
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : isFailed
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : isFailed ? (
                    <XCircle className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  <span>{leg.status}</span>
                </span>
              </div>
            </div>

            {/* Rail + Address metadata */}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
              <span>Rail: {railLabel(leg.rail)}</span>
              {leg.toAddress && (
                <span className="truncate max-w-[260px]" title={leg.toAddress}>
                  To: {leg.toAddress}
                </span>
              )}
            </div>

            {/* Transaction Hash / Ledger Ref row */}
            <div className="mt-2 pt-2 border-t border-[var(--border)]/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              {hasRealHash && leg.txHash ? (
                <>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {clickableUrl ? (
                      <a
                        href={clickableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--gold)] hover:underline truncate font-mono"
                        title={leg.txHash}
                      >
                        {leg.txHash}
                      </a>
                    ) : (
                      <span className="text-[var(--foreground)] truncate font-mono" title={leg.txHash}>
                        {leg.txHash}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(leg.txHash!)}
                      className="text-[var(--muted)] hover:text-[var(--gold)] shrink-0 cursor-pointer"
                      title="Copy transaction hash"
                    >
                      {copiedHash === leg.txHash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {clickableUrl && (
                    <a
                      href={clickableUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--gold)] hover:underline font-bold shrink-0"
                    >
                      <span>View on Explorer</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </>
              ) : leg.rail === 'INTERNAL_LEDGER' ? (
                <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                  <span className="text-emerald-300/90">
                    Off-chain NexusRail Ledger (no blockchain tx hash)
                  </span>
                  {leg.ledgerRef && (
                    <span className="text-[var(--muted)] text-[10px]">
                      Ref: {leg.ledgerRef}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[var(--muted)]">
                  No on-chain transaction hash (not broadcast)
                </span>
              )}
            </div>

            {leg.errorMessage && (
              <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] leading-relaxed">
                {leg.errorMessage}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
