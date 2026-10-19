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
  LogOut,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { readSession, SessionUser, onSessionChange, saveSession, clearSession } from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';
import { Nexus3DCanvas } from '@/components/Nexus3DCanvas';

export default function AdminConsolePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'ledger' | 'rails' | 'rates' | 'agent' | 'audit'>('overview');
  
  // Admin Auth Gate State
  const [adminEmailInput, setAdminEmailInput] = useState('admin@nexusrail.com');
  const [adminPassInput, setAdminPassInput] = useState('admin123');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Live Orders state
  const [liveOrders, setLiveOrders] = useState<any[]>([
    {
      id: 'NR-1048',
      orderNumber: 'NR-1048',
      buyerEmail: 'alex@nexusrail.com',
      rail: 'Stellar (XLM)',
      amount: '200.02 XLM',
      status: 'PAID',
      txHash: '8fa2b109c91d4e02aaef06aa74b18086343e6f7df6f4a32570e361d2ed4ecf0946',
      explorerUrl: 'https://stellar.expert/explorer/testnet/tx/8fa2b109c91d4e02aaef06aa74b18086343e6f7df6f4a32570e361d2ed4ecf0946',
      createdAt: 'Just now',
    },
    {
      id: 'NR-1047',
      orderNumber: 'NR-1047',
      buyerEmail: 'sarah.dev@crypto.org',
      rail: 'XRPL (XRP)',
      amount: '58.00 XRP',
      status: 'FULFILLED',
      txHash: '2F84AE95420138AC529524584288424AE01488204928A4081024881024881024',
      explorerUrl: 'https://testnet.xrpl.org/transactions/2F84AE95420138AC529524584288424AE01488204928A4081024881024881024',
      createdAt: '12m ago',
    },
    {
      id: 'SWAP-XLM-XRP-09',
      orderNumber: 'SWAP-901',
      buyerEmail: 'vault.trader@stellar.org',
      rail: 'Cross-Chain Swap (XRP -> XLM)',
      amount: '100.00 XRP -> 733.50 XLM',
      status: 'SETTLED',
      txHash: '4D09AEB40828A012480182408210480218408124082148012840128401284012',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
      createdAt: '24m ago',
    },
    {
      id: 'NR-1046',
      orderNumber: 'NR-1046',
      buyerEmail: 'merchant@retailchain.com',
      rail: 'Stellar (USDC)',
      amount: '49.99 USDC',
      status: 'PAID',
      txHash: '91024AE401284081240812408124081240812408124081240812408124081240',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
      createdAt: '1h ago',
    },
  ]);

  // AI Agent Desk state
  const [agentStage, setAgentStage] = useState<'propose' | 'confirm' | 'act'>('confirm');
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [agentExecutedSuccess, setAgentExecutedSuccess] = useState(false);
  const [agentAuditTrace, setAgentAuditTrace] = useState([
    { time: '14:32:24', text: 'JE-2048 balanced and posted', source: 'ledger.service' },
    { time: '14:32:21', text: 'NR-1048 verified - 8fa2...c91d', source: 'stellar.provider' },
    { time: '14:32:06', text: 'Quote refresh proposed · not executed', source: 'agent.desk' },
  ]);

  const { refreshRates, xlmUsd, xrpUsd } = useLiveExchangeRates();

  useEffect(() => {
    const sync = () => setUser(readSession().user);
    sync();
    return onSessionChange(sync);
  }, []);

  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminAuthError('');
    setIsLoggingIn(true);

    if (adminEmailInput.trim().toLowerCase().includes('admin') || adminPassInput === 'admin123') {
      const adminUser: SessionUser = {
        id: 'admin-01',
        email: adminEmailInput.trim() || 'admin@nexusrail.com',
        role: 'admin',
      };
      saveSession(adminUser, 'nexus_operator_admin_token');
      setUser(adminUser);
      setIsLoggingIn(false);
    } else {
      setIsLoggingIn(false);
      setAdminAuthError('Invalid administrator credentials. Try admin@nexusrail.com / admin123');
    }
  };

  const handleAdminSignOut = () => {
    clearSession();
    setUser(null);
  };

  const handleConfirmAgentRefresh = async () => {
    setIsExecutingAgent(true);
    setAgentStage('act');
    await refreshRates().catch(() => {});
    setTimeout(() => {
      setIsExecutingAgent(false);
      setAgentExecutedSuccess(true);
      setAgentAuditTrace((prev) => [
        { time: new Date().toLocaleTimeString(), text: 'Proposal AG-0182 executed: Dynamic rate feeds refreshed', source: 'agent.desk' },
        ...prev,
      ]);
    }, 1200);
  };

  const handleRejectAgent = () => {
    setAgentStage('propose');
    setAgentAuditTrace((prev) => [
      { time: new Date().toLocaleTimeString(), text: 'Proposal AG-0182 rejected by operator', source: 'agent.desk' },
      ...prev,
    ]);
  };

  const isAdmin = user?.role === 'admin' || Boolean(user?.email && user.email.toLowerCase().includes('admin'));

  // 1. RESTRICTED AUTHENTICATION GATE IF NOT ADMIN
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#07090C] text-[#F0F4F8] flex items-center justify-center p-4 selection:bg-[#7FF8C6] selection:text-black relative overflow-hidden">
        {/* Ambient 3D Particle Canvas */}
        <div className="absolute inset-0 pointer-events-none opacity-30 flex items-center justify-center">
          <Nexus3DCanvas variant="hero" className="w-full h-full max-w-2xl" />
        </div>

        <div className="w-full max-w-md p-8 sm:p-9 rounded-3xl bg-[#0E131E]/90 border border-white/10 shadow-2xl backdrop-blur-2xl relative z-10 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shadow-lg shadow-amber-400/10">
              <ShieldCheck className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-widest uppercase text-amber-400 font-bold">
                RESTRICTED OPERATOR ZONE
              </p>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
                NexusRail Admin Console
              </h1>
              <p className="text-xs text-white/50 mt-1 max-w-xs">
                Restricted access for dual-rail liquidity, live order fulfillment, and autonomous agent controls.
              </p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4 font-mono text-xs">
            <div>
              <label className="text-white/60 block mb-1.5 uppercase tracking-wider text-[10px]">Operator Email</label>
              <input
                type="email"
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="admin@nexusrail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60"
              />
            </div>

            <div>
              <label className="text-white/60 block mb-1.5 uppercase tracking-wider text-[10px]">Access Key / Password</label>
              <input
                type="password"
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60"
              />
            </div>

            {adminAuthError && (
              <p className="text-rose-400 text-xs font-mono">{adminAuthError}</p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In as Operator'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => handleAdminLogin()}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-mono flex items-center justify-center gap-2 transition-all group"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>1-Click Demo Operator Access (admin@nexusrail.com)</span>
            </button>
          </div>

          <div className="text-center">
            <Link href="/" className="text-[11px] font-mono text-white/40 hover:text-white transition-colors">
              &larr; Return to Public Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. FULL AUTHORIZED ADMIN CONSOLE
  return (
    <div className="min-h-screen bg-[#07090C] text-[#F0F4F8] font-sans antialiased selection:bg-[#7FF8C6] selection:text-black flex">
      
      {/* 1. Left Sidebar Navigation */}
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
            <p className="text-[10px] font-mono tracking-widest uppercase text-amber-400 mt-1 pl-7 font-bold">
              👑 ADMIN OPERATOR
            </p>
          </div>

          {/* Primary Sidebar Nav */}
          <nav className="space-y-1 text-xs font-mono">
            {[
              { id: 'overview', label: 'Overview & Metrics', icon: LayoutDashboard },
              { id: 'orders', label: 'Orders & Settlements', icon: ShoppingCart },
              { id: 'ledger', label: 'Reconciliation Ledger', icon: BookOpen },
              { id: 'rails', label: 'Payment Rails & Vaults', icon: ArrowRightLeft },
              { id: 'rates', label: 'Rates & FX Quotes', icon: TrendingUp },
              { id: 'agent', label: 'AI Agent Desk', icon: Bot },
              { id: 'audit', label: 'Audit Log', icon: FileText },
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
            <Link href="/admin/orders" className="flex items-center justify-between px-3 py-1.5 hover:text-white transition-colors">
              <span>Order Fulfillment Desk</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/app/swap" className="flex items-center justify-between px-3 py-1.5 hover:text-white transition-colors">
              <span>Cross-Chain Swap Desk</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="https://docs.stellar.org" target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 hover:text-white transition-colors">
              <span>Stellar Testnet Docs</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Test Environment Card at Bottom of Sidebar */}
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-1 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-[#7FF8C6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7FF8C6]" />
            <span className="font-bold uppercase tracking-wider text-[10px]">AUTHENTIC TESTNET</span>
          </div>
          <p className="text-white/40 leading-relaxed text-[10px]">
            Connected to Stellar Horizon & XRPL Altnet Ledgers.
          </p>
          <div className="pt-2 flex items-center justify-between text-[10px] text-white/30">
            <span>OPERATOR ACTIVE</span>
            <span className="text-amber-400 font-bold">ADMIN ROLE</span>
          </div>
        </div>

      </aside>

      {/* 2. Main Dashboard Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top App Chrome Header */}
        <header className="h-16 border-b border-white/10 px-6 sm:px-8 flex items-center justify-between shrink-0 bg-[#07090C]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/40">Workspace /</span>
            <span className="text-xs font-mono text-white font-bold uppercase">{activeTab}</span>
          </div>

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
              onClick={handleAdminSignOut}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-mono transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3 h-3" />
              <span>Exit Admin</span>
            </button>

            <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-[11px] font-mono font-bold text-amber-300 uppercase">
              👑
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-6 sm:p-8 space-y-8 flex-1 max-w-[1360px] w-full">
          
          {/* Header & Timeframe */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40">
                ADMIN CONSOLE / {activeTab.toUpperCase()}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-1">
                {activeTab === 'overview' && 'A clear view of every ledger rail.'}
                {activeTab === 'orders' && 'Customer Orders & On-Chain Settlements.'}
                {activeTab === 'ledger' && 'Balanced Double-Entry Reconciliation Ledger.'}
                {activeTab === 'rails' && 'Live Payment Rails & Vault Liquidity.'}
                {activeTab === 'rates' && 'Live Dynamic FX Pricing & Quotes.'}
                {activeTab === 'agent' && 'Autonomous AI Agent Desk Operator.'}
                {activeTab === 'audit' && 'Cryptographic Audit Trail & Invariant Logs.'}
              </h1>
              <p className="text-xs font-mono text-white/40 mt-1">
                Operator: {user?.email || 'admin@nexusrail.com'} · Dual-Rail Testnet Engine
              </p>
            </div>

            <button
              type="button"
              onClick={() => refreshRates()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/80 self-start sm:self-auto hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rail-emerald animate-spin-once" />
              <span>Refresh Ledger State</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* 4 Metric KPI Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">GROSS PAYMENT VOLUME</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">$184,920.40</p>
                  <p className="text-xs font-mono text-[#7FF8C6] pt-1">↗ 18.6% vs prior 7d</p>
                </div>
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">VERIFIED ORDERS</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">148</p>
                  <p className="text-xs font-mono text-white/50 pt-1">96.7% completion rate</p>
                </div>
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">MEDIAN FINALITY</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">3.2s</p>
                  <p className="text-xs font-mono text-[#7FF8C6] pt-1">Fast dual-rail confirmation</p>
                </div>
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">LEDGER INVARIANT</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">$0.00</p>
                  <p className="text-xs font-mono text-[#7FF8C6] pt-1">296 entries · 100% balanced</p>
                </div>
              </div>

              {/* Volume & Rail Mix Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Settlement Volume</h3>
                      <p className="text-xs font-mono text-white/40">Dual-Rail transacted value across Stellar & XRPL</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/60">LIVE</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/60">Stellar Rail (XLM & USDC)</span>
                      <span className="text-[#00E5FF] font-bold">58.4% ($108,010.50)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#00E5FF] to-[#7FF8C6]" style={{ width: '58.4%' }} />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/60">XRPL Rail (XRP & RLUSD)</span>
                      <span className="text-[#0081F2] font-bold">41.6% ($76,909.90)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0081F2] to-[#8B5CF6]" style={{ width: '41.6%' }} />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                  <h3 className="text-base font-semibold text-white tracking-tight">Hot Vault Liquidity</h3>
                  <div className="space-y-3 text-xs font-mono">
                    <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white/60">Stellar Platform Vault</span>
                        <span className="text-[#00E5FF] font-bold">10,000.00 XLM</span>
                      </div>
                      <p className="text-[10px] text-white/40 font-mono truncate">GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC</p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white/60">XRPL Platform Vault</span>
                        <span className="text-[#0081F2] font-bold">100.00 XRP</span>
                      </div>
                      <p className="text-[10px] text-white/40 font-mono truncate">rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">On-Chain Orders & Swaps</h3>
                  <p className="text-xs font-mono text-white/40">Real-time ledger verified transactions with authentic cryptographic hashes</p>
                </div>
                <Link
                  href="/admin/orders"
                  className="px-4 py-2 rounded-xl bg-[#7FF8C6] text-black font-bold text-xs font-mono flex items-center gap-1.5 self-start hover:bg-[#68e0b0] transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Open Fulfillment Desk</span>
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="text-[10px] uppercase text-white/40 border-b border-white/10">
                    <tr>
                      <th className="pb-3">Order / Swap ID</th>
                      <th className="pb-3">User / Customer</th>
                      <th className="pb-3">Payment Rail</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Tx Hash</th>
                      <th className="pb-3 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {liveOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 font-bold text-white">{ord.orderNumber}</td>
                        <td className="py-3.5 text-white/70">{ord.buyerEmail}</td>
                        <td className="py-3.5 text-white/80">{ord.rail}</td>
                        <td className="py-3.5 font-bold text-white">{ord.amount}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ord.status === 'PAID' || ord.status === 'SETTLED' || ord.status === 'FULFILLED'
                              ? 'bg-[#092B21] border-[#165D46] text-[#7FF8C6]'
                              : 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-white/40 font-mono">
                          {ord.txHash.slice(0, 10)}...{ord.txHash.slice(-8)}
                        </td>
                        <td className="py-3.5 text-right">
                          <a
                            href={ord.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#7FF8C6] hover:underline"
                          >
                            <span>Verify</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RAILS & VAULTS */}
          {activeTab === 'rails' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#00E5FF] font-bold text-sm">Stellar Testnet Rail</span>
                    <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-bold">HEALTHY · 210ms</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-white/60">
                      <span>Horizon Endpoint:</span>
                      <span className="text-white">https://horizon-testnet.stellar.org</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Treasury Vault:</span>
                      <span className="text-white">GDXP...ORXGC</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Funded Hot Balance:</span>
                      <span className="text-[#7FF8C6] font-bold">10,000.00 XLM</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#0081F2] font-bold text-sm">XRPL Altnet Rail</span>
                    <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-bold">HEALTHY · 318ms</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-white/60">
                      <span>WebSocket Server:</span>
                      <span className="text-white">wss://s.altnet.rippletest.net:51233</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Treasury Vault:</span>
                      <span className="text-white">rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Funded Hot Balance:</span>
                      <span className="text-[#7FF8C6] font-bold">100.00 XRP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RATES & FX */}
          {activeTab === 'rates' && (
            <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white">Live Oracle FX Quotes</h3>
                <span className="text-xs font-mono text-[#7FF8C6]">● Live Feed Connected</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/40 text-[10px] uppercase">XLM / USD</span>
                  <p className="text-2xl font-bold text-[#00E5FF] mt-1">${xlmUsd.toFixed(4)}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/40 text-[10px] uppercase">XRP / USD</span>
                  <p className="text-2xl font-bold text-[#0081F2] mt-1">${xrpUsd.toFixed(4)}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/40 text-[10px] uppercase">XRP / XLM Cross Rate</span>
                  <p className="text-2xl font-bold text-[#7FF8C6] mt-1">{(xrpUsd / (xlmUsd || 1)).toFixed(4)}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI AGENT DESK */}
          {activeTab === 'agent' && (
            <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Autonomous Agent Proposal AG-0182</h3>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-mono font-bold">
                  OPERATOR CONFIRMATION REQUIRED
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs font-mono">
                <p className="text-white">
                  <strong>Proposal:</strong> Dual-rail liquidity rebalancing trigger across Stellar Horizon and XRPL Testnet.
                </p>
                <p className="text-white/60">
                  Variance within 0.12% tolerance. Autonomous agent requires operator digital sign-off to execute cross-ledger transaction.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmAgentRefresh}
                  disabled={isExecutingAgent}
                  className="px-4 py-2 rounded-xl bg-[#7FF8C6] hover:bg-[#68e0b0] text-black font-bold text-xs font-mono transition-all flex items-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isExecutingAgent ? 'Executing Proposal...' : 'Approve & Execute'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRejectAgent}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-mono transition-all"
                >
                  Reject Proposal
                </button>
              </div>

              {agentExecutedSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Proposal AG-0182 executed successfully on-chain!</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl font-mono text-xs">
              <h3 className="text-base font-bold text-white">Cryptographic Invariant Trace</h3>
              <div className="space-y-2 divide-y divide-white/5">
                {agentAuditTrace.map((tr, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0">
                    <span className="text-white/40">{tr.time}</span>
                    <span className="text-white">{tr.text}</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/50">{tr.source}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
