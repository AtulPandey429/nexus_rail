'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, CreditCard } from 'lucide-react';
import { CartLine, createOrderFromCart, fetchCartLines, removeCartSku, setCartQty, startStripeCheckout } from '@/lib/shop';

export default function UserCartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetchCartLines()
      .then((lines) => {
        setItems(lines);
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const changeQty = async (sku: string, qty: number) => {
    setError('');
    try {
      if (qty <= 0) await removeCartSku(sku);
      else await setCartQty(sku, qty);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the cart.');
    }
  };

  const proceedToMultiRail = async () => {
    setBusy(true);
    setError('');
    try {
      const order = await createOrderFromCart(items, 'MULTI');
      const orderTitle = items.map((i) => i.title).join(', ');
      router.push(`/app/checkout?orderId=${encodeURIComponent(order.id)}&title=${encodeURIComponent(orderTitle)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initialize Multi-Rail checkout.');
      setBusy(false);
    }
  };

  const checkout = async () => {
    setBusy(true);
    setError('');
    try {
      await startStripeCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setBusy(false);
    }
  };

  const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const canPay = items.length > 0 && items.every((item) => item.priced);

  return (
    <main className="min-h-screen bg-nexus-dark text-white px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Cart</h1>
          <p className="text-sm text-gray-400 mt-1">Items and prices come from your account. Choose Multi-Rail (XRPL, Stellar, Stripe, Wallet) or direct Stripe card.</p>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {loading ? (
          <p className="text-sm text-gray-400">Loading your cart…</p>
        ) : error ? null : items.length === 0 ? (
          <div className="p-8 rounded-2xl border border-gray-800 bg-nexus-card space-y-3">
            <p className="text-gray-300">Your cart is empty.</p>
            <Link href="/" className="inline-block px-4 py-2 rounded-xl bg-rail-emerald text-nexus-dark text-sm font-bold">
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => (
                <div key={item.sku} className="p-4 rounded-2xl bg-nexus-card border border-gray-800 flex justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="text-xs text-gray-400 mt-1">{item.sku}</p>
                    <p className="text-rail-emerald mt-2">
                      {item.priced ? `$${(item.priceCents / 100).toFixed(2)}` : 'Price unavailable'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => changeQty(item.sku, item.qty - 1)} className="px-2 py-1 border border-gray-700 rounded-lg">
                      −
                    </button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => changeQty(item.sku, item.qty + 1)} className="px-2 py-1 border border-gray-700 rounded-lg">
                      +
                    </button>
                    <button type="button" onClick={() => changeQty(item.sku, 0)} className="text-sm text-rose-300">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <aside className="p-5 rounded-2xl bg-nexus-card border border-gray-800 h-fit space-y-4">
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-rail-emerald">${(totalCents / 100).toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={proceedToMultiRail}
                  disabled={!canPay || busy}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rail-emerald via-teal-400 to-stellar-cyan text-nexus-dark font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-rail-emerald/20 disabled:opacity-50 hover:opacity-95 transition-opacity text-sm"
                >
                  <Zap className="w-4 h-4 fill-nexus-dark" />
                  <span>{busy ? 'Creating order…' : 'Multi-Rail Checkout (XRPL / Stellar)'}</span>
                </button>
                <button
                  type="button"
                  onClick={checkout}
                  disabled={!canPay || busy}
                  className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors text-xs"
                >
                  <CreditCard className="w-4 h-4 text-rail-emerald" />
                  <span>{busy ? 'Opening Stripe…' : 'Pay with Stripe Checkout'}</span>
                </button>
              </div>
              {!canPay && (
                <p className="text-sm text-amber-300">Remove any item that has no catalog price before you pay.</p>
              )}
              <p className="text-xs text-gray-400">Multi-Rail connects directly to live Stellar Horizon & XRPL altnet testnets.</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
