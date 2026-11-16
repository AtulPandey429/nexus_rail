'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CopyValue,
  EmptyState,
  SearchInput,
  SectionHeader,
  StatCard,
  StatusBadge,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/admin/AdminUI';
import { PaginationBar, RailBadge } from '@/components/admin/AdminBits';
import {
  formatDateTime,
  truncateMiddle,
  type AdminModel,
} from '@/components/admin/adminModel';

export function AuditTab({ model }: { model: AdminModel }) {
  const {
    chainLogs,
    chainLogsLoading,
    loadChainLogs,
    auditSearch,
    setAuditSearch,
    auditPage,
    setAuditPage,
    filteredAuditLogs,
    paginatedAuditLogs,
    AUDIT_PER_PAGE,
    lastSyncedAt,
  } = model;

  const successCount = chainLogs.filter((log) => (log.status || '').toUpperCase() === 'SUCCESS').length;
  const failedCount = chainLogs.filter((log) => (log.status || '').toUpperCase() === 'FAILED').length;
  const lastEvent = chainLogs[0]?.created_at;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Audit events"
          value={chainLogs.length}
          icon={ListChecks}
          tone="gold"
          hint="On-chain and operator actions"
        />
        <StatCard
          label="Verified events"
          value={successCount}
          icon={CheckCircle2}
          tone="emerald"
          hint="Successful chain receipts"
        />
        <StatCard
          label="Failed events"
          value={failedCount}
          icon={AlertTriangle}
          tone={failedCount > 0 ? 'rose' : 'neutral'}
          hint="Rejected or reverted actions"
        />
        <StatCard
          label="Latest event"
          value={lastEvent ? formatDateTime(lastEvent) : '—'}
          icon={ShieldCheck}
          tone="cyan"
          hint="Most recent append-only record"
        />
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Governance"
          title="Cryptographic audit trail"
          description="Tamper-evident log of smart contract transactions, profit splits, and operator actions."
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Badge tone="neutral">{filteredAuditLogs.length} events</Badge>
              <SearchInput
                value={auditSearch}
                onChange={(value) => {
                  setAuditSearch(value);
                  setAuditPage(1);
                }}
                placeholder="Search action, chain, hash…"
                ariaLabel="Search audit trail"
              />
            </div>
          }
        />

        <TableWrap className="mt-5">
          <Table minWidth={900}>
            <thead>
              <tr>
                <Th>Timestamp</Th>
                <Th>Action</Th>
                <Th>Settlement rail</Th>
                <Th>Status</Th>
                <Th>Transaction hash</Th>
              </tr>
            </thead>
            <tbody>
              {chainLogsLoading && chainLogs.length === 0 ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 5 }).map((__, cell) => (
                      <Td key={cell}>
                        <span className="admin-skeleton block h-3 w-24 rounded bg-white/[0.06]" />
                      </Td>
                    ))}
                  </tr>
                ))
              ) : paginatedAuditLogs.length > 0 ? (
                paginatedAuditLogs.map((log, index) => (
                  <tr key={log.id || index} className="transition-colors hover:bg-white/[0.022]">
                    <Td>
                      <span className="whitespace-nowrap text-[11px] text-admin-muted">
                        {formatDateTime(log.created_at)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs font-medium text-slate-200">
                        {(log.action || 'CONTRACT_SPLIT').replaceAll('_', ' ')}
                      </span>
                      {log.reference_id && (
                        <p className="mt-0.5 max-w-[200px] truncate font-admin-mono text-[10px] text-admin-faint">
                          {log.reference_id}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <RailBadge rail={log.chain} />
                    </Td>
                    <Td>
                      <StatusBadge status={log.status || 'VERIFIED'} />
                    </Td>
                    <Td>
                      {log.tx_hash ? (
                        <div className="flex items-center gap-2">
                          <CopyValue
                            value={log.tx_hash}
                            display={truncateMiddle(log.tx_hash, 10, 8)}
                            label="Copy transaction hash"
                          />
                          {log.explorer_url && (
                            <a
                              href={log.explorer_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open transaction in explorer"
                              className="text-admin-faint transition-colors hover:text-sky-300"
                            >
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-admin-faint">On-chain ledger</span>
                      )}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="No audit events found"
                      description={
                        auditSearch
                          ? 'No records match this search. Try a different action, chain, or transaction hash.'
                          : 'Chain actions will appear here after the first settlement or operator event.'
                      }
                      action={
                        <Button variant="secondary" size="sm" icon={RefreshCw} loading={chainLogsLoading} onClick={loadChainLogs}>
                          Refresh audit trail
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </TableWrap>

        <div className="mt-4">
          <PaginationBar
            currentPage={auditPage}
            totalItems={filteredAuditLogs.length}
            pageSize={AUDIT_PER_PAGE}
            onPageChange={setAuditPage}
            itemLabel="events"
          />
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden="true" />
          <p className="text-[10px] leading-relaxed text-admin-muted">
            Audit records are append-only. Each entry links to its on-chain transaction receipt and remains
            verifiable independently of the console.
            {lastSyncedAt && (
              <span className="ml-1 text-admin-faint">Synced {formatDateTime(lastSyncedAt)}.</span>
            )}
          </p>
        </div>
      </Card>
    </div>
  );
}
