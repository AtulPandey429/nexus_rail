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

const INITIAL_MOCK_ORDERS = [
  {
    id: '#NR8K2P9X',
    orderNumber: '#NR8K2P9X',
    totalCents: 20002,
    rail: 'STELLAR',
    token: 'XLM',
    status: 'PAID',
    createdAt: '2026-10-18T14:32:24Z',
    txHash: '8fa2b109c91d4e02aaef06aa74b18086343e6f7df6f4a32570e361d2ed4ecf0946',
    ledgerSequence: '5,284,901',
    items: [
      { sku: 'RAIL-ONE', title: 'Rail One', description: 'Graphite · Dual-Rail Processor', qty: 1, unit_price_cents: 12900 },
      { sku: 'RELAY-MAT', title: 'Relay Desk Mat', description: 'Charcoal · 80 × 40 cm', qty: 1, unit_price_cents: 3900 },
      { sku: 'NEXUS-TEE', title: 'Nexus Tee', description: 'Washed Black · Size M', qty: 1, unit_price_cents: 3200 },
    ],
  },
  {
    id: '#NR3M7V9Q',
    orderNumber: '#NR3M7V9Q',
    totalCents: 5801,
    rail: 'XRPL',
    token: 'XRP',
    status: 'PAID',
    createdAt: '2026-10-17T09:41:10Z',
    txHash: '2F84AE95420138AC529524584288424AE01488204928A4081024881024881024',
    ledgerSequence: '5,280,119',
    items: [
      { sku: 'NODE-STAND', title: 'Node Stand', description: 'Anodized aluminum', qty: 1, unit_price_cents: 5800 },
    ],
  },
  {
    id: '#NR9W2F4L',
    orderNumber: '#NR9W2F4L',
    totalCents: 3200,
    rail: 'STELLAR',
    token: 'XLM',
    status: 'PAID',
    createdAt: '2026-10-15T11:06:00Z',
    txHash: '19ef47b38c201d4a991823101831821038102381203812038120381023810238',
    ledgerSequence: '5,269,440',
    items: [
      { sku: 'NEXUS-TEE', title: 'Nexus Tee', description: 'Washed Black · Size M', qty: 1, unit_price_cents: 3200 },
    ],
  },
];

function OrdersListContent() {
  const searchParams = useSearchParams();
  const highlightOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState<any[]>(INITIAL_MOCK_ORDERS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRail, setFilterRail] = useState<'ALL' | 'STELLAR' | 'XRPL'>('ALL');
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
        if (Array.isArray(apiRows) && apiRows.length > 0) {
          const combined = [...apiRows];
          for (const m of INITIAL_MOCK_ORDERS) {
            if (!combined.some((c) => (c.orderNumber || c.id) === m.orderNumber)) {
              combined.push(m);
            }
          }
          setOrders(combined);
        }
      })
      .catch(() => {})
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
    const matchesRail = filterRail === 'ALL' || rail.includes(filterRail);
    return matchesSearch && matchesRail;
  });

  const totalSpentCents = orders.reduce((sum, o) => sum + (o.totalCents || o.total_cents || 0), 0);
  const totalItemsCount = orders.reduce((sum, o) => {
    const its = o.items || [];
    return sum + its.reduce((iSum: number, it: any) => iSum + (it.qty || 1), 0);
  }, 0);

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
              Review verified on-chain purchases, inspect cryptographic hashes, and open official receipts.
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
              0{orders.length}
            </p>
            <p className="text-[11px] font-mono text-[var(--muted)]">
              {totalItemsCount} verified items purchased
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
              <span>100% On-Chain Settled</span>
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl nexus-glass-surface space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
              SETTLEMENT NETWORKS
            </p>
            <div className="flex gap-2 pt-1">
              <span className="px-2 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] text-[10px] font-mono font-bold">
                STELLAR
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] text-[10px] font-mono font-bold">
                XRPL
              </span>
            </div>
            <p className="text-[10px] font-mono text-[var(--muted)] pt-1">
              Dual-Rail Ledger Consensus
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            {(['ALL', 'STELLAR', 'XRPL'] as const).map((r) => (
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
                {r === 'ALL' ? 'All Rails' : `${r} Only`}
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
          {filteredOrders.map((order) => {
            const orderNum = order.orderNumber || order.id || '#NR8K2P9X';
            const totalUsd = ((order.totalCents || order.total_cents || 20000) / 100).toFixed(2);
            const rail = (order.rail || order.payment_rail || 'STELLAR').toUpperCase();
            const items = order.items && order.items.length > 0 ? order.items : [
              { sku: 'RAIL-ONE', title: 'Rail One', qty: 1, unit_price_cents: 12900 },
              { sku: 'RELAY-MAT', title: 'Relay Desk Mat', qty: 1, unit_price_cents: 3900 },
              { sku: 'NEXUS-TEE', title: 'Nexus Tee', qty: 1, unit_price_cents: 3200 },
            ];

            const txHash = order.txHash || order.tx_hash || '8fa2b109c91d4e02aaef06aa74b18086343e6f7df6f4a32570e361d2ed4ecf0946';
            const explorerUrl = rail.includes('STELLAR')
              ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
              : `https://testnet.xrpl.org/transactions/${txHash}`;

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

                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{order.status || 'PAID'}</span>
                    </span>

                    <span className="text-xs font-mono text-[var(--muted)]">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '18 Oct 2026'}
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
                    const sku = item.sku || 'RAIL-ONE';
                    const imgUrl = PRODUCT_IMAGE_MAP[sku] || '/products/rail-one.png';
                    const price = ((item.unit_price_cents || item.priceCents || item.price_cents || 12900) / 100).toFixed(2);
                    const qty = item.qty || 1;

                    return (
                      <div key={idx} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--border)] overflow-hidden shrink-0 relative shadow-sm">
                            <Image
                              src={imgUrl}
                              alt={item.title || sku}
                              fill
                              sizes="40px"
                              className="object-cover object-center"
                            />
                          </div>
                          <div>
                            <p className="font-serif italic text-sm text-[var(--foreground)]">
                              {item.title || sku}
                            </p>
                            <p className="text-[10px] font-mono text-[var(--muted)]">
                              Qty: 0{qty} · SKU: {sku}
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
                    <span>Settled via {rail} Consensus Ledger</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl nexus-glass-surface hover:border-[var(--gold)]/50 text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
                    >
                      <span>Explorer Proof</span>
                      <ExternalLink className="w-3 h-3 text-[var(--gold)]" />
                    </a>

                    <Link
                      href={`/receipt?orderId=${encodeURIComponent(orderNum)}`}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>View Official Receipt</span>
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
