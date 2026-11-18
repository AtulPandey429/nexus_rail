'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { CommodityPrices, fetchCommodityPrices } from '@/lib/shop';

export function RwaGoldVaultCard() {
  const [prices, setPrices] = useState<CommodityPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPrices = () => {
    setLoading(true);
    setError('');
    fetchCommodityPrices()
      .then(setPrices)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPrices();
  }, []);

  return (
    <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Live precious metals
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Real-time spot quotes per gram from live market oracles.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPrices}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-subtle)] text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-subtle)] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">24K Gold (PAXG)</span>
            <span className="text-[11px] font-mono text-[var(--gold)]">XAU / g</span>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[var(--foreground)]">
            {prices ? `$${prices.goldUsd.toFixed(2)}` : loading ? '—' : 'Unavailable'}
          </div>
          <div className="text-xs font-mono tabular-nums text-[var(--muted)]">
            {prices ? `₹${prices.goldInr.toLocaleString('en-IN')} / gram` : 'Fetching live rate…'}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-subtle)] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">Silver (KAG)</span>
            <span className="text-[11px] font-mono text-slate-300">XAG / g</span>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[var(--foreground)]">
            {prices ? `$${prices.silverUsd.toFixed(2)}` : loading ? '—' : 'Unavailable'}
          </div>
          <div className="text-xs font-mono tabular-nums text-[var(--muted)]">
            {prices ? `₹${prices.silverInr.toLocaleString('en-IN')} / gram` : 'Fetching live rate…'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--muted)]">
          Buy gold and silver allocations inside Smart Baskets or live store packs.
        </p>
        <Link
          href="/store"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[#08090C] text-xs font-semibold transition-colors"
        >
          <span>Browse live baskets</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}
