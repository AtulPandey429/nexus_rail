'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShoppingCart,
  Layers,
  Zap,
  TrendingUp,
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { readSession } from '@/lib/shop';

export default function AdminDashboardOverview() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('admin@nexusrail.dev');
  const [isAdmin, setIsAdmin] = useState(true);
  const [executingProposal, setExecutingProposal] = useState<string | null>(null);
  const [proposalExecuted, setProposalExecuted] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (session.user) {
      setUserEmail(session.user.email || 'operator@nexusrail.dev');
      setIsAdmin(session.user.role === 'admin');
    }
  }, []);

  const handleExecuteProposal = (id: string) => {
    setExecutingProposal(id);
    setTimeout(() => {
      setExecutingProposal(null);
      setProposalExecuted(true);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        
        {/* Banner */}
        <div className="p-3.5 rounded-2xl bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Operator desk. Real-time testnet ledger metrics, multi-rail volume mix, and AI proposals.</span>
          </div>
          <span className="text-[10px] bg-rail-emerald/20 text-rail-emerald px-2.5 py-1 rounded-md font-bold self-start sm:self-auto">
            Testnet Operator Active
          </span>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-nexus-border pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-surface border border-nexus-border text-[11px] font-mono uppercase tracking-widest text-rail-emerald mb-4">
              <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
              Settlement Operations &bull; Chain Audit
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              A clear view of every rail.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-nexus-muted max-w-2xl leading-relaxed">
              Real-time multi-chain volume breakdown, double-entry verification health, and automated agent desk proposals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rail-emerald/15 border border-rail-emerald/40 text-rail-emerald hover:bg-rail-emerald/25 text-xs font-mono font-bold transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Fulfillment Manager</span>
            </Link>
          </div>
        </div>

        {/* 4 Stat Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Gross Settled Volume */}
          <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-2">
            <div className="flex items-center justify-between text-nexus-muted text-xs font-mono">
              <span>GROSS VOLUME</span>
              <TrendingUp className="w-4 h-4 text-rail-emerald" />
            </div>
            <p className="text-3xl font-mono font-extrabold text-white">
              $200,700
            </p>
            <p className="text-xs font-mono text-rail-emerald">
              +12.4% vs last 30d
            </p>
          </div>

          {/* Stellar Share */}
          <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-2">
            <div className="flex items-center justify-between text-nexus-muted text-xs font-mono">
              <span>STELLAR SHARE</span>
              <span className="w-2 h-2 rounded-full bg-stellar-cyan" />
            </div>
            <p className="text-3xl font-mono font-extrabold text-stellar-cyan">
              64%
            </p>
            <p className="text-xs font-mono text-nexus-muted">
              $128,490 via Soroban
            </p>
          </div>

          {/* XRPL Share */}
          <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-2">
            <div className="flex items-center justify-between text-nexus-muted text-xs font-mono">
              <span>XRPL SHARE</span>
              <span className="w-2 h-2 rounded-full bg-xrpl-blue" />
            </div>
            <p className="text-3xl font-mono font-extrabold text-xrpl-blue">
              36%
            </p>
            <p className="text-xs font-mono text-nexus-muted">
              $72,210 via Consensus
            </p>
          </div>

          {/* Ledger Delta */}
          <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-2">
            <div className="flex items-center justify-between text-nexus-muted text-xs font-mono">
              <span>RECONCILIATION</span>
              <Layers className="w-4 h-4 text-rail-emerald" />
            </div>
            <p className="text-3xl font-mono font-extrabold text-rail-emerald">
              $0.00
            </p>
            <p className="text-xs font-mono text-nexus-muted">
              100% Balanced Debits = Credits
            </p>
          </div>
        </div>

        {/* Volume Mix & 7-Day Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Chart Section (8 cols) */}
          <div className="lg:col-span-8 p-6 sm:p-8 rounded-2xl bg-nexus-card border border-nexus-border space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Daily Multi-Rail Volume</h3>
                <p className="text-xs font-mono text-nexus-muted">Last 7 days settlement distribution</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-stellar-cyan">
                  <span className="w-2.5 h-2.5 rounded-sm bg-stellar-cyan" />
                  Stellar
                </span>
                <span className="flex items-center gap-1 text-xrpl-blue">
                  <span className="w-2.5 h-2.5 rounded-sm bg-xrpl-blue" />
                  XRPL
                </span>
              </div>
            </div>

            {/* Bar Chart Visualization */}
            <div className="h-56 flex items-end justify-between gap-3 pt-6 border-b border-nexus-border pb-4">
              {[
                { day: 'Mon', stellar: 60, xrpl: 40, total: '$24.2k' },
                { day: 'Tue', stellar: 75, xrpl: 35, total: '$31.0k' },
                { day: 'Wed', stellar: 50, xrpl: 30, total: '$21.8k' },
                { day: 'Thu', stellar: 85, xrpl: 45, total: '$38.4k' },
                { day: 'Fri', stellar: 95, xrpl: 60, total: '$44.1k' },
                { day: 'Sat', stellar: 70, xrpl: 38, total: '$29.5k' },
                { day: 'Sun', stellar: 80, xrpl: 50, total: '$35.2k' },
              ].map((bar, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-mono text-nexus-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    {bar.total}
                  </span>
                  <div className="w-full max-w-[36px] flex flex-col gap-1 items-center justify-end h-full">
                    {/* Stellar bar */}
                    <div
                      className="w-full rounded-t-md bg-stellar-cyan/80 group-hover:bg-stellar-cyan transition-colors"
                      style={{ height: `${bar.stellar}%` }}
                    />
                    {/* XRPL bar */}
                    <div
                      className="w-full rounded-b-md bg-xrpl-blue/80 group-hover:bg-xrpl-blue transition-colors"
                      style={{ height: `${bar.xrpl}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-nexus-muted">{bar.day}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-nexus-muted">
              <span>Automated cross-chain reconciliation active</span>
              <span className="text-rail-emerald">Peak volume: Friday ($44.1k)</span>
            </div>
          </div>

          {/* Rail Mix & Chain Health (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Chain Health */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-white font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-rail-emerald" />
                <span>Chain Health Monitor</span>
              </h3>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
                    <div>
                      <p className="text-white font-bold">Stellar Testnet</p>
                      <p className="text-[10px] text-nexus-muted">3.2s ledger close</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-rail-emerald font-bold">100% UP</span>
                </div>

                <div className="p-3 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
                    <div>
                      <p className="text-white font-bold">XRPL Testnet</p>
                      <p className="text-[10px] text-nexus-muted">3.4s consensus</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-rail-emerald font-bold">100% UP</span>
                </div>

                <div className="p-3 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
                    <div>
                      <p className="text-white font-bold">IPFS CID Pinning</p>
                      <p className="text-[10px] text-nexus-muted">Decentralized storage</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-rail-emerald font-bold">SYNCED</span>
                </div>

                <div className="p-3 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-cyber-purple animate-pulse" />
                    <div>
                      <p className="text-white font-bold">AI Proposal Lock</p>
                      <p className="text-[10px] text-nexus-muted">Redis proposal queue</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-cyber-purple font-bold">ACTIVE</span>
                </div>
              </div>
            </div>

            {/* AI Agent Desk Proposal Widget */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-cyber-purple/40 space-y-4 shadow-xl shadow-cyber-purple/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyber-purple" />
                  <span className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                    AI Agent Desk Proposal
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-cyber-purple/20 text-cyber-purple px-2 py-0.5 rounded font-bold">
                  Groq 70B
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-nexus-surface border border-nexus-border space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Proposal #AP-418</span>
                  <span className="text-[10px] text-amber-400">Ready for Execution</span>
                </div>
                <p className="text-nexus-muted leading-relaxed">
                  &ldquo;Refresh the XRPL quote cache and tighten Soroban slippage delta from 0.2% to 0.1% based on 24h volume surge.&rdquo;
                </p>
              </div>

              {proposalExecuted ? (
                <div className="p-3 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Proposal executed onchain. Cache refreshed.</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleExecuteProposal('ap418')}
                  disabled={executingProposal !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-purple text-white text-xs font-mono font-bold hover:brightness-110 transition-all disabled:opacity-60"
                >
                  {executingProposal ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing proposal...</span>
                    </>
                  ) : (
                    <>
                      <span>Execute AI Proposal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
