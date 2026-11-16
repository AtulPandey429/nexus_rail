'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightCircle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  SearchX,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { FULFILLMENT_NAV_ITEMS } from '@/components/admin/adminNav';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Feedback,
  LinkButton,
  SearchInput,
  SectionHeader,
  StatCard,
  StatusBadge,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/admin/AdminUI';
import { FilterChip, PaginationBar } from '@/components/admin/AdminBits';
import {
  formatDateTime,
  formatUsd,
  initialsFor,
  type AdminModel,
} from '@/components/admin/adminModel';
import { clearSession, readSession, type SessionUser } from '@/lib/shop';

interface OrderState {
  id: string;
  orderNumber: string;
  buyerEmail?: string;
  status: 'PENDING' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'FAILED';
  totalCents: number;
  createdAt: string;
}

const ORDERS_PER_PAGE = 8;

export default function AdminOrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [orders, setOrders] = useState<OrderState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const loadOrders = async () => {
    const { token } = readSession();
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v1/admin/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.data?.orders)) {
        setOrders(data.data.orders);
      } else {
        setOrders([]);
        setError('The fulfillment queue could not be loaded.');
      }
    } catch {
      setOrders([]);
      setError('The fulfillment API is unreachable. No orders were changed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const { token, user: sessionUser } = readSession();
    if (!token || !sessionUser || sessionUser.role !== 'admin') {
      router.push('/login');
      return;
    }
    setUser(sessionUser);
    void loadOrders();
    // The guard intentionally runs once per route entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleStatusTransition = async (orderId: string, nextStatus: 'FULFILLING' | 'FULFILLED' | 'FAILED') => {
    const { token } = readSession();
    setError('');
    setBusyOrderId(orderId);
    try {
      const response = await fetch(`/api/v1/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setOrders((previous) =>
          previous.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
        );
      } else {
        setError(data.error?.message || data.error || 'That status change was rejected by the server.');
      }
    } catch {
      setError('The fulfillment API is unreachable. The order was not changed.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleSignOut = () => {
    clearSession();
    router.push('/login');
  };

  const counts = {
    total: orders.length,
    paid: orders.filter((order) => order.status === 'PAID').length,
    fulfilling: orders.filter((order) => order.status === 'FULFILLING').length,
    fulfilled: orders.filter((order) => order.status === 'FULFILLED').length,
  };

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      if (!query) return true;
      return [order.id, order.orderNumber, order.buyerEmail, order.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [orders, search, statusFilter]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, page]);

  if (!user) {
    return (
      <div className="admin-canvas flex min-h-screen flex-col items-center justify-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-admin-gold/30 bg-admin-gold/10 font-admin-mono text-sm font-bold text-admin-gold-soft">
          N
        </span>
        <p className="text-xs text-admin-muted">Opening fulfillment queue…</p>
      </div>
    );
  }

  const headerActions = (
    <>
      <Button variant="secondary" icon={RefreshCw} loading={isLoading} onClick={loadOrders}>
        Refresh queue
      </Button>
      <LinkButton href="/admin?tab=orders" variant="primary" icon={ShoppingCart}>
        Settlement ledger
      </LinkButton>
    </>
  );

  return (
    <AdminShell
      user={user}
      activeId="fulfillment"
      title="Fulfillment queue"
      description="Server-protected status transitions for paid orders: PAID → FULFILLING → FULFILLED."
      eyebrow="Operations"
      actions={headerActions}
      onSignOut={handleSignOut}
      navItems={FULFILLMENT_NAV_ITEMS}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Queue size" value={counts.total} icon={ClipboardCheck} tone="gold" hint="All fulfillment records" />
          <StatCard label="Awaiting action" value={counts.paid} icon={ArrowRightCircle} tone="cyan" hint="Paid, ready to fulfill" />
          <StatCard label="In fulfillment" value={counts.fulfilling} icon={RefreshCw} tone="violet" hint="Merchant processing" />
          <StatCard label="Completed" value={counts.fulfilled} icon={CheckCircle2} tone="emerald" hint="Delivered and fulfilled" />
        </div>

        {error && <Feedback tone="error">{error}</Feedback>}

        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Queue"
            title="Paid orders"
            description="Only server-approved status transitions are available for each order."
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Badge tone="neutral">{filteredOrders.length} orders</Badge>
                <SearchInput
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Search order or buyer…"
                  ariaLabel="Search fulfillment queue"
                />
              </div>
            }
          />

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All', count: counts.total },
              { id: 'PAID', label: 'Paid', count: counts.paid },
              { id: 'FULFILLING', label: 'Fulfilling', count: counts.fulfilling },
              { id: 'FULFILLED', label: 'Fulfilled', count: counts.fulfilled },
              { id: 'FAILED', label: 'Failed', count: orders.filter((order) => order.status === 'FAILED').length },
            ].map((filter) => (
              <FilterChip
                key={filter.id}
                active={statusFilter === filter.id}
                count={filter.count}
                onClick={() => {
                  setStatusFilter(filter.id);
                  setPage(1);
                }}
              >
                {filter.label}
              </FilterChip>
            ))}
          </div>

          <TableWrap className="mt-4">
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Buyer</Th>
                  <Th align="right">Total</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {isLoading && orders.length === 0 ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 6 }).map((__, cell) => (
                        <Td key={cell}>
                          <span className="admin-skeleton block h-3 w-24 rounded bg-white/[0.06]" />
                        </Td>
                      ))}
                    </tr>
                  ))
                ) : paginatedOrders.length > 0 ? (
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
                          <span className="max-w-[220px] truncate text-xs text-slate-300">
                            {order.buyerEmail || 'buyer@example.com'}
                          </span>
                        </div>
                      </Td>
                      <Td align="right">
                        <span className="font-admin-mono text-xs font-semibold text-admin-gold-soft">
                          {formatUsd(order.totalCents / 100)}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge status={order.status} />
                      </Td>
                      <Td>
                        <span className="whitespace-nowrap text-[11px] text-admin-muted">
                          {formatDateTime(order.createdAt)}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-2">
                          {order.status === 'PAID' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={ArrowRightCircle}
                              loading={busyOrderId === order.id}
                              onClick={() => handleStatusTransition(order.id, 'FULFILLING')}
                            >
                              Start fulfilling
                            </Button>
                          )}
                          {order.status === 'FULFILLING' && (
                            <Button
                              size="sm"
                              variant="primary"
                              icon={CheckCircle2}
                              loading={busyOrderId === order.id}
                              onClick={() => handleStatusTransition(order.id, 'FULFILLED')}
                            >
                              Mark fulfilled
                            </Button>
                          )}
                          {order.status === 'FULFILLED' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Complete
                            </span>
                          )}
                          {(order.status === 'FAILED' || order.status === 'PENDING') && (
                            <span className="text-[11px] text-admin-faint">No action</span>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="No orders in this view"
                        description="Try a different status filter or clear the search query."
                        icon={SearchX}
                        action={
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSearch('');
                              setStatusFilter('ALL');
                              setPage(1);
                            }}
                          >
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
              currentPage={page}
              totalItems={filteredOrders.length}
              pageSize={ORDERS_PER_PAGE}
              onPageChange={setPage}
              itemLabel="orders"
            />
          </div>
        </Card>

        <div className="flex items-start gap-2.5 rounded-xl border border-admin-border bg-[#0A0E15] px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-admin-gold/80" aria-hidden="true" />
          <p className="text-[10px] leading-relaxed text-admin-muted">
            Transition guard: PENDING → PAID (payment webhook) → FULFILLING → FULFILLED. The server rejects any
            transition outside this sequence; the console only exposes actions that are currently valid.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
