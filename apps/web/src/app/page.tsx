import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Cpu, Wallet, Layers } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-nexus-dark text-white flex flex-col items-center justify-between p-6 md:p-24 relative overflow-hidden">
      {/* Ambient background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-rail-emerald/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-[400px] h-[400px] bg-cyber-purple/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-6xl flex justify-between items-center z-10 py-4 border-b border-gray-800/60 mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rail-emerald to-cyber-purple flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-rail-emerald/20">
            NR
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            NexusRail
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
            Day 01 Integrated
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center space-y-8 z-10 my-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/80 border border-gray-800 text-xs font-medium text-gray-300 backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-rail-emerald" />
          <span>Multi-Rail Commerce & Sub-300ms AI Agent Desk</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Unified Commerce Engine for{' '}
          <span className="bg-gradient-to-r from-rail-emerald via-stellar-cyan to-cyber-purple bg-clip-text text-transparent">
            Fiat, Web3 & AI Agents
          </span>
        </h1>

        <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          NexusRail integrates Stripe, XRPL, and Stellar Web3 payments with a transactional Groq / Gemini Flash LLM agent desk using Redis proposal locks.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 text-left">
          <div className="p-5 rounded-2xl bg-nexus-card border border-gray-800/80 hover:border-rail-emerald/40 transition-colors">
            <Wallet className="w-6 h-6 text-rail-emerald mb-3" />
            <h3 className="font-semibold text-white mb-1">Multi-Rail Payments</h3>
            <p className="text-xs text-gray-400">
              Stripe Checkout (Fiat) + XRPL Testnet (XRP) + Stellar Horizon (XLM) with double-entry ledgers.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-nexus-card border border-gray-800/80 hover:border-cyber-purple/40 transition-colors">
            <Cpu className="w-6 h-6 text-cyber-purple mb-3" />
            <h3 className="font-semibold text-white mb-1">AI Agent Desk</h3>
            <p className="text-xs text-gray-400">
              Sub-300ms function tool calling with Propose → Confirm → Act Redis proposal locks.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-nexus-card border border-gray-800/80 hover:border-stellar-cyan/40 transition-colors">
            <Layers className="w-6 h-6 text-stellar-cyan mb-3" />
            <h3 className="font-semibold text-white mb-1">Social Commerce</h3>
            <p className="text-xs text-gray-400">
              Mento-inspired product showdowns, verified buyer review badges, and IPFS receipt pinning.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-6 flex justify-center">
          <a
            href="http://localhost:4000/api/v1/health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-rail-emerald text-nexus-dark font-bold hover:bg-rail-emerald/90 transition-all shadow-lg shadow-rail-emerald/25"
          >
            <span>Check API Health Endpoint (`:4000`)</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-6xl border-t border-gray-800/60 pt-6 text-center text-xs text-gray-500 z-10">
        NexusRail Monorepo • Day 01 Integration Complete • $0.00 Free Tier Target Stack
      </footer>
    </main>
  );
}
