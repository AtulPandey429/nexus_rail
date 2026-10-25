'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { startStripeCheckout } from '@/lib/shop';

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  priceCents: number;
  onSuccess: (session: { url: string }) => void;
}

export function StripeCheckoutModal({ isOpen, onClose, onSuccess }: StripeCheckoutModalProps) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      await startStripeCheckout();
      onSuccess({ url: 'stripe' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe did not return a checkout URL.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="w-full max-w-md bg-nexus-card border border-gray-800 rounded-3xl p-6 space-y-4 text-white">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold">Stripe Checkout</h3>
          <button type="button" onClick={onClose} className="p-2 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-300">
          The charge is the cart total stored in the database. This window does not mark an order paid.
        </p>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-rail-emerald text-nexus-dark font-bold disabled:opacity-60"
        >
          {busy ? 'Contacting Stripe…' : 'Continue to Stripe Checkout'}
        </button>
      </div>
    </div>
  );
}
