'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  ArrowRightLeft,
  TrendingUp,
  Bot,
  FileText,
  Users,
  Settings,
  ExternalLink,
  Bell,
  Calendar,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { readSession, SessionUser, onSessionChange } from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';

export default function AdminConsolePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'ledger' | 'rails' | 'rates' | 'agent' | 'audit'>('overview');
  
  // AI Agent Desk state
  const [agentStage, setAgentStage] = useState<'propose' | 'confirm' | 'act'>('confirm');
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [agentExecutedSuccess, setAgentExecutedSuccess] = useState(false);
  const [agentAuditTrace, setAgentAuditTrace] = useState([
    { time: '14:32:24', text: 'JE-2048 balanced and posted', source: 'ledger.service' },
    { time: '14:32:21', text: 'NR-1048 verified - 8fa2...c91d', source: 'stellar.provider' },
    { time: '14:32:06', text: 'Quote refresh proposed · not executed', source: 'agent.desk' },
  ]);

  const { refreshRates } = useLiveExchangeRates();

  useEffect(() => {
    const sync = () => setUser(readSession().user);
    sync();
    return onSessionChange(sync);
  }, []);

  // Confirm agent action handler
  const handleConfirmAgentRefresh = async () => {
    setIsExecutingAgent(true);
    setAgentStage('act');
    
    // Trigger real rate refresh
    await refreshRates().catch(() => {});

    setTimeout(() => {
      setIsExecutingAgent(false);
      setAgentExecutedSuccess(true);
      setAgentAuditTrace((prev) => [
        { time: '14:32:38', text: 'Proposal AG-0182 executed: XRPL quote cache refreshed', source: 'agent.desk' },
        ...prev,
      ]);
    }, 1200);
  };

  const handleRejectAgent = () => {
    setAgentStage('propose');
    setAgentAuditTrace((prev) => [
      { time: '14:32:35', text: 'Proposal AG-0182 rejected by operator', source: 'agent.desk' },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-[#07090C] text-[#F0F4F8] font-sans antialiased selection:bg-[#7FF8C6] selection:text-black flex">
      
      {/* 1. Left Sidebar Navigation matching Figma Screen 9 */}
      <aside className="w-64 border-r border-white/10 bg-[#07090C] flex flex-col justify-between shrink-0 hidden md:flex sticky top-0 h-screen p-5">
        
        <div className="space-y-6">
          {/* Brand Logo */}
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded bg-[#0E131E] border border-[#1C2638] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-sm bg-[#7FF8C6]" />
              </div>
              <span className="text-base font-bold text-white tracking-tight lowercase font-mono">nexusrail</span>
            </Link>
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40 mt-1 pl-7">
              ADMIN / TESTNET
            </p>
          </div>

          {/* Primary Sidebar Nav */}
          <nav className="space-y-1 text-xs font-mono">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'orders', label: 'Orders', icon: ShoppingCart },
              { id: 'ledger', label: 'Ledger', icon: BookOpen },
              { id: 'rails', label: 'Payment rails', icon: ArrowRightLeft },
              { id: 'rates', label: 'Rates & quotes', icon: TrendingUp },
              { id: 'agent', label: 'AI Agent Desk', icon: Bot },
              { id: 'audit', label: 'Audit log', icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-[#092B21] text-[#7FF8C6] font-semibold border border-[#165D46]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Secondary Links */}
          <div className="pt-4 border-t border-white/10 space-y-1 text-xs font-mono text-white/40">
            <button type="button" className="w-full text-left px-3 py-1.5 hover:text-white transition-colors">
              Team & permissions
            </button>
            <button type="button" className="w-full text-left px-3 py-1.5 hover:text-white transition-colors">
              Settings
            </button>
            <Link href="https://docs.stellar.org" target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 hover:text-white transition-colors">
              <span>Developer docs</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Test Environment Card at Bottom of Sidebar */}
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-1 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-[#7FF8C6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7FF8C6]" />
            <span className="font-bold uppercase tracking-wider text-[10px]">TEST ENVIRONMENT</span>
          </div>
          <p className="text-white/40 leading-relaxed text-[10px]">
            All amounts and operational data are illustrative.
          </p>
          <p className="text-white/30 text-[9px] pt-1">
            BUILD 0.8.4
          </p>
        </div>

      </aside>

      {/* 2. Main Dashboard Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top App Chrome Header */}
        <header className="h-16 border-b border-white/10 px-6 sm:px-8 flex items-center justify-between shrink-0 bg-[#07090C]">
          <span className="text-xs font-mono text-white/40">
            Workspace / Overview
          </span>

          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>View storefront</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              type="button"
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>

            <div className="w-7 h-7 rounded-full bg-[#161D2B] border border-[#222C3E] flex items-center justify-center text-[11px] font-mono font-bold text-white uppercase">
              {user?.email ? user.email.slice(0, 2) : 'AK'}
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-6 sm:p-8 space-y-8 flex-1 max-w-[1360px] w-full">
          
          {/* Overview Header & Timeframe */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40">
                OPERATIONS / OVERVIEW
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-1">
                A clear view of every rail.
              </h1>
              <p className="text-xs font-mono text-white/40 mt-1">
                18 October 2026 · 14:32 UTC · Demo workspace
              </p>
            </div>

            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/80 self-start sm:self-auto hover:bg-white/10 transition-colors"
            >
              <span>Last 7 days</span>
              <Calendar className="w-3.5 h-3.5 text-white/40" />
            </button>
          </div>

          {/* 4 Metric KPI Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Tile 1 */}
            <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
              <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">
                PAYMENT VOLUME
              </p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                $24,680.42
              </p>
              <p className="text-xs font-mono text-[#7FF8C6] pt-1">
                +18.6% vs. prior 7d
              </p>
            </div>

            {/* Tile 2 */}
            <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
              <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">
                VERIFIED ORDERS
              </p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                148
              </p>
              <p className="text-xs font-mono text-white/50 pt-1">
                96.7% completion rate
              </p>
            </div>

            {/* Tile 3 */}
            <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
              <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">
                MEDIAN VERIFICATION
              </p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                3.2s
              </p>
              <p className="text-xs font-mono text-[#7FF8C6] pt-1">
                -0.4s vs. prior 7d
              </p>
            </div>

            {/* Tile 4 */}
            <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
              <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">
                LEDGER DIFFERENCE
              </p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                $0.00
              </p>
              <p className="text-xs font-mono text-white/50 pt-1">
                296 entries · balanced
              </p>
            </div>

          </div>

          {/* Charts Row: Payment Volume Line Chart + Payment Rail Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Box (7 cols): Payment Volume SVG Chart */}
            <div className="lg:col-span-7 rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    Payment volume
                  </h3>
                  <p className="text-xs font-mono text-white/40">
                    Illustrative USD · Last 7 days
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/60">
                  7D
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-mono font-bold text-white tracking-tight">
                  $24,680.42
                </span>
                <span className="text-xs font-mono text-[#7FF8C6]">
                  ↗ 18.6%
                </span>
              </div>

              {/* 7-day SVG Line Chart */}
              <div className="h-44 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 140" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="0" y1="70" x2="500" y2="70" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.05)" />

                  {/* Main Teal Trend Line */}
                  <polyline
                    fill="none"
                    stroke="#7FF8C6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,115 50,110 80,120 120,95 160,105 200,75 240,90 280,70 320,85 360,60 400,75 440,55 500,65"
                  />
                </svg>
              </div>

              {/* X-axis days */}
              <div className="flex justify-between text-[10px] font-mono text-white/40 pt-2 border-t border-white/5">
                <span>12 Oct</span>
                <span>13 Oct</span>
                <span>14 Oct</span>
                <span>15 Oct</span>
                <span>16 Oct</span>
                <span>17 Oct</span>
                <span>18 Oct</span>
              </div>
            </div>

            {/* Right Box (5 cols): Payment Rail Mix */}
            <div className="lg:col-span-5 rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-5 shadow-xl">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Payment rail mix
                </h3>
                <p className="text-xs font-mono text-white/40">
                  Verified demo volume / 7 days
                </p>
              </div>

              {/* Dual-rail Stacked Bar */}
              <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex">
                <div className="h-full bg-[#7FF8C6]" style={{ width: '64%' }} />
                <div className="h-full bg-[#0081F2]" style={{ width: '36%' }} />
              </div>

              {/* Rail Percentages */}
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#7FF8C6]" />
                    <span className="text-white/80">Stellar testnet</span>
                  </div>
                  <span className="font-bold text-white">64%</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#0081F2]" />
                    <span className="text-white/80">XRPL testnet</span>
                  </div>
                  <span className="font-bold text-white">36%</span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-white/50">
                  <span>Unverified payments</span>
                  <span className="text-white">05</span>
                </div>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  EVM and Solana are excluded. These providers are not available yet.
                </p>
              </div>
            </div>

          </div>

          {/* Chain & Rate Health Table */}
          <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white tracking-tight">
                Chain & rate health
              </h3>
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                AUTO-REFRESH · 5S
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase text-white/40 pb-2">
                    <th className="py-2.5">NETWORK</th>
                    <th className="py-2.5">PROVIDER</th>
                    <th className="py-2.5">HEALTH</th>
                    <th className="py-2.5">RATE FRESHNESS</th>
                    <th className="py-2.5 text-right">LATENCY</th>
                    <th className="py-2.5 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-3 font-medium text-white">Stellar testnet</td>
                    <td className="py-3 text-white/60">Horizon</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-bold">
                        OPERATIONAL
                      </span>
                    </td>
                    <td className="py-3 text-white/70">Fresh · 2s</td>
                    <td className="py-3 text-right text-white/70">212ms</td>
                    <td className="py-3 text-right">
                      <Link href="https://horizon-testnet.stellar.org" target="_blank" className="text-white/40 hover:text-white">
                        <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                      </Link>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 font-medium text-white">XRPL testnet</td>
                    <td className="py-3 text-white/60">WebSocket</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-bold">
                        OPERATIONAL
                      </span>
                    </td>
                    <td className="py-3 text-white/70">Cached · 18s</td>
                    <td className="py-3 text-right text-white/70">348ms</td>
                    <td className="py-3 text-right">
                      <Link href="https://s.altnet.rippletest.net:51234" target="_blank" className="text-white/40 hover:text-white">
                        <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                      </Link>
                    </td>
                  </tr>

                  <tr className="opacity-50">
                    <td className="py-3 font-medium text-white">EVM</td>
                    <td className="py-3 text-white/60">Future provider</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 text-[10px]">
                        COMING SOON
                      </span>
                    </td>
                    <td className="py-3 text-white/40">Unavailable</td>
                    <td className="py-3 text-right text-white/40">—</td>
                    <td className="py-3 text-right text-white/30"><Lock className="w-3.5 h-3.5 ml-auto" /></td>
                  </tr>

                  <tr className="opacity-50">
                    <td className="py-3 font-medium text-white">Solana</td>
                    <td className="py-3 text-white/60">Future provider</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 text-[10px]">
                        COMING SOON
                      </span>
                    </td>
                    <td className="py-3 text-white/40">Unavailable</td>
                    <td className="py-3 text-right text-white/40">—</td>
                    <td className="py-3 text-right text-white/30"><Lock className="w-3.5 h-3.5 ml-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Grid: Latest Orders & Audit Activity + AI Agent Desk */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Sub-Column (6 cols) */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Latest Orders Box */}
              <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    Latest orders
                  </h3>
                  <Link href="/activity" className="text-xs font-mono text-[#7FF8C6] hover:underline flex items-center gap-1">
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="space-y-3 divide-y divide-white/5 text-xs font-mono">
                  <div className="flex justify-between items-center py-2 first:pt-0">
                    <span className="font-semibold text-white">NR-1048</span>
                    <span className="text-white/60">Stellar</span>
                    <span className="text-white">$200.02</span>
                    <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-bold">PAID</span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold text-white">NR-1047</span>
                    <span className="text-white/60">XRPL</span>
                    <span className="text-white">$58.01</span>
                    <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-bold">PAID</span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold text-white">NR-1046</span>
                    <span className="text-white/60">Stellar</span>
                    <span className="text-white">$28.00</span>
                    <span className="px-2 py-0.5 rounded bg-[#241A0A] border border-[#4D3810] text-[#FBBF24] text-[10px] font-bold">AWAITING</span>
                  </div>
                </div>
              </div>

              {/* Audit Activity Box */}
              <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    Audit activity
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-white/50 tracking-wider">
                    IMMUTABLE TRACE
                  </span>
                </div>

                <div className="space-y-3 text-xs font-mono">
                  {agentAuditTrace.map((trace, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 py-1.5 border-b border-white/5 last:border-b-0">
                      <span className="text-white/40 shrink-0">{trace.time}</span>
                      <span className="text-white/80 flex-1">{trace.text}</span>
                      <span className="text-white/30 text-[10px] shrink-0">{trace.source}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Sub-Column (6 cols): AI Agent Desk Drawer matching Screen 9 */}
            <div className="lg:col-span-6 rounded-2xl bg-[#10141A] border border-white/10 p-6 sm:p-7 shadow-xl space-y-5">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 text-white font-bold text-lg">
                  <Bot className="w-5 h-5 text-[#7FF8C6]" />
                  <span>AI Agent Desk</span>
                </div>
                <span className="px-2.5 py-0.5 rounded bg-[#241A0A] border border-[#4D3810] text-[#FBBF24] text-[10px] font-mono font-bold tracking-wider">
                  REVIEW
                </span>
              </div>

              {/* Step Sequence Pills */}
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] font-bold">
                  ✓ PROPOSE
                </span>
                <span className="text-white/20">&gt;</span>
                <span className={`px-2 py-0.5 rounded ${agentStage === 'confirm' ? 'bg-white/10 text-white font-bold' : 'text-white/40'}`}>
                  02 CONFIRM
                </span>
                <span className="text-white/20">&gt;</span>
                <span className={`px-2 py-0.5 rounded ${agentStage === 'act' ? 'bg-[#7FF8C6] text-[#052E20] font-bold' : 'text-white/30'}`}>
                  03 ACT
                </span>
              </div>

              {/* Proposal Content */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-white tracking-tight">
                  Refresh the XRPL quote cache
                </h4>
                <p className="text-xs text-white/60 leading-relaxed">
                  The rate source timed out three times. Cached rates are 18s old. Refresh the source while preserving the last valid quote.
                </p>
              </div>

              {/* Proposal Metadata Table */}
              <div className="p-4 rounded-xl bg-[#090B0E] border border-white/10 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-white/50">Proposal</span>
                  <span className="text-white font-medium">AG-0182</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Scope</span>
                  <span className="text-white">Rates only · No funds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Execution</span>
                  <span className="text-[#FBBF24]">Requires confirmation</span>
                </div>
              </div>

              {/* Safety Confirmation Disclaimer */}
              <div className="p-3.5 rounded-lg bg-[#241A0A]/70 border border-[#4D3810] text-[#FBBF24] text-xs font-mono flex items-start gap-2.5">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  No action has been executed. Confirming triggers a rate refresh, not a payment or route change.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmAgentRefresh}
                  disabled={isExecutingAgent || agentExecutedSuccess}
                  className="py-3.5 rounded-lg bg-[#7FF8C6] hover:bg-[#6EE7B7] text-[#052E20] font-bold text-xs tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[#7FF8C6]/10 disabled:opacity-50"
                >
                  {isExecutingAgent ? (
                    <span>Executing refresh...</span>
                  ) : agentExecutedSuccess ? (
                    <>
                      <span>Refreshed successfully</span>
                      <Check className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Confirm refresh</span>
                      <Check className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRejectAgent}
                  disabled={isExecutingAgent || agentExecutedSuccess}
                  className="py-3.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-mono text-xs font-medium transition-colors text-center disabled:opacity-30"
                >
                  Reject
                </button>
              </div>

              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest text-center pt-1">
                REQUESTED BY AGENT · APPROVER: ALEX KIM
              </p>

            </div>

          </div>

        </div>

        {/* Console Bottom Footer */}
        <footer className="border-t border-white/10 py-4 px-6 sm:px-8 bg-[#05070A] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-white/40">
          <p>NEXUSRAIL / OPERATIONS CONSOLE / v0.8.4</p>
          <p>TESTNET DATA · NOT PRODUCTION METRICS</p>
        </footer>

      </div>

    </div>
  );
}
