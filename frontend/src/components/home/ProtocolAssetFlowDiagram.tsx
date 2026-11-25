'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Coins,
  Crown,
  Flame,
  Lock,
  Pause,
  Play,
  Shield,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { fetchLiveSorobanSwapPool } from '@/lib/soroban';
import { usePlatformConfig } from '@/lib/platformConfig';

type FlowMode = 'all' | 'checkout' | 'swap' | 'bridge' | 'supply';
type NodeKey = 'wallet' | 'vault' | 'token' | 'swap' | 'treasury' | 'buyback' | 'burn' | 'xrpl';
type NodeTheme = 'cyan' | 'gold' | 'emerald' | 'rose' | 'indigo';

interface WireDef {
  id: string;
  from: string;
  to: string;
  nodes: NodeKey[];
  flows: FlowMode[];
  color: string;
  markerKey: 'sky' | 'emerald' | 'amber' | 'cyan' | 'rose' | 'indigo';
  pill: string;
  pillByFlow?: Partial<Record<FlowMode, string>>;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  t: number;
  dx?: number;
  dy: number;
  dir: 'h' | 'v' | 'h-wide';
  speed: number;
}

interface Point {
  x: number;
  y: number;
}

interface BezierCurve {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

interface WireGeometry {
  wire: WireDef;
  bezier: BezierCurve;
  d: string;
  pillPos: Point;
}

const MARKER_COLORS: Record<WireDef['markerKey'], string> = {
  sky: '#38bdf8',
  emerald: '#34d399',
  amber: '#fbbf24',
  cyan: '#22d3ee',
  rose: '#fb7185',
  indigo: '#818cf8',
};

const WIRES: WireDef[] = [
  // 1. User -> NexusVault (Checkout XLM/NXL OR Bridge Burn $NXL)
  {
    id: 'w-user-vault',
    from: 'p-wallet-1',
    to: 'p-vault-l',
    nodes: ['wallet', 'vault'],
    flows: ['all', 'checkout', 'bridge'],
    color: '#38bdf8',
    markerKey: 'sky',
    pill: 'XLM / NXL',
    pillByFlow: { checkout: 'XLM Pay', bridge: '$NXL Burn' },
    pillBg: '#081829',
    pillBorder: 'rgba(56,189,248,0.55)',
    pillText: '#7dd3fc',
    t: 0.48,
    dy: -14,
    dir: 'h',
    speed: 0.0046,
  },
  // 2. $NXL SAC -> User (+2% Cashback / Minted Supply)
  {
    id: 'w-sac-user',
    from: 'p-token-l',
    to: 'p-wallet-2',
    nodes: ['wallet', 'token', 'vault'],
    flows: ['all', 'checkout', 'supply'],
    color: '#34d399',
    markerKey: 'emerald',
    pill: '+2% $NXL',
    pillByFlow: { supply: 'Mint $NXL' },
    pillBg: '#062019',
    pillBorder: 'rgba(52,211,153,0.55)',
    pillText: '#6ee7b7',
    t: 0.5,
    dy: -13,
    dir: 'h',
    speed: 0.0044,
  },
  // 3. User -> NexusSwap (AMM Swap Input OR Bridge XLM Lock)
  {
    id: 'w-swap-in',
    from: 'p-wallet-3',
    to: 'p-swap-lt',
    nodes: ['wallet', 'swap'],
    flows: ['all', 'swap', 'bridge'],
    color: '#fbbf24',
    markerKey: 'amber',
    pill: 'Swap In',
    pillByFlow: { swap: 'XLM / NXL', bridge: 'XLM Lock' },
    pillBg: '#221807',
    pillBorder: 'rgba(251,191,36,0.55)',
    pillText: '#fde68a',
    t: 0.44,
    dy: -14,
    dir: 'h',
    speed: 0.0048,
  },
  // 4. NexusSwap -> User (Swapped Output Return)
  {
    id: 'w-swap-out',
    from: 'p-swap-lb',
    to: 'p-wallet-4',
    nodes: ['wallet', 'swap'],
    flows: ['all', 'swap'],
    color: '#22d3ee',
    markerKey: 'cyan',
    pill: 'Swapped Out',
    pillBg: '#071D26',
    pillBorder: 'rgba(34,211,238,0.55)',
    pillText: '#67e8f9',
    t: 0.52,
    dy: 16,
    dir: 'h',
    speed: 0.0045,
  },
  // 5. NexusVault -> $NXL SAC (Mint & Burn SAC Admin Control)
  {
    id: 'w-mint-vert',
    from: 'p-vault-b',
    to: 'p-token-t',
    nodes: ['vault', 'token'],
    flows: ['all', 'checkout', 'supply', 'bridge'],
    color: '#34d399',
    markerKey: 'emerald',
    pill: 'Mint / Burn',
    pillByFlow: { checkout: 'Mint 2%', bridge: 'Burn Bridge' },
    pillBg: '#062019',
    pillBorder: 'rgba(52,211,153,0.55)',
    pillText: '#6ee7b7',
    t: 0.5,
    dy: 0,
    dir: 'v',
    speed: 0.006,
  },
  // 6. NexusSwap -> $NXL SAC (AMM Pool Token Settlement)
  {
    id: 'w-swap-vert',
    from: 'p-swap-t',
    to: 'p-token-b',
    nodes: ['swap', 'token'],
    flows: ['all', 'swap'],
    color: '#34d399',
    markerKey: 'emerald',
    pill: 'Pool Sync',
    pillBg: '#062019',
    pillBorder: 'rgba(52,211,153,0.45)',
    pillText: '#6ee7b7',
    t: 0.5,
    dy: 0,
    dir: 'v',
    speed: 0.0058,
  },
  // 7. NexusVault -> Treasury (order settlement split)
  {
    id: 'w-995',
    from: 'p-vault-rt',
    to: 'p-treasury-t',
    nodes: ['vault', 'treasury'],
    flows: ['all', 'checkout'],
    color: '#fbbf24',
    markerKey: 'amber',
    pill: 'Settlement',
    pillBg: '#221807',
    pillBorder: 'rgba(251,191,36,0.55)',
    pillText: '#fde68a',
    t: 0.48,
    dy: -14,
    dir: 'h',
    speed: 0.005,
  },
  // 8. NexusVault -> Buyback Pool (protocol fee share)
  {
    id: 'w-05',
    from: 'p-vault-rb',
    to: 'p-buyback',
    nodes: ['vault', 'buyback'],
    flows: ['all', 'checkout'],
    color: '#38bdf8',
    markerKey: 'sky',
    pill: 'Fee share',
    pillBg: '#081829',
    pillBorder: 'rgba(56,189,248,0.55)',
    pillText: '#7dd3fc',
    t: 0.42,
    dx: -6,
    dy: -12,
    dir: 'h',
    speed: 0.0049,
  },
  // 9. NexusSwap -> Treasury (AMM owner fee)
  {
    id: 'w-025',
    from: 'p-swap-rt',
    to: 'p-treasury-b',
    nodes: ['swap', 'treasury'],
    flows: ['all', 'swap'],
    color: '#fbbf24',
    markerKey: 'amber',
    pill: 'AMM fee',
    pillBg: '#221807',
    pillBorder: 'rgba(245,158,11,0.55)',
    pillText: '#fcd34d',
    t: 0.66,
    dx: 14,
    dy: 0,
    dir: 'h-wide',
    speed: 0.0042,
  },
  // 10. $NXL SAC -> Burned (Permanent Supply Burn)
  {
    id: 'w-burn',
    from: 'p-token-r',
    to: 'p-burn',
    nodes: ['token', 'burn', 'vault'],
    flows: ['all', 'supply', 'bridge'],
    color: '#fb7185',
    markerKey: 'rose',
    pill: 'BURN',
    pillBg: '#260A13',
    pillBorder: 'rgba(251,113,133,0.55)',
    pillText: '#fda4af',
    t: 0.48,
    dy: -12,
    dir: 'h',
    speed: 0.0052,
  },
  // 11. NexusSwap -> XRPL Wallet (Cross-Chain XRP Settlement)
  {
    id: 'w-xrp',
    from: 'p-swap-rb',
    to: 'p-xrpl',
    nodes: ['swap', 'xrpl'],
    flows: ['all', 'bridge'],
    color: '#818cf8',
    markerKey: 'indigo',
    pill: 'XRP Payout',
    pillBg: '#10122E',
    pillBorder: 'rgba(129,140,248,0.55)',
    pillText: '#a5b4fc',
    t: 0.5,
    dy: 15,
    dir: 'h',
    speed: 0.0049,
  },
];

const FLOW_FILTERS: Array<{ id: FlowMode; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'swap', label: 'Swap' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'supply', label: 'Mint / Burn' },
];

const FLOW_CAPTIONS: Record<FlowMode, string> = {
  all: 'Every transaction moves through audited Stellar Soroban contracts: NexusVault (fee split + mint/burn), $NXL SAC (capped supply ledger), and NexusSwap (AMM + timed bridge escrow).',
  checkout: 'User signs 1 Freighter XDR → NexusVault::settle_order splits the order fee between Treasury and the Buyback Pool, then mints $NXL cashback.',
  swap: 'User swaps XLM ↔ $NXL directly on NexusSwap (x·y=k) with a slippage guard. The AMM fee is split between Treasury and the pool, and output returns directly to User.',
  bridge: 'XLM locks in NexusSwap Escrow (self-refund if it expires) or $NXL burns permanently via NexusVault::burn_for_bridge before XRPL settles XRP.',
  supply: 'NexusVault is the on-chain Admin of $NXL SAC, enforcing the hard supply cap on mints and permanently burning supply on buyback-and-burn.',
};

const MOBILE_STEPS: Record<FlowMode, Array<{ from: string; badge: string; badgeColor: string; to: string; note: string }>> = {
  all: [
    { from: 'Freighter / Gem Wallet', badge: 'XLM / NXL', badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10', to: 'NexusVault v2.0', note: 'Fee split to Treasury + Buyback · $NXL cashback' },
    { from: 'NexusVault v2.0', badge: 'Mint / Burn', badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10', to: '$NXL SAC Ledger', note: 'SEP-41 token · capped supply · permanent burn' },
    { from: 'Freighter / Gem Wallet', badge: 'Swap / Escrow', badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10', to: 'NexusSwap v2.0', note: 'x·y=k live pool · AMM fee to Treasury' },
    { from: 'NexusSwap v2.0', badge: 'XRP Payout', badgeColor: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10', to: 'XRPL Wallet', note: 'Atomic XRPL payout · timed self-refund lock' },
  ],
  checkout: [
    { from: 'User Wallet (Freighter)', badge: 'XLM Pay', badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10', to: 'NexusVault::settle_order', note: 'Replay-locked order_ref + checked math' },
    { from: 'NexusVault v2.0', badge: 'Principal', badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10', to: 'Owner Treasury', note: 'Order principal plus treasury fee share' },
    { from: 'NexusVault v2.0', badge: 'Fee share', badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10', to: 'Buyback Reserve Pool', note: 'Buyback share deepens $NXL backing' },
    { from: '$NXL SAC Ledger', badge: 'Cashback', badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10', to: 'User Wallet', note: 'Idempotent loyalty cashback minted' },
  ],
  swap: [
    { from: 'User Wallet (Freighter)', badge: 'XLM / NXL', badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10', to: 'NexusSwap::swap_exact_in', note: 'Enforces min_amount_out & deadline' },
    { from: 'NexusSwap AMM Pool', badge: 'AMM fee', badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10', to: 'Owner Treasury', note: 'Configured share routes to treasury' },
    { from: 'NexusSwap AMM Pool', badge: 'Swapped Out', badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10', to: 'User Wallet', note: 'Instant on-chain delivery to Freighter' },
  ],
  bridge: [
    { from: 'User Wallet (XLM)', badge: 'XLM Lock', badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10', to: 'NexusSwap Escrow', note: 'Timed lock · user can self-refund if expired' },
    { from: 'User Wallet ($NXL)', badge: '$NXL Burn', badgeColor: 'text-rose-300 border-rose-500/40 bg-rose-500/10', to: 'NexusVault → Burned', note: 'SEP-41 burn keeps dual-rail supply 1:1' },
    { from: 'Dual-Rail Relayer', badge: 'XRP Payout', badgeColor: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10', to: 'XRPL Wallet (r...)', note: 'XRPL tx hash releases Stellar escrow proof' },
  ],
  supply: [
    { from: 'Admin / Relayer', badge: 'Mint ≤ cap', badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10', to: 'NexusVault → $NXL SAC', note: 'Hard supply cap enforced on-chain' },
    { from: 'Treasury / Holder', badge: 'BURN', badgeColor: 'text-rose-300 border-rose-500/40 bg-rose-500/10', to: '$NXL SAC → Burned', note: 'Permanently subtracted from circulating supply' },
  ],
};

function makeBezier(p0: Point, p3: Point, dir: WireDef['dir']): BezierCurve {
  // Trim the target endpoint slightly by 6px along the arrival axis so the SVG arrowhead tip kisses the port dot cleanly
  if (dir === 'v') {
    const signY = p3.y >= p0.y ? 1 : -1;
    const end = { x: p3.x, y: p3.y - signY * 7 };
    const start = { x: p0.x, y: p0.y + signY * 4 };
    const dy = end.y - start.y;
    return {
      p0: start,
      p1: { x: start.x, y: start.y + dy * 0.5 },
      p2: { x: end.x, y: end.y - dy * 0.5 },
      p3: end,
    };
  }

  const signX = p3.x >= p0.x ? 1 : -1;
  const start = { x: p0.x + signX * 4, y: p0.y };
  const end = { x: p3.x - signX * 8, y: p3.y };
  const dx = end.x - start.x;
  const k = dir === 'h-wide' ? 0.58 : 0.46;
  return {
    p0: start,
    p1: { x: start.x + dx * k, y: start.y },
    p2: { x: end.x - dx * k, y: end.y },
    p3: end,
  };
}

function evalBezier(b: BezierCurve, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * b.p0.x + 3 * u * u * t * b.p1.x + 3 * u * t * t * b.p2.x + t * t * t * b.p3.x,
    y: u * u * u * b.p0.y + 3 * u * u * t * b.p1.y + 3 * u * t * t * b.p2.y + t * t * t * b.p3.y,
  };
}

export function ProtocolAssetFlowDiagram() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pulsesGroupRef = useRef<SVGGElement | null>(null);

  const { config } = usePlatformConfig();
  const contractBase = config?.explorers?.stellarContract || '';
  const vaultId = config?.contracts?.nexusVault || '';
  const swapId = config?.contracts?.nexusSwap || '';
  const nxlSacId = config?.assets?.nxl?.stellarContractId || '';

  const CONTRACTS = React.useMemo(() => {
    const build = (id: string) => ({
      short: id ? `${id.slice(0, 5)}…${id.slice(-4)}` : 'Not configured',
      url: id && contractBase ? `${contractBase.replace(/\/$/, '')}/${id}` : '',
    });
    return { vault: build(vaultId), swap: build(swapId), nxlSac: build(nxlSacId) };
  }, [contractBase, vaultId, swapId, nxlSacId]);

  const [activeFlow, setActiveFlow] = useState<FlowMode>('all');
  const [hoveredNode, setHoveredNode] = useState<NodeKey | null>(null);
  const [playing, setPlaying] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [geometries, setGeometries] = useState<WireGeometry[]>([]);
  const [poolStats, setPoolStats] = useState({ reserveXlm: 0, reserveNxl: 0, totalSwaps: 0 });
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    addr: string;
    formula: string;
  }>({ visible: false, x: 0, y: 0, addr: '', formula: '' });

  const activeFlowRef = useRef<FlowMode>(activeFlow);
  const hoveredNodeRef = useRef<NodeKey | null>(hoveredNode);
  const playingRef = useRef<boolean>(playing);
  const speedMultRef = useRef<number>(1);

  activeFlowRef.current = activeFlow;
  hoveredNodeRef.current = hoveredNode;
  playingRef.current = playing;

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

  const isWireActive = useCallback((w: WireDef, flow: FlowMode, hover: NodeKey | null) => {
    if (hover) return w.nodes.includes(hover);
    return w.flows.includes(flow);
  }, []);

  const measureWires = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sRect = stage.getBoundingClientRect();
    if (sRect.width === 0) return;

    const next: WireGeometry[] = [];
    for (const wire of WIRES) {
      const elFrom = stage.querySelector<HTMLElement>(`[data-port="${wire.from}"]`);
      const elTo = stage.querySelector<HTMLElement>(`[data-port="${wire.to}"]`);
      if (!elFrom || !elTo) continue;

      const r0 = elFrom.getBoundingClientRect();
      const r3 = elTo.getBoundingClientRect();
      if (r0.width === 0 || r3.width === 0) continue;

      const p0: Point = {
        x: r0.left - sRect.left + r0.width / 2,
        y: r0.top - sRect.top + r0.height / 2,
      };
      const p3: Point = {
        x: r3.left - sRect.left + r3.width / 2,
        y: r3.top - sRect.top + r3.height / 2,
      };
      const bezier = makeBezier(p0, p3, wire.dir);
      const d = `M ${bezier.p0.x.toFixed(1)} ${bezier.p0.y.toFixed(1)} C ${bezier.p1.x.toFixed(1)} ${bezier.p1.y.toFixed(1)}, ${bezier.p2.x.toFixed(1)} ${bezier.p2.y.toFixed(1)}, ${bezier.p3.x.toFixed(1)} ${bezier.p3.y.toFixed(1)}`;
      const pillPos = evalBezier(bezier, wire.t);
      next.push({ wire, bezier, d, pillPos });
    }
    setGeometries(next);
  }, []);

  useEffect(() => {
    measureWires();
    const t1 = setTimeout(measureWires, 120);
    const t2 = setTimeout(measureWires, 450);
    const stage = stageRef.current;
    let observer: ResizeObserver | null = null;
    if (stage && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measureWires());
      observer.observe(stage);
    }
    window.addEventListener('resize', measureWires);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer?.disconnect();
      window.removeEventListener('resize', measureWires);
    };
  }, [measureWires]);

  // 60fps glowing circular asset balls traveling along every Bezier path
  useEffect(() => {
    const group = pulsesGroupRef.current;
    if (!group || geometries.length === 0) return;

    while (group.firstChild) group.removeChild(group.firstChild);

    type BallParticle = {
      geom: WireGeometry;
      t: number;
      speed: number;
      outer: SVGCircleElement;
      core: SVGCircleElement;
    };

    const particles: BallParticle[] = [];

    geometries.forEach((geom) => {
      [0, 0.5].forEach((offset, idx) => {
        const outer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outer.setAttribute('r', '7.2');
        outer.setAttribute('fill', geom.wire.color);
        outer.setAttribute('fill-opacity', '0.28');

        const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        core.setAttribute('r', '3.8');
        core.setAttribute('fill', '#ffffff');
        core.setAttribute('stroke', geom.wire.color);
        core.setAttribute('stroke-width', '2.2');

        group.appendChild(outer);
        group.appendChild(core);

        particles.push({
          geom,
          t: (offset + idx * 0.04) % 1,
          speed: geom.wire.speed,
          outer,
          core,
        });
      });
    });

    let rafId = 0;
    const tick = () => {
      const flow = activeFlowRef.current;
      const hover = hoveredNodeRef.current;
      const isPlaying = playingRef.current;
      const mult = speedMultRef.current;

      for (const p of particles) {
        const active = isWireActive(p.geom.wire, flow, hover);
        const opacity = active ? '1' : '0.06';
        p.outer.style.opacity = opacity;
        p.core.style.opacity = opacity;

        if (isPlaying) {
          p.t += p.speed * mult;
          if (p.t > 1) p.t -= 1;
        }

        const pos = evalBezier(p.geom.bezier, p.t);
        const xStr = pos.x.toFixed(1);
        const yStr = pos.y.toFixed(1);
        p.outer.setAttribute('cx', xStr);
        p.outer.setAttribute('cy', yStr);
        p.outer.setAttribute('r', mult > 1 ? '9.5' : '7.2');

        p.core.setAttribute('cx', xStr);
        p.core.setAttribute('cy', yStr);
        p.core.setAttribute('r', mult > 1 ? '4.8' : '3.8');
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [geometries, isWireActive]);

  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSimulate = () => {
    if (simTimerRef.current) clearTimeout(simTimerRef.current);
    setPlaying(true);
    setSimulating(true);
    speedMultRef.current = 3.8;
    simTimerRef.current = setTimeout(() => {
      speedMultRef.current = 1;
      setSimulating(false);
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
    };
  }, []);

  const activeNodes = new Set<NodeKey>();
  WIRES.forEach((w) => {
    if (isWireActive(w, activeFlow, hoveredNode)) {
      w.nodes.forEach((n) => activeNodes.add(n));
    }
  });
  if (hoveredNode) activeNodes.add(hoveredNode);

  const getNodeClasses = (key: NodeKey, theme: NodeTheme) => {
    const base =
      'relative z-20 rounded-xl border backdrop-blur-md transition-all duration-300 cursor-pointer bg-gradient-to-br from-[#11182A]/95 to-[#090D18]/98 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-0.5';

    if (activeFlow === 'all' && !hoveredNode) {
      return `${base} border-slate-400/20 hover:border-slate-300/40`;
    }
    if (!activeNodes.has(key)) {
      return `${base} border-slate-700/30 opacity-20 grayscale-[50%]`;
    }
    const ringMap: Record<NodeTheme, string> = {
      cyan: 'border-sky-400/70 shadow-[0_0_24px_-4px_rgba(56,189,248,0.32)]',
      gold: 'border-amber-400/70 shadow-[0_0_24px_-4px_rgba(251,191,36,0.32)]',
      emerald: 'border-emerald-400/70 shadow-[0_0_24px_-4px_rgba(52,211,153,0.32)]',
      rose: 'border-rose-400/70 shadow-[0_0_24px_-4px_rgba(251,113,133,0.32)]',
      indigo: 'border-indigo-400/70 shadow-[0_0_24px_-4px_rgba(129,140,248,0.32)]',
    };
    return `${base} ${ringMap[theme]}`;
  };

  const handleNodeEnter = (key: NodeKey, addr: string, formula: string, e: React.MouseEvent) => {
    setHoveredNode(key);
    setTooltip({ visible: true, x: e.clientX, y: e.clientY, addr, formula });
  };

  const handleNodeMove = (e: React.MouseEvent) => {
    setTooltip((prev) => (prev.visible ? { ...prev, x: e.clientX, y: e.clientY } : prev));
  };

  const handleNodeLeave = () => {
    setHoveredNode(null);
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  const poolDisplay = poolStats.reserveXlm > 0 || poolStats.reserveNxl > 0
    ? `${Math.round(poolStats.reserveXlm).toLocaleString()} XLM / ${Math.round(poolStats.reserveNxl).toLocaleString()} $NXL`
    : 'pool reserve unavailable';

  return (
    <div className="w-full rounded-2xl border border-slate-800/90 bg-[#090D18]/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden">
      <style jsx>{`
        @keyframes nexusFlowDash {
          to {
            stroke-dashoffset: -36;
          }
        }
        .nexus-wire-dash {
          stroke-dasharray: 5 7;
          animation: nexusFlowDash 1.15s linear infinite;
          transition: opacity 0.28s ease;
        }
        .nexus-wire-dash.paused {
          animation-play-state: paused;
        }
      `}</style>

      {/* TOP CONTROL BAR */}
      <div className="px-4 py-3 sm:px-6 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 bg-[#07090E]/85">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs sm:text-sm font-bold tracking-tight text-white">NEXUS v2.0</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/70">
            SOROBAN ↔ XRPL
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800 overflow-x-auto max-w-full">
            {FLOW_FILTERS.map((f) => {
              const selected = activeFlow === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFlow(f.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer border ${
                    selected
                      ? 'font-semibold bg-sky-500/20 text-sky-300 border-sky-400/40'
                      : 'font-medium text-slate-400 hover:text-white border-transparent'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause asset motion' : 'Play asset motion'}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
          >
            {playing ? <Pause className="w-3 h-3 text-amber-300" /> : <Play className="w-3 h-3 text-emerald-400" />}
            <span className="hidden sm:inline">{playing ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={handleSimulate}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold text-white shadow-md active:scale-95 transition-all cursor-pointer ${
              simulating
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25'
                : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 shadow-sky-500/20'
            }`}
          >
            <Zap className="w-3 h-3 fill-current" />
            <span>{simulating ? 'Pulsing…' : 'Simulate'}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          DESKTOP & WIDE TABLET INTERACTIVE DIAGRAM (lg+)
          Spacious 5-track CSS grid guarantees >= 120px clean wire channels!
         ===================================================================== */}
      <div
        ref={stageRef}
        className="hidden lg:flex relative px-6 xl:px-8 py-6 h-[540px] flex-col justify-between"
        style={{
          backgroundColor: '#07090E',
          backgroundImage:
            'radial-gradient(circle at 22% 30%, rgba(56, 189, 248, 0.08) 0%, transparent 45%), radial-gradient(circle at 78% 70%, rgba(251, 191, 36, 0.06) 0%, transparent 45%), radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 20px 20px',
        }}
      >
        {/* Column Headers Aligned Exactly Above Node Columns */}
        <div className="grid grid-cols-[215px_minmax(120px,1fr)_310px_minmax(130px,1fr)_245px] text-[11px] font-mono font-semibold tracking-widest uppercase text-slate-500 mb-3 px-1">
          <div>01 · USER</div>
          <div />
          <div className="text-amber-400/85">02 · SOROBAN CONTRACTS</div>
          <div />
          <div>03 · DESTINATIONS</div>
        </div>

        {/* Dynamic SVG Bezier Wires + Directional Arrowheads + Circular Glowing Asset Balls */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          <defs>
            <filter id="nexusBallGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {(Object.entries(MARKER_COLORS) as Array<[WireDef['markerKey'], string]>).map(([key, color]) => (
              <React.Fragment key={key}>
                <marker
                  id={`arrow-${key}-on`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 9 5 L 0 8.8 L 2.2 5 z" fill={color} />
                </marker>
                <marker
                  id={`arrow-${key}-off`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 9 5 L 0 8.8 L 2.2 5 z" fill={color} fillOpacity="0.16" />
                </marker>
              </React.Fragment>
            ))}
          </defs>

          <g>
            {geometries.map(({ wire, d }) => {
              const on = isWireActive(wire, activeFlow, hoveredNode);
              return (
                <React.Fragment key={wire.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke={wire.color}
                    strokeWidth={1.7}
                    strokeOpacity={on ? 0.28 : 0.05}
                    markerEnd={`url(#arrow-${wire.markerKey}-${on ? 'on' : 'off'})`}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={wire.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    className={`nexus-wire-dash ${playing ? '' : 'paused'}`}
                    style={{ opacity: on ? 0.92 : 0.08 }}
                  />
                </React.Fragment>
              );
            })}
          </g>

          {/* 60fps Circular Glowing Asset Balls */}
          <g ref={pulsesGroupRef} filter="url(#nexusBallGlow)" />
        </svg>

        {/* Floating Pill Labels Centered in Spacious Wire Channels */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {geometries.map(({ wire, pillPos }) => {
            const label = wire.pillByFlow?.[activeFlow] ?? wire.pill;
            if (!label) return null;
            const on = isWireActive(wire, activeFlow, hoveredNode);
            return (
              <div
                key={`pill-${wire.id}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-[2px] rounded-full font-mono text-[11px] font-bold tracking-[0.02em] whitespace-nowrap shadow-[0_3px_10px_rgba(0,0,0,0.8)] transition-opacity duration-300"
                style={{
                  left: `${pillPos.x + (wire.dx || 0)}px`,
                  top: `${pillPos.y + wire.dy}px`,
                  background: wire.pillBg,
                  border: `1px solid ${wire.pillBorder}`,
                  color: wire.pillText,
                  opacity: on ? 1 : 0.12,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* 5-TRACK GRID: [Col1] [Wide Channel 1] [Col2] [Wide Channel 2] [Col3] */}
        <div className="flex-1 grid grid-cols-[215px_minmax(120px,1fr)_310px_minmax(130px,1fr)_245px] items-center relative z-20">
          {/* COLUMN 1: USER */}
          <div className="flex flex-col justify-center">
            <div
              onMouseEnter={(e) =>
                handleNodeEnter('wallet', 'FREIGHTER / GEMWALLET', 'Non-custodial 1-Click Soroban XDR Auth', e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('wallet', 'cyan')} p-4`}
            >
              <span data-port="p-wallet-1" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-sky-400 -right-1 top-[18%] z-30" />
              <span data-port="p-wallet-2" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-emerald-400 -right-1 top-[44%] z-30" />
              <span data-port="p-wallet-3" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-amber-400 -right-1 top-[66%] z-30" />
              <span data-port="p-wallet-4" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-cyan-400 -right-1 top-[86%] z-30" />

              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                  <Lock className="w-2.5 h-2.5" />
                  XDR
                </span>
              </div>

              <div className="text-sm font-bold text-white leading-tight">Freighter / Gem</div>
              <p className="text-[11px] text-slate-400 mt-0.5">1-Click Wallet Sign</p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  XLM
                </span>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  $NXL
                </span>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  XRP
                </span>
              </div>
            </div>
          </div>

          {/* WIRE CHANNEL 1 SPACER */}
          <div aria-hidden="true" />

          {/* COLUMN 2: SOROBAN CONTRACTS */}
          <div className="flex flex-col justify-between h-full py-1">
            {/* Top: NexusVault v2.0 */}
            <a
              href={CONTRACTS.vault.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) =>
                handleNodeEnter('vault', `NEXUSVAULT · ${CONTRACTS.vault.short}`, 'Order fee split · Mint/Burn Cap', e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('vault', 'gold')} p-3.5 block`}
            >
              <span data-port="p-vault-l" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-sky-400 -left-1 top-1/2 -translate-y-1/2 z-30" />
              <span data-port="p-vault-rt" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-amber-400 -right-1 top-[30%] z-30" />
              <span data-port="p-vault-rb" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-sky-400 -right-1 top-[72%] z-30" />
              <span data-port="p-vault-b" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-emerald-400 left-1/2 -bottom-1 -translate-x-1/2 z-30" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                      <span>NexusVault v2.0</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        VAULT
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-300 bg-slate-800/90 border border-slate-700/70">
                        <Code2 className="w-2.5 h-2.5 text-amber-400" />
                        settle_order
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{CONTRACTS.vault.short}</span>
              </div>
            </a>

            {/* Middle: $NXL Ledger (Built-in SAC) */}
            <a
              href={CONTRACTS.nxlSac.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) =>
                handleNodeEnter('token', `$NXL SAC · ${CONTRACTS.nxlSac.short}`, 'SEP-41 Token Ledger · Hard Supply Cap', e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('token', 'emerald')} p-3.5 block`}
            >
              <span data-port="p-token-l" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-emerald-400 -left-1 top-1/2 -translate-y-1/2 z-30" />
              <span data-port="p-token-t" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-emerald-400 left-1/2 -top-1 -translate-x-1/2 z-30" />
              <span data-port="p-token-b" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-emerald-400 left-1/2 -bottom-1 -translate-x-1/2 z-30" />
              <span data-port="p-token-r" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-rose-400 -right-1 top-1/2 -translate-y-1/2 z-30" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                      <span>$NXL Ledger</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        SAC · CAPPED SUPPLY
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{CONTRACTS.nxlSac.short}</span>
              </div>
            </a>

            {/* Bottom: NexusSwap v2.0 */}
            <a
              href={CONTRACTS.swap.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) =>
                handleNodeEnter('swap', `NEXUSSWAP · ${CONTRACTS.swap.short}`, `x·y=k (${poolDisplay}) + timed escrow`, e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('swap', 'cyan')} p-3.5 block`}
            >
              <span data-port="p-swap-lt" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-amber-400 -left-1 top-[28%] z-30" />
              <span data-port="p-swap-lb" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-cyan-400 -left-1 top-[74%] z-30" />
              <span data-port="p-swap-t" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-emerald-400 left-1/2 -top-1 -translate-x-1/2 z-30" />
              <span data-port="p-swap-rt" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-amber-400 -right-1 top-[30%] z-30" />
              <span data-port="p-swap-rb" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-indigo-400 -right-1 top-[72%] z-30" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                      <span>NexusSwap v2.0</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        AMM · {poolStats.reserveXlm > 0 || poolStats.reserveNxl > 0
                          ? `${Math.round(poolStats.reserveXlm / 1000)}K:${Math.round(poolStats.reserveNxl / 1000)}K`
                          : 'LIVE POOL'}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{CONTRACTS.swap.short}</span>
              </div>
            </a>
          </div>

          {/* WIRE CHANNEL 2 SPACER */}
          <div aria-hidden="true" />

          {/* COLUMN 3: DESTINATIONS */}
          <div className="flex flex-col justify-between h-full py-1">
            {/* Dest 1: Treasury */}
            <div
              onMouseEnter={(e) =>
                handleNodeEnter('treasury', 'OWNER TREASURY', 'Order settlement split + AMM swap fee', e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('treasury', 'gold')} px-3.5 py-3 flex items-center justify-between gap-2`}
            >
              <span data-port="p-treasury-t" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-amber-400 -left-1 top-[30%] z-30" />
              <span data-port="p-treasury-b" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-amber-400 -left-1 top-[72%] z-30" />

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Crown className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-white">Treasury</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
                SETTLEMENT + AMM
              </span>
            </div>

            {/* Dest 2: Buyback Pool */}
            <div
              onMouseEnter={(e) =>
                handleNodeEnter('buyback', 'BUYBACK RESERVE', '0.5% Checkout Fee → $NXL Liquidity Backing', e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('buyback', 'cyan')} px-3.5 py-3 flex items-center justify-between gap-2`}
            >
              <span data-port="p-buyback" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-sky-400 -left-1 top-1/2 -translate-y-1/2 z-30" />

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-white">Buyback Pool</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/25">
                0.5% Fee
              </span>
            </div>

            {/* Dest 3: Burned */}
            <div
              onMouseEnter={(e) =>
                handleNodeEnter('burn', 'DEFLATIONARY BURN', 'SEP-41 SAC::burn Permanent Supply Reduction', e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('burn', 'rose')} px-3.5 py-3 flex items-center justify-between gap-2`}
            >
              <span data-port="p-burn" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-rose-400 -left-1 top-1/2 -translate-y-1/2 z-30" />

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-white">Burned</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/25">
                −$NXL
              </span>
            </div>

            {/* Dest 4: XRPL Wallet */}
            <div
              onMouseEnter={(e) =>
                handleNodeEnter('xrpl', 'XRPL TESTNET LEDGER', 'Atomic XRP settlement · self-refund escrow', e)
              }
              onMouseMove={handleNodeMove}
              onMouseLeave={handleNodeLeave}
              className={`${getNodeClasses('xrpl', 'indigo')} px-3.5 py-3 flex items-center justify-between gap-2`}
            >
              <span data-port="p-xrpl" className="w-[8px] h-[8px] rounded-full absolute bg-[#07090E] border-2 border-indigo-400 -left-1 top-1/2 -translate-y-1/2 z-30" />

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-white">XRPL Wallet</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/25">
                XRP · TIMED LOCK
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MOBILE & COMPACT TABLET VERTICAL ANIMATED FLOW (< lg)
         ===================================================================== */}
      <div
        className="lg:hidden px-4 py-5 space-y-3"
        style={{
          backgroundColor: '#07090E',
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {MOBILE_STEPS[activeFlow].map((step, i) => (
          <div
            key={`${activeFlow}-${i}`}
            className="rounded-xl border border-slate-800/90 bg-[#0D1320]/90 p-3.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-white">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white ring-4 ring-sky-400/30 animate-pulse" />
                {step.from}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${step.badgeColor}`}>
                {step.badge}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-1 text-sky-400">
              <ArrowDown className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-semibold text-slate-200">{step.to}</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 pl-5">{step.note}</p>
          </div>
        ))}
      </div>

      {/* LIVE STATUS & CONTRACT LINKS FOOTER */}
      <div className="px-4 py-3 sm:px-6 border-t border-slate-800/80 bg-[#07090E]/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
          {FLOW_CAPTIONS[activeFlow]}
        </p>
        <div className="flex flex-wrap items-center gap-3 shrink-0 text-[11px] font-mono">
          <span className="text-emerald-300 font-semibold">{poolDisplay}</span>
          <Link
            href="/swap"
            className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold transition-colors"
          >
            <span>Try Live</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* FLOATING MICRO HOVER TOOLTIP */}
      {tooltip.visible && (
        <div
          className="fixed pointer-events-none z-50 rounded-lg px-2.5 py-1.5 text-[11px] font-mono bg-[#090D18]/95 backdrop-blur-md border border-sky-400/40 shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
          style={{
            left: `${Math.min(tooltip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240)}px`,
            top: `${Math.min(tooltip.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 64)}px`,
          }}
        >
          <div className="font-bold text-sky-300">{tooltip.addr}</div>
          <div className="text-slate-300 text-[11px] mt-0.5">{tooltip.formula}</div>
        </div>
      )}
    </div>
  );
}
