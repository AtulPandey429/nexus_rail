'use client';

import React from 'react';
import Link from 'next/link';
import { PackageCheck, ArrowLeft, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

export default function UserOrdersPage() {
  const orders = [
    {
      id: 'ord_1001',
      orderNumber: 'NR-1001',
      status: 'PAID',
      totalCents: 2400,
      rail: 'STRIPE',
      items: [{ sku: 'NL-NOTE-A5', title: 'Nexus A5 Hardcover Notebook Set', qty: 1 }],
      createdAt: '2026-10-09T00:00:00.000Z',
    },
    {
      id: 'ord_1002',
      orderNumber: 'NR-1002',
      status: 'FULFILLED',
      totalCents: 4200,
      rail: 'STRIPE',
      items: [{ sku: 'NL-LAMP', title: 'Nexus Minimalist LED Desk Lamp', qty: 1 }],
      createdAt: '2026-10-08T18:30:00.000Z',
    },
  ];

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/app" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Buyer Dashboard
        </Link>

        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <PackageCheck className="w-7 h-7 text-stellar-cyan" />
            <span>My Orders</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Status Timeline: PENDING → PAID → FULFILLING → FULFILLED</p>
        </div>

        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-gray-700 transition-colors space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-800/80 pb-3">
                <div>
                  <span className="font-bold text-base text-white">{order.orderNumber}</span>
                  <span className="text-xs font-mono text-gray-400 ml-3">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                      order.status === 'FULFILLED'
                        ? 'bg-rail-emerald/10 text-rail-emerald border-rail-emerald/30'
                        : order.status === 'PAID'
                        ? 'bg-stellar-cyan/10 text-stellar-cyan border-stellar-cyan/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {order.status}
                  </span>
                  <span className="font-bold text-sm text-white">${(order.totalCents / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.sku} className="text-xs text-gray-300 flex justify-between">
                    <span>{item.title} × {item.qty}</span>
                    <span className="font-mono text-gray-400">{item.sku}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
