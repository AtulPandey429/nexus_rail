'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Wallet, Zap, Rocket, ShieldCheck, ArrowRight, ShoppingBag } from 'lucide-react';
import { EndToEndFlowMonitor } from '@/components/EndToEndFlowMonitor';

export type PaymentRailChoice = 'STRIPE' | 'WALLET' | 'XRPL' | 'STELLAR';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get('orderId') || `ord_${Date.now()}`;
  const amountCents = parseInt(searchParams.get('amountCents') || '4200', 10);
  const title = searchParams.get('title') || 'Nexus A5 Hardcover Notebook + Pen Set';

  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('STRIPE');
  const usdPrice = (amountCents / 100).toFixed(2);
  const xrpEstimate = ((amountCents / 100) * 2.15).toFixed(2);
  const xlmEstimate = ((amountCents / 100) * 4.8).toFixed(2);

  const handleProceedToPayment = () => {
    router.push(`/app/payment?orderId=${encodeURIComponent(orderId)}&rail=${selectedRail}&amountCents=${amountCents}&title=${encodeURIComponent(title)}`);
  };

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/app/cart" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Cart
        </Link>

        {/* Pipeline Monitor */}
        <EndToEndFlowMonitor currentStage={2} orderId={orderId} selectedRail={selectedRail} />

        {/* Page Header */}
        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-rail-emerald" />
            <span>Multi-Rail Checkout Engine</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Select your preferred payment rail to initiate atomic settlement</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rail Selection Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">Select Payment Rail</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stripe */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('STRIPE')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'STRIPE'
                      ? 'bg-rail-emerald/15 border-rail-emerald text-white shadow-xl shadow-rail-emerald/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <CreditCard className="w-6 h-6 text-rail-emerald" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rail-emerald/20 text-rail-emerald font-bold">
                      FIAT USD
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Stripe Card</h3>
                    <p className="text-xs text-gray-400 mt-1">Visa, Mastercard, AMEX • Instant Webhook Confirmation</p>
                  </div>
                </button>

                {/* XRPL */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('XRPL')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'XRPL'
                      ? 'bg-xrpl-blue/15 border-xrpl-blue text-white shadow-xl shadow-xrpl-blue/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <Zap className="w-6 h-6 text-xrpl-blue" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-xrpl-blue/20 text-xrpl-blue font-bold">
                      XRPL TESTNET
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">XRPL (XRP)</h3>
                    <p className="text-xs text-gray-400 mt-1">≈ {xrpEstimate} XRP • Destination Tag Verification</p>
                  </div>
                </button>

                {/* Stellar */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('STELLAR')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'STELLAR'
                      ? 'bg-stellar-cyan/15 border-stellar-cyan text-white shadow-xl shadow-stellar-cyan/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <Rocket className="w-6 h-6 text-stellar-cyan" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stellar-cyan/20 text-stellar-cyan font-bold">
                      STELLAR HORIZON
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Stellar (XLM)</h3>
                    <p className="text-xs text-gray-400 mt-1">≈ {xlmEstimate} XLM • Memo Text Settlement</p>
                  </div>
                </button>

                {/* Internal Wallet */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('WALLET')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'WALLET'
                      ? 'bg-cyber-purple/15 border-cyber-purple text-white shadow-xl shadow-cyber-purple/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <Wallet className="w-6 h-6 text-cyber-purple" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple font-bold">
                      INTERNAL BAL
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">USD Wallet</h3>
                    <p className="text-xs text-gray-400 mt-1">Zero Gas Fee • Immediate On-Chain Debits</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Order Summary & Proceed CTA */}
          <div className="p-6 rounded-2xl bg-gray-900/90 border border-gray-800 space-y-6 h-fit shadow-2xl">
            <h3 className="text-base font-bold border-b border-gray-800 pb-3 flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs font-mono text-gray-400">{orderId}</span>
            </h3>

            <div className="space-y-3 text-xs font-mono text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Product</span>
                <span className="text-white font-bold text-right truncate max-w-[160px]">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Selected Rail</span>
                <span className="text-rail-emerald font-bold">{selectedRail}</span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-3 text-sm font-bold text-white">
                <span>Total Amount</span>
                <span className="text-rail-emerald">${usdPrice} USD</span>
              </div>
            </div>

            <button
              onClick={handleProceedToPayment}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-rail-emerald via-emerald-500 to-teal-400 text-nexus-dark font-extrabold text-sm shadow-xl shadow-rail-emerald/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Proceed to Payment Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 justify-center font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-rail-emerald" /> 256-bit SSL Encrypted • Webhook Audited
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-nexus-dark text-white p-12 font-mono">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
