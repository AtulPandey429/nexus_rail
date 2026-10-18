'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag,
  ArrowRight,
  User,
  Wallet,
  Sun,
  Moon,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  CART_EVENT,
  clearSession,
  fetchCartLines,
  onSessionChange,
  readSession,
  SessionUser,
  verifySession,
} from '@/lib/shop';
import { NexusLogo } from './NexusLogo';
import { useTheme } from './ThemeProvider';
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
  const { theme, toggleTheme } = useTheme();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-nexus-border bg-white/90 dark:bg-nexus-dark/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Logo & Network Status Pill */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <NexusLogo size={30} glow priority className="group-hover:scale-105 transition-transform shadow-md" />
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight lowercase font-mono">
              nexusrail
            </span>
          </Link>
          <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#161D2B] border border-slate-300 dark:border-[#222C3E] text-slate-600 dark:text-[#8A93A6] uppercase tracking-wider">
            TESTNET / DEMO
          </span>
        </div>

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
                    ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-[#0E131E] border border-slate-300 dark:border-[#1C2638] font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-[#8A93A6] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-[#0E131E]/60'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Theme Toggle, Cart, Wallet, Profile, Hamburger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle (Light / Dark) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#0E131E] border border-slate-300 dark:border-[#1C2638] text-slate-700 dark:text-gray-300 hover:text-rail-emerald dark:hover:text-rail-emerald hover:border-rail-emerald/50 transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 animate-spin-once" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Cart Icon */}
          <Link
            href="/cart"
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#0E131E] border border-slate-300 dark:border-[#1C2638] hover:border-rail-emerald/60 flex items-center gap-1.5 text-xs text-slate-800 dark:text-white transition-all relative shadow-sm"
            aria-label="View cart"
          >
            <ShoppingBag className="w-4 h-4 text-slate-600 dark:text-[#8A93A6]" />
            {cartCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rail-emerald text-[#05070A] text-[10px] font-mono font-bold animate-pulse">
                {cartCount}
              </span>
            )}
          </Link>

          {/* User Connected State / Auth Buttons */}
          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/app/activity"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0E131E] border border-slate-300 dark:border-[#1C2638] text-xs font-mono text-slate-800 dark:text-white hover:border-[#2A374E] transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-rail-emerald" />
                <span className="font-semibold">
                  {user.walletAddress
                    ? `${user.walletAddress.slice(0, 4)}..${user.walletAddress.slice(-4)}`
                    : user.email?.split('@')[0] || 'User'}
                </span>
              </Link>

              <button
                type="button"
                onClick={signOut}
                className="text-[11px] font-mono text-slate-500 dark:text-[#5A6478] hover:text-slate-900 dark:hover:text-white transition-colors ml-1"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-nexus-card border border-slate-300 dark:border-nexus-border hover:border-rail-emerald/60 text-xs font-mono text-slate-800 dark:text-white transition-all flex shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5 text-rail-emerald" />
                <span>Connect</span>
              </button>

              <Link
                href="/login"
                className="text-xs font-medium text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-colors px-1"
              >
                Sign in
              </Link>

              <Link
                href="/store"
                className="px-3.5 py-1.5 rounded-lg bg-rail-emerald text-nexus-dark text-xs font-bold flex items-center gap-1.5 hover:bg-rail-mint transition-all shadow-sm shadow-rail-emerald/20 active:scale-95"
              >
                <span>Launch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-[#0E131E] border border-slate-300 dark:border-[#1C2638] text-slate-800 dark:text-white hover:border-rail-emerald transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-nexus-border bg-white dark:bg-[#08090D] px-4 pt-3 pb-6 space-y-4 animate-fade-in-up shadow-2xl">
          {/* Navigation Links */}
          <nav className="flex flex-col space-y-1 font-mono text-sm">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-between ${
                    active
                      ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-[#0E131E] font-bold border border-slate-300 dark:border-[#1C2638]'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span>{link.label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-rail-emerald" />}
                </Link>
              );
            })}
          </nav>

          {/* Mobile User & Action Area */}
          <div className="pt-3 border-t border-slate-200 dark:border-nexus-border space-y-3">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0E131E] border border-slate-300 dark:border-[#1C2638] text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rail-emerald" />
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {user.walletAddress
                        ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                        : user.email || 'User'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-rose-500 font-bold hover:underline"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsWalletModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-nexus-card border border-slate-300 dark:border-nexus-border text-xs font-mono font-bold text-slate-800 dark:text-white flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Wallet className="w-3.5 h-3.5 text-rail-emerald" />
                  <span>Wallet</span>
                </button>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-3 rounded-xl bg-rail-emerald hover:bg-rail-mint text-nexus-dark text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-rail-emerald/20"
                >
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Testnet pill in mobile */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-gray-400 px-1 pt-1">
              <span>Network: Stellar & XRPL</span>
              <span className="text-rail-emerald font-bold">TESTNET ACTIVE</span>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </header>
  );
}
