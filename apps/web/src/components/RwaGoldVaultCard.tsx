'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CommodityPrices, fetchCommodityPrices } from '@/lib/shop';

export function RwaGoldVaultCard() {
  const [prices, setPrices] = useState<CommodityPrices | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCommodityPrices()
      .then(setPrices)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="w-full bg-nexus-card border border-gray-800 rounded-3xl p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Gold and silver prices</h2>
        <p className="text-sm text-gray-400 mt-1">Market quote per gram. Not a custody balance.</p>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-amber-400/40 bg-amber-500/10">
          <div className="text-sm text-amber-300">Gold</div>
          <div className="text-2xl font-bold mt-2">{prices ? `$${prices.goldUsd.toFixed(2)}` : '…'}</div>
          <div className="text-sm text-gray-400">{prices ? `₹${prices.goldInr.toLocaleString()} / g` : 'Loading'}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-900/60">
          <div className="text-sm text-slate-200">Silver</div>
          <div className="text-2xl font-bold mt-2">{prices ? `$${prices.silverUsd.toFixed(2)}` : '…'}</div>
          <div className="text-sm text-gray-400">{prices ? `₹${prices.silverInr.toLocaleString()} / g` : 'Loading'}</div>
        </div>
      </div>
      <Link href="/rwa/buy" className="inline-flex px-4 py-2 rounded-xl bg-amber-400 text-nexus-dark text-sm font-bold">
        See prices
      </Link>
    </div>
  );
}
