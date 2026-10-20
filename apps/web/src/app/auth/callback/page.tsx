'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { notifySession } from '@/lib/shop';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Verifying your Google authentication credentials...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Extract tokens or code from hash or query parameters
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const queryParams = url.searchParams;

        const idToken = hashParams.get('id_token') || queryParams.get('id_token');
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const code = queryParams.get('code');
        const error = queryParams.get('error') || hashParams.get('error');

        if (error) {
          throw new Error(`Google authentication cancelled or denied: ${error}`);
        }

        // Send token to backend API for verification and session issuance
        const credential = idToken || accessToken || code;
        if (!credential) {
          throw new Error('No authentication credential received from Google callback.');
        }

        const res = await fetch('/api/v1/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.token && data.user) {
          localStorage.setItem('nexus_token', data.token);
          localStorage.setItem('nexus_user', JSON.stringify(data.user));
          notifySession();

          setStatus('success');
          setMessage(`Welcome, ${data.user.name || data.user.email}! Redirecting to store...`);

          setTimeout(() => {
            router.push('/store');
          }, 800);
        } else {
          throw new Error(data.error || 'Authentication server verification failed.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Could not complete Google authentication.');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
      <div className="nexus-glass-card max-w-md w-full p-8 rounded-3xl border border-[var(--border)] text-center space-y-4 shadow-2xl">
        {status === 'processing' && (
          <div className="space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin text-[var(--gold)] mx-auto" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Signing you in...</h2>
            <p className="text-xs font-mono text-[var(--muted)]">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Authentication Verified</h2>
            <p className="text-xs font-mono text-emerald-400">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Sign-in Error</h2>
            <p className="text-xs font-mono text-rose-400">{message}</p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mt-4 px-4 py-2 rounded-xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)]"
            >
              Return to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
