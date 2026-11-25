'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  ClipboardCheck,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { ADMIN_NAV_ITEMS } from '@/components/admin/adminNav';
import {
  Button,
  Feedback,
  Field,
  LinkButton,
  cn,
  inputClassName,
} from '@/components/admin/AdminUI';
import { CredentialsModal, type CredentialsData } from '@/components/admin/CredentialsModal';
import { AdminBrandMark } from '@/components/admin/AdminBits';
import { usePlatformConfig, explorerTxUrl } from '@/lib/platformConfig';
import {
  ADMIN_TABS,
  formatDateTime,
  formatMoney,
  type AdminModel,
  type AdminTab,
  type FeedbackTone,
  type LiveOrder,
  type NrPoolStatus,
  type StellarRpcHealth,
  type VaultBalance,
} from '@/components/admin/adminModel';
import { OverviewTab } from '@/components/admin/tabs/OverviewTab';
import { AnalyticsTab } from '@/components/admin/tabs/AnalyticsTab';
import { TreasuryTab } from '@/components/admin/tabs/TreasuryTab';
import { OrdersTab } from '@/components/admin/tabs/OrdersTab';
import { LedgerTab } from '@/components/admin/tabs/LedgerTab';
import { AmmTab } from '@/components/admin/tabs/AmmTab';
import { VaultsTab } from '@/components/admin/tabs/VaultsTab';
import { CatalogTab } from '@/components/admin/tabs/CatalogTab';
import { RatesTab } from '@/components/admin/tabs/RatesTab';
import { AgentTab } from '@/components/admin/tabs/AgentTab';
import { AuditTab } from '@/components/admin/tabs/AuditTab';
import { SettingsTab } from '@/components/admin/tabs/SettingsTab';
import { readSession, type SessionUser, onSessionChange, saveSession, clearSession } from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';
import type {
  AdminAnalyticsGranularity,
  AdminAnalyticsRangeKey,
  AdminAnalyticsResponse,
  ChainActionLogDTO,
  DualRailTokenSummaryDTO,
  PlatformAUCResponse,
  PlatformConfigDTO,
  SmartContractDTO,
  TreasurySummaryResponse,
} from '@/types';

/* ==========================================================================
   Operator console controller
   - Preserves all existing API calls, auth checks, and admin capabilities.
   - Presentation is composed from the scoped admin design system.
   ========================================================================== */

const TAB_META: Record<AdminTab, { title: string; description: string; eyebrow: string }> = {
  overview: {
    eyebrow: 'Command center',
    title: 'Executive overview',
    description: 'Real-time liquidity, settlement performance, and 50/50 profit distribution across Stellar and XRPL.',
  },
  analytics: {
    eyebrow: 'Business intelligence',
    title: 'Business analytics',
    description: 'Real order, revenue, profit, user, and custody trends from the platform database.',
  },
  treasury: {
    eyebrow: 'Treasury',
    title: 'Treasury & profit split',
    description: 'Autonomous 50/50 distribution between owner earnings and the $NXL buyback reserve.',
  },
  settings: {
    eyebrow: 'System & Fee Controls',
    title: 'Platform & Network Configuration',
    description: 'Manage active blockchain network mode, dynamic fee structures, contract IDs, and RPC endpoints directly from database.',
  },
  orders: {
    eyebrow: 'Operations',
    title: 'Orders & settlements',
    description: 'Monitor dual-rail orders, payment validation, and on-chain settlement receipts.',
  },
  ledger: {
    eyebrow: 'Custody',
    title: 'Custody & asset ledger',
    description: 'Double-entry reconciliation across cold custody and hot operational vaults.',
  },
  amm: {
    eyebrow: 'Liquidity',
    title: '$NXL liquidity pool',
    description: 'Bonding-curve liquidity, reserve injections, and the constant-product invariant.',
  },
  vaults: {
    eyebrow: 'Custody',
    title: 'Dual-rail vaults',
    description: 'On-chain testnet custody accounts, parity, and operational liquidity reserves.',
  },
  catalog: {
    eyebrow: 'Catalog',
    title: 'Smart baskets & catalog',
    description: 'Tokenized index baskets and multi-rail asset weighting configuration.',
  },
  rates: {
    eyebrow: 'Oracle mesh',
    title: 'Exchange rates & oracles',
    description: 'Live exchange rates powering Stellar and XRPL settlement pricing.',
  },
  agent: {
    eyebrow: 'Automation',
    title: 'AI settlement desk',
    description: 'Autonomous balance verification, cross-chain arbitrage, and liquidity rebalancing.',
  },
  audit: {
    eyebrow: 'Governance',
    title: 'Security audit trail',
    description: 'Tamper-evident log of on-chain transactions, profit splits, and operator actions.',
  },
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function feedbackMessage(json: any, fallback: string) {
  if (typeof json?.error === 'string') return json.error;
  if (json?.error?.message) return json.error.message;
  if (json?.message) return json.message;
  return fallback;
}

export default function AdminConsolePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  /* Strict operator auth gate */
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  /* Analytics */
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsRange, setAnalyticsRange] = useState<AdminAnalyticsRangeKey>('30d');
  const [analyticsGranularity, setAnalyticsGranularity] = useState<AdminAnalyticsGranularity | 'auto'>('auto');

  /* Orders */
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('ALL');
  const ORDERS_PER_PAGE = 5;

  /* $NXL AMM */
  const [nrPoolStatus, setNrPoolStatus] = useState<NrPoolStatus | null>(null);
  const [reserveDeltaUsd, setReserveDeltaUsd] = useState('500');
  const [reserveNote, setReserveNote] = useState('Operator liquidity top-up');
  const [adjustingReserve, setAdjustingReserve] = useState(false);
  const [reserveFeedback, setReserveFeedback] = useState('');
  const [reserveFeedbackTone, setReserveFeedbackTone] = useState<FeedbackTone>('success');

  /* Catalog */
  const [adminProducts, setAdminProducts] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogCategory, setCatalogCategory] = useState('all');
  const CATALOG_PER_PAGE = 5;

  /* Custody */
  const [aucData, setAucData] = useState<PlatformAUCResponse | null>(null);
  const [aucLoading, setAucLoading] = useState(false);
  const [vaultBalances, setVaultBalances] = useState<VaultBalance[]>([]);
  const [vaultBalancesLoading, setVaultBalancesLoading] = useState(false);

  /* Treasury */
  const [treasurySummary, setTreasurySummary] = useState<TreasurySummaryResponse | null>(null);
  const [treasuryConfig, setTreasuryConfig] = useState<PlatformConfigDTO | null>(null);
  const [treasuryEntries, setTreasuryEntries] = useState<any[]>([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryEntriesPage, setTreasuryEntriesPage] = useState(1);
  const [treasurySearch, setTreasurySearch] = useState('');
  const TREASURY_PER_PAGE = 6;

  const [orderFeeBpsInput, setOrderFeeBpsInput] = useState(0);
  const [swapSpreadBpsInput, setSwapSpreadBpsInput] = useState(0);
  const [cashoutSpreadBpsInput, setCashoutSpreadBpsInput] = useState(0);
  const [buybackSharePctInput, setBuybackSharePctInput] = useState(0);
  const [isPausedInput, setIsPausedInput] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState('');
  const [configFeedbackTone, setConfigFeedbackTone] = useState<FeedbackTone>('success');

  const [smartContract, setSmartContract] = useState<SmartContractDTO | null>(null);
  const [rpcHealth, setRpcHealth] = useState<StellarRpcHealth | null>(null);
  const [triggeringSplit, setTriggeringSplit] = useState(false);
  const [splitFeedback, setSplitFeedback] = useState('');
  const [splitFeedbackTone, setSplitFeedbackTone] = useState<FeedbackTone>('success');

  /* Dual rail */
  const [dualRailSummary, setDualRailSummary] = useState<DualRailTokenSummaryDTO | null>(null);
  const [dualRailLoading, setDualRailLoading] = useState(false);
  const [dualRailFeedback, setDualRailFeedback] = useState('');
  const [dualRailFeedbackTone, setDualRailFeedbackTone] = useState<FeedbackTone>('success');
  const [ammDepositXrp, setAmmDepositXrp] = useState('');
  const [ammDepositNr, setAmmDepositNr] = useState('');
  const [ammDepositing, setAmmDepositing] = useState(false);

  /* Audit */
  const [chainLogs, setChainLogs] = useState<ChainActionLogDTO[]>([]);
  const [chainLogsLoading, setChainLogsLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');
  const AUDIT_PER_PAGE = 6;

  /* Credentials */
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentialsData, setCredentialsData] = useState<CredentialsData>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState('');

  const { rates, loading: ratesLoading, refreshRates } = useLiveExchangeRates();
  const { config: platformConfig } = usePlatformConfig();

  /* ------------------------------ Session ------------------------------- */
  useEffect(() => {
    const sync = () => {
      const session = readSession();
      setUser(session?.user || null);
    };
    sync();
    setSessionReady(true);
    const unsubscribe = onSessionChange(sync);
    const tab = new URLSearchParams(window.location.search).get('tab') as AdminTab | null;
    if (tab && ADMIN_TABS.includes(tab)) setActiveTab(tab);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activeTab === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', activeTab);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activeTab]);

  const isAdmin = user?.role === 'admin';

  /* ------------------------------- Loaders ------------------------------ */
  const loadPlatformAUC = async () => {
    setAucLoading(true);
    try {
      const response = await fetch('/api/v1/admin/portfolios', { headers: authHeaders(), cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        if (json?.success && json.data) setAucData(json.data);
      }
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load AUC:', error.message);
    } finally {
      setAucLoading(false);
      setLastSyncedAt(new Date());
    }
  };

  const loadVaultBalances = async () => {
    setVaultBalancesLoading(true);
    try {
      const response = await fetch('/api/v1/crypto/providers', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && Array.isArray(json.data)) {
        setVaultBalances(json.data as VaultBalance[]);
      }
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load vault balances:', error.message);
    } finally {
      setVaultBalancesLoading(false);
    }
  };

  const loadAdminOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await fetch('/api/v1/admin/orders?limit=200', {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) {
        throw new Error(feedbackMessage(json, 'Unable to load the order ledger.'));
      }
      const rows = Array.isArray(json?.data?.orders) ? json.data.orders : [];
      setLiveOrders(
        rows.map((row: any) => {
          const txHash = row.txHash || row.tx_hash || '';
          const rail = row.rail || row.payment_rail || 'UNKNOWN';
          const totalCents = Number(row.totalCents ?? row.total_cents ?? 0);
          return {
            id: row.id || row.orderNumber || '',
            orderNumber: row.orderNumber || row.order_number || '—',
            buyerEmail: row.buyerEmail || row.buyer_email || '—',
            rail,
            amount: formatMoney(totalCents),
            totalCents,
            status: row.status || 'UNKNOWN',
            txHash,
            explorerUrl: explorerTxUrl(platformConfig, rail, txHash),
            createdAt: formatDateTime(row.createdAt || row.created_at),
          } satisfies LiveOrder;
        })
      );
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load orders:', error.message);
      setLiveOrders([]);
    } finally {
      setOrdersLoading(false);
      setLastSyncedAt(new Date());
    }
  };

  const loadAnalytics = async (options?: { refresh?: boolean }) => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const params = new URLSearchParams({ range: analyticsRange });
      if (analyticsGranularity !== 'auto') params.set('granularity', analyticsGranularity);
      if (options?.refresh) params.set('refresh', 'true');

      const response = await fetch(`/api/v1/admin/analytics?${params.toString()}`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success || !json?.data) {
        throw new Error(feedbackMessage(json, 'Unable to load business analytics.'));
      }
      setAnalytics(json.data as AdminAnalyticsResponse);
    } catch (error: any) {
      setAnalyticsError(error.message || 'Unable to load business analytics.');
    } finally {
      setAnalyticsLoading(false);
      setLastSyncedAt(new Date());
    }
  };

  const loadNrPoolStatus = async () => {
    try {
      const response = await fetch('/api/v1/nr-token/status', { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        if (json?.success && json.data) setNrPoolStatus(json.data);
      }
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load NXL pool status:', error.message);
    } finally {
      setLastSyncedAt(new Date());
    }
  };

  const loadAdminProducts = async (force = false) => {
    setCatalogLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/products${force ? '?refresh=true' : ''}`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (response.ok) {
        const json = await response.json();
        const payload = json?.data;
        const products = Array.isArray(payload) ? payload : Array.isArray(payload?.products) ? payload.products : [];
        setAdminProducts(products);
      }
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load products:', error.message);
    } finally {
      setCatalogLoading(false);
      setLastSyncedAt(new Date());
    }
  };

  const loadTreasuryData = async () => {
    setTreasuryLoading(true);
    try {
      const [summaryRes, configRes, entriesRes, contractRes] = await Promise.all([
        fetch('/api/v1/admin/treasury/summary', { headers: authHeaders(), cache: 'no-store' }),
        fetch('/api/v1/admin/treasury/config', { headers: authHeaders(), cache: 'no-store' }),
        fetch('/api/v1/admin/treasury/entries?limit=50', { headers: authHeaders(), cache: 'no-store' }),
        fetch('/api/v1/admin/contracts/nexus-vault', { headers: authHeaders(), cache: 'no-store' }),
      ]);

      if (summaryRes.ok) {
        const json = await summaryRes.json();
        if (json?.success && json.data) setTreasurySummary(json.data);
      }
      if (configRes.ok) {
        const json = await configRes.json();
        if (json?.success && json.data) {
          setTreasuryConfig(json.data);
          setOrderFeeBpsInput(json.data.order_fee_bps ?? 0);
          setSwapSpreadBpsInput(json.data.swap_spread_bps ?? 0);
          setCashoutSpreadBpsInput(json.data.cashout_spread_bps ?? 0);
          setBuybackSharePctInput(json.data.nr_buyback_share_pct ?? 0);
          setIsPausedInput(json.data.is_paused ?? false);
        }
      }
      if (entriesRes.ok) {
        const json = await entriesRes.json();
        if (json?.success && Array.isArray(json.data?.items)) setTreasuryEntries(json.data.items);
      }
      if (contractRes.ok) {
        const json = await contractRes.json();
        if (json?.success && json.data) {
          setSmartContract(json.data.contract || null);
          setRpcHealth(json.data.rpcHealth || null);
        }
      }
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load treasury data:', error.message);
    } finally {
      setTreasuryLoading(false);
      setLastSyncedAt(new Date());
    }
  };

  const loadDualRailStatus = async () => {
    setDualRailLoading(true);
    try {
      const response = await fetch('/api/v1/admin/dual-rail/summary', {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (response.ok) {
        const json = await response.json();
        if (json?.success && json.data) setDualRailSummary(json.data);
      }
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load dual-rail summary:', error.message);
    } finally {
      setDualRailLoading(false);
      setLastSyncedAt(new Date());
    }
  };

  const loadChainLogs = async () => {
    setChainLogsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/dual-rail/logs?limit=50', {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (response.ok) {
        const json = await response.json();
        const payload = json?.data;
        const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
        setChainLogs(items as ChainActionLogDTO[]);
      }
    } catch (error: any) {
      console.warn('⚠️ [Admin] Failed to load chain logs:', error.message);
    } finally {
      setChainLogsLoading(false);
      setLastSyncedAt(new Date());
    }
  };

  const fetchCredentials = async (force = false) => {
    setShowCredentials(true);
    setCredentialsError('');
    if (credentialsData && !force) return;
    setCredentialsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/dual-rail/credentials', {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json.data) {
        setCredentialsData(json.data);
      } else {
        setCredentialsError(feedbackMessage(json, 'Unable to load vault credentials for this operator.'));
      }
    } catch (error: any) {
      setCredentialsError(`Network error reading vault credentials: ${error.message}`);
    } finally {
      setCredentialsLoading(false);
    }
  };

  const openCredentials = () => {
    void fetchCredentials(false);
  };

  const refreshAll = () => {
    void loadTreasuryData();
    void loadNrPoolStatus();
    void loadPlatformAUC();
    void loadVaultBalances();
    void loadDualRailStatus();
    void loadChainLogs();
    void loadAdminProducts();
    void loadAdminOrders();
    void loadAnalytics({ refresh: true });
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadNrPoolStatus();
    void loadAdminProducts();
    void loadPlatformAUC();
    void loadVaultBalances();
    void loadTreasuryData();
    void loadDualRailStatus();
    void loadChainLogs();
    void loadAdminOrders();
    void loadAnalytics();
    // Existing console refresh contract: run once when an admin session becomes active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'analytics') return;
    void loadAnalytics();
    // Range/granularity changes intentionally refetch; loadAnalytics reads the latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab, analyticsRange, analyticsGranularity]);

  /* ----------------------------- Auth actions --------------------------- */
  const handleAdminLogin = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setAdminAuthError('');
    const email = adminEmailInput.trim();
    const password = adminPassInput;

    if (!email || !password) {
      setAdminAuthError('Enter both the operator email and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      const token = data?.token || data?.data?.token;
      const account = data?.user || data?.data?.user;

      if (response.ok && data?.success && token && account) {
        if (account.role !== 'admin') {
          setAdminAuthError('Access denied: this account does not have operator privileges.');
          return;
        }
        const adminUser: SessionUser = {
          id: account.id,
          email: account.email,
          role: account.role,
          name: account.name,
        };
        saveSession(adminUser, token);
        setUser(adminUser);
        setAdminPassInput('');
      } else {
        setAdminAuthError(feedbackMessage(data, 'Invalid operator credentials.'));
      }
    } catch (error: any) {
      setAdminAuthError(`Network error authenticating operator: ${error.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminSignOut = () => {
    clearSession();
    setUser(null);
    setShowCredentials(false);
    setCredentialsData(null);
    setActiveTab('overview');
  };

  /* --------------------------- Operator actions ------------------------- */
  const handleTriggerProfitSplit = async () => {
    setTriggeringSplit(true);
    setSplitFeedback('');
    try {
      const response = await fetch('/api/v1/admin/treasury/trigger-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reason: 'Manual operator execution from admin console' }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success) {
        setSplitFeedbackTone('success');
        setSplitFeedback('50/50 profit split executed successfully on-chain.');
        void loadTreasuryData();
        void loadNrPoolStatus();
        void loadChainLogs();
        void loadAnalytics({ refresh: true });
      } else {
        setSplitFeedbackTone('error');
        setSplitFeedback(feedbackMessage(json, 'Failed to trigger the profit split.'));
      }
    } catch (error: any) {
      setSplitFeedbackTone('error');
      setSplitFeedback(`Error triggering split: ${error.message}`);
    } finally {
      setTriggeringSplit(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigFeedback('');
    try {
      const response = await fetch('/api/v1/admin/treasury/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          order_fee_bps: Math.max(0, Math.round(orderFeeBpsInput)),
          swap_spread_bps: Math.max(0, Math.round(swapSpreadBpsInput)),
          cashout_spread_bps: Math.max(0, Math.round(cashoutSpreadBpsInput)),
          nr_buyback_share_pct: Math.max(0, Math.min(100, Math.round(buybackSharePctInput))),
          is_paused: isPausedInput,
        }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success) {
        if (json.data) {
          setTreasuryConfig(json.data);
          setOrderFeeBpsInput(json.data.order_fee_bps ?? orderFeeBpsInput);
          setSwapSpreadBpsInput(json.data.swap_spread_bps ?? swapSpreadBpsInput);
          setCashoutSpreadBpsInput(json.data.cashout_spread_bps ?? cashoutSpreadBpsInput);
          setBuybackSharePctInput(json.data.nr_buyback_share_pct ?? buybackSharePctInput);
          setIsPausedInput(json.data.is_paused ?? isPausedInput);
        }
        setConfigFeedbackTone('success');
        setConfigFeedback('Treasury fee configuration saved.');
        void loadTreasuryData();
        void loadAnalytics({ refresh: true });
      } else {
        setConfigFeedbackTone('error');
        setConfigFeedback(feedbackMessage(json, 'Failed to save the treasury configuration.'));
      }
    } catch (error: any) {
      setConfigFeedbackTone('error');
      setConfigFeedback(`Error saving configuration: ${error.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAdjustReserve = async (deltaUsd: number) => {
    if (!Number.isFinite(deltaUsd) || deltaUsd === 0) {
      setReserveFeedbackTone('error');
      setReserveFeedback('Enter a non-zero USD amount to adjust the reserve.');
      return;
    }
    setAdjustingReserve(true);
    setReserveFeedback('');
    try {
      const response = await fetch('/api/v1/admin/nr-pool/adjust-reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ deltaUsdCents: Math.round(deltaUsd * 100), note: reserveNote }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success) {
        setReserveFeedbackTone('success');
        setReserveFeedback(`Reserve updated by ${deltaUsd >= 0 ? '+' : ''}$${deltaUsd.toFixed(2)} USD.`);
        void loadNrPoolStatus();
        void loadChainLogs();
        void loadAnalytics({ refresh: true });
      } else {
        setReserveFeedbackTone('error');
        setReserveFeedback(feedbackMessage(json, 'Failed to update the reserve.'));
      }
    } catch (error: any) {
      setReserveFeedbackTone('error');
      setReserveFeedback(`Error adjusting reserve: ${error.message}`);
    } finally {
      setAdjustingReserve(false);
    }
  };

  const handleDepositAmm = async () => {
    const xrp = Number(ammDepositXrp);
    const nxl = Number(ammDepositNr);
    if (!Number.isFinite(xrp) || !Number.isFinite(nxl) || xrp <= 0 || nxl <= 0) {
      setDualRailFeedbackTone('error');
      setDualRailFeedback('Enter positive XRP and NXL amounts before depositing.');
      return;
    }
    setAmmDepositing(true);
    setDualRailFeedback('');
    try {
      const response = await fetch('/api/v1/admin/dual-rail/xrpl-amm/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ xrpAmount: xrp, nrAmount: nxl }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success) {
        setDualRailFeedbackTone('success');
        setDualRailFeedback('Native AMM liquidity deposited successfully.');
        void loadDualRailStatus();
        void loadChainLogs();
      } else {
        setDualRailFeedbackTone('error');
        setDualRailFeedback(feedbackMessage(json, 'Failed to deposit AMM liquidity.'));
      }
    } catch (error: any) {
      setDualRailFeedbackTone('error');
      setDualRailFeedback(`Error depositing liquidity: ${error.message}`);
    } finally {
      setAmmDepositing(false);
    }
  };

  /* ----------------------------- Derived lists -------------------------- */
  const filteredOrders = useMemo(() => {
    const query = ordersSearch.trim().toLowerCase();
    return liveOrders.filter((order) => {
      const matchesStatus = ordersStatusFilter === 'ALL' || order.status === ordersStatusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return [order.id, order.orderNumber, order.buyerEmail, order.rail, order.txHash, order.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [liveOrders, ordersSearch, ordersStatusFilter]);

  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, ordersPage]);

  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    return adminProducts.filter((product) => {
      const matchesCategory = catalogCategory === 'all' || product.category === catalogCategory;
      if (!matchesCategory) return false;
      if (!query) return true;
      return [product.id, product.sku, product.title, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [adminProducts, catalogSearch, catalogCategory]);

  const paginatedCatalog = useMemo(() => {
    const start = (catalogPage - 1) * CATALOG_PER_PAGE;
    return filteredCatalog.slice(start, start + CATALOG_PER_PAGE);
  }, [filteredCatalog, catalogPage]);

  const filteredTreasuryEntries = useMemo(() => {
    const query = treasurySearch.trim().toLowerCase();
    if (!query) return treasuryEntries;
    return treasuryEntries.filter((entry) =>
      [entry.reference_id, entry.source_ref, entry.source_type, entry.rail, entry.notes, entry.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [treasuryEntries, treasurySearch]);

  const paginatedTreasuryEntries = useMemo(() => {
    const start = (treasuryEntriesPage - 1) * TREASURY_PER_PAGE;
    return filteredTreasuryEntries.slice(start, start + TREASURY_PER_PAGE);
  }, [filteredTreasuryEntries, treasuryEntriesPage]);

  const filteredAuditLogs = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return chainLogs;
    return chainLogs.filter((log) =>
      [log.action, log.chain, log.tx_hash, log.status, log.reference_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [chainLogs, auditSearch]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PER_PAGE;
    return filteredAuditLogs.slice(start, start + AUDIT_PER_PAGE);
  }, [filteredAuditLogs, auditPage]);

  const model: AdminModel = {
    activeTab,
    setActiveTab,
    lastSyncedAt,
    analytics,
    analyticsLoading,
    analyticsError,
    analyticsRange,
    setAnalyticsRange,
    analyticsGranularity,
    setAnalyticsGranularity,
    loadAnalytics,
    liveOrders,
    ordersLoading,
    loadAdminOrders,
    ordersSearch,
    setOrdersSearch,
    ordersPage,
    setOrdersPage,
    ordersStatusFilter,
    setOrdersStatusFilter,
    filteredOrders,
    paginatedOrders,
    ORDERS_PER_PAGE,
    nrPoolStatus,
    reserveDeltaUsd,
    setReserveDeltaUsd,
    reserveNote,
    setReserveNote,
    adjustingReserve,
    reserveFeedback,
    reserveFeedbackTone,
    handleAdjustReserve,
    adminProducts,
    catalogLoading,
    catalogSearch,
    setCatalogSearch,
    catalogPage,
    setCatalogPage,
    catalogCategory,
    setCatalogCategory,
    filteredCatalog,
    paginatedCatalog,
    CATALOG_PER_PAGE,
    loadAdminProducts,
    aucData,
    aucLoading,
    loadPlatformAUC,
    vaultBalances,
    vaultBalancesLoading,
    loadVaultBalances,
    treasurySummary,
    treasuryConfig,
    treasuryEntries,
    treasuryLoading,
    treasuryEntriesPage,
    setTreasuryEntriesPage,
    treasurySearch,
    setTreasurySearch,
    filteredTreasuryEntries,
    paginatedTreasuryEntries,
    TREASURY_PER_PAGE,
    loadTreasuryData,
    orderFeeBpsInput,
    setOrderFeeBpsInput,
    swapSpreadBpsInput,
    setSwapSpreadBpsInput,
    cashoutSpreadBpsInput,
    setCashoutSpreadBpsInput,
    buybackSharePctInput,
    setBuybackSharePctInput,
    isPausedInput,
    setIsPausedInput,
    savingConfig,
    configFeedback,
    configFeedbackTone,
    handleSaveConfig,
    triggeringSplit,
    splitFeedback,
    splitFeedbackTone,
    handleTriggerProfitSplit,
    smartContract,
    rpcHealth,
    dualRailSummary,
    dualRailLoading,
    dualRailFeedback,
    dualRailFeedbackTone,
    loadDualRailStatus,
    ammDepositXrp,
    setAmmDepositXrp,
    ammDepositNr,
    setAmmDepositNr,
    ammDepositing,
    handleDepositAmm,
    chainLogs,
    chainLogsLoading,
    auditPage,
    setAuditPage,
    auditSearch,
    setAuditSearch,
    filteredAuditLogs,
    paginatedAuditLogs,
    AUDIT_PER_PAGE,
    loadChainLogs,
    rates,
    ratesLoading,
    refreshRates,
    openCredentials,
    refreshAll,
  };

  /* --------------------------- Session loading -------------------------- */
  if (!sessionReady) {
    return (
      <div className="admin-canvas flex min-h-screen flex-col items-center justify-center gap-3">
        <AdminBrandMark size={44} />
        <p className="text-xs text-admin-muted">Verifying operator session…</p>
      </div>
    );
  }

  /* ------------------------------ Login gate ---------------------------- */
  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-canvas relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <span className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-admin-gold/[0.05] blur-[110px]" aria-hidden="true" />
        <div className="relative grid w-full max-w-[980px] overflow-hidden rounded-3xl border border-admin-border bg-[#0B0F16] shadow-admin-pop lg:grid-cols-[1.05fr_1fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden border-r border-admin-border bg-gradient-to-b from-[#111621] to-[#090C12] p-8 lg:flex">
            <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/[0.08] blur-3xl" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-admin-gold/[0.07] blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <AdminBrandMark size={36} />
                <div>
                  <p className="text-sm font-semibold tracking-tight text-white">nexusrail</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-admin-faint">
                    Operator console
                  </p>
                </div>
              </div>
              <h1 className="mt-12 max-w-sm text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
                Operate the dual-rail settlement layer.
              </h1>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-admin-muted">
                Treasury, custody, and on-chain settlement controls for Stellar Soroban and XRPL XLS-30d.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  'Live dual-rail settlement telemetry',
                  'Treasury fee and 50/50 split controls',
                  'Cryptographic security audit trail',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-xs text-slate-300">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                      <Check className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative mt-10 rounded-xl border border-admin-border bg-black/20 px-4 py-3">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-admin-faint">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden="true" />
                Restricted environment. All operator actions are recorded and reviewed against on-chain receipts.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-9">
            <div className="flex items-center gap-2 lg:hidden">
              <AdminBrandMark size={32} />
              <div>
                <p className="text-sm font-semibold text-white">nexusrail</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-admin-faint">Operator console</p>
              </div>
            </div>

            <div className="mt-6 lg:mt-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-admin-border bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-admin-muted">
                <Lock className="h-3 w-3 text-admin-gold" aria-hidden="true" />
                Restricted access
              </span>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">Operator sign-in</h2>
              <p className="mt-1 text-xs leading-relaxed text-admin-muted">
                Authenticate with an account that holds the admin role.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
              <Field label="Operator email" htmlFor="operator-email">
                <input
                  id="operator-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={adminEmailInput}
                  onChange={(event) => setAdminEmailInput(event.target.value)}
                  placeholder="admin@nexusrail.com"
                  className={cn(inputClassName, 'font-admin-mono')}
                />
              </Field>

              <Field label="Access password" htmlFor="operator-password">
                <div className="relative">
                  <input
                    id="operator-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={adminPassInput}
                    onChange={(event) => setAdminPassInput(event.target.value)}
                    placeholder="••••••••••••"
                    className={cn(inputClassName, 'pr-11 font-admin-mono')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-admin-faint transition-colors hover:bg-white/[0.05] hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {adminAuthError && <Feedback tone="error">{adminAuthError}</Feedback>}

              <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoggingIn}>
                {isLoggingIn ? 'Authenticating operator…' : 'Authenticate operator'}
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-admin-border/70 pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-admin-muted transition-colors hover:text-white"
              >
                Return to storefront
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <span className="flex items-center gap-1.5 text-[11px] text-admin-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Stellar + XRPL online
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------- Header actions --------------------------- */
  const meta = TAB_META[activeTab];
  let headerActions: React.ReactNode = null;

  if (activeTab === 'overview') {
    headerActions = (
      <Button variant="secondary" icon={RefreshCw} onClick={refreshAll}>
        Refresh state
      </Button>
    );
  } else if (activeTab === 'analytics') {
    headerActions = (
      <Button
        variant="secondary"
        icon={RefreshCw}
        loading={analyticsLoading}
        onClick={() => loadAnalytics({ refresh: true })}
      >
        Refresh analytics
      </Button>
    );
  } else if (activeTab === 'treasury') {
    headerActions = (
      <Button variant="secondary" icon={RefreshCw} loading={treasuryLoading} onClick={loadTreasuryData}>
        Refresh treasury
      </Button>
    );
  } else if (activeTab === 'orders') {
    headerActions = (
      <LinkButton href="/admin/orders" variant="primary" icon={ClipboardCheck}>
        Fulfillment queue
      </LinkButton>
    );
  } else if (activeTab === 'ledger') {
    headerActions = (
      <Button variant="secondary" icon={RefreshCw} loading={aucLoading} onClick={loadPlatformAUC}>
        Re-verify AUC
      </Button>
    );
  } else if (activeTab === 'amm') {
    headerActions = (
      <Button variant="secondary" icon={RefreshCw} loading={dualRailLoading} onClick={loadDualRailStatus}>
        Sync AMM state
      </Button>
    );
  } else if (activeTab === 'vaults') {
    headerActions = (
      <>
        <Button
          variant="secondary"
          icon={RefreshCw}
          loading={dualRailLoading || vaultBalancesLoading}
          onClick={() => {
            void loadDualRailStatus();
            void loadVaultBalances();
          }}
        >
          Sync parity
        </Button>
        <Button variant="primary" icon={KeyRound} onClick={openCredentials}>
          Credentials
        </Button>
      </>
    );
  } else if (activeTab === 'catalog') {
    headerActions = (
      <Button variant="secondary" icon={RefreshCw} loading={catalogLoading} onClick={() => loadAdminProducts(true)}>
        Refresh catalog
      </Button>
    );
  } else if (activeTab === 'rates') {
    headerActions = (
      <Button variant="secondary" icon={RefreshCw} loading={ratesLoading} onClick={refreshRates}>
        Refresh quotes
      </Button>
    );
  } else if (activeTab === 'audit') {
    headerActions = (
      <Button variant="secondary" icon={RefreshCw} loading={chainLogsLoading} onClick={loadChainLogs}>
        Refresh audit trail
      </Button>
    );
  }

  return (
    <>
      <AdminShell
        user={user}
        activeId={activeTab}
        title={meta.title}
        description={meta.description}
        eyebrow={meta.eyebrow}
        actions={headerActions}
        onSignOut={handleAdminSignOut}
        onNavigate={(id) => setActiveTab(id as AdminTab)}
        onOpenCredentials={openCredentials}
        navItems={ADMIN_NAV_ITEMS}
      >
        {activeTab === 'overview' && <OverviewTab model={model} />}
        {activeTab === 'analytics' && <AnalyticsTab model={model} />}
        {activeTab === 'treasury' && <TreasuryTab model={model} />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'orders' && <OrdersTab model={model} />}
        {activeTab === 'ledger' && <LedgerTab model={model} />}
        {activeTab === 'amm' && <AmmTab model={model} />}
        {activeTab === 'vaults' && <VaultsTab model={model} />}
        {activeTab === 'catalog' && <CatalogTab model={model} />}
        {activeTab === 'rates' && <RatesTab model={model} />}
        {activeTab === 'agent' && <AgentTab />}
        {activeTab === 'audit' && <AuditTab model={model} />}
      </AdminShell>

      <CredentialsModal
        open={showCredentials}
        onClose={() => setShowCredentials(false)}
        data={credentialsData}
        loading={credentialsLoading}
        error={credentialsError}
        onRefresh={() => {
          void fetchCredentials(true);
        }}
      />
    </>
  );
}
