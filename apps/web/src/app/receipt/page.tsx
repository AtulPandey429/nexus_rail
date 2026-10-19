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
  Printer,
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
      
      {/* =========================================================================
          SCREEN-ONLY INTERACTIVE LAYOUT
          ========================================================================= */}
      <div className="print:hidden">
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

          {/* 2-Column Responsive Layout */}
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
                      <span>{receiptData.txHash.length > 18 ? `${receiptData.txHash.slice(0, 12)}...${receiptData.txHash.slice(-6)}` : receiptData.txHash}</span>
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
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#7FF8C6] hover:bg-[#6EE7B7] text-[#052E20] font-mono text-xs font-bold transition-all shadow-md active:scale-[0.99]"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Download / Print Receipt</span>
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

      {/* =========================================================================
          PRINT-ONLY ENTERPRISE OFFICIAL RECEIPT TEMPLATE
          Seamlessly rendered whenever window.print() or Ctrl+P is triggered
          ========================================================================= */}
      <div className="hidden print:block bg-white text-slate-900 p-8 max-w-[800px] mx-auto font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-5 border-b-2 border-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#092B21] flex items-center justify-center p-1.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-128.png" alt="NexusRail" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#092B21] leading-none">NexusRail</h1>
              <p className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase mt-1">Multi-Rail Crypto Commerce Engine</p>
              <p className="text-[9.5px] text-slate-500">Decentralized Payment Routing & Automated Settlement</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold tracking-wider uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              PAID / VERIFIED
            </div>
            <div className="text-lg font-extrabold text-slate-900 tracking-tight">OFFICIAL RECEIPT</div>
            <div className="text-[10px] font-mono text-slate-500">ORDER ID: {receiptData.orderId}</div>
          </div>
        </div>

        {/* 4-Metric Highlights */}
        <div className="grid grid-cols-4 gap-3 my-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-[9.5px] font-bold uppercase text-slate-500 tracking-wider">Transaction Date</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">{receiptData.timestamp.split('·')[0]?.trim() || '20 Oct 2026'}</div>
            <div className="text-[9px] font-mono text-slate-500">{receiptData.timestamp.split('·')[1]?.trim() || '07:59:15 GMT'}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-[9.5px] font-bold uppercase text-slate-500 tracking-wider">Payment Rail</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">{receiptData.rail === 'STELLAR' ? 'Stellar Testnet' : 'XRPL Testnet'}</div>
            <div className="text-[9px] font-bold text-emerald-700">Native Asset ({receiptData.token})</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-[9.5px] font-bold uppercase text-slate-500 tracking-wider">Ledger Sequence</div>
            <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">#{receiptData.ledgerSequence}</div>
            <div className="text-[9px] text-slate-500">Validated Finality</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-[9.5px] font-bold uppercase text-slate-500 tracking-wider">Approval Rate</div>
            <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">{receiptData.rateAtApproval}</div>
            <div className="text-[9px] text-slate-500">Zero Slippage Lock</div>
          </div>
        </div>

        {/* Parties Panel */}
        <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
          <div>
            <div className="text-[9.5px] font-bold uppercase text-slate-500 tracking-wider mb-1">Issued By</div>
            <div className="font-bold text-slate-900">NexusRail Commerce Technologies, Inc.</div>
            <div className="text-slate-600 text-[11px]">Enterprise Multi-Rail Settlement Infrastructure</div>
            <div className="text-slate-500 text-[10px] mt-0.5">Gateway: {receiptData.rail === 'STELLAR' ? 'Stellar Horizon Altnet' : 'XRPL Altnet Testnet'}</div>
          </div>
          <div>
            <div className="text-[9.5px] font-bold uppercase text-slate-500 tracking-wider mb-1">Delivered To</div>
            <div className="font-bold text-slate-900">{receiptData.email}</div>
            <div className="text-slate-600 text-[11px]">Account ID: <span className="font-semibold text-slate-900">{receiptData.email.split('@')[0]}</span></div>
            <div className="text-slate-500 text-[10px] mt-0.5">
              Paid From: <span className="font-mono bg-white px-1.5 py-0.5 border border-slate-300 rounded text-slate-800">{receiptData.paidFrom}</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Item & Description</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Amount (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {receiptData.items.map((item) => (
                <tr key={item.sku}>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{item.title}</div>
                    <div className="text-[10.5px] text-slate-500">Demo item · SKU: {item.sku}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{item.qty}</td>
                  <td className="py-2.5 px-3 text-right font-mono">${(item.priceCents / 100).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">${((item.priceCents * item.qty) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ledger Audit & Financial Totals */}
        <div className="grid grid-cols-12 gap-4 items-stretch mb-4">
          
          <div className="col-span-7 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-col justify-between text-xs">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Balanced. Down to the entry.
              </div>
              <p className="text-[10.5px] text-emerald-800 mt-1 leading-snug">
                Double-entry bookkeeping journal posted and synchronized with the {receiptData.rail === 'STELLAR' ? 'Stellar' : 'XRPL'} ledger state.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2 text-[9.5px] font-mono">
                <span className="bg-emerald-100/80 border border-emerald-300 text-emerald-900 px-1.5 py-0.5 rounded font-semibold">Ref: JE-2048</span>
                <span className="bg-emerald-100/80 border border-emerald-300 text-emerald-900 px-1.5 py-0.5 rounded">Debits ${receiptData.amountUsd} = Credits ${receiptData.amountUsd}</span>
                <span className="bg-emerald-100/80 border border-emerald-300 text-emerald-900 px-1.5 py-0.5 rounded">Balance: 1,480.30 XLM</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2.5 mt-2 border-t border-dashed border-emerald-300 text-[9px] text-emerald-900">
              <div>
                <span className="font-bold block text-emerald-700">✓ Signed</span>
                <span className="font-mono text-emerald-800">14:32:18 UTC</span>
              </div>
              <div>
                <span className="font-bold block text-emerald-700">✓ Confirmed</span>
                <span className="font-mono text-emerald-800">14:32:21 UTC</span>
              </div>
              <div>
                <span className="font-bold block text-emerald-700">✓ Posted</span>
                <span className="font-mono text-emerald-800">14:32:24 UTC</span>
              </div>
            </div>
          </div>

          <div className="col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between text-xs">
            <div>
              <div className="flex justify-between py-1 text-slate-600 text-xs">
                <span>Products Subtotal</span>
                <span className="font-mono font-medium">${receiptData.subtotalUsd}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600 text-xs">
                <span>Network Settlement Fee</span>
                <span className="font-mono font-medium">${receiptData.feeUsd}</span>
              </div>
              <div className="h-px bg-slate-200 my-1.5"></div>
              <div className="flex justify-between items-baseline py-1">
                <span className="font-bold text-slate-900 text-xs">Total Amount Paid</span>
                <span className="text-xl font-black font-mono text-slate-900">${receiptData.amountUsd}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-emerald-700 pt-1">
              <span>Settled in {receiptData.token}</span>
              <span className="font-mono">({receiptData.amountCrypto} {receiptData.token})</span>
            </div>
          </div>

        </div>

        {/* Cryptographic Anchor */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs mb-3">
          <div className="text-[10px] text-slate-600 leading-snug">
            <div><strong className="text-slate-900">Transaction Hash:</strong> <span className="font-mono">{receiptData.txHash}</span></div>
            <div className="text-slate-500 mt-0.5">Cryptographic proof anchored to {receiptData.rail === 'STELLAR' ? 'Stellar Horizon Testnet' : 'XRPL Altnet'} Ledger Sequence #{receiptData.ledgerSequence}</div>
          </div>
          <div className="text-[9.5px] font-mono font-bold text-sky-700 uppercase tracking-wider">
            VERIFIED STATE
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-200 flex justify-between items-end text-[8.5px] text-slate-400 leading-tight">
          <div className="max-w-[70%]">
            NexusRail Commerce Engine · Test assets only. No physical goods will be shipped. This official electronic receipt confirms a verified cryptographic testnet transaction.
          </div>
          <div className="text-right font-mono font-semibold text-slate-500">
            SYSTEM VERIFIED · © 2026 NEXUSRAIL INC.
          </div>
        </div>

      </div>

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
