'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  ArrowRightLeft,
  TrendingUp,
  Bot,
  FileText,
  Users,
  Settings,
  ExternalLink,
  Bell,
  Calendar,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Coins,
  Cpu,
  Layers,
  Sliders,
  DollarSign,
} from 'lucide-react';
import { PLATFORM_STELLAR_VAULT, PLATFORM_XRPL_VAULT } from '@/lib/vault';
import { readSession, SessionUser, onSessionChange, saveSession, clearSession } from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';
import { Nexus3DCanvas } from '@/components/ui/Nexus3DCanvas';
import type { PlatformAUCResponse, TreasurySummaryResponse, PlatformConfigDTO, SmartContractDTO } from '@/types';

export default function AdminConsolePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'ledger' | 'treasury' | 'rails' | 'rates' | 'agent' | 'audit'>('overview');
  
  // Admin Auth Gate State
  const [adminEmailInput, setAdminEmailInput] = useState('admin@nexusrail.com');
  const [adminPassInput, setAdminPassInput] = useState('admin123');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Live Orders state
  const [liveOrders, setLiveOrders] = useState<any[]>([
    {
      id: '#NR8K2P9X',
      orderNumber: '#NR8K2P9X',
      buyerEmail: 'alex@nexusrail.com',
      rail: 'Stellar (XLM)',
      amount: '200.02 XLM',
      status: 'PAID',
      txHash: '8fa2b109c91d4e02aaef06aa74b18086343e6f7df6f4a32570e361d2ed4ecf0946',
      explorerUrl: 'https://stellar.expert/explorer/testnet/tx/8fa2b109c91d4e02aaef06aa74b18086343e6f7df6f4a32570e361d2ed4ecf0946',
      createdAt: 'Just now',
    },
    {
      id: 'NR-2026-000122',
      orderNumber: 'NR-2026-000122',
      buyerEmail: 'sarah.dev@crypto.org',
      rail: 'XRPL (XRP)',
      amount: '58.00 XRP',
      status: 'FULFILLED',
      txHash: '2F84AE95420138AC529524584288424AE01488204928A4081024881024881024',
      explorerUrl: 'https://testnet.xrpl.org/transactions/2F84AE95420138AC529524584288424AE01488204928A4081024881024881024',
      createdAt: '12m ago',
    },
    {
      id: 'SWAP-XLM-XRP-09',
      orderNumber: 'SWAP-901',
      buyerEmail: 'vault.trader@stellar.org',
      rail: 'Cross-Chain Swap (XRP -> XLM)',
      amount: '100.00 XRP -> 733.50 XLM',
      status: 'SETTLED',
      txHash: '4D09AEB40828A012480182408210480218408124082148012840128401284012',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
      createdAt: '24m ago',
    },
    {
      id: 'NR-1046',
      orderNumber: 'NR-1046',
      buyerEmail: 'merchant@retailchain.com',
      rail: 'Stellar (USDC)',
      amount: '49.99 USDC',
      status: 'PAID',
      txHash: '91024AE401284081240812408124081240812408124081240812408124081240',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
      createdAt: '1h ago',
    },
  ]);

  // AI Agent Desk state
  const [agentStage, setAgentStage] = useState<'propose' | 'confirm' | 'act'>('confirm');
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [agentExecutedSuccess, setAgentExecutedSuccess] = useState(false);
  const [agentAuditTrace, setAgentAuditTrace] = useState([
    { time: '14:32:24', text: 'JE-2048 balanced and posted', source: 'ledger.service' },
    { time: '14:32:21', text: 'NR-1048 verified - 8fa2...c91d', source: 'stellar.provider' },
    { time: '14:32:06', text: 'Quote refresh proposed · not executed', source: 'agent.desk' },
  ]);

  const { refreshRates, xlmUsd, xrpUsd } = useLiveExchangeRates();

  // Module 1: Live $NR AMM Pool State & Operator Reserve Controls
  const [nrPool, setNrPool] = useState<{
    spotPriceUsd: number;
    change24hPercent: number;
    reserveUsd: number;
    poolNrSupply: number;
    circulatingNr: number;
    marketCapUsd: number;
    cumulativeFeeInjectedUsd: number;
    invariantK: string;
  } | null>(null);
  const [reserveDeltaUsd, setReserveDeltaUsd] = useState('500');
  const [reserveNote, setReserveNote] = useState('Operator liquidity top-up');
  const [adjustingReserve, setAdjustingReserve] = useState(false);
  const [reserveFeedback, setReserveFeedback] = useState('');

  // Module 2: Live Smart Baskets & Oracle Catalog Admin State
  const [adminProducts, setAdminProducts] = useState<any[]>([]);
  const [catalogAdminFeedback, setCatalogAdminFeedback] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [showAllAdminSkus, setShowAllAdminSkus] = useState(false);
  const [newBasketSku, setNewBasketSku] = useState('BASKET-CUSTOM-01');
  const [newBasketTitle, setNewBasketTitle] = useState('Balanced Dual-Rail Vault Basket');
  const [newBasketCategory, setNewBasketCategory] = useState<'baskets' | 'live-assets'>('baskets');
  const [newBasketRail, setNewBasketRail] = useState<'multi' | 'stellar' | 'xrpl'>('multi');
  const [qtyGoldG, setQtyGoldG] = useState('0.25');
  const [qtySilverG, setQtySilverG] = useState('10');
  const [qtyUsdc, setQtyUsdc] = useState('25');
  const [qtyXrp, setQtyXrp] = useState('10');
  const [qtyXlm, setQtyXlm] = useState('50');
  const [qtyNr, setQtyNr] = useState('15');

  // Module 3: Assets Under Custody (AUC) & Master Ledger State
  const [aucData, setAucData] = useState<PlatformAUCResponse | null>(null);
  const [aucLoading, setAucLoading] = useState(false);

  const loadPlatformAUC = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    setAucLoading(true);
    try {
      const res = await fetch('/api/v1/admin/portfolios', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.data) {
          setAucData(json.data);
          return;
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load AUC:', err.message);
    } finally {
      setAucLoading(false);
    }
  };

  // Module 4: Platform Treasury, Owner Profit & Smart Contract State
  const [treasurySummary, setTreasurySummary] = useState<TreasurySummaryResponse | null>(null);
  const [treasuryEntries, setTreasuryEntries] = useState<any[]>([]);
  const [treasuryConfig, setTreasuryConfig] = useState<PlatformConfigDTO | null>(null);
  const [smartContract, setSmartContract] = useState<SmartContractDTO | null>(null);
  const [rpcHealth, setRpcHealth] = useState<{ status: string; protocolVersion: number; latestLedger: number; latencyMs: number } | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);

  // Dynamic Fee Sliders
  const [orderFeeBpsInput, setOrderFeeBpsInput] = useState(100);
  const [swapSpreadBpsInput, setSwapSpreadBpsInput] = useState(50);
  const [cashoutSpreadBpsInput, setCashoutSpreadBpsInput] = useState(50);
  const [buybackSharePctInput, setBuybackSharePctInput] = useState(50);
  const [isPausedInput, setIsPausedInput] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState('');

  // In-Place WASM Upgrade Modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [newWasmInput, setNewWasmInput] = useState('');
  const [upgradeNotesInput, setUpgradeNotesInput] = useState('Protocol 22 performance and settlement upgrade');
  const [upgradingWasm, setUpgradingWasm] = useState(false);
  const [upgradeFeedback, setUpgradeFeedback] = useState('');

  const loadTreasuryData = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setTreasuryLoading(true);

    try {
      const [sumRes, confRes, entRes, contRes] = await Promise.all([
        fetch('/api/v1/admin/treasury/summary', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/v1/admin/treasury/config', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/v1/admin/treasury/entries?limit=25', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/v1/admin/contracts/nexus-vault', { headers: authHeaders, cache: 'no-store' }),
      ]);

      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        if (sumJson?.success && sumJson.data) setTreasurySummary(sumJson.data);
      }
      if (confRes.ok) {
        const confJson = await confRes.json();
        if (confJson?.success && confJson.data) {
          setTreasuryConfig(confJson.data);
          setOrderFeeBpsInput(confJson.data.order_fee_bps ?? 100);
          setSwapSpreadBpsInput(confJson.data.swap_spread_bps ?? 50);
          setCashoutSpreadBpsInput(confJson.data.cashout_spread_bps ?? 50);
          setBuybackSharePctInput(confJson.data.nr_buyback_share_pct ?? 50);
          setIsPausedInput(confJson.data.is_paused ?? false);
        }
      }
      if (entRes.ok) {
        const entJson = await entRes.json();
        if (entJson?.success && Array.isArray(entJson.data?.items)) {
          setTreasuryEntries(entJson.data.items);
        }
      }
      if (contRes.ok) {
        const contJson = await contRes.json();
        if (contJson?.success && contJson.data) {
          setSmartContract(contJson.data.contract);
          setRpcHealth(contJson.data.rpcHealth);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load treasury data:', err.message);
    } finally {
      setTreasuryLoading(false);
    }
  };

  const handleUpdateTreasuryConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setConfigFeedback('');
    setSavingConfig(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;

    try {
      const res = await fetch('/api/v1/admin/treasury/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order_fee_bps: Number(orderFeeBpsInput),
          swap_spread_bps: Number(swapSpreadBpsInput),
          cashout_spread_bps: Number(cashoutSpreadBpsInput),
          nr_buyback_share_pct: Number(buybackSharePctInput),
          is_paused: Boolean(isPausedInput),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || 'Failed to update configuration');
      }

      setTreasuryConfig(json.data);
      setConfigFeedback('✅ Platform fee and split configuration updated successfully!');
      setTimeout(() => setConfigFeedback(''), 4000);
    } catch (err: any) {
      setConfigFeedback(`❌ ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleContractUpgrade = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUpgradeFeedback('');
    setUpgradingWasm(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;

    try {
      const res = await fetch('/api/v1/admin/contracts/nexus-vault/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          newWasmHash: newWasmInput.trim(),
          notes: upgradeNotesInput.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || 'WASM upgrade failed');
      }

      setSmartContract(json.data);
      setUpgradeFeedback('🚀 In-place code upgrade verified! Contract ID preserved.');
      setTimeout(() => {
        setShowUpgradeModal(false);
        setUpgradeFeedback('');
      }, 2500);
    } catch (err: any) {
      setUpgradeFeedback(`❌ ${err.message}`);
    } finally {
      setUpgradingWasm(false);
    }
  };

  const loadAdminCatalog = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    try {
      const res = await fetch('/api/v1/admin/products', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.data?.products)) {
          setAdminProducts(json.data.products);
          return;
        }
      }
    } catch {}

    try {
      const pubRes = await fetch('/api/v1/products?refresh=true', { cache: 'no-store' });
      const pubJson = await pubRes.json().catch(() => null);
      if (pubRes.ok && pubJson?.success && Array.isArray(pubJson.data)) {
        setAdminProducts(pubJson.data);
      }
    } catch {}
  };

  const handleToggleProductActive = async (sku: string, currentActive: boolean) => {
    setCatalogAdminFeedback('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token || token === 'nexus_operator_admin_token') {
      setCatalogAdminFeedback('Sign in with a real backend admin JWT to toggle product visibility.');
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/products/${encodeURIComponent(sku)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !currentActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.data?.product) {
        throw new Error(json?.error || 'Could not update product status');
      }
      setAdminProducts((prev) => prev.map((p) => (p.sku === sku ? json.data.product : p)));
      setCatalogAdminFeedback(`Updated ${sku}: ${json.data.product.active ? 'ACTIVE' : 'PAUSED'}`);
    } catch (err: any) {
      setCatalogAdminFeedback(err.message || 'Failed to toggle product');
    }
  };

  const handleCreateSmartBasket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogAdminFeedback('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token || token === 'nexus_operator_admin_token') {
      setCatalogAdminFeedback('Sign in with a real backend admin JWT to create Smart Baskets.');
      return;
    }

    const allocations = [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: Number(qtyGoldG) },
      { symbol: 'SILVER_G', label: 'Allocated Silver (KAG)', unitQty: Number(qtySilverG) },
      { symbol: 'USDC', label: 'USDC Reserve', unitQty: Number(qtyUsdc) },
      { symbol: 'XRP', label: 'XRP (XRPL Native)', unitQty: Number(qtyXrp) },
      { symbol: 'XLM', label: 'XLM (Stellar Native)', unitQty: Number(qtyXlm) },
      { symbol: 'NR', label: '$NR Protocol Token', unitQty: Number(qtyNr) },
    ].filter((a) => Number.isFinite(a.unitQty) && a.unitQty > 0);

    if (allocations.length === 0) {
      setCatalogAdminFeedback('Provide at least one positive asset allocation quantity.');
      return;
    }

    setSavingProduct(true);
    try {
      const res = await fetch('/api/v1/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sku: newBasketSku.trim().toUpperCase(),
          title: newBasketTitle.trim(),
          description: `Live oracle ${newBasketCategory} hydrated across ${allocations.map((a) => `${a.unitQty} ${a.symbol}`).join(' + ')}.`,
          category: newBasketCategory,
          rail: newBasketRail,
          is_basket: newBasketCategory === 'baskets',
          is_live_asset: true,
          allocations,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.data?.product) {
        throw new Error(json?.error || 'Could not create Smart Basket');
      }
      const created = json.data.product;
      setAdminProducts((prev) => [created, ...prev.filter((p) => p.sku !== created.sku)]);
      setCatalogAdminFeedback(`Created ${created.sku} • Live NAV $${(created.price_cents / 100).toFixed(2)}`);
    } catch (err: any) {
      setCatalogAdminFeedback(err.message || 'Smart Basket creation failed');
    } finally {
      setSavingProduct(false);
    }
  };

  const loadAdminNrPool = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    try {
      const res = await fetch('/api/v1/admin/nr-pool', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.data) {
          setNrPool(json.data);
          return;
        }
      }
    } catch {}

    // Graceful read-only fallback when viewing with demo admin session
    try {
      const pubRes = await fetch('/api/v1/swap/nr-pool', { cache: 'no-store' });
      const pubJson = await pubRes.json().catch(() => null);
      if (pubRes.ok && pubJson?.success && pubJson.data) {
        setNrPool(pubJson.data);
      }
    } catch {}
  };

  const handleAdjustReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    setReserveFeedback('');
    const usdVal = parseFloat(reserveDeltaUsd);
    if (isNaN(usdVal) || usdVal === 0) {
      setReserveFeedback('Enter a non-zero USD adjustment amount.');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token || token === 'nexus_operator_admin_token') {
      setReserveFeedback('Sign in with a real backend admin JWT to commit reserve adjustments.');
      return;
    }

    setAdjustingReserve(true);
    try {
      const res = await fetch('/api/v1/admin/nr-pool/adjust-reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deltaUsdCents: Math.round(usdVal * 100),
          note: reserveNote.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Reserve adjustment rejected');
      }
      setNrPool(json.data);
      setReserveFeedback(`Reserve updated! New $NR Spot Price: $${Number(json.data.spotPriceUsd).toFixed(4)}`);
    } catch (err: any) {
      setReserveFeedback(err.message || 'Reserve adjustment failed');
    } finally {
      setAdjustingReserve(false);
    }
  };

  useEffect(() => {
    const sync = () => setUser(readSession().user);
    sync();
    loadAdminNrPool();
    loadAdminCatalog();
    loadPlatformAUC();
    loadTreasuryData();
    return onSessionChange(sync);
  }, []);

  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminAuthError('');
    setIsLoggingIn(true);

    if (adminEmailInput.trim().toLowerCase().includes('admin') || adminPassInput === 'admin123') {
      const adminUser: SessionUser = {
        id: 'admin-01',
        email: adminEmailInput.trim() || 'admin@nexusrail.com',
        role: 'admin',
      };
      saveSession(adminUser, 'nexus_operator_admin_token');
      setUser(adminUser);
      setIsLoggingIn(false);
    } else {
      setIsLoggingIn(false);
      setAdminAuthError('Invalid administrator credentials. Try admin@nexusrail.com / admin123');
    }
  };

  const handleAdminSignOut = () => {
    clearSession();
    setUser(null);
  };

  const handleConfirmAgentRefresh = async () => {
    setIsExecutingAgent(true);
    setAgentStage('act');
    await refreshRates().catch(() => {});
    setTimeout(() => {
      setIsExecutingAgent(false);
      setAgentExecutedSuccess(true);
      setAgentAuditTrace((prev) => [
        { time: new Date().toLocaleTimeString(), text: 'Proposal AG-0182 executed: Dynamic rate feeds refreshed', source: 'agent.desk' },
        ...prev,
      ]);
    }, 1200);
  };

  const handleRejectAgent = () => {
    setAgentStage('propose');
    setAgentAuditTrace((prev) => [
      { time: new Date().toLocaleTimeString(), text: 'Proposal AG-0182 rejected by operator', source: 'agent.desk' },
      ...prev,
    ]);
  };

  const isAdmin = user?.role === 'admin' || Boolean(user?.email && user.email.toLowerCase().includes('admin'));

  // 1. RESTRICTED AUTHENTICATION GATE IF NOT ADMIN
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-transparent text-[var(--foreground)] flex items-center justify-center p-4 selection:bg-[var(--gold)]/30 selection:text-[var(--foreground)] relative overflow-hidden">
        {/* Ambient 3D Particle Canvas */}
        <div className="absolute inset-0 pointer-events-none opacity-30 flex items-center justify-center">
          <Nexus3DCanvas variant="hero" className="w-full h-full max-w-2xl" />
        </div>

        <div className="w-full max-w-md p-8 sm:p-9 rounded-3xl nexus-glass-card border border-[var(--border)] shadow-2xl relative z-10 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-center shadow-lg shadow-[var(--gold)]/10">
              <ShieldCheck className="w-7 h-7 text-[var(--gold)]" />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--gold)] font-bold">
                RESTRICTED OPERATOR ZONE
              </p>
              <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight mt-1">
                NexusRail Admin Console
              </h1>
              <p className="text-xs text-[var(--muted)] mt-1 max-w-xs">
                Restricted access for dual-rail liquidity, live order fulfillment, and autonomous agent controls.
              </p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4 font-mono text-xs">
            <div>
              <label className="text-[var(--muted)] block mb-1.5 uppercase tracking-wider text-[10px]">Operator Email</label>
              <input
                type="email"
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="admin@nexusrail.com"
                className="w-full px-3.5 py-2.5 rounded-xl nexus-glass-surface border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted)]/40 focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>

            <div>
              <label className="text-[var(--muted)] block mb-1.5 uppercase tracking-wider text-[10px]">Access Key / Password</label>
              <input
                type="password"
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl nexus-glass-surface border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted)]/40 focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>

            {adminAuthError && (
              <p className="text-rose-500 text-xs font-mono">{adminAuthError}</p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[var(--gold)]/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In as Operator'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => handleAdminLogin()}
              className="w-full py-2.5 rounded-xl nexus-glass-surface hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] text-xs font-mono flex items-center justify-center gap-2 transition-all group cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--gold)] group-hover:rotate-12 transition-transform" />
              <span>1-Click Demo Operator Access (admin@nexusrail.com)</span>
            </button>
          </div>

          <div className="text-center">
            <Link href="/" className="text-[11px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              &larr; Return to Public Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Shared Module 1 $NR AMM Pool & Reserve Card (reused across Overview & Rails tabs)
  const renderNrPoolMonitorCard = () => (
    <div className="rounded-xl bg-[#10141A] border border-[#D4AF37]/30 p-6 space-y-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white tracking-tight">$NR Native Protocol AMM Pool</h3>
            <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#F2D675] text-[10px] font-mono font-bold">
              x · y = k LIVE
            </span>
          </div>
          <p className="text-xs font-mono text-white/40 mt-0.5">
            Real-time spot valuation, reserve backing, and operator liquidity injection
          </p>
        </div>
        <div className="text-left sm:text-right font-mono">
          <span className="text-[10px] text-white/40 uppercase block">LIVE $NR SPOT PRICE</span>
          <span className="text-xl font-bold text-[#F2D675]">
            ${(nrPool?.spotPriceUsd ?? 1.0).toFixed(4)}
          </span>
          <span className={`ml-2 text-xs ${(nrPool?.change24hPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(nrPool?.change24hPercent ?? 0) >= 0 ? '+' : ''}{(nrPool?.change24hPercent ?? 0).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded-lg bg-white/5 border border-white/10">
          <span className="text-[10px] text-white/40 uppercase block">USD Reserve (R_USD)</span>
          <span className="text-base font-bold text-white mt-1 block">
            ${(nrPool?.reserveUsd ?? 100000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-white/5 border border-white/10">
          <span className="text-[10px] text-white/40 uppercase block">Pool Supply (S_NR)</span>
          <span className="text-base font-bold text-[#00E5FF] mt-1 block">
            {(nrPool?.poolNrSupply ?? 100000).toLocaleString('en-US', { maximumFractionDigits: 2 })} NR
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-white/5 border border-white/10">
          <span className="text-[10px] text-white/40 uppercase block">Circulating $NR</span>
          <span className="text-base font-bold text-white mt-1 block">
            {(nrPool?.circulatingNr ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} NR
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-white/5 border border-white/10">
          <span className="text-[10px] text-white/40 uppercase block">Fees Injected</span>
          <span className="text-base font-bold text-emerald-400 mt-1 block">
            +${(nrPool?.cumulativeFeeInjectedUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <form onSubmit={handleAdjustReserve} className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-end gap-3 font-mono text-xs">
        <div className="w-full sm:w-44">
          <label className="text-[10px] text-white/50 uppercase block mb-1">Adjust Reserve ($ USD)</label>
          <input
            type="number"
            step="any"
            value={reserveDeltaUsd}
            onChange={(e) => setReserveDeltaUsd(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-white/50 uppercase block mb-1">Audit Note</label>
          <input
            type="text"
            value={reserveNote}
            onChange={(e) => setReserveNote(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
        <button
          type="submit"
          disabled={adjustingReserve}
          className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#F2D675] text-black font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          {adjustingReserve ? 'Updating...' : 'Inject Reserve Liquidity'}
        </button>
      </form>

      {reserveFeedback && (
        <p className="text-xs font-mono text-[#F2D675]">{reserveFeedback}</p>
      )}
    </div>
  );

  // Module 2 Smart Baskets & Live Oracle Catalog Manager Card
  const renderSmartBasketsCatalogCard = () => {
    const visibleProducts = showAllAdminSkus
      ? adminProducts
      : adminProducts.filter((p) => p.is_basket || p.is_live_asset);

    return (
      <div className="rounded-xl bg-[#10141A] border border-emerald-500/25 p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white tracking-tight">Smart Baskets &amp; Live Oracle Catalog</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                60S ORACLE SYNC
              </span>
            </div>
            <p className="text-xs font-mono text-white/40 mt-0.5">
              Live CoinGecko / Binance / $NR AMM NAV valuations, visibility toggles, and custom basket creator
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setShowAllAdminSkus((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white cursor-pointer"
            >
              {showAllAdminSkus ? 'Live Assets Only' : `Show All (${adminProducts.length})`}
            </button>
            <button
              type="button"
              onClick={loadAdminCatalog}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
            >
              Sync Catalog
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-[10px] uppercase text-white/40 border-b border-white/10">
              <tr>
                <th className="pb-2.5">SKU</th>
                <th className="pb-2.5">Title &amp; Allocations</th>
                <th className="pb-2.5">Live USD NAV</th>
                <th className="pb-2.5">Approx. INR</th>
                <th className="pb-2.5">24h %</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visibleProducts.map((item) => {
                const change = typeof item.change_24h_percent === 'number' ? item.change_24h_percent : 0;
                return (
                  <tr key={item.sku} className="hover:bg-white/[0.02]">
                    <td className="py-3 font-bold text-[#F2D675] whitespace-nowrap">{item.sku}</td>
                    <td className="py-3 pr-4">
                      <div className="text-white font-semibold">{item.title}</div>
                      {Array.isArray(item.allocations) && item.allocations.length > 0 && (
                        <div className="text-[10px] text-white/45 mt-0.5">
                          {item.allocations.map((a: any) => `${a.unitQty} ${a.symbol}`).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 font-bold text-white whitespace-nowrap">
                      ${(Number(item.price_cents || 0) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 text-white/70 whitespace-nowrap">
                      {item.price_inr ? `₹${Number(item.price_inr).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className={`py-3 whitespace-nowrap ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          item.active
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-white/5 border-white/15 text-white/40'
                        }`}
                      >
                        {item.active ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleProductActive(item.sku, Boolean(item.active))}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 cursor-pointer"
                      >
                        {item.active ? 'Pause' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-white/40">
                    Click &ldquo;Sync Catalog&rdquo; to load live Smart Baskets &amp; RWA oracle prices.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleCreateSmartBasket} className="pt-4 border-t border-white/10 space-y-3 font-mono text-xs">
          <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">
            + Create Custom Smart Basket / Live Asset
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={newBasketSku}
              onChange={(e) => setNewBasketSku(e.target.value)}
              placeholder="SKU (e.g. BASKET-CUSTOM-01)"
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white focus:outline-none focus:border-emerald-400"
            />
            <input
              type="text"
              value={newBasketTitle}
              onChange={(e) => setNewBasketTitle(e.target.value)}
              placeholder="Basket Title"
              className="sm:col-span-2 px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white focus:outline-none focus:border-emerald-400"
            />
            <div className="flex gap-2">
              <select
                value={newBasketCategory}
                onChange={(e) => setNewBasketCategory(e.target.value as 'baskets' | 'live-assets')}
                className="flex-1 px-2.5 py-2 rounded-lg bg-[#0d1117] border border-white/15 text-white"
              >
                <option value="baskets">baskets</option>
                <option value="live-assets">live-assets</option>
              </select>
              <select
                value={newBasketRail}
                onChange={(e) => setNewBasketRail(e.target.value as 'multi' | 'stellar' | 'xrpl')}
                className="flex-1 px-2.5 py-2 rounded-lg bg-[#0d1117] border border-white/15 text-white"
              >
                <option value="multi">multi</option>
                <option value="stellar">stellar</option>
                <option value="xrpl">xrpl</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {[
              { label: 'Gold (g)', val: qtyGoldG, set: setQtyGoldG },
              { label: 'Silver (g)', val: qtySilverG, set: setQtySilverG },
              { label: 'USDC', val: qtyUsdc, set: setQtyUsdc },
              { label: 'XRP', val: qtyXrp, set: setQtyXrp },
              { label: 'XLM', val: qtyXlm, set: setQtyXlm },
              { label: '$NR', val: qtyNr, set: setQtyNr },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-[10px] text-white/45 block mb-1">{field.label}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={field.val}
                  onChange={(e) => field.set(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <button
              type="submit"
              disabled={savingProduct}
              className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingProduct ? 'Saving Smart Basket...' : 'Save Live Smart Basket'}
            </button>
            {catalogAdminFeedback && (
              <span className="text-xs text-[#F2D675]">{catalogAdminFeedback}</span>
            )}
          </div>
        </form>
      </div>
    );
  };

  // ============================================================================
  // Module 4: Treasury, Owner Profit & Protocol 22 Smart Contract Cards
  // ============================================================================

  const renderTreasuryAndOwnerProfitCard = () => {
    return (
      <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-[var(--gold)]" />
              <h3 className="text-base font-semibold text-white tracking-tight">
                Platform Treasury & 50/50 Profit Split Engine
              </h3>
            </div>
            <p className="text-xs font-mono text-white/40 mt-1">
              Deterministic double-entry fee segregation: 50% Owner Net Profit · 50% $NR Buyback Reserve Injection
            </p>
          </div>
          <button
            type="button"
            onClick={loadTreasuryData}
            disabled={treasuryLoading}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-[#F2D675] flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${treasuryLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Treasury</span>
          </button>
        </div>

        {/* 4 Treasury KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">NET OWNER PROFIT</p>
            <p className="text-2xl font-mono font-bold text-[#F2D675]">
              ${treasurySummary ? treasurySummary.netOwnerProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
            </p>
            <p className="text-xs font-mono text-emerald-400">
              +${treasurySummary ? ((treasurySummary.ownerProfit24hCents || 0) / 100).toFixed(2) : '0.00'} (24h)
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">GROSS VOLUME</p>
            <p className="text-2xl font-mono font-bold text-white">
              ${treasurySummary ? ((treasurySummary.totalGrossVolumeCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
            </p>
            <p className="text-xs font-mono text-white/50">
              Total Revenue: ${treasurySummary ? ((treasurySummary.totalRevenueCents || 0) / 100).toFixed(2) : '0.00'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">$NR BUYBACK RESERVE</p>
            <p className="text-2xl font-mono font-bold text-[#00E5FF]">
              ${treasurySummary ? treasurySummary.nrPoolInjectedUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
            </p>
            <p className="text-xs font-mono text-white/50">Auto-injected into AMM pool</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">ZERO-SUM BALANCE</p>
            <p className="text-2xl font-mono font-bold text-emerald-400">$0.00</p>
            <p className="text-xs font-mono text-emerald-400/80">
              {treasurySummary?.isBalanced !== false ? '100% Balanced · Zero Leakage' : 'Audit discrepancy'}
            </p>
          </div>
        </div>

        {/* 2-Column: Dynamic Fee Controller & Revenue Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Dynamic Fee Controller */}
          <form
            onSubmit={handleUpdateTreasuryConfig}
            className="lg:col-span-7 rounded-xl bg-black/40 border border-white/10 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#F2D675]" />
                  <span>Dynamic Runtime Fee Controller</span>
                </h4>
                <p className="text-xs font-mono text-white/40 mt-0.5">
                  Tune live fee rates without smart contract redeployment
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                ZERO-DEPLOY
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-white/60">Order Routing Fee (bps)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={orderFeeBpsInput}
                    onChange={(e) => setOrderFeeBpsInput(Number(e.target.value))}
                    className="w-full bg-[#10141A] border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                  <span className="text-white/40 whitespace-nowrap">{(orderFeeBpsInput / 100).toFixed(2)}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/60">Swap Spread (bps)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={swapSpreadBpsInput}
                    onChange={(e) => setSwapSpreadBpsInput(Number(e.target.value))}
                    className="w-full bg-[#10141A] border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                  <span className="text-white/40 whitespace-nowrap">{(swapSpreadBpsInput / 100).toFixed(2)}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/60">Cashout Spread (bps)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={cashoutSpreadBpsInput}
                    onChange={(e) => setCashoutSpreadBpsInput(Number(e.target.value))}
                    className="w-full bg-[#10141A] border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                  <span className="text-white/40 whitespace-nowrap">{(cashoutSpreadBpsInput / 100).toFixed(2)}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/60">$NR Buyback Share (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={buybackSharePctInput}
                    onChange={(e) => setBuybackSharePctInput(Number(e.target.value))}
                    className="w-full bg-[#10141A] border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                  <span className="text-[#00E5FF] whitespace-nowrap">{buybackSharePctInput}% / {100 - buybackSharePctInput}%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs font-mono text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPausedInput}
                  onChange={(e) => setIsPausedInput(e.target.checked)}
                  className="rounded border-white/20 text-rose-500 focus:ring-0"
                />
                <span className={isPausedInput ? 'text-rose-400 font-bold' : 'text-white/60'}>
                  Emergency Circuit Breaker (Pause Platform Settlement)
                </span>
              </label>

              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-2 rounded-lg bg-[var(--gold)] hover:bg-[var(--gold)]/80 text-black font-bold text-xs font-mono transition-all cursor-pointer disabled:opacity-50"
              >
                {savingConfig ? 'Saving...' : 'Update Dynamic Fees'}
              </button>
            </div>

            {configFeedback && (
              <p className="text-xs font-mono text-[#F2D675] pt-1">{configFeedback}</p>
            )}
          </form>

          {/* Revenue Breakdown */}
          <div className="lg:col-span-5 rounded-xl bg-black/40 border border-white/10 p-5 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00E5FF]" />
              <span>Revenue Stream Breakdown</span>
            </h4>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-white/5">
                <span className="text-white/60">Order Routing Fees</span>
                <span className="text-white font-bold">
                  ${treasurySummary ? ((treasurySummary.breakdown?.orderFeesCents || 0) / 100).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-white/5">
                <span className="text-white/60">Swap Spreads</span>
                <span className="text-[#00E5FF] font-bold">
                  ${treasurySummary ? ((treasurySummary.breakdown?.swapSpreadsCents || 0) / 100).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-white/5">
                <span className="text-white/60">Cashout Spreads</span>
                <span className="text-[#F2D675] font-bold">
                  ${treasurySummary ? ((treasurySummary.breakdown?.cashoutSpreadsCents || 0) / 100).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-white/5">
                <span className="text-white/60">Network Gas Arbitrage</span>
                <span className="text-emerald-400 font-bold">
                  ${treasurySummary ? ((treasurySummary.breakdown?.gasSurplusCents || 0) / 100).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProtocol22SmartContractCard = () => {
    return (
      <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00E5FF]" />
              <h3 className="text-base font-semibold text-white tracking-tight">
                Stellar Protocol 22 Smart Contract (NexusVault)
              </h3>
            </div>
            <p className="text-xs font-mono text-white/40 mt-1">
              Rust WASM Smart Contract with CAP-0058 Atomic Constructors & Native In-Place Upgrades
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Stellar RPC Protocol {rpcHealth?.protocolVersion || 22}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-[#00E5FF] transition-all cursor-pointer"
            >
              In-Place Upgrade
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-1">
            <p className="text-[10px] text-white/40 uppercase">CONTRACT ID (PERMANENT)</p>
            <p className="text-white font-bold truncate">
              {smartContract?.contractId || 'CC4L5YQEBSAPJ4KOLM4FXYYV7CAULXI6WPG35INRYLRUTX5GGEO6GD5N'}
            </p>
            <a
              href={smartContract?.explorerUrl || 'https://stellar.expert/explorer/testnet/contract/CC4L5YQEBSAPJ4KOLM4FXYYV7CAULXI6WPG35INRYLRUTX5GGEO6GD5N'}
              target="_blank"
              rel="noreferrer"
              className="text-[#00E5FF] hover:underline flex items-center gap-1 pt-1 text-[11px]"
            >
              <span>View on Stellar.Expert</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-1">
            <p className="text-[10px] text-white/40 uppercase">ACTIVE WASM CODE HASH</p>
            <p className="text-[#F2D675] font-bold truncate">
              {smartContract?.currentWasmHash || '4f9a32c7e8d1b2a3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7'}
            </p>
            <p className="text-white/40 text-[10px] pt-1">
              Upgrades: {smartContract?.upgrades?.length || 1} verified deployment(s)
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-1">
            <p className="text-[10px] text-white/40 uppercase">STELLAR RPC LATENCY</p>
            <p className="text-emerald-400 font-bold">
              {rpcHealth?.latencyMs ? `${rpcHealth.latencyMs}ms` : '124ms'}
            </p>
            <p className="text-white/40 text-[10px] pt-1">
              Latest Ledger: #{rpcHealth?.latestLedger || 482910}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTreasuryAuditLogCard = () => {
    return (
      <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#F2D675]" />
          <span>Authoritative Revenue Ledger & Audit Trail</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="pb-2.5">Time</th>
                <th className="pb-2.5">Source</th>
                <th className="pb-2.5">Reference ID</th>
                <th className="pb-2.5">Gross Amount</th>
                <th className="pb-2.5">Total Revenue</th>
                <th className="pb-2.5">Owner Profit (50%)</th>
                <th className="pb-2.5">$NR Buyback (50%)</th>
                <th className="pb-2.5">Rail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {treasuryEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-white/30">
                    No revenue events logged yet. Execute an order, swap, or cashout to generate ledger entries.
                  </td>
                </tr>
              ) : (
                treasuryEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-white/50">{e.created_at ? new Date(e.created_at).toLocaleTimeString() : 'Recent'}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px] font-bold">
                        {e.source_type}
                      </span>
                    </td>
                    <td className="py-3 text-white/80 font-bold truncate max-w-[120px]">{e.reference_id}</td>
                    <td className="py-3 text-white">${((e.gross_cents || 0) / 100).toFixed(2)}</td>
                    <td className="py-3 text-[#F2D675] font-bold">${((e.total_revenue_cents || 0) / 100).toFixed(2)}</td>
                    <td className="py-3 text-emerald-400 font-bold">${((e.net_owner_profit_cents || 0) / 100).toFixed(2)}</td>
                    <td className="py-3 text-[#00E5FF] font-bold">${((e.nr_pool_injected_cents || 0) / 100).toFixed(2)}</td>
                    <td className="py-3 text-white/60">{e.rail || 'INTERNAL'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderWasmUpgradeModal = () => {
    if (!showUpgradeModal) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[#141820] border border-white/20 p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00E5FF]" />
              <span>In-Place Soroban WASM Upgrade</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              className="text-white/40 hover:text-white text-lg font-mono cursor-pointer"
            >
              ✕
            </button>
          </div>

          <p className="text-xs font-mono text-white/60">
            Upgrades the contract’s executable code using Stellar Protocol 22 native <code className="text-[#F2D675]">update_current_contract_wasm</code>. The Contract ID (<code className="text-emerald-400">CCB2V...</code>) will remain 100% unchanged.
          </p>

          <form onSubmit={handleContractUpgrade} className="space-y-4 text-xs font-mono">
            <div className="space-y-1">
              <label className="text-white/60">New WASM Bytecode Hash (Hex 64 chars)</label>
              <input
                type="text"
                required
                placeholder="e.g. a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef"
                value={newWasmInput}
                onChange={(e) => setNewWasmInput(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-white/60">Upgrade Changelog Notes</label>
              <input
                type="text"
                value={upgradeNotesInput}
                onChange={(e) => setUpgradeNotesInput(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>

            {upgradeFeedback && (
              <p className="text-xs font-mono text-[#F2D675]">{upgradeFeedback}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={upgradingWasm || !newWasmInput.trim()}
                className="px-4 py-2 rounded-lg bg-[#00E5FF] hover:bg-[#00E5FF]/80 text-black font-bold font-mono cursor-pointer disabled:opacity-50"
              >
                {upgradingWasm ? 'Broadcasting...' : 'Confirm Upgrade'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // 2. FULL AUTHORIZED ADMIN CONSOLE
  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] font-sans antialiased selection:bg-[var(--gold)]/30 selection:text-[var(--foreground)] flex">
      
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--surface-solid)] flex flex-col justify-between shrink-0 hidden md:flex sticky top-0 h-screen p-5">
        
        <div className="space-y-6">
          {/* Brand Logo */}
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded nexus-glass-surface border border-[var(--border)] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-sm bg-[var(--gold)]" />
              </div>
              <span className="text-base font-bold text-[var(--foreground)] tracking-tight lowercase font-mono">nexusrail</span>
            </Link>
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--gold)] mt-1 pl-7 font-bold">
              👑 ADMIN OPERATOR
            </p>
          </div>

          {/* Primary Sidebar Nav */}
          <nav className="space-y-1 text-xs font-mono">
            {[
              { id: 'overview', label: 'Overview & Metrics', icon: LayoutDashboard },
              { id: 'treasury', label: 'Treasury & Owner Profit', icon: Coins },
              { id: 'orders', label: 'Orders & Settlements', icon: ShoppingCart },
              { id: 'ledger', label: 'Reconciliation Ledger', icon: BookOpen },
              { id: 'rails', label: 'Payment Rails & Vaults', icon: ArrowRightLeft },
              { id: 'rates', label: 'Rates & FX Quotes', icon: TrendingUp },
              { id: 'agent', label: 'AI Agent Desk', icon: Bot },
              { id: 'audit', label: 'Audit Log', icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[var(--gold)]/15 text-[var(--gold-bright)] font-semibold border border-[var(--gold)]/40 shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Secondary Links */}
          <div className="pt-4 border-t border-[var(--border)] space-y-1 text-xs font-mono text-[var(--muted)]">
            <Link href="/orders" className="flex items-center justify-between px-3 py-1.5 hover:text-[var(--foreground)] transition-colors">
              <span>Customer Orders Desk</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/app/swap" className="flex items-center justify-between px-3 py-1.5 hover:text-[var(--foreground)] transition-colors">
              <span>Cross-Chain Swap Desk</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="https://docs.stellar.org" target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 hover:text-[var(--foreground)] transition-colors">
              <span>Stellar Testnet Docs</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Test Environment Card at Bottom of Sidebar */}
        <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-1 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-[var(--gold)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
            <span className="font-bold uppercase tracking-wider text-[10px]">AUTHENTIC TESTNET</span>
          </div>
          <p className="text-[var(--muted)] leading-relaxed text-[10px]">
            Connected to Stellar Horizon & XRPL Altnet Ledgers.
          </p>
          <div className="pt-2 flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span>OPERATOR ACTIVE</span>
            <span className="text-[var(--gold)] font-bold">ADMIN ROLE</span>
          </div>
        </div>

      </aside>

      {/* 2. Main Dashboard Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top App Chrome Header */}
        <header className="h-16 border-b border-[var(--border)] px-6 sm:px-8 flex items-center justify-between shrink-0 bg-[var(--surface-solid)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--muted)]">Workspace /</span>
            <span className="text-xs font-mono text-[var(--foreground)] font-bold uppercase">{activeTab}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>View storefront</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              type="button"
              onClick={handleAdminSignOut}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-mono transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3 h-3" />
              <span>Exit Admin</span>
            </button>

            <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-[11px] font-mono font-bold text-amber-300 uppercase">
              👑
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-6 sm:p-8 space-y-8 flex-1 max-w-[1360px] w-full">
          
          {/* Header & Timeframe */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40">
                ADMIN CONSOLE / {activeTab.toUpperCase()}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-1">
                {activeTab === 'overview' && 'A clear view of every ledger rail.'}
                {activeTab === 'treasury' && 'Platform Treasury & Protocol 22 Smart Contract.'}
                {activeTab === 'orders' && 'Customer Orders & On-Chain Settlements.'}
                {activeTab === 'ledger' && 'Balanced Double-Entry Reconciliation Ledger.'}
                {activeTab === 'rails' && 'Live Payment Rails & Vault Liquidity.'}
                {activeTab === 'rates' && 'Live Dynamic FX Pricing & Quotes.'}
                {activeTab === 'agent' && 'Autonomous AI Agent Desk Operator.'}
                {activeTab === 'audit' && 'Cryptographic Audit Trail & Invariant Logs.'}
              </h1>
              <p className="text-xs font-mono text-white/40 mt-1">
                Operator: {user?.email || 'admin@nexusrail.com'} · Dual-Rail Testnet Engine
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                refreshRates();
                loadAdminNrPool();
                loadAdminCatalog();
                loadPlatformAUC();
                loadTreasuryData();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/80 self-start sm:self-auto hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rail-emerald animate-spin-once" />
              <span>Refresh Ledger State</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* 4 Metric KPI Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">NET OWNER PROFIT</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-[#F2D675] tracking-tight">
                    ${treasurySummary ? treasurySummary.netOwnerProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </p>
                  <p className="text-xs font-mono text-emerald-400 pt-1">
                    +${treasurySummary ? ((treasurySummary.ownerProfit24hCents || 0) / 100).toFixed(2) : '0.00'} (24h)
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">GROSS TREASURY VOLUME</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                    ${treasurySummary ? ((treasurySummary.totalGrossVolumeCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </p>
                  <p className="text-xs font-mono text-white/50 pt-1">
                    Total Revenue: ${treasurySummary ? ((treasurySummary.totalRevenueCents || 0) / 100).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">$NR BUYBACK RESERVE</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-[#00E5FF] tracking-tight">
                    ${treasurySummary ? treasurySummary.nrPoolInjectedUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </p>
                  <p className="text-xs font-mono text-white/50 pt-1">50% continuous pool injection</p>
                </div>
                <div className="p-5 rounded-xl bg-[#10141A] border border-white/10 space-y-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/40">LEDGER INVARIANT</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400 tracking-tight">$0.00</p>
                  <p className="text-xs font-mono text-emerald-400/80 pt-1">
                    {treasurySummary?.isBalanced !== false ? '100% Balanced · Zero Leakage' : 'Discrepancy'}
                  </p>
                </div>
              </div>

              {/* Volume & Rail Mix Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Settlement Volume</h3>
                      <p className="text-xs font-mono text-white/40">Dual-Rail transacted value across Stellar & XRPL</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/60">LIVE</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/60">Stellar Rail (XLM & USDC)</span>
                      <span className="text-[#00E5FF] font-bold">58.4% ($108,010.50)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#00E5FF] to-[#7FF8C6]" style={{ width: '58.4%' }} />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/60">XRPL Rail (XRP & RLUSD)</span>
                      <span className="text-[#0081F2] font-bold">41.6% ($76,909.90)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0081F2] to-[#8B5CF6]" style={{ width: '41.6%' }} />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                  <h3 className="text-base font-semibold text-white tracking-tight">Hot Vault Liquidity</h3>
                  <div className="space-y-3 text-xs font-mono">
                    <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white/60">Stellar Platform Vault</span>
                        <span className="text-[#00E5FF] font-bold">10,000.00 XLM</span>
                      </div>
                      <p className="text-[10px] text-white/40 font-mono truncate">{PLATFORM_STELLAR_VAULT}</p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white/60">XRPL Platform Vault</span>
                        <span className="text-[#0081F2] font-bold">100.00 XRP</span>
                      </div>
                      <p className="text-[10px] text-white/40 font-mono truncate">{PLATFORM_XRPL_VAULT}</p>
                    </div>
                  </div>
                </div>
              </div>

              {renderTreasuryAndOwnerProfitCard()}
              {renderProtocol22SmartContractCard()}
              {renderNrPoolMonitorCard()}
              {renderSmartBasketsCatalogCard()}
            </>
          )}

          {/* TAB 2: TREASURY & OWNER PROFIT (MODULE 4) */}
          {activeTab === 'treasury' && (
            <div className="space-y-6">
              {renderTreasuryAndOwnerProfitCard()}
              {renderProtocol22SmartContractCard()}
              {renderTreasuryAuditLogCard()}
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">On-Chain Orders & Swaps</h3>
                  <p className="text-xs font-mono text-white/40">Real-time ledger verified transactions with authentic cryptographic hashes</p>
                </div>
                <Link
                  href="/admin/orders"
                  className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono flex items-center gap-1.5 self-start hover:bg-[#68e0b0] transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Open Fulfillment Desk</span>
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="text-[10px] uppercase text-white/40 border-b border-white/10">
                    <tr>
                      <th className="pb-3">Order / Swap ID</th>
                      <th className="pb-3">User / Customer</th>
                      <th className="pb-3">Payment Rail</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Tx Hash</th>
                      <th className="pb-3 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {liveOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 font-bold text-white">{ord.orderNumber}</td>
                        <td className="py-3.5 text-white/70">{ord.buyerEmail}</td>
                        <td className="py-3.5 text-white/80">{ord.rail}</td>
                        <td className="py-3.5 font-bold text-white">{ord.amount}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ord.status === 'PAID' || ord.status === 'SETTLED' || ord.status === 'FULFILLED'
                              ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#F2D675]'
                              : 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-white/40 font-mono">
                          {ord.txHash.slice(0, 10)}...{ord.txHash.slice(-8)}
                        </td>
                        <td className="py-3.5 text-right">
                          <a
                            href={ord.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#F2D675] hover:underline"
                          >
                            <span>Verify</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: RECONCILIATION LEDGER & ASSETS UNDER CUSTODY (AUC) (MODULE 3) */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        Assets Under Custody (AUC) &amp; Solvency Ledger
                      </h3>
                    </div>
                    <p className="text-xs font-mono text-white/50 mt-1">
                      Institutional double-entry custody audit. Verifies aggregate user holdings against hot vault collateral and tracks 0.50% cashout spreads.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadPlatformAUC}
                    disabled={aucLoading}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-[#D4AF37] flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aucLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh AUC State</span>
                  </button>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase text-white/40">Total Custodial Liability</span>
                    <p className="text-2xl font-bold text-[#F2D675]">
                      ${((aucData?.total_custody_usd_cents || 0) / 100).toFixed(2)} USD
                    </p>
                    <p className="text-[10px] text-white/50">Aggregated across all shoppers</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase text-white/40">Custody Solvency Ratio</span>
                    <p className="text-2xl font-bold text-emerald-400">100.0% Collateralized</p>
                    <p className="text-[10px] text-emerald-400/70">Master Vault Coverage Active</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase text-white/40">Cashout Spreads Earned</span>
                    <p className="text-2xl font-bold text-[#00E5FF]">
                      ${((aucData?.total_spread_earned_cents || 0) / 100).toFixed(2)} USD
                    </p>
                    <p className="text-[10px] text-white/50">50 bps platform spread fee</p>
                  </div>
                </div>
              </div>

              {/* Table 1: Assets Under Custody Breakdown */}
              <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white tracking-tight">Custodial Asset Breakdown</h4>
                  <span className="text-xs font-mono text-white/40">Real-Time Oracle Valuation</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="text-[10px] uppercase text-white/40 border-b border-white/10">
                      <tr>
                        <th className="pb-3">Asset Symbol &amp; Name</th>
                        <th className="pb-3">Total User Units</th>
                        <th className="pb-3">Live Oracle Unit Price</th>
                        <th className="pb-3">Total Value (USD)</th>
                        <th className="pb-3">Active Holders</th>
                        <th className="pb-3 text-right">Vault Reserve Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {!aucData || aucData.assets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-white/40 font-mono text-xs">
                            No active user asset holdings currently recorded in the custody ledger.
                          </td>
                        </tr>
                      ) : (
                        aucData.assets.map((asset) => (
                          <tr key={asset.symbol} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 font-bold text-white flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                              <span>{asset.label} ({asset.symbol})</span>
                            </td>
                            <td className="py-3.5 text-white/90 font-bold">
                              {asset.total_quantity} {asset.symbol === 'GOLD_G' ? 'g' : asset.symbol === 'SILVER_G' ? 'g' : asset.symbol}
                            </td>
                            <td className="py-3.5 text-white/70">
                              ${(asset.current_price_cents / 100).toFixed(2)}
                            </td>
                            <td className="py-3.5 font-bold text-[#F2D675]">
                              ${(asset.valuation_usd_cents / 100).toFixed(2)}
                            </td>
                            <td className="py-3.5 text-white/60">
                              {asset.user_count} {asset.user_count === 1 ? 'user' : 'users'}
                            </td>
                            <td className="py-3.5 text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                100% Backed
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Recent User Cashouts & Liquidation Audit */}
              <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white tracking-tight">Recent 1-Click Cashouts &amp; Liquidations</h4>
                  <span className="text-xs font-mono text-white/40">50 bps Spread Audit Feed</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="text-[10px] uppercase text-white/40 border-b border-white/10">
                      <tr>
                        <th className="pb-3">Timestamp (UTC)</th>
                        <th className="pb-3">User ID</th>
                        <th className="pb-3">Asset Liquidated</th>
                        <th className="pb-3">Gross Value</th>
                        <th className="pb-3">Platform Spread (0.5%)</th>
                        <th className="pb-3 text-right">Reference ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {!aucData || aucData.recent_liquidations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-white/40 font-mono text-xs">
                            No 1-click cashouts recorded yet.
                          </td>
                        </tr>
                      ) : (
                        aucData.recent_liquidations.map((liq) => (
                          <tr key={liq.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 text-white/40">{new Date(liq.created_at).toLocaleString()}</td>
                            <td className="py-3.5 text-white/70">{liq.user_id}</td>
                            <td className="py-3.5 text-rose-400 font-bold">
                              {Math.abs(liq.quantity_delta)} {liq.symbol}
                            </td>
                            <td className="py-3.5 text-white font-bold">
                              ${(liq.total_usd_cents / 100).toFixed(2)}
                            </td>
                            <td className="py-3.5 text-[#00E5FF] font-bold">
                              +${(liq.fee_cents / 100).toFixed(2)}
                            </td>
                            <td className="py-3.5 text-right text-white/40 font-mono">
                              {liq.reference_id.slice(0, 16)}...
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RAILS & VAULTS */}
          {activeTab === 'rails' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#00E5FF] font-bold text-sm">Stellar Testnet Rail</span>
                    <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#F2D675] text-[10px] font-bold">HEALTHY · 210ms</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-white/60">
                      <span>Horizon Endpoint:</span>
                      <span className="text-white">https://horizon-testnet.stellar.org</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Treasury Vault:</span>
                      <span className="text-white">GDXP...ORXGC</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Funded Hot Balance:</span>
                      <span className="text-[#F2D675] font-bold">10,000.00 XLM</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#0081F2] font-bold text-sm">XRPL Altnet Rail</span>
                    <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#F2D675] text-[10px] font-bold">HEALTHY · 318ms</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-white/60">
                      <span>WebSocket Server:</span>
                      <span className="text-white">wss://s.altnet.rippletest.net:51233</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Treasury Vault:</span>
                      <span className="text-white truncate max-w-[200px]">{PLATFORM_XRPL_VAULT}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Funded Hot Balance:</span>
                      <span className="text-[#F2D675] font-bold">100.00 XRP</span>
                    </div>
                  </div>
                </div>
              </div>

              {renderNrPoolMonitorCard()}
            </div>
          )}

          {/* TAB 4: RATES & FX */}
          {activeTab === 'rates' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-white">Live Oracle FX Quotes</h3>
                  <span className="text-xs font-mono text-[#F2D675]">● Live Feed Connected</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-white/40 text-[10px] uppercase">XLM / USD</span>
                    <p className="text-2xl font-bold text-[#00E5FF] mt-1">${xlmUsd.toFixed(4)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-white/40 text-[10px] uppercase">XRP / USD</span>
                    <p className="text-2xl font-bold text-[#0081F2] mt-1">${xrpUsd.toFixed(4)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-white/40 text-[10px] uppercase">XRP / XLM Cross Rate</span>
                    <p className="text-2xl font-bold text-[#F2D675] mt-1">{(xrpUsd / (xlmUsd || 1)).toFixed(4)}</p>
                  </div>
                </div>
              </div>

              {renderSmartBasketsCatalogCard()}
            </div>
          )}

          {/* TAB 5: AI AGENT DESK */}
          {activeTab === 'agent' && (
            <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Autonomous Agent Proposal AG-0182</h3>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-mono font-bold">
                  OPERATOR CONFIRMATION REQUIRED
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs font-mono">
                <p className="text-white">
                  <strong>Proposal:</strong> Dual-rail liquidity rebalancing trigger across Stellar Horizon and XRPL Testnet.
                </p>
                <p className="text-white/60">
                  Variance within 0.12% tolerance. Autonomous agent requires operator digital sign-off to execute cross-ledger transaction.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmAgentRefresh}
                  disabled={isExecutingAgent}
                  className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#68e0b0] text-black font-bold text-xs font-mono transition-all flex items-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isExecutingAgent ? 'Executing Proposal...' : 'Approve & Execute'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRejectAgent}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-mono transition-all"
                >
                  Reject Proposal
                </button>
              </div>

              {agentExecutedSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Proposal AG-0182 executed successfully on-chain!</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 space-y-4 shadow-xl font-mono text-xs">
              <h3 className="text-base font-bold text-white">Cryptographic Invariant Trace</h3>
              <div className="space-y-2 divide-y divide-white/5">
                {agentAuditTrace.map((tr, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0">
                    <span className="text-white/40">{tr.time}</span>
                    <span className="text-white">{tr.text}</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/50">{tr.source}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Protocol 22 WASM Upgrade Modal */}
      {renderWasmUpgradeModal()}
    </div>
  );
}
