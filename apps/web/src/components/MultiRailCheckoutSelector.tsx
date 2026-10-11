'use client';

import React, { useState } from 'react';
import { CreditCard, Wallet, Zap, Rocket } from 'lucide-react';

export type PaymentRailChoice = 'STRIPE' | 'WALLET' | 'XRPL' | 'STELLAR';

interface MultiRailCheckoutProps {
  priceCents: number;
  productTitle: string;
  onSelectRail?: (rail: PaymentRailChoice) => void;
}

export function MultiRailCheckoutSelector({
  priceCents,
  productTitle,
  onSelectRail,
}: MultiRailCheckoutProps) {
  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('STRIPE');

  const usdPrice = (priceCents / 100).toFixed(2);
  const xrpEstimate = ((priceCents / 100) * 2.15).toFixed(2);
  const xlmEstimate = ((priceCents / 100) * 4.8).toFixed(2);

  const handleSelect = (rail: PaymentRailChoice) => {
    setSelectedRail(rail);
    onSelectRail?.(rail);
  };

  return (
    <div className="w-full max-w-lg p-6 rounded-2xl bg-nexus-card border border-gray-800 space-y-6 shadow-2xl">
      <div className="border-b border-gray-800 pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-rail-emerald">Multi-Rail Payment Engine</span>
        <h2 className="text-xl font-bold text-white mt-1">{productTitle}</h2>
        <div className="text-2xl font-black text-white mt-2">
          ${usdPrice} <span className="text-xs text-gray-400 font-normal">USD</span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Select Payment Rail</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSelect('STRIPE')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'STRIPE'
                ? 'bg-rail-emerald/10 border-rail-emerald text-white shadow-lg shadow-rail-emerald/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <CreditCard className="w-5 h-5 text-rail-emerald" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Stripe Card</div>
              <div className="text-xs text-gray-400">${usdPrice} Fiat</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('WALLET')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'WALLET'
                ? 'bg-cyber-purple/10 border-cyber-purple text-white shadow-lg shadow-cyber-purple/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <Wallet className="w-5 h-5 text-cyber-purple" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Internal Wallet</div>
              <div className="text-xs text-gray-400">$0.00 Fee</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('XRPL')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'XRPL'
                ? 'bg-xrpl-blue/10 border-xrpl-blue text-white shadow-lg shadow-xrpl-blue/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <Zap className="w-5 h-5 text-xrpl-blue" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">XRPL (XRP)</div>
              <div className="text-xs text-gray-400">≈ {xrpEstimate} XRP</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('STELLAR')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'STELLAR'
                ? 'bg-stellar-cyan/10 border-stellar-cyan text-white shadow-lg shadow-stellar-cyan/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <Rocket className="w-5 h-5 text-stellar-cyan" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Stellar (XLM)</div>
              <div className="text-xs text-gray-400">≈ {xlmEstimate} XLM</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
