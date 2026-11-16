'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag,
  Search,
  Check,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Box,
  SlidersHorizontal,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  FIGMA_CATALOG,
  CatalogItem,
  fetchCatalog,
  getCachedCatalog,
  addSkuToCart,
  fetchCartLines,
  CartLine,
  readSession,
  SessionUser,
  onSessionChange,
} from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';

type CategoryFilter = 'all' | 'baskets' | 'live-assets' | 'hardware' | 'workspace' | 'essentials';
type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating';

const ALLOCATION_COLORS: Record<string, string> = {
  GOLD_G: 'bg-amber-400',
  SILVER_G: 'bg-slate-300',
  USDC: 'bg-emerald-400',
  XRP: 'bg-blue-400',
  XLM: 'bg-cyan-400',
  NR: 'bg-violet-400',
  NXL: 'bg-violet-400',
};

const PRODUCT_IMAGES: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'NODE-STAND': '/products/node-stand.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
  'RAIL-CABLES': '/products/rail-cables.png',
  'PROD-XRP-KIT': '/products/node-stand.png',
  'PROD-XLM-PASS': '/products/rail-one.png',
  'PROD-AGENT-PRO': '/products/relay-mat.png',
  'PROD-LEDGER-COLD': '/products/rail-cables.png',
  'BASKET-INFLATION-SHIELD': '/products/rail-one.png',
  'BASKET-DUAL-RAIL': '/products/relay-mat.png',
  'BASKET-AI-ALPHA': '/products/node-stand.png',
  'NGOLD-1G': '/products/rail-one.png',
  'NGOLD-TOKEN': '/products/rail-one.png',
  'NSILVER-10G': '/products/node-stand.png',
  'NR-PACK-50': '/products/rail-cables.png',
  'NR-TOKEN': '/products/rail-cables.png',
};

export default function StoreCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [maxPrice, setMaxPrice] = useState<number>(600);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [addingSku, setAddingSku] = useState<string | null>(null);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Debounce search query to prevent unnecessary re-filtering and input jank
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Dynamic API Catalog with 30-minute caching
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => {
    const cached = getCachedCatalog();
    return cached && cached.products.length > 0 ? cached.products : FIGMA_CATALOG;
  });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSource, setCatalogSource] = useState<'api' | 'cache'>('cache');

  // Live Conversion Rates with 30-minute caching
  const { xlmUsd, xrpUsd, refreshRates, loading: ratesLoading } = useLiveExchangeRates();

  useEffect(() => {
    const syncUser = () => {
      const sess = readSession();
      setUser(sess.user);
    };

    syncUser();
    return onSessionChange(syncUser);
  }, []);

  // Fetch product catalog from API + auto-refresh every 60s for live oracle accuracy
  const syncLivePrices = async () => {
    setCatalogLoading(true);
    try {
      const [items] = await Promise.all([
        fetchCatalog(true),
        refreshRates().catch(() => {}),
      ]);
      setCatalog(items);
      setCatalogSource('api');
    } catch {
      // keep existing catalog on transient error
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog()
      .then((items) => {
        setCatalog(items);
        const updated = getCachedCatalog();
        if (updated) setCatalogSource(updated.source);
      })
      .catch(() => {});

    const onCatalogUpdate = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.products) {
        setCatalog(custom.detail.products);
        if (custom.detail.source) setCatalogSource(custom.detail.source);
      }
    };
    window.addEventListener('nexus-catalog-updated', onCatalogUpdate);

    const interval = setInterval(() => {
      fetchCatalog(true).then(setCatalog).catch(() => {});
    }, 60 * 1000);

    return () => {
      window.removeEventListener('nexus-catalog-updated', onCatalogUpdate);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchCartLines().then(setCartLines).catch(() => {});
    const onCart = () => {
      fetchCartLines().then(setCartLines).catch(() => {});
    };
    window.addEventListener('nexus-cart', onCart);
    return () => window.removeEventListener('nexus-cart', onCart);
  }, []);

  const handleAdd = async (sku: string) => {
    setAddingSku(sku);
    try {
      await addSkuToCart(sku);
      const updated = await fetchCartLines();
      setCartLines(updated);
    } catch {
      // quiet fallback
    } finally {
      setTimeout(() => setAddingSku(null), 600);
    }
  };

  // Normalized live-asset category grouping + unrestricted full catalog visibility
  const resolvedCatalog = useMemo(() => {
    const items = catalog && catalog.length > 0 ? catalog : FIGMA_CATALOG;
    return items.map((p) => {
      const cat = p.category === 'crypto' ? 'live-assets' : p.category;
      return { ...p, normalizedCategory: cat };
    });
  }, [catalog]);

  // Filtered Products using debounced search
  const filteredProducts = useMemo(() => {
    return resolvedCatalog
      .filter((product) => {
        const matchesCategory =
          selectedCategory === 'all' || product.normalizedCategory === selectedCategory;
        const matchesSearch =
          !debouncedSearch ||
          product.title.toLowerCase().includes(debouncedSearch) ||
          product.description.toLowerCase().includes(debouncedSearch) ||
          product.sku.toLowerCase().includes(debouncedSearch);
        const matchesPrice = product.priceCents / 100 <= maxPrice;
        return matchesCategory && matchesSearch && matchesPrice;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.priceCents - b.priceCents;
        if (sortBy === 'price-desc') return b.priceCents - a.priceCents;
        if (sortBy === 'rating') return b.rating - a.rating;
        // Featured: Smart Baskets -> Live RWA/Tokens -> Hardware/Merch by upvotes
        const score = (item: typeof a) =>
          (item.isBasket ? 10000 : item.isLiveAsset ? 5000 : 0) + item.upvotes;
        return score(b) - score(a);
      });
  }, [resolvedCatalog, selectedCategory, debouncedSearch, maxPrice, sortBy]);

  const cartTotalCents = cartLines.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const cartTotalItems = cartLines.reduce((sum, item) => sum + item.qty, 0);

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: resolvedCatalog.length,
      baskets: resolvedCatalog.filter((p) => p.normalizedCategory === 'baskets').length,
      liveAssets: resolvedCatalog.filter((p) => p.normalizedCategory === 'live-assets').length,
      hardware: resolvedCatalog.filter((p) => p.normalizedCategory === 'hardware').length,
      workspace: resolvedCatalog.filter((p) => p.normalizedCategory === 'workspace').length,
      essentials: resolvedCatalog.filter((p) => p.normalizedCategory === 'essentials').length,
    };
  }, [resolvedCatalog]);

  const getItemCartQty = (sku: string) => {
    const line = cartLines.find((c) => c.sku === sku);
    return line ? line.qty : 0;
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] flex flex-col justify-between selection:bg-[var(--gold)]/30 transition-colors duration-200">
      
      {/* Main Page Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 flex-1">
        
        {/* Header Hero Section (Exact Figma Screen 3) */}
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--gold)] font-semibold">
              THE NEXUSRAIL COLLECTION
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
              The onchain everyday.
            </h1>
            <p className="text-xs sm:text-sm text-[var(--muted)]">
              Considered essentials for a connected world. Explore the collection, from shelf to settlement.
            </p>
          </div>

          {/* Notice Container Card */}
          <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs text-[var(--foreground)]">
              <div className="w-5 h-5 rounded-md nexus-glass-card border border-[var(--border)] flex items-center justify-center text-[var(--gold)]">
                <Box className="w-3 h-3" />
              </div>
              <span>Live Smart Baskets &amp; RWA tokens auto-synced every 60s via CoinGecko, Binance &amp; $NXL AMM.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={syncLivePrices}
                disabled={catalogLoading || ratesLoading}
                className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wider text-emerald-300 hover:bg-emerald-500/25 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${(catalogLoading || ratesLoading) ? 'animate-spin' : ''}`} />
                <span>{catalogLoading ? 'SYNCING ORACLE...' : 'SYNC LIVE PRICES'}</span>
              </button>
              <span className="px-2.5 py-1 rounded-md bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[10px] font-mono font-bold tracking-wider text-[var(--gold)]">
                STELLAR TESTNET
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#0081F2]/15 border border-[#0081F2]/30 text-[10px] font-mono font-bold tracking-wider text-[#60A5FA]">
                XRPL TESTNET
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="text-xs font-mono text-[var(--muted)]">
            Collection / <span className="text-[var(--foreground)] font-medium">All products</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input with Debouncing & Clean Icon (Removed floating logo) */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the collection..."
                className="w-full h-10 pl-9 pr-8 rounded-xl nexus-glass-surface border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted)]/60 focus:outline-none focus:border-[var(--border-focus)] transition-colors shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  aria-label="Clear search"
                  title="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Perfectly Aligned Sort Dropdown with Matching Height & Custom Chevron */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort products"
                className="h-10 pl-3.5 pr-8 rounded-xl nexus-glass-surface border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--border-focus)] cursor-pointer appearance-none shadow-sm bg-transparent"
              >
                <option value="featured" className="bg-[var(--surface-solid)] text-[var(--foreground)]">Featured</option>
                <option value="price-asc" className="bg-[var(--surface-solid)] text-[var(--foreground)]">Price: Low to High</option>
                <option value="price-desc" className="bg-[var(--surface-solid)] text-[var(--foreground)]">Price: High to Low</option>
                <option value="rating" className="bg-[var(--surface-solid)] text-[var(--foreground)]">Highest Rated</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Two-Column Layout (Sidebar + 3x2 Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Sidebar (Categories & Price Range) */}
          <div className="lg:col-span-3 rounded-2xl nexus-glass-surface p-5 space-y-6 self-start shadow-lg">
            
            {/* Categories */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">
                CATEGORIES
              </div>

              <div className="space-y-1">
                {[
                  { id: 'all', label: 'All products', count: categoryCounts.all },
                  { id: 'baskets', label: 'Smart Baskets', count: categoryCounts.baskets },
                  { id: 'live-assets', label: 'Live RWA & Tokens', count: categoryCounts.liveAssets },
                  { id: 'hardware', label: 'Hardware', count: categoryCounts.hardware },
                  { id: 'workspace', label: 'Workspace', count: categoryCounts.workspace },
                  { id: 'essentials', label: 'Essentials', count: categoryCounts.essentials },
                ].map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id as CategoryFilter)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--gold)]/20 border border-[var(--gold)]/50 text-[var(--gold-bright)] font-bold'
                          : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className="text-[11px] opacity-70">{cat.count < 10 ? `0${cat.count}` : cat.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">
                Price range
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="600"
                  step="10"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full h-1 bg-[var(--card)] rounded-lg appearance-none cursor-pointer accent-[var(--gold)]"
                />
                <div className="flex justify-between text-xs font-mono text-[var(--muted)]">
                  <span>$0</span>
                  <span className="text-[var(--foreground)] font-bold">${maxPrice}</span>
                </div>
              </div>
            </div>

            {/* Info notice */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                All prices in USD. Pay with test XLM or XRP at checkout.
              </p>
              <Link
                href="/swap"
                className="inline-flex items-center gap-1 text-xs text-[var(--gold)] hover:underline font-mono font-semibold"
              >
                <span>Cross-chain swap bridge</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          {/* Right Area: 6 Products in a 3x2 Grid */}
          <div className="lg:col-span-9 space-y-4">
            
            {/* Header info */}
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--muted)]">
              <span>{filteredProducts.length < 10 ? `0${filteredProducts.length}` : filteredProducts.length} PRODUCTS</span>
              <span>NexusRail Live Catalog / 2026</span>
            </div>

            {/* Product & Basket Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredProducts.map((product) => {
                const qty = getItemCartQty(product.sku);
                const inCart = qty > 0;
                const isAdding = addingSku === product.sku;
                const imgSrc = PRODUCT_IMAGES[product.sku] || '/products/rail-one.png';
                const change24h = product.change24hPercent ?? 0;

                return (
                  <div
                    key={product.sku}
                    className={`flex flex-col justify-between rounded-2xl nexus-glass-card hover:border-[var(--gold)]/60 transition-all overflow-hidden group shadow-lg hover:shadow-2xl hover:-translate-y-1.5 duration-300 ${
                      product.isBasket ? 'ring-1 ring-[var(--gold)]/30' : ''
                    }`}
                  >
                    {/* Media Thumbnail with Live Oracle & In-Cart Badges */}
                    <div className="relative aspect-[16/10] w-full nexus-glass-surface overflow-hidden">
                      <Image
                        src={imgSrc}
                        alt={product.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />

                      {/* Top-Left In-Cart Badge */}
                      {inCart && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2.5 py-1 rounded-md bg-[var(--gold)]/20 border border-[var(--gold)]/40 text-[10px] font-mono font-bold tracking-wider text-[var(--gold-bright)] shadow-sm backdrop-blur-md">
                            IN YOUR CART &bull; {qty}
                          </span>
                        </div>
                      )}

                      {/* Top-Right Live Oracle + 24h Trend Badges */}
                      {product.isLiveAsset && (
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-black/75 border border-emerald-400/40 text-[10px] font-mono font-bold text-emerald-300 backdrop-blur-md inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>LIVE</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md bg-black/75 border text-[10px] font-mono font-bold backdrop-blur-md ${
                              change24h >= 0
                                ? 'border-emerald-400/30 text-emerald-300'
                                : 'border-rose-400/30 text-rose-300'
                            }`}
                          >
                            {change24h >= 0 ? '+' : ''}
                            {change24h.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        {/* Category Label */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">
                            {product.isBasket ? 'SMART BASKET' : product.isLiveAsset ? 'LIVE ORACLE' : product.category}
                          </span>
                          {product.oracleSource && (
                            <span className="text-[10px] font-mono uppercase text-[var(--gold)]">
                              {product.oracleSource}
                            </span>
                          )}
                        </div>

                        {/* Title and Live Price */}
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--gold)] transition-colors">
                            {product.title}
                          </h3>
                          <span className="text-sm font-mono font-bold text-[var(--gold)] shrink-0">
                            ${(product.priceCents / 100).toFixed(2)}
                          </span>
                        </div>

                        {product.priceInr && product.isLiveAsset && (
                          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--muted)]">
                            <span>≈ ₹{product.priceInr.toLocaleString('en-IN')} INR</span>
                            <span className="text-emerald-400">10% off w/ $NXL</span>
                          </div>
                        )}

                        {/* Description */}
                        <p className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>

                        {/* Composition Bar & Allocation Chips for Baskets / Live Assets */}
                        {product.allocations && product.allocations.length > 0 && (
                          <div className="pt-1.5 space-y-1.5">
                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex">
                              {product.allocations.map((alloc) => (
                                <div
                                  key={`${product.sku}-${alloc.symbol}`}
                                  className={ALLOCATION_COLORS[alloc.symbol] || 'bg-[var(--gold)]'}
                                  style={{ width: `${alloc.weightPercent ?? 100}%` }}
                                  title={`${alloc.label}: ${alloc.weightPercent ?? 100}%`}
                                />
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {product.allocations.map((alloc) => (
                                <span
                                  key={`${product.sku}-chip-${alloc.symbol}`}
                                  className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-[var(--muted)]"
                                >
                                  {alloc.unitQty} {alloc.symbol.replace('_G', 'g')} ({alloc.weightPercent ?? 100}%)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() => handleAdd(product.sku)}
                        disabled={isAdding}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
                          isAdding
                            ? 'bg-[var(--gold)] text-black'
                            : inCart
                            ? 'nexus-glass-surface hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-highlight)]'
                            : 'nexus-glass-surface hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-highlight)]'
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added</span>
                          </>
                        ) : inCart ? (
                          <span>Add another +</span>
                        ) : (
                          <span>Add to cart +</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Cart Bar (Exact Figma Screen 3) */}
      {cartTotalItems > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between px-5 py-3 rounded-2xl nexus-glass-surface border border-[var(--border)] shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-mono font-medium text-[var(--foreground)]">
                  Your next move is in the bag.
                </p>
                <p className="text-[11px] font-mono text-[var(--muted)]">
                  {cartTotalItems} {cartTotalItems === 1 ? 'item' : 'items'} &bull; Subtotal ${(cartTotalCents / 100).toFixed(2)} &bull; Network fee at checkout
                </p>
              </div>
            </div>

            <Link
              href="/cart"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-mono font-bold hover:bg-[var(--gold-bright)] transition-all shadow-md cursor-pointer"
            >
              <span>View cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
