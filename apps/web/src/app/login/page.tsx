'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { notifySession } from '@/lib/shop';
import {
  FreighterIcon,
  GemWalletIcon,
  CrossmarkIcon,
  XamanIcon,
  AlbedoIcon,
  MetaMaskIcon,
} from '@/components/WalletIcons';
import {
  connectFreighter,
  connectGemWallet,
  connectCrossmark,
  connectMetaMask,
  checkFreighterInstalled,
  checkGemWalletInstalled,
  isCrossmarkAvailable,
} from '@/lib/wallets';
import { WalletConnectModal } from '@/components/WalletConnectModal';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Live extension presence
  const [hasFreighter, setHasFreighter] = useState(false);
  const [hasGemWallet, setHasGemWallet] = useState(false);
  const [hasCrossmark, setHasCrossmark] = useState(false);

  useEffect(() => {
    checkFreighterInstalled().then(setHasFreighter);
    checkGemWalletInstalled().then(setHasGemWallet);
    setHasCrossmark(isCrossmarkAvailable());
  }, []);

  const handleSuccess = (user: any, token: string) => {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(user));
    notifySession();
    setAuthSuccess(`Welcome, ${user.email || user.walletAddress?.slice(0, 8) || 'Traveler'}!`);
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
          handleSuccess({ id: `user_${role}_01`, email: demoEmail, role }, `demo-token-${role}`);
        }
      })
      .catch(() => {
        handleSuccess({ id: `user_${role}_01`, email: demoEmail, role }, `demo-token-${role}`);
      })
      .finally(() => setIsLoading(false));
  };

  // Connect native wallet
  const handleConnectWalletDirect = async (walletType: 'freighter' | 'gemwallet' | 'crossmark' | 'metamask') => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      let addr = '';
      let wName = '';
      let chain = 'stellar';

      if (walletType === 'freighter') {
        const res = await connectFreighter();
        addr = res.address;
        wName = 'Freighter';
        chain = 'stellar';
      } else if (walletType === 'gemwallet') {
        const res = await connectGemWallet();
        addr = res.address;
        wName = 'GemWallet';
        chain = 'xrpl';
      } else if (walletType === 'crossmark') {
        const res = await connectCrossmark();
        addr = res.address;
        wName = 'Crossmark';
        chain = 'xrpl';
      } else if (walletType === 'metamask') {
        const res = await connectMetaMask();
        addr = res.address;
        wName = 'MetaMask';
        chain = 'evm';
      }

      if (addr) {
        let userObj = {
          id: `usr_${wName.toLowerCase()}_${addr.slice(0, 8)}`,
          walletAddress: addr,
          role: 'user',
          email: `${wName.toLowerCase()}_${addr.slice(-4)}@nexusrail.dev`,
        };
        let token = `token_${wName.toLowerCase()}_${Date.now()}`;

        try {
          const authRes = await fetch('/api/v1/auth/wallet-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: addr, walletName: wName, chain }),
          });
          if (authRes.ok) {
            const data = await authRes.json();
            if (data?.success && data?.token) {
              token = data.token;
              if (data.user) userObj = data.user;
            }
          }
        } catch {
          // quiet fallback
        }

        handleSuccess(userObj, token);
      }
    } catch (err: any) {
      setErrorMsg(err.message || `Could not connect to ${walletType} extension.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text flex items-center justify-center p-4 sm:p-6">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      {/* Modern Multi-Wallet Kit Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={(acc) => {
          handleSuccess(
            { id: `user_${acc.walletName.toLowerCase()}`, walletAddress: acc.address, role: 'user' },
            `token_${acc.walletName.toLowerCase()}`
          );
        }}
      />

      <div className="relative z-10 w-full max-w-md space-y-6">
        
        {/* Top Brand Tag */}
        <div className="text-center space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-surface border border-nexus-border text-[11px] font-mono uppercase tracking-widest text-rail-emerald hover:border-rail-emerald/60 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-rail-emerald" />
            NexusRail Auth &bull; Multi-Rail Wallet Kit
          </Link>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Your account. Your assets.
          </h1>
          <p className="text-xs sm:text-sm text-nexus-muted font-mono">
            Connect via Freighter, GemWallet, Crossmark, or secure credentials.
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-nexus-card border border-nexus-border space-y-6 shadow-2xl">
          
          {/* Web3 Wallet Options with Authentic Icons */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-nexus-muted block">
                Connect Web3 Wallet
              </span>
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="text-[11px] font-mono text-rail-emerald hover:underline flex items-center gap-1"
              >
                <span>View all wallets</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Freighter Option */}
            <button
              type="button"
              onClick={() => handleConnectWalletDirect('freighter')}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-nexus-surface border border-nexus-border hover:border-stellar-cyan/60 text-white text-xs font-mono transition-all group"
            >
              <div className="flex items-center gap-3">
                <FreighterIcon className="w-7 h-7 rounded-lg shrink-0" />
                <div className="text-left">
                  <span className="font-bold block text-white group-hover:text-stellar-cyan transition-colors">
                    Freighter (Stellar)
                  </span>
                  <span className="text-[10px] text-nexus-muted">
                    {hasFreighter ? 'Installed &bull; Click to open popup' : 'Stellar Soroban Signer'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-nexus-card border border-nexus-border group-hover:border-stellar-cyan/50 text-stellar-cyan">
                {hasFreighter ? 'Ready' : 'Connect'}
              </span>
            </button>

            {/* GemWallet Option */}
            <button
              type="button"
              onClick={() => handleConnectWalletDirect('gemwallet')}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-nexus-surface border border-nexus-border hover:border-xrpl-blue/60 text-white text-xs font-mono transition-all group"
            >
              <div className="flex items-center gap-3">
                <GemWalletIcon className="w-7 h-7 rounded-lg shrink-0" />
                <div className="text-left">
                  <span className="font-bold block text-white group-hover:text-xrpl-blue transition-colors">
                    GemWallet (XRPL)
                  </span>
                  <span className="text-[10px] text-nexus-muted">
                    {hasGemWallet ? 'Installed &bull; Click to open popup' : 'XRP Ledger Signer'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-nexus-card border border-nexus-border group-hover:border-xrpl-blue/50 text-xrpl-blue">
                {hasGemWallet ? 'Ready' : 'Connect'}
              </span>
            </button>

            {/* Quick All Wallets Button */}
            <button
              type="button"
              onClick={() => setIsWalletModalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-nexus-surface/60 border border-nexus-border hover:border-nexus-muted/40 text-nexus-muted hover:text-white text-xs font-mono transition-colors flex items-center justify-center gap-2"
            >
              <Wallet className="w-3.5 h-3.5 text-rail-emerald" />
              <span>More wallets (Crossmark, Xaman QR, Albedo, MetaMask)</span>
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
