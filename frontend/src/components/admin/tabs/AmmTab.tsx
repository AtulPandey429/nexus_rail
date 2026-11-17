'use client';

import React from 'react';
import {
  Activity,
  ArrowDownToLine,
  CircleDollarSign,
  Coins,
  ExternalLink,
  RefreshCw,
  Waves,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CopyValue,
  Feedback,
  Field,
  ProgressBar,
  SectionHeader,
  StatCard,
  TableWrap,
  cn,
  inputClassName,
} from '@/components/admin/AdminUI';
import { AssetAvatar, MiniStat } from '@/components/admin/AdminBits';
import {
  formatNumber,
  formatUsd,
  truncateMiddle,
  type AdminModel,
} from '@/components/admin/adminModel';

export function AmmTab({ model }: { model: AdminModel }) {
  const {
    nrPoolStatus,
    reserveDeltaUsd,
    setReserveDeltaUsd,
    reserveNote,
    setReserveNote,
    adjustingReserve,
    reserveFeedback,
    reserveFeedbackTone,
    handleAdjustReserve,
    dualRailSummary,
    dualRailLoading,
    loadDualRailStatus,
    ammDepositXrp,
    setAmmDepositXrp,
    ammDepositNr,
    setAmmDepositNr,
    ammDepositing,
    dualRailFeedback,
    dualRailFeedbackTone,
    handleDepositAmm,
  } = model;

  const price = nrPoolStatus?.spotPriceUsd ?? nrPoolStatus?.priceUsd ?? 0;
  const change = nrPoolStatus?.change24hPercent ?? 0;
  const reserveUsd = nrPoolStatus?.reserveUsd ?? 0;
  const poolSupply = nrPoolStatus?.poolNrSupply ?? 0;
  const circulating = nrPoolStatus?.circulatingNr ?? 0;
  const marketCap = nrPoolStatus?.marketCapUsd ?? circulating * price;
  const feeInjections = nrPoolStatus?.cumulativeFeeInjectedUsd ?? 0;
  const backingRatio = marketCap > 0 ? Math.min(100, (reserveUsd / marketCap) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="$NXL spot price"
          value={nrPoolStatus ? formatUsd(price, 4) : '—'}
          icon={CircleDollarSign}
          tone="gold"
          hint={
            <span className="inline-flex items-center gap-1.5">
              <AssetAvatar symbol="NXL" size={16} />
              <span>{nrPoolStatus ? `24h ${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : 'Awaiting pool sync'}</span>
            </span>
          }
          aside={
            nrPoolStatus ? (
              <Badge tone={change >= 0 ? 'success' : 'danger'} dot>
                {change >= 0 ? 'Up' : 'Down'}
              </Badge>
            ) : (
              <Badge tone="neutral">Syncing</Badge>
            )
          }
        />
        <StatCard
          label="Reserve backing"
          value={formatUsd(reserveUsd)}
          icon={Coins}
          tone="cyan"
          hint="Locked collateral in the bonding curve"
        />
        <StatCard
          label="Pool $NXL supply"
          value={`${formatNumber(poolSupply)} NXL`}
          icon={Waves}
          tone="violet"
          hint={`Circulating ${formatNumber(circulating)} NXL`}
        />
        <StatCard
          label="Cumulative fee injections"
          value={formatUsd(feeInjections)}
          icon={Activity}
          tone="emerald"
          hint="From automated 50% profit split"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader
            eyebrow="Liquidity"
            title="Bonding curve & backing"
            description="Constant-product protocol pool powered by continuous buyback injections."
            action={<Badge tone="success" dot>Invariant active</Badge>}
          />
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Market cap" value={formatUsd(marketCap)} hint="Pool supply × spot price" />
            <MiniStat label="Circulating" value={`${formatNumber(circulating)} NXL`} hint="Externally held supply" />
            <MiniStat
              label="Invariant K"
              value={nrPoolStatus?.invariantK ? truncateMiddle(nrPoolStatus.invariantK, 8, 4) : 'x · y'}
              hint="x · y = k"
              tone="text-admin-gold-soft"
            />
            <MiniStat
              label="24h change"
              value={`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
              hint="Spot price movement"
              tone={change >= 0 ? 'text-emerald-300' : 'text-rose-300'}
            />
          </div>

          <div className="mt-4 rounded-xl border border-admin-border bg-[#0A0E15] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-200">Reserve backing ratio</p>
              <p className="font-admin-mono text-xs font-semibold text-sky-300">
                {backingRatio.toFixed(1)}% <span className="font-sans text-[10px] font-normal text-admin-faint">of market cap</span>
              </p>
            </div>
            <ProgressBar value={backingRatio} tone="cyan" className="mt-2.5" label="Reserve backing ratio" />
            <p className="mt-2.5 text-[10px] leading-relaxed text-admin-faint">
              The platform reserve backs {formatUsd(reserveUsd)} of the {formatUsd(marketCap)} circulating market value.
              Automated buybacks deepen liquidity after every settled fee event.
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-admin-gold/20 bg-admin-gold/[0.035] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-admin-gold/80">Bonding curve</p>
              <p className="mt-1 font-admin-mono text-sm font-semibold text-admin-gold-soft">
                x · y = k
              </p>
            </div>
            <p className="max-w-[52%] text-right text-[10px] leading-relaxed text-admin-faint">
              Reserve and token supply are adjusted together so the pool invariant remains constant.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Operator action"
            title="Reserve top-up"
            description="Inject collateral to deepen liquidity and raise the $NXL floor."
          />
          <div className="mt-5 space-y-4">
            <Field label="Amount (USD)" htmlFor="reserve-amount" hint="Positive values add collateral to the pool.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-admin-mono text-xs text-admin-faint">
                  $
                </span>
                <input
                  id="reserve-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={reserveDeltaUsd}
                  onChange={(event) => setReserveDeltaUsd(event.target.value)}
                  className={cn(inputClassName, 'pl-8 font-admin-mono admin-tabular')}
                  placeholder="500.00"
                />
              </div>
            </Field>
            <Field label="Ledger note" htmlFor="reserve-note" hint="Recorded with the reserve adjustment event.">
              <input
                id="reserve-note"
                type="text"
                value={reserveNote}
                onChange={(event) => setReserveNote(event.target.value)}
                className={inputClassName}
                placeholder="Operator liquidity top-up"
              />
            </Field>
            <Button
              variant="primary"
              className="w-full"
              icon={ArrowDownToLine}
              loading={adjustingReserve}
              onClick={() => handleAdjustReserve(parseFloat(reserveDeltaUsd) || 0)}
            >
              Inject liquidity
            </Button>
            {reserveFeedback && <Feedback tone={reserveFeedbackTone}>{reserveFeedback}</Feedback>}
            <p className="text-[10px] leading-relaxed text-admin-faint">
              Reserve changes are recorded in the treasury ledger and reflected in the pool status endpoint.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="XRPL XLS-30d"
            title="Native AMM pool"
            description="On-ledger automated market maker for the XRPL settlement rail."
            action={
              <Badge
                tone={dualRailSummary?.xrpl?.status === 'ACTIVE' ? 'success' : 'warning'}
                dot
              >
                {dualRailSummary?.xrpl?.status || (dualRailLoading ? 'Syncing' : 'Not synced')}
              </Badge>
            }
          />
          {dualRailSummary?.xrpl ? (
            <>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-admin-border bg-[#0B0F16] px-3.5 py-3">
                  <AssetAvatar symbol="XRP" size={30} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">XRP reserve</p>
                    <p className="mt-1 truncate font-admin-mono text-[13px] font-semibold text-white admin-tabular">
                      {formatNumber(dualRailSummary.xrpl.reserveXrp, 2)}
                    </p>
                    <p className="truncate text-[10px] text-admin-faint">Native XRP</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-admin-border bg-[#0B0F16] px-3.5 py-3">
                  <AssetAvatar symbol="NXL" size={30} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">NXL reserve</p>
                    <p className="mt-1 truncate font-admin-mono text-[13px] font-semibold text-white admin-tabular">
                      {formatNumber(dualRailSummary.xrpl.reserveNr, 2)}
                    </p>
                    <p className="truncate text-[10px] text-admin-faint">Issued NXL</p>
                  </div>
                </div>
                <MiniStat
                  label="Trading fee"
                  value={`${(dualRailSummary.xrpl.tradingFeeBps / 100).toFixed(2)}%`}
                  hint={`${dualRailSummary.xrpl.tradingFeeBps} bps`}
                />
                <MiniStat label="AMM status" value={dualRailSummary.xrpl.status || 'ACTIVE'} hint="XLS-30d" />
              </div>
              <div className="mt-3 rounded-xl border border-admin-border bg-[#0A0E15] px-3.5 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">AMM account</p>
                <div className="mt-1.5">
                  <CopyValue
                    value={dualRailSummary.xrpl.ammAccount}
                    display={truncateMiddle(dualRailSummary.xrpl.ammAccount, 12, 8)}
                    label="Copy AMM account"
                  />
                </div>
              </div>
              {dualRailSummary.xrpl.explorerUrl && (
                <a
                  href={dualRailSummary.xrpl.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:text-sky-200"
                >
                  Inspect AMM on XRPL explorer
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </>
          ) : (
            <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-admin-border px-4 py-9 text-center">
              <Waves className="h-5 w-5 text-admin-faint" aria-hidden="true" />
              <p className="text-xs text-admin-muted">
                {dualRailLoading ? 'Syncing native AMM state…' : 'Native AMM metadata is not available yet.'}
              </p>
              <Button variant="secondary" size="sm" icon={RefreshCw} loading={dualRailLoading} onClick={loadDualRailStatus}>
                Sync AMM state
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Liquidity"
            title="Add native liquidity"
            description="Deposit paired XRP and NXL into the XLS-30d pool."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="XRP amount" htmlFor="amm-xrp">
              <input
                id="amm-xrp"
                type="number"
                min={0}
                step="0.01"
                value={ammDepositXrp}
                onChange={(event) => setAmmDepositXrp(event.target.value)}
                className={cn(inputClassName, 'font-admin-mono admin-tabular')}
              />
            </Field>
            <Field label="NXL amount" htmlFor="amm-nxl">
              <input
                id="amm-nxl"
                type="number"
                min={0}
                step="0.01"
                value={ammDepositNr}
                onChange={(event) => setAmmDepositNr(event.target.value)}
                className={cn(inputClassName, 'font-admin-mono admin-tabular')}
              />
            </Field>
          </div>
          <Button
            variant="primary"
            className="mt-4 w-full"
            icon={ArrowDownToLine}
            loading={ammDepositing}
            onClick={handleDepositAmm}
          >
            Deposit liquidity
          </Button>
          {dualRailFeedback && (
            <div className="mt-3">
              <Feedback tone={dualRailFeedbackTone}>{dualRailFeedback}</Feedback>
            </div>
          )}
          <TableWrap className="mt-4">
            <div className="rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
              <p className="text-[10px] leading-relaxed text-admin-faint">
                Both assets are deposited in proportion to the current pool reserves. The operation is signed by the
                operator hot wallet and recorded in the chain audit trail.
              </p>
            </div>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}
