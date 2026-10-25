'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?mode=signup');
  }, [router]);

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] flex items-center justify-center p-4">
      <div className="p-6 rounded-2xl nexus-glass-surface text-xs font-mono text-[var(--muted)] animate-pulse">
        Redirecting to Unified Gateway...
      </div>
    </div>
  );
}
