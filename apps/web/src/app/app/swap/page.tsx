'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDownUp,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

type Token = 'USD' | 'XLM' | 'XRP' | 'USDC';

const TOKEN_RATES: Record<Token, number> = {
  USD: 1.0,
  USDC: 1.0,
  XLM: 0.124,
  XRP: 0.582,
};

export default function SwapPage() {
  const [fromToken, setFromToken] = useState<Token>('USD');
  const [toToken, setToToken] = useState<Token>('XLM');
  const [fromAmount, setFromAmount] = useState('100.00');
  const [slippage, setSlippage] = useState('0.1%');
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '1W' | '1M'>('24H');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<string | null>(null);

  // Compute conversion
  const toAmount = useMemo(() => {
    const num = parseFloat(fromAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const usdVal = num * TOKEN_RATES[fromToken];
    const out = usdVal / TOKEN_RATES[toToken];
    return out.toFixed(out < 1 ? 4 : 2);
  }, [fromAmount, fromToken, toToken]);

  const exchangeRate = (TOKEN_RATES[fromToken] / TOKEN_RATES[toToken]).toFixed(4);

  const flipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  const handleExecuteSwap = () => {
    setIsSwapping(true);
    setSwapResult(null);

    setTimeout(() => {
      setIsSwapping(false);
      setSwapResult(`Swapped ${fromAmount} ${fromToken} for ${toAmount} ${toToken} on ${toToken === 'XRP' ? 'XRPL' : 'Stellar'} ledger.`);
    }, 1800);
  };

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        
        {/* Header */}
        <div className="border-b border-nexus-border pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-surface border border-nexus-border text-[11px] font-mono uppercase tracking-widest text-rail-emerald mb-4">
            <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
            Soroban & XRPL AMM &bull; Cross-Chain Router
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Make your next move.
          </h1>
          <p className="mt-2 text-sm sm:text-base text-nexus-muted max-w-2xl leading-relaxed">
            Multi-rail asset liquidity and atomic routing across Stellar, XRPL, and fiat reserves.
          </p>
        </div>

        {/* Swap + Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Swap Box (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                  Swap Assets
                </span>
                <span className="text-[11px] font-mono text-nexus-muted flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rail-emerald" />
                  Live Pool
                </span>
              </div>

              {/* You Pay Box */}
              <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-nexus-muted">
                  <span>You pay</span>
                  <div className="flex items-center gap-2">
                    <span>Balance: 1,420.00</span>
                    <button
                      type="button"
                      onClick={() => setFromAmount('1420.00')}
                      className="text-rail-emerald hover:underline text-[10px]"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-2xl font-mono font-extrabold text-white focus:outline-none"
                  />
                  <select
                    value={fromToken}
                    onChange={(e) => setFromToken(e.target.value as Token)}
                    aria-label="Select source token to pay with"
                    className="px-3 py-1.5 rounded-xl bg-nexus-card border border-nexus-border text-white text-xs font-mono font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="USD">USD</option>
                    <option value="USDC">USDC</option>
                    <option value="XLM">XLM</option>
                    <option value="XRP">XRP</option>
                  </select>
                </div>
              </div>

              {/* Flip Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={flipTokens}
                  className="p-2 rounded-xl bg-nexus-surface border border-nexus-border hover:border-rail-emerald text-nexus-muted hover:text-white transition-all shadow-md"
                  aria-label="Invert exchange direction"
                >
                  <ArrowDownUp className="w-4 h-4" />
                </button>
              </div>

              {/* You Receive Box */}
              <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-nexus-muted">
                  <span>You receive</span>
                  <span>Estimated</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    readOnly
                    value={toAmount}
                    className="w-full bg-transparent text-2xl font-mono font-extrabold text-rail-emerald focus:outline-none cursor-default"
                  />
                  <select
                    value={toToken}
                    onChange={(e) => setToToken(e.target.value as Token)}
                    aria-label="Select destination token to receive"
                    className="px-3 py-1.5 rounded-xl bg-nexus-card border border-nexus-border text-white text-xs font-mono font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="XLM">XLM</option>
                    <option value="XRP">XRP</option>
                    <option value="USD">USD</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </div>

              {/* Conversion rate & Slippage */}
              <div className="space-y-3 pt-2 text-xs font-mono border-t border-nexus-border">
                <div className="flex justify-between text-nexus-muted">
                  <span>Rate</span>
                  <span className="text-white">1 {fromToken} &asymp; {exchangeRate} {toToken}</span>
                </div>

                <div className="flex items-center justify-between text-nexus-muted">
                  <span>Max slippage</span>
                  <div className="flex items-center gap-1.5">
                    {['0.1%', '0.5%', '1.0%'].map((slip) => (
                      <button
                        key={slip}
                        type="button"
                        onClick={() => setSlippage(slip)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          slippage === slip
                            ? 'bg-rail-emerald text-nexus-dark'
                            : 'bg-nexus-surface text-nexus-muted hover:text-white'
                        }`}
                      >
                        {slip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-nexus-muted">
                  <span>Network routing fee</span>
                  <span className="text-rail-emerald">&lt; $0.0001</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleExecuteSwap}
                disabled={isSwapping}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-rail-emerald text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-rail-emerald/10 disabled:opacity-60"
              >
                {isSwapping ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing atomic multi-rail swap...</span>
                  </>
                ) : (
                  <>
                    <span>Swap {fromToken} to {toToken}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Success Notification */}
              {swapResult && (
                <div className="p-3.5 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs font-mono flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{swapResult}</span>
                </div>
              )}
            </div>

            {/* Route Diagram */}
            <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-2 text-xs font-mono">
              <span className="text-[10px] uppercase text-nexus-muted block">Optimal Routing Path</span>
              <div className="flex items-center gap-2 text-white">
                <span className="px-2 py-1 rounded bg-nexus-card border border-nexus-border">{fromToken}</span>
                <span className="text-nexus-muted">&rarr;</span>
                <span className="px-2 py-1 rounded bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald">
                  Nexus Market Router
                </span>
                <span className="text-nexus-muted">&rarr;</span>
                <span className="px-2 py-1 rounded bg-nexus-card border border-nexus-border">{toToken}</span>
              </div>
            </div>
          </div>

          {/* Right Chart & Liquidity Stats (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 24h Interactive Chart */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{fromToken} / {toToken}</span>
                    <span className="flex items-center gap-1 text-xs font-mono text-rail-emerald bg-rail-emerald/10 border border-rail-emerald/30 px-2 py-0.5 rounded">
                      <TrendingUp className="w-3 h-3" />
                      +3.42% 24h
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-mono font-extrabold text-white mt-1">
                    {exchangeRate} <span className="text-xs text-nexus-muted font-normal">{toToken}</span>
                  </p>
                </div>

                {/* Timeframe Toggles */}
                <div className="flex items-center gap-1 bg-nexus-surface p-1 rounded-xl border border-nexus-border text-xs font-mono">
                  {(['1H', '24H', '1W', '1M'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        timeframe === tf
                          ? 'bg-nexus-card text-white font-bold'
                          : 'text-nexus-muted hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart SVG Visualization */}
              <div className="h-56 w-full relative flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="0" y1="45" x2="500" y2="45" stroke="#1D2230" strokeDasharray="4 4" />
                  <line x1="0" y1="90" x2="500" y2="90" stroke="#1D2230" strokeDasharray="4 4" />
                  <line x1="0" y1="135" x2="500" y2="135" stroke="#1D2230" strokeDasharray="4 4" />

                  {/* Gradient Area */}
                  <polygon
                    fill="url(#chartGradient)"
                    points="0,180 0,140 50,130 100,145 150,110 200,95 250,115 300,75 350,85 400,50 450,60 500,30 500,180"
                  />

                  {/* Trend Line */}
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,140 50,130 100,145 150,110 200,95 250,115 300,75 350,85 400,50 450,60 500,30"
                  />

                  {/* Peak Marker */}
                  <circle cx="500" cy="30" r="4" fill="#10B981" />
                </svg>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-nexus-muted border-t border-nexus-border pt-3">
                <span>00:00 UTC</span>
                <span>06:00 UTC</span>
                <span>12:00 UTC</span>
                <span>18:00 UTC</span>
                <span className="text-white">Live Rate</span>
              </div>
            </div>

            {/* Depth & Rail Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-nexus-card border border-nexus-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-nexus-muted block">24h Volume</span>
                <span className="text-sm font-mono font-bold text-white">$1,842,900</span>
              </div>
              <div className="p-4 rounded-xl bg-nexus-card border border-nexus-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-nexus-muted block">AMM Liquidity</span>
                <span className="text-sm font-mono font-bold text-white">$4,250,000</span>
              </div>
              <div className="p-4 rounded-xl bg-nexus-card border border-nexus-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-nexus-muted block">Avg Finality</span>
                <span className="text-sm font-mono font-bold text-rail-emerald">3.2s</span>
              </div>
              <div className="p-4 rounded-xl bg-nexus-card border border-nexus-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-nexus-muted block">Ledger Fee</span>
                <span className="text-sm font-mono font-bold text-white">&lt; $0.0001</span>
              </div>
            </div>

            {/* Supported Networks Banner */}
            <div className="p-5 rounded-2xl bg-nexus-surface border border-nexus-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-rail-emerald text-xs font-mono uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cross-Chain Interoperability</span>
                </div>
                <p className="text-xs text-nexus-muted">
                  Powered by Soroban smart contract liquidity pools and XRPL native automated market rippling.
                </p>
              </div>

              <Link
                href="/store"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-nexus-card border border-nexus-border hover:border-rail-emerald text-xs font-mono text-white transition-colors whitespace-nowrap"
              >
                <span>Shop storefront</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
