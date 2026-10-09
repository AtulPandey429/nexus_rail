'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

export default function RwaPerpsPage() {
  const [pair, setPair] = useState<'XAU/USD' | 'XAG/USD'>('XAU/USD');
  const [leverage, setLeverage] = useState(2);
  const [positionSize, setPositionSize] = useState('100');
  const [isOpening, setIsOpening] = useState(false);
  const [position, setPosition] = useState<any | null>(null);

  const spotPrice = pair === 'XAU/USD' ? 2740.50 : 32.50;
  const marginUsd = (parseFloat(positionSize || '0') / leverage).toFixed(2);
  const liquidationPrice = (spotPrice - (spotPrice * (0.8 / leverage))).toFixed(2);

  const handleOpenPerp = () => {
    setIsOpening(true);
    setTimeout(() => {
      setPosition({
        pair,
        leverage,
        entryPrice: spotPrice,
        sizeUsd: parseFloat(positionSize),
        marginUsd: parseFloat(marginUsd),
        liquidationPrice: parseFloat(liquidationPrice),
      });
      setIsOpening(false);
    }, 1000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="p-6 rounded-3xl bg-nexus-card border border-gray-800 space-y-6 shadow-2xl">
        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyber-purple" />
            <span>Ostium Gold & Silver Perps Trading (2x - 5x Leverage)</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Hedge your physical gold & silver token positions against market volatility</p>
        </div>

        {/* Pair & Leverage Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1 block">Trading Pair</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPair('XAU/USD')}
                className={`p-2.5 rounded-xl border text-xs font-bold ${
                  pair === 'XAU/USD' ? 'bg-amber-500/20 border-amber-400 text-amber-400' : 'bg-gray-900 border-gray-800 text-gray-400'
                }`}
              >
                XAU/USD (Gold)
              </button>
              <button
                onClick={() => setPair('XAG/USD')}
                className={`p-2.5 rounded-xl border text-xs font-bold ${
                  pair === 'XAG/USD' ? 'bg-slate-400/20 border-slate-300 text-slate-300' : 'bg-gray-900 border-gray-800 text-gray-400'
                }`}
              >
                XAG/USD (Silver)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-gray-400 mb-1 block">Leverage Multiplier ({leverage}x)</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[2, 3, 4, 5].map((lev) => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className={`p-2 rounded-xl border text-xs font-bold ${
                    leverage === lev ? 'bg-cyber-purple/20 border-cyber-purple text-cyber-purple' : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Position Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-gray-400 block text-[10px]">Index Price</span>
            <span className="font-bold text-white text-base">${spotPrice} USD</span>
          </div>
          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-gray-400 block text-[10px]">Required Margin</span>
            <span className="font-bold text-rail-emerald text-base">${marginUsd} USD</span>
          </div>
          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-gray-400 block text-[10px]">Est. Liquidation Price</span>
            <span className="font-bold text-red-400 text-base">${liquidationPrice} USD</span>
          </div>
        </div>

        {/* Position Input */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-gray-400">Position Size (USD $)</label>
          <input
            type="number"
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-nexus-dark border border-gray-700 text-sm font-mono text-white focus:outline-none focus:border-cyber-purple"
          />
        </div>

        <button
          onClick={handleOpenPerp}
          disabled={isOpening}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyber-purple to-stellar-cyan text-nexus-dark font-extrabold text-xs shadow-lg shadow-cyber-purple/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
        >
          {isOpening ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          <span>{isOpening ? 'Executing Perpetual Futures Order...' : `Open Long ${pair} Position (${leverage}x Leverage)`}</span>
        </button>

        {/* Position Active Box */}
        {position && (
          <div className="p-4 rounded-2xl bg-cyber-purple/10 border border-cyber-purple/40 text-xs space-y-2 font-mono">
            <div className="flex justify-between items-center text-cyber-purple font-bold">
              <span>Position Active • Ostium Protocol</span>
              <span className="px-2 py-0.5 rounded bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/20 text-[10px]">
                {position.leverage}x LONG
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-gray-300 text-[11px] pt-1">
              <div>Entry Price: <strong>${position.entryPrice}</strong></div>
              <div>Position Size: <strong>${position.sizeUsd}</strong></div>
              <div>Margin Locked: <strong>${position.marginUsd}</strong></div>
              <div>Liquidation: <strong>${position.liquidationPrice}</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
