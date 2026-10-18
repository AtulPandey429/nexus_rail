'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { FIGMA_CATALOG, addSkuToCart, fetchCartLines, CartLine } from '@/lib/shop';

type CategoryFilter = 'all' | 'hardware' | 'workspace' | 'essentials';
type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating';

export default function StoreCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [addingSku, setAddingSku] = useState<string | null>(null);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);

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
      setTimeout(() => setAddingSku(null), 800);
    }
  };

  const filteredProducts = FIGMA_CATALOG.filter((product) => {
    const matchesCategory =
      selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch =
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.priceCents - b.priceCents;
    if (sortBy === 'price-desc') return b.priceCents - a.priceCents;
    if (sortBy === 'rating') return b.rating - a.rating;
    return b.upvotes - a.upvotes;
  });

  const cartTotalCents = cartLines.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const cartTotalItems = cartLines.reduce((sum, item) => sum + item.qty, 0);

  const getProductIcon = (sku: string) => {
    switch (sku) {
      case 'RAIL-ONE':
        return <Cpu className="w-10 h-10 text-rail-emerald" />;
      case 'RELAY-MAT':
        return <Monitor className="w-10 h-10 text-stellar-cyan" />;
      case 'NEXUS-TEE':
        return <Shirt className="w-10 h-10 text-xrpl-blue" />;
      case 'NODE-STAND':
        return <Layers className="w-10 h-10 text-cyber-purple" />;
      case 'SIGNAL-CAP':
        return <Sparkles className="w-10 h-10 text-amber-400" />;
      case 'RAIL-CABLES':
        return <Cpu className="w-10 h-10 text-emerald-400" />;
      default:
        return <Cpu className="w-10 h-10 text-gray-400" />;
    }
  };

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      {/* Background Subtle Figma Grid */}
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-nexus-border pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-surface border border-nexus-border text-[11px] font-mono uppercase tracking-widest text-rail-emerald mb-4">
              <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
              Onchain Storefront &bull; Series 01
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              The onchain everyday.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-nexus-muted max-w-2xl leading-relaxed">
              Hardware signers, workspace essentials, and physical objects designed for seamless multi-rail commerce.
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

        {/* Filter Bar & Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Categories Pill Nav */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All products', count: 6 },
              { id: 'hardware', label: 'Hardware', count: 3 },
              { id: 'workspace', label: 'Workspace', count: 1 },
              { id: 'essentials', label: 'Essentials', count: 2 },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as CategoryFilter)}
                className={`px-4 py-2 rounded-xl text-xs font-mono whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-nexus-card text-rail-emerald border-rail-emerald/60 shadow-sm'
                    : 'bg-nexus-surface/60 text-nexus-muted border-nexus-border hover:text-white hover:border-nexus-muted/40'
                }`}
              >
                {cat.label} <span className="opacity-60 text-[10px]">({cat.count})</span>
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-nexus-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-xs text-white placeholder-nexus-muted focus:outline-none focus:border-rail-emerald/60 font-mono transition-colors"
              />
            </div>

            {/* Sort Select */}
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-xs font-mono text-nexus-muted">
                <SlidersHorizontal className="w-3.5 h-3.5 text-rail-emerald" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort products by"
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
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const isAdding = addingSku === product.sku;
            return (
              <div
                key={product.sku}
                className="group relative flex flex-col justify-between rounded-2xl bg-nexus-card/90 border border-nexus-border hover:border-nexus-border/80 transition-all duration-300 hover:shadow-xl hover:shadow-rail-emerald/5 overflow-hidden"
              >
                {/* Top Media / Thumbnail Block */}
                <div className="relative p-8 flex items-center justify-center bg-gradient-to-b from-nexus-surface/80 to-nexus-card min-h-[200px] border-b border-nexus-border/60">
                  {/* Subtle Glow */}
                  <div className="absolute inset-0 bg-radial from-white/[0.03] to-transparent pointer-events-none" />
                  
                  {/* Category Tag */}
                  <div className="absolute top-4 left-4">
                    <span className="px-2.5 py-1 rounded-md bg-nexus-dark/80 border border-nexus-border text-[10px] font-mono font-medium tracking-wider text-nexus-muted uppercase">
                      {product.tag}
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
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold text-white group-hover:text-rail-emerald transition-colors">
                        {product.title}
                      </h3>
                      <span className="text-xs font-mono text-nexus-muted">
                        {product.sku}
                      </span>
                    </div>

                    <p className="mt-2 text-xs sm:text-sm text-nexus-muted leading-relaxed line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  {/* Price & Action Row */}
                  <div className="pt-4 border-t border-nexus-border/60 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-nexus-muted block">
                        Price (USD)
                      </span>
                      <span className="text-xl font-mono font-extrabold text-white">
                        ${(product.priceCents / 100).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAdd(product.sku)}
                      disabled={isAdding}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
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
          })}
        </div>

        {/* Empty Search State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16 p-8 rounded-2xl bg-nexus-card border border-nexus-border">
            <Filter className="w-10 h-10 text-nexus-muted mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No products found</h3>
            <p className="text-xs text-nexus-muted mt-1">Try clearing your search or switching categories.</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-xs font-mono text-rail-emerald hover:border-rail-emerald"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Bottom Feature Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-nexus-surface via-nexus-card to-nexus-surface border border-nexus-border p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rail-emerald text-xs font-mono uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Zero-Intermediary Settlement</span>
            </div>
            <h4 className="text-lg font-bold text-white">
              Want custom developer hardware or validator nodes?
            </h4>
            <p className="text-xs text-nexus-muted max-w-xl">
              All physical orders include onchain receipt anchors, verifiable IPFS packing manifests, and instantaneous multi-rail quote guarantees.
            </p>
          </div>

          <Link
            href="/app/checkout"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-rail-emerald text-nexus-dark font-mono text-xs font-bold hover:brightness-110 transition-all whitespace-nowrap"
          >
            <span>Proceed to multi-rail checkout</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Floating Bottom Cart Bar (Appears when items are in cart) */}
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
  );
}
