'use client';

import React, { useState } from 'react';
import { X, Wallet, Mail, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

interface AuthUser {
  id: string;
  email?: string;
  walletAddress?: string;
  role: 'user' | 'admin';
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser, token: string) => void;
}

export function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [authTab, setAuthTab] = useState<'email' | 'web3'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const saveAndNotify = (user: AuthUser, token: string) => {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(user));
    onLoginSuccess(user, token);
    onClose();
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

      if (data.success) {
        saveAndNotify(data.user, data.token);
      } else {
        setErrorMsg(data.error || 'Login failed');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not reach the API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeb3Connect = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) {
        setErrorMsg('No wallet was found in this browser.');
        return;
      }
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) {
        setErrorMsg('The wallet did not return an address.');
        return;
      }
      const nonceRes = await fetch('/api/v1/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok || !nonceData.nonce) {
        setErrorMsg(nonceData.error || 'Could not start wallet sign-in.');
        return;
      }
      const signature = (await ethereum.request({
        method: 'personal_sign',
        params: [nonceData.nonce, walletAddress],
      })) as string;
      const verifyRes = await fetch('/api/v1/auth/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signature, nonce: nonceData.nonce }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        setErrorMsg(verifyData.error || 'The wallet signature was rejected.');
        return;
      }
      saveAndNotify(verifyData.user, verifyData.token);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Wallet sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-nexus-card border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-rail-emerald/20 blur-3xl rounded-full pointer-events-none" />

        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rail-emerald" />
              <span>NexusRail Identity & Auth</span>
            </h3>
            <p className="text-xs text-gray-400 font-mono">OWASP JWT & Web3 Nonce Verification</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl bg-gray-900 border border-gray-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auth Method Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-900/90 rounded-xl border border-gray-800">
          <button
            onClick={() => setAuthTab('email')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              authTab === 'email'
                ? 'bg-rail-emerald/20 text-rail-emerald border border-rail-emerald/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Auth</span>
          </button>
          <button
            onClick={() => setAuthTab('web3')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              authTab === 'web3'
                ? 'bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Web3 Wallet</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Email Form */}
        {authTab === 'email' ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-rail-emerald transition-all font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-rail-emerald transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rail-emerald to-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rail-emerald/20 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Sign In with Email'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Web3 Wallet Form */
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Your wallet signs a challenge. A signature that does not recover to that address is rejected.</p>
            <button
              onClick={handleWeb3Connect}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyber-purple to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyber-purple/20 hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Wallet className="w-4 h-4" />
              {isLoading ? 'Verifying Nonce Signature...' : 'Sign Challenge & Connect'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
