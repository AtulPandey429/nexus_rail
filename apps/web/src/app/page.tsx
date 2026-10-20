'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Rocket,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Bot,
  Activity,
  Layers,
  HelpCircle,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { addSkuToCart } from '@/lib/shop';
import { NexusLogo } from '@/components/NexusLogo';
import { Nexus3DCanvas } from '@/components/Nexus3DCanvas';

export default function HomePage() {
  const [addingSku, setAddingSku] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleQuickAdd = async (sku: string) => {
    setAddingSku(sku);
    try {
      await addSkuToCart(sku);
      setToastMessage(`${sku} added to your bag.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('Item added to your bag.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setAddingSku(null);
    }
  };

  const FAQS = [
    {
      q: 'Is this real money?',
      a: 'No. NexusRail is a testnet demo. Assets have no monetary value, and products are illustrative for demonstration.',
    },
    {
      q: 'Which networks can I use?',
      a: 'Stellar testnet (XLM) and XRPL altnet testnet (XRP) are currently live. EVM and Solana testnets are in active staging.',
    },
    {
      q: 'Do I need a wallet to sign in?',
      a: 'No. Start with email or explore the demo anonymously. Connect a compatible testnet wallet (Freighter, GemWallet, Xaman) when you want to authorize a payment.',
    },
    {
      q: 'How does double-entry reconciliation work?',
      a: 'Every customer payment generates a balanced journal entry recorded in MongoDB, binding on-chain ledger hashes to orders with zero fabrication.',
    },
  ];

  return (
    <main className="min-h-screen bg-transparent text-[var(--foreground)] selection:bg-[var(--gold)]/30 transition-colors duration-200 overflow-x-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl nexus-glass-surface border border-[var(--gold)]/40 text-[var(--gold)] text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-fade-in-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          HERO SECTION: Commerce, on better rails (Portfolio Animated)
         ========================================================================= */}
      <section className="relative overflow-hidden border-b border-[var(--border)] pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32">
        {/* Floating Ambient Glow Orbs (Portfolio style) */}
        <div className="absolute top-10 -left-20 w-72 h-72 sm:w-96 sm:h-96 bg-[var(--ambient-1)] rounded-full blur-3xl pointer-events-none animate-float" />
        <div className="absolute top-32 -right-20 w-72 h-72 sm:w-96 sm:h-96 bg-[var(--ambient-2)] rounded-full blur-3xl pointer-events-none animate-float-delayed" />
        <div className="absolute -bottom-10 left-1/3 w-64 h-64 bg-[var(--ambient-1)] rounded-full blur-3xl pointer-events-none animate-pulse-slow" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
              {/* Top Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full nexus-glass-surface border border-[var(--border)] text-[11px] font-mono text-[var(--muted)] tracking-wider uppercase shadow-sm animate-fade-in-up">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
                <span>Commerce without the chain friction</span>
              </div>

              {/* Headline with animated gradient */}
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.08]">
                  Commerce, on <br />
                  <span className="bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-x">
                    better rails.
                  </span>
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-[var(--muted)] max-w-xl font-normal leading-relaxed">
                  One unified storefront. Dual multi-rail settlement across Stellar and XRPL. Real-time rate feeds, cryptographic pre-flight review, and a clean double-entry ledger.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link
                  href="/store"
                  className="px-6 py-3.5 rounded-xl bg-[var(--gold)] text-black font-extrabold text-sm hover:bg-[var(--gold-bright)] transition-all shadow-lg shadow-[var(--gold)]/25 flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-95"
                >
                  <span>Explore Flagship Store</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#how-it-works"
                  className="px-6 py-3.5 rounded-xl nexus-glass-surface hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] hover:text-[var(--gold)] font-semibold text-sm transition-all flex items-center justify-center shadow-sm hover:scale-[1.02] active:scale-95"
                >
                  See how it works
                </a>
              </div>

              {/* Built on Testnet Badge */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-mono text-[var(--muted)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                  <span className="text-[var(--foreground)] font-bold uppercase tracking-wider">
                    Enterprise Multi-Rail Protocol. Dual-Ledger Settlement.
                  </span>
                </div>
              </div>

              {/* Network Ticker Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                <div className="px-3 py-1.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-[var(--foreground)] flex items-center gap-2 shadow-sm hover:border-stellar-cyan transition-colors">
                  <span className="w-2 h-2 rounded-full bg-stellar-cyan animate-pulse" />
                  <span className="font-bold">Stellar</span>
                  <span className="text-stellar-cyan font-bold">ACTIVE</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-[var(--foreground)] flex items-center gap-2 shadow-sm hover:border-xrpl-blue transition-colors">
                  <span className="w-2 h-2 rounded-full bg-xrpl-blue animate-pulse" />
                  <span className="font-bold">XRPL</span>
                  <span className="text-xrpl-blue font-bold">ACTIVE</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-[var(--muted)] opacity-60 flex items-center gap-2">
                  <span>EVM</span>
                  <span className="text-[9px] uppercase font-bold">STAGING</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-[var(--muted)] opacity-60 flex items-center gap-2">
                  <span>Solana</span>
                  <span className="text-[9px] uppercase font-bold">STAGING</span>
                </div>
              </div>
            </div>

            {/* Right Visual: 3D Multi-Rail Holographic Nexus with Interactive Parallax */}
            <div className="lg:col-span-5 w-full relative">
              <div className="relative rounded-3xl p-6 sm:p-7 nexus-glass-card border border-[var(--border)] shadow-2xl overflow-hidden card-3d-glow group">
                
                {/* 3D WebGL Particle Canvas Layer */}
                <div className="absolute inset-0 z-0 opacity-80 flex items-center justify-center pointer-events-none">
                  <Nexus3DCanvas variant="hero" className="w-full h-full" />
                </div>

                {/* Node connection visual */}
                <div className="relative z-10 flex justify-between items-center text-xs font-mono text-[var(--muted)] border-b border-[var(--border)] pb-4">
                  <span className="flex items-center gap-1.5 text-stellar-cyan font-bold">
                    <Rocket className="w-3.5 h-3.5 animate-bounce" /> Stellar
                  </span>
                  <span className="px-2.5 py-1 rounded-md nexus-glass-surface text-[10px] text-[var(--foreground)] font-bold border border-[var(--border)]">
                    XLM / XRP
                  </span>
                  <span className="flex items-center gap-1.5 text-xrpl-blue font-bold">
                    <Zap className="w-3.5 h-3.5 animate-pulse" /> XRPL
                  </span>
                </div>

                {/* Center Routing graphic */}
                <div className="relative z-10 my-8 sm:my-10 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--gold)]/10 border border-[var(--gold)]/40 flex items-center justify-center shadow-2xl shadow-[var(--gold)]/20 group-hover:scale-110 transition-transform duration-500 backdrop-blur-md">
                    <NexusLogo size={52} glow priority className="shadow-lg" />
                  </div>
                  <div className="text-center font-mono space-y-1">
                    <div className="text-xs text-[var(--muted)] uppercase tracking-widest font-semibold">
                      Multi-Rail Routing Engine
                    </div>
                    <div className="text-[11px] text-[var(--gold)] font-bold flex items-center justify-center gap-1">
                      <span>STELLAR</span> &rarr; <span>LEDGER</span> &rarr; <span>RECEIPT</span>
                    </div>
                  </div>
                </div>

                {/* Floating Order Badge */}
                <div className="relative z-10 p-4 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-between font-mono text-xs shadow-md">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase block">Order ID</span>
                    <span className="font-bold text-[var(--foreground)]">#NR8K2P9X</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--muted)] uppercase block">Total Settled</span>
                    <span className="font-extrabold text-[var(--gold)] text-sm sm:text-base">$200.02 USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 01: The Demo Storefront ("Good objects. Better checkout.")
         ========================================================================= */}
      <section className="py-16 sm:py-24 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                01 / THE FLAGSHIP STOREFRONT
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
                Good objects. Better checkout.
              </h2>
            </div>
            <Link
              href="/store"
              className="text-xs font-mono text-[var(--gold)] hover:text-[var(--gold-bright)] flex items-center gap-1.5 transition-colors group font-bold"
            >
              <span>Shop all products</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Product Cards Grid (Responsive 1/2/3 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Product 1 */}
            <div className="p-6 rounded-2xl nexus-glass-card border border-[var(--border)] hover:border-[var(--gold)]/60 transition-all flex flex-col justify-between group space-y-6 shadow-sm hover:shadow-xl hover:-translate-y-1">
              <div className="space-y-3">
                <div className="w-full h-44 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-center font-mono text-xs">
                  <div className="text-center space-y-1">
                    <ShieldCheck className="w-8 h-8 text-[var(--gold)] mx-auto group-hover:scale-110 transition-transform" />
                    <span className="block text-[11px] text-[var(--muted)]">Offline Cold Signer</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-[var(--foreground)] text-base">Rail One</h3>
                    <span className="font-mono text-sm font-bold text-[var(--foreground)]">$129.00</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">Self-custody, beautifully offline.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickAdd('HARDWARE-WALLET-01')}
                disabled={addingSku === 'HARDWARE-WALLET-01'}
                className="w-full py-2.5 rounded-lg nexus-glass-surface hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] transition-colors active:scale-95 cursor-pointer"
              >
                {addingSku === 'HARDWARE-WALLET-01' ? 'Adding…' : 'Add to bag'}
              </button>
            </div>

            {/* Product 2 */}
            <div className="p-6 rounded-2xl nexus-glass-card border border-[var(--border)] hover:border-stellar-cyan/60 transition-all flex flex-col justify-between group space-y-6 shadow-sm hover:shadow-xl hover:-translate-y-1">
              <div className="space-y-3">
                <div className="w-full h-44 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-center font-mono text-xs">
                  <div className="text-center space-y-1">
                    <Layers className="w-8 h-8 text-stellar-cyan/80 mx-auto group-hover:scale-110 transition-transform" />
                    <span className="block text-[11px] text-[var(--muted)]">Precision Work Surface</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-[var(--foreground)] text-base">Relay desk mat</h3>
                    <span className="font-mono text-sm font-bold text-[var(--foreground)]">$39.00</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">A grounded space for your next move.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickAdd('DESK-MAT-01')}
                disabled={addingSku === 'DESK-MAT-01'}
                className="w-full py-2.5 rounded-lg nexus-glass-surface hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] transition-colors active:scale-95 cursor-pointer"
              >
                {addingSku === 'DESK-MAT-01' ? 'Adding…' : 'Add to bag'}
              </button>
            </div>

            {/* Product 3 */}
            <div className="p-6 rounded-2xl nexus-glass-card border border-[var(--border)] hover:border-[var(--gold)]/60 transition-all flex flex-col justify-between group space-y-6 shadow-sm hover:shadow-xl hover:-translate-y-1">
              <div className="space-y-3">
                <div className="w-full h-44 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-center font-mono text-xs">
                  <div className="text-center space-y-1">
                    <Activity className="w-8 h-8 text-[var(--gold)]/80 mx-auto group-hover:scale-110 transition-transform" />
                    <span className="block text-[11px] text-[var(--muted)]">Heavyweight Cotton</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-[var(--foreground)] text-base">Nexus tee</h3>
                    <span className="font-mono text-sm font-bold text-[var(--foreground)]">$32.00</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">A uniform for the onchain everyday.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickAdd('NEXUS-TEE-01')}
                disabled={addingSku === 'NEXUS-TEE-01'}
                className="w-full py-2.5 rounded-lg nexus-glass-surface hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] transition-colors active:scale-95 cursor-pointer"
              >
                {addingSku === 'NEXUS-TEE-01' ? 'Adding…' : 'Add to bag'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02: Less Friction ("From discovery to receipt.")
         ========================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-24 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
              02 / LESS FRICTION
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
              From discovery to receipt. <br className="hidden sm:inline" />
              Without the detours.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 sm:p-7 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-xs font-mono font-bold text-[var(--gold)] block">01</span>
              <h3 className="text-base font-bold text-[var(--foreground)]">Make yourself at home</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Connect a wallet or sign in with an account. Browse a curated catalog with real-time testnet inventory.
              </p>
            </div>

            <div className="p-6 sm:p-7 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-xs font-mono font-bold text-stellar-cyan block">02</span>
              <h3 className="text-base font-bold text-[var(--foreground)]">Choose your rail</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                See available networks, fresh quotes and network fees side by side before you approve anything.
              </p>
            </div>

            <div className="p-6 sm:p-7 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-xs font-mono font-bold text-xrpl-blue block">03</span>
              <h3 className="text-base font-bold text-[var(--foreground)]">Leave with clarity</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Track your order and open a receipt backed by double-entry ledger entries and verifiable on-chain hashes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03 & 04: Payment Your Way & Ledger Record
         ========================================================================= */}
      <section className="py-16 sm:py-24 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          {/* Section 03: Multi-Rail Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                03 / PAYMENT, YOUR WAY
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
                One checkout. <br />
                More ways forward.
              </h2>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                Stellar or XRPL, side by side. Compare the network, asset and fee before taking one deliberate checkout step.
              </p>
              <div className="pt-2">
                <Link
                  href="/store"
                  className="text-xs font-mono text-[var(--gold)] hover:text-[var(--gold-bright)] flex items-center gap-1.5 font-bold"
                >
                  <span>Try a testnet checkout</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Interactive Rail Preview Card */}
            <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-3 shadow-xl">
              <div className="text-xs font-mono text-[var(--muted)] uppercase mb-2 font-semibold">
                Choose a payment rail
              </div>
              
              <div className="p-4 rounded-xl nexus-glass-surface border border-stellar-cyan/40 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 text-stellar-cyan" />
                    <span>Stellar (XLM)</span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)] font-mono mt-0.5">Horizon Testnet • Instant memo check</div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-[var(--foreground)] font-bold">~84.92 XLM</div>
                  <span className="text-[10px] text-stellar-cyan font-bold">TESTNET</span>
                </div>
              </div>

              <div className="p-4 rounded-xl nexus-glass-surface border border-xrpl-blue/40 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-xrpl-blue" />
                    <span>XRPL (XRP)</span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)] font-mono mt-0.5">Altnet WebSocket • 32-bit tag</div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-[var(--foreground)] font-bold">~84.95 XRP</div>
                  <span className="text-[10px] text-xrpl-blue font-bold">TESTNET</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 04: Double-Entry Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center pt-8 border-t border-[var(--border)]">
            {/* Journal Preview Card */}
            <div className="lg:col-span-6 order-2 lg:order-1 p-5 sm:p-6 rounded-2xl nexus-glass-card border border-[var(--border)] font-mono text-xs space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <span className="font-bold text-[var(--foreground)]">JOURNAL / #NR8K2P9X</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  BALANCED
                </span>
              </div>
              <div className="space-y-2 text-[var(--muted)] text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Customer clearing</span>
                  <span>DEBIT <strong className="text-[var(--foreground)]">$200.00</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Merchant payable</span>
                  <span>CREDIT <strong className="text-[var(--foreground)]">$200.00</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Network expense</span>
                  <span>DEBIT <strong className="text-[var(--foreground)]">$0.02</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Network clearing</span>
                  <span>CREDIT <strong className="text-[var(--foreground)]">$0.02</strong></span>
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border)] flex justify-between text-xs font-bold text-[var(--foreground)]">
                <span>Debits = Credits</span>
                <span className="text-[var(--gold)]">$200.02</span>
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
              <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                04 / HISTORIC LINE-BY-LINE RECORD
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
                Every movement. <br />
                Accounted for.
              </h2>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                A payment path is only part of the story. Follow each order through verification, a double-entry journal and an audit trail stored in MongoDB.
              </p>
              <div className="pt-2">
                <Link
                  href="/app/activity"
                  className="text-xs font-mono text-[var(--gold)] hover:text-[var(--gold-bright)] flex items-center gap-1.5 font-bold"
                >
                  <span>Explore activity and ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 05 & 06: Quotes & AI Agent Desk
         ========================================================================= */}
      <section className="py-16 sm:py-24 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Section 05: Quotes */}
            <div className="p-6 sm:p-8 rounded-3xl nexus-glass-card border border-[var(--border)] space-y-6 shadow-sm">
              <div className="space-y-2">
                <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                  05 / RATES WITH CONTEXT
                </span>
                <h3 className="text-2xl font-bold text-[var(--foreground)]">A quote, not a guess.</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs pt-4">
                <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-1">
                  <div className="font-bold text-[var(--gold)]">Fresh</div>
                  <p className="text-[11px] text-[var(--muted)] leading-snug">Provider rates with visible timestamp.</p>
                </div>
                <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-1">
                  <div className="font-bold text-stellar-cyan">Resilient</div>
                  <p className="text-[11px] text-[var(--muted)] leading-snug">Cached fallback is always labeled.</p>
                </div>
                <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-1">
                  <div className="font-bold text-xrpl-blue">Bounded</div>
                  <p className="text-[11px] text-[var(--muted)] leading-snug">Expiry & slippage locked before signing.</p>
                </div>
              </div>
            </div>

            {/* Section 06: AI Agent Desk */}
            <div className="p-6 sm:p-8 rounded-3xl nexus-glass-card border border-[var(--border)] space-y-6 shadow-sm">
              <div className="space-y-2">
                <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                  06 / INTELLIGENCE WITH BOUNDARIES
                </span>
                <h3 className="text-2xl font-bold text-[var(--foreground)]">
                  An extra pair of eyes. <br />
                  Not a hidden hand.
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                The AI Agent Desk surfaces operational proposals. You review the evidence and confirm the action. No autonomous movement of funds.
              </p>
              
              {/* Proposal Mock Widget */}
              <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--gold)]/40 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="flex items-center gap-1.5 text-[var(--gold)] font-bold">
                    <Bot className="w-3.5 h-3.5" /> AI Agent Desk
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30 text-[10px] font-bold">
                    AWAITING CONFIRMATION
                  </span>
                </div>
                <div className="font-bold text-[var(--foreground)]">Refresh the XRPL quote cache</div>
                <div className="text-[11px] text-[var(--muted)]">
                  Fallback rates are approaching the 60-second freshness threshold. Refresh rates without changing payment routing.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 07: Built to Connect (Provider Interface)
         ========================================================================= */}
      <section className="py-16 sm:py-24 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                07 / BUILT TO CONNECT
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
                One interface. <br />
                A provider-based engine.
              </h2>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                Chain-specific details stay behind each provider. Store, orders and ledger stay connected as the network grows.
              </p>
            </div>

            <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl nexus-glass-card border border-[var(--border)] font-mono text-xs space-y-3 shadow-xl overflow-hidden">
              <div className="text-[11px] text-[var(--muted)] uppercase tracking-wider font-semibold">ILLUSTRATIVE / CHECKOUT SESSION</div>
              <div className="p-4 rounded-xl bg-slate-900 text-emerald-400 border border-slate-800 whitespace-pre font-mono text-[11px] leading-relaxed overflow-x-auto">
{`POST /api/v1/checkout/sessions
{
  orderId: "#NR8K2P9X",
  network: "stellar-testnet",
  currency: "XLM",
  mode: "demo"
}`}
              </div>
              <div className="text-[11px] text-[var(--gold)] flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Uniform IChainProvider Contract: createInvoice(), verifyPayment()</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 08: FAQ Accordion
         ========================================================================= */}
      <section className="py-16 sm:py-24 border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-10">
          <div className="space-y-2">
            <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
              08 / A FEW QUICK CLARIFICATIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)] tracking-tight">
              Before you take the rails.
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl nexus-glass-surface border border-[var(--border)] overflow-hidden transition-all shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex justify-between items-center text-sm font-bold text-[var(--foreground)] hover:text-[var(--gold)] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[var(--muted)] transition-transform ${isOpen ? 'rotate-180 text-[var(--gold)]' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-[var(--muted)] leading-relaxed border-t border-[var(--border)] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 09: Bottom CTA Banner ("Take the better rails.")
         ========================================================================= */}
      <section className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="p-8 sm:p-14 rounded-3xl nexus-glass-card border border-[var(--border)] text-center space-y-6 relative overflow-hidden shadow-xl">
            <span className="text-xs font-mono text-[var(--gold)] uppercase tracking-widest block font-semibold">
              09 / YOUR NEXT MOVE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-[var(--foreground)] tracking-tight">
              Take the better rails.
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
              Explore the full journey. Real assets, real clarity.
            </p>
            <div className="pt-2">
              <Link
                href="/store"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--gold)] text-black font-extrabold text-sm hover:bg-[var(--gold-bright)] transition-all shadow-xl shadow-[var(--gold)]/25 hover:scale-105 active:scale-95"
              >
                <span>Launch App</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
