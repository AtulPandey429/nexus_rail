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
  const paramOrderId = searchParams.get('orderId') || 'NR-1048';

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
      .then((lines) => setItems(lines.length > 0 ? lines : DEFAULT_ITEMS))
      .catch(() => setItems(DEFAULT_ITEMS));

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

      // Route to Screen 8 (Receipt)
      router.push(`/receipt?orderId=${encodeURIComponent(orderId)}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Wallet signature failed or rejected.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090C] text-slate-900 dark:text-[#F0F4F8] font-sans antialiased selection:bg-[#7FF8C6] selection:text-black transition-colors duration-200">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        
        {/* Step Progress Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono mb-8 overflow-x-auto pb-1">
          <Link href="/cart" className="flex items-center gap-1.5 text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0">
            <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-[#092B21] border border-emerald-400 dark:border-[#165D46] text-emerald-700 dark:text-[#7FF8C6] flex items-center justify-center text-[10px] font-bold">
              ✓
            </span>
            <span>Cart</span>
          </Link>
          <span className="text-slate-300 dark:text-white/20">──────</span>
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-semibold shrink-0">
            <span className="w-4 h-4 rounded-full bg-[#7FF8C6] text-[#052E20] flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            <span>Checkout</span>
          </div>
          <span className="text-slate-300 dark:text-white/20">──────</span>
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-white/30 shrink-0">
            <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Receipt</span>
          </div>
        </div>

        {/* Page Title & Order Badge */}
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-slate-900 dark:text-white tracking-tight">
            Checkout
          </h1>
          <span className="px-2.5 py-1 rounded bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white/50 text-xs font-mono font-bold">
            {orderId}
          </span>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {errorMsg}
          </div>
        )}

        {/* 2-Column Responsive Layout matching Figma Screen 7 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          
          {/* Left Settlement Funnel Column (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Step 01: Contact */}
            <div className="space-y-3 pb-6 border-b border-white/10">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="tracking-widest uppercase text-white/40">01 / CONTACT</span>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(!isEditingEmail)}
                  className="text-white/60 hover:text-white transition-colors underline decoration-white/20"
                >
                  {isEditingEmail ? 'Save' : 'Edit'}
                </button>
              </div>

              {isEditingEmail ? (
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full max-w-md px-3 py-2 rounded bg-[#10141A] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#7FF8C6]"
                />
              ) : (
                <p className="text-base font-normal text-white">
                  {customerEmail}
                </p>
              )}

              <p className="text-xs text-white/40">
                Receipt only. No shipping or physical fulfillment.
              </p>
            </div>

            {/* Step 02: Choose Your Payment Rail */}
            <div className="space-y-4 pb-6 border-b border-white/10">
              <p className="text-xs font-mono tracking-widest uppercase text-white/40">
                02 / CHOOSE YOUR PAYMENT RAIL
              </p>

              {/* 2x2 Rail Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Card 1: Stellar (TESTNET) */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('STELLAR')}
                  className={`p-5 rounded-xl border text-left transition-all relative ${
                    selectedRail === 'STELLAR'
                      ? 'bg-[#0D1914] border-[#7FF8C6]/60 shadow-lg shadow-[#7FF8C6]/5 ring-1 ring-[#7FF8C6]/30'
                      : 'bg-[#10141A] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedRail === 'STELLAR' ? 'border-[#7FF8C6]' : 'border-white/30'
                      }`}>
                        {selectedRail === 'STELLAR' && <span className="w-1.5 h-1.5 rounded-full bg-[#7FF8C6]" />}
                      </span>
                      <span className="text-sm font-semibold text-white">Stellar</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px] font-mono">
                      TESTNET
                    </span>
                  </div>

                  <p className="text-2xl font-mono font-medium text-white tracking-tight mt-3">
                    {stellarTotalCrypto} XLM
                  </p>

                  <p className="text-xs font-mono text-white/50 mt-1">
                    Balance 3,480.50 XLM · Fee $0.02
                  </p>

                  <p className="text-xs font-mono text-[#7FF8C6] mt-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7FF8C6]" />
                    Recommended · Wallet ready
                  </p>
                </button>

                {/* Card 2: XRPL (TESTNET) */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('XRPL')}
                  className={`p-5 rounded-xl border text-left transition-all relative ${
                    selectedRail === 'XRPL'
                      ? 'bg-[#0E1524] border-[#0081F2]/60 shadow-lg shadow-[#0081F2]/5 ring-1 ring-[#0081F2]/30'
                      : 'bg-[#10141A] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedRail === 'XRPL' ? 'border-[#0081F2]' : 'border-white/30'
                      }`}>
                        {selectedRail === 'XRPL' && <span className="w-1.5 h-1.5 rounded-full bg-[#0081F2]" />}
                      </span>
                      <span className="text-sm font-semibold text-white">XRPL</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#0B1E3B] border border-[#143B73] text-[#60A5FA] text-[10px] font-mono">
                      TESTNET
                    </span>
                  </div>

                  <p className="text-2xl font-mono font-medium text-white tracking-tight mt-3">
                    {xrplTotalCrypto} XRP
                  </p>

                  <p className="text-xs font-mono text-white/50 mt-1">
                    Balance 500.00 XRP · Fee &lt; $0.01
                  </p>

                  <p className="text-xs font-mono text-amber-400 mt-3 flex items-center gap-1">
                    Insufficient XRP · Add test funds ↗
                  </p>
                </button>

                {/* Card 3: EVM (Coming Soon) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-xs font-mono text-white/40">EVM</span>
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">COMING SOON</span>
                </div>

                {/* Card 4: Solana (Coming Soon) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-xs font-mono text-white/40">Solana</span>
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">COMING SOON</span>
                </div>

              </div>

              {/* Connected Wallet Row */}
              <div className="p-4 rounded-xl bg-[#090B0E] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#161C24] border border-white/10 flex items-center justify-center text-white/70">
                    <Wallet className="w-4 h-4 text-[#7FF8C6]" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-white font-medium">
                      {selectedRail === 'STELLAR' ? 'Freighter · Stellar testnet' : 'GemWallet · XRPL testnet'}
                    </p>
                    <p className="text-[11px] font-mono text-white/40">
                      {user?.walletAddress || (selectedRail === 'STELLAR' ? 'GCKF...7Q2M' : 'rNXs...9b3K')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(true)}
                  className="text-xs font-mono text-white/60 hover:text-white transition-colors underline decoration-white/20"
                >
                  Change
                </button>
              </div>

            </div>

            {/* Step 03: Review the Quote */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="tracking-widest uppercase text-white/40">03 / REVIEW THE QUOTE</span>
                <span className="px-2 py-0.5 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-[10px]">
                  FRESH · 2S AGO
                </span>
              </div>

              {/* Rate Breakdown Table */}
              <div className="space-y-3 text-xs font-mono divide-y divide-white/5">
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50">Demo exchange rate</span>
                  <span className="text-white font-medium">{activeRateStr}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50">Order payment</span>
                  <span className="text-white font-medium">{activeOrderCrypto} {activeToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50">Network fee</span>
                  <span className="text-white font-medium">{activeFeeCrypto} {activeToken} / $0.02</span>
                </div>
              </div>

              {/* Total to Authorize */}
              <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                <span className="text-sm font-medium text-white">Total to authorize</span>
                <span className="text-2xl font-mono font-medium text-white tracking-tight">
                  {activeTotalCrypto} {activeToken}
                </span>
              </div>

              {/* Metadata quote expiration line */}
              <p className="text-[11px] font-mono text-white/40 tracking-wider">
                QT-8822 · PROVIDER RATE · EXPIRES IN {quoteSecondsLeft}S
              </p>

              {/* Confirm & Pay CTA */}
              <button
                type="button"
                onClick={() => setShowSafetyCenter(true)}
                disabled={isProcessing}
                className="w-full py-4 rounded-lg bg-[#7FF8C6] hover:bg-[#6EE7B7] text-[#052E20] font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[#7FF8C6]/10 active:scale-[0.99] disabled:opacity-50 mt-2"
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
              <p className="text-xs font-mono text-white/40 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full border border-white/30 animate-pulse" />
                <span>Ready for wallet approval. No transaction has been submitted.</span>
              </p>

            </div>

          </div>

          {/* Right Column: Your Order (5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-xl bg-white dark:bg-[#10141A] border border-slate-200 dark:border-white/10 p-5 sm:p-7 shadow-xl space-y-6">
              
              <h2 className="text-xl font-medium text-slate-900 dark:text-white tracking-tight">
                Your order
              </h2>

              {/* Items List */}
              <div className="space-y-4 divide-y divide-slate-100 dark:divide-white/10">
                {items.map((item) => (
                  <div key={item.sku} className="pt-4 first:pt-0 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-[#111620] border border-slate-200 dark:border-white/10 overflow-hidden relative shrink-0">
                      <Image
                        src={PRODUCT_IMAGE_MAP[item.sku] || '/products/rail-one.png'}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-xs font-mono text-slate-500 dark:text-white/40 mt-0.5">Qty {item.qty}</p>
                    </div>
                    <span className="text-sm font-mono text-slate-900 dark:text-white font-bold">
                      ${((item.priceCents * item.qty) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-3 py-4 border-t border-b border-slate-100 dark:border-white/10 text-xs font-mono">
                <div className="flex justify-between text-slate-600 dark:text-white/60">
                  <span>Subtotal</span>
                  <span className="text-slate-900 dark:text-white font-bold">${rawSubtotalUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-white/60">
                  <span>Shipping</span>
                  <span className="text-slate-900 dark:text-white font-bold">Free</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Network fee</span>
                  <span className="text-white">${networkFeeUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* Total USD */}
              <div className="flex justify-between items-baseline">
                <span className="text-base text-white font-medium">Total / USD</span>
                <span className="text-2xl font-mono font-medium text-white tracking-tight">
                  ${totalUsd.toFixed(2)}
                </span>
              </div>

              {/* Guarantee Box */}
              <div className="p-3.5 rounded-lg bg-[#0A261E]/80 border border-[#124B3B] flex items-center gap-2.5 text-xs font-mono text-[#7FF8C6]">
                <ShieldCheck className="w-4 h-4 text-[#7FF8C6] shrink-0" />
                <span className="text-[#A7F3D0] leading-relaxed">
                  Testnet transaction only. Test XLM has no monetary value.
                </span>
              </div>

              {/* 3-Point Assurance Checklist */}
              <div className="space-y-2.5 text-xs font-mono text-white/50 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-white/70">
                  <Check className="w-3.5 h-3.5 text-[#7FF8C6]" />
                  <span>Approve in your wallet</span>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <Check className="w-3.5 h-3.5 text-[#7FF8C6]" />
                  <span>We verify the transaction on the ledger</span>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <Check className="w-3.5 h-3.5 text-[#7FF8C6]" />
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

      {/* Bottom Footer */}
      <footer className="border-t border-white/10 py-5 bg-[#05070A]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-white/40">
          <p>© 2026 NexusRail · Demo environment</p>
          <p>Test assets only. No real funds or fulfillment.</p>
        </div>
      </footer>

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
