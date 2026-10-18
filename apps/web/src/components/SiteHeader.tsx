'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { CART_EVENT, clearSession, fetchCartLines, onSessionChange, readSession, SessionUser, verifySession } from '@/lib/shop';

const links = [
  { href: '/', label: 'Shop' },
  { href: '/rwa', label: 'Gold' },
  { href: '/app', label: 'Account' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cartCount, setCartCount] = useState(0);

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

  return (
    <header className="w-full border-b border-gray-800 bg-nexus-card/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-rail-emerald to-stellar-cyan text-nexus-dark font-bold flex items-center justify-center">
              NR
            </span>
            <span>
              <span className="block text-lg font-bold text-white">NexusRail</span>
              <span className="block text-[11px] text-gray-400">Catalog and checkout through the API</span>
            </span>
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-xl text-sm font-semibold ${
                isActive(pathname, link.href)
                  ? 'bg-rail-emerald/15 text-rail-emerald'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/app/cart"
            className={`px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 ${
              pathname.startsWith('/app/cart')
                ? 'bg-rail-emerald/15 text-rail-emerald'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Cart
            <span className="px-1.5 py-0.5 rounded-full bg-rail-emerald text-nexus-dark text-[10px] font-bold">{cartCount}</span>
          </Link>
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className={`px-3 py-2 rounded-xl text-sm font-semibold ${
                pathname.startsWith('/admin') ? 'bg-amber-400/15 text-amber-300' : 'text-gray-300 hover:text-white'
              }`}
            >
              Operator
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-gray-300">{user.email || user.walletAddress || 'Signed in'}</span>
              <button
                type="button"
                onClick={signOut}
                className="px-3 py-2 rounded-xl border border-gray-700 text-xs text-gray-200 hover:border-gray-500"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-3 py-2 rounded-xl bg-rail-emerald text-nexus-dark text-xs font-bold"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
