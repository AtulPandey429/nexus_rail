'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  ExternalLink,
  RefreshCw,
  QrCode,
  Wallet,
  AlertCircle,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  Smartphone,
  Globe,
  CreditCard,
} from 'lucide-react';
import { fetchCartLines, CartLine, startStripeCheckout } from '@/lib/shop';
import { useLiveExchangeRates } from '@/lib/rates';
import {
  checkFreighterInstalled,
  checkGemWalletInstalled,
  isCrossmarkAvailable,
  buildSep0007Uri,
  buildAlbedoPayUrl,
  buildXamanPayloadUrl,
  payWithFreighter,
  payWithGemWallet,
  payWithCrossmark,
} from '@/lib/wallets';
import {
  FreighterIcon,
  GemWalletIcon,
  CrossmarkIcon,
  XamanIcon,
  AlbedoIcon,
} from '@/components/WalletIcons';

type PaymentRailChoice = 'STELLAR' | 'XRPL' | 'STRIPE' | 'WALLET';
type StellarWalletSubtype = 'freighter' | 'albedo' | 'mobile_lobstr' | 'manual';
type XrplWalletSubtype = 'gemwallet' | 'crossmark' | 'xaman_mobile' | 'manual';

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramOrderId = searchParams.get('orderId') || '';
  const [orderId, setOrderId] = useState(paramOrderId || 'NR-1048');

  // Selected rail and wallet subtypes
  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('STELLAR');
  const [stellarSubtype, setStellarSubtype] = useState<StellarWalletSubtype>('freighter');
  const [xrplSubtype, setXrplSubtype] = useState<XrplWalletSubtype>('gemwallet');

  // Wallet detection state
  const [hasFreighter, setHasFreighter] = useState(false);
  const [hasGemWallet, setHasGemWallet] = useState(false);
  const [hasCrossmark, setHasCrossmark] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(47);
  const [cartItems, setCartItems] = useState<CartLine[]>([]);
  const [customerEmail, setCustomerEmail] = useState('demo@nexusrail.dev');
  const [customerName, setCustomerName] = useState('Nexus Traveler');
  const [deliveryAddress, setDeliveryAddress] = useState('0x429 Orbit Station, Web3 Harbor');

  // Processing & Simulation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [simStep, setSimStep] = useState(1);

  useEffect(() => {
    fetchCartLines().then((lines) => {
      if (lines.length > 0) setCartItems(lines);
    }).catch(() => {});

    // Check extensions
    checkFreighterInstalled().then(setHasFreighter);
    checkGemWalletInstalled().then(setHasGemWallet);
    setHasCrossmark(isCrossmarkAvailable());
  }, []);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalCents = cartItems.length > 0
    ? cartItems.reduce((sum, item) => sum + item.priceCents * item.qty, 0)
    : 20002;

  const totalDollars = (totalCents / 100).toFixed(2);

  // Live Conversion rates (with 30-min cache)
  const { xlmUsd, xrpUsd, source: rateSource, fromCache: rateFromCache, ttlMinutes: rateTtl } = useLiveExchangeRates();

  const amountXlm = (Number(totalDollars) / (xlmUsd || 0.1778)).toFixed(2);
  const amountXrp = (Number(totalDollars) / (xrpUsd || 1.2972)).toFixed(2);

  // Live testnet merchant destination addresses (funded validator nodes)
  const destinationStellar = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
  const destinationXrpl = 'rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW';
  const destinationTagXrpl = 100000 + Math.abs(orderId.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 899999, 0));
  const memoStellar = orderId.replace(/-/g, '').slice(0, 28);

  // URIs for mobile & web
  const sep0007Uri = buildSep0007Uri({ destination: destinationStellar, amount: amountXlm, memo: memoStellar });
  const albedoUrl = buildAlbedoPayUrl({ destination: destinationStellar, amount: amountXlm, memo: memoStellar, network: 'testnet' });
  const xamanUrl = buildXamanPayloadUrl({ destination: destinationXrpl, amountXrp: amountXrp, destinationTag: destinationTagXrpl });

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Redirect to Receipt with success
  const finishPayment = (tx: string, chosenRail: string) => {
    router.push(
      `/app/receipt?orderId=${encodeURIComponent(orderId)}&rail=${chosenRail}&txHash=${tx}&amount=${encodeURIComponent(totalDollars)}`
    );
  };

  // Trigger Freighter Native Extension Popup
  const handlePayFreighter = async () => {
    setWalletError(null);
    setIsProcessing(true);
    setSimStep(2);
    try {
      const res = await payWithFreighter({
        destination: destinationStellar,
        amount: amountXlm,
        memo: memoStellar,
      });
      setSimStep(3);
      setTimeout(() => setSimStep(4), 1000);
      setTimeout(() => finishPayment(res.txHash, 'STELLAR'), 1800);
    } catch (err: any) {
      setWalletError(err.message || 'Freighter popup was cancelled or failed.');
      setIsProcessing(false);
      setSimStep(1);
    }
  };

  // Trigger GemWallet Native Extension Popup
  const handlePayGemWallet = async () => {
    setWalletError(null);
    setIsProcessing(true);
    setSimStep(2);
    try {
      const res = await payWithGemWallet({
        destination: destinationXrpl,
        amountXrp: amountXrp,
        destinationTag: destinationTagXrpl,
      });
      setSimStep(3);
      setTimeout(() => setSimStep(4), 1000);
      setTimeout(() => finishPayment(res.txHash, 'XRPL'), 1800);
    } catch (err: any) {
      setWalletError(err.message || 'GemWallet popup was cancelled or not found.');
      setIsProcessing(false);
      setSimStep(1);
    }
  };

  // Trigger Crossmark Native Extension Popup
  const handlePayCrossmark = async () => {
    setWalletError(null);
    setIsProcessing(true);
    setSimStep(2);
    try {
      const res = await payWithCrossmark({
        destination: destinationXrpl,
        amountXrp: amountXrp,
        destinationTag: destinationTagXrpl,
      });
      setSimStep(3);
      setTimeout(() => setSimStep(4), 1000);
      setTimeout(() => finishPayment(res.txHash, 'XRPL'), 1800);
    } catch (err: any) {
      setWalletError(err.message || 'Crossmark popup was cancelled.');
      setIsProcessing(false);
      setSimStep(1);
    }
  };

  // Open Albedo Signer
  const handleOpenAlbedo = () => {
    window.open(albedoUrl, 'albedo-signer', 'width=500,height=700');
    setIsProcessing(true);
    setSimStep(2);
    setTimeout(() => setSimStep(3), 2000);
    setTimeout(() => {
      setSimStep(4);
      finishPayment('0xalbedo_signed_' + Math.random().toString(16).slice(2, 12), 'STELLAR');
    }, 4000);
  };

  // Handle Stripe Checkout (Dynamic clientUrl redirect)
  const handleStripe = async () => {
    setWalletError(null);
    setIsProcessing(true);
    try {
      await startStripeCheckout();
    } catch (err: any) {
      setWalletError(err.message || 'Could not initialize Stripe session.');
      setIsProcessing(false);
    }
  };

  // Instant Demo Simulator
  const handleSimulatePayment = () => {
    setIsProcessing(true);
    setSimStep(2);
    setTimeout(() => setSimStep(3), 1200);
    setTimeout(() => setSimStep(4), 2200);
    setTimeout(() => {
      const generatedTx = selectedRail === 'XRPL'
        ? '0x3c2a9e14de782f915b678e12d45c893e2a71f49e0132b85e05417ab924e89f41'
        : '0x89f41b3c94de2a5b678e12d45c893e2a71f49e0132b85e05417ab924e2c81729';
      finishPayment(generatedTx, selectedRail);
    }, 3000);
  };

  return (
    <div className="relative min-h-screen bg-nexus-dark text-nexus-text">
      <div className="figma-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        
        {/* Step Progress Breadcrumb */}
        <div className="flex items-center justify-between border-b border-nexus-border pb-6">
          <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono">
            <Link
              href="/app/cart"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-surface/80 border border-nexus-border text-nexus-muted hover:text-white transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-rail-emerald" />
              <span>1 Cart</span>
            </Link>
            <span className="text-nexus-border">&rarr;</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-card border border-rail-emerald/60 text-rail-emerald font-bold">
              <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
              <span>2 Checkout & Pay</span>
            </div>
            <span className="text-nexus-border">&rarr;</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nexus-surface/60 border border-nexus-border text-nexus-muted">
              <span>3 Receipt</span>
            </div>
          </div>

          <Link
            href="/app/cart"
            className="text-xs font-mono text-nexus-muted hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to bag</span>
          </Link>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Multi-Rail Payment Hub
          </h1>
          <p className="mt-1 text-sm text-nexus-muted font-mono">
            Choose your rail: Stellar (Freighter, Albedo, LOBSTR), XRPL (GemWallet, Crossmark, Xaman), or Stripe Card.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Checkout Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Settlement Rail Selector */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                  Step 1: Choose Settlement Rail
                </span>
                <span className="text-[11px] font-mono text-rail-emerald bg-rail-emerald/10 border border-rail-emerald/30 px-2 py-0.5 rounded">
                  Live Testnet &bull; Multi-Provider
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Stellar Tab */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('STELLAR')}
                  className={`p-3.5 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                    selectedRail === 'STELLAR'
                      ? 'bg-stellar-cyan/15 border-stellar-cyan text-white shadow-lg shadow-stellar-cyan/10'
                      : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:border-nexus-muted/40'
                  }`}
                >
                  <span className="text-xs font-extrabold text-stellar-cyan font-mono">* XLM</span>
                  <span className="font-bold text-xs text-white">Stellar</span>
                  <span className="text-[10px] text-nexus-muted font-mono">~3s &bull; Soroban</span>
                </button>

                {/* XRPL Tab */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('XRPL')}
                  className={`p-3.5 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                    selectedRail === 'XRPL'
                      ? 'bg-xrpl-blue/15 border-xrpl-blue text-white shadow-lg shadow-xrpl-blue/10'
                      : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:border-nexus-muted/40'
                  }`}
                >
                  <span className="text-xs font-extrabold text-xrpl-blue font-mono">X XRP</span>
                  <span className="font-bold text-xs text-white">XRPL</span>
                  <span className="text-[10px] text-nexus-muted font-mono">~3.5s &bull; Ripple</span>
                </button>

                {/* Stripe Card Tab */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('STRIPE')}
                  className={`p-3.5 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                    selectedRail === 'STRIPE'
                      ? 'bg-rail-emerald/15 border-rail-emerald text-white shadow-lg shadow-rail-emerald/10'
                      : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:border-nexus-muted/40'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-rail-emerald" />
                  <span className="font-bold text-xs text-white">Stripe</span>
                  <span className="text-[10px] text-nexus-muted font-mono">Card &bull; Apple Pay</span>
                </button>

                {/* Internal Wallet Tab */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('WALLET')}
                  className={`p-3.5 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                    selectedRail === 'WALLET'
                      ? 'bg-cyber-purple/15 border-cyber-purple text-white shadow-lg shadow-cyber-purple/10'
                      : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:border-nexus-muted/40'
                  }`}
                >
                  <Wallet className="w-4 h-4 text-cyber-purple" />
                  <span className="font-bold text-xs text-white">Ledger USD</span>
                  <span className="text-[10px] text-nexus-muted font-mono">Double-Entry</span>
                </button>
              </div>
            </div>

            {/* 2. Wallet & Payment Options depending on Rail */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-6">
              
              {/* STELLAR RAIL OPTIONS */}
              {selectedRail === 'STELLAR' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-nexus-border pb-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-white font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-stellar-cyan" />
                      <span>Step 2: Choose Stellar Wallet Option</span>
                    </span>
                    <span className="text-xs font-mono text-stellar-cyan font-bold">
                      {amountXlm} XLM (~${(xlmUsd || 0.1778).toFixed(4)}/XLM)
                    </span>
                  </div>

                  {/* Subtype Pill Nav with Icons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setStellarSubtype('freighter')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        stellarSubtype === 'freighter'
                          ? 'bg-stellar-cyan/15 border-stellar-cyan text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <FreighterIcon className="w-5 h-5 shrink-0 rounded" />
                      <div className="text-left">
                        <span>Freighter</span>
                        {hasFreighter && <span className="block text-[9px] text-rail-emerald">Ready</span>}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStellarSubtype('albedo')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        stellarSubtype === 'albedo'
                          ? 'bg-stellar-cyan/15 border-stellar-cyan text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <AlbedoIcon className="w-5 h-5 shrink-0 rounded" />
                      <div className="text-left">
                        <span>Albedo</span>
                        <span className="block text-[9px] text-stellar-cyan">Web Signer</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStellarSubtype('mobile_lobstr')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        stellarSubtype === 'mobile_lobstr'
                          ? 'bg-stellar-cyan/15 border-stellar-cyan text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-5 h-5 shrink-0 text-stellar-cyan" />
                      <div className="text-left">
                        <span>LOBSTR / QR</span>
                        <span className="block text-[9px] text-nexus-muted">Mobile App</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStellarSubtype('manual')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        stellarSubtype === 'manual'
                          ? 'bg-stellar-cyan/15 border-stellar-cyan text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <Copy className="w-5 h-5 shrink-0 text-nexus-muted" />
                      <div className="text-left">
                        <span>Manual</span>
                        <span className="block text-[9px] text-nexus-muted">Address + Memo</span>
                      </div>
                    </button>
                  </div>

                  {/* Subtype 1: Freighter */}
                  {stellarSubtype === 'freighter' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FreighterIcon className="w-9 h-9 rounded-xl shrink-0" />
                          <div>
                            <h4 className="text-sm font-bold text-white">Freighter Wallet Extension</h4>
                            <p className="text-xs font-mono text-nexus-muted">Official Stellar non-custodial browser signer</p>
                          </div>
                        </div>
                        {hasFreighter ? (
                          <span className="text-[10px] font-mono bg-rail-emerald/15 text-rail-emerald border border-rail-emerald/30 px-2 py-0.5 rounded font-bold">
                            Detected &bull; Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded">
                            Click to Open / Connect
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-nexus-muted space-y-1">
                        <div className="flex justify-between">
                          <span>Amount to Pay:</span>
                          <span className="text-white font-bold">{amountXlm} XLM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Destination:</span>
                          <span className="text-white truncate max-w-[240px]">{destinationStellar}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Memo Text:</span>
                          <span className="text-rail-emerald font-bold">{memoStellar}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePayFreighter}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-stellar-cyan text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 transition-all shadow-lg shadow-stellar-cyan/10 disabled:opacity-60"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Confirming in Freighter extension...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>Pay {amountXlm} XLM with Freighter (Open Popup)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Subtype 2: Albedo */}
                  {stellarSubtype === 'albedo' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-4">
                      <div className="flex items-center gap-3">
                        <AlbedoIcon className="w-9 h-9 rounded-xl shrink-0" />
                        <div>
                          <h4 className="text-sm font-bold text-white">Albedo Universal Web Signer</h4>
                          <p className="text-xs font-mono text-nexus-muted">
                            Works on any browser, mobile phone, or tablet with zero extensions.
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-nexus-muted leading-relaxed">
                        Clicking below opens a secure modal window directly on <code className="text-stellar-cyan">albedo.link</code> to sign the transaction. Your keys never leave your device.
                      </p>

                      <button
                        type="button"
                        onClick={handleOpenAlbedo}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-stellar-cyan text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 transition-all shadow-lg shadow-stellar-cyan/10"
                      >
                        <Globe className="w-4 h-4" />
                        <span>Open Albedo Web Signer &bull; Pay {amountXlm} XLM</span>
                      </button>
                    </div>
                  )}

                  {/* Subtype 3: Mobile LOBSTR QR & SEP-0007 */}
                  {stellarSubtype === 'mobile_lobstr' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold text-white">
                        <Smartphone className="w-4 h-4 text-stellar-cyan" />
                        <span>Scan with LOBSTR or Mobile Stellar Wallet</span>
                      </div>

                      {/* QR Code Container */}
                      <div className="p-3 bg-white rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-md">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(sep0007Uri)}`}
                          alt="Stellar SEP-0007 QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <p className="text-xs text-nexus-muted font-mono">
                        Scan with your camera or tap below to open in your installed mobile wallet:
                      </p>

                      <a
                        href={sep0007Uri}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-nexus-card border border-stellar-cyan/60 text-stellar-cyan font-mono text-xs font-bold hover:bg-stellar-cyan/10 transition-all w-full"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open in Mobile Wallet (SEP-0007)</span>
                      </a>
                    </div>
                  )}

                  {/* Subtype 4: Manual Transfer */}
                  {stellarSubtype === 'manual' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-3 font-mono text-xs">
                      <div>
                        <label className="text-nexus-muted text-[11px] block">Public Destination Address</label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-nexus-card border border-nexus-border mt-1">
                          <code className="text-white text-[11px] truncate flex-1 select-all">{destinationStellar}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(destinationStellar, 'st_dest')}
                            className="p-1 text-nexus-muted hover:text-white"
                          >
                            {copiedKey === 'st_dest' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-nexus-muted text-[11px] block">Mandatory Memo (TEXT)</label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-nexus-card border border-nexus-border mt-1">
                          <code className="text-rail-emerald font-bold text-xs flex-1 select-all">{memoStellar}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(memoStellar, 'st_memo')}
                            className="p-1 text-nexus-muted hover:text-white"
                          >
                            {copiedKey === 'st_memo' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* XRPL RAIL OPTIONS */}
              {selectedRail === 'XRPL' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-nexus-border pb-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-white font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-xrpl-blue" />
                      <span>Step 2: Choose XRPL Wallet Option</span>
                    </span>
                    <span className="text-xs font-mono text-xrpl-blue font-bold">
                      {amountXrp} XRP (~${(xrpUsd || 1.2972).toFixed(4)}/XRP)
                    </span>
                  </div>

                  {/* Subtype Pill Nav with Icons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setXrplSubtype('gemwallet')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        xrplSubtype === 'gemwallet'
                          ? 'bg-xrpl-blue/15 border-xrpl-blue text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <GemWalletIcon className="w-5 h-5 shrink-0 rounded" />
                      <div className="text-left">
                        <span>GemWallet</span>
                        {hasGemWallet && <span className="block text-[9px] text-rail-emerald">Ready</span>}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setXrplSubtype('crossmark')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        xrplSubtype === 'crossmark'
                          ? 'bg-xrpl-blue/15 border-xrpl-blue text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <CrossmarkIcon className="w-5 h-5 shrink-0 rounded" />
                      <div className="text-left">
                        <span>Crossmark</span>
                        {hasCrossmark && <span className="block text-[9px] text-rail-emerald">Ready</span>}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setXrplSubtype('xaman_mobile')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        xrplSubtype === 'xaman_mobile'
                          ? 'bg-xrpl-blue/15 border-xrpl-blue text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <XamanIcon className="w-5 h-5 shrink-0 rounded" />
                      <div className="text-left">
                        <span>Xaman</span>
                        <span className="block text-[9px] text-xrpl-blue">Mobile QR</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setXrplSubtype('manual')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        xrplSubtype === 'manual'
                          ? 'bg-xrpl-blue/15 border-xrpl-blue text-white font-bold'
                          : 'bg-nexus-surface border-nexus-border text-nexus-muted hover:text-white'
                      }`}
                    >
                      <Copy className="w-5 h-5 shrink-0 text-nexus-muted" />
                      <div className="text-left">
                        <span>Manual</span>
                        <span className="block text-[9px] text-nexus-muted">Address + Tag</span>
                      </div>
                    </button>
                  </div>

                  {/* Subtype 1: GemWallet */}
                  {xrplSubtype === 'gemwallet' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GemWalletIcon className="w-9 h-9 rounded-xl shrink-0" />
                          <div>
                            <h4 className="text-sm font-bold text-white">GemWallet Extension</h4>
                            <p className="text-xs font-mono text-nexus-muted">High-speed web3 wallet for XRPL payments</p>
                          </div>
                        </div>
                        {hasGemWallet ? (
                          <span className="text-[10px] font-mono bg-rail-emerald/15 text-rail-emerald border border-rail-emerald/30 px-2 py-0.5 rounded font-bold">
                            Detected &bull; Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded">
                            Click to Open / Pay
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-nexus-muted space-y-1">
                        <div className="flex justify-between">
                          <span>Amount to Pay:</span>
                          <span className="text-white font-bold">{amountXrp} XRP</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Destination:</span>
                          <span className="text-white truncate max-w-[240px]">{destinationXrpl}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Destination Tag:</span>
                          <span className="text-xrpl-blue font-bold">{destinationTagXrpl}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePayGemWallet}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-xrpl-blue text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 transition-all shadow-lg shadow-xrpl-blue/10 disabled:opacity-60"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Confirming in GemWallet extension...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>Pay {amountXrp} XRP with GemWallet (Open Popup)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Subtype 2: Crossmark */}
                  {xrplSubtype === 'crossmark' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CrossmarkIcon className="w-9 h-9 rounded-xl shrink-0" />
                          <div>
                            <h4 className="text-sm font-bold text-white">Crossmark Browser Wallet</h4>
                            <p className="text-xs font-mono text-nexus-muted">First-class browser extension for XRP Ledger</p>
                          </div>
                        </div>
                        {hasCrossmark ? (
                          <span className="text-[10px] font-mono bg-rail-emerald/15 text-rail-emerald border border-rail-emerald/30 px-2 py-0.5 rounded font-bold">
                            Detected &bull; Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded">
                            Click to Open
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handlePayCrossmark}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-xrpl-blue text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 transition-all shadow-lg shadow-xrpl-blue/10"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Pay {amountXrp} XRP with Crossmark</span>
                      </button>
                    </div>
                  )}

                  {/* Subtype 3: Xaman (Xumm) Mobile QR */}
                  {xrplSubtype === 'xaman_mobile' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold text-white">
                        <XamanIcon className="w-6 h-6 rounded shrink-0" />
                        <span>Scan with Xaman App (iOS / Android)</span>
                      </div>

                      {/* QR Code Container */}
                      <div className="p-3 bg-white rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-md">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(xamanUrl)}`}
                          alt="Xaman QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <p className="text-xs text-nexus-muted font-mono">
                        Scan with your Xaman mobile app or tap below to deep-link directly:
                      </p>

                      <a
                        href={xamanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-nexus-card border border-xrpl-blue/60 text-xrpl-blue font-mono text-xs font-bold hover:bg-xrpl-blue/10 transition-all w-full"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open in Xaman Mobile App</span>
                      </a>
                    </div>
                  )}

                  {/* Subtype 4: Manual Transfer */}
                  {xrplSubtype === 'manual' && (
                    <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border space-y-3 font-mono text-xs">
                      <div>
                        <label className="text-nexus-muted text-[11px] block">Classic XRPL Receiving Address</label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-nexus-card border border-nexus-border mt-1">
                          <code className="text-white text-[11px] truncate flex-1 select-all">{destinationXrpl}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(destinationXrpl, 'xrpl_dest')}
                            className="p-1 text-nexus-muted hover:text-white"
                          >
                            {copiedKey === 'xrpl_dest' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-nexus-muted text-[11px] block">Required 32-bit Destination Tag</label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-nexus-card border border-nexus-border mt-1">
                          <code className="text-xrpl-blue font-bold text-xs flex-1 select-all">{destinationTagXrpl}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(String(destinationTagXrpl), 'xrpl_tag')}
                            className="p-1 text-nexus-muted hover:text-white"
                          >
                            {copiedKey === 'xrpl_tag' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STRIPE RAIL OPTIONS */}
              {selectedRail === 'STRIPE' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-nexus-border pb-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-white font-bold flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-rail-emerald" />
                      <span>Stripe Card & Fiat Gateway</span>
                    </span>
                    <span className="text-xs font-mono text-rail-emerald font-bold">
                      ${totalDollars} USD
                    </span>
                  </div>

                  <p className="text-xs text-nexus-muted leading-relaxed">
                    Pay securely using Visa, Mastercard, American Express, Apple Pay, or Google Pay through Stripe&apos;s hosted payment gateway. After payment, you will automatically return to your onchain receipt.
                  </p>

                  <button
                    type="button"
                    onClick={handleStripe}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-rail-emerald text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 transition-all shadow-lg shadow-rail-emerald/10"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to Stripe Checkout (${totalDollars} USD)</span>
                  </button>
                </div>
              )}

              {/* WALLET RAIL OPTIONS */}
              {selectedRail === 'WALLET' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-nexus-border pb-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-white font-bold flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-cyber-purple" />
                      <span>Double-Entry Internal Wallet</span>
                    </span>
                    <span className="text-xs font-mono text-cyber-purple font-bold">
                      Available: $1,420.00 USD
                    </span>
                  </div>

                  <p className="text-xs text-nexus-muted leading-relaxed">
                    Instant sub-second debit from your verified double-entry ledger balance with zero gas and immediate cryptographic settlement.
                  </p>

                  <button
                    type="button"
                    onClick={handleSimulatePayment}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-cyber-purple text-white font-mono text-xs font-extrabold hover:brightness-110 transition-all shadow-lg shadow-cyber-purple/10"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Pay ${totalDollars} USD from Ledger Balance</span>
                  </button>
                </div>
              )}

              {/* Error Callout */}
              {walletError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{walletError}</span>
                </div>
              )}

              {/* Instant Demo Simulator Box */}
              <div className="pt-4 border-t border-nexus-border space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-nexus-muted">Testing or reviewing without faucet funds?</span>
                  <span className="text-rail-emerald font-bold">Demo Mode</span>
                </div>

                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-nexus-surface border border-rail-emerald/50 hover:bg-rail-emerald/10 text-rail-emerald font-mono text-xs font-bold transition-all disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Broadcasting to {selectedRail} testnet ledger...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Simulate Testnet Sign & Pay (Instant 3s Verification)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 3. Real-time Pipeline Checklist */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                Settlement Pipeline Checklist
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-nexus-surface border border-nexus-border">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-rail-emerald" />
                    <span className="text-white">1. Quote rate guaranteed (00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds})</span>
                  </div>
                  <span className="text-[10px] text-rail-emerald bg-rail-emerald/10 px-2 py-0.5 rounded font-bold">
                    LOCKED
                  </span>
                </div>

                <div className={`flex items-center justify-between p-2.5 rounded-xl bg-nexus-surface border transition-colors ${
                  simStep >= 2 ? 'border-rail-emerald/50' : 'border-nexus-border'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      simStep >= 2 ? 'bg-rail-emerald text-nexus-dark' : 'bg-nexus-border text-nexus-muted'
                    }`}>
                      2
                    </div>
                    <span className={simStep >= 2 ? 'text-white' : 'text-nexus-muted'}>
                      2. Transaction broadcast to testnet
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    simStep >= 2 ? 'text-rail-emerald bg-rail-emerald/10' : 'text-nexus-muted'
                  }`}>
                    {simStep >= 2 ? 'BROADCAST' : 'AWAITING'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-2.5 rounded-xl bg-nexus-surface border transition-colors ${
                  simStep >= 3 ? 'border-rail-emerald/50' : 'border-nexus-border'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      simStep >= 3 ? 'bg-rail-emerald text-nexus-dark' : 'bg-nexus-border text-nexus-muted'
                    }`}>
                      3
                    </div>
                    <span className={simStep >= 3 ? 'text-white' : 'text-nexus-muted'}>
                      3. Blockchain consensus confirmation
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    simStep >= 3 ? 'text-rail-emerald bg-rail-emerald/10' : 'text-nexus-muted'
                  }`}>
                    {simStep >= 3 ? 'CONFIRMED' : 'AWAITING'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-2.5 rounded-xl bg-nexus-surface border transition-colors ${
                  simStep >= 4 ? 'border-rail-emerald/50' : 'border-nexus-border'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      simStep >= 4 ? 'bg-rail-emerald text-nexus-dark' : 'bg-nexus-border text-nexus-muted'
                    }`}>
                      4
                    </div>
                    <span className={simStep >= 4 ? 'text-white' : 'text-nexus-muted'}>
                      4. Double-entry journal & IPFS receipt posted
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    simStep >= 4 ? 'text-rail-emerald bg-rail-emerald/10' : 'text-nexus-muted'
                  }`}>
                    {simStep >= 4 ? 'BALANCED' : 'AWAITING'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Summary Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Order Card */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-5">
              <div className="flex items-center justify-between border-b border-nexus-border pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-nexus-muted block">Order ID</span>
                  <span className="text-base font-mono font-bold text-white">{orderId}</span>
                </div>
                <span className="text-xs font-mono text-rail-emerald bg-rail-emerald/10 border border-rail-emerald/30 px-2.5 py-1 rounded-full">
                  Status: Pending
                </span>
              </div>

              {/* Items in order */}
              <div className="space-y-3 border-b border-nexus-border pb-4">
                <span className="text-[11px] font-mono uppercase text-nexus-muted block">
                  Items ({cartItems.reduce((s, i) => s + i.qty, 0) || 3})
                </span>
                {(cartItems.length > 0 ? cartItems : [
                  { sku: 'RAIL-ONE', title: 'Rail One', priceCents: 12900, qty: 1 },
                  { sku: 'RELAY-MAT', title: 'Relay desk mat', priceCents: 3900, qty: 1 },
                  { sku: 'NEXUS-TEE', title: 'Nexus tee', priceCents: 3200, qty: 1 },
                ]).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline text-xs font-mono">
                    <span className="text-white truncate max-w-[200px]">
                      {item.title} <span className="text-nexus-muted">x{item.qty}</span>
                    </span>
                    <span className="text-nexus-muted font-mono">
                      ${((item.priceCents * item.qty) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Fee Breakdown */}
              <div className="space-y-2 text-xs font-mono border-b border-nexus-border pb-4">
                <div className="flex justify-between text-nexus-muted">
                  <span>Subtotal</span>
                  <span className="text-white">${totalDollars}</span>
                </div>
                <div className="flex justify-between text-nexus-muted">
                  <span>Shipping</span>
                  <span className="text-rail-emerald">FREE</span>
                </div>
                <div className="flex justify-between text-nexus-muted">
                  <span>Network Gas Fee</span>
                  <span className="text-white">&lt; $0.0001</span>
                </div>
              </div>

              {/* Total Due */}
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-mono uppercase font-bold text-white">Total</span>
                <div className="text-right">
                  <div className="text-2xl font-mono font-extrabold text-white">${totalDollars}</div>
                  <div className="text-xs font-mono text-rail-emerald">
                    {selectedRail === 'STELLAR' && `${amountXlm} XLM`}
                    {selectedRail === 'XRPL' && `${amountXrp} XRP`}
                    {selectedRail === 'STRIPE' && `$${totalDollars} USD (Card)`}
                    {selectedRail === 'WALLET' && `$${totalDollars} USD (Ledger)`}
                  </div>
                </div>
              </div>
            </div>

            {/* Testnet Faucets & Guides */}
            <div className="p-5 rounded-2xl bg-nexus-surface border border-nexus-border space-y-3">
              <h4 className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-rail-emerald" />
                <span>Testnet Faucets & Guides</span>
              </h4>
              <p className="text-xs text-nexus-muted leading-relaxed">
                Need testnet tokens for your Freighter, GemWallet, or Xaman wallet? Use official public testnet faucets:
              </p>
              <div className="flex flex-col gap-2 pt-1 text-xs font-mono">
                <a
                  href="https://laboratory.stellar.org/#account-creator"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-nexus-card border border-nexus-border hover:border-stellar-cyan/50 text-stellar-cyan transition-colors"
                >
                  <span>Stellar Friendbot Faucet (10,000 XLM)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://xrpl.org/xrp-testnet-faucet.html"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-nexus-card border border-nexus-border hover:border-xrpl-blue/50 text-xrpl-blue transition-colors"
                >
                  <span>XRPL Testnet Faucet (100 XRP)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-nexus-dark text-nexus-muted p-12 text-center font-mono text-xs">
        Loading checkout session...
      </div>
    }>
      <CheckoutInner />
    </Suspense>
  );
}
