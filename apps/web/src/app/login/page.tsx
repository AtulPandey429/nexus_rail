'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { notifySession } from '@/lib/shop';
import { GoogleIcon } from '@/components/WalletIcons';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { NexusLogo } from '@/components/NexusLogo';

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

  // Official Google OAuth / OIDC Flow (Requirement 2)
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
    <div className="min-h-[calc(100vh-80px)] bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-between selection:bg-[var(--gold)]/30 transition-colors duration-200">
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

      {/* Wallet Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={(acc) => {
          handleSuccess(
            {
              id: `usr_${acc.walletName.toLowerCase()}_${acc.address.slice(0, 8)}`,
              walletAddress: acc.address,
              role: 'user',
              email: `${acc.walletName.toLowerCase()}_${acc.address.slice(-4)}@nexusrail.dev`,
            },
            localStorage.getItem('nexus_token') || `token_${acc.walletName.toLowerCase()}_${Date.now()}`
          );
        }}
      />

      {/* Main 2-Column Split View - Unified Seamless Background */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-full bg-transparent">
        {/* LEFT COLUMN: Hero Brand Narrative */}
        <div className="lg:col-span-5 bg-transparent p-6 sm:p-10 lg:p-16 flex flex-col justify-between relative">
          <div className="space-y-6 relative z-10">
            <Link href="/" className="inline-flex items-center gap-2.5 text-[var(--foreground)] font-bold tracking-tight text-lg group">
              <NexusLogo size={28} glow className="group-hover:scale-105 transition-transform shadow-md" />
              <span className="tracking-tighter font-mono">nexusrail</span>
            </Link>

            <div className="space-y-4 pt-6 sm:pt-8">
              <div className="inline-block px-3 py-1 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[10px] font-mono tracking-widest text-[var(--gold)] uppercase font-semibold">
                THE CONNECTED COMMERCE PLATFORM
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--foreground)] leading-[1.15]">
                Your account.<br />
                Your assets.<br />
                Your next move.
              </h1>

              <p className="text-sm text-[var(--muted)] leading-relaxed max-w-md pt-2">
                A familiar way in. A better way to move between shopping, payments and everything onchain.
              </p>
            </div>
          </div>

          <div className="my-10 relative z-10 flex items-center justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div className="absolute inset-0 rounded-3xl border border-[var(--border-highlight)] rotate-12" />
              <div className="absolute inset-2 rounded-3xl border border-[var(--border-highlight)] -rotate-6" />
              <NexusLogo size={88} glow className="shadow-[0_0_40px_rgba(212,175,55,0.25)] hover:scale-105 transition-transform duration-500 z-10" />
            </div>
          </div>

          <div className="relative z-10 border-t border-[var(--border)] pt-6 space-y-1">
            <p className="text-xs font-mono text-[var(--foreground)] font-medium">A safe place to explore:</p>
            <p className="text-xs text-[var(--muted)]">Test assets only. No real funds at risk.</p>
          </div>
        </div>

        {/* RIGHT COLUMN: Connection & Authentication Card */}
        <div className="lg:col-span-7 bg-transparent p-6 sm:p-10 lg:p-16 flex flex-col justify-between">
          <div className="flex justify-end">
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-mono"
            >
              <span>&larr; Back to store</span>
            </Link>
          </div>

          <div className="nexus-glass-card max-w-md w-full mx-auto my-auto space-y-6 p-6 sm:p-8 rounded-3xl shadow-xl">
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--gold)] font-semibold">
                WELCOME TO NEXUSRAIL
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)] tracking-tight">
                Make your connection.
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Sign in or create an account. Your journey starts here.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-2.5">
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
              <div className="p-3.5 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-mono font-medium">{authSuccess}</span>
              </div>
            )}

            {/* PRIMARY ACTION: Connect a Web3 Wallet */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[#08090C] font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-[var(--gold)]/20 hover:shadow-xl hover:scale-[1.01] active:scale-95 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect a wallet</span>
              </button>

              <p className="text-[11px] font-mono text-center text-[var(--muted)]">
                Stellar (Freighter · Albedo) &bull; XRPL (GemWallet · Xaman)
              </p>
            </div>

            {/* Divider: OR CONTINUE WITH */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                <span className="bg-[var(--card)] px-3 text-[var(--muted)]">OR CONTINUE WITH</span>
              </div>
            </div>

            {/* Official Google OAuth Action Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--border-highlight)] text-xs font-mono text-[var(--foreground)] flex items-center justify-center gap-2.5 transition-all shadow-sm hover:scale-[1.01] active:scale-95 cursor-pointer"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3 pt-2">
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
                className="w-full py-3.5 px-4 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)]/60 text-[var(--foreground)] text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--gold)]" />
                ) : (
                  <>
                    <span>Continue with email</span>
                    <Mail className="w-3.5 h-3.5 text-[var(--muted)]" />
                  </>
                )}
              </button>
            </form>

            {/* Security Guarantee Box */}
            <div className="p-3.5 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-[11px] text-[var(--muted)] leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
              <span>
                We never ask for your seed phrase or private keys. Wallet sign-in requests an onchain signature, not a payment.
              </span>
            </div>

            <p className="text-[10px] text-[var(--muted)]/70 text-center leading-relaxed font-mono">
              By continuing, you agree to the Terms of Service and Privacy Policy. New here? An account is created automatically.
            </p>
          </div>

          <div />
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
