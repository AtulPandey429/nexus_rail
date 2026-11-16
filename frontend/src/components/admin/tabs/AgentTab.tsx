'use client';

import React from 'react';
import {
  Activity,
  Bot,
  Clock3,
  Radio,
  Repeat2,
  Scale,
  ShieldCheck,
  Waves,
  Zap,
} from 'lucide-react';
import { Badge, Card, SectionHeader, StatCard, cn } from '@/components/admin/AdminUI';

export function AgentTab() {
  const capabilities = [
    {
      icon: Scale,
      title: 'Dual-rail balance verification',
      description: 'Continuously reconciles Stellar and XRPL balances against the platform ledger and invariant state.',
      tone: 'gold' as const,
    },
    {
      icon: Repeat2,
      title: 'Cross-chain arbitrage',
      description: 'Scans both orderbooks for price dislocation and routes eligible swaps through the optimal rail.',
      tone: 'cyan' as const,
    },
    {
      icon: Waves,
      title: 'Liquidity rebalancing',
      description: 'Tops up hot vaults and the $NXL pool while preserving the constant-product invariant.',
      tone: 'violet' as const,
    },
  ];

  const loop = [
    { step: '01', title: 'Observe', description: 'Poll Soroban and XLS-30d state every 15 seconds.' },
    { step: '02', title: 'Verify', description: 'Compare balances, reserves, and supply parity across rails.' },
    { step: '03', title: 'Rebalance', description: 'Execute optimal settlement actions with invariant guards.' },
  ];

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-admin-gold/[0.08] blur-3xl" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-sky-500/[0.05] blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-admin-gold/25 bg-admin-gold/10 text-admin-gold-soft">
              <Bot className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0F131B] bg-emerald-400" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-white">Autonomous settlement desk</h2>
                <Badge tone="success" dot>Online</Badge>
              </div>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-admin-muted">
                The AI settlement agent scans Stellar Soroban orderbooks and XRPL XLS-30d liquidity pools, verifies
                rail parity, and executes rebalancing actions while maintaining zero invariant leakage.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Badge tone="success" dot>Autonomous mode</Badge>
            <Badge tone="gold">Invariant guard</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scan interval" value="15s" icon={Clock3} tone="gold" hint="Continuous observation cycle" />
        <StatCard label="Rails monitored" value="2" icon={Radio} tone="cyan" hint="Stellar + XRPL" />
        <StatCard label="Invariant guard" value="100%" icon={ShieldCheck} tone="emerald" hint="Zero-leakage settlement" />
        <StatCard label="Execution mode" value="Auto" icon={Zap} tone="violet" hint="Operator override available" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {capabilities.map((capability) => {
          const Icon = capability.icon;
          const tones = {
            gold: 'border-admin-gold/20 bg-admin-gold/10 text-admin-gold-soft',
            cyan: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
            violet: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
          };
          return (
            <Card key={capability.title} className="p-5">
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', tones[capability.tone])}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-[13px] font-semibold text-white">{capability.title}</h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-admin-muted">{capability.description}</p>
              <div className="mt-4 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">Enabled</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader
            eyebrow="Operating loop"
            title="How the agent settles"
            description="Every cycle is deterministic, verifiable, and recorded in the chain audit trail."
            action={<Badge tone="success" dot>Healthy</Badge>}
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {loop.map((item) => (
              <div key={item.step} className="rounded-xl border border-admin-border bg-[#0A0E15] p-4">
                <span className="font-admin-mono text-[10px] font-semibold text-admin-gold/70">{item.step}</span>
                <h4 className="mt-2 text-xs font-semibold text-white">{item.title}</h4>
                <p className="mt-1 text-[10px] leading-relaxed text-admin-muted">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden="true" />
            <p className="text-[10px] leading-relaxed text-admin-muted">
              Settlement actions are idempotent. If a rail is unavailable, the agent pauses execution and keeps the
              remaining balances untouched until connectivity returns.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader eyebrow="Guardrails" title="Safety controls" description="Operator boundaries around automation." />
          <div className="mt-4 space-y-2.5">
            <Guardrail title="Invariant checks" detail="Aborts any action that would break x · y = k." />
            <Guardrail title="Rail isolation" detail="A degraded chain never blocks the healthy rail." />
            <Guardrail title="Audit trail" detail="Every action is appended to the security log." />
            <Guardrail title="Human override" detail="Treasury and credential actions remain operator-only." />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Guardrail({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden="true" />
      <div>
        <p className="text-[11px] font-medium text-slate-200">{title}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-admin-faint">{detail}</p>
      </div>
    </div>
  );
}
