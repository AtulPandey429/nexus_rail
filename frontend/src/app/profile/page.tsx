'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Mail,
  ShieldCheck,
  Wallet,
  Clock,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  LogOut,
  RefreshCw,
  ShoppingBag,
  Unlink,
  TrendingUp,
  TrendingDown,
  Coins,
  DollarSign,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Cpu,
  Copy,
  Check,
  Activity,
  ArrowDownUp,
} from 'lucide-react';
import { readSession, clearSession, notifySession, onSessionChange, SessionUser } from '@/lib/shop';
import { usePlatformConfig } from '@/lib/platformConfig';
import { WalletConnectModal, WalletConnectedAccount } from '@/components/wallet/WalletConnectModal';
import {
  SwapTransactionLeg,
  getSwapTypeLabel,
  isRealOnChainTxHash,
} from '@/components/swap/SwapTransactionTimeline';
import type { UserPortfolioResponse, HydratedHolding } from '@/types';

interface ProfileData {
  id: string;
  name: string;
  email: string | null;
  role: 'user' | 'admin';
  walletAddress: string | null;
  stellarAddress: string | null;
  xrplAddress: string | null;
  lastConnectedWallet: {
    network: 'stellar' | 'xrpl';
    provider: string;
    address: string;
    connectedAt: string;
  } | null;
  wallets: Array<{
    network: 'stellar' | 'xrpl';
    address: string;
    provider: string;
    connectedAt: string;
    verified: boolean;
  }>;
  createdAt: string;
  stats: {
    totalOrders: number;
    totalSpentCents: number;
  };
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { config } = usePlatformConfig();

  // Edit Name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Change / Connect Wallet Modal
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [targetNetwork, setTargetNetwork] = useState<'stellar' | 'xrpl'>('stellar');

  // Live Asset Portfolio & P&L State
  const [portfolio, setPortfolio] = useState<UserPortfolioResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [cashoutHolding, setCashoutHolding] = useState<HydratedHolding | null>(null);
  const [cashoutQty, setCashoutQty] = useState<number>(0);
  const [cashoutSubmitting, setCashoutSubmitting] = useState(false);
  const [cashoutSuccessMsg, setCashoutSuccessMsg] = useState('');
  const [cashoutErrorMsg, setCashoutErrorMsg] = useState('');

  // Dual-Rail On-Chain $NXL Withdrawal State (Stellar Protocol 22 + XRPL XLS-30d)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawNrHolding, setWithdrawNrHolding] = useState<HydratedHolding | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawChain, setWithdrawChain] = useState<'stellar' | 'xrpl'>('stellar');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawErrorMsg, setWithdrawErrorMsg] = useState('');
  const [withdrawSuccessData, setWithdrawSuccessData] = useState<{
    txHash: string;
    ledgerSeq?: number;
    amountNr: number;
    chain: 'STELLAR' | 'XRPL';
    explorerUrl: string;
    destinationAddress: string;
  } | null>(null);

  // Active Connected Chain & Live On-Chain Ledger Feed (ZERO FAKE DATA)
  const [activeChain, setActiveChain] = useState<'xrpl' | 'stellar'>('xrpl');
  const [activeHistoryTab, setActiveHistoryTab] = useState<'ledger' | 'bridge'>('ledger');
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([]);
  const [loadingLedgerTxs, setLoadingLedgerTxs] = useState<boolean>(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [copiedTxHash, setCopiedTxHash] = useState<string | null>(null);
  const [bridgeHistory, setBridgeHistory] = useState<any[]>([]);
  const [loadingBridgeHistory, setLoadingBridgeHistory] = useState<boolean>(false);
  const [internalBalance, setInternalBalance] = useState<{ usdCents: number; nxlMicro: number } | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const fetchInternalBalance = async () => {
    const s = readSession();
    if (!s.token) return;
    try {
      const res = await fetch('/api/v1/wallet/balance', {
        headers: { Authorization: `Bearer ${s.token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.balance) {
        setInternalBalance({
          usdCents: Number(json.balance.USD || 0),
          nxlMicro: Number(json.balance.NXL ?? json.balance.NR ?? 0),
        });
      }
    } catch {}
  };

  // Synchronize sessionUser from auth session state and broadcast events
  useEffect(() => {
    const s = readSession();
    setSessionUser(s.user);
    const unsubscribe = onSessionChange(() => {
      const refreshed = readSession();
      setSessionUser(refreshed.user);
      fetchProfile();
      fetchPortfolio();
      fetchInternalBalance();
    });
    return () => unsubscribe();
  }, []);

  // Dual-rail address resolution: exactly 1 for Stellar, 1 for XRPL
  const resolvedStellar =
    profile?.stellarAddress ||
    profile?.wallets?.find((w) => w.network === 'stellar')?.address ||
    (profile?.lastConnectedWallet?.network === 'stellar' ? profile.lastConnectedWallet.address : '') ||
    sessionUser?.stellarAddress ||
    (sessionUser?.lastConnectedWallet?.network === 'stellar' ? sessionUser.lastConnectedWallet.address : '') ||
    (profile?.walletAddress?.startsWith('G') ? profile.walletAddress : '') ||
    (sessionUser?.walletAddress?.startsWith('G') ? sessionUser.walletAddress : '') ||
    '';

  const resolvedXrpl =
    profile?.xrplAddress ||
    profile?.wallets?.find((w) => w.network === 'xrpl')?.address ||
    (profile?.lastConnectedWallet?.network === 'xrpl' ? profile.lastConnectedWallet.address : '') ||
    sessionUser?.xrplAddress ||
    (sessionUser?.lastConnectedWallet?.network === 'xrpl' ? sessionUser.lastConnectedWallet.address : '') ||
    (profile?.walletAddress?.startsWith('r') ? profile.walletAddress : '') ||
    (sessionUser?.walletAddress?.startsWith('r') ? sessionUser.walletAddress : '') ||
    '';

  const stellarProvider =
    profile?.wallets?.find((w) => w.network === 'stellar')?.provider ||
    (profile?.lastConnectedWallet?.network === 'stellar' ? profile.lastConnectedWallet.provider : '') ||
    (sessionUser?.lastConnectedWallet?.network === 'stellar' ? sessionUser.lastConnectedWallet.provider : '') ||
    'Freighter';

  const xrplProvider =
    profile?.wallets?.find((w) => w.network === 'xrpl')?.provider ||
    (profile?.lastConnectedWallet?.network === 'xrpl' ? profile.lastConnectedWallet.provider : '') ||
    (sessionUser?.lastConnectedWallet?.network === 'xrpl' ? sessionUser.lastConnectedWallet.provider : '') ||
    'GemWallet';

  const handleOpenWithdrawNr = (holding: HydratedHolding) => {
    setWithdrawNrHolding(holding);
    setWithdrawAmount(String(holding.quantity));
    setWithdrawChain('stellar');
    setWithdrawAddress(resolvedStellar || '');
    setWithdrawErrorMsg('');
    setWithdrawSuccessData(null);
    setWithdrawModalOpen(true);
  };

  const handleSwitchWithdrawChain = (chain: 'stellar' | 'xrpl') => {
    setWithdrawChain(chain);
    setWithdrawErrorMsg('');
    if (chain === 'stellar') {
      setWithdrawAddress(resolvedStellar || '');
    } else {
      setWithdrawAddress(resolvedXrpl || '');
    }
  };

  const handleWithdrawNrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = readSession();
    if (!session.token) return;

    const numAmount = Number(withdrawAmount);
    if (!numAmount || numAmount <= 0) {
      setWithdrawErrorMsg('Please specify a positive amount of $NXL to withdraw.');
      return;
    }

    const trimmedAddr = withdrawAddress.trim();
    if (withdrawChain === 'stellar') {
      if (!trimmedAddr || !trimmedAddr.startsWith('G') || trimmedAddr.length !== 56) {
        setWithdrawErrorMsg('Please provide a valid 56-character Stellar public address starting with "G".');
        return;
      }
    } else {
      if (!trimmedAddr || !trimmedAddr.startsWith('r') || trimmedAddr.length < 25 || trimmedAddr.length > 36) {
        setWithdrawErrorMsg('Please provide a valid XRPL classic address starting with "r" (e.g. rQ7t2G...).');
        return;
      }
    }

    setWithdrawSubmitting(true);
    setWithdrawErrorMsg('');
    setWithdrawSuccessData(null);

    try {
      const res = await fetch('/api/v1/crypto/nr/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          amount: numAmount,
          chain: withdrawChain === 'xrpl' ? 'XRPL' : 'STELLAR',
          destinationAddress: trimmedAddr,
          destinationStellarAddress: trimmedAddr,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'On-chain withdrawal failed');
      }

      setWithdrawSuccessData({
        txHash: data.data.txHash,
        ledgerSeq: data.data.ledgerSeq,
        amountNr: data.data.amountNr,
        chain: data.data.chain || (withdrawChain === 'xrpl' ? 'XRPL' : 'STELLAR'),
        explorerUrl: data.data.explorerUrl,
        destinationAddress: data.data.destinationAddress || trimmedAddr,
      });
      await fetchPortfolio();
      await fetchProfile();
    } catch (err: any) {
      setWithdrawErrorMsg(err.message || 'On-chain withdrawal failed');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const fetchPortfolio = async () => {
    const session = readSession();
    if (!session.token) return;
    try {
      setPortfolioLoading(true);
      const res = await fetch('/api/v1/portfolio', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setPortfolio(data.data);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Profile] Failed to fetch portfolio:', err.message);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const handleOpenCashout = (holding: HydratedHolding) => {
    setCashoutHolding(holding);
    setCashoutQty(holding.quantity);
    setCashoutErrorMsg('');
    setCashoutSuccessMsg('');
  };

  const handleCashoutSubmit = async () => {
    if (!cashoutHolding || cashoutQty <= 0) return;
    const session = readSession();
    if (!session.token) return;

    setCashoutSubmitting(true);
    setCashoutErrorMsg('');
    setCashoutSuccessMsg('');

    try {
      const res = await fetch('/api/v1/portfolio/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          symbol: cashoutHolding.symbol,
          quantity: cashoutQty,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Liquidation failed');
      }

      setSuccessMsg(
        `Successfully liquidated ${cashoutQty} ${cashoutHolding.symbol}! $${(data.data.net_payout_cents / 100).toFixed(2)} USD net credited to balance (Spread: $${(data.data.spread_fee_cents / 100).toFixed(2)}).`
      );
      setCashoutHolding(null);
      await fetchPortfolio();
      await fetchProfile();
    } catch (err: any) {
      setCashoutErrorMsg(err.message || 'Cashout failed');
    } finally {
      setCashoutSubmitting(false);
    }
  };

  // Fetch live on-chain ledger transactions directly from XRPL / Stellar node
  const fetchLedgerTransactions = async (addressOverride?: string, chainOverride?: 'xrpl' | 'stellar') => {
    const targetChain = chainOverride || activeChain;
    let targetAddr = addressOverride;
    if (!targetAddr) {
      targetAddr = targetChain === 'xrpl' ? resolvedXrpl : resolvedStellar;
    }

    if (!targetAddr) {
      setLedgerTxs([]);
      return;
    }

    setLoadingLedgerTxs(true);
    setLedgerError(null);
    try {
      const res = await fetch(
        `/api/v1/wallet/ledger-transactions?address=${encodeURIComponent(targetAddr)}&chain=${targetChain}&limit=20`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setLedgerTxs(Array.isArray(data.transactions) ? data.transactions : []);
      } else {
        setLedgerError(data.error || 'Failed to query live on-chain ledger');
      }
    } catch (err: any) {
      setLedgerError(err.message || 'Error querying blockchain node');
    } finally {
      setLoadingLedgerTxs(false);
    }
  };

  // Fetch real cross-chain bridge logs from MongoDB platform_chain_logs
  const fetchBridgeHistory = async (addressOverride?: string) => {
    setLoadingBridgeHistory(true);
    try {
      const session = readSession();
      const headers: Record<string, string> = {};
      if (session.token) headers.Authorization = `Bearer ${session.token}`;

      const addr = addressOverride || resolvedStellar || resolvedXrpl || '';
      const q = addr ? `?address=${encodeURIComponent(addr)}&limit=25` : '?limit=25';
      const res = await fetch(`/api/v1/swap/history${q}`, { headers });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setBridgeHistory(data.data);
      }
    } catch (err: any) {
      console.warn('Failed to load cross-chain swap history:', err);
    } finally {
      setLoadingBridgeHistory(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedTxHash(hash);
      setTimeout(() => setCopiedTxHash(null), 2000);
    }
  };

  const handleSwitchActiveChain = (chain: 'xrpl' | 'stellar') => {
    setActiveChain(chain);
    const addr = chain === 'xrpl' ? resolvedXrpl : resolvedStellar;
    if (addr) {
      fetchLedgerTransactions(addr, chain);
    } else {
      setLedgerTxs([]);
    }
  };

  // Load profile from API
  const fetchProfile = async () => {
    const session = readSession();
    if (!session.token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/v1/user/profile', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          router.push('/login');
          return;
        }
        throw new Error('Failed to load profile details');
      }

      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
        setNameInput(data.profile.name || '');

        const curStellar =
          data.profile.stellarAddress ||
          data.profile.wallets?.find((w: any) => w.network === 'stellar')?.address ||
          (data.profile.lastConnectedWallet?.network === 'stellar' ? data.profile.lastConnectedWallet.address : '') ||
          session.user?.stellarAddress ||
          '';

        const curXrpl =
          data.profile.xrplAddress ||
          data.profile.wallets?.find((w: any) => w.network === 'xrpl')?.address ||
          (data.profile.lastConnectedWallet?.network === 'xrpl' ? data.profile.lastConnectedWallet.address : '') ||
          session.user?.xrplAddress ||
          '';

        // Determine default active chain based on available or last connected wallet
        const preferredChain: 'xrpl' | 'stellar' =
          data.profile.lastConnectedWallet?.network === 'stellar' || (!curXrpl && curStellar)
            ? 'stellar'
            : 'xrpl';
        setActiveChain(preferredChain);

        const initialAddr = preferredChain === 'xrpl' ? curXrpl : curStellar;
        if (initialAddr) {
          fetchLedgerTransactions(initialAddr, preferredChain);
        }
        fetchBridgeHistory(initialAddr || undefined);
      } else {
        throw new Error(data.error || 'Could not retrieve profile');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching user profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPortfolio();
    fetchInternalBalance();
  }, []);

  // Update Name
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setSavingName(true);
    setErrorMsg('');
    setSuccessMsg('');

    const session = readSession();
    if (!session.token) return;

    try {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ name: nameInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Profile name updated successfully.');
        setIsEditingName(false);
        // Update local session
        if (session.user) {
          const updatedUser: SessionUser = { ...session.user, name: nameInput.trim() };
          localStorage.setItem('nexus_user', JSON.stringify(updatedUser));
          notifySession();
        }
        await fetchProfile();
      } else {
        throw new Error(data.error || 'Failed to update name');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not update profile name');
    } finally {
      setSavingName(false);
    }
  };

  // Disconnect a specific network wallet
  const handleDisconnectWallet = async (network: 'stellar' | 'xrpl') => {
    const session = readSession();
    if (!session.token) return;

    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/v1/user/wallets/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ network }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`${network === 'stellar' ? 'Stellar' : 'XRP Ledger'} wallet disconnected.`);
        if (data.token && data.user) {
          localStorage.setItem('nexus_token', data.token);
          localStorage.setItem('nexus_user', JSON.stringify(data.user));
          try {
            const last = localStorage.getItem('nexus_last_wallet');
            if (last) {
              const parsed = JSON.parse(last);
              if (parsed?.network === network) {
                localStorage.removeItem('nexus_last_wallet');
              }
            }
          } catch {}
          notifySession();
        }
        await fetchProfile();
        if (activeChain === network) {
          setLedgerTxs([]);
        }
      } else {
        throw new Error(data.error || 'Failed to disconnect wallet');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect wallet');
    }
  };

  const handleWalletModalConnected = async (account: WalletConnectedAccount) => {
    setSuccessMsg(`${account.chain === 'stellar' ? 'Stellar' : 'XRP Ledger'} wallet connected: ${account.address.slice(0, 6)}...${account.address.slice(-4)}`);
    setWalletModalOpen(false);
    await fetchProfile();
    await fetchPortfolio();
    if (account.chain === activeChain) {
      fetchLedgerTransactions(account.address, account.chain);
    }
  };

  const handleSignOut = () => {
    clearSession();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6">
        <div className="nexus-glass-card p-6 rounded-2xl border border-[var(--border)] text-xs font-mono text-[var(--muted)] flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin text-[var(--gold)]" />
          <span>Loading your NexusRail profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
      {/* Wallet Connect / Replace Modal */}
      <WalletConnectModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        initialNetwork={targetNetwork}
        onConnected={handleWalletModalConnected}
      />

      {/* 1-Click Multi-Rail Cashout Modal */}
      {cashoutHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--border-highlight)] p-6 sm:p-8 space-y-6 shadow-2xl relative text-left">
            <button
              type="button"
              onClick={() => setCashoutHolding(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-subtle)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--gold)]">
                <Coins className="w-3.5 h-3.5" />
                <span>1-Click Multi-Rail Cashout</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--foreground)]">
                Liquidate {cashoutHolding.label}
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Instant liquidation at live market oracle rates minus a 0.50% platform spread. Proceeds are credited directly to your internal USD wallet.
              </p>
            </div>

            {/* Live Pricing Reference */}
            <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Live Oracle Price:</span>
                <span className="font-bold text-[var(--foreground)]">
                  ${(cashoutHolding.current_price_cents / 100).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Owned Quantity:</span>
                <span className="font-bold text-[var(--gold)]">
                  {cashoutHolding.quantity} {cashoutHolding.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Average Cost Basis:</span>
                <span>${(cashoutHolding.avg_buy_price_cents / 100).toFixed(2)} USD</span>
              </div>
            </div>

            {/* Quantity Selector & Percentage Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-[var(--muted)] flex justify-between">
                <span>Quantity to Sell:</span>
                <span className="text-[var(--foreground)] font-bold">{cashoutQty}</span>
              </label>
              <input
                type="number"
                min="0.000001"
                max={cashoutHolding.quantity}
                step="any"
                value={cashoutQty}
                onChange={(e) => setCashoutQty(Math.min(cashoutHolding.quantity, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-full px-4 py-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-sm font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--gold)]"
              />

              {/* Quick % buttons */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCashoutQty(Number((cashoutHolding.quantity * pct).toFixed(6)))}
                    className="py-1.5 rounded-lg bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-mono font-semibold text-[var(--foreground)] transition-colors cursor-pointer"
                  >
                    {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Calculation Breakdown */}
            {cashoutQty > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2 text-xs font-mono">
                {(() => {
                  const grossCents = Math.round(cashoutQty * cashoutHolding.current_price_cents);
                  const spreadCents = Math.round(grossCents * 0.005);
                  const netCents = grossCents - spreadCents;
                  const costPortion = cashoutHolding.quantity > 0
                    ? Math.round(cashoutHolding.total_cost_cents * (cashoutQty / cashoutHolding.quantity))
                    : 0;
                  const pnlCents = netCents - costPortion;

                  return (
                    <>
                      <div className="flex justify-between text-amber-200">
                        <span>Gross Market Proceeds:</span>
                        <span>${(grossCents / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-amber-300/80">
                        <span>Platform Spread Fee (0.50%):</span>
                        <span>-${(spreadCents / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-400 border-t border-amber-500/20 pt-1.5">
                        <span>Net Payout to USD Balance:</span>
                        <span>+${(netCents / 100).toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[var(--muted)] pt-0.5">
                        <span>Est. Realized P&L on Cashout:</span>
                        <span className={pnlCents >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {pnlCents >= 0 ? '+' : ''}${(pnlCents / 100).toFixed(2)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {cashoutErrorMsg && (
              <p className="text-xs font-mono text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {cashoutErrorMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCashoutHolding(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCashoutSubmit}
                disabled={cashoutSubmitting || cashoutQty <= 0}
                className="flex-1 py-3 rounded-xl bg-[var(--gold)] hover:bg-[#68e0b0] disabled:opacity-50 text-black font-mono font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[var(--gold)]/20"
              >
                {cashoutSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Liquidating...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Confirm 1-Click Cashout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-Chain Stellar $NR Withdrawal Modal (Module 4) */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--border-highlight)] p-6 sm:p-8 space-y-6 shadow-2xl relative text-left">
            <button
              type="button"
              onClick={() => {
                setWithdrawModalOpen(false);
                setWithdrawSuccessData(null);
                setWithdrawErrorMsg('');
              }}
              className="absolute top-5 right-5 p-2 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-subtle)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37]">
                <Cpu className="w-3.5 h-3.5" />
                <span>Dual-Rail Settlement (Stellar Protocol 22 + XRPL XLS-30d)</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--foreground)]">
                Withdraw $NXL On-Chain
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Mint or transfer internal <strong className="text-[var(--gold)]">$NXL</strong> tokens to your self-custodial wallet on either Stellar Testnet or XRP Ledger with guaranteed 1:1 cross-rail parity.
              </p>
            </div>

            {/* Network Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--card-subtle)] rounded-2xl border border-[var(--border)] font-mono text-xs">
              <button
                type="button"
                onClick={() => handleSwitchWithdrawChain('stellar')}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  withdrawChain === 'stellar'
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-bold border border-[#00E5FF]/40 shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#00E5FF]" />
                <span>Stellar (XLM / SEP-0001)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchWithdrawChain('xrpl')}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  withdrawChain === 'xrpl'
                    ? 'bg-[#0081F2]/15 text-[#0081F2] font-bold border border-[#0081F2]/40 shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#0081F2]" />
                <span>XRPL (XLS-30d AMM)</span>
              </button>
            </div>

            {withdrawSuccessData ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>On-Chain {withdrawSuccessData.chain} Transfer Confirmed!</span>
                  </div>
                  <p className="text-[var(--foreground)]">
                    Successfully transferred <strong className="text-emerald-300">{withdrawSuccessData.amountNr} $NXL</strong> tokens to your external {withdrawSuccessData.chain === 'XRPL' ? 'XRP Ledger' : 'Stellar'} address.
                  </p>
                  <div className="pt-2 border-t border-emerald-500/20 space-y-1 text-[11px] text-[var(--muted)]">
                    {withdrawSuccessData.ledgerSeq && <p>Ledger Sequence: #{withdrawSuccessData.ledgerSeq}</p>}
                    <p className="truncate">Destination: {withdrawSuccessData.destinationAddress}</p>
                    <p className="truncate">Tx Hash: {withdrawSuccessData.txHash}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={withdrawSuccessData.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-center text-[#D4AF37] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View on {withdrawSuccessData.chain === 'XRPL' ? 'XRPL Testnet' : 'Stellar.Expert'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawModalOpen(false);
                      setWithdrawSuccessData(null);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-[var(--gold)] text-black font-bold transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleWithdrawNrSubmit} className="space-y-4 font-mono text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[var(--muted)]">
                    <label>
                      {withdrawChain === 'stellar'
                        ? 'Destination Stellar Address (starts with G...)'
                        : 'Destination XRPL Address (starts with r...)'}
                    </label>
                    {((withdrawChain === 'stellar' && profile?.stellarAddress) ||
                      (withdrawChain === 'xrpl' && profile?.xrplAddress)) && (
                      <button
                        type="button"
                        onClick={() =>
                          setWithdrawAddress(
                            withdrawChain === 'stellar'
                              ? profile?.stellarAddress || ''
                              : profile?.xrplAddress || ''
                          )
                        }
                        className="text-[#D4AF37] hover:underline text-[11px] cursor-pointer"
                      >
                        Use Verified Wallet
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder={
                      withdrawChain === 'stellar'
                        ? 'e.g. G... (56-character Stellar Public Key)'
                        : 'e.g. r... (XRPL Classic Address)'
                    }
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                  <p className="text-[11px] text-[var(--muted)]">
                    {withdrawChain === 'stellar'
                      ? `Protocol 22 Asset Contract: ${config?.assets?.nxl?.stellarContractId || 'Unavailable'}`
                      : `XRPL Issued Currency: ${config?.assets?.nxl?.xrplCurrency || 'Unavailable'}`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[var(--muted)]">
                    <label>Withdrawal Amount ($NXL)</label>
                    <span className="text-[var(--gold)]">
                      Available: {withdrawNrHolding ? withdrawNrHolding.quantity : 0} $NXL
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min="0.000001"
                      step="any"
                      max={withdrawNrHolding ? withdrawNrHolding.quantity : undefined}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(String(withdrawNrHolding?.quantity || ''))}
                      className="px-4 py-3 rounded-2xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] text-xs font-bold cursor-pointer"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {withdrawErrorMsg && (
                  <p className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {withdrawErrorMsg}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={withdrawSubmitting || !withdrawAmount || Number(withdrawAmount) <= 0}
                    className="flex-1 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#F2D675] text-black text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-lg shadow-[#D4AF37]/20"
                  >
                    {withdrawSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Broadcasting to {withdrawChain === 'xrpl' ? 'XRPL' : 'Stellar'}...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Confirm {withdrawChain === 'xrpl' ? 'XRPL' : 'Stellar'} Withdrawal</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Top Breadcrumb & Page Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
            nexusrail
          </Link>
          <span>/</span>
          <span className="text-[var(--gold)]">user profile</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
              Account &amp; Security
            </h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              Manage your profile details, verified Web3 wallets, and session preferences.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 rounded-xl bg-[var(--card-subtle)] hover:bg-rose-500/10 border border-[var(--border)] hover:border-rose-500/30 text-xs font-mono text-rose-400 flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Notification Alerts */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-mono font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-xs font-mono text-[var(--gold)] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-mono">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-xs font-mono text-rose-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: User Profile & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-2 nexus-glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border)] space-y-6">
          <div className="flex items-start justify-between border-b border-[var(--border)] pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border-highlight)] flex items-center justify-center text-[var(--gold)]">
                <UserIcon className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[var(--foreground)]">
                    {profile?.name || 'Nexus Traveler'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[11px] font-mono text-[var(--gold)] uppercase font-semibold">
                    {profile?.role || 'User'}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] font-mono mt-0.5">
                  ID: {profile?.id}
                </p>
              </div>
            </div>

            {!isEditingName && (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="p-2 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit Name</span>
              </button>
            )}
          </div>

          {/* Edit Name Form */}
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="space-y-3 p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)]">
              <label className="text-xs font-mono text-[var(--muted)] block">
                Update Display Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your display name"
                  maxLength={80}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--gold)]"
                />
                <button
                  type="submit"
                  disabled={savingName || !nameInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--gold)] text-[#08090C] text-xs font-mono font-bold hover:bg-[var(--gold-bright)] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setNameInput(profile?.name || '');
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {/* Account Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block">
                Email Address
              </span>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--gold)] shrink-0" />
                <span className="text-xs font-mono text-[var(--foreground)] truncate">
                  {profile?.email || 'No email attached (Wallet-only)'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block">
                Member Since
              </span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--gold)] shrink-0" />
                <span className="text-xs font-mono text-[var(--foreground)]">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Summary Card */}
        <div className="nexus-glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border)] flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <h3 className="font-bold text-sm text-[var(--foreground)]">Commerce Activity</h3>
              <ShoppingBag className="w-4 h-4 text-[var(--gold)]" />
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-emerald-300 font-bold">Internal NexusRail Custody</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Off-Chain Claim · 1:1 Backed
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono text-emerald-300">
                    ${((internalBalance?.usdCents || 0) / 100).toFixed(2)} USD
                  </span>
                  <span className="text-xs font-mono text-[var(--gold)]">
                    {((internalBalance?.nxlMicro || 0) / 1_000_000).toFixed(4)} NXL
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[var(--muted)]">
                  Distinct from your connected Freighter/GemWallet on-chain balance below. Withdraw $NXL to Stellar or XRPL 1:1 anytime.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] flex items-center justify-between">
                <span className="text-xs font-mono text-[var(--muted)]">Total Orders</span>
                <span className="text-lg font-bold font-mono text-[var(--foreground)]">
                  {profile?.stats?.totalOrders || 0}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] flex items-center justify-between">
                <span className="text-xs font-mono text-[var(--muted)]">Total Spend</span>
                <span className="text-lg font-bold font-mono text-[var(--gold)]">
                  ${((profile?.stats?.totalSpentCents || 0) / 100).toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/orders"
            className="w-full py-3 px-4 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] flex items-center justify-center gap-2 transition-colors"
          >
            <span>View Full Order History</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--gold)]" />
          </Link>
        </div>
      </div>

      {/* LIVE ASSET PORTFOLIO & REAL-TIME P&L SECTION (MODULE 3) */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Live Asset Custody Portfolio &amp; P&amp;L
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Live market valuations from Binance 24hr and Gold-API oracles. Decomposed from your Smart Baskets and single asset packs. Liquidate anytime with 1-click.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchPortfolio}
            disabled={portfolioLoading}
            className="px-4 py-2 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-mono text-[var(--foreground)] flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--gold)] ${portfolioLoading ? 'animate-spin' : ''}`} />
            <span>Sync Live Prices</span>
          </button>
        </div>

        {/* 4 Summary Banner Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Invested Cost */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
              TOTAL INVESTED COST
            </span>
            <p className="text-xl sm:text-2xl font-mono font-bold text-[var(--foreground)]">
              ${((portfolio?.total_cost_cents || 0) / 100).toFixed(2)} USD
            </p>
            <p className="text-[11px] font-mono text-[var(--muted)]">
              Weighted-average cost basis
            </p>
          </div>

          {/* Card 2: Current Portfolio Value */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
              CURRENT MARKET VALUE
            </span>
            <p className="text-xl sm:text-2xl font-mono font-bold text-[var(--gold)]">
              ${((portfolio?.total_current_value_cents || 0) / 100).toFixed(2)} USD
            </p>
            <p className="text-[11px] font-mono text-emerald-400">
              ≈ ₹{(portfolio?.inr_total_current_value || 0).toLocaleString('en-IN')} INR
            </p>
          </div>

          {/* Card 3: Net Unrealized P&L */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
              NET UNREALIZED P&amp;L
            </span>
            {(() => {
              const pnlCents = portfolio?.total_unrealized_pnl_cents || 0;
              const pnlPct = portfolio?.total_unrealized_pnl_percent || 0;
              const isPositive = pnlCents >= 0;
              return (
                <>
                  <div className={`flex items-center gap-1.5 text-xl sm:text-2xl font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? <TrendingUp className="w-5 h-5 shrink-0" /> : <TrendingDown className="w-5 h-5 shrink-0" />}
                    <span>{isPositive ? '+' : ''}${(pnlCents / 100).toFixed(2)}</span>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                    {isPositive ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                </>
              );
            })()}
          </div>

          {/* Card 4: Total Realized Gains */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
              REALIZED CASHOUT GAINS
            </span>
            <p className="text-xl sm:text-2xl font-mono font-bold text-[var(--foreground)]">
              ${((portfolio?.total_realized_pnl_cents || 0) / 100).toFixed(2)} USD
            </p>
            <p className="text-[11px] font-mono text-[var(--muted)]">
              Past 1-click cashouts
            </p>
          </div>
        </div>

        {/* Holdings Cards Grid */}
        {portfolioLoading ? (
          <div className="nexus-glass-card p-8 rounded-3xl border border-[var(--border)] text-center text-xs font-mono text-[var(--muted)] flex items-center justify-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--gold)]" />
            <span>Hydrating real-time asset quotes and cost basis...</span>
          </div>
        ) : !portfolio || portfolio.holdings.length === 0 ? (
          <div className="nexus-glass-card p-8 rounded-3xl border border-dashed border-[var(--border)] text-center space-y-3">
            <Coins className="w-8 h-8 text-[var(--muted)] mx-auto opacity-50" />
            <h3 className="text-sm font-bold text-[var(--foreground)]">No Active Custody Holdings Yet</h3>
            <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
              When you purchase Smart Baskets or Live RWA Asset Packs in the Store, your underlying gold, silver, XRP, XLM, and $NXL tokens are automatically tracked here in real-time.
            </p>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gold)] hover:bg-[#68e0b0] text-black font-mono font-bold text-xs transition-colors mt-2"
            >
              <span>Explore Smart Baskets Store</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {portfolio.holdings.map((h) => {
              const isProfit = h.unrealized_pnl_cents >= 0;
              const has24hChange = typeof h.change_24h_percent === 'number';
              const is24hUp = (h.change_24h_percent || 0) >= 0;

              return (
                <div
                  key={h.symbol}
                  className="nexus-glass-card p-6 rounded-3xl border border-[var(--border)] hover:border-[var(--border-highlight)] transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)]" />
                          <h3 className="font-bold text-sm text-[var(--foreground)]">{h.label}</h3>
                        </div>
                        <span className="text-[11px] font-mono text-[var(--muted)] uppercase tracking-wider block mt-0.5">
                          {h.symbol} • Oracle: {h.oracle_source}
                        </span>
                      </div>

                      {has24hChange && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1 shrink-0 ${is24hUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                          {is24hUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{is24hUp ? '+' : ''}{(h.change_24h_percent || 0).toFixed(2)}% 24h</span>
                        </span>
                      )}
                    </div>

                    {/* Quantity & Value */}
                    <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-2 font-mono text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[var(--muted)]">Holding Balance:</span>
                        <span className="text-base font-bold text-[var(--foreground)]">
                          {h.quantity} {h.symbol === 'GOLD_G' ? 'g Gold' : h.symbol === 'SILVER_G' ? 'g Silver' : h.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[var(--muted)]">Current Position Value:</span>
                        <span className="font-bold text-[var(--gold)]">
                          ${(h.current_value_cents / 100).toFixed(2)} USD
                        </span>
                      </div>
                    </div>

                    {/* Valuation & Cost Basis Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-[var(--card-subtle)]/50 border border-[var(--border)]/50">
                        <span className="text-[11px] text-[var(--muted)] block">Avg Cost Basis</span>
                        <span className="font-semibold text-[var(--foreground)]">
                          ${(h.avg_buy_price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[var(--card-subtle)]/50 border border-[var(--border)]/50">
                        <span className="text-[11px] text-[var(--muted)] block">Live Market Price</span>
                        <span className="font-semibold text-[var(--foreground)]">
                          ${(h.current_price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Unrealized P&L Badge */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono font-semibold ${isProfit ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                      <span className="text-[11px]">Unrealized P&amp;L:</span>
                      <div className="flex items-center gap-1.5">
                        <span>{isProfit ? '+' : ''}${(h.unrealized_pnl_cents / 100).toFixed(2)}</span>
                        <span>({isProfit ? '+' : ''}{h.unrealized_pnl_percent.toFixed(2)}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Cashout & On-Chain Withdrawal for $NR */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCashout(h)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--gold)]/20 border border-[var(--border)] hover:border-[var(--gold)] text-xs font-mono font-bold text-[var(--foreground)] hover:text-[var(--gold)] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>1-Click Cashout / Sell</span>
                    </button>

                    {h.symbol === 'NXL' && (
                      <button
                        type="button"
                        onClick={() => handleOpenWithdrawNr(h)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/30 text-xs font-mono font-bold text-[#00E5FF] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Withdraw $NXL On-Chain</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VERIFIED WALLETS SECTION (Dual-Rail Model: Exactly 1 Stellar + 1 XRPL) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--gold)]" />
              <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Verified Blockchain Wallets
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[11px] font-mono text-[var(--gold)] font-bold">
                Dual-Rail Policy (Max 2)
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              NexusRail allows connecting up to <strong>two active wallets simultaneously</strong> — exactly one for Stellar (Freighter, Albedo, LOBSTR) and one for XRP Ledger (GemWallet, Crossmark, Xaman). Connecting or replacing one rail never affects the other.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* STELLAR WALLET CARD */}
          <div className="nexus-glass-card p-6 rounded-3xl border border-[var(--border)] space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                  <div>
                    <h3 className="font-bold text-sm text-[var(--foreground)]">Stellar Network (XLM)</h3>
                    <span className="text-[11px] font-mono text-[var(--muted)]">Rail 1 · Horizon &amp; Soroban</span>
                  </div>
                </div>
                {resolvedStellar ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{stellarProvider || 'Freighter'} Active</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-[var(--card-subtle)] text-[11px] font-mono text-[var(--muted)]">
                    Slot Available
                  </span>
                )}
              </div>

              {resolvedStellar ? (
                <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[var(--muted)] uppercase tracking-wider block">
                      Stellar Public Key
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(resolvedStellar)}
                      className="text-[11px] font-mono text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedTxHash === resolvedStellar ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedTxHash === resolvedStellar ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs font-mono text-[var(--foreground)] break-all font-semibold select-all">
                    {resolvedStellar}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--muted)] font-mono border-t border-[var(--border)]/50">
                    <span>Compatible with Soroban &amp; SEP-0007</span>
                    {config?.explorers?.stellarAccount ? (
                      <a
                        href={`${config.explorers.stellarAccount}${resolvedStellar}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <span>Stellar Expert</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span>Explorer unavailable</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--card-subtle)] border border-dashed border-[var(--border)] text-center space-y-2">
                  <Wallet className="w-6 h-6 text-[var(--muted)] mx-auto" />
                  <p className="text-xs text-[var(--muted)] font-mono">
                    No Stellar wallet connected. Connect Freighter, Albedo, or LOBSTR.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTargetNetwork('stellar');
                  setWalletModalOpen(true);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-mono font-bold text-[var(--foreground)] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>{resolvedStellar ? 'Switch Stellar Wallet' : 'Connect Stellar Wallet'}</span>
              </button>

              {resolvedStellar && (
                <button
                  type="button"
                  onClick={() => handleDisconnectWallet('stellar')}
                  title="Disconnect Stellar Wallet"
                  className="p-2.5 rounded-xl bg-[var(--card-subtle)] hover:bg-rose-500/10 border border-[var(--border)] text-rose-400 transition-colors cursor-pointer"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* XRP LEDGER WALLET CARD */}
          <div className="nexus-glass-card p-6 rounded-3xl border border-[var(--border)] space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                  <div>
                    <h3 className="font-bold text-sm text-[var(--foreground)]">XRP Ledger (XRP)</h3>
                    <span className="text-[11px] font-mono text-[var(--muted)]">Rail 2 · Altnet &amp; XLS-30d</span>
                  </div>
                </div>
                {resolvedXrpl ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{xrplProvider || 'GemWallet'} Active</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-[var(--card-subtle)] text-[11px] font-mono text-[var(--muted)]">
                    Slot Available
                  </span>
                )}
              </div>

              {resolvedXrpl ? (
                <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[var(--muted)] uppercase tracking-wider block">
                      XRPL Account Address
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(resolvedXrpl)}
                      className="text-[11px] font-mono text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedTxHash === resolvedXrpl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedTxHash === resolvedXrpl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs font-mono text-[var(--foreground)] break-all font-semibold select-all">
                    {resolvedXrpl}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--muted)] font-mono border-t border-[var(--border)]/50">
                    <span>Compatible with XLS-30d AMM &amp; Escrow</span>
                    {config?.explorers?.xrplAccount ? (
                      <a
                        href={`${config.explorers.xrplAccount}${resolvedXrpl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>XRPL Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span>Explorer unavailable</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--card-subtle)] border border-dashed border-[var(--border)] text-center space-y-2">
                  <Wallet className="w-6 h-6 text-[var(--muted)] mx-auto" />
                  <p className="text-xs text-[var(--muted)] font-mono">
                    No XRP Ledger wallet connected. Connect GemWallet, Crossmark, or Xaman.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTargetNetwork('xrpl');
                  setWalletModalOpen(true);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-mono font-bold text-[var(--foreground)] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>{resolvedXrpl ? 'Switch XRP Wallet' : 'Connect XRP Wallet'}</span>
              </button>

              {resolvedXrpl && (
                <button
                  type="button"
                  onClick={() => handleDisconnectWallet('xrpl')}
                  title="Disconnect XRPL Wallet"
                  className="p-2.5 rounded-xl bg-[var(--card-subtle)] hover:bg-rose-500/10 border border-[var(--border)] text-rose-400 transition-colors cursor-pointer"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LIVE CONNECTED LEDGER ON-CHAIN TRANSACTIONS (100% REAL NODE DATA) */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Live Connected Ledger Activity
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Live transactions queried directly from the {activeChain === 'xrpl' ? 'XRP Ledger (Altnet)' : 'Stellar Network (Horizon Testnet)'} node. ZERO fake data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Filter: Ledger Feed vs Cross-Chain Bridge */}
            <div className="p-1 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] flex gap-1">
              <button
                type="button"
                onClick={() => setActiveHistoryTab('ledger')}
                className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeHistoryTab === 'ledger'
                    ? 'bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>On-Chain Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveHistoryTab('bridge');
                  fetchBridgeHistory();
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeHistoryTab === 'bridge'
                    ? 'bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
                <span>Cross-Chain Bridge</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                if (activeHistoryTab === 'ledger') fetchLedgerTransactions();
                else fetchBridgeHistory();
              }}
              disabled={loadingLedgerTxs || loadingBridgeHistory}
              className="p-2 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-mono text-[var(--foreground)] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh Transactions"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--gold)] ${loadingLedgerTxs || loadingBridgeHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {activeHistoryTab === 'ledger' && (
          <div className="space-y-4">
            {/* Connected Network Toggle Switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--muted)]">Active Ledger:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchActiveChain('xrpl')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeChain === 'xrpl'
                        ? 'bg-[#0081F2]/20 border border-[#0081F2]/50 text-[#0081F2] shadow-sm'
                        : 'text-[var(--muted)] hover:text-[var(--foreground)] border border-transparent'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#0081F2]" />
                    <span>XRPL Testnet</span>
                    {resolvedXrpl && <span className="text-[11px] opacity-75 font-normal">({resolvedXrpl.slice(0, 4)}...{resolvedXrpl.slice(-3)})</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchActiveChain('stellar')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeChain === 'stellar'
                        ? 'bg-[#00E5FF]/20 border border-[#00E5FF]/50 text-[#00E5FF] shadow-sm'
                        : 'text-[var(--muted)] hover:text-[var(--foreground)] border border-transparent'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#00E5FF]" />
                    <span>Stellar Testnet</span>
                    {resolvedStellar && <span className="text-[11px] opacity-75 font-normal">({resolvedStellar.slice(0, 4)}...{resolvedStellar.slice(-3)})</span>}
                  </button>
                </div>
              </div>

              {/* Current Active Address Badge */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[var(--muted)]">Queried Account:</span>
                {(activeChain === 'xrpl' ? resolvedXrpl : resolvedStellar) ? (
                  <span className="font-semibold text-[var(--gold)] truncate max-w-[220px]" title={activeChain === 'xrpl' ? resolvedXrpl : resolvedStellar}>
                    {activeChain === 'xrpl' ? resolvedXrpl : resolvedStellar}
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium">None Connected</span>
                )}
              </div>
            </div>

            {/* Content States */}
            {!(activeChain === 'xrpl' ? resolvedXrpl : resolvedStellar) ? (
              <div className="nexus-glass-card p-8 rounded-3xl border border-dashed border-[var(--border)] text-center space-y-3">
                <Wallet className="w-8 h-8 text-[var(--muted)] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  No {activeChain === 'xrpl' ? 'XRP Ledger' : 'Stellar'} Wallet Connected
                </h3>
                <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
                  Connect your {activeChain === 'xrpl' ? 'GemWallet, Crossmark, or Xaman' : 'Freighter, Albedo, or LOBSTR'} wallet to view its live on-chain transaction history.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTargetNetwork(activeChain);
                    setWalletModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gold)] hover:bg-[#68e0b0] text-black font-mono font-bold text-xs transition-colors mt-2 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Connect {activeChain === 'xrpl' ? 'XRP Ledger' : 'Stellar'} Wallet</span>
                </button>
              </div>
            ) : loadingLedgerTxs ? (
              <div className="nexus-glass-card p-10 rounded-3xl border border-[var(--border)] text-center text-xs font-mono text-[var(--muted)] flex items-center justify-center gap-3 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--gold)]" />
                <span>Querying live {activeChain === 'xrpl' ? 'XRP Ledger' : 'Stellar'} on-chain transactions...</span>
              </div>
            ) : ledgerError ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center justify-between">
                <span>{ledgerError}</span>
                <button
                  type="button"
                  onClick={() => fetchLedgerTransactions()}
                  className="text-[var(--gold)] hover:underline ml-3 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : ledgerTxs.length === 0 ? (
              <div className="nexus-glass-card p-8 rounded-3xl border border-[var(--border)] text-center space-y-2">
                <Layers className="w-7 h-7 text-[var(--muted)] mx-auto opacity-50" />
                <p className="text-sm font-bold text-[var(--foreground)]">No On-Chain Transactions Recorded Yet</p>
                <p className="text-xs text-[var(--muted)] font-mono max-w-md mx-auto">
                  This address has no transactions on {activeChain === 'xrpl' ? 'XRPL Testnet' : 'Stellar Horizon Testnet'}. Execute a swap or fund your wallet to see real-time on-chain logs.
                </p>
              </div>
            ) : (
              <div className="nexus-glass-card rounded-3xl border border-[var(--border)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--card-subtle)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
                        <th className="py-3 px-4">Direction / Type</th>
                        <th className="py-3 px-4">Amount / Asset</th>
                        <th className="py-3 px-4">Counterparty</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Explorer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {ledgerTxs.map((tx: any, idx: number) => {
                        const isIncoming = tx.isIncoming === true || tx.direction === 'in';
                        const isOutgoing = tx.isIncoming === false || tx.direction === 'out';
                        const directionLabel = isIncoming ? 'in' : isOutgoing ? 'out' : tx.direction || 'transfer';
                        const counterparty = tx.counterparty || (isIncoming ? tx.sender : tx.destination);
                        const txDate = tx.timestamp || tx.date;
                        const isFailed = tx.status === 'FAILED';
                        const hasRealHash = isRealOnChainTxHash(tx.txHash);
                        return (
                          <tr key={tx.txHash || idx} className="hover:bg-[var(--card-hover)] transition-colors">
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`p-1 rounded-md border flex items-center justify-center ${
                                    isIncoming
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                      : isOutgoing
                                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                  }`}
                                >
                                  {isIncoming ? (
                                    <ArrowDownLeft className="w-3.5 h-3.5" />
                                  ) : isOutgoing ? (
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  ) : (
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  )}
                                </span>
                                <div>
                                  <span className="font-bold text-[var(--foreground)]">{tx.type || 'Transaction'}</span>
                                  <span className="block text-[11px] text-[var(--muted)] uppercase">{directionLabel}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`font-bold ${isIncoming ? 'text-emerald-400' : 'text-[var(--foreground)]'}`}>
                                {isIncoming ? '+' : isOutgoing ? '-' : ''}{tx.amount || '0'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {counterparty ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[var(--muted)]">
                                    {counterparty.slice(0, 6)}...{counterparty.slice(-4)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyHash(counterparty)}
                                    title="Copy counterparty address"
                                    className="text-[var(--muted)] hover:text-[var(--gold)] cursor-pointer"
                                  >
                                    {copiedTxHash === counterparty ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap text-[var(--muted)] text-[11px]">
                              {txDate ? new Date(txDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit border ${
                                  isFailed
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                }`}
                              >
                                {isFailed ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                <span>{tx.status || 'SUCCESS'}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap text-right">
                              {tx.explorerUrl && hasRealHash ? (
                                <a
                                  href={tx.explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[var(--gold)] hover:underline text-[11px] cursor-pointer"
                                  title={tx.txHash}
                                >
                                  <span>{tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cross-Chain Bridge History Tab */}
        {activeHistoryTab === 'bridge' && (
          <div className="space-y-4">
            {loadingBridgeHistory ? (
              <div className="nexus-glass-card p-10 rounded-3xl border border-[var(--border)] text-center text-xs font-mono text-[var(--muted)] flex items-center justify-center gap-3 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--gold)]" />
                <span>Loading cross-chain bridge logs...</span>
              </div>
            ) : bridgeHistory.length === 0 ? (
              <div className="nexus-glass-card p-8 rounded-3xl border border-[var(--border)] text-center space-y-2">
                <ArrowDownUp className="w-7 h-7 text-[var(--muted)] mx-auto opacity-50" />
                <p className="text-sm font-bold text-[var(--foreground)]">No Cross-Chain Bridge Swaps Yet</p>
                <p className="text-xs text-[var(--muted)] font-mono max-w-md mx-auto">
                  Execute a cross-chain swap from XRP to $NXL or Stellar XLM to see your complete bridge settlement ledger history here.
                </p>
                <Link
                  href="/swap"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gold)] hover:bg-[#68e0b0] text-black font-mono font-bold text-xs transition-colors mt-2"
                >
                  <span>Go to Cross-Chain Swap</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="nexus-glass-card rounded-3xl border border-[var(--border)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--card-subtle)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
                        <th className="py-3 px-4">Action / Chain</th>
                        <th className="py-3 px-4">Swap Amount</th>
                        <th className="py-3 px-4">Destination Address</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Sequential Tx Hashes (In → Out)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {bridgeHistory.map((b: any, idx: number) => {
                        const legs: SwapTransactionLeg[] = Array.isArray(b.transactions) ? b.transactions : [];
                        const isSuccess = b.status === 'COMPLETED' || b.status === 'SUCCESS' || b.status === 'CONFIRMED';
                        const isFailed = b.status === 'FAILED';
                        return (
                          <tr key={b.id || idx} className="hover:bg-[var(--card-hover)] transition-colors align-top">
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isFailed ? 'bg-rose-400' : isSuccess ? 'bg-emerald-400' : 'bg-amber-400'
                                  }`}
                                />
                                <div>
                                  <span className="font-bold text-[var(--foreground)]">
                                    {getSwapTypeLabel(b)}
                                  </span>
                                  <span className="block text-[11px] text-[var(--muted)]">Rail: {b.chain || 'INTERNAL'}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap font-bold text-emerald-400">
                              {b.amount || 'NXL'}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="text-[var(--muted)]">
                                {b.destinationAddress
                                  ? b.destinationAddress.length > 18
                                    ? `${b.destinationAddress.slice(0, 6)}...${b.destinationAddress.slice(-4)}`
                                    : b.destinationAddress
                                  : '—'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap text-[var(--muted)] text-[11px]">
                              {b.createdAt ? new Date(b.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit border ${
                                  isFailed
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                    : isSuccess
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                }`}
                              >
                                {isFailed ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                <span>{b.status || 'CONFIRMED'}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              {legs.length > 0 ? (
                                <div className="flex flex-col items-end gap-1">
                                  {legs.map((leg, lIdx) => {
                                    const hasRealHash = isRealOnChainTxHash(leg.txHash);
                                    return (
                                      <div key={`${leg.sequence}-${lIdx}`} className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-[var(--muted)]">
                                          #{leg.sequence || lIdx + 1} {leg.direction === 'INCOMING' ? 'IN' : 'OUT'}:
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                            leg.status === 'FAILED'
                                              ? 'bg-rose-500/15 text-rose-400'
                                              : leg.status === 'SUCCESS'
                                              ? 'bg-emerald-500/15 text-emerald-400'
                                              : 'bg-amber-500/15 text-amber-300'
                                          }`}
                                        >
                                          {leg.status}
                                        </span>
                                        {hasRealHash && leg.explorerUrl ? (
                                          <a
                                            href={leg.explorerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[var(--gold)] hover:underline cursor-pointer"
                                            title={leg.txHash!}
                                          >
                                            <span>{leg.txHash!.slice(0, 6)}...{leg.txHash!.slice(-6)}</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        ) : leg.rail === 'INTERNAL_LEDGER' ? (
                                          <span className="text-[var(--muted)]">Internal Ledger</span>
                                        ) : (
                                          <span className="text-[var(--muted)]">No tx hash</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : isRealOnChainTxHash(b.txHash) && b.explorerUrl ? (
                                <a
                                  href={b.explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[var(--gold)] hover:underline text-[11px] cursor-pointer"
                                >
                                  <span>{b.txHash.slice(0, 8)}...{b.txHash.slice(-6)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-[var(--muted)]">Internal Ledger</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RECENTLY CONNECTED WALLET METADATA */}
      {(profile?.lastConnectedWallet || sessionUser?.lastConnectedWallet) && (
        <div className="p-4 rounded-2xl nexus-glass-card border border-[var(--border)] text-xs font-mono text-[var(--muted)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--gold)]" />
            <span>
              Last connected via <strong>{(profile?.lastConnectedWallet || sessionUser?.lastConnectedWallet)?.provider}</strong> on {new Date((profile?.lastConnectedWallet || sessionUser?.lastConnectedWallet)!.connectedAt).toLocaleString()}
            </span>
          </div>
          <span className="uppercase text-[11px] px-2 py-0.5 rounded bg-[var(--card-subtle)] text-[var(--foreground)]">
            {(profile?.lastConnectedWallet || sessionUser?.lastConnectedWallet)?.network}
          </span>
        </div>
      )}
    </div>
  );
}
