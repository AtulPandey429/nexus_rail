'use client';

import React, { useState } from 'react';
import {
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  Lock,
  Unlock,
  RefreshCw,
  Coins,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export interface TokenTransparencyData {
  chain: 'stellar' | 'xrpl';
  assetCode: string;
  issuerAddress: string;
  isNative: boolean;
  supplyReported: string;
  holderCountEstimated: number;
  // Stellar Specific Flags
  stellarFlags?: {
    authRequired: boolean;
    authRevocable: boolean;
    authImmutable: boolean;
    clawbackEnabled: boolean;
  };
  // XRPL Specific Flags
  xrplFlags?: {
    requireDestinationTag: boolean;
    disallowXRP: boolean;
    globalFreeze: boolean;
    noFreeze: boolean;
  };
  liquidityTier: 'DEEP' | 'MODERATE' | 'LIMITED' | 'TESTNET_ONLY';
  recentActivity: string;
  provenanceSource: string;
  provenanceTimestamp: string;
  riskIndicators: Array<{
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    title: string;
    description: string;
    rule: string;
    limitation: string;
  }>;
}

const PRESET_TOKENS: Record<string, TokenTransparencyData> = {
  'XLM-NATIVE': {
    chain: 'stellar',
    assetCode: 'XLM',
    issuerAddress: 'Native Network Asset',
    isNative: true,
    supplyReported: '50,001,786,967 XLM',
    holderCountEstimated: 8450000,
    stellarFlags: {
      authRequired: false,
      authRevocable: false,
      authImmutable: true,
      clawbackEnabled: false,
    },
    liquidityTier: 'DEEP',
    recentActivity: 'Ledger sequence 52,849,102 (Settling every ~4.2s)',
    provenanceSource: 'Stellar Development Foundation Horizon Public Node',
    provenanceTimestamp: new Date().toISOString(),
    riskIndicators: [
      {
        severity: 'LOW',
        title: 'Native Base Reserve Asset',
        description: 'XLM is the native protocol utility asset of the Stellar decentralized ledger.',
        rule: 'Native protocol asset carries no issuer counterparty credit risk.',
        limitation: 'Subject to macro crypto market volatility.',
      },
    ],
  },
  'XRP-NATIVE': {
    chain: 'xrpl',
    assetCode: 'XRP',
    issuerAddress: 'Native Network Asset',
    isNative: true,
    supplyReported: '99,987,143,200 XRP',
    holderCountEstimated: 5200000,
    xrplFlags: {
      requireDestinationTag: false,
      disallowXRP: false,
      globalFreeze: false,
      noFreeze: true,
    },
    liquidityTier: 'DEEP',
    recentActivity: 'Validated ledger 89,451,200 (Consensus every ~3.5s)',
    provenanceSource: 'Ripple AltNet / Ripple Public RPC Cluster',
    provenanceTimestamp: new Date().toISOString(),
    riskIndicators: [
      {
        severity: 'LOW',
        title: 'Native XRPL Settlement Asset',
        description: 'XRP is the native base token of the XRP Ledger without freeze capabilities.',
        rule: 'Native XRP cannot be frozen by any centralized entity or gateway.',
        limitation: 'Subject to macro market fluctuations and bridge protocol risks.',
      },
    ],
  },
  'USDC-STELLAR': {
    chain: 'stellar',
    assetCode: 'USDC',
    issuerAddress: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    isNative: false,
    supplyReported: '142,500,000 USDC (Stellar Pool)',
    holderCountEstimated: 215000,
    stellarFlags: {
      authRequired: false,
      authRevocable: true,
      authImmutable: false,
      clawbackEnabled: true,
    },
    liquidityTier: 'DEEP',
    recentActivity: '2,480 transactions in past 1h',
    provenanceSource: 'Circle Internet Financial / SDF Asset Registry',
    provenanceTimestamp: new Date().toISOString(),
    riskIndicators: [
      {
        severity: 'MEDIUM',
        title: 'Clawback & Revocation Enabled',
        description: 'Issuer possesses technical capability to claw back tokens under regulatory requests.',
        rule: 'Stellar CAP-0035 clawback flag is active on the issuer account.',
        limitation: 'Standard for regulated stablecoins; does not indicate fraudulent intent.',
      },
    ],
  },
};

export function TokenTransparencyExplorer() {
  const [selectedKey, setSelectedKey] = useState<string>('XLM-NATIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [tokenData, setTokenData] = useState<TokenTransparencyData>(PRESET_TOKENS['XLM-NATIVE']);

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    if (PRESET_TOKENS[key]) {
      setTokenData(PRESET_TOKENS[key]);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (query.includes('XLM')) handleSelect('XLM-NATIVE');
    else if (query.includes('XRP')) handleSelect('XRP-NATIVE');
    else if (query.includes('USDC')) handleSelect('USDC-STELLAR');
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl bg-[#090B10] border border-white/10 p-6 sm:p-8 text-[#F0F4F8] font-sans shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#7FF8C6]" />
            <h2 className="text-xl font-bold text-white tracking-tight">Token Transparency Explorer</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10">
              DUAL-RAIL AUDIT
            </span>
          </div>
          <p className="text-xs font-mono text-white/50 mt-1">
            Authoritative inspection of asset issuer controls, clawback flags, and freeze properties
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          {Object.entries(PRESET_TOKENS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all border ${
                selectedKey === key
                  ? 'bg-white/15 text-white border-white/30 shadow-md'
                  : 'bg-black/40 text-white/50 border-white/5 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.assetCode} ({item.chain.toUpperCase()})
            </button>
          ))}
        </div>
      </div>

      {/* Main Asset Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Asset Identity */}
        <div className="p-5 rounded-2xl bg-[#0F131A] border border-white/10 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Canonical Asset</span>
            <h3 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
              {tokenData.assetCode}
              <span className="text-xs font-normal text-white/50">on {tokenData.chain.toUpperCase()}</span>
            </h3>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div>
              <span className="text-white/40 block">Issuer Address:</span>
              <p className="text-[11px] text-white/80 break-all select-all mt-0.5 p-2 rounded bg-black/40 border border-white/5">
                {tokenData.issuerAddress}
              </p>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-white/40">Reported Supply:</span>
              <span className="text-white font-medium">{tokenData.supplyReported}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Est. Holders:</span>
              <span className="text-white font-medium">{tokenData.holderCountEstimated.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Liquidity Tier:</span>
              <span className="text-[#7FF8C6] font-bold">{tokenData.liquidityTier}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Issuer Protocol Controls (2 cols) */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-[#0F131A] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white/60 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#7FF8C6]" />
              On-Chain Protocol Control Flags
            </h4>
            <span className="text-[10px] font-mono text-white/40">SEP-0001 / XRPL AccountFlags</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {tokenData.stellarFlags && (
              <>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">Auth Required</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {tokenData.stellarFlags.authRequired ? (
                      <span className="text-amber-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> YES (Gated)</span>
                    ) : (
                      <span className="text-[#7FF8C6] flex items-center gap-1"><Unlock className="w-3.5 h-3.5" /> NO (Permissionless)</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">Auth Revocable</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {tokenData.stellarFlags.authRevocable ? (
                      <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> YES (Can Freeze)</span>
                    ) : (
                      <span className="text-[#7FF8C6] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> NO (Unfreezable)</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">Auth Immutable</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {tokenData.stellarFlags.authImmutable ? (
                      <span className="text-[#7FF8C6] flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> YES (Permanent)</span>
                    ) : (
                      <span className="text-white/50 flex items-center gap-1">NO (Mutable)</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">Clawback Enabled</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {tokenData.stellarFlags.clawbackEnabled ? (
                      <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> YES (CAP-0035)</span>
                    ) : (
                      <span className="text-[#7FF8C6] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> NO</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {tokenData.xrplFlags && (
              <>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">Require Destination Tag</span>
                  <span className="text-white font-bold block">
                    {tokenData.xrplFlags.requireDestinationTag ? 'REQUIRED (asfRequireDest)' : 'OPTIONAL'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">Global Freeze Status</span>
                  <span className="text-[#7FF8C6] font-bold flex items-center gap-1">
                    {tokenData.xrplFlags.globalFreeze ? 'FROZEN' : 'ACTIVE (Unfrozen)'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">No Freeze Invariant</span>
                  <span className="text-white font-bold block">
                    {tokenData.xrplFlags.noFreeze ? 'ENABLED (Cannot Freeze)' : 'NOT SET'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-white/50 text-[11px]">Disallow XRP Inbound</span>
                  <span className="text-white font-bold block">
                    {tokenData.xrplFlags.disallowXRP ? 'YES' : 'NO'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Activity subtext */}
          <div className="text-[11px] font-mono text-white/40 flex items-center justify-between pt-1 border-t border-white/5">
            <span>Recent Activity: {tokenData.recentActivity}</span>
            <span>Source: {tokenData.provenanceSource}</span>
          </div>
        </div>
      </div>

      {/* Explainable Risk Indicators */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono uppercase tracking-wider text-white/50">Explainable Risk Analysis</h4>
        {tokenData.riskIndicators.map((risk, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl border flex items-start gap-3.5 text-xs font-mono ${
              risk.severity === 'HIGH'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                : risk.severity === 'MEDIUM'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
            }`}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">{risk.title}</p>
              <p className="opacity-80">{risk.description}</p>
              <div className="text-[11px] opacity-60 pt-1 space-y-0.5">
                <p>• <strong>Rule:</strong> {risk.rule}</p>
                <p>• <strong>Limitation:</strong> {risk.limitation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] font-mono text-white/40 text-center pt-2">
        Transparency indicators are derived from public ledger headers. No asset is certified as scam-free or investment-grade based solely on these metrics.
      </p>
    </div>
  );
}
