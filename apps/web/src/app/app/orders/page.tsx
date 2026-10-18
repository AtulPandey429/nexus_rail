'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PackageCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import { fetchOrders } from '@/lib/shop';

function OrdersContent() {
  const searchParams = useSearchParams();
  const highlightOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders()
      .then((rows) => {
        setOrders(rows);
        setLoadError('');
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const highlight = orders.find((order) => order.id === highlightOrderId);
  const paid = highlight?.status === 'PAID' || highlight?.status === 'FULFILLING' || highlight?.status === 'FULFILLED';

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {highlightOrderId && !loading && !loadError && (
          <div className="p-4 rounded-2xl bg-nexus-card border border-gray-700 font-mono text-xs text-gray-200">
            {paid
              ? `Order ${highlight?.orderNumber || highlightOrderId} is ${highlight?.status} in the database.`
              : `Order ${highlightOrderId} is ${highlight?.status || 'not in your orders yet'}. A card payment stays pending until Stripe’s webhook marks it paid.`}
          </div>
        )}

        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <PackageCheck className="w-7 h-7 text-stellar-cyan" />
            <span>Your orders</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">Status and amounts come from your orders in the database.</p>
        </div>

        {loadError && <p className="text-sm text-rose-300">{loadError}</p>}
        {loading && <p className="text-sm text-gray-400">Loading orders…</p>}
        {!loading && orders.length === 0 && !loadError && (
          <p className="text-sm text-gray-400">You do not have any orders yet.</p>
        )}

        <div className="space-y-4">
          {orders.map((order) => {
            const isHighlighted = highlightOrderId && order.id === highlightOrderId;

            return (
              <div
                key={order.id}
                className={`p-6 rounded-2xl border transition-all space-y-4 font-mono ${
                  isHighlighted
                    ? 'bg-emerald-950/20 border-emerald-500/60 shadow-xl shadow-emerald-500/10'
                    : 'bg-gray-900/80 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base text-white">{order.orderNumber || order.id}</span>
                    <span className="text-xs text-gray-400">
                      {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                        order.status === 'FULFILLED'
                          ? 'bg-rail-emerald/10 text-rail-emerald border-rail-emerald/30'
                          : order.status === 'PAID'
                          ? 'bg-stellar-cyan/10 text-stellar-cyan border-stellar-cyan/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {order.status}
                    </span>
                    <span className="font-extrabold text-base text-white">${((order.totalCents || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  {(order.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-gray-300 flex justify-between items-center">
                      <span>{item.title || item.sku} × {item.qty || 1}</span>
                      <span className="text-gray-500 text-[11px]">Rail: {order.rail || 'STRIPE'}</span>
                    </div>
                  ))}
                </div>

                {/* Webhook & IPFS Metadata Footer */}
                {order.ipfsHash && (
                  <div className="pt-2 border-t border-gray-800/60 text-[11px] text-gray-400 flex items-center gap-2">
                    <span>Delivery receipt:</span>
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${order.ipfsHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stellar-cyan hover:underline inline-flex items-center gap-1"
                    >
                      {order.ipfsHash} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function UserOrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-nexus-dark text-white p-12 font-mono">Loading orders...</div>}>
      <OrdersContent />
    </Suspense>
  );
}
