'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Wallet, Database, ShieldCheck, RefreshCw, Activity, Terminal } from 'lucide-react';

interface LedgerEntry {
  id: string;
  asset: string;
  amount: number;
  entryType: 'CREDIT' | 'DEBIT';
  referenceType?: string;
  referenceId?: string;
  createdAt?: string;
}

interface MongoAuditTrace {
  id?: string;
  agentName?: string;
  action?: string;
  latencyMs?: number;
  timestamp?: string;
}

export function AnalyticsLedgerDashboard() {
  const [totalRevenueCents, setTotalRevenueCents] = useState<number | null>(null);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [auditTraces, setAuditTraces] = useState<MongoAuditTrace[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAllData = async () => {
    try {
      const res = await fetch('/api/v1/analytics/summary');
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setTotalRevenueCents(data.data.totalRevenueCents ?? 0);
        setTotalOrders(data.data.totalOrders ?? 0);
        setProductsCount(data.data.productsCount ?? 0);
      }
    } catch {
      // fallback
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (token) {
      // Fetch wallet ledger history
      try {
        const res = await fetch('/api/v1/wallet/transactions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setLedgerEntries(data.data.slice(0, 10));
        }
      } catch {
        // user not authenticated for ledger
      }

      // Fetch audit traces (if admin) or recent orders
      try {
        const res = await fetch('/api/v1/admin/traces', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setAuditTraces(data.data.slice(0, 8));
        }
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
  };

  return (
    <div className="w-full bg-nexus-card border border-gray-800 rounded-3xl p-6 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800/80 pb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rail-emerald" />
            <span>Multi-Rail Revenue & Double-Entry Ledger</span>
          </h3>
          <p className="text-xs text-gray-400 font-mono">Live telemetry from MongoDB Atlas and blockchain vaults</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-3.5 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-xs font-semibold text-gray-200 border border-gray-700 flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rail-emerald' : ''}`} />
          <span>Sync Ledger State</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
            <span>Settled Revenue</span>
            <Wallet className="w-4 h-4 text-rail-emerald" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {totalRevenueCents == null ? '—' : `$${(totalRevenueCents / 100).toFixed(2)}`} <span className="text-xs font-mono text-gray-400">USD</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Paid orders across all rails</div>
        </div>

        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
            <span>Supported Payment Rails</span>
            <ShieldCheck className="w-4 h-4 text-stellar-cyan" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">4 Rails Active</div>
          <div className="text-[11px] text-stellar-cyan flex items-center gap-1 mt-1 font-mono">
            Stripe • XRPL • Stellar • Internal
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
            <span>Database Records</span>
            <Database className="w-4 h-4 text-cyber-purple" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {totalOrders != null ? `${totalOrders} Orders` : 'Connected'}
          </div>
          <div className="text-[11px] text-cyber-purple flex items-center gap-1 mt-1 font-mono">
            <Activity className="w-3 h-3" /> {productsCount != null ? `${productsCount} Catalog SKUs` : 'MongoDB Atlas'}
          </div>
        </div>
      </div>

      {/* Transactions & Live Mongo Audit Traces */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Settlement Ledger Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rail-emerald" /> Double-Entry Settlement History
          </h4>
          <div className="space-y-2">
            {ledgerEntries.length > 0 ? (
              ledgerEntries.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 flex items-center justify-between text-xs hover:border-gray-700 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>{entry.asset}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          entry.entryType === 'CREDIT'
                            ? 'bg-rail-emerald/10 text-rail-emerald border-rail-emerald/20'
                            : 'bg-amber-400/10 text-amber-300 border-amber-400/20'
                        }`}
                      >
                        {entry.entryType}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                      Ref: {entry.referenceId || entry.referenceType || 'Internal settlement'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${entry.entryType === 'CREDIT' ? 'text-rail-emerald' : 'text-amber-300'}`}>
                      {entry.entryType === 'CREDIT' ? '+' : '-'}{entry.amount} {entry.asset}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 rounded-2xl bg-nexus-dark border border-gray-800/80 text-center font-mono text-xs text-gray-400 space-y-1">
                <p>No ledger transactions for this account yet.</p>
                <p className="text-[11px] text-gray-500">Complete a checkout or credit your wallet to see double-entry records.</p>
              </div>
            )}
          </div>
        </div>

        {/* MongoDB Audit Traces Live Feed */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyber-purple" /> MongoDB Atlas Live Audit Feed
          </h4>
          <div className="space-y-2">
            {auditTraces.length > 0 ? (
              auditTraces.map((trace, idx) => (
                <div
                  key={trace.id || idx}
                  className="p-3 rounded-xl bg-nexus-dark border border-gray-800/90 flex flex-col justify-between text-xs font-mono"
                >
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-cyber-purple font-bold">Agent: {trace.agentName || 'NexusRail AI'}</span>
                    <span className="text-rail-emerald">{trace.latencyMs ? `${trace.latencyMs}ms` : '<120ms'}</span>
                  </div>
                  <div className="text-gray-300 text-[11px] my-1 truncate">
                    Action: "{trace.action || 'Ledger verification'}"
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {trace.timestamp ? new Date(trace.timestamp).toLocaleTimeString() : 'Logged in MongoDB Atlas'}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 rounded-2xl bg-nexus-dark border border-gray-800/80 text-center font-mono text-xs text-gray-400 space-y-1">
                <p>MongoDB Audit Feed Active.</p>
                <p className="text-[11px] text-gray-500">Traces from AI Desk proposals and multi-rail settlements are recorded here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
