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
          <div className="w-6 h-6 rounded-md bg-[#0E131E] border border-[#1C2638] flex items-center justify-center group-hover:border-rail-emerald/60 transition-colors">
            <span className="w-2 h-2 rounded-sm bg-rail-emerald shadow-sm shadow-rail-emerald/50" />
          </div>
          <span className="text-base font-bold text-white tracking-tight lowercase font-mono">nexusrail</span>
          <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#161D2B] border border-[#222C3E] text-[#8A93A6] uppercase tracking-wider">
            TESTNET / DEMO
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 font-mono text-xs">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  active
                    ? 'text-white bg-[#0E131E] border border-[#1C2638] font-semibold'
                    : 'text-[#8A93A6] hover:text-white hover:bg-[#0E131E]/60'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* User Connected Pill (Figma Screen 3 layout) */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/app/activity"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0E131E] border border-[#1C2638] text-xs font-mono text-white hover:border-[#2A374E] transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-rail-emerald" />
                <span className="font-semibold text-white">
                  {user.walletAddress
                    ? `${user.walletAddress.slice(0, 4)}..${user.walletAddress.slice(-4)}`
                    : user.email?.split('@')[0] || 'User'}
                </span>
              </Link>

              {/* Cart Icon */}
              <Link
                href="/app/cart"
                className="p-2 rounded-xl bg-[#0E131E] border border-[#1C2638] hover:border-rail-emerald/60 flex items-center gap-1.5 text-xs text-white transition-all relative"
                aria-label="View cart"
              >
                <ShoppingBag className="w-4 h-4 text-[#8A93A6]" />
                {cartCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rail-emerald text-[#05070A] text-[10px] font-mono font-bold">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* User Avatar Circle */}
              <div className="w-7 h-7 rounded-full bg-[#161D2B] border border-[#222C3E] flex items-center justify-center text-[11px] font-mono font-bold text-white uppercase">
                {user.email ? user.email.slice(0, 2) : 'NR'}
              </div>

              <button
                type="button"
                onClick={signOut}
                className="text-[11px] font-mono text-[#5A6478] hover:text-white transition-colors ml-1"
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
