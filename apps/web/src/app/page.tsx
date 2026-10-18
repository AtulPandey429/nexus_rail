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
  ChevronDown
} from 'lucide-react';
import { addSkuToCart } from '@/lib/shop';

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
      a: 'No. NexusRail is a testnet demo. Assets have no monetary value, and products are illustrative.',
    },
    {
      q: 'Which networks can I use?',
      a: 'Stellar testnet (XLM) and XRPL altnet testnet (XRP) are currently live. EVM and Solana testnets are on the roadmap.',
    },
    {
      q: 'Do I need a wallet to sign in?',
      a: 'No. Start with email or explore the demo anonymously. Connect a compatible testnet wallet (Freighter, Xaman) when you want to authorize a payment.',
    },
  ];

  return (
    <main className="min-h-screen bg-nexus-dark text-white selection:bg-rail-emerald/30">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-nexus-card border border-rail-emerald/40 text-rail-emerald text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          HERO SECTION: Commerce, on better rails.
         ========================================================================= */}
      <section className="relative overflow-hidden border-b border-nexus-border pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-card border border-nexus-border text-[11px] font-mono text-gray-400 tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-rail-emerald animate-pulse" />
                <span>Commerce without the chain friction</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08]">
                  Commerce, on <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400">
                    better rails.
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-gray-400 max-w-xl font-normal leading-relaxed">
                  One storefront. Multiple payment rails. A clear record of every move. Meet a more connected way to shop with crypto.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/store"
                  className="px-6 py-3.5 rounded-xl bg-rail-emerald text-nexus-dark font-extrabold text-sm hover:bg-rail-mint transition-all shadow-lg shadow-rail-emerald/20 flex items-center gap-2 group"
                >
                  <span>Explore the demo store</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#how-it-works"
                  className="px-6 py-3.5 rounded-xl bg-nexus-card hover:bg-nexus-card-subtle border border-nexus-border text-gray-300 hover:text-white font-semibold text-sm transition-all"
                >
                  See how it works
                </a>
              </div>

              {/* Built on Testnet Badge */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-mono text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rail-emerald" />
                  <span className="text-gray-400 font-bold uppercase tracking-wider">
                    Built on Testnet. Designed for what's next.
                  </span>
                </div>
              </div>

              {/* Network Ticker Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-mono">
                <div className="px-3 py-1 rounded-md bg-nexus-card border border-nexus-border text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-stellar-cyan" />
                  <span>Stellar</span>
                  <span className="text-stellar-cyan font-bold">TESTNET LIVE</span>
                </div>
                <div className="px-3 py-1 rounded-md bg-nexus-card border border-nexus-border text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-xrpl-blue" />
                  <span>XRPL</span>
                  <span className="text-xrpl-blue font-bold">TESTNET LIVE</span>
                </div>
                <div className="px-3 py-1 rounded-md bg-nexus-card/50 border border-nexus-border/60 text-gray-500 flex items-center gap-2">
                  <span>EVM</span>
                  <span className="text-gray-500">SOON</span>
                </div>
                <div className="px-3 py-1 rounded-md bg-nexus-card/50 border border-nexus-border/60 text-gray-500 flex items-center gap-2">
                  <span>Solana</span>
                  <span className="text-gray-500">SOON</span>
                </div>
              </div>
            </div>

            {/* Right Visual: Interactive Rail Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl p-7 bg-nexus-card border border-nexus-border shadow-2xl overflow-hidden figma-grid">
                {/* Node connection visual */}
                <div className="flex justify-between items-center text-xs font-mono text-gray-400 border-b border-nexus-border/80 pb-4">
                  <span className="flex items-center gap-1.5 text-stellar-cyan">
                    <Rocket className="w-3.5 h-3.5" /> Stellar
                  </span>
                  <span className="px-2 py-0.5 rounded bg-nexus-border text-[10px] text-gray-300 font-bold">
                    XLM / XRP
                  </span>
                  <span className="flex items-center gap-1.5 text-xrpl-blue">
                    <Zap className="w-3.5 h-3.5" /> XRPL
                  </span>
                </div>

                {/* Center Routing graphic */}
                <div className="my-10 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-rail-emerald/10 border border-rail-emerald/40 flex items-center justify-center shadow-xl shadow-rail-emerald/10">
                    <div className="w-8 h-8 rounded-xl bg-rail-emerald flex items-center justify-center text-nexus-dark font-black text-sm">
                      NR
                    </div>
                  </div>
                  <div className="text-center font-mono space-y-1">
                    <div className="text-xs text-gray-400 uppercase tracking-widest">Multi-Rail Routing Engine</div>
                    <div className="text-[11px] text-rail-emerald flex items-center justify-center gap-1">
                      <span>STELLAR</span> &rarr; <span>LEDGER</span> &rarr; <span>RECEIPT</span>
                    </div>
                  </div>
                </div>

                {/* Floating Order Badge */}
                <div className="p-4 rounded-xl bg-nexus-dark/90 border border-nexus-border flex items-center justify-between font-mono text-xs shadow-lg">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Order ID</span>
                    <span className="font-bold text-white">NR-1048</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 uppercase block">Total Settled</span>
                    <span className="font-extrabold text-rail-emerald text-sm">$200.02 USD</span>
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
      <section className="py-20 border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                01 / THE DEMO STOREFRONT
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Good objects. Better checkout.
              </h2>
            </div>
            <Link
              href="/store"
              className="text-xs font-mono text-rail-emerald hover:text-rail-mint flex items-center gap-1.5 transition-colors group"
            >
              <span>Shop all products</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Product 1 */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border hover:border-nexus-border-focus transition-all flex flex-col justify-between group space-y-6">
              <div className="space-y-3">
                <div className="w-full h-44 rounded-xl bg-nexus-dark/70 border border-nexus-border/60 flex items-center justify-center text-gray-600 font-mono text-xs">
                  <div className="text-center space-y-1">
                    <ShieldCheck className="w-8 h-8 text-rail-emerald/60 mx-auto" />
                    <span className="block text-[11px] text-gray-400">Offline Cold Signer</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-white text-base">Rail One</h3>
                    <span className="font-mono text-sm font-bold text-white">$129.00</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Self-custody, beautifully offline.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickAdd('HARDWARE-WALLET-01')}
                disabled={addingSku === 'HARDWARE-WALLET-01'}
                className="w-full py-2.5 rounded-lg bg-nexus-card-subtle hover:bg-nexus-border border border-nexus-border text-xs font-semibold text-gray-200 transition-colors"
              >
                {addingSku === 'HARDWARE-WALLET-01' ? 'Adding…' : 'Add to bag'}
              </button>
            </div>

            {/* Product 2 */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border hover:border-nexus-border-focus transition-all flex flex-col justify-between group space-y-6">
              <div className="space-y-3">
                <div className="w-full h-44 rounded-xl bg-nexus-dark/70 border border-nexus-border/60 flex items-center justify-center text-gray-600 font-mono text-xs">
                  <div className="text-center space-y-1">
                    <Layers className="w-8 h-8 text-stellar-cyan/60 mx-auto" />
                    <span className="block text-[11px] text-gray-400">Precision Work Surface</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-white text-base">Relay desk mat</h3>
                    <span className="font-mono text-sm font-bold text-white">$39.00</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">A grounded space for your next move.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickAdd('DESK-MAT-01')}
                disabled={addingSku === 'DESK-MAT-01'}
                className="w-full py-2.5 rounded-lg bg-nexus-card-subtle hover:bg-nexus-border border border-nexus-border text-xs font-semibold text-gray-200 transition-colors"
              >
                {addingSku === 'DESK-MAT-01' ? 'Adding…' : 'Add to bag'}
              </button>
            </div>

            {/* Product 3 */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border hover:border-nexus-border-focus transition-all flex flex-col justify-between group space-y-6">
              <div className="space-y-3">
                <div className="w-full h-44 rounded-xl bg-nexus-dark/70 border border-nexus-border/60 flex items-center justify-center text-gray-600 font-mono text-xs">
                  <div className="text-center space-y-1">
                    <Activity className="w-8 h-8 text-cyber-purple/60 mx-auto" />
                    <span className="block text-[11px] text-gray-400">Heavyweight Cotton</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-white text-base">Nexus tee</h3>
                    <span className="font-mono text-sm font-bold text-white">$32.00</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">A uniform for the onchain everyday.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickAdd('NEXUS-TEE-01')}
                disabled={addingSku === 'NEXUS-TEE-01'}
                className="w-full py-2.5 rounded-lg bg-nexus-card-subtle hover:bg-nexus-border border border-nexus-border text-xs font-semibold text-gray-200 transition-colors"
              >
                {addingSku === 'NEXUS-TEE-01' ? 'Adding…' : 'Add to bag'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02: Less Friction ("From discovery to receipt. Without the detours.")
         ========================================================================= */}
      <section id="how-it-works" className="py-20 border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              02 / LESS FRICTION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              From discovery to receipt. <br className="hidden sm:inline" />
              Without the detours.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-7 rounded-2xl bg-nexus-card border border-nexus-border space-y-3">
              <span className="text-xs font-mono font-bold text-rail-emerald block">01</span>
              <h3 className="text-base font-bold text-white">Make yourself at home</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Connect a wallet or sign in with an account. Browse a curated demo catalog with real-time testnet inventory.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-nexus-card border border-nexus-border space-y-3">
              <span className="text-xs font-mono font-bold text-stellar-cyan block">02</span>
              <h3 className="text-base font-bold text-white">Choose your rail</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                See available networks, fresh quotes and network fees side by side before you approve anything.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-nexus-card border border-nexus-border space-y-3">
              <span className="text-xs font-mono font-bold text-xrpl-blue block">03</span>
              <h3 className="text-base font-bold text-white">Leave with clarity</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Track your order and open a receipt backed by double-entry ledger entries and verifiable on-chain hashes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03 & 04: Payment Your Way & Ledger Record
         ========================================================================= */}
      <section className="py-20 border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          {/* Section 03: Multi-Rail Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                03 / PAYMENT, YOUR WAY
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                One checkout. <br />
                More ways forward.
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Stellar or XRPL, side by side. Compare the network, asset and fee before taking one deliberate checkout step.
              </p>
              <div className="pt-2">
                <Link
                  href="/store"
                  className="text-xs font-mono text-rail-emerald hover:text-rail-mint flex items-center gap-1.5 font-bold"
                >
                  <span>Try a testnet checkout</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Interactive Rail Preview Card */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-3 shadow-xl">
              <div className="text-xs font-mono text-gray-400 uppercase mb-2">Choose a payment rail</div>
              
              <div className="p-4 rounded-xl bg-nexus-dark/90 border border-stellar-cyan/40 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 text-stellar-cyan" />
                    <span>Stellar (XLM)</span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">Horizon Testnet • Instant memo check</div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-white font-bold">~84.92 XLM</div>
                  <span className="text-[10px] text-stellar-cyan">TESTNET</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-nexus-dark/90 border border-xrpl-blue/40 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-xrpl-blue" />
                    <span>XRPL (XRP)</span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">Altnet WebSocket • 32-bit tag</div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-white font-bold">~84.95 XRP</div>
                  <span className="text-[10px] text-xrpl-blue">TESTNET</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-nexus-dark/40 border border-nexus-border/50 flex justify-between items-center text-xs text-gray-500">
                <div>
                  <div className="font-semibold text-gray-400">EVM / Solana</div>
                  <div className="text-[11px] text-gray-600 font-mono">Coming soon to the provider registry</div>
                </div>
                <span className="text-[10px] font-mono text-gray-600 uppercase">Unavailable</span>
              </div>
            </div>
          </div>

          {/* Section 04: Double-Entry Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center pt-8 border-t border-nexus-border/60">
            {/* Journal Preview Card */}
            <div className="lg:col-span-6 order-2 lg:order-1 p-6 rounded-2xl bg-nexus-card border border-nexus-border font-mono text-xs space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-nexus-border pb-3">
                <span className="font-bold text-white">JOURNAL / NR-1048</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/30 font-bold">
                  BALANCED
                </span>
              </div>
              <div className="space-y-2 text-gray-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Customer clearing</span>
                  <span>DEBIT <strong className="text-white">$200.00</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Merchant payable</span>
                  <span>CREDIT <strong className="text-white">$200.00</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Network expense</span>
                  <span>DEBIT <strong className="text-white">$0.02</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Network clearing</span>
                  <span>CREDIT <strong className="text-white">$0.02</strong></span>
                </div>
              </div>
              <div className="pt-3 border-t border-nexus-border flex justify-between text-xs font-bold text-white">
                <span>Debits = Credits</span>
                <span className="text-rail-emerald">$200.02</span>
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                04 / HISTORIC LINE-BY-LINE RECORD
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Every movement. <br />
                Accounted for.
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                A payment path is only part of the story. Follow each order through verification, a double-entry journal and an audit trail stored in MongoDB.
              </p>
              <div className="pt-2">
                <Link
                  href="/app/activity"
                  className="text-xs font-mono text-rail-emerald hover:text-rail-mint flex items-center gap-1.5 font-bold"
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
      <section className="py-20 border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Section 05: Quotes */}
            <div className="p-8 rounded-3xl bg-nexus-card border border-nexus-border space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                  05 / RATES WITH CONTEXT
                </span>
                <h3 className="text-2xl font-bold text-white">A quote, not a guess.</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 font-mono text-xs pt-4">
                <div className="p-3.5 rounded-xl bg-nexus-dark border border-nexus-border space-y-1">
                  <div className="font-bold text-rail-emerald">Fresh</div>
                  <p className="text-[11px] text-gray-400 leading-snug">Provider rates with visible timestamp.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-nexus-dark border border-nexus-border space-y-1">
                  <div className="font-bold text-stellar-cyan">Resilient</div>
                  <p className="text-[11px] text-gray-400 leading-snug">Cached fallback is always labeled.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-nexus-dark border border-nexus-border space-y-1">
                  <div className="font-bold text-xrpl-blue">Bounded</div>
                  <p className="text-[11px] text-gray-400 leading-snug">Expiry & slippage locked before signing.</p>
                </div>
              </div>
            </div>

            {/* Section 06: AI Agent Desk */}
            <div className="p-8 rounded-3xl bg-nexus-card border border-nexus-border space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                  06 / INTELLIGENCE WITH BOUNDARIES
                </span>
                <h3 className="text-2xl font-bold text-white">
                  An extra pair of eyes. <br />
                  Not a hidden hand.
                </h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                The AI Agent Desk surfaces operational proposals. You review the evidence and confirm the action. No autonomous movement of funds.
              </p>
              
              {/* Proposal Mock Widget */}
              <div className="p-4 rounded-xl bg-nexus-dark border border-cyber-purple/40 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="flex items-center gap-1.5 text-cyber-purple font-bold">
                    <Bot className="w-3.5 h-3.5" /> AI Agent Desk
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyber-purple/10 text-cyber-purple border border-cyber-purple/30 text-[10px]">
                    AWAITING CONFIRMATION
                  </span>
                </div>
                <div className="font-bold text-white">Refresh the XRPL quote cache</div>
                <div className="text-[11px] text-gray-400">
                  Fallback rates are approaching the 60-second freshness threshold. Refresh rates without changing payment routing.
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-nexus-border text-[10px] text-gray-500">
                  <span>Scope: Rates only • No funds</span>
                  <Link href="/admin" className="text-cyber-purple font-bold hover:underline">
                    Review proposal &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 07: Built to Connect (Provider Interface)
         ========================================================================= */}
      <section className="py-20 border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                07 / BUILT TO CONNECT
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                One interface. <br />
                A provider-based engine.
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Chain-specific details stay behind each provider. Store, orders and ledger stay connected as the network grows.
              </p>
            </div>

            <div className="lg:col-span-6 p-6 rounded-2xl bg-nexus-card border border-nexus-border font-mono text-xs space-y-3 shadow-xl">
              <div className="text-[11px] text-gray-400 uppercase tracking-wider">ILLUSTRATIVE / CHECKOUT SESSION</div>
              <div className="p-4 rounded-xl bg-nexus-dark border border-nexus-border text-gray-300 whitespace-pre font-mono text-[11px] leading-relaxed overflow-x-auto">
{`POST /api/v1/checkout/sessions
{
  orderId: "NR-1048",
  network: "stellar-testnet",
  currency: "XLM",
  mode: "demo"
}`}
              </div>
              <div className="text-[11px] text-rail-emerald flex items-center gap-1.5 font-bold">
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
      <section className="py-20 border-b border-nexus-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="space-y-2">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              08 / A FEW QUICK CLARIFICATIONS
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Before you take the rails.
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl bg-nexus-card border border-nexus-border overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex justify-between items-center text-sm font-bold text-white hover:text-rail-emerald transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-rail-emerald' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-gray-400 leading-relaxed border-t border-nexus-border/50 pt-3">
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
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-nexus-card to-nexus-dark border border-nexus-border text-center space-y-6 relative overflow-hidden">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">
              09 / YOUR NEXT MOVE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Take the better rails.
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Explore the full journey. Real assets, real clarity.
            </p>
            <div className="pt-2">
              <Link
                href="/store"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-rail-emerald text-nexus-dark font-extrabold text-sm hover:bg-rail-mint transition-all shadow-xl shadow-rail-emerald/20"
              >
                <span>Launch the demo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
