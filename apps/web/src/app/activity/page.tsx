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
  ArrowUpDown,
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
    orderNumber: 'NR-1048',
    items: 'Rail One + 2 more',
    rail: 'STELLAR',
    railLabel: 'Stellar / XLM',
    token: 'XLM',
    totalUsd: 200.02,
    cryptoAmount: '2,000.20 XLM',
    status: 'PAID',
    dateUtc: '18 Oct, 14:32',
    txHash: '8fa2b7e4a901c91d',
    ledgerSequence: '5,284,901',
    journalId: 'JE-2048',
    customerClearing: 200.00,
    merchantPayable: 200.00,
    networkFee: 0.02,
  },
  {
    id: 'ord_1047',
    orderNumber: 'NR-1047',
    items: 'Node stand',
    rail: 'XRPL',
    railLabel: 'XRPL / XRP',
    token: 'XRP',
    totalUsd: 58.01,
    cryptoAmount: '100.00 XRP',
    status: 'PAID',
    dateUtc: '17 Oct, 09:41',
    txHash: '4cb7e192f183da09',
    ledgerSequence: '5,280,119',
    journalId: 'JE-2047',
    customerClearing: 58.00,
    merchantPayable: 58.00,
    networkFee: 0.01,
  },
  {
    id: 'ord_1046',
    orderNumber: 'NR-1046',
    items: 'Signal cap',
    rail: 'STELLAR',
    railLabel: 'Stellar / XLM',
    token: 'XLM',
    totalUsd: 28.00,
    cryptoAmount: '280.00 XLM',
    status: 'AWAITING PAYMENT',
    dateUtc: '17 Oct, 08:15',
    txHash: 'pending_authorization',
    ledgerSequence: 'Mempool',
    journalId: 'JE-2046',
    customerClearing: 28.00,
    merchantPayable: 28.00,
    networkFee: 0.00,
  },
  {
    id: 'ord_1045',
    orderNumber: 'NR-1045',
    items: 'Relay desk mat',
    rail: 'XRPL',
    railLabel: 'XRPL / XRP',
    token: 'XRP',
    totalUsd: 39.00,
    cryptoAmount: '67.24 XRP',
    status: 'EXPIRED',
    dateUtc: '16 Oct, 18:22',
    txHash: 'expired_payload_001',
    ledgerSequence: 'Reverted',
    journalId: 'JE-2045',
    customerClearing: 39.00,
    merchantPayable: 39.00,
    networkFee: 0.00,
  },
  {
    id: 'ord_1044',
    orderNumber: 'NR-1044',
    items: 'Nexus tee',
    rail: 'STELLAR',
    railLabel: 'Stellar / XLM',
    token: 'XLM',
    totalUsd: 32.00,
    cryptoAmount: '320.00 XLM',
    status: 'PAID',
    dateUtc: '15 Oct, 11:06',
    txHash: '19ef47b38c201d4a',
    ledgerSequence: '5,269,440',
    journalId: 'JE-2044',
    customerClearing: 32.00,
    merchantPayable: 32.00,
    networkFee: 0.00,
  },
];

function ActivityContent() {
  const searchParams = useSearchParams();
  const paramOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'PAID' | 'AWAITING' | 'EXPIRED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(paramOrderId || 'NR-1048');

  // Load live orders from storage / API if available
  useEffect(() => {
    fetchOrders().then((apiOrders) => {
      if (Array.isArray(apiOrders) && apiOrders.length > 0) {
        // Merge with initial Figma demo orders so all 5 reference entries exist
        const merged = [...INITIAL_ORDERS];
        for (const ao of apiOrders) {
          const num = ao.orderNumber || ao.id;
          if (!merged.some((m) => m.orderNumber === num)) {
            merged.unshift({
              id: ao.id,
              orderNumber: num,
              items: ao.items?.map((i) => i.title || i.sku).join(', ') || 'Custom order',
              rail: ao.rail || 'STELLAR',
              railLabel: ao.rail === 'XRPL' ? 'XRPL / XRP' : 'Stellar / XLM',
              token: ao.rail === 'XRPL' ? 'XRP' : 'XLM',
              totalUsd: (ao.totalCents || 20000) / 100,
              cryptoAmount: `${((ao.totalCents || 20000) / 10).toFixed(2)} ${ao.rail === 'XRPL' ? 'XRP' : 'XLM'}`,
              status: (ao.status === 'PAID' ? 'PAID' : 'AWAITING PAYMENT') as any,
              dateUtc: 'Today, Just now',
              txHash: (ao as any).txHash || (ao as any).tx_hash || 'tx_8fa2...c91d',
              ledgerSequence: '5,284,901',
              journalId: `JE-${Math.floor(2000 + Math.random() * 900)}`,
              customerClearing: (ao.totalCents || 20000) / 100,
              merchantPayable: (ao.totalCents || 20000) / 100,
              networkFee: 0.02,
            });
          }
        }
        setOrders(merged);
      }
    }).catch(() => {});
  }, []);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Status filter
      if (selectedFilter === 'PAID' && ord.status !== 'PAID') return false;
      if (selectedFilter === 'AWAITING' && ord.status !== 'AWAITING PAYMENT') return false;
      if (selectedFilter === 'EXPIRED' && ord.status !== 'EXPIRED') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = ord.orderNumber.toLowerCase().includes(q);
        const matchesItems = ord.items.toLowerCase().includes(q);
        const matchesRail = ord.railLabel.toLowerCase().includes(q);
        const matchesTx = ord.txHash.toLowerCase().includes(q);
        return matchesNum || matchesItems || matchesRail || matchesTx;
      }
      return true;
    });
  }, [orders, selectedFilter, searchQuery]);

  // Selected active order for double-entry ledger view
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.orderNumber === selectedOrderId) || orders[0];
  }, [orders, selectedOrderId]);

  // Export history handler
  const handleExportHistory = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      'Order,Items,Rail,TotalUSD,Status,DateUTC\n' +
      orders.map((o) => `${o.orderNumber},"${o.items}",${o.railLabel},${o.totalUsd},${o.status},${o.dateUtc}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nexusrail_activity_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090C] text-slate-900 dark:text-[#F0F4F8] font-sans antialiased selection:bg-[#7FF8C6] selection:text-black transition-colors duration-200">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 space-y-8">
        
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-slate-400 dark:text-white/40 font-semibold">
              ACCOUNT / ACTIVITY
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-slate-900 dark:text-white tracking-tight mt-2">
              On the record.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-white/50 mt-1 font-normal">
              Follow your orders, inspect payments, and reconcile the entries behind them.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportHistory}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white font-mono text-xs transition-colors self-start sm:self-auto shadow-sm"
          >
            <span>Export history</span>
            <Download className="w-3.5 h-3.5 text-white/40" />
          </button>
        </div>

        {/* 3 Metrics Tiles matching Figma Screen 6 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Tile 1: Total Paid */}
          <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">
              TOTAL PAID / USD
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              $290.03
            </p>
            <p className="text-xs font-mono text-white/50 pt-1">
              3 verified testnet payments
            </p>
          </div>

          {/* Tile 2: Awaiting Payment */}
          <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">
              AWAITING PAYMENT
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              01
            </p>
            <p className="text-xs font-mono text-white/50 pt-1">
              No funds received yet
            </p>
          </div>

          {/* Tile 3: Ledger Difference */}
          <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">
              LEDGER DIFFERENCE
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              $0.00
            </p>
            <p className="text-xs font-mono text-[#7FF8C6] pt-1">
              All posted entries balanced
            </p>
          </div>

        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          
          {/* Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => setSelectedFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedFilter === 'ALL'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              All orders 05
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter('PAID')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedFilter === 'PAID'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Paid 03
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter('AWAITING')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedFilter === 'AWAITING'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Awaiting 01
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter('EXPIRED')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedFilter === 'EXPIRED'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Expired 01
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <NexusLogo size="xs" glow className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none rounded shadow-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order or transaction"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-[#10141A] border border-slate-300 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-rail-emerald shadow-sm"
            />
          </div>

        </div>

        {/* Transactions Ledger Table */}
        <div className="rounded-xl bg-[#10141A] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase text-white/40 bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6">ORDER</th>
                  <th className="py-3.5 px-4">ITEMS</th>
                  <th className="py-3.5 px-4">PAYMENT RAIL</th>
                  <th className="py-3.5 px-4">TOTAL / USD</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">DATE / UTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((ord) => {
                  const isSelected = selectedOrder?.orderNumber === ord.orderNumber;
                  return (
                    <tr
                      key={ord.orderNumber}
                      onClick={() => setSelectedOrderId(ord.orderNumber)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-4 px-4 sm:px-6 font-semibold text-white">
                        {ord.orderNumber}
                      </td>
                      <td className="py-4 px-4 text-white/80">
                        {ord.items}
                      </td>
                      <td className="py-4 px-4 text-white/60">
                        {ord.railLabel}
                      </td>
                      <td className="py-4 px-4 text-white font-medium">
                        ${ord.totalUsd.toFixed(2)}
                      </td>
                      <td className="py-4 px-4">
                        {ord.status === 'PAID' && (
                          <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-semibold">
                            PAID
                          </span>
                        )}
                        {ord.status === 'AWAITING PAYMENT' && (
                          <span className="px-2 py-0.5 rounded bg-[#241A0A] border border-[#4D3810] text-[#FBBF24] text-[10px] font-semibold">
                            AWAITING PAYMENT
                          </span>
                        )}
                        {ord.status === 'EXPIRED' && (
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 text-[10px]">
                            EXPIRED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right text-white/40 flex items-center justify-end gap-2">
                        <span>{ord.dateUtc}</span>
                        <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-[#7FF8C6] translate-x-1' : 'text-white/20'}`} />
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
            
            <p className="text-[11px] font-mono tracking-widest uppercase text-white/40">
              SELECTED ORDER / {selectedOrder.orderNumber}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Card: Double-entry ledger (7 cols) */}
              <div className="lg:col-span-7 rounded-2xl bg-[#10141A] border border-white/10 p-6 sm:p-7 shadow-xl space-y-5">
                
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      Double-entry ledger
                    </h2>
                    <p className="text-[10px] font-mono text-white/40 uppercase mt-0.5">
                      ACCOUNT / JOURNAL {selectedOrder.journalId}
                    </p>
                  </div>

                  <span className="px-2.5 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-mono font-bold tracking-wider">
                    BALANCED
                  </span>
                </div>

                {/* Ledger Lines Table */}
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-[10px] tracking-widest uppercase text-white/40 pb-2">
                      <th className="py-2">ACCOUNT</th>
                      <th className="py-2 text-right">DEBIT / USD</th>
                      <th className="py-2 text-right">CREDIT / USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="py-2.5 text-white/80">Customer clearing</td>
                      <td className="py-2.5 text-right font-medium text-white">${selectedOrder.customerClearing.toFixed(2)}</td>
                      <td className="py-2.5 text-right text-white/30">—</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-white/80">Merchant payable</td>
                      <td className="py-2.5 text-right text-white/30">—</td>
                      <td className="py-2.5 text-right font-medium text-white">${selectedOrder.merchantPayable.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-white/80">Network expense</td>
                      <td className="py-2.5 text-right font-medium text-white">${selectedOrder.networkFee.toFixed(2)}</td>
                      <td className="py-2.5 text-right text-white/30">—</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-white/80">Network clearing</td>
                      <td className="py-2.5 text-right text-white/30">—</td>
                      <td className="py-2.5 text-right font-medium text-white">${selectedOrder.networkFee.toFixed(2)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 font-bold">
                      <td className="py-3 text-white">TOTAL</td>
                      <td className="py-3 text-right font-mono text-[#7FF8C6]">${selectedOrder.totalUsd.toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-[#7FF8C6]">${selectedOrder.totalUsd.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Balance Difference Notice */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] font-mono text-white/40 border-t border-white/5">
                  <span className="text-[#7FF8C6] font-semibold">TOTAL · DIFFERENCE $0.00</span>
                  <span>POSTED 18 OCT 2026, 14:32:24 UTC · DEMO JOURNAL</span>
                </div>

              </div>

              {/* Right Card: Payment Verified (5 cols) */}
              <div className="lg:col-span-5 rounded-2xl bg-[#10141A] border border-white/10 p-6 sm:p-7 shadow-xl space-y-6">
                
                <div className="flex items-center gap-2 text-white font-medium text-lg">
                  <ShieldCheck className="w-5 h-5 text-[#7FF8C6]" />
                  <span>Payment verified</span>
                </div>

                {/* Verification Fields */}
                <div className="space-y-3 text-xs font-mono divide-y divide-white/5">
                  <div className="flex justify-between py-2">
                    <span className="text-white/50">Amount</span>
                    <span className="text-white font-medium">{selectedOrder.cryptoAmount}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-white/50">Transaction</span>
                    <span className="text-[#7FF8C6] font-mono flex items-center gap-1">
                      {selectedOrder.txHash.slice(0, 8)}...{selectedOrder.txHash.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-white/50">Ledger sequence</span>
                    <span className="text-white font-mono">{selectedOrder.ledgerSequence}</span>
                  </div>
                </div>

                {/* Audit Timeline */}
                <div className="space-y-2 text-xs font-mono pt-1">
                  <div className="flex items-center justify-between text-white/60">
                    <span className="text-white/40">14:32:18</span>
                    <span>Wallet signature received</span>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span className="text-white/40">14:32:21</span>
                    <span>Transaction confirmed</span>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span className="text-white/40">14:32:24</span>
                    <span>Journal balanced & posted</span>
                  </div>
                </div>

                {/* Open Receipt Button */}
                <Link
                  href={`/receipt?orderId=${encodeURIComponent(selectedOrder.orderNumber)}`}
                  className="w-full py-3.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-mono text-xs font-medium transition-colors text-center block"
                >
                  Open receipt ↗
                </Link>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Bottom Footer */}
      <footer className="border-t border-white/10 py-5 bg-[#05070A]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-white/40">
          <p>© 2026 NexusRail · Demo environment</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#7FF8C6] animate-pulse" />
            <span>Systems operational</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090C] text-white flex items-center justify-center font-mono text-xs">
        <div className="w-8 h-8 border-2 border-[#7FF8C6] border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    }>
      <ActivityContent />
    </Suspense>
  );
}
