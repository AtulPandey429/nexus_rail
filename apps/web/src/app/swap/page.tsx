'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDownUp,
  Clock,
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Wallet,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useLiveExchangeRates } from '@/lib/rates';
import { readSession, SessionUser, onSessionChange } from '@/lib/shop';

type SwapToken = 'XRP' | 'XLM' | 'USDC' | 'RLUSD';

const TOKEN_DETAILS: Record<SwapToken, { name: string; chain: 'XRPL TESTNET' | 'STELLAR TESTNET'; iconColor: string }> = {
  XRP: { name: 'XRP', chain: 'XRPL TESTNET', iconColor: 'text-[#0081F2]' },
  XLM: { name: 'Stellar Lumens', chain: 'STELLAR TESTNET', iconColor: 'text-[#00E5FF]' },
  USDC: { name: 'USD Coin', chain: 'STELLAR TESTNET', iconColor: 'text-[#2775CA]' },
  RLUSD: { name: 'Ripple USD', chain: 'XRPL TESTNET', iconColor: 'text-[#0081F2]' },
};

export default function SwapPage() {
  const [fromToken, setFromToken] = useState<SwapToken>('XRP');
  const [toToken, setToToken] = useState<SwapToken>('XLM');
  const [payAmount, setPayAmount] = useState('100.00');
  const [slippage, setSlippage] = useState<'0.1%' | '0.5%' | '1.0%'>('0.5%');
  const [showSlippageMenu, setShowSlippageMenu] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Live Exchange Rates Hook with 30-minute caching
  const { xlmUsd, xrpUsd, refreshRates, fromCache, ttlMinutes, loading: ratesLoading } = useLiveExchangeRates();

  // Quote Expiry Timer (45 seconds countdown)
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(42);
  const [quoteUpdatedSecondsAgo, setQuoteUpdatedSecondsAgo] = useState(18);

  // Review Demo Swap Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [swapState, setSwapState] = useState<'idle' | 'signing' | 'success'>('idle');
  const [swapTxHash, setSwapTxHash] = useState('');

  // Synchronize session
  useEffect(() => {
    const sync = () => setUser(readSession().user);
    sync();
    return onSessionChange(sync);
  }, []);

  // Timer tick for 45s quote lifecycle
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteSecondsLeft((prev) => {
        if (prev <= 1) {
          // Auto-refresh rate quote
          refreshRates();
          setQuoteUpdatedSecondsAgo(0);
          return 45;
        }
        return prev - 1;
      });
      setQuoteUpdatedSecondsAgo((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshRates]);

  // Dynamic live rate calculation
  const liveRate = useMemo(() => {
    const fromUsd = fromToken === 'XRP' ? xrpUsd : fromToken === 'XLM' ? xlmUsd : 1.0;
    const toUsd = toToken === 'XLM' ? xlmUsd : toToken === 'XRP' ? xrpUsd : 1.0;
    if (toUsd <= 0) return 2.50;
    return fromUsd / toUsd;
  }, [fromToken, toToken, xlmUsd, xrpUsd]);

  // Compute output amount based on live rates
  const receiveAmount = useMemo(() => {
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const computed = num * liveRate;
    return computed.toFixed(2);
  }, [payAmount, liveRate]);

  // Compute USD estimated values
  const payUsdValue = useMemo(() => {
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const price = fromToken === 'XRP' ? xrpUsd : fromToken === 'XLM' ? xlmUsd : 1.0;
    return (num * price).toFixed(2);
  }, [payAmount, fromToken, xrpUsd, xlmUsd]);

  const receiveUsdValue = useMemo(() => {
    const num = parseFloat(receiveAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const price = toToken === 'XLM' ? xlmUsd : toToken === 'XRP' ? xrpUsd : 1.0;
    return (num * price).toFixed(2);
  }, [receiveAmount, toToken, xlmUsd, xrpUsd]);

  // Minimum received after slippage
  const minReceived = useMemo(() => {
    const num = parseFloat(receiveAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const slipFactor = slippage === '0.1%' ? 0.001 : slippage === '0.5%' ? 0.005 : 0.01;
    return (num * (1 - slipFactor)).toFixed(2);
  }, [receiveAmount, slippage]);

  // Invert tokens
  const handleInvert = () => {
    const prevFrom = fromToken;
    const prevTo = toToken;
    setFromToken(prevTo);
    setToToken(prevFrom);
    setPayAmount(receiveAmount === '0.00' ? '100.00' : receiveAmount);
  };

  // Mock balances
  const xrpBalance = 500.0;
  const xlmBalance = 3480.5;

  // Handle Swap Execution
  const handleConfirmSwap = () => {
    setSwapState('signing');
    setTimeout(() => {
      const mockHash = `tx_${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;
      setSwapTxHash(mockHash);
      setSwapState('success');
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090C] text-slate-900 dark:text-[#F0F4F8] font-sans antialiased selection:bg-[#7FF8C6] selection:text-black transition-colors duration-200">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        
        {/* Header Breadcrumb */}
        <div className="mb-8">
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-slate-400 dark:text-white/40 font-semibold">
            ASSET ROUTING / TESTNET
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-slate-900 dark:text-white tracking-tight mt-2">
            Make your next move.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-white/50 mt-1.5 font-normal">
            Preview a multi-chain test-asset swap. Know the rate, route and limits before you sign.
          </p>
        </div>

        {/* 2-Column Responsive Layout matching Figma Screen 5 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          
          {/* Left Column: Swap Assets Card (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#10141A] border border-slate-200 dark:border-white/10 p-5 sm:p-7 shadow-xl space-y-4">
              
              {/* Card Title & Slippage Selector */}
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Swap assets
                </h2>
                
                {/* Slippage Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSlippageMenu(!showSlippageMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161C24] border border-white/10 text-[10px] font-mono text-white/70 hover:text-white transition-colors"
                  >
                    <span>{slippage} SLIPPAGE</span>
                    <Sliders className="w-3 h-3 text-white/50" />
                  </button>

                  {showSlippageMenu && (
                    <div className="absolute right-0 top-8 z-20 w-36 rounded-lg bg-[#161C24] border border-white/15 p-1 shadow-2xl space-y-1">
                      {(['0.1%', '0.5%', '1.0%'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setSlippage(opt);
                            setShowSlippageMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                            slippage === opt ? 'bg-[#7FF8C6]/20 text-[#7FF8C6] font-bold' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {opt} tolerance
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 1: You Pay */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#090B0E] border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-white/50">
                  <span>You pay</span>
                  <span>Balance: {fromToken === 'XRP' ? `${xrpBalance.toFixed(2)} XRP` : `${xlmBalance.toFixed(2)} XLM`}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <input
                    type="number"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-3xl sm:text-4xl font-mono text-white focus:outline-none placeholder-white/20 font-medium"
                  />

                  {/* Token Badge */}
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161C24] border border-white/15 text-white font-mono text-xs font-semibold shrink-0">
                    <span>{fromToken}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-white/40 pt-1">
                  <span>≈ ${payUsdValue} USD · test value</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-wider text-white/40">{TOKEN_DETAILS[fromToken].chain}</span>
                    <button
                      type="button"
                      onClick={() => setPayAmount(fromToken === 'XRP' ? '500.00' : '3480.50')}
                      className="text-[10px] font-bold text-[#7FF8C6] hover:underline uppercase"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Centered Invert Button */}
              <div className="flex justify-center -my-1 relative z-10">
                <button
                  type="button"
                  onClick={handleInvert}
                  className="w-8 h-8 rounded-full bg-[#161C24] border border-white/20 hover:border-[#7FF8C6]/60 text-white/70 hover:text-white flex items-center justify-center transition-all shadow-md active:scale-95"
                  aria-label="Invert swap directions"
                >
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Box 2: You Receive */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#090B0E] border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-white/50">
                  <span>You receive · estimated</span>
                  <span>Balance: {toToken === 'XLM' ? `${xlmBalance.toFixed(2)} XLM` : `${xrpBalance.toFixed(2)} XRP`}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="w-full text-3xl sm:text-4xl font-mono text-white font-medium select-all">
                    {receiveAmount}
                  </span>

                  {/* Token Badge */}
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161C24] border border-white/15 text-white font-mono text-xs font-semibold shrink-0">
                    <span>{toToken}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-white/40 pt-1">
                  <span>≈ ${receiveUsdValue} USD · test value</span>
                  <span className="text-[10px] tracking-wider text-white/40">{TOKEN_DETAILS[toToken].chain}</span>
                </div>
              </div>

              {/* Exchange Rate Line */}
              <div className="flex items-center justify-between py-2 text-xs font-mono text-white/60">
                <span>Exchange rate</span>
                <span className="text-white font-medium">
                  1 {fromToken} = {liveRate.toFixed(4)} {toToken}
                </span>
              </div>

              {/* Quote Expiry Amber Card */}
              <div className="p-3.5 rounded-lg bg-[#241A0A]/70 border border-[#4D3810] flex items-center gap-2.5 text-xs font-mono text-[#FBBF24]">
                <Clock className="w-4 h-4 text-[#FBBF24] shrink-0" />
                <span>
                  Cached quote · updated {quoteUpdatedSecondsAgo}s ago. Refreshes before approval. Expires in {quoteSecondsLeft}s.
                </span>
              </div>

              {/* Review Demo Swap CTA Button */}
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="w-full py-4 rounded-lg bg-[#7FF8C6] hover:bg-[#6EE7B7] text-[#052E20] font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[#7FF8C6]/10 active:scale-[0.99] cursor-pointer mt-2"
              >
                <span>Review demo swap</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Safety Subtext */}
              <p className="text-xs text-white/40 text-center leading-relaxed pt-1">
                No funds move until you review and approve in both wallets.
              </p>

            </div>

            {/* Bottom Testnet Balances Card */}
            <div className="rounded-xl bg-[#0E1218] border border-white/10 p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Your testnet balances</p>
                <p className="text-xs text-white/40 font-mono mt-0.5">Available before this swap</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono text-white/40 uppercase">STELLAR · {user?.walletAddress ? `${user.walletAddress.slice(0, 4)}..${user.walletAddress.slice(-4)}` : 'GCKF..7Q2M'}</p>
                <p className="text-xl sm:text-2xl font-mono font-medium text-white tracking-tight mt-0.5">
                  {xlmBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} XLM
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: 24H Rates, SVG Chart & Route Visualization (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Top Bar with Swap History */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>Swap history</span>
                <Clock className="w-3.5 h-3.5 text-white/40" />
              </button>
            </div>

            {/* Rate & Chart Header */}
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-white/40 uppercase tracking-wider">
                <span>{fromToken} / {toToken}</span>
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-white/50">
                  {fromCache ? 'CACHED 30M RATES' : 'LIVE ORACLE RATES'}
                </span>
              </div>

              <div className="flex items-baseline gap-4 mt-2">
                <span className="text-4xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                  {liveRate.toFixed(4)}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-xs font-mono font-semibold">
                  +1.24% / 24H
                </span>
              </div>
            </div>

            {/* 24-Hour SVG Rate Line Chart */}
            <div className="rounded-xl bg-[#0E1218] border border-white/10 p-5 space-y-3">
              <div className="h-44 w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7FF8C6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#7FF8C6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area Fill */}
                  <polygon
                    points="0,120 25,125 50,110 75,130 100,105 125,115 150,90 175,110 200,85 225,95 250,80 275,95 300,75 325,85 350,70 375,80 400,65 425,75 450,60 475,65 500,55 500,160 0,160"
                    fill="url(#chartGradient)"
                  />

                  {/* Main Teal Trend Line */}
                  <polyline
                    fill="none"
                    stroke="#7FF8C6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,120 25,125 50,110 75,130 100,105 125,115 150,90 175,110 200,85 225,95 250,80 275,95 300,75 325,85 350,70 375,80 400,65 425,75 450,60 475,65 500,55"
                  />
                </svg>
              </div>

              {/* Time Markers */}
              <div className="flex justify-between text-[10px] font-mono text-white/40 pt-2 border-t border-white/5">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>

            {/* "Your route, explained" Section */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xl font-medium text-white tracking-tight">
                Your route, explained
              </h3>

              {/* Route Chain Flow Pills */}
              <div className="p-4 rounded-xl bg-[#090B0E] border border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="px-3 py-1.5 rounded-md bg-[#161C24] border border-white/10 text-white font-medium">
                  {fromToken === 'XRP' ? 'XRPL' : 'STELLAR'}
                </span>
                <ArrowRight className="w-4 h-4 text-[#7FF8C6]" />
                <span className="px-3 py-1.5 rounded-md bg-[#092B21] border border-[#165D46] text-[#7FF8C6] font-medium">
                  DEMO ENGINE
                </span>
                <ArrowRight className="w-4 h-4 text-[#7FF8C6]" />
                <span className="px-3 py-1.5 rounded-md bg-[#161C24] border border-white/10 text-white font-medium">
                  {toToken === 'XLM' ? 'STELLAR' : 'XRPL'}
                </span>
              </div>

              {/* Execution Details Table */}
              <div className="space-y-3 text-xs font-mono divide-y divide-white/5">
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50">Minimum received</span>
                  <span className="text-white font-medium">{minReceived} {toToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50">Estimated network fee</span>
                  <span className="text-white font-medium">0.000012 {fromToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50">Provider source</span>
                  <span className="text-white/80">{fromCache ? `Cached oracle (${ttlMinutes}m left)` : 'Live network API'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50">Quote reference</span>
                  <span className="text-white font-medium">QT-8821</span>
                </div>
              </div>

              <p className="text-xs text-white/40 leading-relaxed">
                Cross-chain output is simulated in this demo. No mainnet bridge or real liquidity is used.
              </p>
            </div>

            {/* Connected XRPL / Stellar Wallet Box */}
            <div className="p-5 rounded-xl bg-[#0E1218] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-white/40 uppercase">
                  {fromToken === 'XRP' ? 'XRPL' : 'STELLAR'} · rNXs...9b3K
                </p>
                <p className="text-xl font-mono font-medium text-white mt-0.5">
                  500.00 XRP
                </p>
              </div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white hover:bg-white/10 transition-colors"
              >
                Manage wallets
              </button>
            </div>

            {/* Operational Status */}
            <div className="flex items-center gap-2 text-xs font-mono text-white/50">
              <span className="w-2 h-2 rounded-full bg-[#7FF8C6] animate-pulse" />
              <span>Systems operational</span>
            </div>

          </div>

        </div>

      </main>

      {/* Confirmation Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#10141A] border border-white/15 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white">Review Testnet Swap</h3>
              <button
                type="button"
                onClick={() => {
                  setShowReviewModal(false);
                  setSwapState('idle');
                }}
                className="text-white/40 hover:text-white text-lg font-mono"
              >
                ✕
              </button>
            </div>

            {swapState === 'idle' && (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-[#090B0E] border border-white/10 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/50">You pay:</span>
                    <span className="font-bold text-white">{payAmount} {fromToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">You receive (est):</span>
                    <span className="font-bold text-[#7FF8C6]">{receiveAmount} {toToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Exchange rate:</span>
                    <span className="text-white">1 {fromToken} = {liveRate.toFixed(4)} {toToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Max slippage:</span>
                    <span className="text-white">{slippage}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#092B21]/60 border border-[#104D38] text-[#7FF8C6] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Testnet transaction. Simulated atomic settlement.</span>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmSwap}
                  className="w-full py-3.5 rounded-lg bg-[#7FF8C6] hover:bg-[#6EE7B7] text-[#052E20] font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Confirm & Sign Swap
                </button>
              </div>
            )}

            {swapState === 'signing' && (
              <div className="py-8 text-center space-y-4">
                <div className="w-10 h-10 border-2 border-[#7FF8C6] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-mono text-white">Submitting to {fromToken === 'XRP' ? 'XRPL Testnet' : 'Stellar Horizon'}...</p>
                <p className="text-xs text-white/40 font-mono">Simulating atomic cross-rail settlement...</p>
              </div>
            )}

            {swapState === 'success' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#092B21] border border-[#165D46] flex items-center justify-center mx-auto text-[#7FF8C6]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Swap Complete!</h4>
                  <p className="text-xs font-mono text-[#7FF8C6] mt-1">
                    Swapped {payAmount} {fromToken} &rarr; {receiveAmount} {toToken}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#090B0E] border border-white/10 text-left text-xs font-mono text-white/60 truncate">
                  <span className="text-white/40 block text-[10px]">TRANSACTION HASH:</span>
                  <span className="text-white">{swapTxHash}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowReviewModal(false);
                    setSwapState('idle');
                  }}
                  className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Bottom Footer */}
      <footer className="border-t border-white/10 py-5 bg-[#05070A]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-white/40">
          <p>© 2026 NexusRail · Demo environment</p>
          <p>Test assets only. No real funds or fulfillment.</p>
        </div>
      </footer>

    </div>
  );
}
