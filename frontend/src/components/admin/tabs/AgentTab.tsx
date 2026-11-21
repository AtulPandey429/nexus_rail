'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
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

interface AgentTelemetry {
  activeModel: string;
  registeredTools: string[];
  metrics: {
    totalConversations: number;
    avgLatencyMs: number;
    totalProposals: number;
    confirmedProposals: number;
    approvalRatePercent: number;
  };
  proposals: Array<{
    id: string;
    action: string;
    status: string;
    title: string;
    priceCents: number;
    createdAt: string;
  }>;
  traces: Array<{
    id: string;
    prompt: string;
    toolsInvoked: string[];
    modelUsed: string;
    latencyMs: number;
    createdAt: string;
  }>;
}

export function AgentTab() {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [telemetry, setTelemetry] = useState<AgentTelemetry | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token) return;
    fetch('/api/v1/admin/agent-telemetry', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && json?.data) {
          setTelemetry(json.data as AgentTelemetry);
        }
      })
      .catch(() => {});
  }, []);
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
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-admin-gold/25 bg-admin-gold/10 text-admin-gold-soft">
              {!avatarFailed ? (
                <Image
                  src="/images/nexus-ai-bot-avatar-128.png"
                  alt="NexusRail AI Agent"
                  width={48}
                  height={48}
                  onError={() => setAvatarFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Bot className="h-5 w-5" aria-hidden="true" />
              )}
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
        <StatCard
          label="AI conversations"
          value={telemetry ? String(telemetry.metrics.totalConversations) : '—'}
          icon={Activity}
          tone="gold"
          hint={telemetry ? `Model: ${telemetry.activeModel}` : 'Live MongoDB traces'}
        />
        <StatCard
          label="Avg latency"
          value={telemetry ? `${telemetry.metrics.avgLatencyMs}ms` : '—'}
          icon={Clock3}
          tone="cyan"
          hint="Groq tool-calling speed"
        />
        <StatCard
          label="Proposal approval"
          value={telemetry ? `${telemetry.metrics.approvalRatePercent}%` : '—'}
          icon={ShieldCheck}
          tone="emerald"
          hint={telemetry ? `${telemetry.metrics.confirmedProposals} of ${telemetry.metrics.totalProposals} approved` : 'Human-in-the-loop locks'}
        />
        <StatCard
          label="Registered tools"
          value={telemetry ? String(telemetry.registeredTools.length) : '6'}
          icon={Zap}
          tone="violet"
          hint="Swaps, baskets, coupons & P&L"
        />
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
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">Enabled</span>
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
                <span className="font-admin-mono text-[11px] font-semibold text-admin-gold/70">{item.step}</span>
                <h4 className="mt-2 text-xs font-semibold text-white">{item.title}</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-admin-muted">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-admin-muted">
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

      {/* Live AI Proposals & Tool Calls Telemetry (MongoDB) */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Proposal locks"
            title="Recent AI proposals"
            description="Single-use 5-minute financial approvals from MongoDB."
            action={<Badge tone="gold">{telemetry?.proposals.length ?? 0} recent</Badge>}
          />
          <div className="mt-4 space-y-2">
            {telemetry && telemetry.proposals.length > 0 ? (
              telemetry.proposals.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{p.title}</p>
                    <p className="font-admin-mono text-[11px] text-admin-faint">
                      {p.action} · ${(p.priceCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      p.status === 'CONFIRMED'
                        ? 'success'
                        : p.status === 'REJECTED'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-xs text-admin-muted">No AI proposals recorded yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Audit traces"
            title="Recent tool executions"
            description="Live prompts and Groq tool calls logged to MongoDB."
            action={<Badge tone="info">{telemetry?.activeModel || 'llama-3.3-70b-versatile'}</Badge>}
          />
          <div className="mt-4 space-y-2">
            {telemetry && telemetry.traces.length > 0 ? (
              telemetry.traces.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-slate-200">{t.prompt}</p>
                    <span className="shrink-0 font-admin-mono text-[11px] text-admin-faint">{t.latencyMs}ms</span>
                  </div>
                  <p className="font-admin-mono text-[11px] text-admin-muted">
                    Tools: {t.toolsInvoked.length > 0 ? t.toolsInvoked.join(', ') : 'direct chat'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-admin-muted">No AI conversations logged yet.</p>
            )}
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
        <p className="mt-0.5 text-[11px] leading-relaxed text-admin-faint">{detail}</p>
      </div>
    </div>
  );
}
