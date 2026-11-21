'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { Badge, cn, type BadgeTone } from '@/components/admin/AdminUI';

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'entries',
  itemLabelSingular,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  itemLabelSingular?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const singularLabel =
    itemLabelSingular || (itemLabel === 'entries' ? 'entry' : itemLabel.replace(/s$/, ''));
  const displayLabel = totalItems === 1 ? singularLabel : itemLabel;

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
        {displayLabel}
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
            'rounded px-1 font-admin-mono text-[11px]',
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
  otherPct = 0,
}: {
  stellarPct: number;
  xrplPct: number;
  otherPct?: number;
}) {
  const radius = 54;
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label="Settlement volume split between Stellar, XRPL, and other rails">
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
        {otherPct > 0 && (
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#e9b949"
            strokeWidth="14"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${otherPct} ${100 - otherPct}`}
            strokeDashoffset={-(stellarPct + xrplPct)}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-admin-mono text-2xl font-semibold tracking-tight text-white">
          {otherPct > 0 ? 3 : 2}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-admin-faint">rails</span>
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-admin-faint">{label}</p>
      <p className={cn('mt-1.5 truncate font-admin-mono text-[13px] font-semibold admin-tabular', tone)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-admin-faint">{hint}</p>}
    </div>
  );
}

export function AdminBrandMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-admin-gold/30 bg-gradient-to-br from-[#2A2415] to-[#14120C] shadow-admin-glow',
        className
      )}
      style={{ width: size, height: size }}
    >
      {!failed ? (
        <Image
          src="/logo-icon.webp"
          alt="NexusRail"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className="font-admin-mono text-sm font-bold text-admin-gold-soft">N</span>
      )}
    </span>
  );
}

export function AssetAvatar({
  symbol,
  size = 28,
  className,
}: {
  symbol?: string | null;
  size?: number;
  className?: string;
}) {
  const [nxlFailed, setNxlFailed] = useState(false);
  const key = (symbol || '').toUpperCase().trim();

  if (key === 'NXL' || key === 'NR' || key.includes('NXL')) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-admin-gold/30 bg-admin-gold/10',
          className
        )}
        style={{ width: size, height: size }}
      >
        {!nxlFailed ? (
          <Image
            src="/logo-icon.webp"
            alt="$NXL"
            width={size}
            height={size}
            onError={() => setNxlFailed(true)}
            className="h-full w-full object-contain p-0.5"
          />
        ) : (
          <span className="font-admin-mono text-[10px] font-bold text-admin-gold-soft">NXL</span>
        )}
      </span>
    );
  }

  if (key.includes('XLM') || key.includes('STELLAR')) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border border-sky-400/25 bg-sky-400/10 text-sky-300',
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none">
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 15.5L20 6.5M4 18.5L20 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (key.includes('XRP') || key.includes('XRPL')) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-400/10 text-violet-300',
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none">
          <path
            d="M5 5l5.4 5.2a2.3 2.3 0 003.2 0L19 5M5 19l5.4-5.2a2.3 2.3 0 013.2 0L19 19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (key.includes('USDC')) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border border-blue-400/25 bg-blue-400/10 text-blue-300',
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7v10M9.8 10c0-1 .9-1.7 2.2-1.7s2.2.7 2.2 1.7c0 2-4.4 1.3-4.4 3.5 0 1 1 1.8 2.2 1.8s2.2-.7 2.2-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (key.includes('RLUSD')) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 font-admin-mono text-[10px] font-bold',
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        R$
      </span>
    );
  }

  if (key.includes('GOLD')) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300',
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none">
          <path d="M5 17l2-8h10l2 8H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8.5 9l1-3.5h5l1 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (key.includes('SILVER')) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border border-slate-300/25 bg-slate-300/10 text-slate-200',
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none">
          <path d="M4.5 16.5L7 8.5h10l2.5 8H4.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] font-admin-mono text-[10px] font-bold text-slate-300',
        className
      )}
      style={{ width: size, height: size }}
    >
      {(key || 'AS').slice(0, 3)}
    </span>
  );
}

const PRODUCT_THUMB_MAP: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'NODE-STAND': '/products/node-stand.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'RAIL-CABLES': '/products/rail-cables.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
};

export function ProductThumb({
  sku,
  title,
  category,
  isBasket,
  size = 34,
}: {
  sku?: string;
  title?: string;
  category?: string;
  isBasket?: boolean;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const upperSku = (sku || '').toUpperCase().trim();
  const mappedSrc = PRODUCT_THUMB_MAP[upperSku];

  if (mappedSrc && !imgFailed) {
    return (
      <span
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-[#0A0E15]"
        style={{ width: size, height: size }}
      >
        <Image
          src={mappedSrc}
          alt={title || upperSku || 'Product'}
          width={size}
          height={size}
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  if (upperSku.includes('GOLD')) return <AssetAvatar symbol="GOLD_G" size={size} />;
  if (upperSku.includes('SILVER')) return <AssetAvatar symbol="SILVER_G" size={size} />;
  if (upperSku.includes('NXL') || upperSku.includes('NR-')) return <AssetAvatar symbol="NXL" size={size} />;
  if (upperSku.includes('XRP')) return <AssetAvatar symbol="XRP" size={size} />;
  if (upperSku.includes('XLM')) return <AssetAvatar symbol="XLM" size={size} />;

  if (isBasket || category === 'baskets' || upperSku.startsWith('BASKET')) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-lg border border-admin-gold/25 bg-admin-gold/10 text-admin-gold-soft"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Layers className="h-4 w-4" />
      </span>
    );
  }

  const initials = (title || upperSku || 'NR')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] font-admin-mono text-[11px] font-bold text-slate-300"
      style={{ width: size, height: size }}
    >
      {initials || 'NR'}
    </span>
  );
}
