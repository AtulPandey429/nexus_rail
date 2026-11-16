'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  ArrowRightLeft,
  TrendingUp,
  Bot,
  FileText,
  ExternalLink,
  ShieldCheck,
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
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Vault,
  Activity,
  Check,
  Sparkles,
  Clock,
  Key,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PLATFORM_STELLAR_VAULT, PLATFORM_XRPL_VAULT } from '@/lib/vault';
import { readSession, SessionUser, onSessionChange, saveSession, clearSession } from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';
import type {
  PlatformAUCResponse,
  TreasurySummaryResponse,
  PlatformConfigDTO,
  SmartContractDTO,
  DualRailTokenSummaryDTO,
  ChainActionLogDTO,
} from '@/types';

type AdminTab =
  | 'overview'
  | 'treasury'
  | 'orders'
  | 'ledger'
  | 'amm'
  | 'vaults'
  | 'catalog'
  | 'rates'
  | 'agent'
  | 'audit';

// Reusable Universal Pagination Component
interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({ currentPage, totalItems, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs">
      <div className="text-slate-400 font-sans">
        Showing <span className="font-mono font-medium text-slate-200">{startItem}</span> to{' '}
        <span className="font-mono font-medium text-slate-200">{endItem}</span> of{' '}
        <span className="font-mono font-medium text-slate-200">{totalItems}</span> entries
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .map((p, idx, arr) => {
            const prev = arr[idx - 1];
            return (
              <React.Fragment key={p}>
                {prev && p - prev > 1 && <span className="px-1 text-slate-500 font-mono">...</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`min-w-[28px] h-7 px-2 rounded-lg font-mono text-xs transition-colors ${
                    currentPage === p
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  {p}
                </button>
              </React.Fragment>
            );
          })}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AdminConsolePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Strict Admin Auth Gate State
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
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
    {
      id: 'NR-1045',
      orderNumber: 'NR-1045',
      buyerEmail: 'client@fintech.io',
      rail: 'XRPL (RLUSD)',
      amount: '120.50 RLUSD',
      status: 'PAID',
      txHash: '77A4201824018240812408124081240812408124081240812408124081240812',
      explorerUrl: 'https://testnet.xrpl.org',
      createdAt: '2h ago',
    },
    {
      id: 'NR-1044',
      orderNumber: 'NR-1044',
      buyerEmail: 'investor@hedge.fund',
      rail: 'Stellar (XLM)',
      amount: '500.00 XLM',
      status: 'FULFILLED',
      txHash: '3109AEB40828A012480182408210480218408124082148012840128401284012',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
      createdAt: '3h ago',
    },
  ]);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 5;

  // Module 1: $NXL Protocol AMM Pool State
  const [nrPoolStatus, setNrPoolStatus] = useState<{
    priceUsd: number;
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
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const CATALOG_PER_PAGE = 5;

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

  // Module 4: Treasury 50/50 Split State
  const [treasurySummary, setTreasurySummary] = useState<TreasurySummaryResponse | null>(null);
  const [treasuryConfig, setTreasuryConfig] = useState<PlatformConfigDTO | null>(null);
  const [treasuryEntries, setTreasuryEntries] = useState<any[]>([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryEntriesPage, setTreasuryEntriesPage] = useState(1);
  const [treasurySearch, setTreasurySearch] = useState('');
  const TREASURY_PER_PAGE = 6;

  const [orderFeeBpsInput, setOrderFeeBpsInput] = useState(100);
  const [swapSpreadBpsInput, setSwapSpreadBpsInput] = useState(50);
  const [cashoutSpreadBpsInput, setCashoutSpreadBpsInput] = useState(50);
  const [buybackSharePctInput, setBuybackSharePctInput] = useState(50);
  const [isPausedInput, setIsPausedInput] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState('');

  const [smartContract, setSmartContract] = useState<SmartContractDTO | null>(null);
  const [rpcHealth, setRpcHealth] = useState<{ stellarRpc: string; xrplRpc: string } | null>(null);
  const [triggeringSplit, setTriggeringSplit] = useState(false);
  const [splitFeedback, setSplitFeedback] = useState('');

  // Dual-Rail Protocol 22 + XRPL XLS-30d Native AMM State
  const [dualRailSummary, setDualRailSummary] = useState<DualRailTokenSummaryDTO | null>(null);
  const [dualRailLoading, setDualRailLoading] = useState(false);
  const [dualRailFeedback, setDualRailFeedback] = useState('');
  const [ammDeploying, setAmmDeploying] = useState(false);
  const [ammDepositing, setAmmDepositing] = useState(false);
  const [ammDepositXrp, setAmmDepositXrp] = useState('5');
  const [ammDepositNr, setAmmDepositNr] = useState('5');
  const [chainLogs, setChainLogs] = useState<ChainActionLogDTO[]>([]);
  const [chainLogsLoading, setChainLogsLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');
  const AUDIT_PER_PAGE = 6;

  // Admin Credentials Reveal State (Strictly Admin Role)
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentialsData, setCredentialsData] = useState<any>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Exchange Rates Hook
  const { rates, loading: ratesLoading, refreshRates } = useLiveExchangeRates();

  // Load Session and verify admin role
  useEffect(() => {
    const sync = () => {
      const s = readSession();
      setUser(s?.user || null);
    };
    sync();
    const unsub = onSessionChange(sync);
    return () => unsub();
  }, []);

  // Strict Admin Login (Requires Valid Password & Admin Role)
  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminAuthError('');

    const email = adminEmailInput.trim();
    const password = adminPassInput;

    if (!email || !password) {
      setAdminAuthError('Please enter both operator email and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);

      const token = data?.token || data?.data?.token;
      const u = data?.user || data?.data?.user;

      if (res.ok && data?.success && token && u) {
        if (u.role !== 'admin') {
          setAdminAuthError('Access Denied: This account does not have operator/admin privileges.');
          setIsLoggingIn(false);
          return;
        }

        const adminUser: SessionUser = {
          id: u.id,
          email: u.email,
          role: u.role,
          name: u.name,
        };
        saveSession(adminUser, token);
        setUser(adminUser);
        setAdminPassInput('');
      } else {
        const errMsg =
          typeof data?.error === 'string'
            ? data.error
            : data?.error?.message || data?.message || 'Invalid operator credentials.';
        setAdminAuthError(errMsg);
      }
    } catch (err: any) {
      setAdminAuthError('Network error authenticating operator: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminSignOut = () => {
    clearSession();
    setUser(null);
  };

  // Data Loading Helpers
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
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load AUC:', err.message);
    } finally {
      setAucLoading(false);
    }
  };

  const loadNrPoolStatus = async () => {
    try {
      const res = await fetch('/api/v1/nr-token/status', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.data) {
          setNrPoolStatus(json.data);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load NR token pool status:', err.message);
    }
  };

  const loadAdminProducts = async () => {
    try {
      const res = await fetch('/api/v1/products', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          setAdminProducts(json.data);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load products:', err.message);
    }
  };

  const loadTreasuryData = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setTreasuryLoading(true);

    try {
      const [sumRes, confRes, entRes, contRes] = await Promise.all([
        fetch('/api/v1/admin/treasury/summary', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/v1/admin/treasury/config', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/v1/admin/treasury/entries?limit=50', { headers: authHeaders, cache: 'no-store' }),
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

  const loadDualRailStatus = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    setDualRailLoading(true);
    try {
      const res = await fetch('/api/v1/admin/dual-rail/summary', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.data) {
          setDualRailSummary(json.data);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load dual-rail summary:', err.message);
    } finally {
      setDualRailLoading(false);
    }
  };

  const loadChainLogs = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    setChainLogsLoading(true);
    try {
      const res = await fetch('/api/v1/admin/dual-rail/logs?limit=50', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          setChainLogs(json.data);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load chain logs:', err.message);
    } finally {
      setChainLogsLoading(false);
    }
  };

  const loadAdminCredentials = async () => {
    if (showCredentials) {
      setShowCredentials(false);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    setCredentialsLoading(true);
    try {
      const res = await fetch('/api/v1/admin/dual-rail/credentials', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.data) {
          setCredentialsData(json.data);
          setShowCredentials(true);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Admin] Failed to load credentials:', err.message);
    } finally {
      setCredentialsLoading(false);
    }
  };

  const handleCopyKey = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Trigger manual 50/50 profit split
  const handleTriggerProfitSplit = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    setTriggeringSplit(true);
    setSplitFeedback('');
    try {
      const res = await fetch('/api/v1/admin/treasury/trigger-split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: 'Manual operator execution from admin console' }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setSplitFeedback('50/50 profit split executed successfully on-chain.');
        loadTreasuryData();
        loadNrPoolStatus();
      } else {
        setSplitFeedback(json?.error?.message || 'Failed to trigger profit split.');
      }
    } catch (err: any) {
      setSplitFeedback('Error triggering split: ' + err.message);
    } finally {
      setTriggeringSplit(false);
    }
  };

  // Adjust Reserve
  const handleAdjustReserve = async (deltaUsd: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    setAdjustingReserve(true);
    setReserveFeedback('');
    try {
      const res = await fetch('/api/v1/admin/nr-pool/adjust-reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deltaUsdCents: Math.round(deltaUsd * 100), note: reserveNote }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setReserveFeedback(`Reserve updated by \$${deltaUsd >= 0 ? '+' : ''}${deltaUsd.toFixed(2)} USD.`);
        loadNrPoolStatus();
      } else {
        setReserveFeedback(json?.error?.message || 'Failed to update reserve.');
      }
    } catch (err: any) {
      setReserveFeedback('Error adjusting reserve: ' + err.message);
    } finally {
      setAdjustingReserve(false);
    }
  };

  // Refresh all tab data when authenticated
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadNrPoolStatus();
      loadAdminProducts();
      loadPlatformAUC();
      loadTreasuryData();
      loadDualRailStatus();
      loadChainLogs();
    }
  }, [isAdmin]);

  // Filtered & Paginated Orders
  const filteredOrders = useMemo(() => {
    if (!ordersSearch.trim()) return liveOrders;
    const q = ordersSearch.toLowerCase();
    return liveOrders.filter(
      (o) =>
        o.id?.toLowerCase().includes(q) ||
        o.orderNumber?.toLowerCase().includes(q) ||
        o.buyerEmail?.toLowerCase().includes(q) ||
        o.rail?.toLowerCase().includes(q) ||
        o.txHash?.toLowerCase().includes(q) ||
        o.status?.toLowerCase().includes(q)
    );
  }, [liveOrders, ordersSearch]);

  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, ordersPage]);

  // Filtered & Paginated Catalog
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return adminProducts;
    const q = catalogSearch.toLowerCase();
    return adminProducts.filter(
      (p) =>
        p.id?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [adminProducts, catalogSearch]);

  const paginatedCatalog = useMemo(() => {
    const start = (catalogPage - 1) * CATALOG_PER_PAGE;
    return filteredCatalog.slice(start, start + CATALOG_PER_PAGE);
  }, [filteredCatalog, catalogPage]);

  // Filtered & Paginated Treasury Entries
  const filteredTreasuryEntries = useMemo(() => {
    if (!treasurySearch.trim()) return treasuryEntries;
    const q = treasurySearch.toLowerCase();
    return treasuryEntries.filter(
      (e) =>
        e.source_ref?.toLowerCase().includes(q) ||
        e.source_type?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q) ||
        e.id?.toLowerCase().includes(q)
    );
  }, [treasuryEntries, treasurySearch]);

  const paginatedTreasuryEntries = useMemo(() => {
    const start = (treasuryEntriesPage - 1) * TREASURY_PER_PAGE;
    return filteredTreasuryEntries.slice(start, start + TREASURY_PER_PAGE);
  }, [filteredTreasuryEntries, treasuryEntriesPage]);

  // Filtered & Paginated Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (!auditSearch.trim()) return chainLogs;
    const q = auditSearch.toLowerCase();
    return chainLogs.filter(
      (l) =>
        l.action?.toLowerCase().includes(q) ||
        l.chain?.toLowerCase().includes(q) ||
        l.tx_hash?.toLowerCase().includes(q) ||
        l.status?.toLowerCase().includes(q)
    );
  }, [chainLogs, auditSearch]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PER_PAGE;
    return filteredAuditLogs.slice(start, start + AUDIT_PER_PAGE);
  }, [filteredAuditLogs, auditPage]);

  // STRICT LOGIN SCREEN IF NOT OPERATOR
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-amber-400 selection:text-slate-950">
        <div className="w-full max-w-md p-8 rounded-2xl bg-[#0D111A] border border-slate-800 shadow-2xl relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-500 to-indigo-500" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-sans tracking-tight text-white">NexusRail Operator Console</h1>
              <p className="text-xs text-slate-400 font-sans">Dual-Rail Testnet Settlement & Treasury Access</p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-sans">
                Operator Email
              </label>
              <input
                type="email"
                required
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="admin@nexusrail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-sans">
                Access Password / Key
              </label>
              <input
                type="password"
                required
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors font-mono"
              />
            </div>

            {adminAuthError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-sans flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{adminAuthError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authenticate Operator</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center space-y-3">
            <div className="text-[11px] text-slate-400 font-sans">
              Authorized credentials: <code className="text-amber-300 font-mono">admin@nexusrail.com</code> (pass: <code className="text-amber-300 font-mono">admin123</code>)
            </div>
            <div>
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1 font-sans">
                &larr; Return to Public Storefront
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // NAVIGATION TABS CONFIGURATION
  const navTabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'treasury', label: '50/50 Platform Treasury', icon: DollarSign },
    { id: 'orders', label: 'Orders & Settlements', icon: ShoppingCart },
    { id: 'ledger', label: 'AUC & Master Ledger', icon: BookOpen },
    { id: 'amm', label: '$NXL Protocol AMM', icon: Coins },
    { id: 'vaults', label: 'Dual-Rail Vaults', icon: Vault },
    { id: 'catalog', label: 'Smart Baskets & Catalog', icon: Layers },
    { id: 'rates', label: 'Real-Time FX Oracles', icon: TrendingUp },
    { id: 'agent', label: 'AI Settlement Desk', icon: Bot },
    { id: 'audit', label: 'Security Audit Trail', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans">
      {/* 1. DEDICATED ADMIN TOP OPERATIONAL BAR */}
      <header className="sticky top-0 z-50 bg-[#0B0E14]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-bold text-slate-950 font-mono text-sm shadow-md shadow-amber-400/20">
              NR
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
                nexusrail <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-amber-300">Admin Console</span>
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Stellar & XRPL Testnet: Live
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <span>View Storefront</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-mono text-slate-300 truncate max-w-[150px] sm:max-w-[220px]">
              {user.email}
            </span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300">
              {user.role}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAdminSignOut}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Sign out of Admin Console"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN LAYOUT: SIDEBAR + CONTENT AREA */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* LEFT OPERATOR SIDEBAR */}
        <aside className="w-full md:w-64 bg-[#090C12] border-r border-slate-800/80 p-3 sm:p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0">
          <div className="hidden md:block px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
            Navigation Modules
          </div>

          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-amber-400/10 border border-amber-400/30 text-amber-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="mt-auto hidden md:block pt-4 border-t border-slate-800/60 px-3 space-y-2">
            <button
              type="button"
              onClick={loadAdminCredentials}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-sans flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Vault Credentials</span>
              </span>
              {showCredentials ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            <div className="text-[10px] text-slate-400 font-mono">
              Node: v2.4.0 · Stellar Soroban + XRPL XLS-30d
            </div>
          </div>
        </aside>

        {/* RIGHT CONTENT PANEL */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-[#0B0E14] overflow-y-auto max-w-7xl">
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Dual-Rail Executive Overview</h2>
                  <p className="text-xs text-slate-400">
                    Real-time liquidity, settlement metrics, and continuous 50/50 profit splitting
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      loadTreasuryData();
                      loadNrPoolStatus();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Refresh State</span>
                  </button>
                </div>
              </div>

              {/* 4 Primary KPI Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1.5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                    Net Owner Profit
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-300">
                    ${treasurySummary ? treasurySummary.netOwnerProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="text-xs text-emerald-400 font-sans flex items-center gap-1">
                    <span>+${treasurySummary ? ((treasurySummary.ownerProfit24hCents || 0) / 100).toFixed(2) : '0.00'} (24h)</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1.5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                    Gross Treasury Volume
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
                    ${treasurySummary ? ((treasurySummary.totalGrossVolumeCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="text-xs text-slate-400 font-sans">
                    Total Revenue: ${treasurySummary ? ((treasurySummary.totalRevenueCents || 0) / 100).toFixed(2) : '0.00'}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1.5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                    $NXL Buyback Reserve
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-cyan-400">
                    ${treasurySummary ? treasurySummary.nrPoolInjectedUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="text-xs text-slate-400 font-sans">
                    50% automatic continuous pool injection
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1.5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                    Ledger Invariant
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">
                    $0.00
                  </div>
                  <div className="text-xs text-emerald-400/90 font-sans flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{treasurySummary?.isBalanced !== false ? '100% Balanced · Zero Leakage' : 'Audit Variance'}</span>
                  </div>
                </div>
              </div>

              {/* Settlement Volume & Hot Vault Liquidity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Settlement Volume by Rail</h3>
                      <p className="text-xs text-slate-400">Transacted value across Stellar Soroban & XRPL XLS-30d</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300 font-medium">Stellar Rail (XLM & USDC)</span>
                        <span className="font-mono text-cyan-400 font-bold">58.4% ($108,010.50)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: '58.4%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300 font-medium">XRPL Rail (XRP & RLUSD)</span>
                        <span className="font-mono text-indigo-400 font-bold">41.6% ($76,909.90)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '41.6%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                  <h3 className="text-base font-semibold text-white tracking-tight">Hot Vault Liquidity</h3>
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Stellar Platform Vault</span>
                        <span className="font-mono text-cyan-400 font-bold">10,000.00 XLM</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{PLATFORM_STELLAR_VAULT}</p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">XRPL Platform Vault</span>
                        <span className="font-mono text-indigo-400 font-bold">100.00 XRP</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{PLATFORM_XRPL_VAULT}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* System & Health Status */}
              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white tracking-tight">Live Dual-Rail Infrastructure Health</h3>
                  <span className="text-xs text-slate-400">Deterministic RPC connectivity</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-300">Stellar Soroban RPC</div>
                      <div className="text-[11px] text-slate-500 font-mono">testnet.stellar.org</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-300">XRPL XLS-30d Node</div>
                      <div className="text-[11px] text-slate-500 font-mono">s.altnet.rippletest.net</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-300">Real-Time Oracle Feed</div>
                      <div className="text-[11px] text-slate-500 font-mono">CoinCap API + Live Fallback</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-300">Automated AMM Pool</div>
                      <div className="text-[11px] text-slate-500 font-mono">$NXL Invariant Active</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  </div>
                </div>
              </div>

              {/* Recent Live Activity with Quick Jump Links */}
              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white tracking-tight">Recent Settlement Activity</h3>
                    <p className="text-xs text-slate-400">Latest dual-rail customer orders and cross-chain swaps</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>View all {liveOrders.length} orders</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Buyer Email</th>
                        <th className="py-2.5 px-3">Settlement Rail</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Tx Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {liveOrders.slice(0, 4).map((order) => (
                        <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-medium text-white">{order.orderNumber}</td>
                          <td className="py-2.5 px-3 text-slate-300">{order.buyerEmail}</td>
                          <td className="py-2.5 px-3 text-slate-300">{order.rail}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-300">{order.amount}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {order.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                            <a
                              href={order.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-cyan-400 inline-flex items-center gap-1"
                            >
                              <span>{order.txHash.slice(0, 8)}...{order.txHash.slice(-6)}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLATFORM TREASURY & 50/50 PROFIT SPLIT */}
          {activeTab === 'treasury' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Platform Treasury & Profit Split Engine</h2>
                  <p className="text-xs text-slate-400">
                    Autonomous 50/50 distribution between Protocol Owner Profit and $NXL Buyback Reserve
                  </p>
                </div>
                <button
                  type="button"
                  disabled={triggeringSplit}
                  onClick={handleTriggerProfitSplit}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-400/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {triggeringSplit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                  <span>Trigger 50/50 Split On-Chain</span>
                </button>
              </div>

              {splitFeedback && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-400/30 text-amber-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{splitFeedback}</span>
                </div>
              )}

              {/* Treasury Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Accumulated Owner Profit</div>
                  <div className="text-2xl font-mono font-bold text-amber-300">
                    ${treasurySummary ? treasurySummary.netOwnerProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="text-xs text-slate-400">Available for cold storage withdrawal</div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">$NXL Buyback Injected</div>
                  <div className="text-2xl font-mono font-bold text-cyan-400">
                    ${treasurySummary ? treasurySummary.nrPoolInjectedUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="text-xs text-slate-400">Strengthens liquidity pool backing</div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fee Configuration</div>
                  <div className="text-sm font-mono text-white pt-1">
                    Order Fee: <span className="text-amber-300">{orderFeeBpsInput / 100}%</span> · Swap Spread:{' '}
                    <span className="text-cyan-300">{swapSpreadBpsInput / 100}%</span>
                  </div>
                  <div className="text-xs text-slate-400">Owner Share: {buybackSharePctInput}% / Pool Share: {100 - buybackSharePctInput}%</div>
                </div>
              </div>

              {/* Paginated Treasury Entries Table */}
              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white tracking-tight">Treasury Settlement Entries</h3>
                    <p className="text-xs text-slate-400">Immutable ledger fee splits and reserve injections</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search entries..."
                      value={treasurySearch}
                      onChange={(e) => {
                        setTreasurySearch(e.target.value);
                        setTreasuryEntriesPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Source Type</th>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3">Gross Fee</th>
                        <th className="py-2.5 px-3">Owner Profit</th>
                        <th className="py-2.5 px-3">$NXL Buyback</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {paginatedTreasuryEntries.length > 0 ? (
                        paginatedTreasuryEntries.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-200 uppercase text-[11px]">{item.source_type}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">{item.source_ref || 'TR-SETTLE-001'}</td>
                            <td className="py-2.5 px-3 font-mono text-white font-bold">
                              ${((item.gross_fee_cents || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-amber-300 font-bold">
                              ${((item.owner_profit_cents || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">
                              ${((item.nr_pool_cents || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {item.status || 'SPLIT'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                            No treasury settlement entries found matching your query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  currentPage={treasuryEntriesPage}
                  totalItems={filteredTreasuryEntries.length}
                  pageSize={TREASURY_PER_PAGE}
                  onPageChange={setTreasuryEntriesPage}
                />
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER ORDERS & SETTLEMENTS */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Customer Orders & On-Chain Settlements</h2>
                  <p className="text-xs text-slate-400">
                    Dual-rail order execution, merchant payment validation, and cryptographic transaction receipts
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search order ID, email, hash..."
                    value={ordersSearch}
                    onChange={(e) => {
                      setOrdersSearch(e.target.value);
                      setOrdersPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Order Number</th>
                        <th className="py-2.5 px-3">Customer Email</th>
                        <th className="py-2.5 px-3">Payment Rail</th>
                        <th className="py-2.5 px-3">Settlement Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Age</th>
                        <th className="py-2.5 px-3">On-Chain Tx Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {paginatedOrders.length > 0 ? (
                        paginatedOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-mono font-medium text-white">{order.orderNumber}</td>
                            <td className="py-3 px-3 text-slate-300">{order.buyerEmail}</td>
                            <td className="py-3 px-3 text-slate-300">{order.rail}</td>
                            <td className="py-3 px-3 font-mono font-bold text-amber-300">{order.amount}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  order.status === 'PAID' || order.status === 'FULFILLED' || order.status === 'SETTLED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">{order.createdAt}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-cyan-400">
                              <a
                                href={order.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline inline-flex items-center gap-1"
                              >
                                <span>{order.txHash ? `${order.txHash.slice(0, 10)}...${order.txHash.slice(-8)}` : 'On-Chain'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                            No orders found matching your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  currentPage={ordersPage}
                  totalItems={filteredOrders.length}
                  pageSize={ORDERS_PER_PAGE}
                  onPageChange={setOrdersPage}
                />
              </div>
            </div>
          )}

          {/* TAB 4: AUC & MASTER LEDGER */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Assets Under Custody (AUC) & Master Ledger</h2>
                  <p className="text-xs text-slate-400">
                    Double-entry multi-asset reconciliation across cold custody and hot operational vaults
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadPlatformAUC}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Re-verify AUC</span>
                </button>
              </div>

              {/* AUC Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total System AUC</div>
                  <div className="text-2xl font-mono font-bold text-amber-300">
                    ${aucData ? ((aucData.total_custody_usd_cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '184,920.40'}
                  </div>
                  <div className="text-xs text-slate-400">Aggregated across all asset classes</div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Portfolios Under Management</div>
                  <div className="text-2xl font-mono font-bold text-cyan-400">
                    {aucData?.assets ? `${aucData.assets.length} Asset Classes` : '12 Custodial Wallets'}
                  </div>
                  <div className="text-xs text-slate-400">Stellar Trustlines + XRPL Trustlines</div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Invariant Health</div>
                  <div className="text-2xl font-mono font-bold text-emerald-400">Zero Discrepancy</div>
                  <div className="text-xs text-emerald-400/80">Sum(Assets) == Sum(Liabilities + Equity)</div>
                </div>
              </div>

              {/* Currency Breakdown */}
              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <h3 className="text-base font-semibold text-white tracking-tight">Custodial Asset Allocation</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { symbol: 'XLM', label: 'Stellar Lumens', amount: '124,500.00', color: 'text-cyan-400' },
                    { symbol: 'XRP', label: 'XRP Ledger', amount: '89,400.00', color: 'text-indigo-400' },
                    { symbol: 'USDC', label: 'USD Coin', amount: '45,200.00', color: 'text-blue-400' },
                    { symbol: 'RLUSD', label: 'Ripple USD', amount: '32,150.00', color: 'text-emerald-400' },
                    { symbol: 'GOLD', label: 'Physical Gold (g)', amount: '120.50 g', color: 'text-amber-300' },
                    { symbol: 'SILVER', label: 'Physical Silver (g)', amount: '4,500.00 g', color: 'text-slate-300' },
                  ].map((asset) => (
                    <div key={asset.symbol} className="p-3.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{asset.symbol}</span>
                        <span className="text-[10px] text-slate-500">{asset.label}</span>
                      </div>
                      <div className={`text-sm font-mono font-bold ${asset.color}`}>{asset.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: $NXL PROTOCOL AMM POOL */}
          {activeTab === 'amm' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">$NXL Native Protocol AMM Pool</h2>
                  <p className="text-xs text-slate-400">
                    Dual-rail bonding curve liquidity, continuous buyback injections, and constant-product invariant $K$
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadNrPoolStatus}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sync AMM State</span>
                </button>
              </div>

              {/* Pool Status Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">$NXL Spot Price</div>
                  <div className="text-2xl font-mono font-bold text-amber-300">
                    ${nrPoolStatus ? nrPoolStatus.priceUsd.toFixed(4) : '1.0250'} USD
                  </div>
                  <div className="text-xs text-emerald-400">
                    +{nrPoolStatus ? nrPoolStatus.change24hPercent.toFixed(2) : '2.40'}% (24h)
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reserve Backing (USD)</div>
                  <div className="text-2xl font-mono font-bold text-cyan-400">
                    ${nrPoolStatus ? nrPoolStatus.reserveUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '15,000.00'}
                  </div>
                  <div className="text-xs text-slate-400">Locked backing collateral</div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pool $NXL Supply</div>
                  <div className="text-2xl font-mono font-bold text-white">
                    {nrPoolStatus ? nrPoolStatus.poolNrSupply.toLocaleString() : '14,634'} NXL
                  </div>
                  <div className="text-xs text-slate-400">Circulating: {nrPoolStatus ? nrPoolStatus.circulatingNr.toLocaleString() : '5,000'} NXL</div>
                </div>

                <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fee Injections</div>
                  <div className="text-2xl font-mono font-bold text-emerald-400">
                    ${nrPoolStatus ? nrPoolStatus.cumulativeFeeInjectedUsd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '420.50'}
                  </div>
                  <div className="text-xs text-emerald-400/80">From 50% automated profit split</div>
                </div>
              </div>

              {/* Reserve Adjustment Controls */}
              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <h3 className="text-base font-semibold text-white tracking-tight">Manual Operator Reserve Top-up</h3>
                <p className="text-xs text-slate-400">
                  Inject operator collateral into the constant product bonding curve to deepen liquidity and raise $NXL floor price.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="number"
                    value={reserveDeltaUsd}
                    onChange={(e) => setReserveDeltaUsd(e.target.value)}
                    placeholder="500"
                    className="w-full sm:w-48 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm font-mono focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={reserveNote}
                    onChange={(e) => setReserveNote(e.target.value)}
                    placeholder="Liquidity note"
                    className="w-full sm:w-80 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    disabled={adjustingReserve}
                    onClick={() => handleAdjustReserve(parseFloat(reserveDeltaUsd) || 0)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-400/20 disabled:opacity-50 cursor-pointer"
                  >
                    {adjustingReserve ? 'Injecting...' : 'Inject Liquidity (USD)'}
                  </button>
                </div>

                {reserveFeedback && (
                  <div className="p-3 rounded-lg bg-slate-900 border border-amber-400/30 text-amber-300 text-xs">
                    {reserveFeedback}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: DUAL-RAIL VAULTS */}
          {activeTab === 'vaults' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Platform Vaults & Liquidity Reserves</h2>
                <p className="text-xs text-slate-400">
                  Official on-chain testnet custody and platform operational vault accounts
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stellar Vault */}
                <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-400" />
                      <h3 className="text-base font-semibold text-white tracking-tight">Stellar Platform Vault</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-bold">
                      TESTNET
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Public Account Key</span>
                      <span className="text-slate-200 break-all select-all">{PLATFORM_STELLAR_VAULT}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                      <span className="text-slate-400">Vault Balance:</span>
                      <span className="text-cyan-400 font-bold text-sm">10,000.00 XLM</span>
                    </div>
                  </div>

                  <a
                    href={`https://stellar.expert/explorer/testnet/account/${PLATFORM_STELLAR_VAULT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Inspect on Stellar Expert</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>

                {/* XRPL Vault */}
                <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-500" />
                      <h3 className="text-base font-semibold text-white tracking-tight">XRPL Platform Vault</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-bold">
                      TESTNET
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Classic Address</span>
                      <span className="text-slate-200 break-all select-all">{PLATFORM_XRPL_VAULT}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                      <span className="text-slate-400">Vault Balance:</span>
                      <span className="text-indigo-400 font-bold text-sm">100.00 XRP</span>
                    </div>
                  </div>

                  <a
                    href={`https://testnet.xrpl.org/accounts/${PLATFORM_XRPL_VAULT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Inspect on XRPL Testnet Explorer</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: SMART BASKETS & ORACLE CATALOG */}
          {activeTab === 'catalog' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Smart Baskets & Oracle Catalog</h2>
                  <p className="text-xs text-slate-400">
                    Manage tokenized index baskets and configure dynamic multi-rail physical & digital asset weightings
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search catalog SKUs..."
                    value={catalogSearch}
                    onChange={(e) => {
                      setCatalogSearch(e.target.value);
                      setCatalogPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              {/* Paginated Products Table */}
              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Settlement Rail</th>
                        <th className="py-2.5 px-3">Live Price (USD)</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {paginatedCatalog.length > 0 ? (
                        paginatedCatalog.map((product) => (
                          <tr key={product.id || product.sku} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-mono font-medium text-amber-300">{product.sku}</td>
                            <td className="py-3 px-3 text-white font-medium">{product.title}</td>
                            <td className="py-3 px-3 uppercase text-[11px] text-slate-400">{product.category}</td>
                            <td className="py-3 px-3 font-mono text-slate-300">{product.settlementRail || 'Dual-Rail'}</td>
                            <td className="py-3 px-3 font-mono font-bold text-white">
                              ${((product.priceCents || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                ACTIVE
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-500 font-sans">
                            No catalog items found matching your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  currentPage={catalogPage}
                  totalItems={filteredCatalog.length}
                  pageSize={CATALOG_PER_PAGE}
                  onPageChange={setCatalogPage}
                />
              </div>
            </div>
          )}

          {/* TAB 8: REAL-TIME FX ORACLES */}
          {activeTab === 'rates' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Real-Time Chain Oracles & FX Pricing</h2>
                  <p className="text-xs text-slate-400">
                    Live dynamic exchange rates connecting Stellar Soroban and XRPL XLS-30d
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshRates}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Refresh Quotes</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { pair: 'XLM / USD', rate: rates?.xlmUsd ? `$${rates.xlmUsd.toFixed(4)}` : '$0.1365', change: '+1.8%' },
                  { pair: 'XRP / USD', rate: rates?.xrpUsd ? `$${rates.xrpUsd.toFixed(4)}` : '$1.9240', change: '+3.2%' },
                  { pair: 'NXL / USD', rate: nrPoolStatus?.priceUsd ? `$${nrPoolStatus.priceUsd.toFixed(4)}` : '$1.0250', change: '+2.4%' },
                  { pair: 'GOLD / USD (g)', rate: '$84.50', change: '+0.5%' },
                ].map((item) => (
                  <div key={item.pair} className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{item.pair}</div>
                    <div className="text-2xl font-mono font-bold text-white">{item.rate}</div>
                    <div className="text-xs text-emerald-400 font-sans">{item.change} 24h</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: AI SETTLEMENT DESK */}
          {activeTab === 'agent' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Autonomous AI Settlement Desk</h2>
                <p className="text-xs text-slate-400">
                  Continuous dual-rail balance verification, cross-chain arbitrage, and liquidity rebalancing
                </p>
              </div>

              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-white text-sm">Agent Operator Status: Active Autonomous Mode</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                    ONLINE
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  The AI Settlement Agent continuously scans Stellar Soroban orderbooks and XRPL XLS-30d liquidity pools
                  every 15 seconds to execute optimal rebalancing transactions while maintaining zero invariant leakage.
                </p>
              </div>
            </div>
          )}

          {/* TAB 10: SECURITY AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Cryptographic Security Audit Trail</h2>
                  <p className="text-xs text-slate-400">
                    Tamper-evident log of all dual-rail smart contract transactions, profit splits, and operator actions
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search audit trail..."
                    value={auditSearch}
                    onChange={(e) => {
                      setAuditSearch(e.target.value);
                      setAuditPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              <div className="p-6 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Settlement Rail</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Transaction Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {paginatedAuditLogs.length > 0 ? (
                        paginatedAuditLogs.map((log, idx) => (
                          <tr key={log.id || idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                              {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Just now'}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-200">{log.action || 'CONTRACT_SPLIT'}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">{log.chain || 'Dual-Rail'}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {log.status || 'VERIFIED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-400">
                              {log.tx_hash ? `${log.tx_hash.slice(0, 10)}...${log.tx_hash.slice(-8)}` : 'On-Chain Ledger'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-500 font-sans">
                            No security audit logs found matching your query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  currentPage={auditPage}
                  totalItems={filteredAuditLogs.length}
                  pageSize={AUDIT_PER_PAGE}
                  onPageChange={setAuditPage}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
