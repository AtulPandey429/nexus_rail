'use client';

import React from 'react';
import { ArrowLeftRight, Boxes, Layers, RefreshCw } from 'lucide-react';
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
import { formatMoney, type AdminModel } from '@/components/admin/adminModel';

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
                paginatedCatalog.map((product) => {
                  const status = product.active === false ? 'PAUSED' : 'ACTIVE';
                  const priceCents = product.priceCents ?? product.price_cents ?? 0;
                  const rail = product.settlementRail || product.rail || 'Dual-rail';
                  return (
                    <tr
                      key={product.id || product.sku}
                      className="transition-colors hover:bg-white/[0.022]"
                    >
                      <Td>
                        <span className="font-admin-mono text-[11px] font-semibold text-admin-gold-soft">
                          {product.sku}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-[260px] truncate text-xs font-medium text-white">
                          {product.title}
                        </span>
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
                        <Button variant="secondary" size="sm" icon={RefreshCw} loading={catalogLoading} onClick={loadAdminProducts}>
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
    </div>
  );
}
