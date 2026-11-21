'use client';

import React from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Coins,
  Gauge,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Feedback,
  MetricRow,
  ProgressBar,
  SectionHeader,
  Skeleton,
  StatCard,
  StatusBadge,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/admin/AdminUI';
import { AssetAvatar, FilterChip, ProductThumb, RailBadge } from '@/components/admin/AdminBits';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatQuantity,
  initialsFor,
  type AdminModel,
} from '@/components/admin/adminModel';
import type {
  AdminAnalyticsBucket,
  AdminAnalyticsBreakdownRow,
  AdminAnalyticsGranularity,
  AdminAnalyticsRangeKey,
  AdminAnalyticsRecentOrder,
  AdminAnalyticsRevenueRow,
  AdminAnalyticsTopProduct,
  PlatformAUCResponse,
} from '@/types';

const RANGES: Array<{ id: AdminAnalyticsRangeKey; label: string }> = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '1y', label: '12 months' },
  { id: 'all', label: 'All time' },
];

const GRANULARITIES: Array<{ id: AdminAnalyticsGranularity | 'auto'; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

function compactMoney(cents: number) {
  const value = (Number(cents) || 0) / 100;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function AnalyticsTab({ model }: { model: AdminModel }) {
  const {
    analytics,
    analyticsLoading,
    analyticsError,
    analyticsRange,
    setAnalyticsRange,
    analyticsGranularity,
    setAnalyticsGranularity,
    loadAnalytics,
  } = model;

  if (analyticsLoading && !analytics) {
    return <AnalyticsSkeleton />;
  }

  if (!analytics) {
    return (
      <Card className="p-6">
        <EmptyState
          title={analyticsError ? 'Analytics could not be loaded' : 'No analytics available'}
          description={analyticsError || 'Open this view again to request the latest aggregates.'}
          icon={BarChart3}
          action={
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={analyticsLoading} onClick={() => loadAnalytics()}>
              Retry analytics
            </Button>
          }
        />
      </Card>
    );
  }

  const { overview, lifetime, series, statusBreakdown, railBreakdown, revenueBreakdown, topProducts, custodyAssets, recentOrders, dataQuality } = analytics;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-admin-faint">Reporting period</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {RANGES.map((range) => (
                <FilterChip
                  key={range.id}
                  active={analyticsRange === range.id}
                  onClick={() => setAnalyticsRange(range.id)}
                >
                  {range.label}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-admin-faint">Group by</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {GRANULARITIES.map((item) => (
                <FilterChip
                  key={item.id}
                  active={analyticsGranularity === item.id}
                  onClick={() => setAnalyticsGranularity(item.id)}
                >
                  {item.label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-admin-border/70 pt-3 text-[11px] text-admin-faint">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-admin-gold" aria-hidden="true" />
            {analytics.range.label}
          </span>
          <span>Generated {formatDateTime(analytics.generatedAt)}</span>
          <span>
            Lifetime revenue {formatMoney(lifetime.revenueCents)} · lifetime owner profit {formatMoney(lifetime.ownerProfitCents)}
          </span>
          {analyticsLoading && (
            <span className="inline-flex items-center gap-1.5 text-admin-gold-soft">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" /> Refreshing
            </span>
          )}
        </div>
      </Card>

      {analyticsError && <Feedback tone="error">{analyticsError}</Feedback>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Settled transaction volume"
          value={formatMoney(overview.orderVolumeCents)}
          icon={CircleDollarSign}
          tone="cyan"
          hint={`${formatNumber(overview.settledOrders)} settled orders · avg ${formatMoney(overview.averageOrderValueCents)}`}
          aside={<Badge tone="info">Not revenue</Badge>}
        />
        <StatCard
          label="Platform revenue"
          value={formatMoney(overview.revenueCents)}
          icon={TrendingUp}
          tone="gold"
          hint={`Fees ${formatMoney(overview.feeCents)} · spreads ${formatMoney(overview.spreadCents)}`}
          aside={<Badge tone="gold">Recorded</Badge>}
        />
        <StatCard
          label="Net owner profit"
          value={formatMoney(overview.ownerProfitCents)}
          icon={Wallet}
          tone="emerald"
          hint={`50% owner share · buyback ${formatMoney(overview.nrPoolInjectedCents)}`}
          aside={<Badge tone="success">After split</Badge>}
        />
        <StatCard
          label="$NXL AMM reserve"
          value={formatMoney(overview.nrPoolReserveUsdCents)}
          icon={Coins}
          tone="violet"
          hint={`Cumulative buyback injected ${formatMoney(overview.nrPoolInjectedCents)}`}
          aside={<Badge tone="violet">Liquidity</Badge>}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={formatNumber(overview.totalUsers)}
          icon={Users}
          tone="neutral"
          hint={`${formatNumber(overview.newUsers)} registered in this period`}
          aside={<GrowthBadge value={overview.userGrowthPct} />}
        />
        <StatCard
          label="Active users"
          value={formatNumber(overview.activeUsers)}
          icon={Activity}
          tone="cyan"
          hint="Placed at least one order in this period"
        />
        <StatCard
          label="Settlement success rate"
          value={`${overview.successRatePct.toFixed(1)}%`}
          icon={Gauge}
          tone={overview.successRatePct >= 90 ? 'emerald' : 'rose'}
          hint={`${formatNumber(overview.settledOrders)} settled · ${formatNumber(overview.failedOrders)} failed`}
        />
        <StatCard
          label="Assets under custody"
          value={formatMoney(overview.custodyUsdCents)}
          icon={ShieldCheck}
          tone="violet"
          hint={`${custodyAssets.length} assets valued at live oracle prices`}
          aside={<Badge tone="neutral">Not cash</Badge>}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 sm:p-6 xl:col-span-8">
          <SectionHeader
            eyebrow="Trend"
            title="Volume, revenue, and owner profit"
            description="Settled order value is shown separately from platform revenue and the owner's share of that revenue."
            action={<Badge tone="neutral">{analytics.range.granularity}</Badge>}
          />
          <TrendChart points={series} />
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-4">
          <SectionHeader
            eyebrow="Growth"
            title="New registrations"
            description="Accounts created in the selected reporting period."
            action={<Badge tone="info">{formatNumber(overview.newUsers)}</Badge>}
          />
          <UsersBarChart points={series} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <BreakdownCard
          title="Order status mix"
          description="Every order created in the selected period, grouped by current status."
          rows={statusBreakdown}
          emptyLabel="No orders were created in this period."
          renderLabel={(row) => <StatusBadge status={row.label} />}
        />
        <BreakdownCard
          title="Settlement rails"
          description="Settled order value by payment rail."
          rows={railBreakdown}
          emptyLabel="No rail activity was recorded in this period."
          renderLabel={(row) => <RailBadge rail={row.label} />}
        />
        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Revenue engine"
            title="Revenue composition"
            description="Fee, spread, and gas-surplus revenue recorded by the treasury ledger."
            action={<Badge tone="gold">{formatMoney(overview.revenueCents)}</Badge>}
          />
          <div className="mt-5">
            <RevenueComposition rows={revenueBreakdown} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 sm:p-6 xl:col-span-5">
          <SectionHeader
            eyebrow="Cash movement"
            title="Wallet and withdrawal activity"
            description="Internal wallet ledger movements and on-chain $NXL withdrawals for this period."
          />
          <div className="mt-3 divide-y divide-white/[0.045]">
            <MetricRow label="Wallet credits" hint="Cashout proceeds, cashback, and other credits" value={formatMoney(overview.walletCreditsCents)} />
            <MetricRow label="Wallet debits" hint="Purchases and other debits" value={formatMoney(overview.walletDebitsCents)} />
            <MetricRow
              label="On-chain $NXL withdrawals"
              hint={`${formatNumber(overview.tokenWithdrawalsCount)} withdrawal requests`}
              value={`${formatNumber(overview.tokenWithdrawalUnits, 2)} NXL`}
            />
            <MetricRow label="Gross treasury volume" hint="Gross value before fees and spreads" value={formatMoney(overview.grossTreasuryVolumeCents)} />
            <MetricRow
              label="Ledger invariant"
              hint="Owner profit + buyback − revenue"
              value={
                <span className={overview.isBalanced ? 'text-emerald-300' : 'text-rose-300'}>
                  {formatMoney(overview.zeroSumDifferenceCents)}
                </span>
              }
            />
          </div>
          <div className="mt-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.04] px-3.5 py-2.5">
            <p className="text-[11px] leading-relaxed text-sky-200/80">
              No external fiat deposit ledger exists yet, so wallet credits are not presented as deposits. See the data notes below.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-7">
          <SectionHeader
            eyebrow="Catalog"
            title="Top products by settled revenue"
            description="Line-item value from settled orders in the selected period."
            action={<Badge tone="neutral">{topProducts.length} SKUs</Badge>}
          />
          <TopProductsTable rows={topProducts} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 sm:p-6 xl:col-span-7">
          <SectionHeader
            eyebrow="Custody"
            title="Asset-wise custody distribution"
            description="Positive user holdings valued with live oracle prices."
            action={<Badge tone="violet">{formatMoney(overview.custodyUsdCents)}</Badge>}
          />
          <CustodyTable assets={custodyAssets} totalCents={overview.custodyUsdCents} />
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-5">
          <SectionHeader
            eyebrow="Financial definitions"
            title="How these numbers are calculated"
            description="The console never treats transaction volume or deposits as profit."
          />
          <div className="mt-4 space-y-2.5">
            {[
              ['Settled transaction volume', 'Order total_cents for PAID, FULFILLING, and FULFILLED orders.'],
              ['Platform revenue', 'total_revenue_cents from platform_treasury (fees + spreads + gas surplus).'],
              ['Net owner profit', 'net_owner_profit_cents, the owner share written by the 50/50 split engine.'],
              ['$NXL AMM reserve', 'Live constant-product pool reserve; it is liquidity, not profit.'],
              ['Assets under custody', 'User holdings at oracle price; it is customer custody, not platform cash.'],
            ].map(([label, description]) => (
              <div key={label} className="rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-2.5">
                <p className="text-[11px] font-semibold text-slate-200">{label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-admin-faint">{description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Activity"
          title="Recent orders in this period"
          description="Latest orders with buyer accounts resolved from the users collection."
          action={<Badge tone="neutral">{recentOrders.length} shown</Badge>}
        />
        <RecentOrdersTable rows={recentOrders} />
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Data quality"
          title="Metric definitions and unavailable data"
          description="What is measured today, and what the backend must add before more financial metrics can be shown."
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted">Accounting notes</p>
            <ul className="mt-2 space-y-2">
              {dataQuality.notes.map((note) => (
                <li key={note} className="flex gap-2 text-[11px] leading-relaxed text-admin-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-admin-gold/70" aria-hidden="true" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted">Not yet available</p>
            <div className="mt-2 space-y-2">
              {dataQuality.unavailableMetrics.map((item) => (
                <details key={item.metric} className="rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-2.5">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-200">{item.metric}</summary>
                  <p className="mt-2 text-[11px] leading-relaxed text-admin-muted">{item.reason}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-admin-faint">
                    <span className="font-semibold text-slate-300">Required backend change:</span> {item.requiredChange}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <Badge tone="neutral">No baseline</Badge>;
  const positive = value >= 0;
  return (
    <Badge tone={positive ? 'success' : 'danger'}>
      {positive ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
      {Math.abs(value).toFixed(1)}%
    </Badge>
  );
}

function TrendChart({ points }: { points: AdminAnalyticsBucket[] }) {
  const series = [
    { key: 'orderVolumeCents' as const, label: 'Settled volume', color: '#38bdf8', fill: 'rgba(56,189,248,0.10)' },
    { key: 'revenueCents' as const, label: 'Platform revenue', color: '#e9b949', fill: 'rgba(233,185,73,0.12)' },
    { key: 'ownerProfitCents' as const, label: 'Owner profit', color: '#34d399', fill: 'rgba(52,211,153,0.10)' },
  ];
  const hasData = points.some((point) => point.orderVolumeCents || point.revenueCents || point.ownerProfitCents);

  if (!points.length || !hasData) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-admin-border px-4 py-10 text-center">
        <p className="text-xs text-admin-muted">No financial activity in this period.</p>
        <p className="mt-1 text-[11px] text-admin-faint">Try a wider date range.</p>
      </div>
    );
  }

  const width = 760;
  const height = 250;
  const padding = { top: 16, right: 12, bottom: 26, left: 48 };
  const max = Math.max(
    1,
    ...points.flatMap((point) => [point.orderVolumeCents, point.revenueCents, point.ownerProfitCents])
  );
  const xFor = (index: number) =>
    padding.left +
    (index * (width - padding.left - padding.right)) / Math.max(1, points.length - 1);
  const yFor = (value: number) =>
    padding.top + (height - padding.top - padding.bottom) * (1 - Math.max(0, value) / max);

  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] text-admin-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full"
          role="img"
          aria-label="Settled volume, platform revenue, and owner profit over the selected period"
        >
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = yFor(max * ratio);
            return (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
                <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.7)">
                  {compactMoney(max * ratio)}
                </text>
              </g>
            );
          })}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom}
            y2={height - padding.bottom}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="1"
          />
          {series.map((item) => {
            const line = points
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(2)} ${yFor(point[item.key]).toFixed(2)}`)
              .join(' ');
            const area = `${line} L ${xFor(points.length - 1).toFixed(2)} ${height - padding.bottom} L ${xFor(0).toFixed(2)} ${height - padding.bottom} Z`;
            return (
              <g key={item.key}>
                <path d={area} fill={item.fill} />
                <path d={line} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((point, index) => (
                  <circle
                    key={`${item.key}-${point.bucket}-${index}`}
                    cx={xFor(index)}
                    cy={yFor(point[item.key])}
                    r={2.2}
                    fill={item.color}
                  >
                    <title>{`${point.label} · ${item.label}: ${formatMoney(point[item.key])}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
          {labelIndexes.map((index) => (
            <text
              key={`label-${index}`}
              x={xFor(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              fontSize="9"
              fill="rgba(148,163,184,0.8)"
            >
              {points[index]?.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function UsersBarChart({ points }: { points: AdminAnalyticsBucket[] }) {
  const max = Math.max(1, ...points.map((point) => point.newUsers));
  if (!points.length) {
    return <p className="mt-6 text-xs text-admin-faint">No registration data in this period.</p>;
  }

  return (
    <div className="mt-5">
      <div
        className="flex h-36 items-end gap-1"
        role="img"
        aria-label={`New user registrations by ${points.length} reporting periods`}
      >
        {points.map((point) => (
          <div
            key={point.bucket}
            className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${point.label}: ${formatNumber(point.newUsers)} new users`}
          >
            <div
              className="w-full rounded-t bg-gradient-to-t from-sky-500/35 to-sky-300 transition-opacity group-hover:opacity-80"
              style={{ height: `${Math.max(point.newUsers > 0 ? 3 : 1, (point.newUsers / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-admin-faint">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  description,
  rows,
  emptyLabel,
  renderLabel,
}: {
  title: string;
  description: string;
  rows: AdminAnalyticsBreakdownRow[];
  emptyLabel: string;
  renderLabel: (row: AdminAnalyticsBreakdownRow) => React.ReactNode;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader eyebrow="Breakdown" title={title} description={description} />
      <div className="mt-5 space-y-4">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.key}>
              <div className="flex items-center justify-between gap-3">
                {renderLabel(row)}
                <span className="font-admin-mono text-[11px] font-semibold text-slate-300 admin-tabular">
                  {formatNumber(row.count)} · {formatMoney(row.volumeCents)}
                </span>
              </div>
              <ProgressBar
                value={total > 0 ? (row.count / total) * 100 : 0}
                tone={row.key.includes('XRPL') ? 'violet' : row.key.includes('STELLAR') ? 'cyan' : 'gold'}
                className="mt-2"
                label={`${row.label} share`}
              />
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-admin-border px-4 py-8 text-center text-xs text-admin-muted">
            {emptyLabel}
          </p>
        )}
      </div>
    </Card>
  );
}

function RevenueComposition({ rows }: { rows: AdminAnalyticsRevenueRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.revenueCents, 0);
  if (!rows.length || total <= 0) {
    return (
      <p className="rounded-xl border border-dashed border-admin-border px-4 py-8 text-center text-xs text-admin-muted">
        No platform revenue was recorded in this period.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-300">{row.label}</span>
            <span className="font-admin-mono font-semibold text-slate-200 admin-tabular">
              {formatMoney(row.revenueCents)}
            </span>
          </div>
          <ProgressBar
            value={(row.revenueCents / total) * 100}
            tone={row.key === 'ORDER' ? 'gold' : row.key === 'SWAP' ? 'cyan' : row.key === 'SELL_SPREAD' ? 'violet' : 'emerald'}
            className="mt-2"
            label={`${row.label} share of revenue`}
          />
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-admin-border/70 pt-3 text-[11px] text-admin-faint">
        <span>Gross value behind this revenue</span>
        <span className="font-admin-mono text-slate-300">
          {formatMoney(rows.reduce((sum, row) => sum + row.grossCents, 0))}
        </span>
      </div>
    </div>
  );
}

function TopProductsTable({ rows }: { rows: AdminAnalyticsTopProduct[] }) {
  if (!rows.length) {
    return <p className="mt-5 text-xs text-admin-faint">No settled line items in this period.</p>;
  }
  return (
    <TableWrap className="mt-4">
      <Table minWidth={560}>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th align="right">Units</Th>
            <Th align="right">Settled value</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sku} className="transition-colors hover:bg-white/[0.022]">
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] font-admin-mono text-[10px] font-bold text-admin-muted">
                    {index + 1}
                  </span>
                  <ProductThumb sku={row.sku} title={row.title} size={30} />
                  <div className="min-w-0">
                    <p className="max-w-[220px] truncate text-xs font-medium text-slate-200">{row.title}</p>
                    <p className="font-admin-mono text-[11px] text-admin-faint">{row.sku}</p>
                  </div>
                </div>
              </Td>
              <Td align="right">
                <span className="font-admin-mono text-xs text-slate-300 admin-tabular">{formatNumber(row.quantity)}</span>
              </Td>
              <Td align="right">
                <span className="font-admin-mono text-xs font-semibold text-admin-gold-soft admin-tabular">
                  {formatMoney(row.revenueCents)}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function CustodyTable({ assets, totalCents }: { assets: PlatformAUCResponse['assets']; totalCents: number }) {
  if (!assets.length) {
    return <p className="mt-5 text-xs text-admin-faint">No positive user holdings are recorded.</p>;
  }
  return (
    <TableWrap className="mt-4">
      <Table minWidth={640}>
        <thead>
          <tr>
            <Th>Asset</Th>
            <Th align="right">Quantity</Th>
            <Th align="right">Oracle price</Th>
            <Th align="right">Custody value</Th>
            <Th align="right">Holders</Th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.symbol} className="transition-colors hover:bg-white/[0.022]">
              <Td>
                <div className="flex items-center gap-2.5">
                  <AssetAvatar symbol={asset.symbol} size={28} />
                  <div>
                    <p className="text-xs font-medium text-slate-200">{asset.label}</p>
                    <p className="font-admin-mono text-[11px] text-admin-faint">{asset.symbol}</p>
                  </div>
                </div>
              </Td>
              <Td align="right">
                <span className="font-admin-mono text-xs text-slate-300 admin-tabular">
                  {formatQuantity(asset.total_quantity, asset.symbol)}
                </span>
              </Td>
              <Td align="right">
                <span className="font-admin-mono text-xs text-slate-300 admin-tabular">
                  {formatMoney(asset.current_price_cents)}
                </span>
              </Td>
              <Td align="right">
                <div className="flex flex-col items-end gap-1">
                  <span className="font-admin-mono text-xs font-semibold text-admin-gold-soft admin-tabular">
                    {formatMoney(asset.valuation_usd_cents)}
                  </span>
                  <ProgressBar
                    value={totalCents > 0 ? (asset.valuation_usd_cents / totalCents) * 100 : 0}
                    tone="violet"
                    className="w-20"
                    label={`${asset.label} share of custody`}
                  />
                </div>
              </Td>
              <Td align="right">
                <span className="font-admin-mono text-xs text-slate-300 admin-tabular">{formatNumber(asset.user_count)}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function RecentOrdersTable({ rows }: { rows: AdminAnalyticsRecentOrder[] }) {
  if (!rows.length) {
    return <p className="mt-5 text-xs text-admin-faint">No orders were created in this period.</p>;
  }
  return (
    <TableWrap className="mt-4">
      <Table minWidth={860}>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Buyer</Th>
            <Th>Rail</Th>
            <Th align="right">Value</Th>
            <Th>Status</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.orderNumber} className="transition-colors hover:bg-white/[0.022]">
              <Td>
                <span className="font-admin-mono text-xs font-semibold text-white">{row.orderNumber || '—'}</span>
              </Td>
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-admin-mono text-[10px] font-bold text-slate-300">
                    {initialsFor(row.buyerName || row.buyerEmail)}
                  </span>
                  <div className="min-w-0">
                    <p className="max-w-[190px] truncate text-xs text-slate-300">{row.buyerEmail || '—'}</p>
                    {row.buyerName && <p className="truncate text-[11px] text-admin-faint">{row.buyerName}</p>}
                  </div>
                </div>
              </Td>
              <Td>
                <RailBadge rail={row.rail} />
              </Td>
              <Td align="right">
                <span className="font-admin-mono text-xs font-semibold text-admin-gold-soft admin-tabular">
                  {formatMoney(row.totalCents)}
                </span>
              </Td>
              <Td>
                <StatusBadge status={row.status} />
              </Td>
              <Td>
                <span className="whitespace-nowrap text-[11px] text-admin-muted">{formatDateTime(row.createdAt)}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Skeleton className="h-9 w-72" />
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-32" />
            <Skeleton className="mt-3 h-3 w-40" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="mt-5 h-56 w-full" />
        </Card>
        <Card className="p-5 xl:col-span-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-36 w-full" />
        </Card>
      </div>
    </div>
  );
}
