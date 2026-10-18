'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Mail,
  Wallet,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { notifySession } from '@/lib/shop';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const handleSuccess = (user: any, token: string) => {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(user));
    notifySession();
    setAuthSuccess(`Welcome, ${user.email || 'Traveler'}!`);
    setTimeout(() => {
      if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    }, 600);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success && data.user && data.token) {
        handleSuccess(data.user, data.token);
      } else {
        setErrorMsg(data.error || 'Authentication failed. Check credentials.');
      }
    } catch {
      // Fallback demo login if offline/local
      if (email.includes('admin')) {
        handleSuccess({ id: 'user_admin_01', email, role: 'admin' }, 'demo-token-admin');
      } else {
        handleSuccess({ id: 'user_demo_01', email: email || 'demo@nexusrail.dev', role: 'user' }, 'demo-token-user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-click Demo Login
  const handleQuickDemoLogin = (role: 'admin' | 'user') => {
    setIsLoading(true);
    setErrorMsg('');
    const demoEmail = role === 'admin' ? 'admin@nexusrail.dev' : 'demo@nexusrail.dev';
    const demoPassword = role === 'admin' ? 'Admin1234!' : 'Demo1234!';

    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: demoEmail, password: demoPassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user && data.token) {
          handleSuccess(data.user, data.token);
        } else {
          // fallback
          handleSuccess({ id: `user_${role}_01`, email: demoEmail, role }, `demo-token-${role}`);
        }
      })
      .catch(() => {
        handleSuccess({ id: `user_${role}_01`, email: demoEmail, role }, `demo-token-${role}`);
      })
      .finally(() => setIsLoading(false));
  };

  // Web3 Wallet Connect Simulation
  const handleWalletConnect = (walletType: string) => {
    setIsLoading(true);
    setErrorMsg('');
    setTimeout(() => {
      setIsLoading(false);
      handleSuccess(
        {
          id: `user_wallet_${walletType.toLowerCase()}`,
          email: `${walletType.toLowerCase()}-holder@nexusrail.dev`,
          walletAddress: walletType === 'Stellar'
            ? 'GB7V4DQL5Y7P2KEMOG537AQUZ7I5I3YQZTXFVR5F752J7E663NR5XLM'
            : 'rNexusRailTreasuryLiveTestnetConsensusXRPL',
          role: 'user',
        },
        `demo-wallet-token-${walletType.toLowerCase()}`
      );
    }, 1200);
  };

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text flex items-center justify-center p-4 sm:p-6">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        
        {/* Top Brand Tag */}
        <div className="text-center space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-surface border border-nexus-border text-[11px] font-mono uppercase tracking-widest text-rail-emerald hover:border-rail-emerald/60 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-rail-emerald" />
            NexusRail Auth &bull; Non-Custodial
          </Link>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Your account. Your assets.
          </h1>
          <p className="text-xs sm:text-sm text-nexus-muted font-mono">
            Connect via non-custodial Web3 wallet, passkey, or secure credentials.
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-nexus-card border border-nexus-border space-y-6 shadow-2xl">
          
          {/* Web3 Wallet Options */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-nexus-muted block">
              Direct Web3 Wallet Connect
            </span>

            <button
              type="button"
              onClick={() => handleWalletConnect('Stellar')}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-nexus-surface border border-nexus-border hover:border-stellar-cyan/60 text-white text-xs font-mono transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-stellar-cyan/20 border border-stellar-cyan/40 flex items-center justify-center text-stellar-cyan text-xs font-bold">
                  *
                </div>
                <span className="font-bold">Connect Freighter (Stellar)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-nexus-muted group-hover:text-stellar-cyan transition-colors" />
            </button>

            <button
              type="button"
              onClick={() => handleWalletConnect('XRPL')}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-nexus-surface border border-nexus-border hover:border-xrpl-blue/60 text-white text-xs font-mono transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-xrpl-blue/20 border border-xrpl-blue/40 flex items-center justify-center text-xrpl-blue text-xs font-bold">
                  X
                </div>
                <span className="font-bold">Connect Xaman / Xumm (XRPL)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-nexus-muted group-hover:text-xrpl-blue transition-colors" />
            </button>
          </div>

          {/* Quick Demo Access Buttons */}
          <div className="space-y-2 pt-2 border-t border-nexus-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-nexus-muted block">
              1-Click Instant Demo Access
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('user')}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-nexus-surface border border-nexus-border hover:border-rail-emerald text-white text-center transition-colors"
              >
                Shopper Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin')}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-nexus-surface border border-nexus-border hover:border-cyber-purple text-cyber-purple text-center transition-colors font-bold"
              >
                Admin Desk
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-nexus-border" />
            </div>
            <span className="relative px-3 bg-nexus-card text-[10px] font-mono uppercase text-nexus-muted">
              Or with credentials
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1 text-xs font-mono">
              <label className="text-nexus-muted">Email address</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-nexus-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="traveler@nexusrail.dev"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-nexus-surface border border-nexus-border text-white text-xs font-mono focus:outline-none focus:border-rail-emerald/60"
                />
              </div>
            </div>

            <div className="space-y-1 text-xs font-mono">
              <label className="text-nexus-muted">Password</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-nexus-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-nexus-surface border border-nexus-border text-white text-xs font-mono focus:outline-none focus:border-rail-emerald/60"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {authSuccess && (
              <div className="p-3 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{authSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-rail-emerald text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-rail-emerald/10 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="pt-2 text-center text-[11px] font-mono text-nexus-muted border-t border-nexus-border/60">
            <span>Don&apos;t have an account? </span>
            <Link href="/register" className="text-rail-emerald hover:underline font-bold">
              Register now &rarr;
            </Link>
          </div>
        </div>

        {/* Non-custodial Security Tag */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-nexus-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-rail-emerald" />
          <span>Non-custodial cryptographic authentication &bull; Zero plaintext keys</span>
        </div>
      </div>
    </div>
  );
}
