'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Search,
  Filter,
  Check,
  Star,
  Layers,
  Cpu,
  Monitor,
  Shirt,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Wallet,
  Zap,
  ShieldCheck,
  Radio,
  ExternalLink,
  RefreshCw,
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

type CategoryFilter = 'all' | 'hardware' | 'workspace' | 'essentials';
type RailFilter = 'all' | 'stellar' | 'xrpl';
type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating';

export default function StoreCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [userRail, setUserRail] = useState<'stellar' | 'xrpl' | null>(null);
  const [activeRailPreference, setActiveRailPreference] = useState<RailFilter>('all');
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
  const { xlmUsd, xrpUsd, source, fromCache, ttlMinutes, refreshRates, loading: ratesLoading } = useLiveExchangeRates();

  useEffect(() => {
    const syncUser = () => {
      const sess = readSession();
      setUser(sess.user);
      if (sess.user?.walletAddress) {
        if (sess.user.walletAddress.startsWith('G')) {
          setUserRail('stellar');
        } else if (sess.user.walletAddress.startsWith('r')) {
          setUserRail('xrpl');
        }
      } else if (sess.user?.email) {
        if (sess.user.email.includes('stellar') || sess.user.email.includes('freighter')) {
          setUserRail('stellar');
        } else if (sess.user.email.includes('xrpl') || sess.user.email.includes('xrp') || sess.user.email.includes('xaman')) {
          setUserRail('xrpl');
        }
      }
    };

    syncUser();
    return onSessionChange(syncUser);
  }, []);

  // Fetch product catalog from API (cached for 30m)
  useEffect(() => {
    fetchCatalog().then((items) => {
      setCatalog(items);
      const updated = getCachedCatalog();
      if (updated) setCatalogSource(updated.source);
    }).catch(() => {});

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

  const handleRefreshAll = async () => {
    setCatalogLoading(true);
    try {
      await refreshRates();
      const freshProducts = await fetchCatalog(true);
      setCatalog(freshProducts);
      setCatalogSource('api');
    } catch {
      // quiet fallback
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleAdd = async (sku: string) => {
    setAddingSku(sku);
    try {
      await addSkuToCart(sku);
      const updated = await fetchCartLines();
      setCartLines(updated);
    } catch {
      // quiet fallback
    } finally {
      setTimeout(() => setAddingSku(null), 800);
    }
  };

  // Filter products by category and search (Dynamic API Products)
  const filteredProducts = useMemo(() => {
    return catalog.filter((product) => {
      const matchesCategory =
        selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch =
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.tag.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.priceCents - b.priceCents;
      if (sortBy === 'price-desc') return b.priceCents - a.priceCents;
      if (sortBy === 'rating') return b.rating - a.rating;
      return b.upvotes - a.upvotes;
    });
  }, [catalog, selectedCategory, searchQuery, sortBy]);

  // Section division
  const stellarProducts = filteredProducts.filter((p) => p.rail === 'stellar');
  const xrplProducts = filteredProducts.filter((p) => p.rail === 'xrpl');
  const crossRailProducts = filteredProducts.filter((p) => p.rail === 'multi');

  const cartTotalCents = cartLines.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const cartTotalItems = cartLines.reduce((sum, item) => sum + item.qty, 0);

  const getProductIcon = (sku: string) => {
    switch (sku) {
      case 'RAIL-ONE':
      case 'PROD-LEDGER-COLD':
        return <Cpu className="w-10 h-10 text-rail-emerald" />;
      case 'PROD-XRP-KIT':
        return <Zap className="w-10 h-10 text-xrpl-blue" />;
      case 'PROD-XLM-PASS':
        return <Layers className="w-10 h-10 text-stellar-cyan" />;
      case 'PROD-AGENT-PRO':
        return <Sparkles className="w-10 h-10 text-cyber-purple" />;
      case 'RELAY-MAT':
        return <Monitor className="w-10 h-10 text-xrpl-blue" />;
      case 'NEXUS-TEE':
        return <Shirt className="w-10 h-10 text-white" />;
      case 'NODE-STAND':
        return <Layers className="w-10 h-10 text-stellar-cyan" />;
      case 'SIGNAL-CAP':
        return <Sparkles className="w-10 h-10 text-amber-400" />;
      case 'RAIL-CABLES':
        return <Cpu className="w-10 h-10 text-emerald-400" />;
      default:
        return <Cpu className="w-10 h-10 text-gray-400" />;
    }
  };

  // Helper to render product card
  const renderProductCard = (product: CatalogItem) => {
    const isAdding = addingSku === product.sku;
    const usdPrice = (product.priceCents / 100).toFixed(2);
    const xlmEquivalent = (Number(usdPrice) / (xlmUsd || 0.1778)).toFixed(2);
    const xrpEquivalent = (Number(usdPrice) / (xrpUsd || 1.2972)).toFixed(2);

    return (
      <div
        key={product.sku}
        className="group relative flex flex-col justify-between rounded-2xl bg-nexus-card/90 border border-nexus-border hover:border-nexus-border/80 transition-all duration-300 hover:shadow-xl hover:shadow-rail-emerald/5 overflow-hidden"
      >
        {/* Top Media / Thumbnail Block */}
        <div className="relative p-7 flex items-center justify-center bg-gradient-to-b from-nexus-surface/80 to-nexus-card min-h-[190px] border-b border-nexus-border/60">
          <div className="absolute inset-0 bg-radial from-white/[0.03] to-transparent pointer-events-none" />
          
          {/* Tag */}
          <div className="absolute top-4 left-4">
            <span className={`px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold tracking-wider uppercase ${
              product.rail === 'stellar'
                ? 'bg-stellar-cyan/10 border-stellar-cyan/30 text-stellar-cyan'
                : product.rail === 'xrpl'
                ? 'bg-xrpl-blue/10 border-xrpl-blue/30 text-xrpl-blue'
                : 'bg-nexus-dark/80 border-nexus-border text-nexus-muted'
            }`}>
              {product.rail === 'stellar' ? '* Stellar' : product.rail === 'xrpl' ? 'X XRPL' : 'Multi-Rail'}
            </span>
          </div>

          {/* Rating Badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded bg-nexus-dark/60 text-[11px] font-mono text-amber-400 border border-nexus-border/40">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{product.rating}</span>
          </div>

          {/* Icon Avatar */}
          <div className="transform transition-transform duration-300 group-hover:scale-110">
            {getProductIcon(product.sku)}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-white group-hover:text-rail-emerald transition-colors">
                {product.title}
              </h3>
              <span className="text-[11px] font-mono text-nexus-muted">
                {product.sku}
              </span>
            </div>

            <p className="mt-2 text-xs text-nexus-muted leading-relaxed line-clamp-2">
              {product.description}
            </p>
          </div>

          {/* Price & Action Row */}
          <div className="pt-3 border-t border-nexus-border/60 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-mono font-extrabold text-white">
                  ${usdPrice}
                </span>
                <span className="text-[10px] font-mono text-nexus-muted">USD</span>
              </div>
              <span className="text-[10px] font-mono block text-nexus-muted">
                {product.rail === 'stellar' || activeRailPreference === 'stellar'
                  ? `~${xlmEquivalent} XLM`
                  : product.rail === 'xrpl' || activeRailPreference === 'xrpl'
                  ? `~${xrpEquivalent} XRP`
                  : `~${xlmEquivalent} XLM / ~${xrpEquivalent} XRP`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleAdd(product.sku)}
              disabled={isAdding}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isAdding
                  ? 'bg-rail-emerald text-nexus-dark'
                  : 'bg-white text-nexus-dark hover:bg-rail-emerald hover:text-nexus-dark shadow-sm'
              }`}
            >
              {isAdding ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add to bag</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStellarSection = () => (
    <section key="sec-stellar" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stellar-cyan/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-stellar-cyan/20 border border-stellar-cyan/40 flex items-center justify-center text-stellar-cyan font-bold text-xs">
            *
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Stellar Soroban Ecosystem</span>
              <span className="text-xs font-mono text-stellar-cyan bg-stellar-cyan/10 px-2 py-0.5 rounded border border-stellar-cyan/30">
                {stellarProducts.length} items
              </span>
            </h2>
            <p className="text-xs font-mono text-nexus-muted">
              Hardware signers, Soroban smart contract deploy passes, and AI telemetry keys &bull; ~3.2s finality
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-stellar-cyan self-start sm:self-auto">
          <span>Live Rate: 1 XLM &asymp; ${xlmUsd.toFixed(4)} USD</span>
          <span className="text-[10px] text-nexus-muted bg-stellar-cyan/10 px-1.5 py-0.5 rounded border border-stellar-cyan/20">
            {fromCache ? `cached (${ttlMinutes}m)` : source}
          </span>
        </div>
      </div>

      {stellarProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stellarProducts.map(renderProductCard)}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-nexus-surface/50 border border-nexus-border text-center text-xs font-mono text-nexus-muted">
          No Stellar products match your current search criteria.
        </div>
      )}
    </section>
  );

  const renderXrplSection = () => (
    <section key="sec-xrpl" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-xrpl-blue/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-xrpl-blue/20 border border-xrpl-blue/40 flex items-center justify-center text-xrpl-blue font-bold text-xs">
            X
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>XRPL Consensus Ecosystem</span>
              <span className="text-xs font-mono text-xrpl-blue bg-xrpl-blue/10 px-2 py-0.5 rounded border border-xrpl-blue/30">
                {xrplProducts.length} items
              </span>
            </h2>
            <p className="text-xs font-mono text-nexus-muted">
              Turnkey validator nodes, cold HSM hardware modules, and micro-weave ripple mats &bull; ~3.5s consensus
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-xrpl-blue self-start sm:self-auto">
          <span>Live Rate: 1 XRP &asymp; ${xrpUsd.toFixed(4)} USD</span>
          <span className="text-[10px] text-nexus-muted bg-xrpl-blue/10 px-1.5 py-0.5 rounded border border-xrpl-blue/20">
            {fromCache ? `cached (${ttlMinutes}m)` : source}
          </span>
        </div>
      </div>

      {xrplProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {xrplProducts.map(renderProductCard)}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-nexus-surface/50 border border-nexus-border text-center text-xs font-mono text-nexus-muted">
          No XRPL products match your current search criteria.
        </div>
      )}
    </section>
  );

  const renderCrossRailSection = () => (
    <section key="sec-multi" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-nexus-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-xs">
            &infin;
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Cross-Rail Essentials & Apparel</span>
              <span className="text-xs font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded border border-white/20">
                {crossRailProducts.length} items
              </span>
            </h2>
            <p className="text-xs font-mono text-nexus-muted">
              Everyday heavyweight apparel and low-profile gear built for multi-chain living
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-nexus-muted self-start sm:self-auto">
          Accepts XLM &bull; XRP &bull; Stripe Card
        </div>
      </div>

      {crossRailProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {crossRailProducts.map(renderProductCard)}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-nexus-surface/50 border border-nexus-border text-center text-xs font-mono text-nexus-muted">
          No everyday essentials match your search criteria.
        </div>
      )}
    </section>
  );

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-nexus-border pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-surface border border-nexus-border text-[11px] font-mono uppercase tracking-widest text-rail-emerald mb-4">
              <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
              Onchain Storefront &bull; Multi-Rail Sectional Catalog
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              The onchain everyday.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-nexus-muted max-w-2xl leading-relaxed">
              Section-wise discovery across Stellar Soroban, XRPL Consensus, and cross-rail hardware objects.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/app/cart"
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-nexus-card border border-nexus-border hover:border-rail-emerald/50 text-white text-xs font-mono font-medium transition-colors"
            >
              <ShoppingBag className="w-4 h-4 text-rail-emerald" />
              <span>Bag ({cartTotalItems})</span>
              <span className="text-nexus-muted">|</span>
              <span className="text-rail-emerald font-semibold">${(cartTotalCents / 100).toFixed(2)}</span>
            </Link>
          </div>
        </div>

        {/* User Connected Asset Banner (Dynamic by Login) */}
        {(() => {
          const displayRail = activeRailPreference !== 'all' ? activeRailPreference : (userRail || 'all');
          return (
            <div className="p-4 sm:p-5 rounded-2xl bg-nexus-card border border-nexus-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                  displayRail === 'stellar'
                    ? 'bg-stellar-cyan/15 text-stellar-cyan border border-stellar-cyan/40'
                    : displayRail === 'xrpl'
                    ? 'bg-xrpl-blue/15 text-xrpl-blue border border-xrpl-blue/40'
                    : 'bg-rail-emerald/15 text-rail-emerald border border-rail-emerald/40'
                }`}>
                  {displayRail === 'stellar' ? '*' : displayRail === 'xrpl' ? 'X' : <Wallet className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase font-bold text-white">
                      {displayRail === 'stellar'
                        ? 'Connected Asset: Stellar Testnet (XLM)'
                        : displayRail === 'xrpl'
                        ? 'Connected Asset: XRPL Testnet (XRP)'
                        : 'Universal Multi-Rail View (All Ecosystems)'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
                  </div>

                  <p className="text-xs font-mono text-nexus-muted mt-0.5">
                    {user?.walletAddress ? (
                      <span>Wallet: <code className="text-white">{user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}</code></span>
                    ) : user?.email ? (
                      <span>Account: <span className="text-white">{user.email}</span></span>
                    ) : (
                      <span>Browsing as Guest &bull; Switch below to preview network pricing</span>
                    )}
                    <span className="mx-2 text-nexus-border">&bull;</span>
                    <span className="text-rail-emerald font-bold">
                      {displayRail === 'stellar'
                        ? `1,420.00 XLM Available (~$${(1420 * xlmUsd).toFixed(2)} USD)`
                        : displayRail === 'xrpl'
                        ? `850.00 XRP Available (~$${(850 * xrpUsd).toFixed(2)} USD)`
                        : `Dual-Rail Active • XLM: $${xlmUsd.toFixed(4)} | XRP: $${xrpUsd.toFixed(4)}`}
                    </span>
                    <span className="mx-2 text-nexus-border">&bull;</span>
                    <span className="text-[11px] font-mono text-nexus-muted">
                      Catalog: <span className="text-rail-emerald uppercase">{catalogSource}</span> (30m cache)
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick Ecosystem Switcher Pills */}
              <div className="flex items-center gap-2 self-stretch md:self-auto overflow-x-auto pb-1 md:pb-0">
                <span className="text-[11px] font-mono text-nexus-muted uppercase mr-1">Switch View:</span>
                <button
                  type="button"
                  onClick={() => setActiveRailPreference('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                    activeRailPreference === 'all'
                      ? 'bg-nexus-surface text-white border-rail-emerald font-bold'
                      : 'bg-nexus-surface/50 text-nexus-muted border-nexus-border hover:text-white'
                  }`}
                >
                  All ({catalog.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRailPreference('stellar')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                    activeRailPreference === 'stellar'
                      ? 'bg-stellar-cyan/15 text-stellar-cyan border-stellar-cyan font-bold'
                      : 'bg-nexus-surface/50 text-nexus-muted border-nexus-border hover:text-white'
                  }`}
                >
                  * Stellar ({catalog.filter((p) => p.rail === 'stellar').length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRailPreference('xrpl')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                    activeRailPreference === 'xrpl'
                      ? 'bg-xrpl-blue/15 text-xrpl-blue border-xrpl-blue font-bold'
                      : 'bg-nexus-surface/50 text-nexus-muted border-nexus-border hover:text-white'
                  }`}
                >
                  X XRPL ({catalog.filter((p) => p.rail === 'xrpl').length})
                </button>

                <button
                  type="button"
                  onClick={handleRefreshAll}
                  title="Force refresh live rates & catalog from API"
                  className="px-2.5 py-1.5 rounded-xl bg-nexus-surface/50 border border-nexus-border hover:border-rail-emerald/60 text-nexus-muted hover:text-white transition-all ml-1 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ratesLoading || catalogLoading ? 'animate-spin text-rail-emerald' : ''}`} />
                  <span className="text-[10px] font-mono hidden sm:inline">Refresh API</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Central Search Bar & Category Controls */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-nexus-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across Stellar Soroban passes, XRPL validator kits, hardware signers..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-nexus-card border border-nexus-border text-sm text-white placeholder-nexus-muted focus:outline-none focus:border-rail-emerald/70 font-mono shadow-inner transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-nexus-muted hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sub-Filters: Categories & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: 'all', label: 'All types' },
                { id: 'hardware', label: 'Hardware' },
                { id: 'workspace', label: 'Workspace & Passes' },
                { id: 'essentials', label: 'Everyday Essentials' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as CategoryFilter)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all border ${
                    selectedCategory === cat.id
                      ? 'bg-nexus-card text-rail-emerald border-rail-emerald/60 shadow-sm font-bold'
                      : 'bg-nexus-surface/60 text-nexus-muted border-nexus-border hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-surface border border-nexus-border text-xs font-mono text-nexus-muted self-end sm:self-auto">
              <SlidersHorizontal className="w-3.5 h-3.5 text-rail-emerald" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort catalog by"
                className="bg-transparent text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="featured" className="bg-nexus-card text-white">Featured</option>
                <option value="price-asc" className="bg-nexus-card text-white">Price: Low to High</option>
                <option value="price-desc" className="bg-nexus-card text-white">Price: High to Low</option>
                <option value="rating" className="bg-nexus-card text-white">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION-WISE PRODUCT DISPLAY (Dynamic Rail Prioritization) */}
        <div className="space-y-12">
          {activeRailPreference === 'stellar' ? (
            renderStellarSection()
          ) : activeRailPreference === 'xrpl' ? (
            renderXrplSection()
          ) : userRail === 'xrpl' ? (
            <>
              {renderXrplSection()}
              {renderStellarSection()}
              {renderCrossRailSection()}
            </>
          ) : (
            <>
              {renderStellarSection()}
              {renderXrplSection()}
              {renderCrossRailSection()}
            </>
          )}
        </div>

        {/* Floating Bottom Cart Bar */}
        {cartTotalItems > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl">
            <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl bg-nexus-dark/95 border border-rail-emerald/60 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rail-emerald/10 border border-rail-emerald/30 flex items-center justify-center text-rail-emerald">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-mono font-medium text-white">
                    Your next move is in the bag.
                  </p>
                  <p className="text-[11px] font-mono text-nexus-muted">
                    {cartTotalItems} {cartTotalItems === 1 ? 'item' : 'items'} &bull; ${(cartTotalCents / 100).toFixed(2)} total
                  </p>
                </div>
              </div>

              <Link
                href="/app/cart"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rail-emerald text-nexus-dark text-xs font-mono font-bold hover:brightness-110 transition-all shadow-md"
              >
                <span>View cart</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
