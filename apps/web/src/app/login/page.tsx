'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Mail,
  ShieldCheck,
  Key,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { notifySession } from '@/lib/shop';
import { GoogleIcon } from '@/components/WalletIcons';
import { WalletConnectModal } from '@/components/WalletConnectModal';

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

  // Manual Public Key / Passkey modal
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [passkeyAddress, setPasskeyAddress] = useState('');
  const [passkeyChain, setPasskeyChain] = useState<'stellar' | 'xrpl'>('stellar');

  // Google OAuth Dialog
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  const handleSuccess = (user: any, token: string) => {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(user));
    notifySession();
    setAuthSuccess(`Welcome, ${user.email || user.walletAddress?.slice(0, 8) || 'Traveler'}!`);
    setTimeout(() => {
      if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/store');
      }
    }, 600);
  };

  // Email Submit (Auto-Login or Auto-Register as stated in Figma: "New here? An account is created automatically")
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setErrorMsg('');

    // Default demo password if user is logging in with quick email flow
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

      // 2. If account does not exist, automatically register ("An account is created automatically")
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

      // If user had existing account with custom password, prompt for password
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

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (googleClientId && typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              const res = await fetch('/api/v1/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
              });
              const data = await res.json();
              if (data.success && data.user && data.token) {
                handleSuccess(data.user, data.token);
              } else {
                setErrorMsg(data.error || 'Google login failed.');
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

    setShowGoogleModal(true);
    setIsLoading(false);
  };

  const handleGoogleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: googleEmailInput.trim() }),
      });
      const data = await res.json();
      if (data.success && data.user && data.token) {
        setShowGoogleModal(false);
        handleSuccess(data.user, data.token);
      } else {
        setErrorMsg(data.error || 'Google authentication failed.');
      }
    } catch {
      setErrorMsg('Failed to authenticate via Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // Passkey / Public Key Submission
  const handlePasskeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passkeyAddress.trim();
    if (!clean) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/auth/manual-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: clean, chain: passkeyChain }),
      });
      const data = await res.json();
      if (data.success && data.user && data.token) {
        setShowPasskeyModal(false);
        handleSuccess(data.user, data.token);
      } else {
        setErrorMsg(data.error || 'Passkey verification failed.');
      }
    } catch {
      setErrorMsg('Failed to verify passkey.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between selection:bg-rail-emerald/30">
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

      {/* Main 2-Column Split View (Figma Screen 2) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-48px)]">
        
        {/* LEFT COLUMN: Hero Brand Narrative (40% width / 5 cols) */}
        <div className="lg:col-span-5 bg-[#05070A] border-r border-[#151921] p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle geometric grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#10141D_1px,transparent_1px),linear-gradient(to_bottom,#10141D_1px,transparent_1px)] bg-[size:32px_32px] opacity-25 pointer-events-none" />

          {/* Top Brand Tag */}
          <div className="space-y-6 relative z-10">
            <Link href="/" className="inline-flex items-center gap-2 text-white font-bold tracking-tight text-lg">
              <span className="w-2 h-2 rounded-full bg-rail-emerald shadow-[0_0_8px_#00E5A3]" />
              <span className="tracking-tighter font-mono">nexusrail</span>
            </Link>

            <div className="space-y-4 pt-8">
              <div className="inline-block px-3 py-1 rounded-full border border-rail-emerald/40 bg-rail-emerald/5 text-[10px] font-mono tracking-widest text-rail-emerald uppercase">
                THE CONNECTED COMMERCE DEMO
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
                Your account.<br />
                Your assets.<br />
                Your next move.
              </h1>

              <p className="text-sm text-[#8A93A6] leading-relaxed max-w-md pt-2">
                A familiar way in. A better way to move between shopping, payments and everything onchain.
              </p>
            </div>
          </div>

          {/* Center Graphic Wireframe Illustration */}
          <div className="my-10 relative z-10 flex items-center justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Concentric grid rings */}
              <div className="absolute inset-0 rounded-3xl border border-white/5 rotate-12" />
              <div className="absolute inset-2 rounded-3xl border border-white/5 -rotate-6" />
              <div className="w-24 h-24 rounded-2xl border border-rail-emerald/40 bg-gradient-to-br from-rail-emerald/10 to-transparent flex items-center justify-center shadow-[0_0_30px_rgba(0,229,163,0.15)]">
                <div className="w-6 h-6 rounded-lg bg-rail-emerald/30 border border-rail-emerald flex items-center justify-center text-rail-emerald">
                  <span className="w-2 h-2 rounded-full bg-rail-emerald animate-ping" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security Note */}
          <div className="relative z-10 border-t border-[#151921] pt-6 space-y-1">
            <p className="text-xs font-mono text-white font-medium">A safe place to explore:</p>
            <p className="text-xs text-[#8A93A6]">Test assets only. No real funds at risk.</p>
          </div>
        </div>

        {/* RIGHT COLUMN: Connection & Authentication Card (60% width / 7 cols) */}
        <div className="lg:col-span-7 bg-[#07090E] p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
          
          {/* Top Navigation Row */}
          <div className="flex justify-end">
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 text-xs text-[#8A93A6] hover:text-white transition-colors font-mono"
            >
              <span>&larr; Back to demo store</span>
            </Link>
          </div>

          {/* Main Centered Form Container */}
          <div className="max-w-md w-full mx-auto my-auto space-y-6 py-8">
            
            {/* Header Titles */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono tracking-widest uppercase text-rail-emerald font-semibold">
                WELCOME TO NEXUSRAIL
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Make your connection.
              </h2>
              <p className="text-xs text-[#8A93A6]">
                Sign in or create an account. Your journey starts here.
              </p>
            </div>

            {/* Error / Success Notifications */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="font-mono">{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg('')}
                  className="text-xs font-mono text-rose-400 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {authSuccess && (
              <div className="p-3.5 rounded-xl bg-rail-emerald/15 border border-rail-emerald/40 text-rail-emerald text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-mono font-medium">{authSuccess}</span>
              </div>
            )}

            {/* PRIMARY ACTION: Large Emerald "Connect a wallet" button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-rail-emerald hover:bg-rail-mint text-[#05070A] font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_24px_rgba(0,229,163,0.25)] hover:shadow-[0_6px_32px_rgba(0,229,163,0.4)]"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect a wallet</span>
              </button>

              <p className="text-[11px] font-mono text-center text-[#8A93A6]">
                Freighter &bull; GemWallet &bull; Xaman &bull; EVM / MetaMask
              </p>
            </div>

            {/* Divider: OR CONTINUE WITH */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1C2331]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                <span className="bg-[#07090E] px-3 text-[#5A6478]">OR CONTINUE WITH</span>
              </div>
            </div>

            {/* Social Row: Google & Apple */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="py-3 px-4 rounded-xl bg-[#0E131E] hover:bg-[#141B2B] border border-[#1C2331] hover:border-[#2A3449] text-xs font-mono text-white flex items-center justify-center gap-2.5 transition-all"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg('Apple Sign-In is coming in the next build. Please use Google, Email, or Wallet.');
                }}
                className="py-3 px-4 rounded-xl bg-[#0E131E] hover:bg-[#141B2B] border border-[#1C2331] hover:border-[#2A3449] text-xs font-mono text-white flex items-center justify-center gap-2.5 transition-all"
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.66-.82 1.11-1.96.99-3.1-.95.04-2.1.64-2.77 1.42-.59.68-1.11 1.78-.97 2.87 1.06.08 2.15-.55 2.75-1.19z" />
                </svg>
                <span>Apple</span>
              </button>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#8A93A6] block">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-[#0E131E] border border-[#1C2331] text-xs font-mono text-white placeholder-[#454E60] focus:outline-none focus:border-rail-emerald transition-colors"
                />
              </div>

              {showPasswordInput && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-[11px] font-mono text-[#8A93A6] block">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-[#0E131E] border border-[#1C2331] text-xs font-mono text-white placeholder-[#454E60] focus:outline-none focus:border-rail-emerald transition-colors"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#0E131E] hover:bg-[#141B2B] border border-[#1C2331] hover:border-rail-emerald/60 text-white text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rail-emerald" />
                ) : (
                  <>
                    <span>Continue with email</span>
                    <Mail className="w-3.5 h-3.5 text-[#8A93A6]" />
                  </>
                )}
              </button>
            </form>

            {/* Use Passkey / Cold Storage Key Instead */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowPasskeyModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8A93A6] hover:text-white transition-colors"
              >
                <Key className="w-3.5 h-3.5 text-rail-emerald" />
                <span>Use a passkey instead</span>
              </button>
            </div>

            {/* Security Guarantee Box */}
            <div className="p-3.5 rounded-xl bg-[#0E131E]/60 border border-[#1C2331] text-[11px] text-[#8A93A6] leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-rail-emerald shrink-0 mt-0.5" />
              <span>
                We never ask for your seed phrase or private keys. Wallet sign-in requests a signature, not a payment.
              </span>
            </div>

            {/* Terms Notice */}
            <p className="text-[10px] text-[#5A6478] text-center leading-relaxed font-mono">
              By continuing, you agree to the Terms of Service and Privacy Policy. New here? An account is created automatically.
            </p>
          </div>

          <div />
        </div>
      </div>

      {/* BOTTOM FOOTER STATUS BAR (Exact Figma Screen 2 Bottom Bar) */}
      <footer className="h-12 border-t border-[#151921] px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#5A6478] bg-[#05070A]">
        <div>&copy; 2026 NexusRail | Beta environment</div>
        <div className="hidden md:block">Test assets only. No real funds or fulfillment.</div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rail-emerald animate-pulse" />
          <span>Systems: operational</span>
        </div>
      </footer>

      {/* Google Sign-In Dialog */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl bg-[#0A0D14] border border-[#1C2331] p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GoogleIcon className="w-5 h-5" />
                <h3 className="font-bold text-sm text-white">Google Sign-In</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-gray-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#8A93A6] font-mono leading-relaxed">
              Enter your Google account email to link your profile with NexusRail.
            </p>

            <form onSubmit={handleGoogleEmailSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={googleEmailInput}
                onChange={(e) => setGoogleEmailInput(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131E] border border-[#1C2331] text-xs font-mono text-white placeholder-[#454E60] focus:outline-none focus:border-rail-emerald"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#0E131E] border border-[#1C2331] text-xs font-mono text-[#8A93A6] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !googleEmailInput.trim()}
                  className="flex-1 py-2 rounded-xl bg-white text-gray-900 text-xs font-mono font-bold hover:bg-gray-100"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Passkey / Manual Public Key Modal */}
      {showPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-[#0A0D14] border border-[#1C2331] p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-rail-emerald" />
                <h3 className="font-bold text-sm text-white">Use a Passkey / Public Key</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasskeyModal(false)}
                className="text-gray-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#8A93A6] leading-relaxed">
              Connect your self-custody cold storage, ledger, or passkey public address without mock IDs.
            </p>

            <form onSubmit={handlePasskeySubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setPasskeyChain('stellar')}
                  className={`py-1.5 px-3 rounded-lg border ${
                    passkeyChain === 'stellar'
                      ? 'bg-stellar-cyan/15 text-stellar-cyan border-stellar-cyan font-bold'
                      : 'bg-[#0E131E] text-[#8A93A6] border-[#1C2331]'
                  }`}
                >
                  Stellar (G...)
                </button>
                <button
                  type="button"
                  onClick={() => setPasskeyChain('xrpl')}
                  className={`py-1.5 px-3 rounded-lg border ${
                    passkeyChain === 'xrpl'
                      ? 'bg-xrpl-blue/15 text-xrpl-blue border-xrpl-blue font-bold'
                      : 'bg-[#0E131E] text-[#8A93A6] border-[#1C2331]'
                  }`}
                >
                  XRPL (r...)
                </button>
              </div>

              <input
                type="text"
                required
                value={passkeyAddress}
                onChange={(e) => setPasskeyAddress(e.target.value)}
                placeholder={passkeyChain === 'stellar' ? 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' : 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131E] border border-[#1C2331] text-xs font-mono text-white placeholder-[#454E60] focus:outline-none focus:border-rail-emerald"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasskeyModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#0E131E] border border-[#1C2331] text-xs font-mono text-[#8A93A6] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !passkeyAddress.trim()}
                  className="flex-1 py-2 rounded-xl bg-rail-emerald text-[#05070A] text-xs font-mono font-bold hover:brightness-110"
                >
                  Verify Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl bg-[#0E131E] border border-[#1C2331] text-xs font-mono text-[#8A93A6] animate-pulse">
            Loading NexusRail Gateway...
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </React.Suspense>
  );
}
