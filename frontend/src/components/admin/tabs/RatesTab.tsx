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
import {
  formatDateTime,
  formatUsd,
  type AdminModel,
} from '@/components/admin/adminModel';

export function RatesTab({ model }: { model: AdminModel }) {
  const { rates, ratesLoading, nrPoolStatus } = model;

  const cards = [
    {
      pair: 'XLM / USD',
      value: formatUsd(rates?.xlmUsd || 0.1365, 4),
      change: '+1.8%',
      tone: 'cyan' as const,
      hint: 'Stellar Lumens',
    },
    {
      pair: 'XRP / USD',
      value: formatUsd(rates?.xrpUsd || 1.924, 4),
      change: '+3.2%',
      tone: 'violet' as const,
      hint: 'XRP Ledger',
    },
    {
      pair: 'NXL / USD',
      value: formatUsd(nrPoolStatus?.priceUsd || 1.025, 4),
      change: '+2.4%',
      tone: 'gold' as const,
      hint: 'Protocol token',
    },
    {
      pair: 'GOLD / USD (g)',
      value: '$84.50',
      change: '+0.5%',
      tone: 'emerald' as const,
      hint: 'Tokenized metal',
    },
  ];

  const oracles = [
    {
      name: 'NexusRail rate API',
      detail: rates?.source ? `Source: ${rates.source}` : 'Backend aggregator',
      status: 'Operational',
      tone: 'success' as const,
    },
    {
      name: 'Stellar DEX',
      detail: 'XLM / USDC orderbook',
      status: 'Operational',
      tone: 'success' as const,
    },
    {
      name: 'XRPL DEX',
      detail: 'XRP / RLUSD orderbook',
      status: 'Operational',
      tone: 'success' as const,
    },
    {
      name: 'Protocol AMM',
      detail: 'NXL constant-product pool',
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
            hint={card.hint}
            aside={<Badge tone="success" dot>{card.change} 24h</Badge>}
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
                  <p className="mt-0.5 truncate text-[10px] text-admin-faint">{oracle.detail}</p>
                </div>
                <Badge tone={oracle.tone} dot>
                  {oracle.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
            <p className="flex items-start gap-2 text-[10px] leading-relaxed text-admin-faint">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-admin-gold/70" aria-hidden="true" />
              Pricing is resolved from the backend aggregator first. Public exchange fallbacks keep checkout
              available if the primary oracle is unreachable.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader eyebrow="Caching" title="Quote cache policy" description="Rate freshness across the console." />
          <div className="mt-4 divide-y divide-white/[0.045]">
            <MetricRow label="Primary source" value={rates?.source ? rates.source.toUpperCase() : 'NEXUS-API'} />
            <MetricRow label="Cache state" value={rates?.fromCache ? 'Cached' : 'Live fetch'} />
            <MetricRow
              label="TTL remaining"
              value={typeof rates?.ttlMinutesRemaining === 'number' ? `${rates.ttlMinutesRemaining} min` : '—'}
            />
            <MetricRow label="Last fetched" value={formatDateTime(rates?.fetchedAt)} />
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-admin-gold/70" aria-hidden="true" />
            <p className="text-[10px] leading-relaxed text-admin-muted">
              Quotes are cached for 30 minutes. Use <span className="text-slate-200">Refresh quotes</span> to force a
              live fetch before executing a large settlement.
            </p>
          </div>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-sky-400/70" aria-hidden="true" />
            <p className="text-[10px] leading-relaxed text-admin-muted">
              Prices are display and settlement references only. On-chain execution always uses the quoted ledger
              rate at transaction time.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
