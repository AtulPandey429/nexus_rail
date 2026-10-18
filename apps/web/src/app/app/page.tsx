'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, PackageCheck, Bot, ArrowRight } from 'lucide-react';
import { readSession } from '@/lib/shop';

export default function UserAppOverview() {
  const [label, setLabel] = useState('Sign in to see your account');

  useEffect(() => {
    const { user } = readSession();
    if (user?.email) setLabel(user.email);
    else if (user?.walletAddress) setLabel(user.walletAddress);
    else if (user) setLabel('Signed in');
  }, []);

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your account</h1>
            <p className="text-gray-400 text-sm mt-1">{label}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/app/cart" className="px-4 py-2 rounded-xl bg-gray-800 text-sm font-semibold border border-gray-700">
              Cart
            </Link>
            <Link href="/app/guide" className="px-4 py-2 rounded-xl bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple text-sm font-semibold">
              Catalog guide
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/app/cart" className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-rail-emerald space-y-3">
            <ShoppingBag className="w-6 h-6 text-rail-emerald" />
            <h2 className="text-lg font-bold">Cart</h2>
            <p className="text-sm text-gray-400">Review items and pay with a Stripe test card.</p>
            <ArrowRight className="w-4 h-4 text-gray-400" />
          </Link>
          <Link href="/app/orders" className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-stellar-cyan space-y-3">
            <PackageCheck className="w-6 h-6 text-stellar-cyan" />
            <h2 className="text-lg font-bold">Orders</h2>
            <p className="text-sm text-gray-400">See whether an order is waiting, paid, or fulfilled.</p>
          </Link>
          <Link href="/app/guide" className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-cyber-purple space-y-3">
            <Bot className="w-6 h-6 text-cyber-purple" />
            <h2 className="text-lg font-bold">Catalog guide</h2>
            <p className="text-sm text-gray-400">Ask for a suggestion. You still confirm anything that is added.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
