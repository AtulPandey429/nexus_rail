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
    <main className="min-h-screen bg-nexus-dark text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-extrabold text-red-500 mb-4">Something went wrong</h1>
      <p className="text-gray-400 max-w-md mb-6">{error.message || 'An unexpected error occurred.'}</p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 rounded-xl bg-rail-emerald text-nexus-dark font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-gray-800 text-gray-200 font-bold text-sm hover:bg-gray-700 transition-colors"
        >
          Back Home
        </Link>
      </div>
    </main>
  );
}
