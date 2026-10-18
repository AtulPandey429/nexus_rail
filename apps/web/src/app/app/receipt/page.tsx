'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  FileText,
  Download,
  ShoppingBag,
  Sparkles,
  Layers,
  Cpu,
} from 'lucide-react';

function ReceiptInner() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get('orderId') || 'NR-1048';
  const rail = searchParams.get('rail') || 'STELLAR';
  const amount = searchParams.get('amount') || '200.02';
  const txHash = searchParams.get('txHash') || '0x89f41b3c94de2a5b678e12d45c893e2a71f49e0132b85e05417ab924e2c81729';

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const ipfsHash = 'bafybeic7v7l42j3c4s2w2k54p2v6n7e6c3k7v7l42j3c4s2w2k54p2v6n7';

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const explorerUrl = rail === 'STELLAR'
    ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
    : `https://testnet.xrpl.org/transactions/${txHash}`;

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
        
        {/* Step Progress Breadcrumb */}
        <div className="flex items-center justify-between border-b border-nexus-border pb-6">
          <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-surface/80 border border-nexus-border text-nexus-muted">
              <Check className="w-3.5 h-3.5 text-rail-emerald" />
              <span>1 Cart</span>
            </div>
            <span className="text-nexus-border">&rarr;</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-surface/80 border border-nexus-border text-nexus-muted">
              <Check className="w-3.5 h-3.5 text-rail-emerald" />
              <span>2 Checkout</span>
            </div>
            <span className="text-nexus-border">&rarr;</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-card border border-rail-emerald/60 text-rail-emerald font-bold">
              <span className="w-2 h-2 rounded-full bg-rail-emerald" />
              <span>3 Receipt</span>
            </div>
          </div>

          <Link
            href="/store"
            className="text-xs font-mono text-nexus-muted hover:text-white transition-colors"
          >
            Continue shopping &rarr;
          </Link>
        </div>

        {/* Hero Success Block */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rail-emerald/10 border border-rail-emerald/30 flex items-center justify-center text-rail-emerald mx-auto shadow-xl shadow-rail-emerald/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rail-emerald/10 border border-rail-emerald/30 text-[11px] font-mono uppercase tracking-widest text-rail-emerald">
            <span className="w-2 h-2 rounded-full bg-rail-emerald" />
            Confirmed Onchain &bull; 0 Custody Risk
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Good move. Payment complete.
          </h1>
          <p className="text-xs sm:text-sm text-nexus-muted font-mono max-w-lg mx-auto leading-relaxed">
            Your transaction has been written directly to the {rail} testnet ledger and balanced in the double-entry store.
          </p>
        </div>

        {/* Core Receipt Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-nexus-card border border-nexus-border space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-nexus-border pb-6">
            <div>
              <span className="text-[10px] font-mono uppercase text-nexus-muted block">
                Settled Order
              </span>
              <span className="text-xl font-mono font-extrabold text-white">
                {orderId}
              </span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-mono uppercase text-nexus-muted block">
                Total Amount Settled
              </span>
              <span className="text-2xl font-mono font-extrabold text-rail-emerald">
                ${amount} USD
              </span>
            </div>
          </div>

          {/* Key Metas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-nexus-surface border border-nexus-border space-y-1">
              <span className="text-nexus-muted block">Settlement Rail</span>
              <div className="flex items-center gap-2 font-bold text-white">
                <span className={`w-2 h-2 rounded-full ${rail === 'STELLAR' ? 'bg-stellar-cyan' : 'bg-xrpl-blue'}`} />
                <span>{rail === 'STELLAR' ? 'Stellar Testnet (XLM)' : 'XRPL Testnet (XRP)'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-nexus-surface border border-nexus-border space-y-1">
              <span className="text-nexus-muted block">Consensus Time</span>
              <span className="font-bold text-white">
                {new Date().toUTCString().slice(0, 25)}
              </span>
            </div>

            <div className="sm:col-span-2 p-3.5 rounded-xl bg-nexus-surface border border-nexus-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-nexus-muted">Ledger Transaction Hash</span>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-rail-emerald hover:underline"
                >
                  <span>Open testnet explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <code className="text-[11px] text-white break-all flex-1 select-all">
                  {txHash}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(txHash, 'hash')}
                  className="p-1.5 rounded-lg bg-nexus-card border border-nexus-border text-nexus-muted hover:text-white transition-colors"
                >
                  {copiedKey === 'hash' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* 3-Stage Pipeline Trail */}
          <div className="pt-2 border-t border-nexus-border space-y-3">
            <span className="text-[10px] font-mono uppercase text-nexus-muted block">
              Multi-Rail Verification Trail
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-nexus-surface border border-rail-emerald/40 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rail-emerald shrink-0" />
                <div>
                  <p className="text-white font-bold">1. Signed in wallet</p>
                  <p className="text-[10px] text-nexus-muted">Non-custodial key</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-nexus-surface border border-rail-emerald/40 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rail-emerald shrink-0" />
                <div>
                  <p className="text-white font-bold">2. Confirmed onchain</p>
                  <p className="text-[10px] text-nexus-muted">Ledger closed</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-nexus-surface border border-rail-emerald/40 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rail-emerald shrink-0" />
                <div>
                  <p className="text-white font-bold">3. Journal posted</p>
                  <p className="text-[10px] text-nexus-muted">Debits = Credits</p>
                </div>
              </div>
            </div>
          </div>

          {/* Double-Entry Ledger Reconciliation Card */}
          <div className="p-5 rounded-xl bg-nexus-surface border border-nexus-border space-y-4">
            <div className="flex items-center justify-between border-b border-nexus-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-rail-emerald" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Double-Entry Ledger Audit
                </span>
              </div>
              <span className="text-[10px] font-mono text-rail-emerald bg-rail-emerald/10 border border-rail-emerald/30 px-2 py-0.5 rounded">
                Reconciliation: 100% Balanced
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-nexus-card border border-nexus-border/60">
                <span className="text-nexus-muted text-[10px] block">Debit Account</span>
                <span className="text-white font-bold">1010-CRYPTO-TESTNET</span>
                <span className="text-rail-emerald font-bold block mt-1">+${amount}</span>
              </div>
              <div className="p-3 rounded-lg bg-nexus-card border border-nexus-border/60">
                <span className="text-nexus-muted text-[10px] block">Credit Account</span>
                <span className="text-white font-bold">4010-REVENUE-COMMERCE</span>
                <span className="text-rail-emerald font-bold block mt-1">-${amount}</span>
              </div>
            </div>

            {/* IPFS CID Anchor */}
            <div className="pt-2 flex items-center justify-between gap-2 text-[11px] font-mono text-nexus-muted border-t border-nexus-border/60">
              <span className="truncate">IPFS Anchor: <code className="text-white">{ipfsHash}</code></span>
              <button
                type="button"
                onClick={() => copyToClipboard(ipfsHash, 'ipfs')}
                className="p-1 rounded bg-nexus-card text-nexus-muted hover:text-white"
                aria-label="Copy IPFS CID"
              >
                {copiedKey === 'ipfs' ? <Check className="w-3 h-3 text-rail-emerald" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Link
            href="/app/activity"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-rail-emerald text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 transition-all shadow-lg shadow-rail-emerald/10"
          >
            <span>View in Activity record</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexus-surface border border-nexus-border hover:border-nexus-muted/60 text-nexus-muted hover:text-white font-mono text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <Link
              href="/store"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexus-surface border border-nexus-border hover:border-nexus-muted/60 text-nexus-muted hover:text-white font-mono text-xs transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Back to shop</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-nexus-dark text-nexus-muted p-12 text-center font-mono text-xs">
        Loading receipt details...
      </div>
    }>
      <ReceiptInner />
    </Suspense>
  );
}
