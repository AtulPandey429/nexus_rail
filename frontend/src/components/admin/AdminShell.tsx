'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  ExternalLink,
  KeyRound,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { IconButton, cn } from '@/components/admin/AdminUI';
import { AdminBrandMark } from '@/components/admin/AdminBits';
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  type AdminNavItem,
} from '@/components/admin/adminNav';

type ShellUser = {
  email?: string;
  role?: string;
  name?: string;
};

export type AdminShellProps = {
  user: ShellUser;
  activeId: string;
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onSignOut: () => void;
  onNavigate?: (id: string) => void;
  onOpenCredentials?: () => void;
  navItems?: AdminNavItem[];
};

function initialsFor(user: ShellUser) {
  const source = (user.name || user.email || 'NR').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] || 'N').concat(parts[1]?.[0] || parts[0]?.[1] || 'R').toUpperCase();
}

function LivePill({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] font-medium text-emerald-300',
        compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
      )}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <span className="hidden xl:inline">Stellar + XRPL</span>
      <span className="xl:hidden">Live</span>
    </span>
  );
}

function Brand({ onNavigateHome }: { onNavigateHome?: () => void }) {
  return (
    <Link
      href="/admin"
      onClick={onNavigateHome}
      className="group flex items-center gap-3 rounded-xl focus-visible:outline-none"
      aria-label="NexusRail operator console home"
    >
      <AdminBrandMark size={36} />
      <span className="min-w-0">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-tight text-white">nexusrail</span>
          <span className="font-admin-mono text-[9px] uppercase tracking-[0.2em] text-admin-gold/80">Ops</span>
        </span>
        <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-admin-faint">
          Operator console
        </span>
      </span>
    </Link>
  );
}

function NavList({
  items,
  activeId,
  onNavigate,
}: {
  items: AdminNavItem[];
  activeId: string;
  onNavigate?: (id: string) => void;
}) {
  const itemClass = (active: boolean) =>
    cn(
      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-150',
      active
        ? 'bg-gradient-to-r from-admin-gold/[0.14] via-admin-gold/[0.05] to-transparent text-white ring-1 ring-inset ring-admin-gold/20'
        : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100'
    );

  const iconClass = (active: boolean) =>
    cn(
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
      active
        ? 'border-admin-gold/25 bg-admin-gold/10 text-admin-gold-soft'
        : 'border-white/[0.06] bg-white/[0.03] text-slate-500 group-hover:border-white/10 group-hover:text-slate-200'
    );

  return (
    <nav aria-label="Operator console sections" className="space-y-5">
      {ADMIN_NAV_GROUPS.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (!groupItems.length) return null;
        return (
          <div key={group}>
            <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-admin-faint">
              {group}
            </p>
            <div className="space-y-0.5">
              {groupItems.map((item) => {
                const Icon = item.icon;
                const active = activeId === item.id;
                const content = (
                  <>
                    {active && (
                      <span
                        className="absolute -left-2 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-admin-gold"
                        aria-hidden="true"
                      />
                    )}
                    <span className={iconClass(active)} aria-hidden="true">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {active && <ChevronRight className="h-3.5 w-3.5 text-admin-gold/70" aria-hidden="true" />}
                  </>
                );

                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={itemClass(active)}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate?.(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={itemClass(active)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  onOpenCredentials,
  onSignOut,
}: {
  onOpenCredentials?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="space-y-2 border-t border-admin-border/70 px-3 py-4">
      {onOpenCredentials && (
        <button
          type="button"
          onClick={onOpenCredentials}
          className="group flex w-full items-center gap-2.5 rounded-xl border border-admin-border bg-admin-raised px-3 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-admin-gold/25 hover:bg-admin-hover hover:text-white"
        >
          <KeyRound className="h-3.5 w-3.5 text-admin-gold" aria-hidden="true" />
          <span className="flex-1 text-left">Vault credentials</span>
          <ShieldCheck className="h-3.5 w-3.5 text-admin-faint transition-colors group-hover:text-admin-gold" aria-hidden="true" />
        </button>
      )}
      <div className="flex items-center gap-1.5">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center gap-2 rounded-lg px-2 py-2 text-[11px] text-admin-muted transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          View storefront
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-[11px] text-admin-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut className="h-3 w-3" aria-hidden="true" />
          Sign out
        </button>
      </div>
      <p className="px-2 font-admin-mono text-[9px] tracking-wide text-admin-faint/80">
        build 2.4.0 · Soroban + XLS-30d
      </p>
    </div>
  );
}

export function AdminShell({
  user,
  activeId,
  title,
  description,
  eyebrow = 'Operator console',
  actions,
  children,
  onSignOut,
  onNavigate,
  onOpenCredentials,
  navItems = ADMIN_NAV_ITEMS,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clock, setClock] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () =>
      setClock(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
          hour12: false,
        })
      );
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 40);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
    };
  }, [mobileOpen]);

  const handleNavigate = (id: string) => {
    onNavigate?.(id);
    setMobileOpen(false);
  };

  return (
    <div className="admin-canvas flex min-h-screen w-full">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-lg focus:bg-admin-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-admin-border/70 bg-admin-sidebar/95 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-admin-border/60 px-5">
          <Brand />
        </div>
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <NavList items={navItems} activeId={activeId} onNavigate={onNavigate} />
        </div>
        <SidebarFooter onOpenCredentials={onOpenCredentials} onSignOut={onSignOut} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="animate-admin-fade absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            tabIndex={-1}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Operator navigation"
            className="animate-admin-drawer absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-admin-border bg-admin-sidebar shadow-admin-pop"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-admin-border/60 px-5">
              <Brand onNavigateHome={() => setMobileOpen(false)} />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <NavList items={navItems} activeId={activeId} onNavigate={handleNavigate} />
            </div>
            <div className="border-t border-admin-border/70 px-4 py-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-admin-gold/10 font-admin-mono text-[11px] font-bold text-admin-gold-soft">
                  {initialsFor(user)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-admin-mono text-[11px] text-slate-200">{user.email || 'operator session'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-admin-faint">{user.role || 'operator'}</p>
                </div>
              </div>
              <SidebarFooter onOpenCredentials={onOpenCredentials} onSignOut={onSignOut} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 border-b border-admin-border/70 bg-[#080B10]/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <IconButton
                label="Open navigation"
                icon={Menu}
                onClick={() => setMobileOpen(true)}
                className="lg:hidden"
              />
              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <Link
                  href="/admin"
                  className="text-[11px] font-medium uppercase tracking-[0.16em] text-admin-faint transition-colors hover:text-slate-300"
                >
                  Console
                </Link>
                <ChevronRight className="h-3 w-3 shrink-0 text-admin-faint/60" aria-hidden="true" />
                <span className="truncate text-xs font-medium text-slate-200">{title}</span>
              </div>
              <span className="truncate text-sm font-semibold text-white sm:hidden">{title}</span>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <LivePill />
              <span className="hidden items-center gap-1.5 font-admin-mono text-[11px] text-admin-muted md:inline-flex">
                <Clock3 className="h-3.5 w-3.5 text-admin-faint" aria-hidden="true" />
                {clock ? `${clock} UTC` : '—'}
              </span>
              <span className="hidden h-5 w-px bg-admin-border sm:block" aria-hidden="true" />
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-admin-muted transition-colors hover:bg-white/[0.05] hover:text-white md:inline-flex"
              >
                Storefront
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </Link>
              <div className="hidden items-center gap-2 rounded-xl border border-admin-border bg-admin-raised py-1.5 pl-1.5 pr-3 sm:flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-admin-gold/25 to-admin-gold/[0.05] font-admin-mono text-[10px] font-bold text-admin-gold-soft">
                  {initialsFor(user)}
                </span>
                <div className="hidden leading-tight xl:block">
                  <p className="max-w-[180px] truncate font-admin-mono text-[10px] text-slate-300">{user.email || 'operator session'}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">
                    {user.role || 'operator'}
                  </p>
                </div>
              </div>
              <IconButton
                label="Sign out of operator console"
                icon={LogOut}
                onClick={onSignOut}
                className="hover:border-rose-400/25 hover:bg-rose-500/10 hover:text-rose-300"
              />
            </div>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-admin-gold/80">
                  <span className="h-1 w-1 rounded-full bg-admin-gold" aria-hidden="true" />
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-[25px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[29px]">
                  {title}
                </h1>
                {description && (
                  <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-admin-muted">{description}</p>
                )}
              </div>
              {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>

            <div key={activeId} className="animate-admin-rise mt-6">
              {children}
            </div>

            <footer className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-admin-border/60 pt-4 text-[10px] text-admin-faint sm:flex-row sm:items-center">
              <p>NexusRail operator console · restricted access · testnet operations only</p>
              <p className="font-admin-mono">© {new Date().getFullYear()} NexusRail Labs</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
