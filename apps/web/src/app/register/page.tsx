'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('nexus_token', data.token);
        localStorage.setItem('nexus_user', JSON.stringify(data.user));
        if (data.user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/');
        }
      } else {
        setErrorMsg(data.error || 'Registration failed');
      }
    } catch (err: any) {
      setErrorMsg('Failed to connect to registration server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nexus-dark text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-nexus-card border border-gray-800 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyber-purple/20 blur-3xl rounded-full pointer-events-none" />

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create NexusRail Account</h1>
          <p className="text-xs text-gray-400 font-mono">Join Multi-Rail Commerce & AI Desk Platform</p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-mono block mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 font-mono block mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 font-mono block mb-1.5">Account Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all font-mono"
            >
              <option value="user">Buyer / Regular User</option>
              <option value="admin">Operator / Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyber-purple to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyber-purple/20 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Creating Account...' : 'Register Account'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-gray-400 font-mono pt-2">
          Already have an account?{' '}
          <Link href="/login" className="text-cyber-purple underline hover:text-purple-300">
            Sign In
          </Link>
        </div>

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-gray-500 font-mono hover:text-white">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
