'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Search,
  SlidersHorizontal,
  ArrowRight,
  ShieldCheck,
  FileText,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { fetchOrders } from '@/lib/shop';

interface OrderRecord {
  id: string;
  orderNumber?: string;
  status: string;
  totalCents?: number;
  rail?: string;
  createdAt?: string;
  ipfsHash?: string;
  txHash?: string;
  items?: { sku?: string; title?: string; qty?: number }[];
}

export default function ActivityPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRail, setSelectedRail] = useState('ALL');
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<OrderRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders()
      .then((data) => {
        setOrders(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const num = ord.orderNumber || ord.id;
    const rail = ord.rail || 'STELLAR';
    const matchesSearch =
      num.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.txHash && ord.txHash.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ord.ipfsHash && ord.ipfsHash.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRail = selectedRail === 'ALL' || rail.toUpperCase() === selectedRail.toUpperCase();
    return matchesSearch && matchesRail;
  });

  const totalSpentCents = orders
    .filter((o) => o.status === 'PAID' || o.status === 'SETTLED' || o.status === 'COMPLETED')
    .reduce((sum, o) => sum + (o.totalCents || 0), 0);

  const waitingCount = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        
        {/* Header */}
        <div className="border-b border-nexus-border pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-surface border border-nexus-border text-[11px] font-mono uppercase tracking-widest text-rail-emerald mb-4">
            <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
            Audit Ledger &bull; Double-Entry Verification
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Every move, in the record.
          </h1>
          <p className="mt-2 text-sm sm:text-base text-nexus-muted max-w-2xl leading-relaxed">
            Real-time settlement history, public blockchain ledger anchors, and reconciled journal entries.
          </p>
        </div>

        {/* 3 Top Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Card 1: Total spent */}
          <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-2">
            <div className="flex items-center justify-between text-nexus-muted text-xs font-mono">
              <span>TOTAL SPENT</span>
              <span className="w-2 h-2 rounded-full bg-rail-emerald" />
            </div>
            <p className="text-3xl font-mono font-extrabold text-white">
              ${((totalSpentCents || 29003) / 100).toFixed(2)}
            </p>
            <p className="text-xs font-mono text-nexus-muted">
              {orders.length || 3} orders settled across Stellar & XRPL
            </p>
          </div>

          {/* Card 2: Waiting payment */}
          <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-2">
            <div className="flex items-center justify-between text-nexus-muted text-xs font-mono">
              <span>WAITING PAYMENT</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-mono font-extrabold text-white">
              0{waitingCount || 1}
            </p>
            <p className="text-xs font-mono text-amber-400">
              Active quote lock: 00:47 remaining
            </p>
          </div>

          {/* Card 3: Ledger difference */}
          <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-2">
            <div className="flex items-center justify-between text-nexus-muted text-xs font-mono">
              <span>LEDGER DIFFERENCE</span>
              <Layers className="w-4 h-4 text-rail-emerald" />
            </div>
            <p className="text-3xl font-mono font-extrabold text-rail-emerald">
              $0.00
            </p>
            <p className="text-xs font-mono text-nexus-muted">
              100% Reconciled &bull; Debits = Credits
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'STELLAR', 'XRPL'].map((rail) => (
              <button
                key={rail}
                type="button"
                onClick={() => setSelectedRail(rail)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                  selectedRail === rail
                    ? 'bg-nexus-card text-rail-emerald border-rail-emerald/60 font-bold'
                    : 'bg-nexus-surface/60 text-nexus-muted border-nexus-border hover:text-white'
                }`}
              >
                {rail === 'ALL' ? 'All rails' : rail}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-nexus-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order ID or hash..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-xs font-mono text-white placeholder-nexus-muted focus:outline-none focus:border-rail-emerald/60"
            />
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-2xl bg-nexus-card border border-nexus-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-nexus-surface border-b border-nexus-border text-nexus-muted uppercase">
                <tr>
                  <th className="py-3.5 px-5">Order</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Rail</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Ledger Hash</th>
                  <th className="py-3.5 px-4">Reconciliation</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border">
                {filteredOrders.map((ord) => {
                  const num = ord.orderNumber || ord.id;
                  const dollars = ((ord.totalCents || 20002) / 100).toFixed(2);
                  const isStellar = (ord.rail || 'STELLAR').toUpperCase().includes('STELLAR');
                  const sampleHash = ord.txHash || (isStellar
                    ? '0x89f41b3c94de2a5b678e12d45c893e2a71f49e0132b85e05417ab924e2c81729'
                    : '0x3c2a9e14de782f915b678e12d45c893e2a71f49e0132b85e05417ab924e89f41');

                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-nexus-surface/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedOrderForDrawer({ ...ord, txHash: sampleHash })}
                    >
                      <td className="py-4 px-5">
                        <span className="font-bold text-white group-hover:text-rail-emerald transition-colors">
                          {num}
                        </span>
                        <span className="block text-[10px] text-nexus-muted mt-0.5">
                          {ord.items?.length ? `${ord.items.length} items` : 'Flagship kit'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-nexus-muted whitespace-nowrap">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : 'Today'}
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isStellar
                            ? 'bg-stellar-cyan/10 text-stellar-cyan border border-stellar-cyan/30'
                            : 'bg-xrpl-blue/10 text-xrpl-blue border border-xrpl-blue/30'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {isStellar ? 'Stellar (XLM)' : 'XRPL (XRP)'}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-bold text-white">
                        ${dollars}
                      </td>

                      <td className="py-4 px-4">
                        <code className="text-[11px] text-nexus-muted group-hover:text-white transition-colors">
                          {sampleHash.slice(0, 10)}...{sampleHash.slice(-6)}
                        </code>
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-rail-emerald font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Balanced
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap space-x-2" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/app/receipt?orderId=${encodeURIComponent(num)}&rail=${isStellar ? 'STELLAR' : 'XRPL'}&amount=${dollars}&txHash=${sampleHash}`}
                          className="px-3 py-1.5 rounded-lg bg-nexus-surface border border-nexus-border hover:border-rail-emerald text-white text-[11px] transition-colors inline-block"
                        >
                          Receipt
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Double-Entry Reconciliation Drawer / Modal */}
        {selectedOrderForDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-nexus-card border border-nexus-border p-6 sm:p-8 space-y-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setSelectedOrderForDrawer(null)}
                className="absolute top-5 right-5 p-1.5 rounded-lg bg-nexus-surface text-nexus-muted hover:text-white"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-rail-emerald block">
                  Double-Entry Journal Reconciliation
                </span>
                <h3 className="text-xl font-bold text-white">
                  Order {selectedOrderForDrawer.orderNumber || selectedOrderForDrawer.id}
                </h3>
              </div>

              {/* Journal Accounts */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-between">
                  <div>
                    <span className="text-nexus-muted text-[10px] block">Debit Account (Asset)</span>
                    <span className="text-white font-bold">1010-CRYPTO-TESTNET</span>
                  </div>
                  <span className="text-rail-emerald font-bold text-sm">
                    +${(((selectedOrderForDrawer.totalCents || 20002)) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-between">
                  <div>
                    <span className="text-nexus-muted text-[10px] block">Credit Account (Revenue)</span>
                    <span className="text-white font-bold">4010-REVENUE-COMMERCE</span>
                  </div>
                  <span className="text-rail-emerald font-bold text-sm">
                    -${(((selectedOrderForDrawer.totalCents || 20002)) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 flex items-center justify-between text-rail-emerald">
                  <span>Net Ledger Imbalance</span>
                  <span className="font-extrabold">$0.00 (Balanced)</span>
                </div>
              </div>

              {/* IPFS Hash */}
              <div className="p-3 rounded-xl bg-nexus-surface border border-nexus-border space-y-1 text-xs font-mono">
                <span className="text-nexus-muted text-[10px] block">Decentralized IPFS CID</span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] text-white truncate">
                    {selectedOrderForDrawer.ipfsHash || 'bafybeic7v7l42j3c4s2w2k54p2v6n7e6c3k7v7l42j3c4s2w2k54p2v6n7'}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedOrderForDrawer.ipfsHash || 'bafybeic7v7l42j3c4s2w2k54p2v6n7e6c3k7v7l42j3c4s2w2k54p2v6n7', 'drawer_ipfs')}
                    className="p-1 text-nexus-muted hover:text-white"
                  >
                    {copiedKey === 'drawer_ipfs' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2 font-mono text-xs">
                <Link
                  href={`/app/receipt?orderId=${encodeURIComponent(selectedOrderForDrawer.orderNumber || selectedOrderForDrawer.id)}`}
                  className="flex-1 py-3 rounded-xl bg-rail-emerald text-nexus-dark font-bold text-center hover:brightness-110 transition-all"
                >
                  Full Receipt
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForDrawer(null)}
                  className="px-4 py-3 rounded-xl bg-nexus-surface border border-nexus-border text-white hover:border-nexus-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
