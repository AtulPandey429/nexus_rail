'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  ShieldCheck,
  Download,
  ExternalLink,
  ArrowRight,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import { CartLine } from '@/lib/shop';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'NODE-STAND': '/products/node-stand.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
  'RAIL-CABLES': '/products/rail-cables.png',
};

function ReceiptContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || 'NR-1048';

  // Receipt details state
  const [receiptData, setReceiptData] = useState({
    orderId,
    rail: 'STELLAR',
    token: 'XLM',
    amountCrypto: '2,000.20',
    amountUsd: '200.02',
    subtotalUsd: '200.00',
    feeUsd: '0.02',
    rateAtApproval: '1 XLM = $0.1000',
    txHash: '8fa2b7e4a901c91d',
    ledgerSequence: '5,284,901',
    timestamp: '18 OCT 2026 · 14:32:24 UTC',
    email: 'alex.kim@example.com',
    paidFrom: 'GCKF...7Q2M',
    items: [
      { sku: 'RAIL-ONE', title: 'Rail One', description: 'Graphite · USB-C', priceCents: 12900, qty: 1, priced: true },
      { sku: 'RELAY-MAT', title: 'Relay desk mat', description: 'Charcoal · 80 × 40 cm', priceCents: 3900, qty: 1, priced: true },
      { sku: 'NEXUS-TEE', title: 'Nexus tee', description: 'Washed black · Size M', priceCents: 3200, qty: 1, priced: true },
    ] as CartLine[],
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`nexus_receipt_${orderId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setReceiptData((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    }
  }, [orderId]);

  const explorerUrl = receiptData.rail === 'STELLAR'
    ? `https://stellar.expert/explorer/testnet/tx/${receiptData.txHash}`
    : `https://testnet.xrpl.org/transactions/${receiptData.txHash}`;

  const handleDownloadReceipt = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#07090C] text-[#F0F4F8] font-sans antialiased selection:bg-[#7FF8C6] selection:text-black">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        
        {/* Step Progress Breadcrumb */}
        <div className="flex items-center gap-3 text-xs font-mono mb-8">
          <div className="flex items-center gap-1.5 text-white/50">
            <span className="w-4 h-4 rounded-full bg-[#092B21] border border-[#165D46] text-[#7FF8C6] flex items-center justify-center text-[10px]">
              ✓
            </span>
            <span>Cart</span>
          </div>
          <span className="text-white/20">──────</span>
          <div className="flex items-center gap-1.5 text-white/50">
            <span className="w-4 h-4 rounded-full bg-[#092B21] border border-[#165D46] text-[#7FF8C6] flex items-center justify-center text-[10px]">
              ✓
            </span>
            <span>Checkout</span>
          </div>
          <span className="text-white/20">──────</span>
          <div className="flex items-center gap-1.5 text-white font-semibold">
            <span className="w-4 h-4 rounded-full bg-[#7FF8C6] text-[#052E20] flex items-center justify-center text-[10px] font-bold">
              ✓
            </span>
            <span>Receipt</span>
          </div>
        </div>

        {/* Confirmation Hero */}
        <div className="flex items-start gap-4 sm:gap-6 mb-8">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#092B21] border border-[#165D46] text-[#7FF8C6] flex items-center justify-center shrink-0">
            <Check className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
          </div>

          <div>
            <p className="text-[11px] font-mono tracking-widest uppercase text-[#7FF8C6]">
              CONFIRMED ON {receiptData.rail === 'STELLAR' ? 'STELLAR TESTNET' : 'XRPL TESTNET'}
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-white tracking-tight mt-1">
              Good move. Payment complete.
            </h1>
            <p className="text-sm sm:text-base text-white/50 mt-1 font-normal">
              Your payment is verified, your ledger is balanced, and your receipt is ready.
            </p>
          </div>
        </div>

        {/* 2-Column Responsive Layout matching Figma Screen 8 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          
          {/* Left Column: Official Payment Receipt Card (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl bg-[#10141A] border border-white/10 p-6 sm:p-8 shadow-xl space-y-6">
              
              {/* Receipt Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-[#7FF8C6]">
                    PAYMENT RECEIPT
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
                    Order {receiptData.orderId}
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#092B21] border border-[#165D46] text-[#7FF8C6] text-xs font-mono font-medium">
                  PAID / VERIFIED
                </span>
              </div>

              {/* Total Paid Block */}
              <div className="space-y-1">
                <p className="text-xs font-mono text-white/40">
                  Total paid / illustrative USD
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                    ${receiptData.amountUsd}
                  </span>
                  <span className="text-sm font-mono text-[#7FF8C6]">
                    ({receiptData.amountCrypto} {receiptData.token})
                  </span>
                </div>
                <p className="text-[11px] font-mono text-white/40 pt-1">
                  {receiptData.timestamp}
                </p>
              </div>

              {/* Verified Key-Value Ledger Table */}
              <div className="space-y-3.5 text-xs font-mono divide-y divide-white/5 pt-2">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-white/50">Payment rail</span>
                  <span className="text-white font-medium">
                    {receiptData.rail === 'STELLAR' ? 'Stellar testnet' : 'XRPL testnet'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-white/50">Paid from</span>
                  <span className="text-white font-mono">{receiptData.paidFrom}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-white/50">Transaction hash</span>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#7FF8C6] hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>{receiptData.txHash.slice(0, 12)}...{receiptData.txHash.slice(-6)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-white/50">Ledger sequence</span>
                  <span className="text-white font-mono">{receiptData.ledgerSequence}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-white/50">Rate at approval</span>
                  <span className="text-white">{receiptData.rateAtApproval}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-white/50">Receipt sent to</span>
                  <span className="text-white">{receiptData.email}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-mono text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download receipt</span>
                </button>

                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-mono text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View on explorer</span>
                </a>
              </div>

            </div>

            {/* Verified From Start to Finish Timeline */}
            <div className="space-y-4 pt-2">
              <p className="text-base font-medium text-white tracking-tight">
                Verified from start to finish.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-4 rounded-xl bg-[#0E1218] border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#7FF8C6]">
                    <Check className="w-3.5 h-3.5" />
                    <span className="font-semibold text-white">Signed in wallet</span>
                  </div>
                  <p className="text-[11px] text-white/40">14:32:18 UTC</p>
                </div>

                <div className="p-4 rounded-xl bg-[#0E1218] border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#7FF8C6]">
                    <Check className="w-3.5 h-3.5" />
                    <span className="font-semibold text-white">Confirmed onchain</span>
                  </div>
                  <p className="text-[11px] text-white/40">14:32:21 UTC</p>
                </div>

                <div className="p-4 rounded-xl bg-[#0E1218] border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#7FF8C6]">
                    <Check className="w-3.5 h-3.5" />
                    <span className="font-semibold text-white">Journal posted</span>
                  </div>
                  <p className="text-[11px] text-white/40">14:32:24 UTC</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Bag Details & Ledger Link (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl bg-[#10141A] border border-white/10 p-6 sm:p-7 shadow-xl space-y-6">
              
              <h2 className="text-xl font-medium text-white tracking-tight">
                The details in your bag
              </h2>

              {/* Items List */}
              <div className="space-y-4 divide-y divide-white/10">
                {receiptData.items.map((item) => (
                  <div key={item.sku} className="pt-4 first:pt-0 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-lg bg-[#111620] border border-white/10 overflow-hidden relative shrink-0">
                      <Image
                        src={PRODUCT_IMAGE_MAP[item.sku] || '/products/rail-one.png'}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      <p className="text-xs font-mono text-white/40 mt-0.5">Qty {item.qty} · Demo item</p>
                    </div>
                    <span className="text-sm font-mono text-white">
                      ${((item.priceCents * item.qty) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Breakdown Rows */}
              <div className="space-y-3 py-4 border-t border-b border-white/10 text-xs font-mono">
                <div className="flex justify-between text-white/60">
                  <span>Products</span>
                  <span className="text-white">${receiptData.subtotalUsd}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Network fee</span>
                  <span className="text-white">${receiptData.feeUsd}</span>
                </div>
              </div>

              {/* Total Row */}
              <div className="flex justify-between items-baseline">
                <span className="text-base text-white font-medium">Total</span>
                <span className="text-2xl font-mono font-medium text-white tracking-tight">
                  ${receiptData.amountUsd}
                </span>
              </div>

              {/* Balanced Down to the Entry Card */}
              <div className="p-4 rounded-xl bg-[#0A261E]/80 border border-[#124B3B] space-y-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-[#7FF8C6] font-semibold">
                  <BookOpen className="w-4 h-4" />
                  <span>Balanced. Down to the entry.</span>
                </div>
                <p className="text-[#A7F3D0] leading-relaxed">
                  JE-2048 · Debits ${receiptData.amountUsd} = Credits ${receiptData.amountUsd}. View the full journal in Activity.
                </p>
                <p className="text-[10px] text-white/50 tracking-wider pt-1 uppercase">
                  AVAILABLE BALANCE: 1,480.30 XLM
                </p>
              </div>

              {/* Action CTAs */}
              <div className="space-y-3 pt-2">
                <Link
                  href={`/activity?orderId=${encodeURIComponent(receiptData.orderId)}`}
                  className="w-full py-4 rounded-lg bg-[#7FF8C6] hover:bg-[#6EE7B7] text-[#052E20] font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[#7FF8C6]/10 active:scale-[0.99]"
                >
                  <span>View order & ledger</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/store"
                  className="w-full py-3.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-mono text-xs font-medium transition-colors text-center block"
                >
                  Back to the store
                </Link>
              </div>

              {/* Disclaimer */}
              <div className="flex items-center gap-2 text-xs font-mono text-white/40 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#7FF8C6] shrink-0" />
                <span>No products will be shipped. This receipt confirms a demo testnet transaction only.</span>
              </div>

            </div>
          </div>

        </div>

      </main>

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

export default function ReceiptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090C] text-white flex items-center justify-center font-mono text-xs">
        <div className="w-8 h-8 border-2 border-[#7FF8C6] border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    }>
      <ReceiptContent />
    </Suspense>
  );
}
