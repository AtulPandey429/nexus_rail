'use client';

import React from 'react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-nexus-border bg-slate-50 dark:bg-nexus-dark text-slate-600 dark:text-gray-400 text-xs py-10 px-4 sm:px-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-slate-200 dark:bg-nexus-card border border-slate-300 dark:border-nexus-border flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-sm bg-rail-emerald" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white tracking-tight lowercase">nexusrail</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-500">
              The connected multi-rail commerce engine. Built on Stellar Horizon & XRPL altnet testnets.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-xs font-mono">
            <Link href="/store" className="hover:text-slate-900 dark:hover:text-white transition-colors">Store</Link>
            <Link href="/app/swap" className="hover:text-slate-900 dark:hover:text-white transition-colors">Swap</Link>
            <Link href="/app/activity" className="hover:text-slate-900 dark:hover:text-white transition-colors">Activity</Link>
            <Link href="/admin" className="hover:text-slate-900 dark:hover:text-white transition-colors">Workspace</Link>
            <a href="https://horizon-testnet.stellar.org" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Horizon API
            </a>
            <a href="https://testnet.xrpl.org" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              XRPL Altnet
            </a>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-nexus-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-gray-500">
          <div>
            &copy; {new Date().getFullYear()} NexusRail. All rights reserved. Test assets only. No real funds or fulfillment.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
            <span className="font-mono text-slate-700 dark:text-gray-400">Systems: operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
