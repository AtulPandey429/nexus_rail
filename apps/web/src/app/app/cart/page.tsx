'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Trash2, ArrowLeft, CreditCard, ShieldCheck } from 'lucide-react';

export default function UserCartPage() {
  const [items, setItems] = useState([
    { sku: 'NL-NOTE-A5', title: 'Nexus A5 Hardcover Notebook Set', priceCents: 2400, qty: 1 },
    { sku: 'NL-PEN-SET', title: 'Nexus Precision Gel Pen Set', priceCents: 1800, qty: 1 },
  ]);

  const handleQtyChange = (sku: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => (item.sku === sku ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const handleRemove = (sku: string) => {
    setItems((prev) => prev.filter((item) => item.sku !== sku));
  };

  const totalCents = items.reduce((acc, item) => acc + item.priceCents * item.qty, 0);

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/app" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Buyer Dashboard
        </Link>

        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-rail-emerald" />
            <span>Shopping Cart</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Guest items merged automatically into Postgres ledger</p>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-gray-900/60 border border-gray-800 space-y-4">
            <p className="text-gray-400 text-sm">Your cart is currently empty.</p>
            <Link href="/" className="px-4 py-2 rounded-xl bg-rail-emerald text-nexus-dark font-bold text-xs inline-block">
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => (
                <div key={item.sku} className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800 flex justify-between items-center text-xs">
                  <div>
                    <h3 className="font-bold text-white text-sm">{item.title}</h3>
                    <p className="text-gray-400 font-mono text-[11px] mt-0.5">SKU: {item.sku}</p>
                    <p className="text-rail-emerald font-bold text-sm mt-1">${(item.priceCents / 100).toFixed(2)} USD</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-700 rounded-lg bg-nexus-dark overflow-hidden">
                      <button onClick={() => handleQtyChange(item.sku, -1)} className="px-2.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800">
                        -
                      </button>
                      <span className="px-3 font-mono font-bold">{item.qty}</span>
                      <button onClick={() => handleQtyChange(item.sku, 1)} className="px-2.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800">
                        +
                      </button>
                    </div>
                    <button onClick={() => handleRemove(item.sku)} className="p-2 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 space-y-6 h-fit">
              <h3 className="text-lg font-bold border-b border-gray-800 pb-3">Order Summary</h3>
              <div className="space-y-2 text-xs font-mono text-gray-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${(totalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Estimated Tax</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white border-t border-gray-800 pt-3">
                  <span>Total Due</span>
                  <span className="text-rail-emerald">${(totalCents / 100).toFixed(2)} USD</span>
                </div>
              </div>

              <Link
                href="/app/checkout"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rail-emerald to-stellar-cyan text-nexus-dark font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <CreditCard className="w-4 h-4" />
                <span>Proceed to Stripe Checkout</span>
              </Link>

              <div className="text-[11px] text-gray-400 flex items-center gap-1.5 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-rail-emerald" /> Stripe Test Mode • No Real Charges
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
