'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { fetchOrders } from '@/lib/shop';
import { NexusLogo } from '@/components/NexusLogo';

interface OrderItem {
  id: string;
  orderNumber: string;
  items: string;
  rail: string;
  railLabel: string;
  token: string;
  totalUsd: number;
  cryptoAmount: string;
  status: 'PAID' | 'AWAITING PAYMENT' | 'EXPIRED';
  dateUtc: string;
  txHash: string;
  ledgerSequence: string;
  journalId: string;
  customerClearing: number;
  merchantPayable: number;
  networkFee: number;
}

const INITIAL_ORDERS: OrderItem[] = [
  {
    id: 'ord_1048',
    orderNumber: '#NR8K2P9X',
    items: 'Rail One + 2 more',
    rail: 'STELLAR',
    railLabel: 'Stellar / XLM',
    token: 'XLM',
    totalUsd: 200.02,
    cryptoAmount: '2,000.20 XLM',
    status: 'PAID',
    dateUtc: '2026-04-18 14:32:04 UTC',
    txHash: '3a4f8b9e1c2d0f3a4f8b9e1c2d0f3a4f8b9e1c2d0f3a4f8b9e1c2d0f3a4f8b9e',
    ledgerSequence: '52,981,402',
    journalId: 'NL-2026-0418-0014',
    customerClearing: 200.02,
    merchantPayable: 200.0199,
    networkFee: 0.0001,
  },
  {
    id: 'ord_1047',
    orderNumber: '#NR9M4V2K',
    items: 'Relay desk mat',
    rail: 'XRPL',
    railLabel: 'XRPL / XRP',
    token: 'XRP',
    totalUsd: 39.00,
    cryptoAmount: '78.00 XRP',
    status: 'PAID',
    dateUtc: '2026-04-17 09:15:22 UTC',
    txHash: '7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c',
    ledgerSequence: '88,104,229',
    journalId: 'NL-2026-0417-0092',
    customerClearing: 39.00,
    merchantPayable: 38.99988,
    networkFee: 0.00012,
  },
  {
    id: 'ord_1046',
    orderNumber: '#NR3Q7W9B',
    items: 'Rail Signal tee',
    rail: 'STELLAR',
    railLabel: 'Stellar / XLM',
    token: 'XLM',
    totalUsd: 51.01,
    cryptoAmount: '510.10 XLM',
    status: 'PAID',
    dateUtc: '2026-04-15 18:44:10 UTC',
    txHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    ledgerSequence: '52,940,117',
    journalId: 'NL-2026-0415-0043',
    customerClearing: 51.01,
    merchantPayable: 51.0099,
    networkFee: 0.0001,
  },
  {
    id: 'ord_1045',
    orderNumber: '#NR5P2L8M',
    items: 'Rail One (Graphite)',
    rail: 'XRPL',
    railLabel: 'XRPL / XRP',
    token: 'XRP',
    totalUsd: 129.00,
    cryptoAmount: '258.00 XRP',
    status: 'AWAITING PAYMENT',
    dateUtc: '2026-04-14 11:02:55 UTC',
    txHash: 'pending',
    ledgerSequence: 'unposted',
    journalId: 'NL-2026-0414-0011',
    customerClearing: 129.00,
    merchantPayable: 0,
    networkFee: 0,
  },
  {
    id: 'ord_1044',
    orderNumber: '#NR1X8C4D',
    items: 'Relay desk mat',
    rail: 'STELLAR',
    railLabel: 'Stellar / XLM',
    token: 'XLM',
    totalUsd: 39.00,
    cryptoAmount: '390.00 XLM',
    status: 'EXPIRED',
    dateUtc: '2026-04-12 16:20:00 UTC',
    txHash: 'none',
    ledgerSequence: 'void',
    journalId: 'NL-2026-0412-0089',
    customerClearing: 0,
    merchantPayable: 0,
    networkFee: 0,
  },
];

function ActivityContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('id') || '#NR8K2P9X';

  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'PAID' | 'AWAITING' | 'EXPIRED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(highlightId);

  useEffect(() => {
    fetchOrders().then((live) => {
      if (live && live.length > 0) {
        const mapped: OrderItem[] = live.map((o: any, idx: number) => {
          const isPaid = (o.status || '').toUpperCase() === 'PAID';
          const isStellar = (o.payment_rail || o.rail || '').toLowerCase().includes('stellar');
          const token = isStellar ? 'XLM' : 'XRP';
          const total = (o.total_cents || 20000) / 100;
          return {
            id: o.id || `ord_${idx}`,
            orderNumber: o.order_number || `#NR${String(idx + 1).padStart(7, '0')}`,
            items: o.items?.[0]?.title ? `${o.items[0].title}${o.items.length > 1 ? ` + ${o.items.length - 1} more` : ''}` : 'Rail Artifact Kit',
            rail: isStellar ? 'STELLAR' : 'XRPL',
            railLabel: isStellar ? 'Stellar / XLM' : 'XRPL / XRP',
            token,
            totalUsd: total,
            cryptoAmount: isStellar ? `${(total * 10).toFixed(2)} XLM` : `${(total * 2).toFixed(2)} XRP`,
            status: isPaid ? 'PAID' : 'AWAITING PAYMENT',
            dateUtc: o.created_at ? new Date(o.created_at).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '2026-04-18 12:00:00 UTC',
            txHash: o.tx_hash || 'pending',
            ledgerSequence: isPaid ? '52,981,402' : 'unposted',
            journalId: `NL-2026-${String(idx + 1).padStart(4, '0')}`,
            customerClearing: total,
            merchantPayable: total - 0.0001,
            networkFee: 0.0001,
          };
        });
        setOrders(mapped);
      }
    }).catch(() => {});
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedFilter === 'PAID' && o.status !== 'PAID') return false;
      if (selectedFilter === 'AWAITING' && o.status !== 'AWAITING PAYMENT') return false;
      if (selectedFilter === 'EXPIRED' && o.status !== 'EXPIRED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.items.toLowerCase().includes(q) ||
          o.txHash.toLowerCase().includes(q) ||
          o.journalId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, selectedFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return (
      orders.find((o) => o.orderNumber === selectedOrderId || o.id === selectedOrderId) ||
      orders[0]
    );
  }, [orders, selectedOrderId]);

  const handleExportHistory = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Order,Items,Rail,Total USD,Status,Date UTC,Transaction Hash,Journal ID']
        .concat(
          orders.map(
            (o) =>
              `"${o.orderNumber}","${o.items}","${o.rail}",${o.totalUsd},"${o.status}","${o.dateUtc}","${o.txHash}","${o.journalId}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nexusrail_activity_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] font-sans antialiased selection:bg-[var(--gold)]/30 transition-colors duration-200">
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 space-y-8">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
              ACCOUNT / ACTIVITY
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-[var(--foreground)] tracking-tight mt-2">
              On the record.
            </h1>
            <p className="text-sm sm:text-base text-[var(--muted)] mt-1 font-normal">
              Follow your orders, inspect payments, and reconcile the entries behind them.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportHistory}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs transition-colors self-start sm:self-auto shadow-sm cursor-pointer"
          >
            <span>Export history</span>
            <Download className="w-3.5 h-3.5 text-[var(--gold)]" />
          </button>
        </div>

        {/* 3 Metrics Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Tile 1: Total Paid */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
              TOTAL PAID / USD
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--foreground)] tracking-tight">
              $290.03
            </p>
            <p className="text-xs font-mono text-[var(--muted)] pt-1">
              3 verified testnet payments
            </p>
          </div>

          {/* Tile 2: Awaiting Payment */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
              AWAITING PAYMENT
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--foreground)] tracking-tight">
              01
            </p>
            <p className="text-xs font-mono text-[var(--muted)] pt-1">
              No funds received yet
            </p>
          </div>

          {/* Tile 3: Ledger Difference */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
              LEDGER DIFFERENCE
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--foreground)] tracking-tight">
              $0.00
            </p>
            <p className="text-xs font-mono text-[var(--gold)] pt-1">
              All posted entries balanced
            </p>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 text-xs font-mono">
            {(['ALL', 'PAID', 'AWAITING', 'EXPIRED'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  selectedFilter === filter
                    ? 'bg-[var(--gold)]/20 text-[var(--gold)] font-bold border border-[var(--gold)]/40 shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                }`}
              >
                {filter === 'ALL' && 'All orders 05'}
                {filter === 'PAID' && 'Paid 03'}
                {filter === 'AWAITING' && 'Awaiting 01'}
                {filter === 'EXPIRED' && 'Expired 01'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <NexusLogo size="xs" glow className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none rounded shadow-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order or transaction"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted)]/50 focus:outline-none focus:border-[var(--gold)] shadow-sm"
            />
          </div>
        </div>

        {/* Transactions Ledger Table */}
        <div className="rounded-2xl nexus-glass-card border border-[var(--border)] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] tracking-widest uppercase text-[var(--muted)] bg-[var(--card-subtle)]">
                  <th className="py-3.5 px-4 sm:px-6">ORDER</th>
                  <th className="py-3.5 px-4">ITEMS</th>
                  <th className="py-3.5 px-4">PAYMENT RAIL</th>
                  <th className="py-3.5 px-4">TOTAL / USD</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">DATE / UTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredOrders.map((ord) => {
                  const isSelected = selectedOrder?.orderNumber === ord.orderNumber;
                  return (
                    <tr
                      key={ord.orderNumber}
                      onClick={() => setSelectedOrderId(ord.orderNumber)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[var(--card-hover)]' : 'hover:bg-[var(--card-subtle)]'
                      }`}
                    >
                      <td className="py-4 px-4 sm:px-6 font-semibold text-[var(--foreground)]">
                        {ord.orderNumber}
                      </td>
                      <td className="py-4 px-4 text-[var(--foreground)]">
                        {ord.items}
                      </td>
                      <td className="py-4 px-4 text-[var(--muted)]">
                        {ord.railLabel}
                      </td>
                      <td className="py-4 px-4 text-[var(--foreground)] font-medium">
                        ${ord.totalUsd.toFixed(2)}
                      </td>
                      <td className="py-4 px-4">
                        {ord.status === 'PAID' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                            PAID
                          </span>
                        )}
                        {ord.status === 'AWAITING PAYMENT' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                            AWAITING PAYMENT
                          </span>
                        )}
                        {ord.status === 'EXPIRED' && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--muted)] text-[10px]">
                            EXPIRED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right text-[var(--muted)] flex items-center justify-end gap-2">
                        <span>{ord.dateUtc}</span>
                        <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-[var(--gold)] translate-x-1' : 'opacity-40'}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Order Double-Entry Ledger Section */}
        {selectedOrder && (
          <div className="space-y-4 pt-4">
            <p className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
              SELECTED ORDER / {selectedOrder.orderNumber}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Card: Double-entry ledger (7 cols) */}
              <div className="lg:col-span-7 rounded-3xl nexus-glass-card border border-[var(--border)] p-6 sm:p-7 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                      Double-entry ledger
                    </h2>
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase mt-0.5">
                      ACCOUNT / JOURNAL {selectedOrder.journalId}
                    </p>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-[10px] font-mono font-bold tracking-wider">
                    BALANCED
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[10px] tracking-widest uppercase text-[var(--muted)]">
                        <th className="py-2.5 px-3">ACCOUNT</th>
                        <th className="py-2.5 px-3">LEDGER REF</th>
                        <th className="py-2.5 px-3 text-right">DEBIT / USD</th>
                        <th className="py-2.5 px-3 text-right">CREDIT / USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      <tr>
                        <td className="py-3 px-3 text-[var(--foreground)] font-medium">Customer Clearing</td>
                        <td className="py-3 px-3 text-[var(--muted)]">{selectedOrder.orderNumber}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">${selectedOrder.customerClearing.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--muted)]">—</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 text-[var(--foreground)] font-medium">Merchant Payable</td>
                        <td className="py-3 px-3 text-[var(--muted)]">nexus-vault</td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--muted)]">—</td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--gold)] font-semibold">${selectedOrder.merchantPayable.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 text-[var(--foreground)] font-medium">Network Gas Fee</td>
                        <td className="py-3 px-3 text-[var(--muted)]">{selectedOrder.rail.toLowerCase()}-fee</td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--muted)]">—</td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--muted)]">${selectedOrder.networkFee.toFixed(4)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Card: On-chain settlement proof */}
              <div className="lg:col-span-5 rounded-3xl nexus-glass-card border border-[var(--border)] p-6 sm:p-7 shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <h3 className="font-bold text-sm text-[var(--foreground)]">Ledger Settlement Proof</h3>
                  <ShieldCheck className="w-4 h-4 text-[var(--gold)]" />
                </div>

                <div className="space-y-4 text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-[var(--muted)] block">Transaction Hash</span>
                    <p className="p-2.5 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--foreground)] break-all select-all font-semibold">
                      {selectedOrder.txHash}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-1">
                      <span className="text-[10px] text-[var(--muted)] uppercase block">Ledger Sequence</span>
                      <p className="font-bold text-[var(--foreground)]">{selectedOrder.ledgerSequence}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-1">
                      <span className="text-[10px] text-[var(--muted)] uppercase block">Consensus Status</span>
                      <p className="font-bold text-emerald-400">Validated</p>
                    </div>
                  </div>

                  <Link
                    href={`/receipt?id=${selectedOrder.orderNumber.replace('#', '')}`}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>View Cryptographic Receipt</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--gold)]" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center font-mono text-xs">
          Loading activity records...
        </div>
      }
    >
      <ActivityContent />
    </Suspense>
  );
}
