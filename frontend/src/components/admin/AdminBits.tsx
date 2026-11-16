'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, cn, type BadgeTone } from '@/components/admin/AdminUI';

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'entries',
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageButtons = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
  );

  const navClass =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border bg-admin-raised text-slate-400 transition-colors hover:border-white/15 hover:bg-admin-hover hover:text-white disabled:pointer-events-none disabled:opacity-35';

  return (
    <div className="flex flex-col items-start justify-between gap-3 border-t border-admin-border/70 pt-4 text-[11px] text-admin-muted sm:flex-row sm:items-center">
      <p>
        Showing{' '}
        <span className="font-admin-mono font-semibold text-slate-200 admin-tabular">{startItem}</span>
        {' – '}
        <span className="font-admin-mono font-semibold text-slate-200 admin-tabular">{endItem}</span> of{' '}
        <span className="font-admin-mono font-semibold text-slate-200 admin-tabular">{totalItems}</span>{' '}
        {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={navClass}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pageButtons.map((page, index) => {
          const previous = pageButtons[index - 1];
          return (
            <React.Fragment key={page}>
              {previous && page - previous > 1 && (
                <span className="px-1 font-admin-mono text-admin-faint" aria-hidden="true">
                  …
                </span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={currentPage === page ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-[32px] rounded-lg px-2 font-admin-mono text-[11px] font-medium transition-colors',
                  currentPage === page
                    ? 'bg-admin-gold-soft font-bold text-[#1A1405] shadow-[0_6px_18px_-8px_rgba(233,185,73,0.9)]'
                    : 'border border-admin-border bg-admin-raised text-slate-400 hover:bg-admin-hover hover:text-white'
                )}
              >
                {page}
              </button>
            </React.Fragment>
          );
        })}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={navClass}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors',
        active
          ? 'border-admin-gold/30 bg-admin-gold/10 text-admin-gold-soft'
          : 'border-admin-border bg-transparent text-admin-muted hover:border-white/15 hover:bg-white/[0.04] hover:text-slate-200'
      )}
    >
      {children}
      {typeof count === 'number' && (
        <span
          className={cn(
            'rounded px-1 font-admin-mono text-[10px]',
            active ? 'bg-admin-gold/15 text-admin-gold-soft' : 'bg-white/[0.06] text-admin-faint'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function RailSplitDonut({
  stellarPct,
  xrplPct,
}: {
  stellarPct: number;
  xrplPct: number;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label="Settlement volume split between Stellar and XRPL rails">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="14" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${stellarPct} ${100 - stellarPct}`}
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${xrplPct} ${100 - xrplPct}`}
          strokeDashoffset={-stellarPct}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-admin-mono text-2xl font-semibold tracking-tight text-white">2</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-admin-faint">rails</span>
      </div>
    </div>
  );
}

export function RailBadge({ rail }: { rail?: string | null }) {
  const value = (rail || '').toLowerCase();
  let tone: BadgeTone = 'neutral';
  if (value.includes('stellar') || value.includes('xlm') || value.includes('usdc')) tone = 'info';
  else if (value.includes('xrpl') || value.includes('xrp') || value.includes('rlusd')) tone = 'violet';
  else if (value.includes('swap') || value.includes('cross')) tone = 'gold';
  return <Badge tone={tone}>{rail || 'Dual-rail'}</Badge>;
}

export function MiniStat({
  label,
  value,
  hint,
  tone = 'text-white',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-admin-border bg-[#0B0F16] px-3.5 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">{label}</p>
      <p className={cn('mt-1.5 truncate font-admin-mono text-[13px] font-semibold admin-tabular', tone)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-admin-faint">{hint}</p>}
    </div>
  );
}
