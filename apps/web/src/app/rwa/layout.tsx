'use client';

import React from 'react';
import Link from 'next/link';
import { Coins, Zap, ShieldCheck, TrendingUp, ShoppingCart, ArrowLeft } from 'lucide-react';

export default function RwaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-nexus-dark text-white flex flex-col items-center p-4 md:p-10 relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 blur-[170px] rounded-full pointer-events-none" />

      {/* RWA Header Navigation Bar */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 py-4 border-b border-gray-800/80 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center font-bold text-lg text-nexus-dark shadow-lg shadow-amber-500/20">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
              Nexus RWA Commodities
            </span>
            <span className="text-[10px] block text-gray-400 font-mono">Tokenized Physical Gold & Silver Protocol</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <Link href="/rwa" className="px-3.5 py-1.5 rounded-xl bg-gray-900/80 border border-gray-800 hover:border-amber-400 text-gray-300 hover:text-white transition-all">
            Vault Overview
          </Link>
          <Link href="/rwa/buy" className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-400 font-bold hover:bg-amber-500/30 transition-all flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Buy Gold/Silver
          </Link>
          <Link href="/rwa/perps" className="px-3.5 py-1.5 rounded-xl bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple font-bold hover:bg-cyber-purple/30 transition-all flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Ostium Perps
          </Link>
        </div>
      </header>

      {/* Main Page Area */}
      <div className="w-full max-w-6xl z-10">{children}</div>

      {/* Footer */}
      <footer className="w-full max-w-6xl border-t border-gray-800/60 pt-6 mt-12 text-center text-xs text-gray-500 z-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>Nexus RWA Protocol • 1 Token = 1 Gram Physical Asset</div>
        <div className="font-mono text-[11px] text-gray-400">
          Stellar Horizon Testnet • Live CoinGecko Pyth Oracle
        </div>
      </footer>
    </div>
  );
}
