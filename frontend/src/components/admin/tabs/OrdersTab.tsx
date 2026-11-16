'use client';

import React from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  ExternalLink,
  FilterX,
  PackageCheck,
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

export function OrdersTab({ model }: { model: AdminModel }) {
  const {
    liveOrders,
    ordersSearch,
    setOrdersSearch,
    ordersPage,
    setOrdersPage,
    ordersStatusFilter,
    setOrdersStatusFilter,
    filteredOrders,
    paginatedOrders,
    ORDERS_PER_PAGE,
  } = model;

  const paidCount = liveOrders.filter((order) => order.status === 'PAID').length;
  const fulfilledCount = liveOrders.filter((order) => order.status === 'FULFILLED').length;
  const settledCount = liveOrders.filter((order) => order.status === 'SETTLED').length;

  const filters = [
    { id: 'ALL', label: 'All orders', count: liveOrders.length },
    { id: 'PAID', label: 'Paid', count: paidCount },
    { id: 'FULFILLED', label: 'Fulfilled', count: fulfilledCount },
    { id: 'SETTLED', label: 'Settled', count: settledCount },
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
          label="Cross-chain settled"
          value={settledCount}
          icon={ArrowRightLeft}
          tone="violet"
          hint="Rail-to-rail swaps finalized"
        />
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Operations"
          title="Settlement ledger"
          description="Dual-rail order execution, merchant validation, and cryptographic receipts."
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Badge tone="neutral">{filteredOrders.length} results</Badge>
              <SearchInput
                value={ordersSearch}
                onChange={(value) => {
                  setOrdersSearch(value);
                  setOrdersPage(1);
                }}
                placeholder="Search order, email, hash…"
                ariaLabel="Search orders"
              />
            </div>
          }
        />

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
                <Th>Payment rail</Th>
                <Th>Settlement amount</Th>
                <Th>Status</Th>
                <Th>Age</Th>
                <Th>On-chain receipt</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-white/[0.022]">
                    <Td>
                      <span className="font-admin-mono text-xs font-semibold text-white">{order.orderNumber}</span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-admin-mono text-[9px] font-bold text-slate-300">
                          {initialsFor(order.buyerEmail)}
                        </span>
                        <span className="max-w-[200px] truncate text-xs text-slate-300">{order.buyerEmail}</span>
                      </div>
                    </Td>
                    <Td>
                      <RailBadge rail={order.rail} />
                    </Td>
                    <Td>
                      <span className="font-admin-mono text-xs font-semibold text-admin-gold-soft">
                        {order.amount}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={order.status} />
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-[11px] text-admin-muted">{order.createdAt}</span>
                    </Td>
                    <Td>
                      {order.txHash ? (
                        <a
                          href={order.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={order.txHash}
                          className="inline-flex items-center gap-1.5 font-admin-mono text-[11px] text-sky-300 transition-colors hover:text-sky-200"
                        >
                          {truncateMiddle(order.txHash, 10, 8)}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-admin-faint">—</span>
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
      </Card>
    </div>
  );
}
