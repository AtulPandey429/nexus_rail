'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/rwa', label: 'Prices' },
  { href: '/rwa/buy', label: 'Buy gold' },
  { href: '/rwa/perps', label: 'Price quote' },
];

export default function RwaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-2 rounded-xl text-sm font-mono transition-colors ${
                  active
                    ? 'bg-[var(--gold)]/20 border border-[var(--gold)] text-[var(--gold)] font-bold'
                    : 'text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--card)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <p className="text-sm text-[var(--muted)] font-mono">Market prices from the metals quote. Token issuance is not offered.</p>
        {children}
      </div>
    </div>
  );
}
