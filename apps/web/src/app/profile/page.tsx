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
} from 'lucide-react';
import { readSession, clearSession, notifySession, SessionUser } from '@/lib/shop';
import { WalletConnectModal, WalletConnectedAccount } from '@/components/WalletConnectModal';

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
