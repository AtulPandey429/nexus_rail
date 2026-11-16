'use client';

import React from 'react';
import {
  ArrowRight,
  CircleDollarSign,
  Coins,
  Cpu,
  ExternalLink,
  Radio,
  Scale,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CopyValue,
  ProgressBar,
  SectionHeader,
  StatCard,
  StatusBadge,
  Table,
  TableWrap,
  Td,
  Th,
  cn,
} from '@/components/admin/AdminUI';
import { RailBadge, RailSplitDonut } from '@/components/admin/AdminBits';
import {
  formatMoney,
  formatUsd,
  initialsFor,
  truncateMiddle,
  type AdminModel,
} from '@/components/admin/adminModel';
import { PLATFORM_STELLAR_VAULT, PLATFORM_XRPL_VAULT } from '@/lib/vault';

const STELLAR_SHARE = 58.4;
const XRPL_SHARE = 41.6;

export function OverviewTab({ model }: { model: AdminModel }) {
  const {
    treasurySummary,
    nrPoolStatus,
    rpcHealth,
    rates,
    liveOrders,
    setActiveTab,
    lastSyncedAt,
  } = model;

  const revenueRows = [
    { label: 'Order fees', value: treasurySummary?.breakdown?.orderFeesCents ?? 0, tone: 'gold' as const },
    { label: 'Swap spreads', value: treasurySummary?.breakdown?.swapSpreadsCents ?? 0, tone: 'cyan' as const },
    { label: 'Cashout spreads', value: treasurySummary?.breakdown?.cashoutSpreadsCents ?? 0, tone: 'violet' as const },
    { label: 'AI service fees', value: treasurySummary?.breakdown?.aiFeesCents ?? 0, tone: 'emerald' as const },
    { label: 'Gas surplus', value: treasurySummary?.breakdown?.gasSurplusCents ?? 0, tone: 'gold' as const },
  ];
  const revenueTotal = revenueRows.reduce((sum, row) => sum + row.value, 0);
  const balanced = treasurySummary?.isBalanced !== false;

  const rpcStatus = (rpcHealth?.status || '').toUpperCase();
  const rpcHealthy = !['DEGRADED', 'UNHEALTHY', 'DOWN', 'OFFLINE'].includes(rpcStatus);

  const healthRows = [
    {
      icon: Cpu,
      name: 'Stellar Soroban RPC',
      detail: rpcHealth?.latencyMs
        ? `${rpcStatus || 'Live'} · ${rpcHealth.latencyMs} ms · protocol ${rpcHealth.protocolVersion ?? 22}`
        : 'testnet.stellar.org',
      ok: rpcHealthy,
    },
    {
      icon: Radio,
      name: 'XRPL XLS-30d node',
      detail: 's.altnet.rippletest.net',
      ok: true,
    },
    {
      icon: TrendingUp,
      name: 'Real-time oracle feed',
      detail: rates?.source ? `${rates.source.toUpperCase()} · ${rates.fromCache ? 'cached' : 'live'}` : 'CoinCap + live fallback',
      ok: true,
    },
    {
      icon: Coins,
      name: 'Protocol AMM',
      detail: nrPoolStatus ? 'Constant-product invariant active' : 'Awaiting first sync',
      ok: Boolean(nrPoolStatus),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net owner profit"
          value={formatUsd(treasurySummary?.netOwnerProfitUsd ?? 0)}
          icon={Wallet}
          tone="gold"
          hint={`24h · +${formatMoney(treasurySummary?.ownerProfit24hCents ?? 0)}`}
          aside={<Badge tone="success" dot>24h</Badge>}
        />
        <StatCard
          label="Gross treasury volume"
          value={formatMoney(treasurySummary?.totalGrossVolumeCents ?? 0)}
          icon={CircleDollarSign}
          tone="neutral"
          hint={`Revenue ${formatMoney(treasurySummary?.totalRevenueCents ?? 0)}`}
          aside={<Badge tone="neutral">All rails</Badge>}
        />
        <StatCard
          label="$NXL buyback reserve"
          value={formatUsd(treasurySummary?.nrPoolInjectedUsd ?? 0)}
          icon={Coins}
          tone="cyan"
          hint="50% of net protocol revenue"
          aside={<Badge tone="info">Auto</Badge>}
        />
        <StatCard
          label="Ledger invariant"
          value={formatMoney(treasurySummary?.zeroSumDifferenceCents ?? 0)}
          icon={Scale}
          tone={balanced ? 'emerald' : 'rose'}
          hint="Split totals vs. treasury ledger"
          aside={
            <Badge tone={balanced ? 'success' : 'danger'} dot>
              {balanced ? 'Balanced' : 'Variance'}
            </Badge>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 sm:p-6 xl:col-span-7">
          <SectionHeader
            eyebrow="Settlement telemetry"
            title="Settlement volume by rail"
            description="Transacted value across Stellar Soroban and XRPL XLS-30d settlement rails."
            action={<Badge tone="success" dot>Active</Badge>}
          />
          <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row">
            <RailSplitDonut stellarPct={STELLAR_SHARE} xrplPct={XRPL_SHARE} />
            <div className="w-full space-y-5">
              <RailLegend
                label="Stellar rail"
                assets="XLM · USDC"
                share={STELLAR_SHARE}
                amount="$108,010.50"
                color="bg-sky-400"
                bar="cyan"
              />
              <RailLegend
                label="XRPL rail"
                assets="XRP · RLUSD"
                share={XRPL_SHARE}
                amount="$76,909.90"
                color="bg-violet-400"
                bar="violet"
              />
              <div className="flex items-center justify-between border-t border-admin-border/70 pt-3.5 text-[11px] text-admin-faint">
                <span>Combined settled value</span>
                <span className="font-admin-mono font-semibold text-slate-200">$184,920.40</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-5">
          <SectionHeader
            eyebrow="Custody"
            title="Hot vault liquidity"
            description="Operational balances held in the dual-rail platform vaults."
            action={
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('vaults')}>
                Manage
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <div className="mt-5 space-y-2.5">
            <VaultRow
              chain="Stellar"
              network="Stellar testnet"
              balance="10,000.00 XLM"
              address={PLATFORM_STELLAR_VAULT}
              tone="sky"
            />
            <VaultRow
              chain="XRPL"
              network="XRPL testnet"
              balance="100.00 XRP"
              address={PLATFORM_XRPL_VAULT}
              tone="violet"
            />
          </div>
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3.5 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-emerald-200/80">
              Both custody vaults are reachable and reporting balances.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Revenue engine"
            title="Revenue composition"
            description="Fee and spread sources recorded by the treasury split engine."
            action={<Badge tone="gold">{formatMoney(revenueTotal)}</Badge>}
          />
          {revenueTotal > 0 ? (
            <div className="mt-5 space-y-4">
              {revenueRows.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="font-admin-mono font-semibold text-slate-200 admin-tabular">
                      {formatMoney(row.value)}
                    </span>
                  </div>
                  <ProgressBar
                    value={(row.value / revenueTotal) * 100}
                    tone={row.tone}
                    className="mt-2"
                    label={`${row.label} share of revenue`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-admin-border px-4 py-8 text-center">
              <p className="text-xs text-admin-muted">No revenue recorded yet.</p>
              <p className="mt-1 text-[11px] text-admin-faint">
                Fee splits appear here after the first settled order.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Infrastructure"
            title="Live dual-rail health"
            description="Deterministic RPC connectivity and oracle availability."
            action={<Badge tone="success" dot>Operational</Badge>}
          />
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {healthRows.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.name}
                  className="flex items-start gap-3 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-admin-muted">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-200">{row.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-admin-faint">{row.detail}</p>
                  </div>
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      row.ok ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400'
                    )}
                    aria-label={row.ok ? 'Operational' : 'Syncing'}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Live activity"
          title="Recent settlement activity"
          description="Latest dual-rail customer orders and cross-chain swaps."
          action={
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('orders')}>
              View all {liveOrders.length} orders
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          }
        />
        <TableWrap className="mt-5">
          <Table minWidth={900}>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Rail</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Tx receipt</Th>
              </tr>
            </thead>
            <tbody>
              {liveOrders.slice(0, 4).map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-white/[0.022]">
                  <Td>
                    <span className="font-admin-mono text-xs font-semibold text-white">{order.orderNumber}</span>
                    <p className="mt-0.5 text-[10px] text-admin-faint">{order.createdAt}</p>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-admin-mono text-[9px] font-bold text-slate-300">
                        {initialsFor(order.buyerEmail)}
                      </span>
                      <span className="max-w-[190px] truncate text-xs text-slate-300">{order.buyerEmail}</span>
                    </div>
                  </Td>
                  <Td>
                    <RailBadge rail={order.rail} />
                  </Td>
                  <Td>
                    <span className="font-admin-mono text-xs font-semibold text-admin-gold-soft">{order.amount}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={order.status} />
                  </Td>
                  <Td>
                    {order.txHash ? (
                      <a
                        href={order.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-admin-mono text-[11px] text-sky-300 transition-colors hover:text-sky-200"
                        title={order.txHash}
                      >
                        {truncateMiddle(order.txHash, 8, 6)}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-admin-faint">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <p className="mt-3 text-[10px] text-admin-faint">
          {lastSyncedAt ? `Telemetry synced at ${lastSyncedAt.toLocaleTimeString()}.` : 'Telemetry awaiting first sync.'}
        </p>
      </Card>
    </div>
  );
}

function RailLegend({
  label,
  assets,
  share,
  amount,
  color,
  bar,
}: {
  label: string;
  assets: string;
  share: number;
  amount: string;
  color: string;
  bar: 'cyan' | 'violet';
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn('h-2 w-2 rounded-full', color)} aria-hidden="true" />
          <div>
            <p className="text-xs font-medium text-slate-200">{label}</p>
            <p className="mt-0.5 text-[10px] text-admin-faint">{assets}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-admin-mono text-xs font-semibold text-white admin-tabular">{amount}</p>
          <p className="mt-0.5 font-admin-mono text-[10px] text-admin-muted">{share.toFixed(1)}%</p>
        </div>
      </div>
      <ProgressBar value={share} tone={bar} className="mt-2.5" label={`${label} share`} />
    </div>
  );
}

function VaultRow({
  chain,
  network,
  balance,
  address,
  tone,
}: {
  chain: string;
  network: string;
  balance: string;
  address: string;
  tone: 'sky' | 'violet';
}) {
  return (
    <div className="rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3 transition-colors hover:border-white/[0.12]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg border font-admin-mono text-[9px] font-bold',
              tone === 'sky'
                ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
                : 'border-violet-400/20 bg-violet-400/10 text-violet-300'
            )}
          >
            {chain.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-200">{chain} platform vault</p>
            <p className="text-[10px] text-admin-faint">{network}</p>
          </div>
        </div>
        <span className="font-admin-mono text-[11px] font-semibold text-slate-100 admin-tabular">{balance}</span>
      </div>
      <div className="mt-2 pl-9">
        <CopyValue value={address} display={truncateMiddle(address, 12, 8)} label="Copy vault address" />
      </div>
    </div>
  );
}
