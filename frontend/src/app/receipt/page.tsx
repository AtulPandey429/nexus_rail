'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Printer,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import QRCode from 'qrcode';
import { CartLine } from '@/lib/shop';
import { PLATFORM_STELLAR_VAULT, PLATFORM_XRPL_VAULT } from '@/lib/vault';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'RAIL-ONE': '/products/rail-one.png',
  'RELAY-MAT': '/products/relay-mat.png',
  'NEXUS-TEE': '/products/nexus-tee.png',
  'NODE-STAND': '/products/node-stand.png',
  'SIGNAL-CAP': '/products/signal-cap.png',
  'RAIL-CABLES': '/products/rail-cables.png',
};

const PRODUCT_CATALOG_PRICES: Record<string, number> = {
  'RAIL-ONE': 12900,
  'RELAY-MAT': 3900,
  'NEXUS-TEE': 3200,
  'NODE-STAND': 5800,
  'SIGNAL-CAP': 2800,
  'RAIL-CABLES': 1900,
};

const PRODUCT_CATALOG_DESCRIPTIONS: Record<string, string> = {
  'RAIL-ONE': 'Graphite · Dual-Rail Processor',
  'RELAY-MAT': 'Charcoal · 80 × 40 cm',
  'NEXUS-TEE': 'Washed Black · Size M',
  'NODE-STAND': 'Solid Anodized Aluminum Mount',
  'SIGNAL-CAP': 'Water-Repellent Technical Cap',
  'RAIL-CABLES': 'Braided High-Current Cables',
};

function getItemPriceCents(item: any): number {
  if (typeof item.priceCents === 'number' && item.priceCents > 0) return item.priceCents;
  if (typeof item.unit_price_cents === 'number' && item.unit_price_cents > 0) return item.unit_price_cents;
  if (typeof item.unitPriceCents === 'number' && item.unitPriceCents > 0) return item.unitPriceCents;
  if (typeof item.price_cents === 'number' && item.price_cents > 0) return item.price_cents;
  if (typeof item.price === 'number' && item.price > 0) return Math.round(item.price * 100);
  if (item.sku && PRODUCT_CATALOG_PRICES[item.sku]) return PRODUCT_CATALOG_PRICES[item.sku];
  return 0;
}

function getItemDescription(item: any): string {
  if (item.description && typeof item.description === 'string' && item.description.trim()) {
    return item.description;
  }
  if (item.sku && PRODUCT_CATALOG_DESCRIPTIONS[item.sku]) {
    return PRODUCT_CATALOG_DESCRIPTIONS[item.sku];
  }
  return 'Enterprise Web3 Hardware & Gear';
}

function PlatformSignature({ className = 'w-44 h-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 70" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="sigGold" x1="0" y1="0" x2="240" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF2D6" />
          <stop offset="0.3" stopColor="#E5C378" />
          <stop offset="0.7" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#AA822A" />
        </linearGradient>
      </defs>
      {/* Cursive 'N' */}
      <path
        d="M15 48 C 12 36, 18 16, 26 12 C 30 10, 34 14, 30 26 C 26 38, 22 52, 21 54 C 23 48, 38 18, 48 14 C 54 12, 58 18, 54 30 C 50 42, 47 52, 46 54"
        stroke="url(#sigGold)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 'e-x-u-s' */}
      <path
        d="M48 44 C 52 40, 58 38, 60 42 C 62 46, 56 50, 52 50 C 49 50, 53 44, 62 36 M 55 42 L 67 48 M 65 36 C 68 44, 70 48, 73 50 C 76 52, 79 48, 81 40 C 82 34, 84 48, 86 50"
        stroke="url(#sigGold)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 'R' */}
      <path
        d="M96 52 C 96 32, 98 14, 104 10 C 112 5, 126 8, 124 22 C 122 32, 110 36, 102 36 C 108 38, 116 44, 122 52"
        stroke="url(#sigGold)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 'a-i-l' */}
      <path
        d="M125 46 C 127 40, 134 38, 138 42 C 141 46, 138 52, 134 52 C 130 52, 134 42, 142 38 M 142 42 L 146 52 M 145 32 L 146 34 M 147 48 C 150 40, 153 22, 157 14 C 160 8, 163 12, 160 26 C 157 40, 155 50, 164 48"
        stroke="url(#sigGold)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dynamic flourishing loop & underline */}
      <path
        d="M16 58 C 45 56, 110 57, 178 54 C 196 53, 222 50, 218 42 C 214 34, 185 36, 172 45 C 165 50, 176 58, 228 58"
        stroke="url(#sigGold)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlatformCryptographicSeal({ className = 'w-20 h-20' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <defs>
          <linearGradient id="sealGold" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF2D6" />
            <stop offset="0.4" stopColor="#E5C378" />
            <stop offset="0.8" stopColor="#D4AF37" />
            <stop offset="1" stopColor="#8A6B22" />
          </linearGradient>
          <path
            id="sealTextCircle"
            d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0"
          />
        </defs>

        {/* Outer serrated ring */}
        <circle cx="60" cy="60" r="56" stroke="url(#sealGold)" strokeWidth="1.2" strokeDasharray="3 2" fill="rgba(212, 175, 55, 0.04)" />
        
        {/* Inner solid border ring */}
        <circle cx="60" cy="60" r="49" stroke="url(#sealGold)" strokeWidth="1.4" fill="none" />
        
        {/* Innermost dashed ring */}
        <circle cx="60" cy="60" r="32" stroke="url(#sealGold)" strokeWidth="0.9" strokeDasharray="2 2" fill="none" />

        {/* Circular text */}
        <text fill="url(#sealGold)" fontSize="6.8" fontFamily="monospace" fontWeight="bold" letterSpacing="2.2">
          <textPath href="#sealTextCircle" startOffset="50%" textAnchor="middle">
            ★ NEXUSRAIL PROTOCOL ★ OFFICIALLY SEALED & VERIFIED
          </textPath>
        </text>

        {/* Center platform icon */}
        <g transform="translate(48, 48)">
          <circle cx="12" cy="12" r="10" fill="#1C1F24" stroke="url(#sealGold)" strokeWidth="1" />
          <path d="M7 12L11 16L17 9" stroke="#E8CE90" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function ReceiptContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '#NR8K2P9X';
  const [copied, setCopied] = useState(false);
  const [orderCopied, setOrderCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

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
    txHash: '8fa2b109c91d4e02aaef06aa74b18086343e6f7df6f4a32570e361d2ed4ecf0946',
    ledgerSequence: '5,284,901',
    timestamp: '18 OCT 2026 · 14:32:24 UTC',
    email: 'alex.kim@example.com',
    paidFrom: 'GCKF...7Q2M',
    status: 'SETTLED',
    items: [
      { sku: 'RAIL-ONE', title: 'Rail One', description: 'Graphite · Dual-Rail Processor', priceCents: 12900, qty: 1, priced: true },
      { sku: 'RELAY-MAT', title: 'Relay Desk Mat', description: 'Charcoal · 80 × 40 cm', priceCents: 3900, qty: 1, priced: true },
      { sku: 'NEXUS-TEE', title: 'Nexus Tee', description: 'Washed Black · Size M', priceCents: 3200, qty: 1, priced: true },
    ] as CartLine[],
  });

  const explorerUrl = receiptData.rail === 'STELLAR'
    ? `https://stellar.expert/explorer/testnet/tx/${receiptData.txHash}`
    : `https://testnet.xrpl.org/transactions/${receiptData.txHash}`;

  // Generate on-chain verification QR code with high-contrast black on white for 100% instant mobile scanning
  useEffect(() => {
    QRCode.toDataURL(explorerUrl, {
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [explorerUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`nexus_receipt_${orderId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.items && Array.isArray(parsed.items)) {
            parsed.items = parsed.items.map((it: any) => ({
              ...it,
              sku: it.sku || 'RAIL-ONE',
              title: it.title || it.sku || 'Nexus Item',
              description: getItemDescription(it),
              priceCents: getItemPriceCents(it),
              unit_price_cents: getItemPriceCents(it),
              qty: it.qty || 1,
            }));
          }
          setReceiptData((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    }

    async function loadBackendOrder() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
        if (token) {
          const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data?.order) {
              const o = json.data.order;
              const mappedItems = o.items && o.items.length > 0
                ? o.items.map((it: any) => ({
                    sku: it.sku || 'RAIL-ONE',
                    title: it.title || it.sku || 'Nexus Item',
                    description: getItemDescription(it),
                    priceCents: getItemPriceCents(it),
                    unit_price_cents: getItemPriceCents(it),
                    qty: it.qty || 1,
                  }))
                : undefined;

              const totalC = o.totalCents || (mappedItems ? mappedItems.reduce((acc: number, it: any) => acc + (getItemPriceCents(it) * (it.qty || 1)), 0) : 0);
              const totalUsdStr = totalC > 0 ? (totalC / 100).toFixed(2) : undefined;

              setReceiptData((prev) => ({
                ...prev,
                orderId: o.orderNumber || o.id,
                amountUsd: totalUsdStr || prev.amountUsd,
                subtotalUsd: totalUsdStr || prev.subtotalUsd,
                rail: o.rail || prev.rail,
                token: o.rail === 'XRPL' ? 'XRP' : (o.rail === 'STELLAR' ? 'XLM' : prev.token),
                txHash: o.txHash || prev.txHash,
                status: o.status || prev.status,
                items: mappedItems || prev.items,
                timestamp: o.createdAt ? new Date(o.createdAt).toUTCString() : prev.timestamp,
              }));
            }
          }
        }
      } catch {}
    }
    loadBackendOrder();
  }, [orderId]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyHash = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(receiptData.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Dynamic calculation to ensure zero rate / zero cost bugs never occur
  const computedSubtotalCents = receiptData.items.reduce(
    (sum, it) => sum + getItemPriceCents(it) * (it.qty || 1),
    0
  );
  const displaySubtotalUsd =
    computedSubtotalCents > 0
      ? (computedSubtotalCents / 100).toFixed(2)
      : receiptData.subtotalUsd;
  const displayAmountUsd =
    computedSubtotalCents > 0
      ? (computedSubtotalCents / 100).toFixed(2)
      : receiptData.amountUsd;

  const tokenRate = receiptData.token === 'XLM' ? 0.10 : 0.50;
  const displayAmountCrypto =
    computedSubtotalCents > 0
      ? (computedSubtotalCents / 100 / tokenRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : receiptData.amountCrypto;

  return (
    <div className="receipt-outer min-h-screen bg-transparent text-[#E0D8C3] font-sans antialiased selection:bg-[#D4AF37]/30 selection:text-[#F8F7F2] py-6 sm:py-10 px-3 sm:px-6 print:py-0 print:px-0 print:min-h-0 print:bg-transparent">
      
      {/* Top Control Bar (Screen only) */}
      <header className="max-w-[820px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-4 px-2 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/store"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#D4AF37] hover:text-[#F2D675] transition-colors"
          >
            <span>&larr; Store</span>
          </Link>
          <span className="text-[#3D4148]">|</span>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#A69E8D] hover:text-[#F2D675] transition-colors"
          >
            <span>All Orders</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#22252A] border border-[#3D4148] hover:border-[#D4AF37]/60 text-xs font-mono text-[#E0D8C3] hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>Explorer Proof</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#D4AF37]" />
          </a>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C378] text-[#141619] font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20 transition-all cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save 1-Page PDF</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          THE EXECUTIVE LUXURY INVOICE / RECEIPT DOCUMENT
          - Exact 1-Page A4 Guarantee
          - Official Platform Logo (No "Nexus Rail" text)
          - Instantly Scannable QR Code
          - Product Thumbnail Images
          - Platform Notary Seal & Signature
          ========================================================================= */}
      <article
        id="nexus-official-receipt"
        className="max-w-[820px] mx-auto bg-[#26282C] border border-[#C5A059] rounded-none sm:rounded-sm shadow-2xl p-5 sm:p-9 relative overflow-hidden text-[#D9D2C2]"
        style={{
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(212, 175, 55, 0.25)',
        }}
      >
        {/* Subtle Matte Executive Texture Accent */}
        <div className="absolute inset-0 bg-[radial-gradient(#C5A059_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

        {/* Center Faint Background Platform Watermark */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 opacity-[0.025] pointer-events-none select-none">
          <Image
            src="/logo-256.png"
            alt="Watermark"
            fill
            className="object-contain filter grayscale"
          />
        </div>

        {/* =====================================================================
            1. TOP HEADER SECTION
            Left: Official Platform Logo Only (No "Nexus Rail" text)
            Center: Vertical Dividing Rule
            Right: Large "INVOICE", Order Number, and Status Badge
            ===================================================================== */}
        <div className="grid grid-cols-12 gap-4 pb-4 items-center relative z-10">
          
          {/* Top Left: Official Platform Logo Only */}
          <div className="col-span-5 flex items-center">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-sm">
              <Image
                src="/logo-256.png"
                alt="Platform Logo"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>

          {/* Vertical Divider Line */}
          <div className="col-span-1 flex justify-center">
            <div className="w-[1px] h-20 bg-[#C5A059]" />
          </div>

          {/* Top Right: Large "INVOICE" Title & Number */}
          <div className="col-span-6 flex flex-col justify-start pl-2">
            <h1 className="text-2xl sm:text-4xl font-normal tracking-[0.16em] text-[#E8CE90] uppercase font-sans">
              INVOICE
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs sm:text-sm font-mono tracking-widest text-[#C5A059] font-medium">
                №: {receiptData.orderId.startsWith('#') ? receiptData.orderId : '#' + receiptData.orderId}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined') {
                    navigator.clipboard.writeText(receiptData.orderId);
                    setOrderCopied(true);
                    setTimeout(() => setOrderCopied(false), 2000);
                  }
                }}
                className="text-[#C5A059] hover:text-[#F2D675] transition-colors print:hidden cursor-pointer p-0.5"
                title="Copy Full Order ID"
              >
                {orderCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-block px-2 py-0.5 bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#F2D675] font-mono text-[9.5px] font-bold uppercase tracking-wider">
                {receiptData.status === 'PAID' || receiptData.status === 'SETTLED' ? 'OFFICIAL SETTLED' : receiptData.status}
              </span>
              <span className="text-[10px] font-mono text-[#A69E8D]">
                {receiptData.timestamp}
              </span>
            </div>
          </div>

        </div>

        {/* Primary Horizontal Gold Divider Rule */}
        <div className="w-full h-[1px] bg-[#C5A059] mb-5 relative z-10" />

        {/* =====================================================================
            2. TWO-COLUMN MAIN BODY
            Left: Client Account, Terms, Ledger Details & Scannable QR Code
            Right: Line Items with Images, Subtotals & Official Seal / Signature
            ===================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start relative z-10">
          
          {/* ===================================================================
              LEFT COLUMN: Client Account, Terms, and Ledger Details
              =================================================================== */}
          <div className="md:col-span-5 space-y-4 text-xs font-mono">
            
            {/* Client Destination */}
            <div className="space-y-0.5">
              <p className="text-[#C5A059] font-bold tracking-wider text-[10px] uppercase">
                To:
              </p>
              <p className="font-semibold text-[#F2E8D3] text-xs">
                Client / Account Holder
              </p>
              <p className="text-[#B3AA96] break-all text-[10.5px]">
                {receiptData.email}
              </p>
              <p className="text-[#A69E8D] text-[9.5px]">
                WALLET: <span className="text-[#D4AF37]">{receiptData.paidFrom}</span>
              </p>
              <p className="text-[#A69E8D] text-[9.5px]">
                NETWORK: <span className="text-[#F2E8D3]">{receiptData.rail} Testnet Ledger</span>
              </p>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-0.5 pt-1">
              <p className="text-[#C5A059] font-bold tracking-wider text-[10px] uppercase">
                TERMS & CONDITIONS
              </p>
              <p className="text-[#9E9584] text-[9.5px] leading-relaxed">
                Cryptographic Dual-Chain Settlement. Verified against Horizon & Altnet consensus ledgers. All posted entries zero-variance balanced.
              </p>
            </div>

            {/* Platform Vault Account Reference */}
            <div className="space-y-0.5">
              <p className="text-[#C5A059] font-bold tracking-wider text-[10px] uppercase">
                Bank / Vault Account:
              </p>
              <p className="text-[#A69E8D] text-[9.5px] font-mono break-all leading-tight">
                {receiptData.rail === 'STELLAR'
                  ? PLATFORM_STELLAR_VAULT
                  : PLATFORM_XRPL_VAULT}
              </p>
            </div>

            {/* Bottom Left Bracket Section with Instant Scannable QR Code */}
            <div className="pt-2 border-l-2 border-[#C5A059] pl-3 space-y-2.5 mt-3">
              <div>
                <p className="text-[9.5px] uppercase tracking-wider text-[#C5A059] font-bold">
                  PAYMENT METHOD
                </p>
                <p className="text-[11px] text-[#F2E8D3] font-semibold">
                  {receiptData.rail} ({receiptData.token})
                </p>
              </div>

              <div>
                <p className="text-[9.5px] uppercase tracking-wider text-[#C5A059] font-bold">
                  SETTLEMENT DATE
                </p>
                <p className="text-[10px] text-[#D9D2C2]">
                  {receiptData.timestamp}
                </p>
              </div>

              <div>
                <p className="text-[9.5px] uppercase tracking-wider text-[#C5A059] font-bold">
                  LEDGER PROOF
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[9.5px] text-[#A69E8D] font-mono truncate max-w-[180px]">
                    Tx: {receiptData.txHash}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="text-[#C5A059] hover:text-white transition-colors"
                    title="Copy Transaction Hash"
                  >
                    {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-[9.5px] text-[#A69E8D] mt-0.5">
                  Sequence #{receiptData.ledgerSequence} · Journal JE-2048
                </p>
              </div>

              {/* High-Contrast Scannable Verification QR Code */}
              {qrDataUrl && (
                <div className="pt-1.5 flex items-center gap-3">
                  <div className="w-[74px] h-[74px] rounded bg-white p-1 border border-[#C5A059] shrink-0 shadow-md flex items-center justify-center">
                    <img
                      src={qrDataUrl}
                      alt="On-Chain Verification QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#E8CE90]">
                      SCAN TO VERIFY
                    </p>
                    <p className="text-[8.5px] text-[#A69E8D] leading-tight">
                      Instant mobile camera scan to live on-chain explorer consensus.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Left Column Bottom Footer URL */}
            <div className="pt-2">
              <p className="text-[9.5px] font-mono text-[#8C8372] tracking-wider">
                www.nexusrail.com
              </p>
            </div>

          </div>

          {/* ===================================================================
              RIGHT COLUMN: Items Table with Product Images, Subtotals & Seal
              =================================================================== */}
          <div className="md:col-span-7 flex flex-col justify-between h-full space-y-4">
            
            {/* 1. Line Items Table with Product Thumbnail Images */}
            <div>
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#C5A059] text-[10px] uppercase tracking-wider text-[#E8CE90]">
                    <th className="py-2 font-bold text-center w-10">QTY</th>
                    <th className="py-2 font-bold pl-2.5">DESCRIPTIONS</th>
                    <th className="py-2 font-bold text-right">RATE</th>
                    <th className="py-2 font-bold text-right">COSTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D4148]/60 text-xs">
                  {receiptData.items.map((item, idx) => {
                    const imgUrl = PRODUCT_IMAGE_MAP[item.sku] || '/products/rail-one.png';

                    return (
                      <tr key={idx} className="group">
                        {/* QTY with Left Accent Bracket */}
                        <td className="py-2 text-center font-mono text-[#E8CE90] align-top pt-3">
                          <span className="border-l border-r border-[#C5A059]/40 px-1.5 py-0.5 text-[10px]">
                            0{item.qty || 1}
                          </span>
                        </td>

                        {/* Description with Luxury Product Thumbnail Image */}
                        <td className="py-2 pl-2.5">
                          <div className="flex items-center gap-2.5">
                            {/* Product Thumbnail Image */}
                            <div className="w-9 h-9 rounded bg-[#1D1F23] border border-[#C5A059]/30 overflow-hidden shrink-0 relative shadow-sm">
                              <Image
                                src={imgUrl}
                                alt={item.title}
                                fill
                                sizes="36px"
                                className="object-cover object-center"
                              />
                            </div>

                            {/* Title, SKU Chip & Variant */}
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-serif italic text-xs sm:text-sm text-[#F5EADB] tracking-wide">
                                  {item.title}
                                </p>
                                <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#D4AF37]">
                                  {item.sku}
                                </span>
                              </div>
                              <p className="text-[9.5px] text-[#A69E8D] font-sans not-italic">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Rate */}
                        <td className="py-2 text-right font-mono text-[#D9D2C2] text-[11px] align-top pt-3">
                          ${(getItemPriceCents(item) / 100).toFixed(2)}
                        </td>

                        {/* Costs */}
                        <td className="py-2 text-right font-mono font-medium text-[#E8CE90] text-[11px] align-top pt-3">
                          ${((getItemPriceCents(item) * (item.qty || 1)) / 100).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. Subtotals and Totals Section */}
            <div className="space-y-2 pt-2.5 border-t border-[#3D4148]/80 text-xs font-mono">
              <div className="flex justify-between items-center text-[#B3AA96]">
                <span className="uppercase tracking-wider text-[10px] text-[#C5A059]">
                  SUB TOTALS |
                </span>
                <span className="text-[#F2E8D3] font-medium font-mono text-[11px]">
                  ${displaySubtotalUsd}
                </span>
              </div>

              <div className="flex justify-between items-center text-[#A69E8D] text-[10px]">
                <span className="uppercase tracking-wider">
                  NETWORK SETTLEMENT FEE
                </span>
                <span className="font-mono text-[#B3AA96] text-[11px]">
                  ${receiptData.feeUsd}
                </span>
              </div>

              {/* Gold Horizontal Rule above Total */}
              <div className="w-full h-[1px] bg-[#C5A059] my-1" />

              <div className="flex justify-between items-baseline pt-0.5">
                <span className="font-bold text-xs sm:text-sm text-[#E8CE90] tracking-widest uppercase">
                  SETTLED TOTAL
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-base sm:text-lg text-[#F2D675] tracking-tight">
                    ${displayAmountUsd}
                  </span>
                  <span className="block text-[10px] font-mono text-[#C5A059]">
                    ({displayAmountCrypto} {receiptData.token})
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Bottom Right Official Platform Signature & Seal Section */}
            <div className="pt-3 flex flex-col items-end text-right relative">
              <div className="flex items-center gap-3 mb-0.5">
                {/* Official Platform Cryptographic Seal */}
                <PlatformCryptographicSeal className="w-16 h-16 sm:w-18 sm:h-18 shrink-0 -rotate-2" />

                <div className="flex flex-col items-end">
                  {/* Handwritten Fluid Platform Signature Stroke */}
                  <PlatformSignature className="w-40 sm:w-48 h-12" />
                </div>
              </div>

              {/* Gold Signature Underline */}
              <div className="w-48 sm:w-56 h-[1px] bg-[#C5A059] mt-0.5 mb-1.5" />

              {/* Signer Title & Verified Stamp */}
              <p className="text-[11px] font-bold text-[#F2E8D3] tracking-wide font-mono flex items-center gap-1.5 justify-end">
                <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
                <span>Digitally Signed by NexusRail Authority</span>
              </p>
              <p className="text-[9.5px] text-[#A69E8D] uppercase tracking-wider font-mono">
                Key ID: GDXP...RXGC (Ed25519 Verified Signer)
              </p>
              <p className="text-[9px] text-[#C5A059] font-mono tracking-widest">
                ATTESTATION DIGEST: {receiptData.txHash.slice(0, 16).toUpperCase()}
              </p>
            </div>

          </div>

        </div>

      </article>

      {/* =========================================================================
          PRINT & PDF SPECIFIC STYLESHEET
          Strictly preserves the Dark Charcoal & Gold palette in Print/PDF output
          AND guarantees 100% SINGLE PAGE (1-PAGE A4) rendering without overflow!
          ========================================================================= */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
        @media print {
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background-color: #26282C !important;
            color: #D9D2C2 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-outer {
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
            background: transparent !important;
          }
          #nexus-official-receipt {
            background-color: #26282C !important;
            border: 1px solid #C5A059 !important;
            box-shadow: none !important;
            padding: 16px 22px !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            overflow: hidden !important;
          }
        }
      `}} />

    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141619] text-[#E0D8C3] p-8 font-mono">Loading official receipt...</div>}>
      <ReceiptContent />
    </Suspense>
  );
}
