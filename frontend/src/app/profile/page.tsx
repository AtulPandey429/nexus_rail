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
  X,
  Cpu,
} from 'lucide-react';
import { readSession, clearSession, notifySession, SessionUser } from '@/lib/shop';
import { WalletConnectModal, WalletConnectedAccount } from '@/components/wallet/WalletConnectModal';
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

  // On-Chain Stellar $NR Withdrawal State (Module 4)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawNrHolding, setWithdrawNrHolding] = useState<HydratedHolding | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawStellarAddress, setWithdrawStellarAddress] = useState<string>('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawErrorMsg, setWithdrawErrorMsg] = useState('');
  const [withdrawSuccessData, setWithdrawSuccessData] = useState<{
    txHash: string;
    ledgerSeq: number;
    amountNr: number;
    explorerUrl: string;
    destinationStellarAddress: string;
  } | null>(null);

  const handleOpenWithdrawNr = (holding: HydratedHolding) => {
    setWithdrawNrHolding(holding);
    setWithdrawAmount(String(holding.quantity));
    setWithdrawStellarAddress(profile?.stellarAddress || '');
    setWithdrawErrorMsg('');
    setWithdrawSuccessData(null);
    setWithdrawModalOpen(true);
  };

  const handleWithdrawNrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = readSession();
    if (!session.token) return;

    const numAmount = Number(withdrawAmount);
    if (!numAmount || numAmount <= 0) {
      setWithdrawErrorMsg('Please specify a positive amount of $NR to withdraw.');
      return;
    }
    if (!withdrawStellarAddress.trim() || !withdrawStellarAddress.startsWith('G') || withdrawStellarAddress.trim().length !== 56) {
      setWithdrawErrorMsg('Please provide a valid 56-character Stellar public address starting with "G".');
      return;
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
          destinationStellarAddress: withdrawStellarAddress.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'On-chain withdrawal failed');
      }

      setWithdrawSuccessData(data.data);
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
          notifySession();
        }
        await fetchProfile();
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
              <div className="flex items-center gap-2 text-xs font-mono text-[#00E5FF]">
                <Cpu className="w-3.5 h-3.5" />
                <span>Stellar Protocol 22 On-Chain Settlement</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--foreground)]">
                Withdraw $NR to Stellar Testnet
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Broadcast and mint your internal <strong className="text-[var(--gold)]">$NR</strong> tokens onto the official Stellar Testnet via the Issuer Account (<code className="text-[#00E5FF]">GDO6N...</code>).
              </p>
            </div>

            {withdrawSuccessData ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>On-Chain Stellar Transfer Confirmed!</span>
                  </div>
                  <p className="text-[var(--foreground)]">
                    Successfully minted and transferred <strong className="text-emerald-300">{withdrawSuccessData.amountNr} $NR</strong> tokens to your external Stellar address.
                  </p>
                  <div className="pt-2 border-t border-emerald-500/20 space-y-1 text-[11px] text-[var(--muted)]">
                    <p>Ledger Sequence: #{withdrawSuccessData.ledgerSeq}</p>
                    <p className="truncate">Destination: {withdrawSuccessData.destinationStellarAddress}</p>
                    <p className="truncate">Tx Hash: {withdrawSuccessData.txHash}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={withdrawSuccessData.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-center text-[#00E5FF] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View on Stellar.Expert</span>
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
                    <label>Destination Stellar Address (G...)</label>
                    {profile?.stellarAddress && (
                      <button
                        type="button"
                        onClick={() => setWithdrawStellarAddress(profile.stellarAddress || '')}
                        className="text-[#00E5FF] hover:underline text-[11px] cursor-pointer"
                      >
                        Use Verified Wallet
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC"
                    value={withdrawStellarAddress}
                    onChange={(e) => setWithdrawStellarAddress(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[var(--muted)]">
                    <label>Withdrawal Amount ($NR)</label>
                    <span className="text-[var(--gold)]">
                      Available: {withdrawNrHolding ? withdrawNrHolding.quantity : 0} $NR
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
                      className="flex-1 px-4 py-3 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs focus:outline-none focus:border-[#00E5FF]"
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
                    className="flex-1 py-3 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/80 text-black text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {withdrawSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Broadcasting to Stellar...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Confirm Stellar Withdrawal</span>
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
                  <span className="px-2 py-0.5 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[10px] font-mono text-[var(--gold)] uppercase font-semibold">
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
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] block">
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
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] block">
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
                    : '2026'}
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
            <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
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
            <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
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
            <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
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
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                    {isPositive ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                </>
              );
            })()}
          </div>

          {/* Card 4: Total Realized Gains */}
          <div className="p-5 rounded-2xl nexus-glass-card border border-[var(--border)] space-y-1">
            <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
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
              When you purchase Smart Baskets or Live RWA Asset Packs in the Store, your underlying gold, silver, XRP, XLM, and $NR tokens are automatically tracked here in real-time.
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
                        <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider block mt-0.5">
                          {h.symbol} • Oracle: {h.oracle_source}
                        </span>
                      </div>

                      {has24hChange && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 ${is24hUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
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
                        <span className="text-[10px] text-[var(--muted)] block">Avg Cost Basis</span>
                        <span className="font-semibold text-[var(--foreground)]">
                          ${(h.avg_buy_price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[var(--card-subtle)]/50 border border-[var(--border)]/50">
                        <span className="text-[10px] text-[var(--muted)] block">Live Market Price</span>
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

                    {h.symbol === 'NR' && (
                      <button
                        type="button"
                        onClick={() => handleOpenWithdrawNr(h)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/30 text-xs font-mono font-bold text-[#00E5FF] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Withdraw to Stellar Testnet</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VERIFIED WALLETS SECTION (Requirement 5 & 6) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
              Verified Blockchain Wallets
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              NexusRail enforces a maximum of <strong>one verified wallet address per blockchain network</strong>.
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
                  <h3 className="font-bold text-sm text-[var(--foreground)]">Stellar Network (XLM)</h3>
                </div>
                {profile?.stellarAddress ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified Active</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--card-subtle)] text-[10px] font-mono text-[var(--muted)]">
                    Not Connected
                  </span>
                )}
              </div>

              {profile?.stellarAddress ? (
                <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-1.5">
                  <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider block">
                    Public Address
                  </span>
                  <p className="text-xs font-mono text-[var(--foreground)] break-all font-semibold select-all">
                    {profile.stellarAddress}
                  </p>
                  <p className="text-[10px] text-[var(--muted)] font-mono pt-1">
                    Compatible with Soroban smart contracts and Horizon settlement.
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--card-subtle)] border border-dashed border-[var(--border)] text-center space-y-2">
                  <Wallet className="w-6 h-6 text-[var(--muted)] mx-auto" />
                  <p className="text-xs text-[var(--muted)] font-mono">
                    No Stellar address attached to this profile.
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
                <span>{profile?.stellarAddress ? 'Change Stellar Wallet' : 'Connect Stellar Wallet'}</span>
              </button>

              {profile?.stellarAddress && (
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
                  <h3 className="font-bold text-sm text-[var(--foreground)]">XRP Ledger (XRP)</h3>
                </div>
                {profile?.xrplAddress ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified Active</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--card-subtle)] text-[10px] font-mono text-[var(--muted)]">
                    Not Connected
                  </span>
                )}
              </div>

              {profile?.xrplAddress ? (
                <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-1.5">
                  <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider block">
                    Account Address
                  </span>
                  <p className="text-xs font-mono text-[var(--foreground)] break-all font-semibold select-all">
                    {profile.xrplAddress}
                  </p>
                  <p className="text-[10px] text-[var(--muted)] font-mono pt-1">
                    Compatible with XRP Altnet consensus and payment channels.
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--card-subtle)] border border-dashed border-[var(--border)] text-center space-y-2">
                  <Wallet className="w-6 h-6 text-[var(--muted)] mx-auto" />
                  <p className="text-xs text-[var(--muted)] font-mono">
                    No XRP Ledger address attached to this profile.
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
                <span>{profile?.xrplAddress ? 'Change XRP Wallet' : 'Connect XRP Wallet'}</span>
              </button>

              {profile?.xrplAddress && (
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

      {/* RECENTLY CONNECTED WALLET METADATA */}
      {profile?.lastConnectedWallet && (
        <div className="p-4 rounded-2xl nexus-glass-card border border-[var(--border)] text-xs font-mono text-[var(--muted)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--gold)]" />
            <span>
              Last connected via <strong>{profile.lastConnectedWallet.provider}</strong> on {new Date(profile.lastConnectedWallet.connectedAt).toLocaleString()}
            </span>
          </div>
          <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-[var(--card-subtle)] text-[var(--foreground)]">
            {profile.lastConnectedWallet.network}
          </span>
        </div>
      )}
    </div>
  );
}
