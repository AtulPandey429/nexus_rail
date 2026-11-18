'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  PackageCheck,
  CheckCircle2,
  ExternalLink,
  Receipt,
  Copy,
  Check,
  ShieldCheck,
  ShoppingBag,
  Search,
} from 'lucide-react';
import { fetchOrders } from '@/lib/shop';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'NODE-STAND': '/products/node-stand.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
  'RAIL-CABLES': '/products/rail-cables.png',
};

const SETTLED_STATUSES = ['PAID', 'FULFILLING', 'FULFILLED'];

type RailFilter = 'ALL' | 'STELLAR' | 'XRPL' | 'OTHER';

function matchesRailFilter(rail: string, filter: RailFilter) {
  const value = rail.toUpperCase();
  if (filter === 'ALL') return true;
  if (filter === 'STELLAR') return /STELLAR|XLM|USDC/.test(value);
  if (filter === 'XRPL') return /XRPL|XRP|RLUSD/.test(value);
  return !/STELLAR|XLM|USDC|XRPL|XRP|RLUSD/.test(value);
}

function explorerUrlForRail(rail: string, txHash?: string) {
  if (!txHash) return '';
  const value = rail.toUpperCase();
  if (/XRPL|XRP|RLUSD/.test(value)) return `https://testnet.xrpl.org/transactions/${txHash}`;
  if (/STELLAR|XLM|USDC/.test(value)) return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  return '';
}

function OrdersListContent() {
  const searchParams = useSearchParams();
  const highlightOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRail, setFilterRail] = useState<RailFilter>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchOrders()
      .then((apiRows) => {
        setOrders(Array.isArray(apiRows) ? apiRows : []);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyOrderNum = (num: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(num);
      setCopiedId(num);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const num = (o.orderNumber || o.id || '').toLowerCase();
    const rail = (o.rail || o.payment_rail || '').toUpperCase();
    const matchesSearch = !debouncedSearch || num.includes(debouncedSearch);
    return matchesSearch && matchesRailFilter(rail, filterRail);
  });

  const settledOrders = orders.filter((o) => SETTLED_STATUSES.includes(String(o.status || '').toUpperCase()));
  const totalSpentCents = settledOrders.reduce((sum, o) => sum + (o.totalCents || o.total_cents || 0), 0);
  const totalItemsCount = settledOrders.reduce((sum, o) => {
    const its = o.items || [];
    return sum + its.reduce((iSum: number, it: any) => iSum + (it.qty || 1), 0);
  }, 0);
  const railsPresent = Array.from(
    new Set(
      orders.map((o) => {
        const rail = String(o.rail || o.payment_rail || '').toUpperCase();
        if (/XRPL|XRP|RLUSD/.test(rail)) return 'XRPL';
        if (/STELLAR|XLM|USDC/.test(rail)) return 'STELLAR';
        return rail || 'OTHER';
      })
    )
  );

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased selection:bg-[var(--gold)]/30">
      <main className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
          <div>
            <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
              ACCOUNT / PURCHASES
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight mt-1">
              Your Orders
            </h1>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 font-normal">
              Track each order, check its settlement status, and open the receipt.
            </p>
          </div>

          <Link
            href="/store"
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-xs font-mono flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Continue Shopping</span>
          </Link>
        </div>

        {/* 3 Metric Tiles in Glassmorphic Finish */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 sm:p-5 rounded-2xl nexus-glass-surface space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
              TOTAL ORDERS PLACED
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--gold-bright)] tracking-tight">
              {String(orders.length).padStart(2, '0')}
            </p>
            <p className="text-[11px] font-mono text-[var(--muted)]">
              {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'} in settled orders
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl nexus-glass-surface space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
              TOTAL SPENT (USD)
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--foreground)] tracking-tight">
              ${(totalSpentCents / 100).toFixed(2)}
            </p>
            <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {settledOrders.length} of {orders.length} order{orders.length === 1 ? '' : 's'} settled
              </span>
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl nexus-glass-surface space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
              SETTLEMENT NETWORKS
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {railsPresent.length > 0 ? (
                railsPresent.map((rail) => (
                  <span
                    key={rail}
                    className="px-2 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] text-[10px] font-mono font-bold"
                  >
                    {rail}
                  </span>
                ))
              ) : (
                <span className="text-[11px] font-mono text-[var(--muted)]">No settlements yet</span>
              )}
            </div>
            <p className="text-[10px] font-mono text-[var(--muted)] pt-1">
              {railsPresent.length > 1 ? 'Dual-rail ledger' : 'Single-rail ledger'}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            {(['ALL', 'STELLAR', 'XRPL', 'OTHER'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFilterRail(r)}
                className={`px-3 py-1.5 rounded-xl transition-all font-medium cursor-pointer ${
                  filterRail === r
                    ? 'bg-[var(--gold)] text-black font-bold shadow-md'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] nexus-glass-surface'
                }`}
              >
                {r === 'ALL' ? 'All rails' : r === 'OTHER' ? 'Card / wallet' : r}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #..."
              className="w-full pl-9 pr-3 py-2 rounded-xl nexus-glass-surface text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted)]/50 focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            />
          </div>
        </div>

        {/* Order Cards Stack with Frosted Glass & Human-Readable IDs */}
        <div className="space-y-5">
          {loading && orders.length === 0 && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl nexus-glass-card p-5 sm:p-6 space-y-4">
                  <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
                  <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
                  <div className="h-3 w-56 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!loading && filteredOrders.length === 0 && (
            <div className="rounded-2xl nexus-glass-card border border-dashed border-[var(--border)] p-10 text-center space-y-3">
              <ShoppingBag className="w-9 h-9 mx-auto text-[var(--muted)] opacity-50" />
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {orders.length === 0 ? 'No orders yet' : 'No orders match this filter'}
              </h2>
              <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
                {orders.length === 0
                  ? 'Place your first order from the store and it will appear here with its receipt and explorer proof.'
                  : 'Try a different rail filter or clear the search field.'}
              </p>
              <Link
                href="/store"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-xs font-mono transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Browse the store</span>
              </Link>
            </div>
          )}

          {filteredOrders.map((order) => {
            const orderNum = order.orderNumber || order.id || '—';
            const totalUsd = ((order.totalCents || order.total_cents || 0) / 100).toFixed(2);
            const rail = (order.rail || order.payment_rail || 'UNKNOWN').toUpperCase();
            const status = String(order.status || 'PENDING').toUpperCase();
            const isSettled = SETTLED_STATUSES.includes(status);
            const items = Array.isArray(order.items) ? order.items : [];

            const txHash = order.txHash || order.tx_hash || '';
            const explorerUrl = explorerUrlForRail(rail, txHash);
            const statusTone = isSettled
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : status === 'PENDING' || status === 'UNDERPAID'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300';

            return (
              <div
                key={orderNum}
                className="rounded-2xl nexus-glass-card p-5 sm:p-6 shadow-xl space-y-4 hover:border-[var(--gold)]/60"
              >
                {/* Order Card Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-sm sm:text-base text-[var(--gold-bright)]">
                      {orderNum}
                    </span>

                    {/* Quick Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyOrderNum(orderNum)}
                      className="p-1 rounded text-[var(--gold)] hover:text-[var(--gold-bright)] hover:bg-[var(--gold)]/10 transition-colors"
                      title="Copy Order Reference"
                    >
                      {copiedId === orderNum ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className={`px-2.5 py-0.5 rounded-full border font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${statusTone}`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{status}</span>
                    </span>

                    <span className="text-xs font-mono text-[var(--muted)]">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--muted)]">Settled:</span>
                    <span className="text-lg font-mono font-bold text-[var(--gold-bright)]">
                      ${totalUsd} USD
                    </span>
                  </div>
                </div>

                {/* Line Items Grid with Thumbnails */}
                <div className="space-y-3 pt-1">
                  {items.map((item: any, idx: number) => {
                    const sku = item.sku || '—';
                    const imgUrl = PRODUCT_IMAGE_MAP[sku];
                    const price = ((item.unit_price_cents || item.priceCents || item.price_cents || 0) / 100).toFixed(2);
                    const qty = item.qty || 1;

                    return (
                      <div key={idx} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--border)] overflow-hidden shrink-0 relative shadow-sm flex items-center justify-center">
                            {imgUrl ? (
                              <Image
                                src={imgUrl}
                                alt={item.title || sku}
                                fill
                                sizes="40px"
                                className="object-cover object-center"
                              />
                            ) : (
                              <ShoppingBag className="w-4 h-4 text-[var(--muted)]" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {item.title || sku}
                            </p>
                            <p className="text-[11px] font-mono text-[var(--muted)]">
                              Qty {qty} · SKU {sku}
                            </p>
                          </div>
                        </div>

                        <div className="text-right font-mono text-xs text-[var(--foreground)]">
                          ${price}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Card Action Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--border)] text-xs font-mono">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                    <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0" />
                    <span>
                      {isSettled ? `Settled on ${rail}` : `Awaiting payment on ${rail}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl nexus-glass-surface hover:border-[var(--gold)]/50 text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
                      >
                        <span>Explorer proof</span>
                        <ExternalLink className="w-3 h-3 text-[var(--gold)]" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-[var(--muted)]">No explorer proof yet</span>
                    )}

                    <Link
                      href={`/receipt?orderId=${encodeURIComponent(orderNum)}`}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>View receipt</span>
                    </Link>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 font-mono text-[var(--muted)]">Loading orders...</div>}>
      <OrdersListContent />
    </Suspense>
  );
}
