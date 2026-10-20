'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-transparent text-[var(--foreground)] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-extrabold text-rose-500 mb-4">Something went wrong</h1>
      <p className="text-[var(--muted)] max-w-md mb-6">{error.message || 'An unexpected error occurred.'}</p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black font-bold text-sm hover:bg-[var(--gold-bright)] transition-colors cursor-pointer"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl nexus-glass-surface text-[var(--foreground)] font-bold text-sm hover:border-[var(--gold)] transition-colors"
        >
          Back Home
        </Link>
      </div>
    </main>
  );
}
