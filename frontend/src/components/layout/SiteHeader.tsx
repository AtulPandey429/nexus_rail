'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag,
  ArrowRight,
  User,
  Wallet,
  Menu,
  X,
  LogIn,
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
import { NexusLogo } from '@/components/ui/NexusLogo';
import { useTheme } from './ThemeProvider';
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';
import { UnifiedThemeDropdown } from './UnifiedThemeDropdown';

const NAV_LINKS = [
  { href: '/', label: 'Explore' },
  { href: '/store', label: 'Store' },
  { href: '/orders', label: 'Orders' },
  { href: '/app/swap', label: 'Swap' },
  { href: '/admin', label: 'Admin', adminOnly: true },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  // Completely hide customer storefront header on Admin dashboard
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const { theme, toggleTheme, setIsCustomizerOpen } = useTheme();

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
    if (pathname.startsWith('/admin') || pathname.startsWith('/profile')) router.push('/');
  };

  const isAdmin = user?.role === 'admin' || Boolean(user?.email && user.email.toLowerCase().includes('admin'));
  const filteredNavLinks = NAV_LINKS.filter((link) => !link.adminOnly || isAdmin);

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const userDisplayName = user?.name
    ? user.name
    : user?.email
    ? user.email.split('@')[0]
    : user?.stellarAddress
    ? `${user.stellarAddress.slice(0, 4)}..${user.stellarAddress.slice(-4)}`
    : user?.xrplAddress
    ? `${user.xrplAddress.slice(0, 4)}..${user.xrplAddress.slice(-4)}`
    : user?.walletAddress
    ? `${user.walletAddress.slice(0, 4)}..${user.walletAddress.slice(-4)}`
    : 'Account';

  // Connected Wallet Resolution (Stellar / XRPL / Google Linkage)
  const connectedAddress =
    user?.lastConnectedWallet?.address ||
    user?.stellarAddress ||
    user?.xrplAddress ||
    (user?.walletAddress && (user.walletAddress.startsWith('G') || user.walletAddress.startsWith('r')) ? user.walletAddress : null);

  const isStellar = connectedAddress?.startsWith('G');
  const isXrpl = connectedAddress?.startsWith('r');

  const walletProvider =
    user?.lastConnectedWallet?.provider ||
    (isStellar ? 'Freighter' : isXrpl ? 'Crossmark' : 'Web3 Wallet');

  const walletNetwork =
    user?.lastConnectedWallet?.network ||
    (isStellar ? 'stellar' : isXrpl ? 'xrpl' : undefined);

  const formattedWalletAddress = connectedAddress
    ? `${connectedAddress.slice(0, 4)}...${connectedAddress.slice(-4)}`
    : null;

  const hasConnectedWallet = Boolean(connectedAddress);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Status */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <NexusLogo size={30} glow priority className="group-hover:scale-105 transition-transform shadow-md" />
            <span className="text-base font-bold text-[var(--foreground)] tracking-tight font-mono">
              nexusrail
            </span>
          </Link>

          <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[10px] font-mono text-[var(--muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dual-Rail Testnet</span>
          </span>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 font-mono text-xs">
          {filteredNavLinks.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-xl transition-all ${
                  active
                    ? 'text-[var(--foreground)] bg-[var(--card-hover)] border border-[var(--border-highlight)] font-bold shadow-sm shadow-[var(--gold)]/10'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Theme Dropdown, Cart, User Pill, Wallet */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Single Unified Theme & Effects Dropdown (Hover & Click) */}
          <UnifiedThemeDropdown />

          {/* Cart Icon (Bold & Prominent) */}
          <Link
            href="/cart"
            className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-highlight)] flex items-center gap-1.5 text-xs text-[var(--foreground)] transition-all relative shadow-sm cursor-pointer"
            aria-label="View shopping cart"
          >
            <ShoppingBag className="w-5 h-5 text-[var(--muted)] hover:text-[var(--foreground)]" strokeWidth={2.4} />
            {cartCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[var(--gold)] text-black text-[10px] font-mono font-bold animate-pulse">
                {cartCount}
              </span>
            )}
          </Link>

          {/* Authenticated User Pill vs Unauthenticated Unified Sign In / Connect */}
          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              {hasConnectedWallet ? (
                /* 1. Wallet is Connected: Show Address + Sub-label with Wallet Provider Badge */
                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(true)}
                  title="Click to switch or manage Web3 wallets"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--gold)] transition-all cursor-pointer group shadow-sm text-left"
                >
                  <span className={`w-2 h-2 rounded-full ${walletNetwork === 'stellar' ? 'bg-[#00E5FF]' : 'bg-[#0081F2]'} animate-pulse shrink-0`} />
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-xs font-bold text-[var(--foreground)] group-hover:text-[var(--gold)] transition-colors">
                      {formattedWalletAddress}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--muted)] flex items-center gap-1">
                      <span>{walletProvider}</span>
                      <span className="opacity-40">·</span>
                      <span className="uppercase text-[9px] opacity-70">{walletNetwork === 'stellar' ? 'Stellar' : 'XRPL'}</span>
                    </span>
                  </div>
                </button>
              ) : (
                /* 2. Logged in via Google / Email only: Show Google Name + Prominent '+ Connect Wallet' CTA */
                <div className="flex items-center gap-2">
                  <Link
                    href="/profile"
                    title="View Account Profile"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-highlight)] text-xs font-mono transition-all cursor-pointer text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-xs text-[var(--foreground)] max-w-[110px] truncate">
                        {user.name || user.email?.split('@')[0] || 'Google User'}
                      </span>
                      <span className="text-[9px] text-[var(--muted)]">Google Account</span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsWalletModalOpen(true)}
                    title="Connect Stellar (Freighter) or XRPL (Crossmark / GemWallet) Wallet"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--gold)]/15 hover:bg-[var(--gold)]/25 border border-[var(--gold)]/40 text-[var(--gold)] text-xs font-mono font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <Wallet className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>+ Connect Wallet</span>
                  </button>
                </div>
              )}

              {/* Profile Shortcut when wallet is connected */}
              {hasConnectedWallet && (
                <Link
                  href="/profile"
                  title="View Account & Portfolio"
                  className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                    pathname === '/profile'
                      ? 'bg-[var(--card-hover)] border-[var(--border-highlight)] text-[var(--foreground)]'
                      : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--gold)]'
                  }`}
                  aria-label="Account Profile"
                >
                  <User className="w-4 h-4" />
                </Link>
              )}

              <button
                type="button"
                onClick={signOut}
                className="text-[11px] font-mono text-[var(--muted)] hover:text-rose-400 transition-colors px-1 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              {/* Single Unified Authentication & Wallet Gateway Button */}
              <Link
                href="/login"
                className="items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black text-xs font-mono font-bold transition-all flex shadow-md shadow-[var(--gold)]/20 active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4" strokeWidth={2.4} />
                <span>Sign In / Connect</span>
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-highlight)] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" strokeWidth={2.4} /> : <Menu className="w-6 h-6" strokeWidth={2.4} />}
          </button>
        </div>
      </div>

      {/* Mobile Glass Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface-solid)]/95 backdrop-blur-2xl p-4 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col space-y-1 font-mono text-xs">
            {filteredNavLinks.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2.5 rounded-xl transition-all ${
                    active
                      ? 'text-[var(--foreground)] bg-[var(--card-hover)] border border-[var(--border-highlight)] font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-[var(--border)] space-y-2">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[var(--gold)]" />
                    <span>My Profile ({userDisplayName})</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)]" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsWalletModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--gold)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    <span>{hasConnectedWallet ? `${formattedWalletAddress} (${walletProvider})` : '+ Connect Web3 Wallet'}</span>
                  </div>
                  <span className="text-[10px] text-[var(--muted)] uppercase">{walletNetwork || 'Stellar / XRPL'}</span>
                </button>

                <button
                  type="button"
                  onClick={signOut}
                  className="w-full py-2 px-3.5 rounded-xl text-left text-xs font-mono text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div>
                <Link
                  href="/login"
                  className="w-full py-2.5 px-3 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In / Connect</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Wallet Connect Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={(acc) => {
          setIsWalletModalOpen(false);
          setUser(readSession().user);
        }}
      />
    </header>
  );
}
