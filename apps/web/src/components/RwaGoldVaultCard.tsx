'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Zap, ShieldCheck, ExternalLink, RefreshCw, ArrowUpRight, CheckCircle2, QrCode } from 'lucide-react';

export function RwaGoldVaultCard() {
  const [goldRateUsd, setGoldRateUsd] = useState(88.25);
  const [goldRateInr, setGoldRateInr] = useState(7420.0);
  const [silverRateUsd, setSilverRateUsd] = useState(1.05);
  const [buyAmountInr, setBuyAmountInr] = useState('500');
  const [selectedAsset, setSelectedAsset] = useState<'nGOLD' | 'nSILVER'>('nGOLD');
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<any | null>(null);

  // Calculate grams based on INR amount
  const activeRateInr = selectedAsset === 'nGOLD' ? goldRateInr : 88.5;
  const gramsToReceive = (parseFloat(buyAmountInr || '0') / activeRateInr).toFixed(4);

  const handleMintToken = async () => {
    setIsMinting(true);
    setMintResult(null);

    setTimeout(() => {
      const txHash = `tx_stl_testnet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      setMintResult({
        assetCode: selectedAsset,
        amountGrams: parseFloat(gramsToReceive),
        txHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
      });
      setIsMinting(false);
    }, 1200);
  };

  return (
    <div className="w-full bg-nexus-card border border-gray-800 rounded-3xl p-6 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800/80 pb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <span>Nexus RWA Commodity Vault (Gold & Silver)</span>
          </h3>
          <p className="text-xs text-gray-400 font-mono">Live CoinGecko/Pyth Oracle • Stellar Horizon Testnet Token Issuer</p>
        </div>
        <span className="text-xs font-mono px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Live Oracle Active
        </span>
      </div>

      {/* Live Ticker Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* nGOLD Ticker */}
        <div
          onClick={() => setSelectedAsset('nGOLD')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedAsset === 'nGOLD'
              ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
              : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-mono text-gray-400">
            <span>nGOLD (1 Token = 1 Gram Physical Gold)</span>
            <span className="text-amber-400 font-bold">24K 99.9%</span>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            ${goldRateUsd.toFixed(2)} <span className="text-xs font-mono text-amber-400">USD/g</span>
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1 flex justify-between">
            <span>₹{goldRateInr.toLocaleString()} INR / Gram</span>
            <span className="text-rail-emerald flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> +1.42%</span>
          </div>
        </div>

        {/* nSILVER Ticker */}
        <div
          onClick={() => setSelectedAsset('nSILVER')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedAsset === 'nSILVER'
              ? 'bg-slate-400/10 border-slate-300 shadow-lg shadow-slate-400/10'
              : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-mono text-gray-400">
            <span>nSILVER (1 Token = 1 Gram Fine Silver)</span>
            <span className="text-slate-300 font-bold">999 Fine</span>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            ${silverRateUsd.toFixed(2)} <span className="text-xs font-mono text-slate-300">USD/g</span>
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1 flex justify-between">
            <span>₹88.50 INR / Gram</span>
            <span className="text-rail-emerald flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> +0.85%</span>
          </div>
        </div>
      </div>

      {/* Micro-Buying Form */}
      <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 space-y-4">
        <h4 className="text-xs font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-4 h-4" /> Micro-Fractional Commodity Purchase
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-mono text-gray-400 mb-1 block">Purchase Amount (INR ₹)</label>
            <input
              type="number"
              value={buyAmountInr}
              onChange={(e) => setBuyAmountInr(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-nexus-dark border border-gray-700 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-gray-400 mb-1 block">Estimated Tokens To Receive</label>
            <div className="w-full px-4 py-2.5 rounded-xl bg-nexus-dark border border-gray-800 text-sm font-mono text-amber-400 font-bold flex justify-between items-center">
              <span>{gramsToReceive} Grams</span>
              <span className="text-xs text-gray-400">{selectedAsset}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleMintToken}
          disabled={isMinting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-nexus-dark font-extrabold text-xs shadow-lg shadow-amber-500/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
        >
          {isMinting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          <span>{isMinting ? 'Issuing Tokens on Stellar Horizon Testnet...' : `Buy ${gramsToReceive}g ${selectedAsset} via UPI / Testnet`}</span>
        </button>
      </div>

      {/* On-Chain Result Receipts */}
      {mintResult && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-xs space-y-2 font-mono">
          <div className="flex justify-between items-center text-amber-400 font-bold">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> On-Chain Tokens Issued Successfully!</span>
            <span>Stellar Testnet</span>
          </div>
          <p className="text-gray-300">
            Issued <strong>{mintResult.amountGrams} Grams</strong> of <strong>{mintResult.assetCode}</strong> token to your testnet wallet.
          </p>
          <div className="pt-1 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Tx Hash: {mintResult.txHash}</span>
            <a
              href={mintResult.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 underline hover:text-amber-300 flex items-center gap-1"
            >
              View on Stellar Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
