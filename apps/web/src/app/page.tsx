'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { addSkuToCart, CatalogProduct, fetchCatalog } from '@/lib/shop';
import { AnalyticsLedgerDashboard } from '@/components/AnalyticsLedgerDashboard';

export default function Home() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingSku, setPendingSku] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog()
      .then(setProducts)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const addItem = async (sku: string) => {
    setPendingSku(sku);
    setNotice('');
    setError('');
    try {
      await addSkuToCart(sku);
      setNotice(`${sku} added to your cart.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that item.');
    } finally {
      setPendingSku(null);
    }
  };

  return (
    <main className="min-h-screen bg-nexus-dark text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <section className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-rail-emerald font-mono font-bold">NexusRail Enterprise Engine</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/30">
              Live Stellar & XRPL Testnet
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Multi-Rail Commerce & Automated Settlement.
          </h1>
          <p className="text-sm text-gray-300 leading-relaxed">
            Enterprise store powered by MongoDB primary storage, Stellar Horizon Testnet, XRPL Altnet, Stripe, and double-entry internal ledger with AI Agent Desk.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/app/cart" className="px-4 py-2 rounded-xl bg-rail-emerald text-nexus-dark text-sm font-bold shadow-lg shadow-rail-emerald/20 hover:opacity-95">
              Open Cart & Checkout
            </Link>
            <Link href="/rwa" className="px-4 py-2 rounded-xl border border-amber-400/50 text-amber-300 text-sm font-semibold hover:bg-amber-400/10">
              See Gold Prices
            </Link>
            <Link href="/app/guide" className="px-4 py-2 rounded-xl border border-cyber-purple/50 text-cyber-purple text-sm font-semibold hover:bg-cyber-purple/10">
              AI Agent Desk
            </Link>
          </div>
        </section>

        {notice && <p className="text-sm text-rail-emerald">{notice}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {loading && <p className="text-sm text-gray-400">Loading the catalog…</p>}
        {!loading && !error && products.length === 0 && (
          <p className="text-sm text-gray-400">The catalog is empty.</p>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product) => (
            <article key={product.sku} className="p-5 rounded-2xl bg-nexus-card border border-gray-800 space-y-3">
              <div>
                <h2 className="text-lg font-semibold">{product.title}</h2>
                <p className="text-sm text-gray-400 mt-1">{product.description}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rail-emerald font-semibold">${(product.priceCents / 100).toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => addItem(product.sku)}
                  disabled={pendingSku === product.sku}
                  className="px-3 py-2 rounded-xl bg-rail-emerald text-nexus-dark text-sm font-bold disabled:opacity-60"
                >
                  {pendingSku === product.sku ? 'Adding…' : 'Add to cart'}
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="pt-4">
          <AnalyticsLedgerDashboard />
        </section>
      </div>
    </main>
  );
}
