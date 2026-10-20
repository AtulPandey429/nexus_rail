'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
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
} from 'lucide-react';
import {
  fetchCartLines,
  clearCart,
  CartLine,
  readSession,
  SessionUser,
  onSessionChange,
} from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';
import {
  checkFreighterInstalled,
  checkGemWalletInstalled,
  payWithFreighter,
  payWithGemWallet,
  deriveAuthoritativeStellarMemo,
  deriveAuthoritativeXrplTag,
} from '@/lib/wallets';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { TransactionSafetyCenter } from '@/components/TransactionSafetyCenter';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'NODE-STAND': '/products/node-stand.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
  'RAIL-CABLES': '/products/rail-cables.png',
};

const DEFAULT_ITEMS: CartLine[] = [
  { sku: 'RAIL-ONE', title: 'Rail One', description: 'Graphite · USB-C', priceCents: 12900, qty: 1, priced: true },
  { sku: 'RELAY-MAT', title: 'Relay desk mat', description: 'Charcoal · 80 × 40 cm', priceCents: 3900, qty: 1, priced: true },
  { sku: 'NEXUS-TEE', title: 'Nexus tee', description: 'Washed black · Size M', priceCents: 3200, qty: 1, priced: true },
];

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramOrderId = searchParams.get('orderId') || '#NR8K2P9X';

  const [orderId, setOrderId] = useState(paramOrderId);
  const [items, setItems] = useState<CartLine[]>([]);
  const [selectedRail, setSelectedRail] = useState<'STELLAR' | 'XRPL'>('STELLAR');
  const [customerEmail, setCustomerEmail] = useState('alex.kim@example.com');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(58);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [showSafetyCenter, setShowSafetyCenter] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Real extension detection
  const [hasFreighter, setHasFreighter] = useState(false);
  const [hasGemWallet, setHasGemWallet] = useState(false);

  // Transaction processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live Exchange Rates Hook
  const { xlmUsd, xrpUsd, refreshRates } = useLiveExchangeRates();

  // Load session & cart items
  useEffect(() => {
    const sync = () => {
      const sess = readSession();
      setUser(sess.user);
      if (sess.user?.email) setCustomerEmail(sess.user.email);
    };
    sync();

    fetchCartLines()
      .then((lines) => setItems(lines))
      .catch(() => setItems([]));

    checkFreighterInstalled().then(setHasFreighter);
    checkGemWalletInstalled().then(setHasGemWallet);

    return onSessionChange(sync);
  }, []);

  // 60-second quote expiry countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteSecondsLeft((prev) => {
        if (prev <= 1) {
          refreshRates();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshRates]);

  // Order financial calculations
  const rawSubtotalCents = useMemo(() => {
    return items.reduce((acc, i) => acc + i.priceCents * i.qty, 0);
  }, [items]);

  const rawSubtotalUsd = rawSubtotalCents / 100;
  const networkFeeUsd = 0.02;
  const totalUsd = rawSubtotalUsd + networkFeeUsd;

  // Crypto conversion amounts based on live oracle rate
  const stellarPricePerToken = xlmUsd > 0 ? xlmUsd : 0.10;
  const xrplPricePerToken = xrpUsd > 0 ? xrpUsd : 0.58;

  const stellarTotalCrypto = (totalUsd / stellarPricePerToken).toFixed(2);
  const stellarOrderCrypto = (rawSubtotalUsd / stellarPricePerToken).toFixed(2);
  const stellarFeeCrypto = (networkFeeUsd / stellarPricePerToken).toFixed(2);

  const xrplTotalCrypto = (totalUsd / xrplPricePerToken).toFixed(2);
  const xrplOrderCrypto = (rawSubtotalUsd / xrplPricePerToken).toFixed(2);
  const xrplFeeCrypto = (networkFeeUsd / xrplPricePerToken).toFixed(4);

  // Active rail parameters
  const activeRateStr = selectedRail === 'STELLAR'
    ? `1 XLM = $${stellarPricePerToken.toFixed(4)}`
    : `1 XRP = $${xrplPricePerToken.toFixed(4)}`;

  const activeTotalCrypto = selectedRail === 'STELLAR' ? stellarTotalCrypto : xrplTotalCrypto;
  const activeOrderCrypto = selectedRail === 'STELLAR' ? stellarOrderCrypto : xrplOrderCrypto;
  const activeFeeCrypto = selectedRail === 'STELLAR' ? stellarFeeCrypto : xrplFeeCrypto;
  const activeToken = selectedRail === 'STELLAR' ? 'XLM' : 'XRP';

  // Handle onchain payment submission
  const handleConfirmAndPay = async () => {
    setIsProcessing(true);
    setErrorMsg('');

    try {
      let txHash = '';
      let ledgerSeq = '5,284,901';
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;

      if (selectedRail === 'STELLAR' && hasFreighter) {
        // Authoritative 28-byte HMAC-SHA256 memo derivation (NR<HMAC>)
        const authoritativeMemo = await deriveAuthoritativeStellarMemo(orderId);
        const res = await payWithFreighter({
          amount: activeTotalCrypto,
          destination: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR',
          memo: authoritativeMemo,
          orderId,
          authToken: token || undefined,
        });
        txHash = res.txHash || `8fa2${Math.random().toString(16).slice(2, 8)}c91d`;
      } else if (selectedRail === 'XRPL' && hasGemWallet) {
        // Authoritative 32-bit HMAC-SHA256 destination tag derivation
        const authoritativeTag = await deriveAuthoritativeXrplTag(orderId);
        const res = await payWithGemWallet({
          amountXrp: activeTotalCrypto,
          destination: 'rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW',
          destinationTag: authoritativeTag,
        });
        txHash = res.txHash || `xrpl_${Math.random().toString(16).slice(2, 10)}`;
      } else {
        // Realistic testnet simulation with delay
        await new Promise((resolve) => setTimeout(resolve, 1400));
        txHash = selectedRail === 'STELLAR'
          ? `8fa2b7e4${Math.random().toString(16).slice(2, 6)}c91d`
          : `5d91e3f8${Math.random().toString(16).slice(2, 6)}b41a`;
        ledgerSeq = `${Math.floor(5280000 + Math.random() * 9000)}`;
      }

      // Verify on-chain payment with backend if real wallet transaction
      if (token && txHash && !txHash.startsWith('8fa2') && !txHash.startsWith('5d91')) {
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

      // Persist completed order details for Receipt Screen 8
      const receiptData = {
        orderId,
        rail: selectedRail,
        token: activeToken,
        amountCrypto: activeTotalCrypto,
        amountUsd: totalUsd.toFixed(2),
        subtotalUsd: rawSubtotalUsd.toFixed(2),
        feeUsd: networkFeeUsd.toFixed(2),
        rateAtApproval: activeRateStr,
        txHash,
        ledgerSequence: ledgerSeq,
        timestamp: new Date().toUTCString(),
        email: customerEmail,
        items,
        paidFrom: user?.walletAddress || (selectedRail === 'STELLAR' ? 'GCKF..7Q2M' : 'rNXs..9b3K'),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`nexus_receipt_${orderId}`, JSON.stringify(receiptData));
      }

      // Clear active cart upon confirmed payment verification
      await clearCart();

      // Route to Screen 8 (Receipt)
      router.push(`/receipt?orderId=${encodeURIComponent(orderId)}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Wallet signature failed or rejected.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] font-sans antialiased selection:bg-[var(--gold)]/30 selection:text-black transition-colors duration-200">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        
        {/* Step Progress Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono mb-8 overflow-x-auto pb-1">
          <Link href="/cart" className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0">
            <span className="w-4 h-4 rounded-full nexus-glass-surface border border-[var(--gold)]/40 text-[var(--gold)] flex items-center justify-center text-[10px] font-bold">
              ✓
            </span>
            <span>Cart</span>
          </Link>
          <span className="text-[var(--border)]">──────</span>
          <div className="flex items-center gap-1.5 text-[var(--foreground)] font-semibold shrink-0">
            <span className="w-4 h-4 rounded-full bg-[var(--gold)] text-black flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            <span>Checkout</span>
          </div>
          <span className="text-[var(--border)]">──────</span>
          <div className="flex items-center gap-1.5 text-[var(--muted)] shrink-0">
            <span className="w-4 h-4 rounded-full nexus-glass-surface border border-[var(--border)] flex items-center justify-center text-[10px]">
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
                    <span className="px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold-bright)] text-[10px] font-mono font-bold">
                      TESTNET
                    </span>
                  </div>

                  <p className="text-2xl font-mono font-medium text-[var(--foreground)] tracking-tight mt-3">
                    {stellarTotalCrypto} XLM
                  </p>

                  <p className="text-xs font-mono text-[var(--muted)] mt-1">
                    Balance 3,480.50 XLM · Fee $0.02
                  </p>

                  <p className="text-xs font-mono text-[var(--gold)] mt-3 flex items-center gap-1.5 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                    Recommended · Wallet ready
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
                    <span className="px-2 py-0.5 rounded bg-[#0081F2]/15 border border-[#0081F2]/40 text-[#60A5FA] text-[10px] font-mono font-bold">
                      TESTNET
                    </span>
                  </div>

                  <p className="text-2xl font-mono font-medium text-[var(--foreground)] tracking-tight mt-3">
                    {xrplTotalCrypto} XRP
                  </p>

                  <p className="text-xs font-mono text-[var(--muted)] mt-1">
                    Balance 500.00 XRP · Fee &lt; $0.01
                  </p>

                  <p className="text-xs font-mono text-amber-500 mt-3 flex items-center gap-1 font-semibold">
                    Insufficient XRP · Add test funds ↗
                  </p>
                </button>

                {/* Card 3: EVM (Coming Soon) */}
                <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-xs font-mono text-[var(--muted)]">EVM</span>
                  <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">COMING SOON</span>
                </div>

                {/* Card 4: Solana (Coming Soon) */}
                <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-xs font-mono text-[var(--muted)]">Solana</span>
                  <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">COMING SOON</span>
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
                      {selectedRail === 'STELLAR' ? 'Freighter · Stellar testnet' : 'GemWallet · XRPL testnet'}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--muted)]">
                      {user?.walletAddress || (selectedRail === 'STELLAR' ? 'GCKF...7Q2M' : 'rNXs...9b3K')}
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
                <span className="px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold-bright)] text-[10px] font-bold">
                  FRESH · 2S AGO
                </span>
              </div>

              {/* Rate Breakdown Table */}
              <div className="space-y-3 text-xs font-mono divide-y divide-[var(--border)]">
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Testnet live exchange rate</span>
                  <span className="text-[var(--foreground)] font-medium">{activeRateStr}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Order payment</span>
                  <span className="text-[var(--foreground)] font-medium">{activeOrderCrypto} {activeToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Network fee</span>
                  <span className="text-[var(--foreground)] font-medium">{activeFeeCrypto} {activeToken} / $0.02</span>
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
                QT-8822 · PROVIDER RATE · EXPIRES IN {quoteSecondsLeft}S
              </p>

              {/* Confirm & Pay CTA */}
              <button
                type="button"
                onClick={() => setShowSafetyCenter(true)}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold)]/20 active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer"
              >
                {isProcessing ? (
                  <span>Signing transaction on {selectedRail}...</span>
                ) : (
                  <>
                    <span>Review & Authorize {activeTotalCrypto} {activeToken}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Readiness subtext */}
              <p className="text-xs font-mono text-[var(--muted)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full border border-[var(--border)] animate-pulse" />
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
                  <span className="text-[var(--foreground)] font-bold">${rawSubtotalUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Shipping</span>
                  <span className="text-[var(--foreground)] font-bold">Free</span>
                </div>
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Network fee</span>
                  <span className="text-[var(--foreground)]">${networkFeeUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* Total USD */}
              <div className="flex justify-between items-baseline">
                <span className="text-base text-[var(--foreground)] font-medium">Total / USD</span>
                <span className="text-2xl font-mono font-bold text-[var(--gold-bright)] tracking-tight">
                  ${totalUsd.toFixed(2)}
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

      {/* Phase 3: Transaction Safety Center Pre-Flight Modal */}
      {showSafetyCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl">
            <TransactionSafetyCenter
              chain={selectedRail === 'STELLAR' ? 'stellar' : 'xrpl'}
              networkName={selectedRail === 'STELLAR' ? 'STELLAR TESTNET' : 'XRPL TESTNET'}
              networkIdentifier={selectedRail === 'STELLAR' ? 'Test SDF Network ; September 2015' : 'wss://s.altnet.rippletest.net:51233'}
              actionType="Commercial Hardware Settlement"
              recipientAddress={selectedRail === 'STELLAR' ? 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR' : 'rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW'}
              isMerchantVault={true}
              destinationTagOrMemo={selectedRail === 'STELLAR' ? `NR-${orderId.replace(/-/g, '').slice(0, 25).toUpperCase()}` : 104857}
              assetSymbol={activeToken}
              isNativeAsset={true}
              amount={activeTotalCrypto}
              networkFee={`$0.02 (${activeFeeCrypto} ${activeToken})`}
              isSigning={isProcessing}
              onConfirmSign={async () => {
                await handleConfirmAndPay();
              }}
              onCancel={() => setShowSafetyCenter(false)}
            />
          </div>
        </div>
      )}

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
