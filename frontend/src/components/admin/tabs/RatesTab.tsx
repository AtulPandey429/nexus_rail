'use client';

import React from 'react';
import { Clock3, Database, Radio, TrendingUp } from 'lucide-react';
import {
  Badge,
  Card,
  MetricRow,
  SectionHeader,
  StatCard,
} from '@/components/admin/AdminUI';
import { AssetAvatar } from '@/components/admin/AdminBits';
import {
  formatDateTime,
  formatUsd,
  type AdminModel,
} from '@/components/admin/adminModel';

export function RatesTab({ model }: { model: AdminModel }) {
  const { rates, ratesLoading, nrPoolStatus } = model;

  const nxlSpotPrice = nrPoolStatus?.spotPriceUsd ?? nrPoolStatus?.priceUsd;
  const nxlChange = nrPoolStatus?.change24hPercent;

  const cards = [
    {
      pair: 'XLM / USD',
      symbol: 'XLM',
      value: rates?.xlmUsd ? formatUsd(rates.xlmUsd, 4) : ratesLoading ? 'Syncing…' : 'Unavailable',
      change: typeof rates?.xlm24hChange === 'number' ? rates.xlm24hChange : null,
      tone: 'cyan' as const,
      hint: 'Stellar Lumens',
    },
    {
      pair: 'XRP / USD',
      symbol: 'XRP',
      value: rates?.xrpUsd ? formatUsd(rates.xrpUsd, 4) : ratesLoading ? 'Syncing…' : 'Unavailable',
      change: typeof rates?.xrp24hChange === 'number' ? rates.xrp24hChange : null,
      tone: 'violet' as const,
      hint: 'XRP Ledger',
    },
    {
      pair: 'NXL / USD',
      symbol: 'NXL',
      value: typeof nxlSpotPrice === 'number' && nxlSpotPrice > 0 ? formatUsd(nxlSpotPrice, 4) : 'Awaiting sync',
      change: typeof nxlChange === 'number' ? nxlChange : null,
      tone: 'gold' as const,
      hint: 'Protocol AMM token',
    },
    {
      pair: 'GOLD / USD (g)',
      symbol: 'GOLD_G',
      value: typeof rates?.goldUsdPerGram === 'number' && rates.goldUsdPerGram > 0
        ? formatUsd(rates.goldUsdPerGram, 2)
        : ratesLoading
          ? 'Syncing…'
          : 'Unavailable',
      change: typeof rates?.gold24hChange === 'number' ? rates.gold24hChange : null,
      tone: 'emerald' as const,
      hint: 'PAXG spot per gram',
    },
  ];

  const oracles = [
    {
      name: 'NexusRail rate API',
      detail: rates?.source ? `Source: ${rates.source.toUpperCase()}` : 'Awaiting live rate fetch',
      status: rates ? 'Operational' : ratesLoading ? 'Syncing' : 'Unavailable',
      tone: rates ? ('success' as const) : ratesLoading ? ('warning' as const) : ('danger' as const),
    },
    {
      name: 'Stellar DEX',
      detail: rates?.xlmUsd ? `XLM @ ${formatUsd(rates.xlmUsd, 4)}` : 'XLM / USDC orderbook',
      status: rates?.xlmUsd ? 'Operational' : 'Syncing',
      tone: rates?.xlmUsd ? ('success' as const) : ('warning' as const),
    },
    {
      name: 'XRPL DEX',
      detail: rates?.xrpUsd ? `XRP @ ${formatUsd(rates.xrpUsd, 4)}` : 'XRP / RLUSD orderbook',
      status: rates?.xrpUsd ? 'Operational' : 'Syncing',
      tone: rates?.xrpUsd ? ('success' as const) : ('warning' as const),
    },
    {
      name: 'Protocol AMM',
      detail: nxlSpotPrice ? `NXL @ ${formatUsd(nxlSpotPrice, 4)}` : 'NXL constant-product pool',
      status: nrPoolStatus ? 'Active' : 'Awaiting sync',
      tone: nrPoolStatus ? ('success' as const) : ('warning' as const),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.pair}
            label={card.pair}
            value={
              <span className={ratesLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                {card.value}
              </span>
            }
            icon={TrendingUp}
            tone={card.tone}
            hint={
              <span className="inline-flex items-center gap-1.5">
                <AssetAvatar symbol={card.symbol} size={16} />
                <span>{card.hint}</span>
              </span>
            }
            aside={
              card.change !== null ? (
                <Badge tone={card.change >= 0 ? 'success' : 'danger'} dot>
                  {card.change >= 0 ? '+' : ''}
                  {card.change.toFixed(2)}% 24h
                </Badge>
              ) : (
                <Badge tone={rates ? 'info' : 'neutral'} dot>
                  {rates ? 'Live' : 'Syncing'}
                </Badge>
              )
            }
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader
            eyebrow="Oracle mesh"
            title="Chain & FX infrastructure"
            description="Rate sources used by checkout, swaps, and settlement pricing."
            action={
              <Badge tone={ratesLoading ? 'warning' : 'success'} dot>
                {ratesLoading ? 'Syncing' : 'Live feed'}
              </Badge>
            }
          />
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {oracles.map((oracle) => (
              <div
                key={oracle.name}
                className="flex items-start gap-3 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-admin-muted">
                  <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-200">{oracle.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-admin-faint">{oracle.detail}</p>
                </div>
                <Badge tone={oracle.tone} dot>
                  {oracle.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-admin-faint">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-admin-gold/70" aria-hidden="true" />
              Pricing is resolved from the backend aggregator first. Public exchange fallbacks keep checkout
              available if the primary oracle is unreachable.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader eyebrow="Caching" title="Quote cache policy" description="Rate freshness across the console." />
          <div className="mt-4 divide-y divide-white/[0.045]">
            <MetricRow label="Primary source" value={rates?.source ? rates.source.toUpperCase() : '—'} />
            <MetricRow label="Cache state" value={rates ? (rates.fromCache ? 'Cached' : 'Live fetch') : '—'} />
            <MetricRow
              label="TTL remaining"
              value={typeof rates?.ttlMinutesRemaining === 'number' ? `${rates.ttlMinutesRemaining} min` : '—'}
            />
            <MetricRow
              label="Silver / USD (g)"
              value={typeof rates?.silverUsdPerGram === 'number' && rates.silverUsdPerGram > 0 ? formatUsd(rates.silverUsdPerGram, 2) : '—'}
            />
            <MetricRow
              label="USD / INR"
              value={typeof rates?.usdInrRate === 'number' && rates.usdInrRate > 0 ? `₹${rates.usdInrRate.toFixed(2)}` : '—'}
            />
            <MetricRow label="Last fetched" value={formatDateTime(rates?.fetchedAt)} />
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-admin-gold/70" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-admin-muted">
              Quotes are cached for 30 minutes. Use <span className="text-slate-200">Refresh quotes</span> to force a
              live fetch before executing a large settlement.
            </p>
          </div>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-sky-400/70" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-admin-muted">
              Prices are display and settlement references only. On-chain execution always uses the quoted ledger
              rate at transaction time.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
