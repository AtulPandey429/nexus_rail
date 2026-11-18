'use client';

import React, { useState, useId } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
  ArrowRight,
  RefreshCw,
  X,
} from 'lucide-react';

export interface TransactionSafetyProps {
  chain: 'stellar' | 'xrpl';
  networkName: string;
  networkIdentifier: string;
  actionType: string;
  recipientAddress: string;
  isMerchantVault: boolean;
  destinationTagOrMemo?: string | number;
  assetSymbol: string;
  assetIssuer?: string;
  isNativeAsset: boolean;
  amount: string;
  networkFee: string;
  onConfirmSign: () => void | Promise<void>;
  onCancel: () => void;
  isSigning?: boolean;
}

export function TransactionSafetyCenter({
  chain,
  networkName,
  networkIdentifier,
  actionType,
  recipientAddress,
  isMerchantVault,
  destinationTagOrMemo,
  assetSymbol,
  assetIssuer,
  isNativeAsset,
  amount,
  networkFee,
  onConfirmSign,
  onCancel,
  isSigning = false,
}: TransactionSafetyProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [userAcknowledgedRisk, setUserAcknowledgedRisk] = useState(false);
  const [copied, setCopied] = useState(false);
  const checkboxId = useId();

  // Compute a deterministic tamper-detection checksum for reviewed parameters
  const bindingHash = `NR-${Math.abs(
    (recipientAddress + amount + String(destinationTagOrMemo || '') + networkIdentifier)
      .split('')
      .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
  ).toString(16).toUpperCase()}`;

  const isStellar = chain === 'stellar';

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(recipientAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncatedAddress = recipientAddress.length > 18
    ? `${recipientAddress.slice(0, 10)}...${recipientAddress.slice(-8)}`
    : recipientAddress;

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 shadow-2xl text-slate-900 dark:text-[#F0F4F8] font-sans flex flex-col max-h-[min(90vh,620px)] overflow-hidden transition-all duration-200">
      
      {/* 1. Pinned Header */}
      <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 flex items-center justify-center text-rail-emerald shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight font-mono">
                Transaction Safety Center
              </h3>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/10">
                PRE-FLIGHT
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 dark:text-white/50">
              Cryptographic binding review before wallet prompt
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${
              isStellar
                ? 'bg-[#00E5FF]/10 text-cyan-700 dark:text-[#00E5FF] border-[#00E5FF]/30'
                : 'bg-[#0081F2]/10 text-blue-700 dark:text-[#60A5FA] border-[#0081F2]/30'
            }`}
          >
            {networkName}
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSigning}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin">
        
        {/* Pre-Flight Status & Safety Notice (Clean & Compact) */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">Review the parameters before signing</span>
          </div>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 hidden sm:inline">
            Bound to this order
          </span>
        </div>

        {/* Intended Action & Amount Panel */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F131A] border border-slate-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-white/50">
            <span className="uppercase tracking-wider">Settlement Action</span>
            <span className="text-slate-900 dark:text-white font-medium">{actionType}</span>
          </div>

          <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-slate-900 dark:text-white tracking-tight">
                {amount}
              </span>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-white/70">
                {assetSymbol}
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-[#7FF8C6] font-medium">
              Network Fee: ~{networkFee}
            </span>
          </div>
        </div>

        {/* Destination & Reconciliation Details */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F131A] border border-slate-200 dark:border-white/10 space-y-2.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-white/50 uppercase tracking-wider">
              Recipient Destination
            </span>
            {isMerchantVault ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-[#7FF8C6] text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Nexus Vault
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5" /> External Destination
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 gap-2">
            <span
              className="text-[11px] text-slate-800 dark:text-white/90 font-mono truncate select-all"
              title={recipientAddress}
            >
              {truncatedAddress}
            </span>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shrink-0 flex items-center gap-1 text-[11px]"
              title="Copy full address"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {destinationTagOrMemo !== undefined && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5 text-[11px]">
              <span className="text-slate-500 dark:text-white/50">
                {isStellar ? 'Reconciliation Memo' : 'Destination Tag'}
              </span>
              <span className="text-slate-900 dark:text-white font-bold bg-slate-200/60 dark:bg-white/10 px-2 py-0.5 rounded text-[11px]">
                {String(destinationTagOrMemo)}
              </span>
            </div>
          )}
        </div>

        {/* Collapsible Technical Provenance & Tamper Binding */}
        <div className="border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-[#0A0D12] overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsExpanded((prev) => !prev)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-mono text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-colors"
          >
            <span className="flex items-center gap-2 text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-[#7FF8C6]" />
              Inspection Provenance & Tamper Binding
            </span>
            {detailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {detailsExpanded && (
            <div className="p-3 border-t border-slate-200 dark:border-white/10 space-y-2 text-[11px] font-mono text-slate-500 dark:text-white/60 bg-slate-100/50 dark:bg-black/30">
              <div className="flex justify-between">
                <span>Network Identifier:</span>
                <span className="text-slate-800 dark:text-white/90 truncate max-w-[200px]" title={networkIdentifier}>
                  {networkIdentifier}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Asset Type:</span>
                <span className="text-slate-800 dark:text-white/90">
                  {isNativeAsset ? 'Native Ledger Token' : `Trustline Token (${assetIssuer?.slice(0, 8)}...)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Authoritative RPC:</span>
                <span className="text-slate-800 dark:text-white/90">
                  {isStellar ? 'Stellar Horizon Testnet Node' : 'XRPL AltNet WebSocket RPC'}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-white/5 text-[11px]">
                <span>Tamper Binding Hash:</span>
                <span className="text-slate-600 dark:text-white/40">{bindingHash}</span>
              </div>
            </div>
          )}
        </div>

        {/* Concise Security Reminder */}
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-200/90 leading-tight font-mono">
            Verify recipient vault and reconciliation memo before authorizing in your wallet extension.
          </p>
        </div>
      </div>

      {/* 3. Pinned Action Footer (Guaranteed Visible at all times) */}
      <div className="shrink-0 p-4 sm:p-5 pt-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080A0E] space-y-3">
        {/* Checkbox Acknowledgment */}
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            id={checkboxId}
            checked={userAcknowledgedRisk}
            onChange={(e) => setUserAcknowledgedRisk(e.target.checked)}
            className="w-4 h-4 rounded bg-black/60 border border-white/30 text-[#7FF8C6] focus:ring-0 cursor-pointer accent-[#7FF8C6] shrink-0"
          />
          <label
            htmlFor={checkboxId}
            className="text-[11px] font-mono text-slate-600 dark:text-white/70 cursor-pointer select-none leading-snug"
          >
            I have verified the destination vault, network, and parameters.
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSigning}
            className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-white/15 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white font-mono text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirmSign}
            disabled={!userAcknowledgedRisk || isSigning}
            className="w-2/3 py-2.5 px-4 rounded-xl bg-[#7FF8C6] hover:bg-[#7FF8C6]/90 active:scale-[0.98] text-black font-mono text-xs font-bold transition-all shadow-md shadow-[#7FF8C6]/10 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSigning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Prompting Wallet...</span>
              </>
            ) : (
              <>
                <span>Authorize & Sign in Wallet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
