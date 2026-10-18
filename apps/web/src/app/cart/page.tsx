'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  ExternalLink,
  Check,
} from 'lucide-react';
import {
  CartLine,
  createOrderFromCart,
  fetchCartLines,
  removeCartSku,
  setCartQty,
  addSkuToCart,
  readSession,
  SessionUser,
  onSessionChange,
} from '@/lib/shop';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'NODE-STAND': '/products/node-stand.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
  'RAIL-CABLES': '/products/rail-cables.png',
};

// Default Figma Screen 4 items for demo initialization
const FIGMA_DEFAULT_ITEMS: Array<{ sku: string; title: string; category: string; variant: string; priceCents: number; qty: number }> = [
  {
    sku: 'RAIL-ONE',
    title: 'Rail One',
    category: 'HARDWARE',
    variant: 'Graphite · USB-C',
    priceCents: 12900,
    qty: 1,
  },
  {
    sku: 'RELAY-MAT',
    title: 'Relay desk mat',
    category: 'WORKSPACE',
    variant: 'Charcoal · 80 × 40 cm',
    priceCents: 3900,
    qty: 1,
  },
  {
    sku: 'NEXUS-TEE',
    title: 'Nexus tee',
    category: 'ESSENTIALS',
    variant: 'Washed black · Size M',
    priceCents: 3200,
    qty: 1,
  },
];

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');

  // Synchronize session user
  useEffect(() => {
    const sync = () => setUser(readSession().user);
    sync();
    return onSessionChange(sync);
  }, []);

  // Load cart lines or initialize with Figma demo essentials if empty
  const loadCart = async () => {
    try {
      const lines = await fetchCartLines();
      if (lines.length > 0) {
        setItems(lines);
      } else {
        // Initialize with default Figma demo essentials so user experiences the exact reference state
        for (const def of FIGMA_DEFAULT_ITEMS) {
          await setCartQty(def.sku, def.qty);
        }
        const initialized = await fetchCartLines();
        setItems(initialized.length > 0 ? initialized : (FIGMA_DEFAULT_ITEMS.map((d) => ({
          sku: d.sku,
          title: d.title,
          description: d.variant,
          priceCents: d.priceCents,
          qty: d.qty,
          priced: true,
        })) as CartLine[]));
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch cart items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
    const handleCartSync = () => {
      fetchCartLines().then(setItems).catch(() => {});
    };
    window.addEventListener('nexus-cart', handleCartSync);
    return () => window.removeEventListener('nexus-cart', handleCartSync);
  }, []);

  // Update item quantity
  const handleQtyChange = async (sku: string, newQty: number) => {
    setError('');
    try {
      if (newQty <= 0) {
        await removeCartSku(sku);
      } else {
        await setCartQty(sku, newQty);
      }
      const updated = await fetchCartLines();
      setItems(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update quantity');
    }
  };

  // Remove single line item
  const handleRemove = async (sku: string) => {
    setError('');
    try {
      await removeCartSku(sku);
      const updated = await fetchCartLines();
      setItems(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove item');
    }
  };

  // Promo code validation
  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'NEXUS10' || code === 'STELLAR' || code === 'XRPL') {
      setAppliedPromo(code);
      setPromoError('');
    } else {
      setPromoError('Invalid code. Try "NEXUS10" for 10% off.');
    }
  };

  // Subtotal and discount math
  const subtotalCents = useMemo(() => {
    return items.reduce((acc, item) => acc + item.priceCents * item.qty, 0);
  }, [items]);

  const discountCents = useMemo(() => {
    if (!appliedPromo) return 0;
    return Math.round(subtotalCents * 0.1); // 10% discount
  }, [appliedPromo, subtotalCents]);

  const totalCents = Math.max(0, subtotalCents - discountCents);
  const totalItemCount = items.reduce((acc, i) => acc + i.qty, 0);

  // Navigate to checkout
  const handleProceedToCheckout = async () => {
    setBusy(true);
    setError('');
    try {
      const order = await createOrderFromCart(items, 'MULTI');
      const orderTitle = items.map((i) => i.title).join(', ');
      router.push(`/checkout?orderId=${encodeURIComponent(order.id)}&title=${encodeURIComponent(orderTitle)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initiate checkout');
      setBusy(false);
    }
  };

  // Variant metadata helper
  const getItemDetails = (sku: string, title: string) => {
    const known = FIGMA_DEFAULT_ITEMS.find((d) => d.sku === sku);
    if (known) return { category: known.category, variant: known.variant };
    if (sku.includes('MAT')) return { category: 'WORKSPACE', variant: 'Charcoal · 80 × 40 cm' };
    if (sku.includes('TEE')) return { category: 'ESSENTIALS', variant: 'Washed black · Size M' };
    if (sku.includes('STAND')) return { category: 'WORKSPACE', variant: 'Anodized aluminum' };
    if (sku.includes('CAP')) return { category: 'ESSENTIALS', variant: 'Structured 6-panel' };
    if (sku.includes('CABLE')) return { category: 'HARDWARE', variant: 'Braided nylon · USB-C' };
    return { category: 'ESSENTIALS', variant: 'Official Nexus Edition' };
  };

  return (
    <div className="min-h-screen bg-[#07090C] text-[#F0F4F8] font-sans antialiased selection:bg-[#7FF8C6] selection:text-black">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        
        {/* Breadcrumb Header */}
        <div className="mb-8">
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40">
            STORE / YOUR CART
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight mt-2">
            A few good choices.
          </h1>
          <p className="text-sm sm:text-base text-white/50 mt-1.5 font-normal">
            Three considered essentials. One connected checkout.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-2 border-[#7FF8C6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs font-mono text-white/40">Loading cart lines...</p>
          </div>
        ) : items.length === 0 ? (
          /* Empty Bag State */
          <div className="max-w-xl mx-auto py-16 px-6 text-center border border-white/10 rounded-2xl bg-[#0E1218]">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40 mb-4">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Your cart is empty</h2>
            <p className="text-xs text-white/50 mt-2 max-w-sm mx-auto">
              Explore the NexusRail collection to select hardware signers, workspace objects, and testnet essentials.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  FIGMA_DEFAULT_ITEMS.forEach((i) => addSkuToCart(i.sku));
                }}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-xs font-mono text-white hover:bg-white/20 transition-all"
              >
                Restore 3 Demo Essentials
              </button>
              <Link
                href="/store"
                className="px-4 py-2 rounded-lg bg-[#7FF8C6] text-[#052E20] text-xs font-mono font-bold hover:bg-[#6EE7B7] transition-all"
              >
                Go to Store &rarr;
              </Link>
            </div>
          </div>
        ) : (
          /* Two-Column Grid matching Figma Screen 4 */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
            
            {/* Left Products Column (7.5 cols) */}
            <div className="lg:col-span-7 xl:col-span-8">
              
              {/* Table Column Headers */}
              <div className="grid grid-cols-12 pb-3 border-b border-white/10 text-[11px] font-mono tracking-widest text-white/40 uppercase">
                <span className="col-span-7 sm:col-span-8">PRODUCT</span>
                <span className="col-span-3 sm:col-span-2 text-center">QUANTITY</span>
                <span className="col-span-2 text-right">TOTAL / USD</span>
              </div>

              {/* Product Rows */}
              <div className="divide-y divide-white/10">
                {items.map((item) => {
                  const { category, variant } = getItemDetails(item.sku, item.title);
                  const imgUrl = PRODUCT_IMAGE_MAP[item.sku] || '/products/rail-one.png';

                  return (
                    <div
                      key={item.sku}
                      className="py-6 sm:py-7 grid grid-cols-12 gap-4 items-center group transition-colors"
                    >
                      {/* Product Thumbnail + Info (Cols 7 or 8) */}
                      <div className="col-span-7 sm:col-span-8 flex items-center gap-4 sm:gap-5">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-[#111620] border border-white/10 overflow-hidden relative shrink-0">
                          <Image
                            src={imgUrl}
                            alt={item.title}
                            fill
                            sizes="(max-width: 768px) 80px, 96px"
                            className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">
                            {category}
                          </p>
                          <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight mt-0.5">
                            {item.title}
                          </h3>
                          <p className="text-xs text-white/50 mt-0.5">
                            {variant}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.sku)}
                            className="text-xs text-white/40 hover:text-rose-400 transition-colors mt-2.5 block text-left underline decoration-white/20 underline-offset-4 hover:decoration-rose-400"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Quantity Stepper (Cols 3 or 2) */}
                      <div className="col-span-3 sm:col-span-2 flex justify-center">
                        <div className="flex items-center rounded border border-white/15 bg-[#10141A] px-2 py-1 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.sku, item.qty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-mono font-medium text-white">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.sku, item.qty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Line Item Total (Cols 2) */}
                      <div className="col-span-2 text-right">
                        <span className="text-sm sm:text-base font-mono font-medium text-white tracking-tight">
                          ${((item.priceCents * item.qty) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Promo Code Input Form */}
              <div className="pt-8 border-t border-white/10">
                <form onSubmit={handleApplyPromo} className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Promo code"
                    className="w-64 sm:w-72 px-4 py-2.5 rounded bg-[#10141A] border border-white/15 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#7FF8C6]/60 transition-colors uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded bg-white/[0.06] border border-white/15 hover:bg-white/[0.12] text-xs font-mono text-white transition-colors font-medium"
                  >
                    Apply code
                  </button>
                </form>
                {appliedPromo && (
                  <p className="text-[11px] font-mono text-[#7FF8C6] mt-2 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Promo code &quot;{appliedPromo}&quot; applied: 10% discount deducted from total.
                  </p>
                )}
                {promoError && (
                  <p className="text-[11px] font-mono text-rose-400 mt-2">
                    {promoError}
                  </p>
                )}
              </div>

              {/* Demo Notice Green Banner */}
              <div className="mt-8 p-3.5 sm:p-4 rounded-lg bg-[#092B21]/70 border border-[#104D38] flex items-center gap-3 text-xs font-mono text-[#7FF8C6]">
                <ShieldCheck className="w-4 h-4 text-[#7FF8C6] shrink-0" />
                <span className="text-[#A7F3D0] leading-relaxed">
                  No shipping address needed. This is a demo order; no physical products will be sent.
                </span>
              </div>
            </div>

            {/* Right Order Summary Column (4.5 cols) */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="rounded-xl bg-[#10141A] border border-white/10 p-6 sm:p-7 shadow-xl">
                
                {/* Card Title & Subtitle */}
                <h2 className="text-2xl font-normal text-white tracking-tight">
                  Order summary
                </h2>
                <div className="flex items-center justify-between text-xs font-mono text-white/40 tracking-wider mt-2 pb-5 border-b border-white/10">
                  <span>NR-1048 · {totalItemCount} ITEMS</span>
                  <span>USD</span>
                </div>

                {/* Subtotal Breakdown Lines */}
                <div className="space-y-4 py-5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Subtotal</span>
                    <span className="font-mono text-white">
                      ${(subtotalCents / 100).toFixed(2)}
                    </span>
                  </div>

                  {discountCents > 0 && (
                    <div className="flex justify-between items-center text-[#7FF8C6]">
                      <span>Promo code discount</span>
                      <span className="font-mono">
                        -${(discountCents / 100).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Demo shipping</span>
                    <span className="font-mono text-white/90">Free</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Estimated network fee</span>
                    <span className="font-mono text-white/70">&lt; $0.001</span>
                  </div>
                </div>

                {/* Total Row */}
                <div className="pt-4 border-t border-white/10 flex justify-between items-baseline">
                  <span className="text-lg text-white font-medium">Total</span>
                  <span className="text-2xl sm:text-3xl font-mono font-medium text-white tracking-tight">
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </div>

                <p className="text-xs text-white/40 leading-relaxed mt-3 mb-6">
                  Network fee is paid separately in XLM. Final amount confirmed before signing.
                </p>

                {/* Primary Continue CTA */}
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={busy || items.length === 0}
                  className="w-full py-3.5 sm:py-4 rounded-lg bg-[#7FF8C6] hover:bg-[#6EE7B7] active:scale-[0.99] text-[#052E20] font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[#7FF8C6]/10 disabled:opacity-50"
                >
                  {busy ? (
                    <span>Locking rates...</span>
                  ) : (
                    <>
                      <span>Continue to checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Testnet Assurance Pill */}
                <div className="p-3.5 rounded-lg bg-[#0A261E]/80 border border-[#124B3B] flex items-center gap-2.5 mt-4 text-xs font-mono text-[#7FF8C6]">
                  <ShieldCheck className="w-4 h-4 text-[#7FF8C6] shrink-0" />
                  <span className="text-[#A7F3D0]">
                    Testnet purchase. No real payment or delivery.
                  </span>
                </div>

                {/* Available Payment Rails */}
                <div className="mt-7 pt-6 border-t border-white/10">
                  <p className="text-[11px] font-mono tracking-widest uppercase text-white/40 mb-3">
                    AVAILABLE PAYMENT RAILS
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-mono font-medium tracking-wide">
                      STELLAR TESTNET
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-mono font-medium tracking-wide">
                      XRPL TESTNET
                    </span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed mt-3">
                    Review the exact test-asset amount, quote expiry, and transaction fee before connecting your wallet.
                  </p>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* Figma Screen 4 Bottom Status Bar */}
      <footer className="border-t border-white/10 py-5 bg-[#05070A]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-white/40">
          <p>© 2026 NexusRail · Demo environment</p>
          <p>Test assets only. No real funds or fulfillment.</p>
        </div>
      </footer>

    </div>
  );
}
