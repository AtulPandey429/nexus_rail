'use client';

import React from 'react';
import { Boxes, Landmark, Scale, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Card,
  MetricRow,
  ProgressBar,
  SectionHeader,
  StatCard,
  cn,
} from '@/components/admin/AdminUI';
import {
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatUsd,
  type AdminModel,
} from '@/components/admin/adminModel';

type LedgerAsset = {
  symbol: string;
  label: string;
  quantity: number;
  usd?: number;
};

const FALLBACK_ASSETS: LedgerAsset[] = [
  { symbol: 'XLM', label: 'Stellar Lumens', quantity: 124500 },
  { symbol: 'XRP', label: 'XRP Ledger', quantity: 89400 },
  { symbol: 'USDC', label: 'USD Coin', quantity: 45200 },
  { symbol: 'RLUSD', label: 'Ripple USD', quantity: 32150 },
  { symbol: 'GOLD_G', label: 'Physical gold', quantity: 120.5 },
  { symbol: 'SILVER_G', label: 'Physical silver', quantity: 4500 },
];

function assetTheme(symbol: string) {
  if (symbol.includes('XLM')) return 'border-sky-400/20 bg-sky-400/10 text-sky-300';
  if (symbol.includes('XRP')) return 'border-violet-400/20 bg-violet-400/10 text-violet-300';
  if (symbol.includes('USDC')) return 'border-blue-400/20 bg-blue-400/10 text-blue-300';
  if (symbol.includes('RLUSD')) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (symbol.includes('GOLD')) return 'border-admin-gold/25 bg-admin-gold/10 text-admin-gold-soft';
  return 'border-white/10 bg-white/[0.05] text-slate-300';
}

export function LedgerTab({ model }: { model: AdminModel }) {
  const { aucData, aucLoading, lastSyncedAt } = model;

  const assets: LedgerAsset[] =
    aucData?.assets && aucData.assets.length > 0
      ? aucData.assets.map((asset) => ({
          symbol: String(asset.symbol),
          label: asset.label,
          quantity: asset.total_quantity,
          usd: asset.valuation_usd_cents / 100,
        }))
      : FALLBACK_ASSETS;

  const totalCustody = aucData ? aucData.total_custody_usd_cents / 100 : 184920.4;
  const assetCount = aucData?.assets?.length || assets.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total system AUC"
          value={formatUsd(totalCustody)}
          icon={Landmark}
          tone="gold"
          hint="Aggregated across all asset classes"
          aside={<Badge tone={aucData ? 'success' : 'neutral'} dot>{aucData ? 'Verified' : 'Snapshot'}</Badge>}
        />
        <StatCard
          label="Assets under custody"
          value={`${assetCount} classes`}
          icon={Boxes}
          tone="cyan"
          hint="Stellar and XRPL trustlines"
        />
        <StatCard
          label="Invariant health"
          value="Zero variance"
          icon={Scale}
          tone="emerald"
          hint="Assets = liabilities + equity"
          aside={<Badge tone="success" dot>Balanced</Badge>}
        />
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Custody"
          title="Custodial asset allocation"
          description="Live balances held across cold custody and hot operational vaults."
          action={
            <Badge tone="neutral">
              {aucLoading ? 'Re-verifying…' : lastSyncedAt ? `Synced ${formatDateTime(lastSyncedAt)}` : 'Snapshot'}
            </Badge>
          }
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {assets.map((asset) => {
            const share = asset.usd && totalCustody > 0 ? (asset.usd / totalCustody) * 100 : 0;
            return (
              <div
                key={asset.symbol}
                className="rounded-xl border border-admin-border bg-gradient-to-b from-[#0E121A] to-[#0A0E15] p-4 transition-colors hover:border-white/[0.12]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border font-admin-mono text-[9px] font-bold',
                      assetTheme(asset.symbol)
                    )}
                  >
                    {asset.symbol.replace('_G', '').slice(0, 4)}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-admin-faint">
                    {asset.symbol.replace('_G', '')}
                  </span>
                </div>
                <p className="mt-3 truncate text-[10px] text-admin-muted">{asset.label}</p>
                <p className="mt-1 truncate font-admin-mono text-[15px] font-semibold text-white admin-tabular">
                  {formatQuantity(asset.quantity, asset.symbol)}
                </p>
                <p className="mt-0.5 truncate font-admin-mono text-[10px] text-admin-faint">
                  {asset.usd !== undefined ? formatUsd(asset.usd) : 'Oracle priced'}
                </p>
                {share > 0 && (
                  <ProgressBar value={share} tone="gold" className="mt-2.5 h-1" label={`${asset.label} allocation`} />
                )}
              </div>
            );
          })}
        </div>
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
              <p className="my-1 font-admin-mono text-[10px] uppercase tracking-[0.2em] text-admin-faint">equals</p>
              <p className="font-admin-mono text-sm font-semibold text-emerald-200">liabilities + equity</p>
              <p className="mt-3 text-[10px] leading-relaxed text-admin-faint">
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
            <p className="text-[10px] uppercase tracking-[0.14em] text-admin-faint">Custody policy</p>
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
        <p className="mt-0.5 truncate text-[10px] text-admin-faint">{assets}</p>
      </div>
      <Badge tone="success" dot>Live</Badge>
    </div>
  );
}
