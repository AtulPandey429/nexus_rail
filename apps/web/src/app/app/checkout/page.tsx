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
} from 'lucide-react';
import { fetchOrders, fetchCartLines, CartLine } from '@/lib/shop';

type PaymentRailChoice = 'STELLAR' | 'XRPL';

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramOrderId = searchParams.get('orderId') || '';
  const paramTitle = searchParams.get('title') || '';

  const [orderId, setOrderId] = useState(paramOrderId || 'NR-1048');
  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('STELLAR');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(47);
  const [cartItems, setCartItems] = useState<CartLine[]>([]);
  const [customerEmail, setCustomerEmail] = useState('demo@nexusrail.dev');
  const [customerName, setCustomerName] = useState('Nexus Traveler');
  const [deliveryAddress, setDeliveryAddress] = useState('0x429 Orbit Station, Web3 Harbor');

  // Simulation / Verification state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(1); // 1 = lock, 2 = broadcast, 3 = consensus, 4 = journal
  const [manualTxHash, setManualTxHash] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  useEffect(() => {
    fetchCartLines().then((lines) => {
      if (lines.length > 0) setCartItems(lines);
    }).catch(() => {});
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

  // Conversion rates (Stellar XLM ≈ $0.124, XRPL XRP ≈ $0.582)
  const xlmRate = 0.124;
  const xrpRate = 0.582;

  const amountXlm = (Number(totalDollars) / xlmRate).toFixed(2);
  const amountXrp = (Number(totalDollars) / xrpRate).toFixed(2);

  const destinationStellar = 'GB7V4DQL5Y7P2KEMOG537AQUZ7I5I3YQZTXFVR5F752J7E663NR5XLM';
  const destinationXrpl = 'rNexusRailTreasuryLiveTestnetConsensusXRPL';
  const destinationTagXrpl = '104802';
  const memoStellar = orderId;

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Simulate Instant Testnet Verification
  const handleSimulatePayment = () => {
    setIsSimulating(true);
    setSimStep(2);

    setTimeout(() => {
      setSimStep(3);
    }, 1200);

    setTimeout(() => {
      setSimStep(4);
      setVerificationSuccess(true);
      setIsSimulating(false);
    }, 2400);

    setTimeout(() => {
      const generatedTx = selectedRail === 'STELLAR'
        ? '0x89f41b3c94de2a5b678e12d45c893e2a71f49e0132b85e05417ab924e2c81729'
        : '0x3c2a9e14de782f915b678e12d45c893e2a71f49e0132b85e05417ab924e89f41';
      router.push(
        `/app/receipt?orderId=${encodeURIComponent(orderId)}&rail=${selectedRail}&txHash=${generatedTx}&amount=${encodeURIComponent(totalDollars)}`
      );
    }, 3200);
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
              <span>2 Checkout</span>
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
            Secured demo checkout.
          </h1>
          <p className="mt-1 text-sm text-nexus-muted font-mono">
            Direct testnet settlement with real-time rate locking &bull; Zero custodial custody.
          </p>
        </div>

        {/* Checkout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Checkout Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Contact / Shipping Section */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-4">
              <h2 className="text-sm font-mono uppercase tracking-wider text-white font-bold flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-nexus-surface border border-nexus-border flex items-center justify-center text-rail-emerald text-xs">
                  1
                </span>
                <span>Delivery & Contact Details</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="space-y-1">
                  <label className="text-nexus-muted">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-white focus:outline-none focus:border-rail-emerald/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-nexus-muted">Email for Receipt Anchor</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-white focus:outline-none focus:border-rail-emerald/60"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-nexus-muted">Shipping Destination (Testnet Simulator)</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-white focus:outline-none focus:border-rail-emerald/60"
                  />
                </div>
              </div>
            </div>

            {/* 2. Choose Payment Rail */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono uppercase tracking-wider text-white font-bold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-nexus-surface border border-nexus-border flex items-center justify-center text-rail-emerald text-xs">
                    2
                  </span>
                  <span>Select Settlement Rail</span>
                </h2>
                <span className="text-[11px] font-mono text-rail-emerald bg-rail-emerald/10 border border-rail-emerald/30 px-2 py-0.5 rounded">
                  Dual Testnet Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stellar Card */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('STELLAR')}
                  className={`p-4 rounded-xl text-left border transition-all relative ${
                    selectedRail === 'STELLAR'
                      ? 'bg-stellar-cyan/10 border-stellar-cyan text-white shadow-lg shadow-stellar-cyan/5'
                      : 'bg-nexus-surface border-nexus-border hover:border-nexus-muted/50 text-nexus-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-stellar-cyan/20 border border-stellar-cyan/40 flex items-center justify-center text-stellar-cyan font-extrabold text-xs">
                        *
                      </div>
                      <span className="font-bold text-sm text-white">Stellar (XLM)</span>
                    </div>
                    <span className="text-[10px] font-mono bg-stellar-cyan/20 text-stellar-cyan px-2 py-0.5 rounded font-bold">
                      ~3s Finality
                    </span>
                  </div>
                  <p className="text-xs text-nexus-muted">
                    Sub-cent Soroban execution fee. Atomic non-custodial debit.
                  </p>
                  <div className="mt-3 pt-3 border-t border-nexus-border/60 flex items-baseline justify-between text-xs font-mono">
                    <span className="text-nexus-muted">Rate</span>
                    <span className="text-stellar-cyan font-bold">{amountXlm} XLM</span>
                  </div>
                </button>

                {/* XRPL Card */}
                <button
                  type="button"
                  onClick={() => setSelectedRail('XRPL')}
                  className={`p-4 rounded-xl text-left border transition-all relative ${
                    selectedRail === 'XRPL'
                      ? 'bg-xrpl-blue/10 border-xrpl-blue text-white shadow-lg shadow-xrpl-blue/5'
                      : 'bg-nexus-surface border-nexus-border hover:border-nexus-muted/50 text-nexus-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-xrpl-blue/20 border border-xrpl-blue/40 flex items-center justify-center text-xrpl-blue font-extrabold text-xs">
                        X
                      </div>
                      <span className="font-bold text-sm text-white">XRPL (XRP)</span>
                    </div>
                    <span className="text-[10px] font-mono bg-xrpl-blue/20 text-xrpl-blue px-2 py-0.5 rounded font-bold">
                      Consensus
                    </span>
                  </div>
                  <p className="text-xs text-nexus-muted">
                    Native destination tag tracking with immediate ledger ripple.
                  </p>
                  <div className="mt-3 pt-3 border-t border-nexus-border/60 flex items-baseline justify-between text-xs font-mono">
                    <span className="text-nexus-muted">Rate</span>
                    <span className="text-xrpl-blue font-bold">{amountXrp} XRP</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Payment Instructions & Rate Lock */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-5">
              <div className="flex items-center justify-between border-b border-nexus-border pb-4">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Clock className="w-4 h-4 text-rail-emerald" />
                  <span className="text-nexus-muted">Guaranteed Quote Lock:</span>
                  <span className="text-rail-emerald font-bold">00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}</span>
                </div>
                <span className="text-[11px] font-mono text-nexus-muted">
                  Order: <strong className="text-white">{orderId}</strong>
                </span>
              </div>

              {/* Amount to send banner */}
              <div className="p-4 rounded-xl bg-nexus-surface border border-nexus-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase text-nexus-muted block">
                    Amount to send
                  </span>
                  <span className="text-2xl font-mono font-extrabold text-white">
                    {selectedRail === 'STELLAR' ? `${amountXlm} XLM` : `${amountXrp} XRP`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono uppercase text-nexus-muted block">
                    Fiat Value
                  </span>
                  <span className="text-sm font-mono font-bold text-rail-emerald">
                    ${totalDollars} USD
                  </span>
                </div>
              </div>

              {/* Destination Address */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-nexus-muted block">
                  {selectedRail === 'STELLAR' ? 'Stellar Public Destination Address' : 'XRPL Public Receiving Address'}
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-nexus-surface border border-nexus-border">
                  <code className="text-[11px] font-mono text-white flex-1 break-all select-all">
                    {selectedRail === 'STELLAR' ? destinationStellar : destinationXrpl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedRail === 'STELLAR' ? destinationStellar : destinationXrpl, 'addr')}
                    className="p-1.5 rounded-lg bg-nexus-card border border-nexus-border text-nexus-muted hover:text-white transition-colors"
                    aria-label="Copy address"
                  >
                    {copiedKey === 'addr' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Memo or Destination Tag */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-nexus-muted flex items-center justify-between">
                  <span>{selectedRail === 'STELLAR' ? 'Required Memo (TEXT)' : 'Required Destination Tag'}</span>
                  <span className="text-[10px] text-rose-400">Mandatory for auto-reconciliation</span>
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-nexus-surface border border-nexus-border">
                  <code className="text-xs font-mono text-rail-emerald font-bold flex-1">
                    {selectedRail === 'STELLAR' ? memoStellar : destinationTagXrpl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedRail === 'STELLAR' ? memoStellar : destinationTagXrpl, 'memo')}
                    className="p-1.5 rounded-lg bg-nexus-card border border-nexus-border text-nexus-muted hover:text-white transition-colors"
                    aria-label="Copy tag or memo"
                  >
                    {copiedKey === 'memo' ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Simulation CTA & Live Verification */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={isSimulating}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-rail-emerald text-nexus-dark font-mono text-xs font-extrabold hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-rail-emerald/10 disabled:opacity-60"
                >
                  {isSimulating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Broadcasting to {selectedRail} testnet ledger...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Simulate Testnet Sign & Pay (Instant Demo)</span>
                    </>
                  )}
                </button>

                {/* Manual TX Hash Input */}
                <div className="pt-3 border-t border-nexus-border">
                  <p className="text-[11px] font-mono text-nexus-muted mb-2">
                    Paid via native wallet? Enter transaction hash to verify:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualTxHash}
                      onChange={(e) => setManualTxHash(e.target.value)}
                      placeholder="0x89f...3e2a"
                      className="flex-1 px-3 py-2 rounded-xl bg-nexus-surface border border-nexus-border text-xs font-mono text-white placeholder-nexus-muted focus:outline-none focus:border-rail-emerald/60"
                    />
                    <button
                      type="button"
                      onClick={handleSimulatePayment}
                      className="px-4 py-2 rounded-xl bg-nexus-surface border border-nexus-border hover:border-rail-emerald text-xs font-mono text-white transition-colors"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Settlement Pipeline Status Checklist */}
            <div className="p-6 rounded-2xl bg-nexus-card border border-nexus-border space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                Settlement Pipeline Checklist
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-nexus-surface border border-nexus-border">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-rail-emerald" />
                    <span className="text-white">1. Real-time rate lock secured</span>
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
                  <span>{selectedRail} Testnet Fee</span>
                  <span className="text-white">&lt; $0.0001</span>
                </div>
              </div>

              {/* Total Due */}
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-mono uppercase font-bold text-white">Total</span>
                <div className="text-right">
                  <div className="text-2xl font-mono font-extrabold text-white">${totalDollars}</div>
                  <div className="text-xs font-mono text-rail-emerald">
                    {selectedRail === 'STELLAR' ? `${amountXlm} XLM` : `${amountXrp} XRP`}
                  </div>
                </div>
              </div>
            </div>

            {/* Testnet Faucet Assistance Card */}
            <div className="p-5 rounded-2xl bg-nexus-surface border border-nexus-border space-y-3">
              <h4 className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-rail-emerald" />
                <span>Testnet Faucets & Documentation</span>
              </h4>
              <p className="text-xs text-nexus-muted leading-relaxed">
                Testing with a real wallet? Fund your address directly on the public testnets:
              </p>
              <div className="flex flex-col gap-2 pt-1 text-xs font-mono">
                <a
                  href="https://laboratory.stellar.org/#account-creator"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-nexus-card border border-nexus-border hover:border-stellar-cyan/50 text-stellar-cyan transition-colors"
                >
                  <span>Stellar Friendbot Faucet</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://xrpl.org/xrp-testnet-faucet.html"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-nexus-card border border-nexus-border hover:border-xrpl-blue/50 text-xrpl-blue transition-colors"
                >
                  <span>XRPL Testnet Faucet</span>
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
