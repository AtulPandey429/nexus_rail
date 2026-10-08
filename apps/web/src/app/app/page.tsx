'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, PackageCheck, Bot, User, ArrowRight, ShieldAlert } from 'lucide-react';

export default function UserAppOverview() {
  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Banner */}
        <div className="p-3 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs font-mono flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>NexusRail User Dashboard • Personal Demo • Stripe Test Mode</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Buyer Dashboard</h1>
            <p className="text-gray-400 text-sm font-mono mt-1">Logged in as buyer@example.com</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/app/cart"
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white border border-gray-700 flex items-center gap-2 transition-all"
            >
              <ShoppingBag className="w-4 h-4 text-rail-emerald" />
              <span>View Cart</span>
            </Link>
            <Link
              href="/app/guide"
              className="px-4 py-2 rounded-xl bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/30 text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <Bot className="w-4 h-4" />
              <span>Catalog Guide</span>
            </Link>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cart Card */}
          <Link href="/app/cart" className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-rail-emerald transition-all group space-y-4">
            <div className="flex justify-between items-center text-rail-emerald">
              <ShoppingBag className="w-6 h-6" />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Shopping Cart</h3>
              <p className="text-xs text-gray-400 mt-1">Manage cart items, review subtotals, and start Stripe checkout.</p>
            </div>
          </Link>

          {/* Orders Card */}
          <Link href="/app/orders" className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-stellar-cyan transition-all group space-y-4">
            <div className="flex justify-between items-center text-stellar-cyan">
              <PackageCheck className="w-6 h-6" />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Order History</h3>
              <p className="text-xs text-gray-400 mt-1">Track status timelines (PENDING → PAID → FULFILLING → FULFILLED).</p>
            </div>
          </Link>

          {/* AI Catalog Guide */}
          <Link href="/app/guide" className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-cyber-purple transition-all group space-y-4">
            <div className="flex justify-between items-center text-cyber-purple">
              <Bot className="w-6 h-6" />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h3 className="text-lg font-bold">AI Catalog Guide</h3>
              <p className="text-xs text-gray-400 mt-1">Ask questions and get product recommendations safely.</p>
            </div>
          </Link>
        </div>

        {/* Back Link */}
        <div className="pt-6">
          <Link href="/" className="text-xs font-mono text-gray-400 hover:text-white transition-colors">
            ← Return to Home Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
