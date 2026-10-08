'use client';

import React, { useState } from 'react';
import { BarChart3, Wallet, Database, ShieldCheck, ArrowUpRight, RefreshCw, Activity, Terminal } from 'lucide-react';

export function AnalyticsLedgerDashboard() {
  const [walletBalance, setWalletBalance] = useState(125000); // $1,250.00
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mockTransactions = [
    { id: 'tx_8f91a2', rail: 'XRPL Testnet', amount: '$499.00', status: 'SETTLED', memo: 'Tag #948102', time: '2 mins ago' },
    { id: 'tx_3c4b11', rail: 'Stripe Fiat', amount: '$1,299.00', status: 'SETTLED', memo: 'pi_3Pohp...', time: '8 mins ago' },
    { id: 'tx_7e2a90', rail: 'Stellar Horizon', amount: '$150.00', status: 'SETTLED', memo: 'MEMO_9104', time: '14 mins ago' },
    { id: 'tx_1a55d4', rail: 'Soroban Contract', amount: '$750.00', status: 'VERIFIED', memo: 'Contract Call', time: '22 mins ago' },
  ];

  const mockMongoLogs = [
    { id: '6ac7d43d', prompt: 'Check XRPL validator status for order #948', latency: '184ms', db: 'nexusrail.agent_audit_traces' },
    { id: '6ac7e891', prompt: 'Lock product inventory for showdown #12', latency: '210ms', db: 'nexusrail.agent_audit_traces' },
    { id: '6ac7f102', prompt: 'Generate IPFS receipt CID via Pinata', latency: '295ms', db: 'nexusrail.agent_audit_traces' },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setWalletBalance((prev) => prev + 49900);
      setIsRefreshing(false);
    }, 600);
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
          <p className="text-xs text-gray-400 font-mono">Phase 1 & Phase 4 Telemetry Engine</p>
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
            <span>Double-Entry Wallet</span>
            <Wallet className="w-4 h-4 text-rail-emerald" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            ${(walletBalance / 100).toFixed(2)} <span className="text-xs font-mono text-gray-400">USD</span>
          </div>
          <div className="text-[11px] text-rail-emerald flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3 h-3" /> +18.4% this week
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
            <span>Supported Payment Rails</span>
            <ShieldCheck className="w-4 h-4 text-stellar-cyan" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">4 Rails Active</div>
          <div className="text-[11px] text-stellar-cyan flex items-center gap-1 mt-1">
            Stripe • XRPL • Stellar • Ledger
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
            <span>MongoDB Atlas Telemetry</span>
            <Database className="w-4 h-4 text-cyber-purple" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">1,492 Traces</div>
          <div className="text-[11px] text-cyber-purple flex items-center gap-1 mt-1">
            <Activity className="w-3 h-3" /> Sub-300ms Async Logger
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
            {mockTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 flex items-center justify-between text-xs hover:border-gray-700 transition-colors"
              >
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>{tx.rail}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/20">
                      {tx.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">{tx.memo}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white">{tx.amount}</div>
                  <div className="text-[10px] text-gray-500">{tx.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MongoDB Audit Traces Live Feed */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyber-purple" /> MongoDB Atlas Live Audit Feed
          </h4>
          <div className="space-y-2">
            {mockMongoLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-nexus-dark border border-gray-800/90 flex flex-col justify-between text-xs font-mono"
              >
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-cyber-purple font-bold">ID: {log.id}</span>
                  <span className="text-rail-emerald">{log.latency}</span>
                </div>
                <div className="text-gray-300 text-[11px] my-1 truncate">"{log.prompt}"</div>
                <div className="text-[10px] text-gray-500">{log.db}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
