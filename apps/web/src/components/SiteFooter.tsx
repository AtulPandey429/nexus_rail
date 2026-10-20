'use client';

import React from 'react';
import Link from 'next/link';
import { NexusLogo } from './NexusLogo';

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-[var(--border)] bg-[var(--surface-solid)] text-[var(--muted)] text-xs py-10 px-4 sm:px-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <NexusLogo size={20} glow />
              <span className="font-bold text-[var(--foreground)] tracking-tight lowercase font-mono">nexusrail</span>
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              The connected multi-rail crypto commerce engine. Built on Stellar Horizon & XRPL Ledgers.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-xs font-mono">
            <Link href="/store" className="hover:text-[var(--gold)] transition-colors">Store</Link>
            <Link href="/orders" className="hover:text-[var(--gold)] transition-colors">Orders</Link>
            <Link href="/app/swap" className="hover:text-[var(--gold)] transition-colors">Swap</Link>
            <Link href="/app/activity" className="hover:text-[var(--gold)] transition-colors">Activity</Link>
            <Link href="/admin" className="hover:text-[var(--gold)] transition-colors">Workspace</Link>
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[var(--muted)]">
          <div>
            &copy; {new Date().getFullYear()} NexusRail. All rights reserved. Cryptographic ledger verification engine.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
            <span className="font-mono text-[var(--foreground)]">Multi-Rail Systems: Active</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
