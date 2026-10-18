'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Zap,
  Tag,
  CreditCard,
  Lock,
  Cpu,
  Monitor,
  Shirt,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  CartLine,
  createOrderFromCart,
  fetchCartLines,
  removeCartSku,
  setCartQty,
  startStripeCheckout,
  addSkuToCart,
} from '@/lib/shop';

export default function UserCartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');

  const load = () => {
    setLoading(true);
    fetchCartLines()
      .then((lines) => {
        setItems(lines);
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const handleCartUpdate = () => load();
    window.addEventListener('nexus-cart', handleCartUpdate);
    return () => window.removeEventListener('nexus-cart', handleCartUpdate);
  }, []);

  const changeQty = async (sku: string, qty: number) => {
    setError('');
    try {
      if (qty <= 0) await removeCartSku(sku);
      else await setCartQty(sku, qty);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the cart.');
    }
  };

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    if (promoCode.trim().toUpperCase() === 'NEXUS10' || promoCode.trim().toUpperCase() === 'STELLAR') {
      setPromoApplied(true);
      setPromoError('');
    } else {
      setPromoError('Invalid promo code. Try "NEXUS10"');
    }
  };

  const proceedToMultiRail = async () => {
    setBusy(true);
    setError('');
    try {
      const order = await createOrderFromCart(items, 'MULTI');
      const orderTitle = items.map((i) => i.title).join(', ');
      router.push(`/app/checkout?orderId=${encodeURIComponent(order.id)}&title=${encodeURIComponent(orderTitle)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initialize Multi-Rail checkout.');
      setBusy(false);
    }
  };

  const handleStripeCheckout = async () => {
    setBusy(true);
    setError('');
    try {
      await startStripeCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Stripe checkout.');
      setBusy(false);
    }
  };

  const rawSubtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const discountCents = promoApplied ? Math.round(rawSubtotalCents * 0.1) : 0;
  const totalCents = Math.max(0, rawSubtotalCents - discountCents);

  const getItemIcon = (sku: string) => {
    switch (sku) {
      case 'RAIL-ONE':
        return <Cpu className="w-6 h-6 text-rail-emerald" />;
      case 'RELAY-MAT':
        return <Monitor className="w-6 h-6 text-stellar-cyan" />;
      case 'NEXUS-TEE':
        return <Shirt className="w-6 h-6 text-xrpl-blue" />;
      case 'NODE-STAND':
        return <Layers className="w-6 h-6 text-cyber-purple" />;
      default:
        return <ShoppingBag className="w-6 h-6 text-gray-400" />;
    }
  };

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        
        {/* Step Progress Breadcrumb */}
        <div className="flex items-center justify-between border-b border-nexus-border pb-6">
          <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-card border border-rail-emerald/60 text-rail-emerald font-bold">
              <span className="w-2 h-2 rounded-full bg-rail-emerald" />
              <span>1 Cart</span>
            </div>
            <span className="text-nexus-border">&rarr;</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-surface/60 border border-nexus-border text-nexus-muted">
              <span>2 Checkout</span>
            </div>
            <span className="text-nexus-border">&rarr;</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-surface/60 border border-nexus-border text-nexus-muted">
              <span>3 Receipt</span>
            </div>
          </div>

          <Link
            href="/store"
            className="text-xs font-mono text-nexus-muted hover:text-white transition-colors"
          >
            &larr; Back to shop
          </Link>
        </div>

        {/* Page Title */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            A few good choices.
          </h1>
          <p className="mt-1 text-sm text-nexus-muted font-mono">
            Review your selected items before choosing your settlement rail.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-sm font-mono text-nexus-muted">
            <div className="w-8 h-8 border-2 border-rail-emerald border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading bag items...
          </div>
        ) : items.length === 0 ? (
          /* Empty Bag State */
          <div className="p-10 sm:p-14 rounded-2xl border border-nexus-border bg-nexus-card space-y-6 text-center max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-nexus-surface border border-nexus-border mx-auto flex items-center justify-center text-nexus-muted">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Your bag is empty</h2>
              <p className="text-xs text-nexus-muted mt-1.5 max-w-md mx-auto">
                Select flagship signer hardware, high-density workspace objects, or developer passes to test the multi-rail pipeline.
              </p>
            </div>

            {/* Quick add suggestions */}
            <div className="pt-4 border-t border-nexus-border text-left space-y-3">
              <p className="text-[11px] font-mono uppercase tracking-wider text-nexus-muted text-center">
                Quick add flagship objects:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { sku: 'RAIL-ONE', title: 'Rail One', price: '$129.00' },
                  { sku: 'RELAY-MAT', title: 'Relay desk mat', price: '$39.00' },
                  { sku: 'NEXUS-TEE', title: 'Nexus tee', price: '$32.00' },
                  { sku: 'NODE-STAND', title: 'Node stand', price: '$58.00' },
                ].map((sug) => (
                  <button
                    key={sug.sku}
                    type="button"
                    onClick={() => addSkuToCart(sug.sku)}
                    className="flex items-center justify-between p-3 rounded-xl bg-nexus-surface border border-nexus-border hover:border-rail-emerald/50 text-xs font-mono text-white transition-all text-left"
                  >
                    <span>{sug.title}</span>
                    <span className="text-rail-emerald font-semibold">{sug.price} +</span>
                  </button>
                ))}
              </div>
            </div>

            <Link
              href="/store"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rail-emerald text-nexus-dark text-xs font-mono font-bold hover:brightness-110 transition-all"
            >
              <span>Explore full catalog</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* Cart Content Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Items Column (8 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-nexus-muted px-2">
                <span>ITEMS IN BAG ({items.reduce((s, i) => s + i.qty, 0)})</span>
                <span>SUBTOTAL: ${(rawSubtotalCents / 100).toFixed(2)}</span>
              </div>

              {items.map((item) => (
                <div
                  key={item.sku}
                  className="p-5 rounded-2xl bg-nexus-card border border-nexus-border hover:border-nexus-border/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-center shrink-0">
                      {getItemIcon(item.sku)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-base">{item.title}</h3>
                      <p className="text-xs font-mono text-nexus-muted mt-0.5">{item.sku}</p>
                      <p className="text-xs font-mono text-rail-emerald mt-1">
                        ${(item.priceCents / 100).toFixed(2)} each
                      </p>
                    </div>
                  </div>

                  {/* Right: Quantity Stepper & Total */}
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-nexus-border/60">
                    {/* Stepper */}
                    <div className="flex items-center border border-nexus-border rounded-xl bg-nexus-surface p-1">
                      <button
                        type="button"
                        onClick={() => changeQty(item.sku, item.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-nexus-card text-nexus-muted hover:text-white transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-mono font-bold text-white">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(item.sku, item.qty + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-nexus-card text-nexus-muted hover:text-white transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <span className="text-sm font-mono font-extrabold text-white w-20 text-right">
                      ${((item.priceCents * item.qty) / 100).toFixed(2)}
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => changeQty(item.sku, 0)}
                      className="p-2 text-nexus-muted hover:text-rose-400 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Free Shipping Callout */}
              <div className="p-4 rounded-xl bg-nexus-surface/80 border border-nexus-border flex items-center gap-3 text-xs font-mono text-nexus-muted">
                <Sparkles className="w-4 h-4 text-rail-emerald shrink-0" />
                <span>
                  Testnet physical simulator shipping is free worldwide. Includes onchain cryptographic provenance certificate.
                </span>
              </div>
            </div>

            {/* Right Summary Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-6">
                <h2 className="text-lg font-bold text-white flex items-center justify-between">
                  <span>Order summary</span>
                  <span className="text-xs font-mono text-nexus-muted">USD</span>
                </h2>

                {/* Subtotal breakdown */}
                <div className="space-y-3 text-xs font-mono border-b border-nexus-border pb-4">
                  <div className="flex justify-between text-nexus-muted">
                    <span>Subtotal</span>
                    <span className="text-white">${(rawSubtotalCents / 100).toFixed(2)}</span>
                  </div>

                  {promoApplied && (
                    <div className="flex justify-between text-rail-emerald">
                      <span>Promo code (10% off)</span>
                      <span>-${(discountCents / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-nexus-muted">
                    <span>Standard shipping</span>
                    <span className="text-rail-emerald font-semibold">FREE</span>
                  </div>

                  <div className="flex justify-between text-nexus-muted">
                    <span>Estimated testnet network fee</span>
                    <span className="text-white">~$0.0001</span>
                  </div>
                </div>

                {/* Promo input */}
                <form onSubmit={handleApplyPromo} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-nexus-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Promo code (NEXUS10)"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-xs text-white placeholder-nexus-muted focus:outline-none focus:border-rail-emerald/60 font-mono uppercase"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border hover:border-rail-emerald text-xs font-mono text-white transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {promoApplied && (
                    <p className="text-[11px] font-mono text-rail-emerald">Code NEXUS10 applied successfully!</p>
                  )}
                  {promoError && (
                    <p className="text-[11px] font-mono text-rose-400">{promoError}</p>
                  )}
                </form>

                {/* Total Row */}
                <div className="pt-2 border-t border-nexus-border flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-mono uppercase text-nexus-muted block">Total due</span>
                    <span className="text-[10px] font-mono text-nexus-muted">Guaranteed testnet rate</span>
                  </div>
                  <span className="text-2xl font-mono font-extrabold text-white">
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </div>

                {/* Action CTAs */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={proceedToMultiRail}
                    disabled={busy || items.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-rail-emerald text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-rail-emerald/10 disabled:opacity-50"
                  >
                    {busy ? (
                      <span>Initializing quote lock...</span>
                    ) : (
                      <>
                        <span>Continue to checkout</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleStripeCheckout}
                    disabled={busy || items.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexus-surface border border-nexus-border hover:border-nexus-muted/60 text-nexus-muted hover:text-white font-mono text-xs font-medium transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay with credit card (Stripe)</span>
                  </button>
                </div>

                {/* Trust Badges */}
                <div className="pt-4 border-t border-nexus-border/60 grid grid-cols-2 gap-3 text-[11px] font-mono text-nexus-muted">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-rail-emerald" />
                    <span>Non-custodial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-stellar-cyan" />
                    <span>~3s Finality</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-xrpl-blue" />
                    <span>Quote locked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-cyber-purple" />
                    <span>Audited ledger</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
