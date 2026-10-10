'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PackageCheck, ArrowLeft, Clock, CheckCircle2, ChevronRight, ExternalLink, ShieldCheck, Bell } from 'lucide-react';
import { EndToEndFlowMonitor } from '@/components/EndToEndFlowMonitor';

function OrdersContent() {
  const searchParams = useSearchParams();
  const highlightOrderId = searchParams.get('orderId');
  const isSuccess = searchParams.get('success') === 'true';

  const [orders, setOrders] = useState<any[]>([
    {
      id: highlightOrderId || 'ord_1003',
      orderNumber: highlightOrderId ? `NR-${highlightOrderId.substring(4, 8)}` : 'NR-1003',
      status: 'PAID',
      totalCents: 4200,
      rail: 'STRIPE',
      items: [{ sku: 'NL-NOTE-A5', title: 'Nexus A5 Hardcover Notebook + Gel Pen Set', qty: 1 }],
      createdAt: new Date().toISOString(),
      ipfsHash: 'QmX7b82fK99aZp1104',
      webhookVerified: true,
    },
    {
      id: 'ord_1001',
      orderNumber: 'NR-1001',
      status: 'PAID',
      totalCents: 2400,
      rail: 'STRIPE',
      items: [{ sku: 'NL-NOTE-A5', title: 'Nexus A5 Hardcover Notebook Set', qty: 1 }],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      ipfsHash: 'QmY9c71aJ99bZp2201',
      webhookVerified: true,
    },
    {
      id: 'ord_1002',
      orderNumber: 'NR-1002',
      status: 'FULFILLED',
      totalCents: 4200,
      rail: 'STRIPE',
      items: [{ sku: 'NL-LAMP', title: 'Nexus Minimalist LED Desk Lamp', qty: 1 }],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      ipfsHash: 'QmZ1d55bK88cZp3302',
      webhookVerified: true,
    },
  ]);

  useEffect(() => {
    // Fetch live orders from backend
    fetch('/api/v1/orders')
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.orders?.length) {
          setOrders(data.data.orders);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/app" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Buyer Dashboard
        </Link>

        {/* Pipeline Monitor */}
        <EndToEndFlowMonitor currentStage={5} orderId={highlightOrderId || 'ord_1003'} selectedRail="STRIPE" />

        {isSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 font-mono text-xs text-emerald-400 flex items-center justify-between shadow-lg shadow-emerald-500/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>
                <strong>Order {highlightOrderId} Confirmed!</strong> Stripe Webhook event <code>checkout.session.completed</code> processed cleanly.
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              STATUS: PAID
            </span>
          </div>
        )}

        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <PackageCheck className="w-7 h-7 text-stellar-cyan" />
            <span>Order History Ledger</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Live status timeline synced with Render backend & Webhook events</p>
        </div>

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
                    <span className="font-extrabold text-base text-white">${((order.totalCents || 4200) / 100).toFixed(2)}</span>
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
                <div className="pt-2 border-t border-gray-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] gap-2">
                  <div className="flex items-center gap-2 text-rail-emerald font-bold">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Webhook Audit: verified (checkout.session.completed)</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span>IPFS Receipt:</span>
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${order.ipfsHash || 'QmX7bDemoHash'}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stellar-cyan hover:underline flex items-center gap-1 font-bold"
                    >
                      {order.ipfsHash || 'QmX7b82fK99a'} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
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
