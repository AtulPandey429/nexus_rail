'use client';

import React, { useState } from 'react';
import { Cpu, Zap, Key, Image as ImageIcon, CheckCircle2, ChevronRight, ShieldAlert } from 'lucide-react';

export function PluginsShowcase() {
  const [apiKey, setApiKey] = useState('nr_live_8f91a24b9012c85e');
  const [copied, setCopied] = useState(false);
  const [falPrompt, setFalPrompt] = useState('Futuristic Web3 Hardware Node with Neon Emerald Lights');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genImage, setGenImage] = useState<string | null>(null);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateFalAsset = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setGenImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80');
      setIsGenerating(false);
    }, 1200);
  };

  return (
    <div className="w-full bg-nexus-card border border-gray-800 rounded-3xl p-6 space-y-6 shadow-2xl">
      <div className="border-b border-gray-800/80 pb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyber-purple" />
          <span>Phase 5 Architecture: Extension Plugins & Hardening</span>
        </h3>
        <p className="text-xs text-gray-400 font-mono">Hyperliquid Perps • fal.ai Asset Generator • Privy Passkeys • B2B API Keys</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* fal.ai Generative Asset Plugin Widget */}
        <div className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-center text-xs font-mono text-rail-emerald mb-2">
              <span className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> fal.ai Asset Generator Plugin</span>
              <span className="px-2 py-0.5 rounded bg-rail-emerald/10 text-[10px] border border-rail-emerald/30">ACTIVE</span>
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Generates on-demand product mockups and dynamic banner assets for Social Commerce showdowns.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={falPrompt}
                onChange={(e) => setFalPrompt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-nexus-dark border border-gray-700 text-xs text-white focus:outline-none focus:border-rail-emerald font-mono"
              />
              <button
                onClick={handleGenerateFalAsset}
                disabled={isGenerating}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-rail-emerald to-stellar-cyan text-nexus-dark font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {isGenerating ? <Zap className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>{isGenerating ? 'Generating Asset via fal.ai...' : 'Generate Product Asset'}</span>
              </button>
            </div>
          </div>

          {genImage && (
            <div className="pt-2">
              <img src={genImage} alt="Generated Asset" className="w-full h-36 object-cover rounded-xl border border-gray-700 shadow-md" />
            </div>
          )}
        </div>

        {/* Hyperliquid & B2B API Keys */}
        <div className="space-y-4">
          {/* Hyperliquid Perps Trader */}
          <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-stellar-cyan">
              <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4" /> Hyperliquid Perps Plugin</span>
              <span className="px-2 py-0.5 rounded bg-stellar-cyan/10 text-[10px] border border-stellar-cyan/30">TESTNET</span>
            </div>
            <div className="text-xs text-gray-300 flex justify-between items-center pt-1">
              <span>Hedge Vault Arbitrage: <strong className="text-white">12.4% APY</strong></span>
              <button className="px-3 py-1 rounded-lg bg-gray-800 text-xs text-white border border-gray-700 flex items-center gap-1 hover:bg-gray-700">
                Execute Hedge <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* B2B Reseller API Key Generator */}
          <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-3">
            <div className="flex justify-between items-center text-xs font-mono text-cyber-purple">
              <span className="flex items-center gap-1.5"><Key className="w-4 h-4" /> B2B Reseller API Keys</span>
              <span className="px-2 py-0.5 rounded bg-cyber-purple/10 text-[10px] border border-cyber-purple/30">OWASP HARDENED</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={apiKey}
                className="w-full px-3 py-2 rounded-xl bg-nexus-dark border border-gray-800 text-xs font-mono text-gray-300"
              />
              <button
                onClick={handleCopyKey}
                className="px-4 py-2 rounded-xl bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/30 text-xs font-bold transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy Key'}
              </button>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rail-emerald" /> Rate-limited at 100 req/min per key with OWASP Middleware
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
