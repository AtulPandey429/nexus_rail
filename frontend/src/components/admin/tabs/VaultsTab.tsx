'use client';

import React from 'react';
import {
  ArrowLeftRight,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CopyValue,
  MetricRow,
  ProgressBar,
  SectionHeader,
  Skeleton,
  cn,
} from '@/components/admin/AdminUI';
import { AssetAvatar, MiniStat } from '@/components/admin/AdminBits';
import {
  formatNumber,
  truncateMiddle,
  type AdminModel,
} from '@/components/admin/adminModel';
import { PLATFORM_STELLAR_VAULT, PLATFORM_XRPL_VAULT } from '@/lib/vault';

export function VaultsTab({ model }: { model: AdminModel }) {
  const {
    dualRailSummary,
    dualRailLoading,
    loadDualRailStatus,
    vaultBalances,
    vaultBalancesLoading,
    loadVaultBalances,
    openCredentials,
  } = model;
  const parity = dualRailSummary?.parity;
  const stellar = dualRailSummary?.stellar;
  const xrpl = dualRailSummary?.xrpl;
  const circulating = (parity?.stellarCirculating ?? 0) + (parity?.xrplCirculating ?? 0);
  const supplyCap = parity?.totalSupplyCap ?? 0;
  const utilization = supplyCap > 0 ? Math.min(100, (circulating / supplyCap) * 100) : 0;

  const stellarVault = vaultBalances.find((v) => v.chainId.toLowerCase() === 'stellar');
  const xrplVault = vaultBalances.find((v) => v.chainId.toLowerCase() === 'xrpl');

  const stellarBalanceText = stellarVault
    ? `${formatNumber(stellarVault.vaultBalance, 2)} ${stellarVault.assetSymbol}`
    : vaultBalancesLoading
      ? 'Syncing…'
      : '—';
  const xrplBalanceText = xrplVault
    ? `${formatNumber(xrplVault.vaultBalance, 2)} ${xrplVault.assetSymbol}`
    : vaultBalancesLoading
      ? 'Syncing…'
      : '—';

  const handleSync = () => {
    void loadDualRailStatus();
    void loadVaultBalances();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <VaultCard
          chain="Stellar"
          symbol="XLM"
          network={stellarVault?.network ? `Stellar ${stellarVault.network}` : 'Stellar testnet'}
          description="Soroban settlement vault and NXL distribution account."
          balance={stellarBalanceText}
          reachable={Boolean(stellarVault)}
          loading={vaultBalancesLoading}
          address={PLATFORM_STELLAR_VAULT}
          explorerUrl={`https://stellar.expert/explorer/testnet/account/${PLATFORM_STELLAR_VAULT}`}
          explorerLabel="Stellar Expert"
          tone="sky"
        />
        <VaultCard
          chain="XRPL"
          symbol="XRP"
          network={xrplVault?.network ? `XRPL ${xrplVault.network}` : 'XRPL testnet'}
          description="XLS-30d liquidity vault and issued-asset distributor."
          balance={xrplBalanceText}
          reachable={Boolean(xrplVault)}
          loading={vaultBalancesLoading}
          address={PLATFORM_XRPL_VAULT}
          explorerUrl={`https://testnet.xrpl.org/accounts/${PLATFORM_XRPL_VAULT}`}
          explorerLabel="XRPL explorer"
          tone="violet"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader
            eyebrow="Parity"
            title="Dual-rail supply reconciliation"
            description="Circulating supply is compared across both ledgers after every sync."
            action={
              <div className="flex items-center gap-2">
                <Badge tone={parity?.isBalanced ? 'success' : 'warning'} dot>
                  {parity ? (parity.isBalanced ? 'Balanced' : 'Mismatch') : 'Not synced'}
                </Badge>
                <Button variant="ghost" size="sm" icon={RefreshCw} loading={dualRailLoading || vaultBalancesLoading} onClick={handleSync}>
                  Sync
                </Button>
              </div>
            }
          />

          {dualRailSummary ? (
            <>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                <MiniStat
                  label="Stellar circulating"
                  value={`${formatNumber(parity?.stellarCirculating ?? 0)} NXL`}
                  hint={stellar?.assetCode ? `${stellar.assetCode} trustline` : 'Stellar rail'}
                  tone="text-sky-300"
                />
                <MiniStat
                  label="XRPL circulating"
                  value={`${formatNumber(parity?.xrplCirculating ?? 0)} NXL`}
                  hint={xrpl?.currencyCode ? `${xrpl.currencyCode} issued asset` : 'XRPL rail'}
                  tone="text-violet-300"
                />
                <MiniStat
                  label="Total supply cap"
                  value={`${formatNumber(parity?.totalSupplyCap ?? 0)} NXL`}
                  hint="Protocol maximum"
                />
              </div>

              <div className="mt-4 rounded-xl border border-admin-border bg-[#0A0E15] p-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-admin-muted">Supply utilization</span>
                  <span className="font-admin-mono font-semibold text-slate-200">
                    {utilization.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={utilization} tone="gold" className="mt-2.5" label="Supply utilization" />
                {parity?.invariantString && (
                  <p className="mt-3 break-all rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2 font-admin-mono text-[10px] text-admin-faint">
                    {parity.invariantString}
                  </p>
                )}
              </div>

              <div className="mt-2 divide-y divide-white/[0.045]">
                <MetricRow
                  label="XRPL AMM account"
                  value={
                    <CopyValue
                      value={xrpl?.ammAccount}
                      display={truncateMiddle(xrpl?.ammAccount, 8, 6)}
                      label="Copy AMM account"
                    />
                  }
                />
                <MetricRow
                  label="Stellar contract"
                  value={
                    <CopyValue
                      value={stellar?.contractId}
                      display={truncateMiddle(stellar?.contractId, 8, 6)}
                      label="Copy Stellar contract"
                    />
                  }
                />
                <MetricRow
                  label="AMM reserves"
                  value={`${formatNumber(xrpl?.reserveXrp ?? 0, 2)} XRP · ${formatNumber(xrpl?.reserveNr ?? 0, 2)} NXL`}
                />
              </div>
            </>
          ) : (
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-admin-border bg-[#0A0E15] p-4">
                  <Skeleton className="h-2 w-20" />
                  <Skeleton className="mt-3 h-4 w-28" />
                  <Skeleton className="mt-2 h-2 w-16" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-5 sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-admin-gold/20 bg-admin-gold/10 text-admin-gold-soft">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-white">Vault credentials</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-admin-muted">
            Review issuer addresses, distribution vaults, contract IDs, and signing material for both settlement
            rails. Secrets stay masked until explicitly revealed.
          </p>
          <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3.5 py-3">
            <p className="flex items-start gap-2 text-[10px] leading-relaxed text-amber-200/80">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Restricted operator material. Never share vault credentials outside the operations team.
            </p>
          </div>
          <div className="mt-auto pt-5">
            <Button variant="primary" className="w-full" icon={KeyRound} onClick={openCredentials}>
              Open credential vault
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Reconciliation"
          title="Rail parity"
          description="Treasury routing and chain-level custody configuration."
          action={<Badge tone="info">Testnet only</Badge>}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ParityTile
            label="Stellar issuer"
            value={truncateMiddle(stellar?.issuerAddress, 10, 6)}
            hint={stellar?.assetCode || 'NXL'}
          />
          <ParityTile
            label="XRPL issuer"
            value={truncateMiddle(xrpl?.issuerAddress, 10, 6)}
            hint={xrpl?.currencyCode || 'NXL'}
          />
          <ParityTile
            label="Stellar distribution"
            value={truncateMiddle(stellar?.distributionVault, 10, 6)}
            hint="Hot vault"
          />
          <ParityTile
            label="XRPL distribution"
            value={truncateMiddle(xrpl?.distributionVault, 10, 6)}
            hint="Hot vault"
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-admin-muted">
            <ArrowLeftRight className="mr-1.5 inline h-3.5 w-3.5 text-admin-gold" aria-hidden="true" />
            Both rails share a single NXL supply cap. Transfers between ledgers are reconciled after each settlement.
          </p>
          {dualRailSummary?.stellar?.explorerUrl && (
            <a
              href={dualRailSummary.stellar.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:text-sky-200"
            >
              Verify on-chain
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </Card>
    </div>
  );
}

function VaultCard({
  chain,
  symbol,
  network,
  description,
  balance,
  reachable,
  loading,
  address,
  explorerUrl,
  explorerLabel,
  tone,
}: {
  chain: string;
  symbol: string;
  network: string;
  description: string;
  balance: string;
  reachable: boolean;
  loading: boolean;
  address: string;
  explorerUrl: string;
  explorerLabel: string;
  tone: 'sky' | 'violet';
}) {
  const toneClasses =
    tone === 'sky'
      ? {
          line: 'via-sky-400/60',
          glow: 'bg-sky-500/[0.06]',
        }
      : {
          line: 'via-violet-400/60',
          glow: 'bg-violet-500/[0.06]',
        };

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <span
        className={cn(
          'pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
          toneClasses.line
        )}
        aria-hidden="true"
      />
      <span className={cn('pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl', toneClasses.glow)} aria-hidden="true" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <AssetAvatar symbol={symbol} size={40} />
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-white">{chain} platform vault</h3>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-admin-faint">{network}</p>
            </div>
          </div>
          <Badge tone="info" dot>Testnet</Badge>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-admin-muted">{description}</p>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-admin-faint">Vault balance</p>
            <p className="mt-1 font-admin-mono text-[24px] font-semibold tracking-tight text-white admin-tabular">
              {balance}
            </p>
          </div>
          <Badge tone={reachable ? 'success' : loading ? 'warning' : 'neutral'} dot>
            {reachable ? 'Operational' : loading ? 'Syncing' : 'Unavailable'}
          </Badge>
        </div>

        <div className="mt-4 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">
            {tone === 'sky' ? 'Public account key' : 'Classic address'}
          </p>
          <div className="mt-1.5">
            <CopyValue value={address} display={truncateMiddle(address, 16, 10)} label={`Copy ${chain} vault address`} />
          </div>
        </div>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-admin-border bg-admin-raised text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/15 hover:bg-admin-hover hover:text-white"
        >
          Inspect on {explorerLabel}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}

function ParityTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">{label}</p>
      <p className="mt-1.5 font-admin-mono text-[11px] text-slate-200">{value}</p>
      <p className="mt-0.5 text-[10px] text-admin-faint">{hint}</p>
    </div>
  );
}
