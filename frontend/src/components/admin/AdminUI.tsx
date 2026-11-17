'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  Copy,
  Inbox,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';

/* ==========================================================================
   NexusRail Admin Design System
   Small, dependency-free primitives shared by every operator console page.
   ========================================================================== */

export type AdminTone = 'gold' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'neutral';
export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'gold'
  | 'violet'
  | 'neutral';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* -------------------------------- Surfaces -------------------------------- */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-admin-border bg-admin-surface/90 shadow-admin-card',
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-admin-gold/80">
            {eyebrow}
          </p>
        )}
        <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-admin-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* --------------------------------- Buttons -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-b from-[#F3CB6C] to-[#DFA637] text-[#1A1405] shadow-[0_12px_30px_-14px_rgba(233,185,73,0.85)] hover:brightness-[1.06] active:brightness-95',
    secondary:
      'border border-admin-border bg-admin-raised text-slate-200 hover:border-white/15 hover:bg-admin-hover',
    ghost: 'text-slate-400 hover:bg-white/[0.06] hover:text-white',
    danger:
      'border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:border-rose-500/40 hover:bg-rose-500/15',
    subtle: 'bg-white/[0.045] text-slate-300 hover:bg-white/[0.09] hover:text-white',
  };
  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
    md: 'h-10 gap-2 rounded-xl px-4 text-[13px]',
    lg: 'h-11 gap-2 rounded-xl px-5 text-sm',
  };

  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className
  );
}

export function Button({
  children,
  variant,
  size,
  loading,
  icon: Icon,
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant,
  size,
  icon: Icon,
  className,
  external,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  className?: string;
  external?: boolean;
}) {
  const classes = buttonStyles({ variant, size, className });
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  icon: Icon,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-admin-raised text-slate-400 transition-colors hover:border-white/15 hover:bg-admin-hover hover:text-white disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/* --------------------------------- Badges --------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    danger: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    info: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    gold: 'border-admin-gold/25 bg-admin-gold/10 text-admin-gold-soft',
    violet: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    neutral: 'border-white/10 bg-white/[0.045] text-slate-300',
  };
  const dotTones: Record<BadgeTone, string> = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    gold: 'bg-admin-gold',
    violet: 'bg-violet-400',
    neutral: 'bg-slate-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
        tones[tone],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotTones[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function statusTone(status?: string): BadgeTone {
  const value = (status || '').toUpperCase();
  if (['PAID', 'FULFILLED', 'SETTLED', 'SUCCESS', 'VERIFIED', 'ACTIVE', 'ONLINE', 'BALANCED', 'COMPLETE'].includes(value)) {
    return 'success';
  }
  if (['FULFILLING', 'PENDING', 'PROCESSING', 'DEGRADED', 'SYNCING'].includes(value)) {
    return 'warning';
  }
  if (['FAILED', 'REJECTED', 'PAUSED', 'OFFLINE', 'CANCELLED', 'ERROR'].includes(value)) {
    return 'danger';
  }
  return 'neutral';
}

export function StatusBadge({ status, withDot = true }: { status?: string; withDot?: boolean }) {
  const label = (status || 'UNKNOWN').toUpperCase();
  return (
    <Badge tone={statusTone(label)} dot={withDot}>
      {label}
    </Badge>
  );
}

/* -------------------------------- Stat card ------------------------------- */

const toneClasses: Record<AdminTone, { icon: string; line: string; value: string }> = {
  gold: {
    icon: 'border-admin-gold/20 bg-admin-gold/10 text-admin-gold-soft',
    line: 'via-admin-gold/70',
    value: 'text-admin-gold-soft',
  },
  cyan: {
    icon: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    line: 'via-sky-400/60',
    value: 'text-sky-300',
  },
  emerald: {
    icon: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    line: 'via-emerald-400/60',
    value: 'text-emerald-300',
  },
  violet: {
    icon: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    line: 'via-violet-400/60',
    value: 'text-violet-300',
  },
  rose: {
    icon: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    line: 'via-rose-400/60',
    value: 'text-rose-300',
  },
  neutral: {
    icon: 'border-white/10 bg-white/[0.05] text-slate-300',
    line: 'via-white/25',
    value: 'text-white',
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
  aside,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: AdminTone;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  const styles = toneClasses[tone];
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-admin-border bg-gradient-to-b from-admin-surface to-[#0C1017] p-5 shadow-admin-card transition-colors duration-200 hover:border-white/[0.12]',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-70',
          styles.line
        )}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-admin-muted">{label}</p>
          <p
            className={cn(
              'mt-3 truncate font-admin-mono text-[25px] font-semibold leading-none tracking-tight admin-tabular sm:text-[27px]',
              styles.value
            )}
          >
            {value}
          </p>
        </div>
        {Icon && (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105',
              styles.icon
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {(hint || aside) && (
        <div className="mt-3.5 flex min-h-[18px] items-center justify-between gap-2 text-[11px] text-admin-muted">
          <div className="min-w-0 truncate">{hint}</div>
          {aside}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Form fields ------------------------------ */

export const inputClassName =
  'w-full rounded-xl border border-admin-border bg-[#090C12] px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-admin-faint transition-colors focus:border-admin-gold/50 focus:outline-none focus:ring-2 focus:ring-admin-gold/10 disabled:opacity-60';

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-admin-muted"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-admin-faint">{hint}</p>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-faint"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className={cn(inputClassName, 'h-10 py-0 pl-9 pr-3 text-xs')}
      />
    </div>
  );
}

/* --------------------------------- Table ---------------------------------- */

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('-mx-1 overflow-x-auto', className)}>{children}</div>;
}

export function Table({ children, minWidth = 760 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <table className="w-full border-separate border-spacing-0 text-left text-[13px]" style={{ minWidth }}>
      {children}
    </table>
  );
}

export function Th({
  children,
  className,
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-admin-border px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-admin-muted',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className={cn(
        'border-b border-white/[0.045] px-3 py-3.5 align-middle text-slate-300',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </td>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-admin-border bg-admin-raised text-admin-muted">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-admin-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------- Progress -------------------------------- */

export function ProgressBar({
  value,
  tone = 'gold',
  className,
  label,
}: {
  value: number;
  tone?: 'gold' | 'cyan' | 'violet' | 'emerald';
  className?: string;
  label?: string;
}) {
  const toneMap = {
    gold: 'from-admin-gold-soft to-admin-gold',
    cyan: 'from-sky-300 to-sky-500',
    violet: 'from-violet-300 to-violet-500',
    emerald: 'from-emerald-300 to-emerald-500',
  };
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', toneMap[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* --------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  footer,
  size = 'lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="animate-admin-fade fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'animate-admin-rise relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-admin-border bg-[#0B0F16] shadow-admin-pop focus:outline-none sm:rounded-2xl',
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-admin-border px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-admin-gold/20 bg-admin-gold/10 text-admin-gold-soft">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-white">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-xs leading-relaxed text-admin-muted">{description}</p>}
            </div>
          </div>
          <IconButton label="Close dialog" icon={X} onClick={onClose} className="shrink-0" />
        </div>
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-admin-border bg-[#090C12]/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Copy control ------------------------------ */

export function CopyValue({
  value,
  display,
  label = 'Copy value',
  className,
  mono = true,
}: {
  value?: string;
  display?: string;
  label?: string;
  className?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : label}
      aria-label={copied ? `Copied: ${display ?? value ?? ''}` : `${label}: ${display ?? value ?? ''}`}
      className={cn(
        'group inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-slate-400 transition-colors hover:text-white',
        mono && 'font-admin-mono text-[11px]',
        className
      )}
      disabled={!value}
    >
      <span className="truncate">{display ?? value ?? '—'}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      )}
    </button>
  );
}

/* -------------------------------- Feedback -------------------------------- */

export function Feedback({
  tone = 'success',
  children,
}: {
  tone?: 'success' | 'error' | 'info';
  children: React.ReactNode;
}) {
  const tones = {
    success: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200',
    error: 'border-rose-400/25 bg-rose-400/[0.07] text-rose-200',
    info: 'border-sky-400/25 bg-sky-400/[0.07] text-sky-200',
  };
  const Icon = tone === 'success' ? Check : AlertCircle;
  return (
    <div
      role="status"
      className={cn('flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed', tones[tone])}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/* -------------------------------- Skeleton -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('admin-skeleton block rounded-md bg-white/[0.05]', className)} aria-hidden="true" />;
}

/* -------------------------------- Metric row ------------------------------ */

export function MetricRow({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-2.5', className)}>
      <div className="min-w-0">
        <p className="text-xs text-admin-muted">{label}</p>
        {hint && <p className="mt-0.5 text-[10px] text-admin-faint">{hint}</p>}
      </div>
      <div className="shrink-0 text-right font-admin-mono text-xs font-semibold text-slate-200 admin-tabular">
        {value}
      </div>
    </div>
  );
}
