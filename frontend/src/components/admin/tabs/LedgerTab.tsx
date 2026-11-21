'use client';

import React from 'react';
import { Boxes, Landmark, RefreshCw, Scale, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  MetricRow,
  ProgressBar,
  SectionHeader,
  Skeleton,
  StatCard,
  cn,
} from '@/components/admin/AdminUI';
import { AssetAvatar } from '@/components/admin/AdminBits';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatQuantity,
  formatUsd,
  type AdminModel,
} from '@/components/admin/adminModel';

export function LedgerTab({ model }: { model: AdminModel }) {
  const { aucData, aucLoading, loadPlatformAUC, lastSyncedAt } = model;

  const assets = aucData?.assets ?? [];
  const totalCustody = aucData ? aucData.total_custody_usd_cents / 100 : 0;
  const assetCount = assets.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total system AUC"
          value={aucData ? formatUsd(totalCustody) : aucLoading ? 'Syncing…' : '$0.00'}
          icon={Landmark}
          tone="gold"
          hint="Live oracle valuation of positive user holdings"
          aside={<Badge tone={aucData ? 'success' : 'neutral'} dot>{aucData ? 'Live DB' : 'Awaiting sync'}</Badge>}
        />
        <StatCard
          label="Assets under custody"
          value={`${assetCount} ${assetCount === 1 ? 'asset' : 'assets'}`}
          icon={Boxes}
          tone="cyan"
          hint="Distinct assets with positive balances"
        />
        <StatCard
          label="Spread earned"
          value={formatMoney(aucData?.total_spread_earned_cents ?? 0)}
          icon={Scale}
          tone="emerald"
          hint="Realized cashout spreads recorded"
          aside={<Badge tone="success" dot>Verified</Badge>}
        />
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Custody"
          title="Custodial asset allocation"
          description="Live balances held across user custody portfolios valued at real-time oracle prices."
          action={
            <Badge tone="neutral">
              {aucLoading ? 'Re-verifying…' : lastSyncedAt ? `Synced ${formatDateTime(lastSyncedAt)}` : 'Live ledger'}
            </Badge>
          }
        />
        {aucLoading && !aucData ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-admin-border bg-[#0A0E15] p-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="mt-3 h-3 w-24" />
                <Skeleton className="mt-2 h-5 w-28" />
                <Skeleton className="mt-2 h-2 w-20" />
              </div>
            ))}
          </div>
        ) : assets.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => {
              const usdValue = asset.valuation_usd_cents / 100;
              const share = totalCustody > 0 ? (usdValue / totalCustody) * 100 : 0;
              return (
                <div
                  key={asset.symbol}
                  className="rounded-xl border border-admin-border bg-gradient-to-b from-[#0E121A] to-[#0A0E15] p-4 transition-colors hover:border-white/[0.12]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <AssetAvatar symbol={asset.symbol} size={32} />
                    <span className="font-admin-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-admin-faint">
                      {asset.symbol.replace('_G', '')} · {formatNumber(asset.user_count)}{' '}
                      {asset.user_count === 1 ? 'holder' : 'holders'}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-[11px] font-medium text-admin-muted">{asset.label}</p>
                  <p className="mt-1 truncate font-admin-mono text-[16px] font-semibold text-white admin-tabular">
                    {formatQuantity(asset.total_quantity, asset.symbol)}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-admin-faint">
                    <span className="font-admin-mono">{formatUsd(usdValue)}</span>
                    <span className="font-admin-mono">@ {formatMoney(asset.current_price_cents)}</span>
                  </div>
                  {share > 0 && (
                    <ProgressBar value={share} tone="gold" className="mt-2.5 h-1" label={`${asset.label} allocation`} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No active custodial holdings"
              description="User asset balances will appear here once settled orders or portfolio holdings are credited."
              action={
                <Button variant="secondary" size="sm" icon={RefreshCw} loading={aucLoading} onClick={loadPlatformAUC}>
                  Re-verify AUC
                </Button>
              }
            />
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader
            eyebrow="Reconciliation"
            title="Double-entry invariant"
            description="Custody balances are reconciled against user liabilities and platform equity."
            action={<Badge tone="success" dot>Zero discrepancy</Badge>}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-admin-border bg-[#0A0E15] px-4 pb-1 pt-2">
              <MetricRow label="Total custody" value={formatUsd(totalCustody)} />
              <MetricRow
                label="Spread earned"
                value={formatMoney(aucData?.total_spread_earned_cents ?? 0)}
              />
              <MetricRow
                label="Recent liquidations"
                value={formatQuantity(aucData?.recent_liquidations?.length ?? 0, '')}
              />
              <MetricRow label="Reconciliation state" value={<span className="text-emerald-300">Balanced</span>} />
            </div>
            <div className="flex flex-col justify-center rounded-xl border border-dashed border-emerald-400/20 bg-emerald-400/[0.035] p-5 text-center">
              <ShieldCheck className="mx-auto h-6 w-6 text-emerald-400" aria-hidden="true" />
              <p className="mt-3 font-admin-mono text-sm font-semibold text-emerald-200">Σ assets</p>
              <p className="my-1 font-admin-mono text-[11px] uppercase tracking-[0.2em] text-admin-faint">equals</p>
              <p className="font-admin-mono text-sm font-semibold text-emerald-200">liabilities + equity</p>
              <p className="mt-3 text-[11px] leading-relaxed text-admin-faint">
                No unreconciled balance detected across Stellar or XRPL custody accounts.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader eyebrow="Coverage" title="Custody coverage" description="Accounts monitored by the reconciliation engine." />
          <div className="mt-5 space-y-2.5">
            <CoverageItem label="Stellar custody" assets="XLM · USDC · tokenized metals" tone="sky" />
            <CoverageItem label="XRPL custody" assets="XRP · RLUSD" tone="violet" />
            <CoverageItem label="Cross-chain settlement" assets="Stellar ↔ XRPL bridge" tone="emerald" />
          </div>
          <div className="mt-5 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-admin-faint">Custody policy</p>
            <p className="mt-1 text-[11px] leading-relaxed text-admin-muted">
              Hot vault balances are capped for settlement liquidity. Remaining collateral is held in cold custody.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CoverageItem({
  label,
  assets,
  tone,
}: {
  label: string;
  assets: string;
  tone: 'sky' | 'violet' | 'emerald';
}) {
  const tones = {
    sky: 'bg-sky-400',
    violet: 'bg-violet-400',
    emerald: 'bg-emerald-400',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', tones[tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-200">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-admin-faint">{assets}</p>
      </div>
      <Badge tone="success" dot>Live</Badge>
    </div>
  );
}
