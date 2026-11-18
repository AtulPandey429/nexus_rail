'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/rwa', label: 'Live Prices' },
  { href: '/rwa/buy', label: 'Spot Reference' },
];

export default function RwaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 gap-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--gold)] text-[#08090C] font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
