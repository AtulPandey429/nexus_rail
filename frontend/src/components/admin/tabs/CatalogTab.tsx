'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Boxes, Layers, Plus, RefreshCw, Tag } from 'lucide-react';
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
  inputClassName,
} from '@/components/admin/AdminUI';
import { FilterChip, PaginationBar, ProductThumb, RailBadge } from '@/components/admin/AdminBits';
import { formatMoney, type AdminModel } from '@/components/admin/adminModel';

interface AdminCoupon {
  code: string;
  discount_percent: number;
  min_order_cents: number;
  requires_nr_holder?: boolean;
  first_order_only?: boolean;
  active: boolean;
  used_count: number;
  description?: string;
}

export function CatalogTab({ model }: { model: AdminModel }) {
  const {
    adminProducts,
    catalogLoading,
    catalogSearch,
    setCatalogSearch,
    catalogPage,
    setCatalogPage,
    catalogCategory,
    setCatalogCategory,
    filteredCatalog,
    paginatedCatalog,
    CATALOG_PER_PAGE,
    loadAdminProducts,
  } = model;

  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newPercent, setNewPercent] = useState('15');
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponNotice, setCouponNotice] = useState('');

  const loadCoupons = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token) return;
    setCouponsLoading(true);
    try {
      const res = await fetch('/api/v1/admin/coupons', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data?.coupons)) {
        setCoupons(json.data.coupons);
      }
    } catch {
      // keep existing state
    } finally {
      setCouponsLoading(false);
    }
  };

  useEffect(() => {
    void loadCoupons();
  }, []);

  const saveCoupon = async (payload: { code: string; discountPercent: number; active: boolean }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token) return;
    setSavingCoupon(true);
    setCouponNotice('');
    try {
      const res = await fetch('/api/v1/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save coupon');
      setCouponNotice(`Saved promo code ${payload.code.toUpperCase()}.`);
      setNewCode('');
      await loadCoupons();
    } catch (err: any) {
      setCouponNotice(err?.message || 'Failed to save coupon.');
    } finally {
      setSavingCoupon(false);
    }
  };

  const categories = Array.from(
    new Set(adminProducts.map((product) => String(product.category || '').trim()).filter(Boolean))
  ).slice(0, 6);

  const multiRailCount = adminProducts.filter((product) => {
    const rail = String(product.settlementRail || product.rail || '').toLowerCase();
    return rail.includes('multi') || rail.includes('dual');
  }).length;

  const resetFilters = () => {
    setCatalogSearch('');
    setCatalogCategory('all');
    setCatalogPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Catalog SKUs"
          value={adminProducts.length}
          icon={Layers}
          tone="gold"
          hint="Active products and smart baskets"
        />
        <StatCard
          label="Categories"
          value={categories.length}
          icon={Boxes}
          tone="cyan"
          hint="Baskets and live asset classes"
        />
        <StatCard
          label="Multi-rail products"
          value={multiRailCount}
          icon={ArrowLeftRight}
          tone="violet"
          hint="Settleable on Stellar and XRPL"
        />
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Catalog"
          title="Smart baskets & live assets"
          description="Tokenized index baskets and multi-rail asset weighting configuration."
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Badge tone="neutral">{filteredCatalog.length} results</Badge>
              <SearchInput
                value={catalogSearch}
                onChange={(value) => {
                  setCatalogSearch(value);
                  setCatalogPage(1);
                }}
                placeholder="Search SKU or title…"
                ariaLabel="Search catalog"
              />
            </div>
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={catalogCategory === 'all'}
            onClick={() => {
              setCatalogCategory('all');
              setCatalogPage(1);
            }}
            count={adminProducts.length}
          >
            All
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category}
              active={catalogCategory === category}
              onClick={() => {
                setCatalogCategory(category);
                setCatalogPage(1);
              }}
              count={adminProducts.filter((product) => product.category === category).length}
            >
              {category}
            </FilterChip>
          ))}
          {(catalogSearch || catalogCategory !== 'all') && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-1">
              Clear
            </Button>
          )}
        </div>

        <TableWrap className="mt-4">
          <Table minWidth={840}>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Settlement rail</Th>
                <Th align="right">Live price</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {catalogLoading && adminProducts.length === 0 ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 6 }).map((__, cell) => (
                      <Td key={cell}>
                        <span className="admin-skeleton block h-3 w-20 rounded bg-white/[0.06]" />
                      </Td>
                    ))}
                  </tr>
                ))
              ) : paginatedCatalog.length > 0 ? (
                paginatedCatalog.map((product, index) => {
                  const status = product.active === false ? 'PAUSED' : 'ACTIVE';
                  const priceCents = product.priceCents ?? product.price_cents ?? 0;
                  const rail = product.settlementRail || product.rail || 'Dual-rail';
                  return (
                    <tr
                      key={`${product.id || product.sku || 'catalog'}-${index}`}
                      className="transition-colors hover:bg-white/[0.022]"
                    >
                      <Td>
                        <span className="font-admin-mono text-[11px] font-semibold text-admin-gold-soft">
                          {product.sku}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <ProductThumb
                            sku={product.sku}
                            title={product.title}
                            category={product.category}
                            isBasket={Boolean(product.is_basket ?? product.isBasket)}
                            size={34}
                          />
                          <span className="block max-w-[230px] truncate text-xs font-medium text-white">
                            {product.title}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone="neutral">{String(product.category || 'Uncategorized')}</Badge>
                      </Td>
                      <Td>
                        <RailBadge rail={String(rail)} />
                      </Td>
                      <Td align="right">
                        <span className="font-admin-mono text-xs font-semibold text-slate-100">
                          {formatMoney(priceCents)}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge status={status} />
                      </Td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No catalog items found"
                      description="Try a different search term or refresh the catalog from the product service."
                      action={
                        <Button variant="secondary" size="sm" icon={RefreshCw} loading={catalogLoading} onClick={() => loadAdminProducts(true)}>
                          Refresh catalog
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
            currentPage={catalogPage}
            totalItems={filteredCatalog.length}
            pageSize={CATALOG_PER_PAGE}
            onPageChange={setCatalogPage}
            itemLabel="SKUs"
          />
        </div>
      </Card>

      {/* Stripe-Style Smart Coupons Manager (Module 7) */}
      <Card className="p-5 sm:p-6">
        <SectionHeader
          title="Promo codes & discounts"
          description="Server-validated coupons applied at cart checkout alongside 2% $NXL cashback."
          action={
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCode.trim()) return;
                void saveCoupon({
                  code: newCode.trim().toUpperCase(),
                  discountPercent: Number(newPercent) || 10,
                  active: true,
                });
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="NEWCODE20"
                className={`${inputClassName} h-9 w-36 py-1 font-admin-mono text-xs uppercase`}
              />
              <input
                type="number"
                min={1}
                max={50}
                value={newPercent}
                onChange={(e) => setNewPercent(e.target.value)}
                className={`${inputClassName} h-9 w-20 py-1 font-admin-mono text-xs`}
                aria-label="Discount percent"
              />
              <Button type="submit" variant="primary" size="sm" icon={Plus} loading={savingCoupon}>
                Add code
              </Button>
            </form>
          }
        />

        {couponNotice && (
          <p className="mt-3 text-xs text-emerald-300">{couponNotice}</p>
        )}

        <TableWrap className="mt-4">
          <Table minWidth={680}>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th align="right">Discount</Th>
                <Th align="right">Min order</Th>
                <Th align="right">Redeemed</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {couponsLoading && coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    Loading coupons…
                  </td>
                </tr>
              ) : coupons.length > 0 ? (
                coupons.map((c) => (
                  <tr key={c.code} className="transition-colors hover:bg-white/[0.025]">
                    <Td>
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <span className="font-admin-mono text-xs font-semibold text-white">{c.code}</span>
                        {c.requires_nr_holder && <Badge tone="gold">$NXL VIP</Badge>}
                        {c.first_order_only && <Badge tone="info">First order</Badge>}
                      </div>
                    </Td>
                    <Td align="right">
                      <span className="font-admin-mono font-medium text-white">{c.discount_percent}%</span>
                    </Td>
                    <Td align="right">
                      <span className="font-admin-mono text-slate-400">${(c.min_order_cents / 100).toFixed(0)}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-admin-mono text-slate-300">{c.used_count}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={c.active ? 'ACTIVE' : 'PAUSED'} />
                    </Td>
                    <Td align="right">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={savingCoupon}
                        onClick={() =>
                          void saveCoupon({
                            code: c.code,
                            discountPercent: c.discount_percent,
                            active: !c.active,
                          })
                        }
                      >
                        {c.active ? 'Pause' : 'Enable'}
                      </Button>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    No promo codes configured.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
