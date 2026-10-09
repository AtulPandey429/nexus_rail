'use client';

import React from 'react';
import {
  Coins,
  ShoppingBag,
  User,
  ShieldCheck,
  BarChart3,
  Bot,
  ShoppingCart,
  Zap,
  TrendingUp,
  LogOut,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export type ViewType =
  | 'rwa'
  | 'rwa_buy'
  | 'rwa_perps'
  | 'storefront'
  | 'buyer'
  | 'cart'
  | 'orders'
  | 'guide'
  | 'admin'
  | 'admin_orders'
  | 'analytics'
  | 'plugins';

interface AuthUser {
  id: string;
  email?: string;
  walletAddress?: string;
  role: 'user' | 'admin';
}

interface NavbarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  cartCount: number;
  onOpenAgentDesk: () => void;
  onOpenAuthModal: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export function Navbar({
  activeView,
  setActiveView,
  cartCount,
  onOpenAgentDesk,
  onOpenAuthModal,
  user,
  onLogout,
}: NavbarProps) {
  const isRwaActive = activeView === 'rwa' || activeView === 'rwa_buy' || activeView === 'rwa_perps';
  const isCommerceActive = activeView === 'storefront';
  const isBuyerActive = activeView === 'buyer' || activeView === 'cart' || activeView === 'orders' || activeView === 'guide';
  const isAdminActive = activeView === 'admin' || activeView === 'admin_orders';
  const isAnalyticsActive = activeView === 'analytics' || activeView === 'plugins';

  return (
    <header className="w-full max-w-6xl z-30 mb-6 space-y-3">
      {/* Upper Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-3 px-4 rounded-2xl bg-nexus-card/90 border border-gray-800/90 backdrop-blur-xl shadow-2xl">
        {/* Brand Identity */}
        <div
          onClick={() => setActiveView('rwa')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-rail-emerald to-cyber-purple flex items-center justify-center font-bold text-lg text-nexus-dark shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-all">
            NR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                NexusRail
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-bold text-amber-400 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                RWA Flagship
              </span>
            </div>
            <span className="text-[11px] block text-gray-400 font-mono">
              Real-World Commodity Vault (Gold/Silver) & Multi-Rail Payments
            </span>
          </div>
        </div>

        {/* Right Action Icons & Login */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Desk Button */}
          <button
            onClick={onOpenAgentDesk}
            className="px-3.5 py-2 rounded-xl bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-cyber-purple/10"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Launch AI Agent</span>
          </button>

          {/* Cart Counter */}
          <button
            onClick={() => setActiveView('cart')}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeView === 'cart'
                ? 'bg-rail-emerald/20 text-rail-emerald border-rail-emerald/60'
                : 'bg-gray-900 border-gray-800 text-gray-300 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="px-1.5 py-0.5 rounded-full bg-rail-emerald text-nexus-dark font-extrabold text-[10px]">
              {cartCount}
            </span>
          </button>

          {/* User Auth / Profile Button */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              <div className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
                <span className="font-mono text-white text-[11px]">
                  {user.email || (user.walletAddress ? `${user.walletAddress.substring(0, 6)}...` : 'User')}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-rail-emerald/20 text-rail-emerald text-[9px] uppercase font-bold">
                  {user.role}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-rose-500/50 text-gray-400 hover:text-rose-400 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rail-emerald to-emerald-600 text-nexus-dark font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rail-emerald/20 hover:opacity-90 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Login / Web3 Connect</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Categorized Navigation Bar */}
      <nav className="w-full p-1.5 rounded-2xl bg-nexus-card/90 border border-gray-800/90 backdrop-blur-xl shadow-2xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Section 1: RWA Commodities (Flagship Skill) */}
          <div className="relative group">
            <button
              onClick={() => setActiveView('rwa')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                isRwaActive
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/60 shadow-lg shadow-amber-500/10'
                  : 'text-gray-400 hover:text-white border-transparent'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>🥇 1. RWA Gold & Silver</span>
            </button>
          </div>

          <button
            onClick={() => setActiveView('rwa_buy')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              activeView === 'rwa_buy'
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/60'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Buy Gold Tokens</span>
          </button>

          <button
            onClick={() => setActiveView('rwa_perps')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              activeView === 'rwa_perps'
                ? 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/60'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-cyber-purple" />
            <span>Ostium Perps</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-800 mx-1 hidden md:block" />

          {/* Section 2: Storefront */}
          <button
            onClick={() => setActiveView('storefront')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isCommerceActive
                ? 'bg-rail-emerald/20 text-rail-emerald border-rail-emerald/60 shadow-lg shadow-rail-emerald/10'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-rail-emerald" />
            <span>🛒 2. Commerce Storefront</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-800 mx-1 hidden md:block" />

          {/* Section 3: Buyer Space */}
          <button
            onClick={() => setActiveView('buyer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isBuyerActive
                ? 'bg-stellar-cyan/20 text-stellar-cyan border-stellar-cyan/60 shadow-lg shadow-stellar-cyan/10'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <User className="w-3.5 h-3.5 text-stellar-cyan" />
            <span>👤 3. Buyer Dashboard</span>
          </button>

          <button
            onClick={() => setActiveView('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              activeView === 'orders'
                ? 'bg-stellar-cyan/20 text-stellar-cyan border-stellar-cyan/60'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <span>Orders Timeline</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-800 mx-1 hidden md:block" />

          {/* Section 4: Admin Desk */}
          <button
            onClick={() => setActiveView('admin')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isAdminActive
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/60 shadow-lg shadow-amber-500/10'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>👑 4. Admin Desk</span>
          </button>

          {/* Section 5: Analytics & Plugins */}
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isAnalyticsActive
                ? 'bg-blue-500/20 text-blue-400 border-blue-400/60'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span>📊 Analytics & Plugins</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
