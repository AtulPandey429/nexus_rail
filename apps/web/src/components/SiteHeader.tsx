'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, ArrowRight, User, Wallet } from 'lucide-react';
import { CART_EVENT, clearSession, fetchCartLines, onSessionChange, readSession, SessionUser, verifySession } from '@/lib/shop';
import { WalletConnectModal } from './WalletConnectModal';

const NAV_LINKS = [
  { href: '/', label: 'Explore' },
  { href: '/store', label: 'Store' },
  { href: '/app/swap', label: 'Swap' },
  { href: '/app/activity', label: 'Activity' },
  { href: '/admin', label: 'Admin' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  useEffect(() => {
    const sync = () => setUser(readSession().user);
    sync();
    verifySession().finally(sync);
    return onSessionChange(sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCart = () => {
      fetchCartLines()
        .then((lines) => {
          if (!cancelled) setCartCount(lines.reduce((sum, line) => sum + line.qty, 0));
        })
        .catch(() => {
          if (!cancelled) setCartCount(0);
        });
    };
    loadCart();
    window.addEventListener(CART_EVENT, loadCart);
    return () => {
      cancelled = true;
      window.removeEventListener(CART_EVENT, loadCart);
    };
  }, [pathname]);

  const signOut = () => {
    clearSession();
    if (pathname.startsWith('/admin')) router.push('/');
  };

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-nexus-border bg-nexus-dark/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 rounded-md bg-nexus-card border border-nexus-border flex items-center justify-center group-hover:border-rail-emerald/60 transition-colors">
            <span className="w-2 h-2 rounded-sm bg-rail-emerald shadow-sm shadow-rail-emerald/50" />
          </div>
          <span className="text-base font-bold text-white tracking-tight lowercase">nexusrail</span>
          <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-nexus-border/60 text-gray-400 uppercase tracking-widest">
            TESTNET
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'text-white bg-nexus-card border border-nexus-border font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-nexus-card/40'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Cart Icon Pill */}
          <Link
            href="/app/cart"
            className="px-3 py-1.5 rounded-lg bg-nexus-card border border-nexus-border hover:border-nexus-border-focus flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-rail-emerald" />
            <span className="hidden sm:inline">Bag</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rail-emerald/20 text-rail-emerald text-[11px] font-mono font-bold">
              {cartCount}
            </span>
          </Link>

          {/* User / Sign in / Launch Demo */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/app/activity"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexus-card border border-nexus-border text-xs text-gray-300 font-mono"
              >
                <User className="w-3 h-3 text-rail-emerald" />
                <span className="truncate max-w-[120px]">{user.email || user.walletAddress}</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="px-2.5 py-1.5 rounded-lg border border-nexus-border text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexus-card border border-nexus-border hover:border-rail-emerald/60 text-xs font-mono text-white transition-all"
              >
                <Wallet className="w-3.5 h-3.5 text-rail-emerald" />
                <span>Connect Wallet</span>
              </button>

              <Link
                href="/login"
                className="text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/store"
                className="px-3.5 py-1.5 rounded-lg bg-rail-emerald text-nexus-dark text-xs font-bold flex items-center gap-1.5 hover:bg-rail-mint transition-all shadow-sm shadow-rail-emerald/20"
              >
                <span>Launch demo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </header>
  );
}
