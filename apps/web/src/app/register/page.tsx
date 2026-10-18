'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?mode=signup');
  }, [router]);

  return (
    <div className="min-h-screen bg-nexus-dark text-white flex items-center justify-center p-4">
      <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border text-xs font-mono text-nexus-muted animate-pulse">
        Redirecting to Unified Gateway...
      </div>
    </div>
  );
}
