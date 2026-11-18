'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommodityPrices, fetchCommodityPrices } from '@/lib/shop';

export default function RwaBuyPage() {
  const [prices, setPrices] = useState<CommodityPrices | null>(null);
  const [priceError, setPriceError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommodityPrices()
      .then(setPrices)
      .catch((err: Error) => setPriceError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Spot metal reference
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Live market rates used to price gold and silver allocations in NexusRail Smart Baskets.
          </p>
        </div>

        {loading && <p className="text-sm text-[var(--muted)]">Loading live quotes…</p>}
        {priceError && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            {priceError}
          </div>
        )}

        {prices && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-subtle)] p-5 space-y-1.5">
              <div className="text-xs font-medium text-[var(--muted)]">24K Gold (1 gram)</div>
              <div className="text-2xl font-semibold font-mono tabular-nums text-[var(--foreground)]">
                ${prices.goldUsd.toFixed(2)}
              </div>
              <div className="text-xs font-mono tabular-nums text-[var(--muted)]">
                ₹{prices.goldInr.toLocaleString('en-IN')} / g
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-subtle)] p-5 space-y-1.5">
              <div className="text-xs font-medium text-[var(--muted)]">Silver (1 gram)</div>
              <div className="text-2xl font-semibold font-mono tabular-nums text-[var(--foreground)]">
                ${prices.silverUsd.toFixed(2)}
              </div>
              <div className="text-xs font-mono tabular-nums text-[var(--muted)]">
                ₹{prices.silverInr.toLocaleString('en-IN')} / g
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted)]">
            Purchase gold and silver packs directly via Stellar, XRPL, Stripe, or $NXL.
          </p>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[#08090C] text-xs font-semibold transition-colors"
          >
            <span>Open Store</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
