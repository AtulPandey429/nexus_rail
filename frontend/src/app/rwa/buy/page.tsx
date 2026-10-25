'use client';

import React, { useEffect, useState } from 'react';
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="p-6 rounded-3xl bg-nexus-card border border-gray-800 space-y-4">
        <h1 className="text-2xl font-bold">Gold and silver prices</h1>
        <p className="text-sm text-gray-400">
          These are market quotes. This shop does not issue a token and does not claim the quote is vaulted metal.
        </p>
        {loading && <p className="text-sm text-gray-400">Loading the quote…</p>}
        {priceError && <p className="text-sm text-rose-300">{priceError}</p>}
        {prices && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-amber-400/40">
              <div className="text-sm text-amber-300">Gold</div>
              <div className="text-lg font-semibold mt-1">${prices.goldUsd.toLocaleString()} / g</div>
              <div className="text-sm text-gray-300">₹{prices.goldInr.toLocaleString()} / g</div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-400/40">
              <div className="text-sm text-slate-200">Silver</div>
              <div className="text-lg font-semibold mt-1">${prices.silverUsd.toLocaleString()} / g</div>
              <div className="text-sm text-gray-300">₹{prices.silverInr.toLocaleString()} / g</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
