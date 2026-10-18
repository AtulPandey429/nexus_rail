'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { startStripeCheckout } from '@/lib/shop';

export default function PaymentPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      await startStripeCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe did not start checkout.');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-nexus-dark text-white px-4 py-10">
      <div className="max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Card payment</h1>
        <p className="text-sm text-gray-300">
          Payment is confirmed only after Stripe sends a signed webhook. This page does not mark an order paid.
        </p>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className="px-4 py-3 rounded-xl bg-rail-emerald text-nexus-dark font-bold disabled:opacity-60"
        >
          {busy ? 'Contacting Stripe…' : 'Continue to Stripe Checkout'}
        </button>
        <Link href="/app/cart" className="block text-sm text-stellar-cyan">
          Back to cart
        </Link>
      </div>
    </main>
  );
}
