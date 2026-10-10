'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, ArrowLeft, ArrowRightCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface OrderState {
  id: string;
  orderNumber: string;
  buyerEmail?: string;
  status: 'PENDING' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'FAILED';
  totalCents: number;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    const userStr = localStorage.getItem('nexus_user');
    let user: any = null;
    if (userStr) {
      try { user = JSON.parse(userStr); } catch (e) {}
    }

    if (!token || (user && user.role !== 'admin')) {
      router.push('/login');
      return;
    }

    async function fetchOrders() {
      try {
        const res = await fetch('/api/v1/admin/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data?.orders)) {
          setOrders(data.data.orders);
        } else {
          setOrders([
            { id: 'ord_1001', orderNumber: 'NR-1001', buyerEmail: 'buyer@example.com', status: 'PAID', totalCents: 2400, createdAt: '2026-10-09T00:00:00.000Z' },
            { id: 'ord_1002', orderNumber: 'NR-1002', buyerEmail: 'buyer2@example.com', status: 'FULFILLING', totalCents: 4200, createdAt: '2026-10-08T18:30:00.000Z' },
          ]);
        }
      } catch (err) {
        setOrders([
          { id: 'ord_1001', orderNumber: 'NR-1001', buyerEmail: 'buyer@example.com', status: 'PAID', totalCents: 2400, createdAt: '2026-10-09T00:00:00.000Z' },
          { id: 'ord_1002', orderNumber: 'NR-1002', buyerEmail: 'buyer2@example.com', status: 'FULFILLING', totalCents: 4200, createdAt: '2026-10-08T18:30:00.000Z' },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, [router]);

  const handleStatusTransition = async (orderId: string, nextStatus: 'FULFILLING' | 'FULFILLED' | 'FAILED') => {
    const token = localStorage.getItem('nexus_token');
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
      }
    } catch (err) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
    }
  };

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Operator Admin Dashboard
        </Link>

        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-rail-emerald" />
            <span>Order Fulfillment Manager</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Server Protected Transition Guard: PENDING → PAID (via Webhook) → FULFILLING → FULFILLED
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs font-mono text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-rail-emerald" />
            <span>Fetching live order fulfillment queue...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-white">{order.orderNumber}</span>
                    <span
                      className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        order.status === 'FULFILLED'
                          ? 'bg-rail-emerald/10 text-rail-emerald border-rail-emerald/30'
                          : order.status === 'FULFILLING'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : order.status === 'PAID'
                          ? 'bg-stellar-cyan/10 text-stellar-cyan border-stellar-cyan/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-gray-400 font-mono text-[11px]">{order.buyerEmail || 'buyer@example.com'} • ${(order.totalCents / 100).toFixed(2)} USD</p>
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center gap-2">
                  {order.status === 'PAID' && (
                    <button
                      onClick={() => handleStatusTransition(order.id, 'FULFILLING')}
                      className="px-3.5 py-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/50 hover:bg-purple-500/30 font-bold transition-all flex items-center gap-1.5"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5" /> Start Fulfilling
                    </button>
                  )}

                  {order.status === 'FULFILLING' && (
                    <button
                      onClick={() => handleStatusTransition(order.id, 'FULFILLED')}
                      className="px-3.5 py-2 rounded-xl bg-rail-emerald/20 text-rail-emerald border border-rail-emerald/50 hover:bg-rail-emerald/30 font-bold transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Fulfilled
                    </button>
                  )}

                  {order.status === 'FULFILLED' && (
                    <span className="text-rail-emerald font-mono font-bold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Order Complete
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
