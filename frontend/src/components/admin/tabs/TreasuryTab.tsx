'use client';

import React from 'react';
import {
  CircleDollarSign,
  Coins,
  ExternalLink,
  Landmark,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CopyValue,
  EmptyState,
  Feedback,
  Field,
  SearchInput,
  SectionHeader,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
  cn,
  inputClassName,
} from '@/components/admin/AdminUI';
import { MiniStat, PaginationBar, RailBadge } from '@/components/admin/AdminBits';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatUsd,
  truncateMiddle,
  type AdminModel,
} from '@/components/admin/adminModel';

export function TreasuryTab({ model }: { model: AdminModel }) {
  const {
    treasurySummary,
    treasuryConfig,
    treasuryEntries,
    treasuryLoading,
    loadTreasuryData,
    orderFeeBpsInput,
    setOrderFeeBpsInput,
    swapSpreadBpsInput,
    setSwapSpreadBpsInput,
    cashoutSpreadBpsInput,
    setCashoutSpreadBpsInput,
    buybackSharePctInput,
    setBuybackSharePctInput,
    isPausedInput,
    setIsPausedInput,
    savingConfig,
    configFeedback,
    configFeedbackTone,
    handleSaveConfig,
    triggeringSplit,
    splitFeedback,
    splitFeedbackTone,
    handleTriggerProfitSplit,
    smartContract,
    treasurySearch,
    setTreasurySearch,
    treasuryEntriesPage,
    setTreasuryEntriesPage,
    filteredTreasuryEntries,
    paginatedTreasuryEntries,
    TREASURY_PER_PAGE,
    lastSyncedAt,
  } = model;

  const balanced = treasurySummary?.isBalanced !== false;
  const ownerShare = 100 - buybackSharePctInput;

  const sc = smartContract as any;
  const contractId = sc?.contractId || sc?.contract_id || '';
  const contractNetwork = sc?.network || 'testnet';
  const contractStatus = sc?.status || 'ACTIVE';
  const protocolVersion = sc?.protocolVersion ?? sc?.protocol_version ?? 22;
  const feeBps = sc?.feeBps ?? sc?.fee_bps ?? 0;
  const ownerSplitPct = sc?.ownerSplitPct ?? sc?.owner_split_pct ?? 50;
  const currentWasmHash = sc?.currentWasmHash || sc?.current_wasm_hash || '';
  const treasuryAddress = sc?.treasuryAddress || sc?.treasury_address || '';
  const nrReserveAddress = sc?.nrReserveAddress || sc?.nr_reserve_address || '';
  const contractExplorerUrl = sc?.explorerUrl || sc?.explorer_url || '';

  return (
    <div className="space-y-4">
      {splitFeedback && <Feedback tone={splitFeedbackTone}>{splitFeedback}</Feedback>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Accumulated owner profit"
          value={formatUsd(treasurySummary?.netOwnerProfitUsd ?? 0)}
          icon={Wallet}
          tone="gold"
          hint="Withdrawable from cold custody"
          aside={<Badge tone="gold">Owner</Badge>}
        />
        <StatCard
          label="$NXL buyback injected"
          value={formatUsd(treasurySummary?.nrPoolInjectedUsd ?? 0)}
          icon={Coins}
          tone="cyan"
          hint="Strengthens liquidity pool backing"
          aside={<Badge tone="info">Pool</Badge>}
        />
        <StatCard
          label="Total protocol revenue"
          value={formatMoney(treasurySummary?.totalRevenueCents ?? 0)}
          icon={CircleDollarSign}
          tone="emerald"
          hint={`24h ${formatMoney(treasurySummary?.revenue24hCents ?? 0)}`}
          aside={<Badge tone="success" dot>Live</Badge>}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader
            eyebrow="Fee engine"
            title="Fee & split configuration"
            description="Runtime fee parameters applied to new orders, swaps, and cashouts."
            action={
              <Badge tone={isPausedInput ? 'danger' : 'success'} dot>
                {isPausedInput ? 'Paused' : 'Active'}
              </Badge>
            }
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <RateField
              id="order-fee"
              label="Order fee"
              hint="100 bps = 1.00% of order value"
              value={orderFeeBpsInput}
              onChange={setOrderFeeBpsInput}
              disabled={savingConfig}
              max={500}
            />
            <RateField
              id="swap-spread"
              label="Swap spread"
              hint="Applied to cross-rail swaps"
              value={swapSpreadBpsInput}
              onChange={setSwapSpreadBpsInput}
              disabled={savingConfig}
              max={500}
            />
            <RateField
              id="cashout-spread"
              label="Cashout spread"
              hint="Applied to fiat off-ramp orders"
              value={cashoutSpreadBpsInput}
              onChange={setCashoutSpreadBpsInput}
              disabled={savingConfig}
              max={500}
            />
            <RateField
              id="buyback-share"
              label="Buyback share"
              hint="Remaining percentage goes to owner profit"
              value={buybackSharePctInput}
              onChange={setBuybackSharePctInput}
              disabled={savingConfig}
              max={100}
              unit="%"
            />

            <div className="flex items-center justify-between gap-4 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3 sm:col-span-2">
              <div>
                <p className="text-xs font-medium text-slate-200">Pause settlement engine</p>
                <p className="mt-0.5 text-[11px] text-admin-faint">
                  Existing balances remain intact. New fee accruals stop processing.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPausedInput}
                aria-label="Pause settlement engine"
                onClick={() => setIsPausedInput(!isPausedInput)}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
                  isPausedInput
                    ? 'border-rose-400/30 bg-rose-500/70'
                    : 'border-admin-border bg-white/[0.08] hover:bg-white/[0.12]'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
                    isPausedInput ? 'translate-x-[22px]' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>

          {configFeedback && (
            <div className="mt-4">
              <Feedback tone={configFeedbackTone}>{configFeedback}</Feedback>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-admin-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-admin-faint">
              {treasuryConfig?.updated_at
                ? `Last updated ${formatDateTime(treasuryConfig.updated_at)}`
                : 'Configuration is stored in the platform treasury collection.'}
            </p>
            <Button variant="primary" loading={savingConfig} onClick={handleSaveConfig}>
              Save configuration
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col p-5 sm:p-6">
          <SectionHeader
            eyebrow="Integrity"
            title="Split reconciliation"
            description="Every fee event is verified against the 50/50 ledger split."
            action={<Badge tone={balanced ? 'success' : 'danger'} dot>{balanced ? 'Balanced' : 'Variance'}</Badge>}
          />
          <div className="mt-5 rounded-xl border border-admin-border bg-[#0A0E15] p-4">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.13em] text-admin-muted">
              <span className="text-admin-gold-soft">Owner share</span>
              <span className="text-sky-300">Buyback reserve</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full bg-gradient-to-r from-admin-gold-soft to-admin-gold transition-[width] duration-500"
                style={{ width: `${ownerShare}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-sky-500 transition-[width] duration-500"
                style={{ width: `${buybackSharePctInput}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-admin-mono text-[11px]">
              <span className="text-admin-gold-soft">{ownerShare}%</span>
              <span className="text-sky-300">{buybackSharePctInput}%</span>
            </div>
          </div>

          <div className="mt-2 flex-1 divide-y divide-white/[0.045]">
            <div className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-admin-muted">Gross volume</span>
              <span className="font-admin-mono font-semibold text-slate-200">
                {formatMoney(treasurySummary?.totalGrossVolumeCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-admin-muted">Total revenue</span>
              <span className="font-admin-mono font-semibold text-slate-200">
                {formatMoney(treasurySummary?.totalRevenueCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-admin-muted">Zero-sum difference</span>
              <span className="font-admin-mono font-semibold text-emerald-300">
                {formatMoney(treasurySummary?.zeroSumDifferenceCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-admin-muted">Reserve ratio</span>
              <span className="font-admin-mono font-semibold text-sky-300">{buybackSharePctInput}%</span>
            </div>
          </div>

          <Button
            variant="primary"
            className="mt-4 w-full"
            icon={Coins}
            loading={triggeringSplit}
            onClick={handleTriggerProfitSplit}
          >
            Trigger 50/50 split on-chain
          </Button>
          <p className="mt-2 text-center text-[10px] text-admin-faint">
            Executes a manual treasury split and records an audit event.
          </p>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Soroban"
          title="Nexus vault smart contract"
          description="Deployed Protocol 22 contract metadata and on-chain treasury routing."
          action={
            contractExplorerUrl ? (
              <a
                href={contractExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:text-sky-200"
              >
                View on explorer
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : (
              <Badge tone="neutral">Testnet</Badge>
            )
          }
        />
        {smartContract ? (
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-admin-border bg-[#0B0F16] px-3.5 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">Contract ID</p>
              <div className="mt-1.5">
                <CopyValue
                  value={contractId}
                  display={truncateMiddle(contractId, 10, 8)}
                  label="Copy contract ID"
                />
              </div>
            </div>
            <MiniStat
              label="Network"
              value={`${contractNetwork} · v${protocolVersion}`}
              hint={contractStatus}
              tone={contractStatus === 'ACTIVE' ? 'text-emerald-300' : 'text-amber-300'}
            />
            <MiniStat label="Protocol fee" value={`${feeBps} bps`} hint="Applied at contract level" />
            <MiniStat
              label="Owner split"
              value={`${ownerSplitPct}%`}
              hint={`Pool ${100 - ownerSplitPct}%`}
              tone="text-admin-gold-soft"
            />
            <div className="rounded-xl border border-admin-border bg-[#0B0F16] px-3.5 py-3 sm:col-span-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">WASM hash</p>
              <div className="mt-1.5">
                <CopyValue
                  value={currentWasmHash}
                  display={truncateMiddle(currentWasmHash, 18, 10)}
                  label="Copy WASM hash"
                />
              </div>
            </div>
            <div className="rounded-xl border border-admin-border bg-[#0B0F16] px-3.5 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">Treasury address</p>
              <div className="mt-1.5">
                <CopyValue
                  value={treasuryAddress}
                  display={truncateMiddle(treasuryAddress, 8, 6)}
                  label="Copy treasury address"
                />
              </div>
            </div>
            <div className="rounded-xl border border-admin-border bg-[#0B0F16] px-3.5 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-admin-faint">NXL reserve</p>
              <div className="mt-1.5">
                <CopyValue
                  value={nrReserveAddress}
                  display={truncateMiddle(nrReserveAddress, 8, 6)}
                  label="Copy reserve address"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-admin-border px-4 py-9 text-center">
            <Landmark className="h-5 w-5 text-admin-faint" aria-hidden="true" />
            <p className="text-xs text-admin-muted">
              {treasuryLoading ? 'Inspecting Soroban contract metadata…' : 'Contract metadata is not available yet.'}
            </p>
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={treasuryLoading} onClick={loadTreasuryData}>
              Inspect contract
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Ledger"
          title="Treasury settlement entries"
          description="Immutable fee splits, reserve injections, and reconciliation records."
          action={
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Badge tone="neutral">{filteredTreasuryEntries.length} entries</Badge>
              <SearchInput
                value={treasurySearch}
                onChange={(value) => {
                  setTreasurySearch(value);
                  setTreasuryEntriesPage(1);
                }}
                placeholder="Search entries…"
                ariaLabel="Search treasury settlement entries"
                className="sm:w-60"
              />
            </div>
          }
        />
        <TableWrap className="mt-5">
          <Table minWidth={960}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Source</Th>
                <Th>Rail</Th>
                <Th>Reference</Th>
                <Th align="right">Gross volume</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Owner profit</Th>
                <Th align="right">$NXL buyback</Th>
              </tr>
            </thead>
            <tbody>
              {treasuryLoading && treasuryEntries.length === 0 ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 8 }).map((__, cell) => (
                      <Td key={cell}>
                        <span className="admin-skeleton block h-3 w-20 rounded bg-white/[0.06]" />
                      </Td>
                    ))}
                  </tr>
                ))
              ) : paginatedTreasuryEntries.length > 0 ? (
                paginatedTreasuryEntries.map((item, index) => {
                  const refValue = item.reference_id || item.source_ref || item.id || '';
                  const revenueCents = item.total_revenue_cents ?? item.gross_fee_cents ?? 0;
                  const ownerProfitCents = item.net_owner_profit_cents ?? item.owner_profit_cents ?? 0;
                  const buybackCents = item.nr_pool_injected_cents ?? item.nr_pool_cents ?? 0;
                  return (
                    <tr key={item.id || index} className="transition-colors hover:bg-white/[0.022]">
                      <Td>
                        <span className="whitespace-nowrap text-[11px] text-admin-muted">
                          {formatDate(item.created_at)}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone="neutral">{String(item.source_type || 'INTERNAL').toUpperCase()}</Badge>
                      </Td>
                      <Td>
                        <RailBadge rail={item.rail || 'INTERNAL'} />
                      </Td>
                      <Td>
                        <CopyValue
                          value={refValue}
                          display={truncateMiddle(refValue, 12, 8)}
                          label="Copy entry reference"
                        />
                      </Td>
                      <Td align="right">
                        <span className="font-admin-mono text-xs text-slate-300 admin-tabular">
                          {formatMoney(item.gross_cents ?? 0)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-admin-mono text-xs font-semibold text-slate-100 admin-tabular">
                          {formatMoney(revenueCents)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-admin-mono text-xs font-semibold text-admin-gold-soft admin-tabular">
                          {formatMoney(ownerProfitCents)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-admin-mono text-xs font-semibold text-sky-300 admin-tabular">
                          {formatMoney(buybackCents)}
                        </span>
                      </Td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No treasury entries found"
                      description="Settlement splits will appear here once the treasury engine records its first fee event."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </TableWrap>
        <div className="mt-4">
          <PaginationBar
            currentPage={treasuryEntriesPage}
            totalItems={filteredTreasuryEntries.length}
            pageSize={TREASURY_PER_PAGE}
            onPageChange={setTreasuryEntriesPage}
          />
        </div>
        {lastSyncedAt && (
          <p className="mt-3 text-[10px] text-admin-faint">
            Ledger synced at {formatDateTime(lastSyncedAt)}.
          </p>
        )}
      </Card>
    </div>
  );
}

function RateField({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
  max,
  unit = 'bps',
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  max: number;
  unit?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={0}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cn(inputClassName, 'pr-14 font-admin-mono admin-tabular')}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-admin-faint">
          {unit}
        </span>
      </div>
    </Field>
  );
}
