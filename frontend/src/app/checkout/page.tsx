'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Check,
  ExternalLink,
  Wallet,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import {
  fetchCartLines,
  clearCart,
  CartLine,
  readSession,
  SessionUser,
  onSessionChange,
} from '@/lib/shop';
import {
  checkFreighterInstalled,
  checkGemWalletInstalled,
  payWithFreighter,
  payWithGemWallet,
} from '@/lib/wallets';
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';
import { TransactionSafetyCenter } from '@/components/checkout/TransactionSafetyCenter';

interface CheckoutRailQuote {
  rail: 'STELLAR' | 'XRPL' | 'NXL';
  chain: string;
  assetSymbol: string;
  amountCrypto: string;
  fxRateUsd: number;
  destination: string | null;
  memo: string | null;
  destinationTag: number | null;
  networkIdentifier: string;
  expiresAt: string;
  explorerUrl: string | null;
  totalCents: number;
  originalTotalCents?: number;
  discountCents: number;
  discountPct?: number;
  swapFeePercent?: number;
}

interface CheckoutQuote {
  orderId: string;
  orderNumber?: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  rails: Partial<Record<'STELLAR' | 'XRPL' | 'NXL', CheckoutRailQuote>>;
  errors: Record<string, string>;
}

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'NODE-STAND': '/products/node-stand.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
  'RAIL-CABLES': '/products/rail-cables.png',
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramOrderId = searchParams.get('orderId') || '';

  const [orderId, setOrderId] = useState(paramOrderId);
  const [items, setItems] = useState<CartLine[]>([]);
  const [selectedRail, setSelectedRail] = useState<'STELLAR' | 'XRPL' | 'NR_TOKEN'>('STELLAR');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [showSafetyCenter, setShowSafetyCenter] = useState(false);
  const [reviewMemo, setReviewMemo] = useState<string | number | undefined>(undefined);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [nrBalance, setNrBalance] = useState(0);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  // Real extension detection
  const [hasFreighter, setHasFreighter] = useState(false);
  const [hasGemWallet, setHasGemWallet] = useState(false);

  // Transaction processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when Pre-Flight Transaction Safety Center modal is active
  useEffect(() => {
    if (showSafetyCenter) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showSafetyCenter]);

  // Load the server-authoritative checkout quote. Every amount, destination,
  // memo/tag, fee and discount shown on this page comes from this response.
  const loadQuote = useCallback(async () => {
    if (!orderId) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token) {
      setQuote(null);
      setQuoteError('Sign in to load checkout pricing.');
      return;
    }

    setQuoteLoading(true);
    setQuoteError('');
    try {
      const res = await fetch(`/api/v1/checkout/quote/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true || !json?.data) {
        throw new Error(json?.error || 'Checkout pricing is unavailable right now.');
      }
      setQuote(json.data as CheckoutQuote);
    } catch (err) {
      setQuote(null);
      setQuoteError(err instanceof Error ? err.message : 'Checkout pricing is unavailable right now.');
    } finally {
      setQuoteLoading(false);
    }
  }, [orderId]);

  // Load session, wallet balance and cart items
  useEffect(() => {
    const sync = () => {
      const sess = readSession();
      setUser(sess.user);
      if (sess.user?.email) setCustomerEmail(sess.user.email);
      if (sess.token) {
        fetch('/api/v1/wallet/balance', {
          headers: { Authorization: `Bearer ${sess.token}` },
          cache: 'no-store',
        })
          .then((r) => r.json())
          .then((j) => {
            if (j?.success && j.balance) {
              setNrBalance(((j.balance.NXL ?? j.balance.NR) || 0) / 1_000_000);
            }
          })
          .catch(() => {});
      }
    };
    sync();

    fetchCartLines()
      .then((lines) => setItems(lines))
      .catch(() => setItems([]));

    checkFreighterInstalled().then(setHasFreighter);
    checkGemWalletInstalled().then(setHasGemWallet);

    return onSessionChange(sync);
  }, []);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const activeQuote = quote?.rails[selectedRail === 'NR_TOKEN' ? 'NXL' : selectedRail] ?? null;
  const activeToken =
    activeQuote?.assetSymbol ??
    (selectedRail === 'STELLAR' ? 'XLM' : selectedRail === 'XRPL' ? 'XRP' : 'NXL');
  const activeTotalCrypto = activeQuote?.amountCrypto ?? '—';
  const activeRateStr = activeQuote
    ? `1 ${activeQuote.assetSymbol} = $${activeQuote.fxRateUsd.toFixed(4)}`
    : '—';

  // Quote expiry countdown, driven by the backend `expiresAt` value.
  useEffect(() => {
    if (!activeQuote?.expiresAt) {
      setQuoteSecondsLeft(0);
      return;
    }
    const tick = () => {
      const ms = new Date(activeQuote.expiresAt).getTime() - Date.now();
      setQuoteSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeQuote?.expiresAt]);

  // Display-only values, all derived from the backend quote.
  const subtotalUsd = quote ? quote.subtotalCents / 100 : 0;
  const promoDiscountUsd = quote ? quote.discountCents / 100 : 0;
  const nxlDiscountUsd =
    selectedRail === 'NR_TOKEN' && activeQuote ? activeQuote.discountCents / 100 : 0;
  const totalUsd = activeQuote ? activeQuote.totalCents / 100 : 0;
  const nxlDiscountPct = quote?.rails.NXL?.discountPct ?? 0;
  const quoteExpired = Boolean(activeQuote) && quoteSecondsLeft <= 0;
  const canPay = Boolean(activeQuote) && !quoteExpired && !quoteLoading && !isProcessing;

  // The review screen shows the exact memo/tag returned by the backend invoice.
  const handleOpenSafetyCenter = () => {
    if (!activeQuote) {
      setErrorMsg(quoteError || 'Wait for the checkout quote before paying.');
      return;
    }
    setReviewMemo(activeQuote.memo ?? activeQuote.destinationTag ?? undefined);
    setShowSafetyCenter(true);
  };

  // Handle on-chain or $NXL native ledger payment submission. The invoice
  // amount, destination, memo/tag and totals all come from the backend quote.
  const handleConfirmAndPay = async () => {
    if (!activeQuote || !quote) {
      setErrorMsg('Wait for the checkout quote before paying.');
      return;
    }
    if (quoteExpired) {
      setErrorMsg('This quote expired. Refresh the quote and try again.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      let txHash = '';
      let ledgerSeq = '';
      let finalPaidUsd = activeQuote.totalCents / 100;
      let finalPaidCrypto = activeQuote.amountCrypto;
      let sourceWallet = '';
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;

      if (selectedRail === 'NR_TOKEN') {
        if (!token) {
          throw new Error('Sign in to pay with your $NXL wallet balance.');
        }
        const nrRes = await fetch('/api/v1/checkout/nxl/pay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId }),
        });
        const nrJson = await nrRes.json().catch(() => null);
        if (!nrRes.ok || !nrJson?.success) {
          throw new Error(nrJson?.error || '$NXL checkout failed');
        }
        txHash = nrJson.data.txHash;
        finalPaidUsd = (nrJson.data.finalPaidCents ?? activeQuote.totalCents) / 100;
        finalPaidCrypto = String(nrJson.data.paidNrAmount ?? activeQuote.amountCrypto);
        sourceWallet = user?.walletAddress || '$NXL wallet balance';
      } else if (selectedRail === 'STELLAR') {
        if (!hasFreighter) {
          throw new Error('Install or unlock the Freighter wallet to pay with Stellar.');
        }
        if (!token) {
          throw new Error('Sign in to load the Stellar invoice before paying.');
        }
        const res = await payWithFreighter({
          orderId,
          authToken: token,
        });
        if (!res.txHash) {
          throw new Error('Freighter did not return a transaction hash. Please try again.');
        }
        txHash = res.txHash;
        if (res.sourceAddress) sourceWallet = res.sourceAddress;
        if (res.ledger) ledgerSeq = res.ledger.toLocaleString('en-US');
      } else if (selectedRail === 'XRPL') {
        if (!hasGemWallet) {
          throw new Error('Install or unlock the GemWallet extension to pay with XRPL.');
        }
        if (!activeQuote.destination || activeQuote.destinationTag == null) {
          throw new Error('The XRPL invoice is incomplete. Refresh the quote and try again.');
        }
        const res = await payWithGemWallet({
          amountXrp: activeQuote.amountCrypto,
          destination: activeQuote.destination,
          destinationTag: activeQuote.destinationTag,
        });
        if (!res.txHash) {
          throw new Error('GemWallet did not return a transaction hash. Please try again.');
        }
        txHash = res.txHash;
        if (res.sourceAddress) sourceWallet = res.sourceAddress;
      } else {
        throw new Error('Select a payment rail to continue.');
      }

      if (!sourceWallet) {
        if (selectedRail === 'STELLAR') {
          sourceWallet =
            user?.stellarAddress ||
            (user?.walletAddress?.startsWith('G') ? user.walletAddress : '') ||
            (user?.lastConnectedWallet?.address?.startsWith('G') ? user.lastConnectedWallet.address : '');
        } else if (selectedRail === 'XRPL') {
          sourceWallet =
            user?.xrplAddress ||
            (user?.walletAddress?.startsWith('r') ? user.walletAddress : '') ||
            (user?.lastConnectedWallet?.address?.startsWith('r') ? user.lastConnectedWallet.address : '');
        } else {
          sourceWallet = user?.walletAddress || '$NXL wallet balance';
        }
        if (!sourceWallet) {
          throw new Error('Connect a wallet before paying.');
        }
      }

      // Verify on-chain payment with backend if real wallet transaction
      if (selectedRail !== 'NR_TOKEN' && token && txHash) {
        try {
          const path = selectedRail === 'XRPL' ? 'xrpl' : 'stellar';
          await fetch(`/api/v1/checkout/${path}/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderId, txHash }),
          });
        } catch {
          // Background watcher will reconcile
        }
      }

      // Persist completed order details for the receipt screen
      const receiptData = {
        orderId,
        rail: selectedRail,
        token: activeToken,
        amountCrypto: finalPaidCrypto,
        amountUsd: finalPaidUsd.toFixed(2),
        subtotalUsd: (quote.subtotalCents / 100).toFixed(2),
        feeUsd: '0.00',
        rateAtApproval: activeRateStr,
        txHash,
        ledgerSequence: ledgerSeq,
        timestamp: new Date().toUTCString(),
        email: customerEmail || user?.email || '',
        items,
        paidFrom: sourceWallet,
        vaultAddress: activeQuote.destination || '',
        quoteExpiresAt: activeQuote.expiresAt,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`nexus_receipt_${orderId}`, JSON.stringify(receiptData));
      }

      // Clear active cart upon confirmed payment verification
      await clearCart();

      // Route to the receipt screen
      router.push(`/receipt?orderId=${encodeURIComponent(orderId)}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Wallet signature failed or rejected.');
      setIsProcessing(false);
    }
  };

  if (!orderId) {
    return (
      <main className="min-h-screen bg-transparent text-[var(--foreground)] flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center space-y-4 rounded-2xl nexus-glass-card border border-[var(--border)] p-8">
          <Lock className="w-8 h-8 mx-auto text-[var(--gold)]" />
          <h1 className="text-xl font-bold">No active order</h1>
          <p className="text-sm text-[var(--muted)]">
            Start from your cart to create an order before checking out.
          </p>
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-mono font-bold hover:bg-[var(--gold-bright)] transition-colors"
          >
            Back to cart
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] font-sans antialiased selection:bg-[var(--gold)]/30 selection:text-black transition-colors duration-200">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        
        {/* Step Progress Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono mb-8 overflow-x-auto pb-1">
          <Link href="/cart" className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0">
            <span className="w-4 h-4 rounded-full nexus-glass-surface border border-[var(--gold)]/40 text-[var(--gold)] flex items-center justify-center text-[11px] font-bold">
              ✓
            </span>
            <span>Cart</span>
          </Link>
          <span className="text-[var(--border)]">──────</span>
          <div className="flex items-center gap-1.5 text-[var(--foreground)] font-semibold shrink-0">
            <span className="w-4 h-4 rounded-full bg-[var(--gold)] text-black flex items-center justify-center text-[11px] font-bold">
              2
            </span>
            <span>Checkout</span>
          </div>
          <span className="text-[var(--border)]">──────</span>
          <div className="flex items-center gap-1.5 text-[var(--muted)] shrink-0">
            <span className="w-4 h-4 rounded-full nexus-glass-surface border border-[var(--border)] flex items-center justify-center text-[11px]">
              3
            </span>
            <span>Receipt</span>
          </div>
        </div>

        {/* Page Title & Order Badge */}
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-[var(--foreground)] tracking-tight">
            Checkout
          </h1>
          <span className="px-2.5 py-1 rounded-lg nexus-glass-surface border border-[var(--border)] text-[var(--gold)] text-xs font-mono font-bold">
            {orderId}
          </span>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono">
            {errorMsg}
          </div>
        )}

        {/* 2-Column Responsive Layout matching Figma Screen 7 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          
          {/* Left Settlement Funnel Column (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Step 01: Contact */}
            <div className="space-y-3 pb-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="tracking-widest uppercase text-[var(--muted)]">01 / CONTACT</span>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(!isEditingEmail)}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors underline decoration-[var(--border)] cursor-pointer"
                >
                  {isEditingEmail ? 'Save' : 'Edit'}
                </button>
              </div>

              {isEditingEmail ? (
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full max-w-md px-3 py-2 rounded-xl nexus-glass-surface border border-[var(--border)] text-sm font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--border-focus)]"
                />
              ) : (
                <p className="text-base font-normal text-[var(--foreground)]">
                  {customerEmail}
                </p>
              )}

              <p className="text-xs text-[var(--muted)]">
                Receipt only. No shipping or physical fulfillment.
              </p>
            </div>

            {/* Step 02: Choose Your Payment Rail */}
            <div className="space-y-4 pb-6 border-b border-[var(--border)]">
              <p className="text-xs font-mono tracking-widest uppercase text-[var(--muted)]">
                02 / CHOOSE YOUR PAYMENT RAIL
              </p>

              {/* 2x2 Rail Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Card 1: Stellar (TESTNET) */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('STELLAR')}
                  className={`p-5 rounded-2xl border text-left transition-all relative cursor-pointer ${
                    selectedRail === 'STELLAR'
                      ? 'nexus-glass-card border-[var(--gold)] shadow-lg shadow-[var(--gold)]/10 ring-1 ring-[var(--gold)]/40'
                      : 'nexus-glass-surface border-[var(--border)] hover:border-[var(--border-highlight)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedRail === 'STELLAR' ? 'border-[var(--gold)]' : 'border-[var(--border)]'
                      }`}>
                        {selectedRail === 'STELLAR' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">Stellar</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold-bright)] text-[11px] font-mono font-bold">
                      TESTNET
                    </span>
                  </div>

                  <p className="text-2xl font-mono font-medium text-[var(--foreground)] tracking-tight mt-3">
                    {quote?.rails.STELLAR?.amountCrypto ?? '—'} XLM
                  </p>

                  <p className="text-xs font-mono text-[var(--muted)] mt-1">
                    {hasFreighter
                      ? 'Freighter detected · Network fee paid by wallet'
                      : 'Freighter not detected · Network fee paid by wallet'}
                  </p>

                  <p
                    className={`text-xs font-mono mt-3 flex items-center gap-1.5 font-semibold ${
                      hasFreighter ? 'text-[var(--gold)]' : 'text-amber-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${hasFreighter ? 'bg-[var(--gold)]' : 'bg-amber-400'}`} />
                    {hasFreighter ? 'Wallet ready' : 'Install Freighter to pay'}
                  </p>
                </button>

                {/* Card 2: XRPL (TESTNET) */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('XRPL')}
                  className={`p-5 rounded-2xl border text-left transition-all relative cursor-pointer ${
                    selectedRail === 'XRPL'
                      ? 'nexus-glass-card border-[#0081F2] shadow-lg shadow-[#0081F2]/10 ring-1 ring-[#0081F2]/40'
                      : 'nexus-glass-surface border-[var(--border)] hover:border-[var(--border-highlight)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedRail === 'XRPL' ? 'border-[#0081F2]' : 'border-[var(--border)]'
                      }`}>
                        {selectedRail === 'XRPL' && <span className="w-1.5 h-1.5 rounded-full bg-[#0081F2]" />}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">XRPL</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#0081F2]/15 border border-[#0081F2]/40 text-[#60A5FA] text-[11px] font-mono font-bold">
                      TESTNET
                    </span>
                  </div>

                  <p className="text-2xl font-mono font-medium text-[var(--foreground)] tracking-tight mt-3">
                    {quote?.rails.XRPL?.amountCrypto ?? '—'} XRP
                  </p>

                  <p className="text-xs font-mono text-[var(--muted)] mt-1">
                    {hasGemWallet
                      ? 'GemWallet detected · Network fee paid by wallet'
                      : 'GemWallet not detected · Network fee paid by wallet'}
                  </p>

                  <p
                    className={`text-xs font-mono mt-3 flex items-center gap-1 font-semibold ${
                      hasGemWallet ? 'text-[var(--gold)]' : 'text-amber-500'
                    }`}
                  >
                    {hasGemWallet ? 'Wallet ready' : 'Install GemWallet to pay'}
                  </p>
                </button>

                {/* Card 3: $NXL Protocol Token (10% Discount + 0% Fee) */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('NR_TOKEN')}
                  className={`p-5 rounded-2xl border text-left transition-all relative cursor-pointer ${
                    selectedRail === 'NR_TOKEN'
                      ? 'nexus-glass-card border-[var(--gold)] shadow-lg shadow-[var(--gold)]/10 ring-1 ring-[var(--gold)]/40'
                      : 'nexus-glass-surface border-[var(--border)] hover:border-[var(--border-highlight)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedRail === 'NR_TOKEN' ? 'border-[var(--gold)]' : 'border-[var(--border)]'
                      }`}>
                        {selectedRail === 'NR_TOKEN' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">$NXL Token</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-mono font-bold">
                      {nxlDiscountPct > 0 ? `SAVE ${nxlDiscountPct}%` : 'NXL PRICING'}
                    </span>
                  </div>

                  <p className="text-2xl font-mono font-medium text-[var(--foreground)] tracking-tight mt-3">
                    {quote?.rails.NXL?.amountCrypto ?? '—'} NXL
                  </p>

                  <p className="text-xs font-mono text-[var(--muted)] mt-1">
                    Balance {nrBalance.toFixed(4)} NXL · No routing fee
                  </p>

                  {quote?.rails.NXL && nrBalance >= Number(quote.rails.NXL.amountCrypto) ? (
                    <p className="text-xs font-mono text-emerald-400 mt-3 flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {nxlDiscountPct > 0
                        ? `${nxlDiscountPct}% holder discount applied at payment`
                        : 'Holder pricing applied at payment'}
                    </p>
                  ) : (
                    <Link
                      href="/swap?to=NXL"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-mono text-amber-400 hover:underline mt-3 inline-flex items-center gap-1 font-semibold"
                    >
                      Need more $NXL? Swap XLM/XRP &rarr; NXL
                    </Link>
                  )}
                </button>

                {/* Card 4: Solana (Coming Soon) */}
                <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-xs font-mono text-[var(--muted)]">Solana</span>
                  <span className="text-[11px] font-mono text-[var(--muted)] uppercase tracking-wider">COMING SOON</span>
                </div>

              </div>

              {/* Connected Wallet Row */}
              <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg nexus-glass-card border border-[var(--border)] flex items-center justify-center text-[var(--foreground)]">
                    <Wallet className="w-4 h-4 text-[var(--gold)]" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-[var(--foreground)] font-medium">
                      {selectedRail === 'STELLAR'
                        ? hasFreighter
                          ? 'Freighter · Stellar testnet'
                          : 'Stellar wallet not connected'
                        : selectedRail === 'XRPL'
                        ? hasGemWallet
                          ? 'GemWallet · XRPL testnet'
                          : 'XRPL wallet not connected'
                        : 'NexusRail Ledger · $NXL Token'}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--muted)]">
                      {selectedRail === 'NR_TOKEN'
                        ? `Available: ${nrBalance.toFixed(4)} NXL`
                        : user?.walletAddress || 'Not connected'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(true)}
                  className="text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors underline decoration-[var(--border)] cursor-pointer"
                >
                  Change
                </button>
              </div>

            </div>

            {/* Step 03: Review the Quote */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="tracking-widest uppercase text-[var(--muted)]">03 / REVIEW THE QUOTE</span>
                <span className="px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold-bright)] text-[11px] font-bold">
                  {quoteLoading ? 'LOADING' : quoteExpired ? 'EXPIRED' : activeQuote ? 'SERVER QUOTE' : 'UNAVAILABLE'}
                </span>
              </div>

              {quoteError && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono flex items-center justify-between gap-3">
                  <span>{quoteError}</span>
                  <button
                    type="button"
                    onClick={() => void loadQuote()}
                    className="shrink-0 underline hover:text-amber-200"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Rate Breakdown Table */}
              <div className="space-y-3 text-xs font-mono divide-y divide-[var(--border)]">
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Exchange rate</span>
                  <span className="text-[var(--foreground)] font-medium">{activeRateStr}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Order payment</span>
                  <span className="text-[var(--foreground)] font-medium">{activeTotalCrypto} {activeToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Network fee</span>
                  <span className="text-[var(--foreground)] font-medium">
                    {selectedRail === 'NR_TOKEN' ? 'None (internal ledger)' : 'Paid by your wallet'}
                  </span>
                </div>
              </div>

              {/* Total to Authorize */}
              <div className="pt-3 border-t border-[var(--border)] flex justify-between items-baseline">
                <span className="text-sm font-medium text-[var(--foreground)]">Total to authorize</span>
                <span className="text-2xl font-mono font-medium text-[var(--gold-bright)] tracking-tight">
                  {activeTotalCrypto} {activeToken}
                </span>
              </div>

              {/* Metadata quote expiration line */}
              <p className="text-[11px] font-mono text-[var(--muted)] tracking-wider">
                {quoteExpired
                  ? 'QUOTE EXPIRED · REFRESH TO CONTINUE'
                  : activeQuote
                  ? `QUOTE VALID · REFRESHES IN ${quoteSecondsLeft}S`
                  : 'WAITING FOR A SERVER QUOTE'}
              </p>

              {quoteExpired && (
                <button
                  type="button"
                  onClick={() => void loadQuote()}
                  className="text-xs font-mono text-[var(--gold)] hover:underline inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh quote
                </button>
              )}

              {/* Confirm & Pay CTA */}
              <button
                type="button"
                onClick={() => handleOpenSafetyCenter()}
                disabled={!canPay}
                className="w-full py-4 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold)]/20 active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer"
              >
                {isProcessing ? (
                  <span>Signing transaction on {selectedRail}...</span>
                ) : quoteLoading ? (
                  <span>Loading server quote…</span>
                ) : !activeQuote ? (
                  <span>Pricing unavailable</span>
                ) : quoteExpired ? (
                  <span>Refresh quote to continue</span>
                ) : (
                  <>
                    <span>Review & Authorize {activeTotalCrypto} {activeToken}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Readiness subtext */}
              <p className="text-xs font-mono text-[var(--muted)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full border border-[var(--border)]" />
                <span>Ready for wallet approval. No transaction has been submitted.</span>
              </p>

            </div>

          </div>

          {/* Right Column: Your Order (5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl nexus-glass-card p-5 sm:p-7 shadow-xl space-y-6">
              
              <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Your order
              </h2>

              {/* Items List */}
              <div className="space-y-4 divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <div key={item.sku} className="pt-4 first:pt-0 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl nexus-glass-surface border border-[var(--border)] overflow-hidden relative shrink-0">
                      <Image
                        src={PRODUCT_IMAGE_MAP[item.sku] || '/products/rail-one.png'}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                      <p className="text-xs font-mono text-[var(--muted)] mt-0.5">Qty {item.qty}</p>
                    </div>
                    <span className="text-sm font-mono text-[var(--foreground)] font-bold">
                      ${((item.priceCents * item.qty) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-3 py-4 border-t border-b border-[var(--border)] text-xs font-mono">
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Subtotal</span>
                  <span className="text-[var(--foreground)] font-bold">
                    {quote ? `$${subtotalUsd.toFixed(2)}` : '—'}
                  </span>
                </div>
                {promoDiscountUsd > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Promo discount</span>
                    <span className="font-bold">-${promoDiscountUsd.toFixed(2)}</span>
                  </div>
                )}
                {nxlDiscountUsd > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>$NXL holder discount{nxlDiscountPct > 0 ? ` (${nxlDiscountPct}%)` : ''}</span>
                    <span className="font-bold">-${nxlDiscountUsd.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Shipping</span>
                  <span className="text-[var(--foreground)] font-bold">Free</span>
                </div>
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Network fee</span>
                  <span className="text-[var(--foreground)]">
                    {selectedRail === 'NR_TOKEN' ? 'None (internal ledger)' : 'Paid by your wallet'}
                  </span>
                </div>
              </div>

              {/* Total USD */}
              <div className="flex justify-between items-baseline">
                <span className="text-base text-[var(--foreground)] font-medium">Total / USD</span>
                <span className="text-2xl font-mono font-bold text-[var(--gold-bright)] tracking-tight">
                  {activeQuote ? `$${totalUsd.toFixed(2)}` : '—'}
                </span>
              </div>

              {/* Guarantee Box */}
              <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--gold)]/40 flex items-center gap-2.5 text-xs font-mono text-[var(--gold)]">
                <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0" />
                <span className="text-[var(--foreground)]/90 leading-relaxed">
                  Testnet transaction only. Test XLM has no monetary value.
                </span>
              </div>

              {/* 3-Point Assurance Checklist */}
              <div className="space-y-2.5 text-xs font-mono text-[var(--muted)] pt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Check className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Approve in your wallet</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Check className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>We verify the transaction on the ledger</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Check className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Your receipt and ledger balance update instantly</span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </main>

      {/* Phase 3: Transaction Safety Center Pre-Flight Modal Portaled to Root Body */}
      {showSafetyCenter && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Transaction Safety Center Pre-Flight Review"
              className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-4 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
            >
              <div className="w-full max-w-lg my-auto py-2">
                <TransactionSafetyCenter
                  chain={selectedRail === 'XRPL' ? 'xrpl' : 'stellar'}
                  networkName={selectedRail === 'STELLAR' ? 'STELLAR TESTNET' : selectedRail === 'XRPL' ? 'XRPL TESTNET' : 'NEXUSRAIL NATIVE LEDGER'}
                  networkIdentifier={activeQuote?.networkIdentifier ?? 'Unavailable'}
                  actionType={
                    selectedRail === 'NR_TOKEN'
                      ? nxlDiscountPct > 0
                        ? `$NXL token checkout (${nxlDiscountPct}% holder discount)`
                        : '$NXL token checkout'
                      : 'Hardware settlement'
                  }
                  recipientAddress={
                    activeQuote?.destination ??
                    (selectedRail === 'NR_TOKEN' ? 'NXL internal ledger' : 'Unavailable')
                  }
                  isMerchantVault={Boolean(activeQuote?.destination)}
                  destinationTagOrMemo={reviewMemo}
                  assetSymbol={activeToken}
                  isNativeAsset={true}
                  amount={activeTotalCrypto}
                  networkFee={selectedRail === 'NR_TOKEN' ? 'None (internal ledger)' : 'Paid by your wallet'}
                  isSigning={isProcessing}
                  onConfirmSign={async () => {
                    await handleConfirmAndPay();
                  }}
                  onCancel={() => setShowSafetyCenter(false)}
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Wallet Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090C] text-white flex items-center justify-center font-mono text-xs">
        <div className="w-8 h-8 border-2 border-[#7FF8C6] border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
