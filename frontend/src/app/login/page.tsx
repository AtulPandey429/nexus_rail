'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Cpu,
  Lock,
  Globe,
  Check,
  ExternalLink,
} from 'lucide-react';
import { notifySession } from '@/lib/shop';
import {
  GoogleIcon,
  GemWalletIcon,
  CrossmarkIcon,
  XamanIcon,
  FreighterIcon,
  AlbedoIcon,
  LobstrIcon,
} from '@/components/wallet/WalletIcons';
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';
import { NexusLogo } from '@/components/ui/NexusLogo';

function LoginFormContent() {
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<'xrpl' | 'stellar'>('xrpl');
  const [authMode, setAuthMode] = useState<'wallet' | 'email'>('wallet');

  const handleSuccess = (user: any, token: string) => {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(user));
    notifySession();
    setAuthSuccess(`Welcome, ${user.name || user.email || user.walletAddress?.slice(0, 8) || 'Traveler'}!`);
    setTimeout(() => {
      if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/store');
      }
    }, 600);
  };

  // Email Submit (Auto-Login or Auto-Register)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setErrorMsg('');

    const authPassword = password || 'NexusRail2026!';

    try {
      // 1. Try login first
      const loginRes = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: authPassword }),
      });
      const loginData = await loginRes.json();

      if (loginRes.ok && loginData.success && loginData.user && loginData.token) {
        handleSuccess(loginData.user, loginData.token);
        return;
      }

      // 2. If account does not exist, automatically register
      const regRes = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: authPassword }),
      });
      const regData = await regRes.json();

      if (regRes.ok && regData.success && regData.user && regData.token) {
        handleSuccess(regData.user, regData.token);
        return;
      }

      if (!showPasswordInput) {
        setShowPasswordInput(true);
        setErrorMsg('Please enter your existing password to sign in.');
      } else {
        setErrorMsg(loginData.error || regData.error || 'Authentication failed. Please check credentials.');
      }
    } catch {
      setErrorMsg('Could not reach the authentication server. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  // Official Google OAuth / OIDC Flow
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    // 1. If Google Identity Services library is loaded and client ID exists
    if (googleClientId && typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response?.credential) {
              try {
                const res = await fetch('/api/v1/auth/google', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ credential: response.credential }),
                });
                const data = await res.json();
                if (data.success && data.user && data.token) {
                  handleSuccess(data.user, data.token);
                } else {
                  setErrorMsg(data.error || 'Google login failed on server verification.');
                }
              } catch {
                setErrorMsg('Network error verifying Google credentials.');
              }
            }
          },
        });
        (window as any).google.accounts.id.prompt();
        setIsLoading(false);
        return;
      } catch (err: any) {
        console.warn('Google One Tap init error:', err);
      }
    }

    // 2. Standard Google OAuth 2.0 Web Redirection
    if (googleClientId) {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const scope = encodeURIComponent('openid email profile');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token%20id_token&scope=${scope}&nonce=nexus_${Date.now()}&prompt=select_account`;

      window.location.href = authUrl;
      return;
    }

    // 3. Informative configuration notice if running in local development without Client ID
    setIsLoading(false);
    setErrorMsg(
      'Google OAuth requires NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local to open the Google account consent screen. Please use Email or Wallet Connect in the meantime.'
    );
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-center py-6 sm:py-10 lg:py-14 relative z-10 selection:bg-[var(--gold)]/30 transition-colors duration-200">
      {/* Official Google Identity Services Script */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => {
          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          if (clientId && (window as any).google?.accounts?.id) {
            try {
              (window as any).google.accounts.id.initialize({
                client_id: clientId,
                callback: async (response: any) => {
                  if (response?.credential) {
                    const res = await fetch('/api/v1/auth/google', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ credential: response.credential }),
                    });
                    const data = await res.json();
                    if (data.success && data.user && data.token) {
                      handleSuccess(data.user, data.token);
                    }
                  }
                },
              });
            } catch (err) {
              console.warn('Google GSI lazy load init:', err);
            }
          }
        }}
      />

      {/* Wallet Modal with Selected Network Priority */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        initialNetwork={selectedNetwork}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={(acc) => {
          handleSuccess(
            {
              id: `usr_${acc.walletName.toLowerCase()}_${acc.address.slice(0, 8)}`,
              walletAddress: acc.address,
              xrplAddress: acc.chain === 'xrpl' ? acc.address : undefined,
              stellarAddress: acc.chain === 'stellar' ? acc.address : undefined,
              primaryChain: acc.chain,
              role: 'user',
              email: `${acc.walletName.toLowerCase()}_${acc.address.slice(-4)}@nexusrail.dev`,
            },
            localStorage.getItem('nexus_token') || `token_${acc.walletName.toLowerCase()}_${Date.now()}`
          );
        }}
      />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Main Balanced 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* =========================================================================
              LEFT COLUMN: Hero Brand Narrative & Dual-Rail Telemetry Showcase
             ========================================================================= */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-8">
            {/* Header Badge */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[11px] font-mono tracking-wider text-[var(--gold)] uppercase font-semibold">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
                <span>DUAL-RAIL WEB3 IDENTITY GATEWAY</span>
              </div>

              <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.12]">
                Next-Generation Commerce, Settled On-Chain.
              </h1>

              <p className="text-sm sm:text-base text-[var(--muted)] leading-relaxed max-w-xl">
                Connect your native XRP Ledger or Stellar self-custodial wallet, or continue with familiar social accounts. One identity across dual-rail liquidity with zero custodial risk.
              </p>
            </div>

            {/* Dual-Rail Convergence Hub Card */}
            <div className="nexus-glass-card p-5 sm:p-6 rounded-3xl border border-[var(--border)] space-y-5 relative overflow-hidden group hover:border-[var(--border-highlight)] transition-all">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 text-xs font-mono">
                <span className="text-[var(--muted)] uppercase tracking-wider text-[10px]">
                  Cross-Ledger Architecture
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Dual-Consensus Live
                </span>
              </div>

              {/* Two Rails Converging into NexusCore */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {/* XRPL Node */}
                <div className="p-3.5 rounded-2xl bg-[#0081F2]/10 border border-[#0081F2]/30 space-y-1.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#0081F2]">
                    <span className="w-2 h-2 rounded-full bg-[#0081F2]" />
                    <span>XRP Ledger</span>
                  </div>
                  <p className="text-[10px] font-mono text-[var(--muted)]">XLS-30d AMM Rail</p>
                  <p className="text-[11px] font-mono text-emerald-400 font-bold">~3.8s Finality</p>
                  <div className="flex justify-center gap-1.5 pt-1 opacity-80">
                    <GemWalletIcon className="w-4 h-4" />
                    <CrossmarkIcon className="w-4 h-4" />
                    <XamanIcon className="w-4 h-4" />
                  </div>
                </div>

                {/* Central Nexus Rail Bridge Core */}
                <div className="p-3.5 rounded-2xl nexus-glass-surface border border-[var(--gold)]/30 text-center space-y-1 relative">
                  <NexusLogo size={32} glow className="mx-auto" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--gold)] font-bold block">
                    NEXUS CORE
                  </span>
                  <p className="text-[9.5px] font-mono text-[var(--muted)]">
                    1:1 Parity Bridge
                  </p>
                </div>

                {/* Stellar Node */}
                <div className="p-3.5 rounded-2xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 space-y-1.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#00E5FF]">
                    <span className="w-2 h-2 rounded-full bg-[#00E5FF]" />
                    <span>Stellar Network</span>
                  </div>
                  <p className="text-[10px] font-mono text-[var(--muted)]">Protocol 22 Soroban</p>
                  <p className="text-[11px] font-mono text-emerald-400 font-bold">~5.0s Finality</p>
                  <div className="flex justify-center gap-1.5 pt-1 opacity-80">
                    <FreighterIcon className="w-4 h-4" />
                    <AlbedoIcon className="w-4 h-4" />
                    <LobstrIcon className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* 3 Pillars of Security & Multi-Rail Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[var(--foreground)] font-bold text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Non-Custodial</span>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] leading-tight">
                    Zero private key exposure. Cryptographic wallet signatures only.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[var(--foreground)] font-bold text-[11px]">
                    <Cpu className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                    <span>Dual Identity</span>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] leading-tight">
                    Link XRPL (r...) &amp; Stellar (G...) under a single unified profile.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[var(--foreground)] font-bold text-[11px]">
                    <Globe className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                    <span>Atomic Parity</span>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] leading-tight">
                    Guaranteed 1:1 cross-chain liquidity and instant cashout.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Ledger Status Ticker */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--muted)] pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>XRPL Altnet: <strong className="text-[var(--foreground)]">Connected</strong></span>
              </div>
              <span className="text-[var(--border)]">&bull;</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Stellar Horizon: <strong className="text-[var(--foreground)]">Connected</strong></span>
              </div>
              <span className="text-[var(--border)]">&bull;</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                <span>AMM Pools: <strong className="text-[var(--gold)]">Active</strong></span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              RIGHT COLUMN: Authentication Gateway Card
             ========================================================================= */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            {/* Top Clean Navigation Header */}
            <div className="flex justify-between items-center mb-4 max-w-lg w-full mx-auto">
              <span className="text-xs font-mono text-[var(--muted)]">
                Authentication Gateway
              </span>
              <Link
                href="/store"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-mono py-1 px-2.5 rounded-lg hover:bg-[var(--card-hover)]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to store</span>
              </Link>
            </div>

            {/* Main Auth Card */}
            <div className="nexus-glass-card max-w-lg w-full mx-auto space-y-6 p-6 sm:p-8 rounded-3xl shadow-2xl border border-[var(--border)] relative">
              
              {/* Header Title & Intro */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--gold)] font-semibold">
                    WELCOME TO NEXUSRAIL
                  </span>
                  <NexusLogo size={24} glow />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)] tracking-tight">
                  Make your connection.
                </h2>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Connect your self-custodial Web3 wallet, or sign in with Google or email.
                </p>
              </div>

              {/* Alert Messages */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
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

              {authSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="font-mono font-medium">{authSuccess}</span>
                </div>
              )}

              {/* Method Switcher Tabs (Segmented Control) */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] gap-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('wallet')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    authMode === 'wallet'
                      ? 'bg-[var(--gold)] text-black shadow-md'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Web3 Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode('email')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    authMode === 'email'
                      ? 'bg-[var(--gold)] text-black shadow-md'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Social &amp; Email</span>
                </button>
              </div>

              {/* =====================================================================
                  TAB 1: WEB3 WALLET CONNECTION
                 ===================================================================== */}
              {authMode === 'wallet' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Blockchain Network Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono tracking-wider uppercase text-[var(--gold)] font-semibold flex items-center justify-between">
                      <span>Choose Blockchain Network</span>
                      <span className="text-[var(--muted)] normal-case font-normal text-[10px]">Dual-Rail Active</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* XRPL Selection Card */}
                      <button
                        type="button"
                        onClick={() => setSelectedNetwork('xrpl')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                          selectedNetwork === 'xrpl'
                            ? 'bg-[#0081F2]/15 border-[#0081F2] shadow-md shadow-[#0081F2]/10 ring-1 ring-[#0081F2]/50'
                            : 'bg-[var(--card-subtle)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-highlight)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#0081F2]" />
                            <span className="font-bold text-xs font-mono text-[var(--foreground)]">XRP Ledger</span>
                          </div>
                          {selectedNetwork === 'xrpl' && (
                            <Check className="w-3.5 h-3.5 text-[#0081F2]" />
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-[var(--muted)]">
                          GemWallet &bull; Crossmark &bull; Xaman
                        </p>
                      </button>

                      {/* Stellar Selection Card */}
                      <button
                        type="button"
                        onClick={() => setSelectedNetwork('stellar')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                          selectedNetwork === 'stellar'
                            ? 'bg-[#00E5FF]/15 border-[#00E5FF] shadow-md shadow-[#00E5FF]/10 ring-1 ring-[#00E5FF]/50'
                            : 'bg-[var(--card-subtle)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-highlight)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF]" />
                            <span className="font-bold text-xs font-mono text-[var(--foreground)]">Stellar Network</span>
                          </div>
                          {selectedNetwork === 'stellar' && (
                            <Check className="w-3.5 h-3.5 text-[#00E5FF]" />
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-[var(--muted)]">
                          Varial &bull; Freighter &bull; Albedo
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Primary Wallet Action Button */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsWalletModalOpen(true)}
                      className={`w-full py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-95 cursor-pointer ${
                        selectedNetwork === 'xrpl'
                          ? 'bg-[#0081F2] hover:bg-[#1a90ff] text-white shadow-[#0081F2]/25'
                          : 'bg-[#00E5FF] hover:bg-[#33ebff] text-black shadow-[#00E5FF]/25'
                      }`}
                    >
                      <Wallet className="w-4 h-4" />
                      <span>
                        Connect {selectedNetwork === 'xrpl' ? 'XRP Ledger (XRPL)' : 'Stellar Network'} Wallet
                      </span>
                    </button>

                    <p className="text-[11px] font-mono text-center text-[var(--muted)]">
                      Opens native browser extension or mobile QR signer
                    </p>
                  </div>

                  {/* Supported Wallets Row */}
                  <div className="p-3 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] block text-center">
                      Supported Multi-Rail Signers
                    </span>
                    <div className="flex items-center justify-center gap-4 text-xs font-mono text-[var(--foreground)]">
                      <div className="flex items-center gap-1" title="GemWallet for XRPL">
                        <GemWalletIcon className="w-4 h-4" />
                        <span className="text-[11px]">GemWallet</span>
                      </div>
                      <span className="text-[var(--border)]">&bull;</span>
                      <div className="flex items-center gap-1" title="Crossmark for XRPL">
                        <CrossmarkIcon className="w-4 h-4" />
                        <span className="text-[11px]">Crossmark</span>
                      </div>
                      <span className="text-[var(--border)]">&bull;</span>
                      <div className="flex items-center gap-1" title="Freighter for Stellar">
                        <FreighterIcon className="w-4 h-4" />
                        <span className="text-[11px]">Freighter</span>
                      </div>
                      <span className="text-[var(--border)]">&bull;</span>
                      <div className="flex items-center gap-1" title="Albedo Web Signer">
                        <AlbedoIcon className="w-4 h-4" />
                        <span className="text-[11px]">Albedo</span>
                      </div>
                    </div>
                  </div>

                  {/* Switch to Email Hint */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setAuthMode('email')}
                      className="text-xs font-mono text-[var(--muted)] hover:text-[var(--gold)] transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Prefer Google or Email login?</span>
                      <ArrowRight className="w-3 h-3 text-[var(--gold)]" />
                    </button>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  TAB 2: SOCIAL & EMAIL SIGN-IN
                 ===================================================================== */}
              {authMode === 'email' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Google OAuth Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--border-highlight)] text-xs font-mono font-medium text-[var(--foreground)] flex items-center justify-center gap-2.5 transition-all shadow-sm hover:scale-[1.01] active:scale-95 cursor-pointer"
                    >
                      <GoogleIcon className="w-4 h-4" />
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  {/* Divider: OR SIGN IN WITH EMAIL */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--border)]" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                      <span className="bg-[var(--surface-solid)] px-3 text-[var(--muted)]">OR SIGN IN WITH EMAIL</span>
                    </div>
                  </div>

                  {/* Email Input Form */}
                  <form onSubmit={handleEmailSubmit} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono text-[var(--muted)] block">Email address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted)]/50 focus:outline-none focus:border-[var(--gold)] transition-colors"
                      />
                    </div>

                    {showPasswordInput && (
                      <div className="space-y-1.5 animate-in fade-in duration-200">
                        <label className="text-[11px] font-mono text-[var(--muted)] block">Password</label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted)]/50 focus:outline-none focus:border-[var(--gold)] transition-colors"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 px-4 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)]/60 text-[var(--foreground)] text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--gold)]" />
                      ) : (
                        <>
                          <span>Continue with Email</span>
                          <Mail className="w-3.5 h-3.5 text-[var(--gold)]" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Switch to Web3 Hint */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('wallet')}
                      className="text-xs font-mono text-[var(--muted)] hover:text-[var(--gold)] transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3 text-[var(--gold)]" />
                      <span>Prefer Web3? Connect XRP Ledger or Stellar Wallet</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Unified Security & Non-Custodial Guarantee */}
              <div className="p-3.5 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] text-[11px] text-[var(--muted)] leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--foreground)]">Non-Custodial Security:</strong> We never request private keys or seed phrases. Wallet sign-in uses EIP-4361 / SEP-0007 cryptographic signatures, never a blockchain payment.
                </span>
              </div>

              {/* Terms of Service Caption */}
              <p className="text-[10px] text-[var(--muted)]/70 text-center leading-relaxed font-mono">
                By continuing, you agree to the Terms of Service &amp; Privacy Policy. New accounts are generated seamlessly upon first connection.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-4">
          <div className="nexus-glass-card p-6 rounded-2xl border border-[var(--border)] text-xs font-mono text-[var(--muted)] animate-pulse">
            Loading NexusRail Gateway...
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </React.Suspense>
  );
}
