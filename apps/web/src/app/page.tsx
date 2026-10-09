'use client';

import React, { useState } from 'react';
import { MultiRailCheckoutSelector } from '@/components/MultiRailCheckoutSelector';
import { AgentDeskPanel } from '@/components/AgentDeskPanel';
import { ProductShowdownCard } from '@/components/ProductShowdownCard';
import { AnalyticsLedgerDashboard } from '@/components/AnalyticsLedgerDashboard';
import { PluginsShowcase } from '@/components/PluginsShowcase';
import { RwaGoldVaultCard } from '@/components/RwaGoldVaultCard';
import { Zap, Bot, ShieldCheck, Layers, Sparkles, Activity, Cpu, BarChart3, ShoppingBag, Coins } from 'lucide-react';

export default function Home() {
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'checkout' | 'social' | 'analytics' | 'plugins' | 'rwa'>('rwa');

  return (
    <main className="min-h-screen bg-nexus-dark text-white flex flex-col items-center justify-between p-4 md:p-10 relative overflow-x-hidden">
      {/* Ambient Glow Background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-rail-emerald/10 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-[600px] h-[600px] bg-cyber-purple/10 blur-[180px] rounded-full pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-6xl flex justify-between items-center z-10 py-4 border-b border-gray-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rail-emerald to-cyber-purple flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-rail-emerald/20">
            NR
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              NexusRail
            </span>
            <span className="text-[10px] block text-gray-400 font-mono">Multi-Rail Commerce & AI Agent Desk</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAgentOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/30 text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-cyber-purple/10"
          >
            <Bot className="w-4 h-4" />
            <span>Launch AI Agent Desk</span>
          </button>
          <span className="text-xs font-mono px-3 py-1.5 rounded-full bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
            All 35 Days Active
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full max-w-5xl text-center space-y-5 z-10 py-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-900/90 border border-gray-800 text-xs font-medium text-gray-300 backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-rail-emerald" />
          <span>RWA Gold & Silver Oracles + Stripe Fiat + XRPL + Stellar + Groq AI Engine</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Enterprise Multi-Rail Commerce Engine for{' '}
          <span className="bg-gradient-to-r from-rail-emerald via-stellar-cyan to-cyber-purple bg-clip-text text-transparent">
            Fiat, Web3 & Autonomous AI Agents
          </span>
        </h1>

        <p className="text-gray-400 text-sm max-w-2xl mx-auto leading-relaxed">
          NexusRail combines RWA Gold & Silver tokenization, multi-currency checkout, atomic double-entry wallet ledgers, IPFS order receipts, and sub-300ms AI agent tool execution using Redis proposal locks.
        </p>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 pt-4 z-20">
          <button
            onClick={() => setActiveTab('rwa')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              activeTab === 'rwa'
                ? 'bg-amber-500/20 text-amber-400 border-amber-400/60 shadow-lg shadow-amber-500/10'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>1. RWA Gold & Silver Vault</span>
          </button>

          <button
            onClick={() => setActiveTab('checkout')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              activeTab === 'checkout'
                ? 'bg-rail-emerald/20 text-rail-emerald border-rail-emerald/60 shadow-lg shadow-rail-emerald/10'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>2. Multi-Rail Checkout</span>
          </button>

          <button
            onClick={() => setActiveTab('social')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              activeTab === 'social'
                ? 'bg-stellar-cyan/20 text-stellar-cyan border-stellar-cyan/60 shadow-lg shadow-stellar-cyan/10'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Social Showdowns</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              activeTab === 'analytics'
                ? 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/60 shadow-lg shadow-cyber-purple/10'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>4. Ledger & Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('plugins')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              activeTab === 'plugins'
                ? 'bg-rail-emerald/20 text-rail-emerald border-rail-emerald/60 shadow-lg shadow-rail-emerald/10'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>5. Extension Plugins</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-5xl z-10 py-6">
        {activeTab === 'rwa' && <RwaGoldVaultCard />}

        {activeTab === 'checkout' && (
          <div className="flex flex-col items-center max-w-md mx-auto">
            <div className="w-full text-xs font-mono text-rail-emerald uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Live Interactive Multi-Rail Checkout Selector
            </div>
            <MultiRailCheckoutSelector
              priceCents={49900}
              productTitle="XRPL Starter Validator Node Hardware Kit"
            />
          </div>
        )}

        {activeTab === 'social' && (
          <div className="flex flex-col items-center max-w-md mx-auto">
            <div className="w-full text-xs font-mono text-stellar-cyan uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Live Mento Product Showdown & Community Voting
            </div>
            <ProductShowdownCard />
          </div>
        )}

        {activeTab === 'analytics' && <AnalyticsLedgerDashboard />}

        {activeTab === 'plugins' && <PluginsShowcase />}
      </div>

      {/* Floating AI Launcher Button */}
      <button
        onClick={() => setIsAgentOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-2xl bg-gradient-to-br from-rail-emerald to-cyber-purple text-nexus-dark font-bold text-xs shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform z-40"
      >
        <Sparkles className="w-5 h-5" />
        <span>Ask AI Agent Desk</span>
      </button>

      {/* Slide-over Agent Chat Panel */}
      <AgentDeskPanel isOpen={isAgentOpen} onClose={() => setIsAgentOpen(false)} />

      {/* Footer */}
      <footer className="w-full max-w-6xl border-t border-gray-800/60 pt-6 mt-12 text-center text-xs text-gray-500 z-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>NexusRail Monorepo • Full 35-Day Flagship Architecture</div>
        <div className="font-mono text-[11px] text-gray-400">
          Deployed on Vercel & Render • 100% Free Tier Stack
        </div>
      </footer>
    </main>
  );
}
