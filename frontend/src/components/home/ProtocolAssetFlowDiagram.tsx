'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  Flame,
  Layers,
  Pause,
  Play,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { fetchLiveSorobanSwapPool } from '@/lib/soroban';

type FlowMode = 'all' | 'checkout' | 'swap' | 'bridge' | 'supply';

interface FlowTab {
  id: FlowMode;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  steps: Array<{ num: string; title: string; detail: string; accent: string }>;
}

const FLOW_TABS: FlowTab[] = [
  {
    id: 'all',
    label: 'End-to-End Flow',
    shortLabel: 'All Flows',
    icon: Layers,
    summary:
      'Every user action routes through audited Stellar Soroban smart contracts — separating token balances ($NXL SAC), checkout & mint/burn (NexusVault), and AMM swaps & bridge escrow (NexusSwap).',
    steps: [
      {
        num: '01',
        title: 'User Signs in Wallet',
        detail: 'Freighter or GemWallet signs a single Soroban XDR with strict amount & slippage guards.',
        accent: 'text-sky-300',
      },
      {
        num: '02',
        title: 'Smart Contract Routing',
        detail: 'Checkout & Mint/Burn hit NexusVault; XLM↔NXL swaps & XRPL locks hit NexusSwap.',
        accent: 'text-[#E6C666]',
      },
      {
        num: '03',
        title: '$NXL SAC Token Ledger',
        detail: 'Official Stellar Asset Contract moves balances, enforces 2M hard cap mints & permanent burns.',
        accent: 'text-emerald-300',
      },
      {
        num: '04',
        title: 'Atomic Finality & Payout',
        detail: '50/50 fees split on-chain, swapped tokens return to user, or XRPL settles cross-chain XRP.',
        accent: 'text-violet-300',
      },
    ],
  },
  {
    id: 'checkout',
    label: 'Checkout (50/50 Split)',
    shortLabel: 'Checkout',
    icon: ShoppingBag,
    summary:
      'One Freighter signature runs NexusVault::settle_order — atomically routing 99.5% to Owner Treasury, 0.5% to the $NXL Buyback Reserve, locking order_ref against replays, and awarding 2% $NXL cashback.',
    steps: [
      {
        num: '01',
        title: 'User Pays XLM / $NXL',
        detail: 'Frontend requests unsigned XDR from /checkout/soroban/prepare and signs in Freighter.',
        accent: 'text-sky-300',
      },
      {
        num: '02',
        title: 'NexusVault::settle_order',
        detail: 'Verifies pause flag, checks order_ref has never been settled, and computes checked 1% fee.',
        accent: 'text-[#E6C666]',
      },
      {
        num: '03',
        title: 'Atomic 50/50 Split',
        detail: 'Principal + 50% fee goes to Owner Treasury; 50% fee routes to $NXL Buyback Reserve.',
        accent: 'text-emerald-300',
      },
      {
        num: '04',
        title: '2% $NXL Cashback',
        detail: 'Order marks PAID on-chain & awards idempotent 2% $NXL loyalty cashback to user.',
        accent: 'text-amber-300',
      },
    ],
  },
  {
    id: 'swap',
    label: 'AMM Swap (XLM ↔ NXL)',
    shortLabel: 'AMM Swap',
    icon: Repeat,
    summary:
      'On-chain constant-product pool (x · y = k) holds live XLM & $NXL liquidity. Every swap enforces min_amount_out slippage protection + deadline and splits the 0.50% fee 50/50 between Owner and Pool.',
    steps: [
      {
        num: '01',
        title: 'Live On-Chain Quote',
        detail: 'NexusSwap::quote_swap simulates exact output and sets your min_amount_out slippage floor.',
        accent: 'text-sky-300',
      },
      {
        num: '02',
        title: 'NexusSwap::swap_exact_in',
        detail: 'User XLM/NXL enters the pool; contract validates deadline timestamp & k invariant.',
        accent: 'text-[#E6C666]',
      },
      {
        num: '03',
        title: '0.50% Fee Split',
        detail: '0.25% routes instantly to Owner Treasury; 0.25% stays in pool to deepen liquidity.',
        accent: 'text-emerald-300',
      },
      {
        num: '04',
        title: 'Instant Output Return',
        detail: 'Swapped $NXL or XLM transfers directly from NexusSwap back into the user wallet.',
        accent: 'text-cyan-300',
      },
    ],
  },
  {
    id: 'bridge',
    label: 'Cross-Chain Bridge (→ XRP)',
    shortLabel: 'Bridge',
    icon: ShieldCheck,
    summary:
      'Trustless Stellar → XRPL settlement: XLM locks inside NexusSwap Escrow (with 15-min self-refund guarantee), while $NXL burns permanently via NexusVault::burn_for_bridge before XRPL pays out XRP.',
    steps: [
      {
        num: '01',
        title: 'Lock or Burn on Stellar',
        detail: 'XLM locks in NexusSwap::lock_bridge_escrow; $NXL burns via NexusVault::burn_for_bridge.',
        accent: 'text-sky-300',
      },
      {
        num: '02',
        title: 'On-Chain Proof Emitted',
        detail: 'Soroban emits immutable esc_lock / brg_out event containing target XRPL r... address.',
        accent: 'text-[#E6C666]',
      },
      {
        num: '03',
        title: 'XRPL Payout Executed',
        detail: 'Dual-rail relayer sends verified XRP payment to user destination on XRPL Testnet.',
        accent: 'text-blue-300',
      },
      {
        num: '04',
        title: 'Escrow Release / Safety',
        detail: 'Relayer submits XRPL tx hash to release escrow — if timeout occurs, user self-refunds 100%.',
        accent: 'text-emerald-300',
      },
    ],
  },
  {
    id: 'supply',
    label: 'Mint & Buyback Burn',
    shortLabel: 'Mint / Burn',
    icon: Flame,
    summary:
      'NexusVault is the authorized on-chain Admin of the $NXL Stellar Asset Contract (SAC). It enforces a strict 2,000,000 NXL hard cap on mints and permanently destroys supply on buyback-and-burn.',
    steps: [
      {
        num: '01',
        title: 'Admin / Relayer Trigger',
        detail: 'Authorized role initiates mint (cashback/bridge) or buyback burn from Treasury.',
        accent: 'text-[#E6C666]',
      },
      {
        num: '02',
        title: 'Supply Cap & Replay Guard',
        detail: 'NexusVault checks circulating + amount <= 2,000,000 NXL and blocks duplicate ref_id.',
        accent: 'text-sky-300',
      },
      {
        num: '03',
        title: '$NXL SAC Mint / Burn',
        detail: 'SEP-41 SAC either mints tokens to recipient or permanently destroys balance on ledger.',
        accent: 'text-rose-300',
      },
      {
        num: '04',
        title: 'Live On-Chain Telemetry',
        detail: 'TotalNxlMinted, TotalNxlBurned & Circulating Supply update live on Stellar Expert & Admin.',
        accent: 'text-emerald-300',
      },
    ],
  },
];

const CONTRACTS = {
  vault: {
    id: 'CBTDO4EKCQNUZRYSNK6LXB7AOQUNCY7FOV6AYDICSAH7CY6N57CQRJVB',
    short: 'CBTDO…RJVB',
    url: 'https://stellar.expert/explorer/testnet/contract/CBTDO4EKCQNUZRYSNK6LXB7AOQUNCY7FOV6AYDICSAH7CY6N57CQRJVB',
  },
  swap: {
    id: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
    short: 'CCJBR…QYAM',
    url: 'https://stellar.expert/explorer/testnet/contract/CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
  },
  nxlSac: {
    id: 'CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC',
    short: 'CDGPJ…7LPC',
    url: 'https://stellar.expert/explorer/testnet/contract/CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC',
  },
};

function MovingToken({
  pathId,
  label,
  fill,
  textColor = '#05070B',
  dur = '3.6s',
  begin = '0s',
  active,
  playing,
}: {
  pathId: string;
  label: string;
  fill: string;
  textColor?: string;
  dur?: string;
  begin?: string;
  active: boolean;
  playing: boolean;
}) {
  if (!active) return null;
  const width = Math.max(36, label.length * 7 + 14);
  return (
    <g opacity={playing ? 1 : 0.85}>
      {playing && (
        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" rotate="0">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      )}
      <rect
        x={-width / 2}
        y={-11}
        width={width}
        height={22}
        rx={11}
        fill={fill}
        stroke="#0A0E16"
        strokeWidth="2"
      />
      <text
        x="0"
        y="3.5"
        textAnchor="middle"
        fill={textColor}
        fontSize="9.5"
        fontWeight="800"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>
    </g>
  );
}

export function ProtocolAssetFlowDiagram() {
  const [mode, setMode] = useState<FlowMode>('all');
  const [playing, setPlaying] = useState(true);
  const [poolStats, setPoolStats] = useState<{
    reserveXlm: number;
    reserveNxl: number;
    totalSwaps: number;
  }>({
    reserveXlm: 2000,
    reserveNxl: 2000,
    totalSwaps: 0,
  });

  useEffect(() => {
    fetchLiveSorobanSwapPool()
      .then((pool) => {
        if (pool && pool.reserveXlm > 0) {
          setPoolStats({
            reserveXlm: pool.reserveXlm,
            reserveNxl: pool.reserveNxl,
            totalSwaps: pool.totalSwaps,
          });
        }
      })
      .catch(() => {});
  }, []);

  const activeTab = FLOW_TABS.find((t) => t.id === mode) || FLOW_TABS[0];

  // Active route flags
  const isCheckout = mode === 'all' || mode === 'checkout';
  const isSwap = mode === 'all' || mode === 'swap';
  const isBridge = mode === 'all' || mode === 'bridge';
  const isSupply = mode === 'all' || mode === 'supply';

  // Node emphasis helpers
  const nodeOpacity = (highlighted: boolean) => (highlighted ? 1 : 0.3);
  const pathOpacity = (highlighted: boolean) => (highlighted ? 0.92 : 0.14);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#080B11] shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden">
      {/* Header Bar */}
      <div className="border-b border-white/[0.07] px-5 py-5 sm:px-7 sm:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#0B0F17]">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[#E6C666]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live On-Chain Asset Architecture</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            How assets move across NexusRail smart contracts
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            {activeTab.summary}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            {playing ? <Pause className="w-3.5 h-3.5 text-[#E6C666]" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{playing ? 'Pause Motion' : 'Play Motion'}</span>
          </button>
          <Link
            href="/swap"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#e5c158] px-3.5 py-2 text-xs font-semibold text-black transition-colors"
          >
            <span>Try Live Swap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Mode Selector Pills */}
      <div className="border-b border-white/[0.06] px-4 py-3 sm:px-7 bg-[#090D14] flex items-center gap-2 overflow-x-auto no-scrollbar">
        {FLOW_TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border ${
                selected
                  ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#F4D984] shadow-sm'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-white/15'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Animated SVG Canvas */}
      <div
        className="relative px-3 py-5 sm:px-6 sm:py-7 overflow-x-auto"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <div className="min-w-[820px] max-w-[1120px] mx-auto">
          <svg
            viewBox="0 0 1080 500"
            className="w-full h-auto block select-none"
            role="img"
            aria-label="Animated end-to-end NexusRail Soroban smart contract asset movement diagram"
          >
            <defs>
              {/* Soft Glows */}
              <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Animated Routes (Bezier Paths) */}
              {/* 1. User -> NexusVault (Checkout / Burn-for-Bridge) */}
              <path id="path-user-vault" d="M 216 205 C 285 205, 305 108, 395 108" />

              {/* 2. User -> NexusSwap (AMM Swap / Bridge Escrow) */}
              <path id="path-user-swap" d="M 216 270 C 285 270, 305 390, 395 390" />

              {/* 3. NexusSwap -> User (Swapped Output Token Return) */}
              <path id="path-swap-user" d="M 395 418 C 300 418, 280 296, 216 296" />

              {/* 4. NexusVault -> Owner Treasury (99% Principal + 50% Fee) */}
              <path id="path-vault-treasury" d="M 665 82 C 745 82, 765 72, 845 72" />

              {/* 5. NexusVault -> $NXL Reserve (50% Buyback Fee) */}
              <path id="path-vault-reserve" d="M 665 118 C 745 118, 765 190, 845 190" />

              {/* 6. NexusVault <-> $NXL Token SAC (Mint / Burn Control) */}
              <path id="path-vault-sac" d="M 515 162 L 515 218" />
              <path id="path-sac-vault" d="M 545 218 L 545 162" />

              {/* 7. $NXL Token SAC -> User (2% Cashback / Mint to User) */}
              <path id="path-sac-user" d="M 410 250 C 330 250, 290 245, 216 245" />

              {/* 8. $NXL Token SAC -> Burned Supply (Permanent Burn) */}
              <path id="path-sac-burn" d="M 650 254 C 740 254, 765 304, 845 304" />

              {/* 9. NexusSwap -> Owner Treasury (0.25% AMM Owner Fee) */}
              <path id="path-swap-treasury" d="M 665 352 C 758 352, 770 96, 845 96" />

              {/* 10. NexusSwap -> XRPL Ledger (Bridge Escrow -> XRP Payout) */}
              <path id="path-swap-xrpl" d="M 665 408 C 745 408, 765 424, 845 424" />

              {/* 11. NexusSwap <-> $NXL SAC (Pool Token Transfers) */}
              <path id="path-swap-sac" d="M 530 338 L 530 294" />
            </defs>

            {/* Column Stage Labels */}
            <text x="118" y="24" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="700" letterSpacing="1.6">
              1. USER LAYER
            </text>
            <text x="530" y="24" textAnchor="middle" fill="#E6C666" fontSize="10" fontWeight="700" letterSpacing="1.6">
              2. STELLAR SOROBAN CONTRACTS (LIVE TESTNET)
            </text>
            <text x="952" y="24" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="700" letterSpacing="1.6">
              3. FINAL DESTINATIONS
            </text>

            {/* ===============================================================
                CONNECTOR PIPES (Rendered beneath nodes & moving tokens)
               =============================================================== */}

            {/* Checkout / Burn: User -> NexusVault */}
            <use
              href="#path-user-vault"
              fill="none"
              stroke="#38BDF8"
              strokeWidth={isCheckout || isBridge ? 2.5 : 1.5}
              strokeDasharray="6 6"
              opacity={pathOpacity(isCheckout || isBridge)}
            />

            {/* Swap / Escrow: User -> NexusSwap */}
            <use
              href="#path-user-swap"
              fill="none"
              stroke="#22D3EE"
              strokeWidth={isSwap || isBridge ? 2.5 : 1.5}
              strokeDasharray="6 6"
              opacity={pathOpacity(isSwap || isBridge)}
            />

            {/* Swap Output: NexusSwap -> User */}
            <use
              href="#path-swap-user"
              fill="none"
              stroke="#E6C666"
              strokeWidth={isSwap ? 2.5 : 1.5}
              strokeDasharray="6 6"
              opacity={pathOpacity(isSwap)}
            />

            {/* Checkout Split: NexusVault -> Treasury */}
            <use
              href="#path-vault-treasury"
              fill="none"
              stroke="#E6C666"
              strokeWidth={isCheckout ? 2.5 : 1.5}
              strokeDasharray="6 6"
              opacity={pathOpacity(isCheckout)}
            />

            {/* Checkout Split: NexusVault -> Reserve */}
            <use
              href="#path-vault-reserve"
              fill="none"
              stroke="#38BDF8"
              strokeWidth={isCheckout ? 2.5 : 1.5}
              strokeDasharray="6 6"
              opacity={pathOpacity(isCheckout)}
            />

            {/* Mint / Burn Control: NexusVault <-> NXL SAC */}
            <use
              href="#path-vault-sac"
              fill="none"
              stroke="#F43F5E"
              strokeWidth={isSupply || isBridge ? 2.5 : 1.5}
              strokeDasharray="4 4"
              opacity={pathOpacity(isSupply || isBridge)}
            />
            <use
              href="#path-sac-vault"
              fill="none"
              stroke="#34D399"
              strokeWidth={isSupply || isCheckout ? 2.5 : 1.5}
              strokeDasharray="4 4"
              opacity={pathOpacity(isSupply || isCheckout)}
            />

            {/* Cashback / Mint: NXL SAC -> User */}
            <use
              href="#path-sac-user"
              fill="none"
              stroke="#34D399"
              strokeWidth={isCheckout || isSupply ? 2.5 : 1.5}
              strokeDasharray="6 6"
              opacity={pathOpacity(isCheckout || isSupply)}
            />

            {/* Permanent Burn: NXL SAC -> Burned Supply */}
            <use
              href="#path-sac-burn"
              fill="none"
              stroke="#FB7185"
              strokeWidth={isSupply || isBridge ? 2.5 : 1.5}
              strokeDasharray="5 5"
              opacity={pathOpacity(isSupply || isBridge)}
            />

            {/* Swap Fee: NexusSwap -> Treasury */}
            <use
              href="#path-swap-treasury"
              fill="none"
              stroke="#D4AF37"
              strokeWidth={isSwap ? 2 : 1.25}
              strokeDasharray="5 5"
              opacity={pathOpacity(isSwap)}
            />

            {/* Bridge Payout: NexusSwap -> XRPL */}
            <use
              href="#path-swap-xrpl"
              fill="none"
              stroke="#60A5FA"
              strokeWidth={isBridge ? 2.5 : 1.5}
              strokeDasharray="6 6"
              opacity={pathOpacity(isBridge)}
            />

            {/* Pool Token Sync: NexusSwap -> NXL SAC */}
            <use
              href="#path-swap-sac"
              fill="none"
              stroke="#34D399"
              strokeWidth={isSwap ? 2 : 1.25}
              strokeDasharray="4 4"
              opacity={pathOpacity(isSwap)}
            />

            {/* ===============================================================
                NODE 1: USER WALLET (LEFT)
               =============================================================== */}
            <g opacity={nodeOpacity(true)}>
              <rect
                x="20"
                y="175"
                width="196"
                height="152"
                rx="18"
                fill="#0F1520"
                stroke="#38BDF8"
                strokeOpacity="0.45"
                strokeWidth="1.5"
              />
              <rect x="34" y="191" width="74" height="20" rx="10" fill="#0EA5E9" fillOpacity="0.16" />
              <text x="71" y="204.5" textAnchor="middle" fill="#7DD3FC" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                USER WALLET
              </text>
              <text x="34" y="232" fill="#FFFFFF" fontSize="15" fontWeight="700">
                Freighter / Gem
              </text>
              <text x="34" y="252" fill="#94A3B8" fontSize="11">
                Signs 1-click Soroban XDR
              </text>
              <line x1="34" y1="268" x2="202" y2="268" stroke="#1E293B" strokeWidth="1" />
              <text x="34" y="288" fill="#E2E8F0" fontSize="10.5" fontFamily="monospace">
                Holds: XLM · NXL · XRP
              </text>
              <text x="34" y="308" fill="#34D399" fontSize="10" fontFamily="monospace">
                Non-custodial auth
              </text>
            </g>

            {/* ===============================================================
                NODE 2: NEXUS VAULT CONTRACT (CENTER TOP)
               =============================================================== */}
            <g opacity={nodeOpacity(isCheckout || isSupply || isBridge)}>
              <rect
                x="395"
                y="46"
                width="270"
                height="116"
                rx="18"
                fill="#111622"
                stroke="#D4AF37"
                strokeOpacity={isCheckout || isSupply ? 0.85 : 0.35}
                strokeWidth="1.75"
              />
              <rect x="411" y="60" width="110" height="20" rx="10" fill="#D4AF37" fillOpacity="0.18" />
              <text x="466" y="73.5" textAnchor="middle" fill="#F4D984" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                CONTRACT #1 · VAULT
              </text>
              <text x="649" y="73.5" textAnchor="end" fill="#94A3B8" fontSize="9.5" fontFamily="monospace">
                {CONTRACTS.vault.short}
              </text>
              <text x="411" y="101" fill="#FFFFFF" fontSize="15.5" fontWeight="700">
                NexusVault v2.0
              </text>
              <text x="411" y="120" fill="#94A3B8" fontSize="11">
                Checkout 50/50 Split · Refunds · RBAC
              </text>
              <text x="411" y="142" fill="#E6C666" fontSize="10" fontFamily="monospace">
                settle_order · mint_nxl · burn_for_bridge
              </text>
            </g>

            {/* ===============================================================
                NODE 3: $NXL TOKEN SAC (CENTER MIDDLE — BUILT-IN TOKEN LAYER)
               =============================================================== */}
            <g opacity={nodeOpacity(true)}>
              <rect
                x="410"
                y="218"
                width="240"
                height="76"
                rx="16"
                fill="#0D1917"
                stroke="#34D399"
                strokeOpacity="0.65"
                strokeWidth="1.5"
              />
              <text x="426" y="238" fill="#6EE7B7" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                BUILT-IN SEP-41 TOKEN SAC · {CONTRACTS.nxlSac.short}
              </text>
              <text x="426" y="259" fill="#FFFFFF" fontSize="14.5" fontWeight="700">
                $NXL Token Ledger
              </text>
              <text x="426" y="278" fill="#A7F3D0" fontSize="10" fontFamily="monospace">
                Hard Cap: 2,000,000 NXL · Admin: NexusVault
              </text>
            </g>

            {/* ===============================================================
                NODE 4: NEXUS SWAP CONTRACT (CENTER BOTTOM)
               =============================================================== */}
            <g opacity={nodeOpacity(isSwap || isBridge)}>
              <rect
                x="395"
                y="338"
                width="270"
                height="122"
                rx="18"
                fill="#0F1724"
                stroke="#22D3EE"
                strokeOpacity={isSwap || isBridge ? 0.85 : 0.35}
                strokeWidth="1.75"
              />
              <rect x="411" y="352" width="114" height="20" rx="10" fill="#22D3EE" fillOpacity="0.16" />
              <text x="468" y="365.5" textAnchor="middle" fill="#67E8F9" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                CONTRACT #2 · AMM
              </text>
              <text x="649" y="365.5" textAnchor="end" fill="#94A3B8" fontSize="9.5" fontFamily="monospace">
                {CONTRACTS.swap.short}
              </text>
              <text x="411" y="393" fill="#FFFFFF" fontSize="15.5" fontWeight="700">
                NexusSwap &amp; Escrow v2.0
              </text>
              <text x="411" y="413" fill="#67E8F9" fontSize="11" fontFamily="monospace">
                Live Pool: {poolStats.reserveXlm.toLocaleString()} XLM / {poolStats.reserveNxl.toLocaleString()} NXL
              </text>
              <text x="411" y="436" fill="#94A3B8" fontSize="10" fontFamily="monospace">
                swap_exact_in (x·y=k) · lock_bridge_escrow
              </text>
            </g>

            {/* ===============================================================
                RIGHT DESTINATIONS (4 OUTCOME CARDS)
               =============================================================== */}

            {/* Dest 1: Owner Treasury */}
            <g opacity={nodeOpacity(isCheckout || isSwap)}>
              <rect
                x="845"
                y="42"
                width="215"
                height="82"
                rx="14"
                fill="#111520"
                stroke="#D4AF37"
                strokeOpacity="0.5"
                strokeWidth="1.4"
              />
              <text x="860" y="64" fill="#F4D984" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                OWNER TREASURY
              </text>
              <text x="860" y="84" fill="#FFFFFF" fontSize="13.5" fontWeight="700">
                99% Principal + 50% Fee
              </text>
              <text x="860" y="105" fill="#94A3B8" fontSize="10" fontFamily="monospace">
                + 0.25% AMM Swap Revenue
              </text>
            </g>

            {/* Dest 2: $NXL Buyback Reserve */}
            <g opacity={nodeOpacity(isCheckout)}>
              <rect
                x="845"
                y="150"
                width="215"
                height="82"
                rx="14"
                fill="#0F1622"
                stroke="#38BDF8"
                strokeOpacity="0.5"
                strokeWidth="1.4"
              />
              <text x="860" y="172" fill="#7DD3FC" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                $NXL RESERVE VAULT
              </text>
              <text x="860" y="192" fill="#FFFFFF" fontSize="13.5" fontWeight="700">
                50% Fee Buyback Pool
              </text>
              <text x="860" y="213" fill="#94A3B8" fontSize="10" fontFamily="monospace">
                Strengthens $NXL Backing
              </text>
            </g>

            {/* Dest 3: Permanent Burned Supply */}
            <g opacity={nodeOpacity(isSupply || isBridge)}>
              <rect
                x="845"
                y="262"
                width="215"
                height="82"
                rx="14"
                fill="#1B1015"
                stroke="#FB7185"
                strokeOpacity="0.55"
                strokeWidth="1.4"
              />
              <text x="860" y="284" fill="#FDA4AF" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                DEFLATIONARY BURN
              </text>
              <text x="860" y="304" fill="#FFFFFF" fontSize="13.5" fontWeight="700">
                Destroyed On-Chain
              </text>
              <text x="860" y="325" fill="#FDA4AF" fontSize="10" fontFamily="monospace">
                Removes $NXL from Supply
              </text>
            </g>

            {/* Dest 4: XRPL Cross-Chain Payout */}
            <g opacity={nodeOpacity(isBridge)}>
              <rect
                x="845"
                y="376"
                width="215"
                height="86"
                rx="14"
                fill="#0D1729"
                stroke="#60A5FA"
                strokeOpacity="0.6"
                strokeWidth="1.4"
              />
              <text x="860" y="398" fill="#93C5FD" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                XRPL TESTNET LEDGER
              </text>
              <text x="860" y="418" fill="#FFFFFF" fontSize="13.5" fontWeight="700">
                User Receives XRP
              </text>
              <text x="860" y="439" fill="#93C5FD" fontSize="10" fontFamily="monospace">
                15m Self-Refund Escrow Safe
              </text>
            </g>

            {/* ===============================================================
                ANIMATED MOVING ASSET TOKENS (60fps SMIL animateMotion)
               =============================================================== */}
            <MovingToken
              pathId="path-user-vault"
              label={mode === 'bridge' ? 'NXL' : 'XLM'}
              fill="#38BDF8"
              dur="3.2s"
              active={isCheckout || isBridge}
              playing={playing}
            />
            <MovingToken
              pathId="path-vault-treasury"
              label="99.5%"
              fill="#E6C666"
              dur="2.8s"
              begin="0.6s"
              active={isCheckout}
              playing={playing}
            />
            <MovingToken
              pathId="path-vault-reserve"
              label="0.5%"
              fill="#38BDF8"
              dur="3.0s"
              begin="0.8s"
              active={isCheckout}
              playing={playing}
            />
            <MovingToken
              pathId="path-user-swap"
              label="XLM"
              fill="#22D3EE"
              dur="3.2s"
              begin="0.2s"
              active={isSwap || isBridge}
              playing={playing}
            />
            <MovingToken
              pathId="path-swap-user"
              label="NXL"
              fill="#E6C666"
              dur="3.4s"
              begin="1.4s"
              active={isSwap}
              playing={playing}
            />
            <MovingToken
              pathId="path-swap-treasury"
              label="0.25%"
              fill="#D4AF37"
              dur="4.2s"
              begin="1.1s"
              active={isSwap}
              playing={playing}
            />
            <MovingToken
              pathId="path-sac-user"
              label={mode === 'supply' ? 'MINT' : '+2% NXL'}
              fill="#34D399"
              dur="3.4s"
              begin="1.2s"
              active={isCheckout || isSupply}
              playing={playing}
            />
            <MovingToken
              pathId="path-sac-burn"
              label="BURN"
              fill="#FB7185"
              textColor="#FFFFFF"
              dur="3.1s"
              begin="0.9s"
              active={isSupply || isBridge}
              playing={playing}
            />
            <MovingToken
              pathId="path-swap-xrpl"
              label="XRP"
              fill="#60A5FA"
              dur="3.0s"
              begin="1.0s"
              active={isBridge}
              playing={playing}
            />
          </svg>
        </div>
      </div>

      {/* Step-by-Step Guide Strip (Responsive for Mobile + Desktop) */}
      <div className="border-t border-white/[0.06] bg-[#0B0F17] px-5 py-5 sm:px-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {activeTab.steps.map((step) => (
            <div
              key={step.num}
              className="rounded-xl border border-white/[0.06] bg-[#080B11] p-3.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-mono font-bold ${step.accent}`}>STEP {step.num}</span>
                <Sparkles className="w-3 h-3 text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-white">{step.title}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Contract Explorer Strip */}
      <div className="border-t border-white/[0.06] bg-[#070A0F] px-5 py-3.5 sm:px-7 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-400">
          <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
            <Coins className="w-3.5 h-3.5" />
            Live Pool: {poolStats.reserveXlm.toLocaleString()} XLM / {poolStats.reserveNxl.toLocaleString()} NXL (1:1)
          </span>
          <a
            href={CONTRACTS.vault.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#F4D984] transition-colors"
          >
            NexusVault ({CONTRACTS.vault.short}) <ArrowUpRight className="w-3 h-3" />
          </a>
          <a
            href={CONTRACTS.swap.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-cyan-300 transition-colors"
          >
            NexusSwap ({CONTRACTS.swap.short}) <ArrowUpRight className="w-3 h-3" />
          </a>
          <a
            href={CONTRACTS.nxlSac.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors"
          >
            $NXL SAC ({CONTRACTS.nxlSac.short}) <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
        <Link
          href="/store"
          className="text-[#E6C666] hover:text-[#F4D984] inline-flex items-center gap-1 font-semibold"
        >
          Test Atomic Checkout <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
