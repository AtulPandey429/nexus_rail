'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  ExternalLink,
  FilterX,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
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
import { FilterChip, PaginationBar, RailBadge } from '@/components/admin/AdminBits';
import {
  initialsFor,
  truncateMiddle,
  type AdminModel,
} from '@/components/admin/adminModel';

interface AdminSwapRow {
  swapId: string;
  fromAsset: string;
  toAsset: string;
  payAmount: number;
  receiveAmount: number;
  userDestinationAddress: string;
  status: string;
  payoutTxHash?: string;
  depositTxHash?: string;
  payoutExplorerUrl?: string;
  depositExplorerUrl?: string;
  createdAt: string;
}

export function OrdersTab({ model }: { model: AdminModel }) {
  const {
    liveOrders,
    ordersLoading,
    ordersSearch,
    setOrdersSearch,
    ordersPage,
    setOrdersPage,
    ordersStatusFilter,
    setOrdersStatusFilter,
    filteredOrders,
    paginatedOrders,
    ORDERS_PER_PAGE,
    loadAdminOrders,
  } = model;

  const [ledgerView, setLedgerView] = useState<'orders' | 'swaps'>('orders');
  const [swaps, setSwaps] = useState<AdminSwapRow[]>([]);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadSwaps = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token) return;
    setSwapsLoading(true);
    try {
      const res = await fetch('/api/v1/admin/swaps?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data?.swaps)) {
        setSwaps(json.data.swaps);
      }
    } catch {
      // keep existing state
    } finally {
      setSwapsLoading(false);
    }
  };

  useEffect(() => {
    if (ledgerView === 'swaps' && swaps.length === 0) {
      void loadSwaps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerView]);

  const handleResolveUnderpaid = async (orderId: string, mode: 'TOPUP_USD' | 'REFUND_WALLET') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token) return;
    setBusyOrderId(orderId);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/resolve-underpaid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Could not update order.');
      }
      setActionNotice({ type: 'ok', text: json.data?.message || 'Order updated.' });
      loadAdminOrders();
    } catch (err: any) {
      setActionNotice({ type: 'err', text: err?.message || 'Action failed.' });
    } finally {
      setBusyOrderId(null);
    }
  };

  const countFor = (status: string) => liveOrders.filter((order) => order.status === status).length;
  const paidCount = countFor('PAID');
  const fulfilledCount = countFor('FULFILLED');
  const pendingCount = countFor('PENDING');

  const filters = [
    { id: 'ALL', label: 'All orders', count: liveOrders.length },
    ...Array.from(new Set(liveOrders.map((order) => order.status)))
      .filter((status) => status && status !== 'ALL')
      .map((status) => ({
        id: status,
        label: status
          .toLowerCase()
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (character) => character.toUpperCase()),
        count: countFor(status),
      })),
  ];

  const resetFilters = () => {
    setOrdersSearch('');
    setOrdersStatusFilter('ALL');
    setOrdersPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total orders"
          value={liveOrders.length}
          icon={ShoppingCart}
          tone="neutral"
          hint="Across both settlement rails"
        />
        <StatCard
          label="Paid"
          value={paidCount}
          icon={CheckCircle2}
          tone="cyan"
          hint="Payment confirmed on-chain"
        />
        <StatCard
          label="Fulfilled"
          value={fulfilledCount}
          icon={PackageCheck}
          tone="emerald"
          hint="Merchant delivery completed"
        />
        <StatCard
          label="Awaiting payment"
          value={pendingCount}
          icon={ArrowRightLeft}
          tone="violet"
          hint="Pending or underpaid settlement"
        />
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          title={ledgerView === 'orders' ? 'Orders' : 'Cross-chain swaps'}
          description={
            ledgerView === 'orders'
              ? 'Customer orders across Stellar, XRPL, Stripe, and $NXL.'
              : 'Persistent cross-chain swap records stored in MongoDB.'
          }
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {/* Stripe-style segmented toggle */}
              <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#0B0D12] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLedgerView('orders')}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    ledgerView === 'orders' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Orders ({liveOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerView('swaps')}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    ledgerView === 'swaps' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Swaps ({swaps.length})
                </button>
              </div>
              {ledgerView === 'orders' ? (
                <SearchInput
                  value={ordersSearch}
                  onChange={(value) => {
                    setOrdersSearch(value);
                    setOrdersPage(1);
                  }}
                  placeholder="Search order, email, hash…"
                  ariaLabel="Search orders"
                />
              ) : (
                <Button variant="secondary" size="sm" icon={RefreshCw} loading={swapsLoading} onClick={() => void loadSwaps()}>
                  Refresh
                </Button>
              )}
            </div>
          }
        />

        {actionNotice && (
          <div
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs ${
              actionNotice.type === 'ok'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
            }`}
          >
            {actionNotice.text}
          </div>
        )}

        {ledgerView === 'swaps' ? (
          <TableWrap className="mt-4">
            <Table minWidth={820}>
              <thead>
                <tr>
                  <Th>Swap ID</Th>
                  <Th>Pair</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Received</Th>
                  <Th>Destination</Th>
                  <Th>Status</Th>
                  <Th>Receipt</Th>
                </tr>
              </thead>
              <tbody>
                {swapsLoading && swaps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-400">
                      Loading cross-chain swaps…
                    </td>
                  </tr>
                ) : swaps.length > 0 ? (
                  swaps.map((s) => {
                    const hash = s.payoutTxHash || s.depositTxHash;
                    const explorer = s.payoutExplorerUrl || s.depositExplorerUrl;
                    return (
                      <tr key={s.swapId} className="transition-colors hover:bg-white/[0.025]">
                        <Td>
                          <span className="font-admin-mono text-xs font-medium text-white">{s.swapId}</span>
                        </Td>
                        <Td>
                          <span className="text-xs font-medium text-slate-200">
                            {s.fromAsset} → {s.toAsset}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-admin-mono text-xs text-slate-200">
                            {s.payAmount} {s.fromAsset}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-admin-mono text-xs font-medium text-white">
                            {s.receiveAmount} {s.toAsset}
                          </span>
                        </Td>
                        <Td>
                          <span className="font-admin-mono text-xs text-slate-400">
                            {truncateMiddle(s.userDestinationAddress, 8, 6)}
                          </span>
                        </Td>
                        <Td>
                          <StatusBadge status={s.status} />
                        </Td>
                        <Td>
                          {hash && explorer ? (
                            <a
                              href={explorer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-admin-mono text-xs text-sky-300 hover:text-sky-200"
                            >
                              {truncateMiddle(hash, 8, 6)}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title="No persisted swaps yet"
                        description="Cross-chain XRP and XLM swaps will appear here automatically."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {filters.map((filter) => (
            <FilterChip
              key={filter.id}
              active={ordersStatusFilter === filter.id}
              onClick={() => {
                setOrdersStatusFilter(filter.id);
                setOrdersPage(1);
              }}
              count={filter.count}
            >
              {filter.label}
            </FilterChip>
          ))}
          {(ordersSearch || ordersStatusFilter !== 'ALL') && (
            <Button variant="ghost" size="sm" icon={FilterX} onClick={resetFilters} className="ml-1">
              Clear
            </Button>
          )}
        </div>

        <TableWrap className="mt-4">
          <Table minWidth={980}>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Rail</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th>Age</Th>
                <Th>Receipt / Action</Th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading && liveOrders.length === 0 ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 7 }).map((__, cell) => (
                      <Td key={cell}>
                        <span className="admin-skeleton block h-3 w-20 rounded bg-white/[0.06]" />
                      </Td>
                    ))}
                  </tr>
                ))
              ) : paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-white/[0.025]">
                    <Td>
                      <span className="font-admin-mono text-xs font-semibold text-white">{order.orderNumber}</span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.06] font-admin-mono text-[10px] font-semibold text-slate-300">
                          {initialsFor(order.buyerEmail)}
                        </span>
                        <span className="max-w-[200px] truncate text-[13px] text-slate-200">{order.buyerEmail}</span>
                      </div>
                    </Td>
                    <Td>
                      <RailBadge rail={order.rail} />
                    </Td>
                    <Td align="right">
                      <span className="font-admin-mono text-[13px] font-medium text-white">
                        {order.amount}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={order.status} />
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-xs text-slate-400">{order.createdAt}</span>
                    </Td>
                    <Td>
                      {order.status === 'UNDERPAID' ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busyOrderId === order.id}
                            onClick={() => void handleResolveUnderpaid(order.id, 'TOPUP_USD')}
                          >
                            Settle
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={busyOrderId === order.id}
                            onClick={() => void handleResolveUnderpaid(order.id, 'REFUND_WALLET')}
                          >
                            Refund
                          </Button>
                        </div>
                      ) : order.txHash ? (
                        <a
                          href={order.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={order.txHash}
                          className="inline-flex items-center gap-1.5 font-admin-mono text-xs text-sky-300 transition-colors hover:text-sky-200"
                        >
                          {truncateMiddle(order.txHash, 10, 8)}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No orders match this view"
                      description="Try a different status filter or clear the search query."
                      action={
                        <Button variant="secondary" size="sm" onClick={resetFilters}>
                          Reset filters
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
            currentPage={ordersPage}
            totalItems={filteredOrders.length}
            pageSize={ORDERS_PER_PAGE}
            onPageChange={setOrdersPage}
            itemLabel="orders"
          />
        </div>
          </>
        )}
      </Card>
    </div>
  );
}
