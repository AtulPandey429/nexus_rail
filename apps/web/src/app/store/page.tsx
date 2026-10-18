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
import { NexusLogo } from '@/components/NexusLogo';

type CategoryFilter = 'all' | 'hardware' | 'workspace' | 'essentials';
type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating';

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
};

export default function StoreCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [maxPrice, setMaxPrice] = useState<number>(150);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [addingSku, setAddingSku] = useState<string | null>(null);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Dynamic API Catalog with 30-minute caching
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => {
    const cached = getCachedCatalog();
    return cached && cached.products.length > 0 ? cached.products : FIGMA_CATALOG;
  });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSource, setCatalogSource] = useState<'api' | 'cache' | 'fallback'>('cache');

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

  // Fetch product catalog from API (cached for 30m)
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
    return () => window.removeEventListener('nexus-catalog-updated', onCatalogUpdate);
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

  // 6 Primary Curated Products for Figma Screen 3
  const primarySix = useMemo(() => {
    const skus = ['RAIL-ONE', 'RELAY-MAT', 'NEXUS-TEE', 'NODE-STAND', 'SIGNAL-CAP', 'RAIL-CABLES'];
    return skus.map((sku) => {
      const found = catalog.find((p) => p.sku === sku);
      if (found) return found;
      return FIGMA_CATALOG.find((p) => p.sku === sku)!;
    }).filter(Boolean);
  }, [catalog]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return primarySix.filter((product) => {
      const matchesCategory =
        selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch =
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = (product.priceCents / 100) <= maxPrice;
      return matchesCategory && matchesSearch && matchesPrice;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.priceCents - b.priceCents;
      if (sortBy === 'price-desc') return b.priceCents - a.priceCents;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });
  }, [primarySix, selectedCategory, searchQuery, maxPrice, sortBy]);

  const cartTotalCents = cartLines.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const cartTotalItems = cartLines.reduce((sum, item) => sum + item.qty, 0);

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: primarySix.length,
      hardware: primarySix.filter((p) => p.category === 'hardware').length,
      workspace: primarySix.filter((p) => p.category === 'workspace').length,
      essentials: primarySix.filter((p) => p.category === 'essentials').length,
    };
  }, [primarySix]);

  const getItemCartQty = (sku: string) => {
    const line = cartLines.find((c) => c.sku === sku);
    return line ? line.qty : 0;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] text-slate-900 dark:text-white flex flex-col justify-between selection:bg-rail-emerald/30 transition-colors duration-200">
      
      {/* Main Page Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 flex-1">
        
        {/* Header Hero Section (Exact Figma Screen 3) */}
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500 dark:text-[#8A93A6] font-semibold">
              THE NEXUSRAIL COLLECTION
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              The onchain everyday.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#8A93A6]">
              Considered essentials for a connected world. Explore the demo, from shelf to settlement.
            </p>
          </div>

          {/* Notice Container Card */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-[#161D2B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#C5CEE0]">
              <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-[#101724] border border-slate-300 dark:border-[#1C2638] flex items-center justify-center text-rail-emerald">
                <Box className="w-3 h-3" />
              </div>
              <span>Real design. Illustrative products. Testnet checkout.</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#00E5A3]/10 border border-[#00E5A3]/30 text-[10px] font-mono font-bold tracking-wider text-[#00E5A3]">
                STELLAR TESTNET
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[10px] font-mono font-bold tracking-wider text-[#38BDF8]">
                XRPL TESTNET
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="text-xs font-mono text-slate-500 dark:text-[#8A93A6]">
            Collection / <span className="text-slate-900 dark:text-white font-medium">All products</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <NexusLogo size="xs" glow className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none rounded shadow-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the collection"
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1C2638] text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#5A6478] focus:outline-none focus:border-rail-emerald transition-colors shadow-sm"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort products"
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1C2638] text-xs font-mono text-slate-900 dark:text-white focus:outline-none cursor-pointer appearance-none pr-7 shadow-sm"
              >
                <option value="featured" className="bg-white dark:bg-[#0B0F17]">Featured</option>
                <option value="price-asc" className="bg-white dark:bg-[#0B0F17]">Price: Low to High</option>
                <option value="price-desc" className="bg-white dark:bg-[#0B0F17]">Price: High to Low</option>
                <option value="rating" className="bg-white dark:bg-[#0B0F17]">Highest Rated</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-slate-400 dark:text-[#5A6478]">
                ▾
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Layout (Sidebar + 3x2 Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Sidebar (Categories & Price Range) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Categories */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6478] font-bold">
                CATEGORIES
              </div>

              <div className="space-y-1">
                {[
                  { id: 'all', label: 'All products', count: categoryCounts.all },
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
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-[#00E5A3]/10 border border-[#00E5A3]/30 text-white font-semibold'
                          : 'text-[#8A93A6] hover:text-white hover:bg-[#0E131E]'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className="text-[11px] opacity-70">0{cat.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-3 pt-2 border-t border-[#161D2B]">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6478] font-bold">
                Price range
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full h-1 bg-[#161D2B] rounded-lg appearance-none cursor-pointer accent-rail-emerald"
                />
                <div className="flex justify-between text-xs font-mono text-[#8A93A6]">
                  <span>$0</span>
                  <span className="text-white">${maxPrice}</span>
                </div>
              </div>
            </div>

            {/* Info notice */}
            <div className="space-y-2 pt-2 border-t border-[#161D2B]">
              <p className="text-xs text-[#8A93A6] leading-relaxed">
                All prices in USD. Pay with test XLM or XRP at checkout.
              </p>
              <Link
                href="/app/guide"
                className="inline-flex items-center gap-1 text-xs text-rail-emerald hover:underline font-mono"
              >
                <span>How testnet payments work</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          {/* Right Area: 6 Products in a 3x2 Grid */}
          <div className="lg:col-span-9 space-y-4">
            
            {/* Header info */}
            <div className="flex items-center justify-between text-[11px] font-mono text-[#5A6478]">
              <span>0{filteredProducts.length} PRODUCTS</span>
              <span>Demo collection / 2026</span>
            </div>

            {/* 3x2 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredProducts.map((product) => {
                const qty = getItemCartQty(product.sku);
                const inCart = qty > 0;
                const isAdding = addingSku === product.sku;
                const imgSrc = PRODUCT_IMAGES[product.sku] || '/products/rail-one.png';

                return (
                  <div
                    key={product.sku}
                    className="flex flex-col justify-between rounded-2xl bg-white dark:bg-[#090D14] border border-slate-200 dark:border-[#161D2B] hover:border-rail-emerald/60 dark:hover:border-rail-emerald/60 transition-all overflow-hidden group shadow-sm hover:shadow-xl hover:-translate-y-1.5 duration-300"
                  >
                    {/* Media Thumbnail with exact Figma badge */}
                    <div className="relative aspect-[16/10] w-full bg-slate-100 dark:bg-[#05070A] overflow-hidden">
                      <Image
                        src={imgSrc}
                        alt={product.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />

                      {/* Top-Left In-Cart Badge (Matching Figma Screen 3) */}
                      {inCart && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2.5 py-1 rounded-md bg-[#00E5A3]/20 border border-[#00E5A3]/40 text-[10px] font-mono font-bold tracking-wider text-emerald-700 dark:text-[#00E5A3] shadow-sm backdrop-blur-md">
                            IN YOUR CART &bull; {qty}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Category Label */}
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-[#5A6478] font-bold">
                          {product.category}
                        </span>

                        {/* Title and Price */}
                        <div className="flex items-baseline justify-between gap-2 mt-1">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rail-emerald transition-colors">
                            {product.title}
                          </h3>
                          <span className="text-sm font-mono font-bold text-slate-900 dark:text-white shrink-0">
                            ${(product.priceCents / 100).toFixed(2)}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="mt-1 text-xs text-slate-500 dark:text-[#8A93A6] line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() => handleAdd(product.sku)}
                        disabled={isAdding}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                          isAdding
                            ? 'bg-rail-emerald text-[#05070A]'
                            : inCart
                            ? 'bg-slate-100 dark:bg-[#0E131E] hover:bg-slate-200 dark:hover:bg-[#141B2B] border border-slate-300 dark:border-[#1C2638] text-slate-900 dark:text-white hover:border-rail-emerald/50'
                            : 'bg-slate-100 dark:bg-[#0E131E] hover:bg-slate-200 dark:hover:bg-[#141B2B] border border-slate-300 dark:border-[#1C2638] text-slate-900 dark:text-white hover:border-rail-emerald/50'
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
          <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-[#090D14]/95 border border-[#161D2B] shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00E5A3]/10 border border-[#00E5A3]/30 flex items-center justify-center text-rail-emerald">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-mono font-medium text-white">
                  Your next move is in the bag.
                </p>
                <p className="text-[11px] font-mono text-[#8A93A6]">
                  {cartTotalItems} {cartTotalItems === 1 ? 'item' : 'items'} &bull; Subtotal ${(cartTotalCents / 100).toFixed(2)} &bull; Network fee at checkout
                </p>
              </div>
            </div>

            <Link
              href="/app/cart"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rail-emerald text-[#05070A] text-xs font-mono font-bold hover:bg-rail-mint transition-all shadow-md"
            >
              <span>View cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <footer className="h-12 border-t border-[#151921] px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#5A6478] bg-[#05070A] mt-12">
        <div>&copy; 2026 NexusRail &bull; Demo environment</div>
        <div className="hidden md:block">Test assets only. No real funds or fulfillment.</div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rail-emerald animate-pulse" />
          <span>Systems operational</span>
        </div>
      </footer>
    </div>
  );
}
