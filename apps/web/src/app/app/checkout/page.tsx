'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  Wallet,
  Zap,
  Rocket,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { fetchOrders, startStripeCheckout } from '@/lib/shop';

export type PaymentRailChoice = 'XRPL' | 'STELLAR' | 'STRIPE' | 'WALLET';

interface InvoiceData {
  orderId: string;
  chain: string;
  network: string;
  amount: string;
  amountXrp?: number;
  amountXlm?: string;
  destination: string;
  destinationTag?: number;
  memo?: string;
  memoType?: string;
  expiresAt: string;
  status: string;
}

interface OrderInfo {
  id: string;
  orderNumber: string;
  totalCents: number;
  status: string;
  rail?: string;
  txHash?: string;
  ipfsHash?: string;
  items?: Array<{ sku: string; title: string; qty: number; unitPriceCents: number }>;
}

function CheckoutContent() {
  const searchParams = useSearchParams();

  const paramOrderId = searchParams.get('orderId') || '';
  const paramTitle = searchParams.get('title') || '';

  const [orderId, setOrderId] = useState(paramOrderId);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [userOrders, setUserOrders] = useState<OrderInfo[]>([]);

  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('XRPL');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [inputTxHash, setInputTxHash] = useState('');
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Wallet info
  const [walletBalance, setWalletBalance] = useState<{ usd: number; xrp: number; xlm: number } | null>(null);

  // Load user orders and active order details
  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    if (!token) return;

    fetchOrders()
      .then((orders: any) => {
        setUserOrders(orders);
        if (paramOrderId) {
          const match = orders.find((o: any) => o.id === paramOrderId || o.orderNumber === paramOrderId);
          if (match) setOrderInfo(match);
        } else if (orders.length > 0) {
          const latestPending = orders.find((o: any) => o.status === 'PENDING') || orders[0];
          setOrderId(latestPending.id);
          setOrderInfo(latestPending);
        }
      })
      .catch(() => {});

    // Fetch wallet balance
    fetch('/api/v1/wallet/balance', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.balances) {
          setWalletBalance(data.balances);
        }
      })
      .catch(() => {});
  }, [paramOrderId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelectRail = (rail: PaymentRailChoice) => {
    setSelectedRail(rail);
    setInvoice(null);
    setError('');
    setVerifySuccess(null);
  };

  const requestInvoice = async () => {
    setBusy(true);
    setError('');
    setInvoice(null);
    setVerifySuccess(null);

    try {
      if (selectedRail === 'STRIPE') {
        await startStripeCheckout();
        return;
      }

      if (!orderId) {
        setError('Please select or specify a valid Order ID to generate a payment invoice.');
        setBusy(false);
        return;
      }

      const token = localStorage.getItem('nexus_token');
      if (!token) {
        setError('Please sign in before requesting an invoice.');
        setBusy(false);
        return;
      }

      if (selectedRail === 'WALLET') {
        // Internal wallet settles via Agent Desk proposals
        setError('Internal USD Wallet settles atomically through the AI Agent Desk or proposal confirmation.');
        setBusy(false);
        return;
      }

      const path = selectedRail === 'XRPL' ? 'xrpl' : 'stellar';
      const res = await fetch(`/api/v1/checkout/${path}/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok || !data.invoice) {
        setError(data.error || 'Failed to generate payment invoice.');
        return;
      }

      setInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setBusy(false);
    }
  };

  const verifyPaymentOnChain = async () => {
    if (!orderId || !inputTxHash.trim()) {
      setError('Please enter the on-chain transaction hash to verify.');
      return;
    }

    setVerifying(true);
    setError('');
    setVerifySuccess(null);

    const token = localStorage.getItem('nexus_token');
    const path = selectedRail === 'XRPL' ? 'xrpl' : 'stellar';

    try {
      const res = await fetch(`/api/v1/checkout/${path}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, txHash: inputTxHash.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Payment verification could not be confirmed on-chain yet.');
        return;
      }

      setVerifySuccess(`Payment verified on ${selectedRail} Testnet! Order marked PAID.`);
      // Refresh order info
      const orders: any = await fetchOrders();
      const updated = orders.find((o: any) => o.id === orderId);
      if (updated) setOrderInfo(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed.');
    } finally {
      setVerifying(false);
    }
  };

  const checkOrderStatus = async () => {
    setVerifying(true);
    setError('');
    try {
      const orders: any = await fetchOrders();
      const updated = orders.find((o: any) => o.id === orderId);
      if (updated) {
        setOrderInfo(updated);
        if (updated.status === 'PAID' || updated.status === 'FULFILLED') {
          setVerifySuccess(`Order is ${updated.status} in the database!`);
        } else {
          setError(`Order status is currently ${updated.status}. Waiting for ledger confirmation.`);
        }
      }
    } catch {
      setError('Could not refresh order status.');
    } finally {
      setVerifying(false);
    }
  };

  const isOrderPaid = orderInfo?.status === 'PAID' || orderInfo?.status === 'FULFILLED';
  const orderPriceUsd = orderInfo ? (orderInfo.totalCents / 100).toFixed(2) : '—';

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <Link href="/app/cart" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Cart
        </Link>

        {/* Page Header */}
        <div className="border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-3">
              <Zap className="w-8 h-8 text-rail-emerald" />
              <span>Multi-Rail Checkout Terminal</span>
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Live settlement on XRPL Altnet Testnet, Stellar Horizon Testnet, Stripe, or Double-Entry Ledger.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rail-emerald animate-pulse" />
              Real Testnet Assets
            </span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rail Selection & Interactive Terminal */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">1. Select Payment Rail</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* XRPL */}
                <button
                  type="button"
                  onClick={() => handleSelectRail('XRPL')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'XRPL'
                      ? 'bg-xrpl-blue/15 border-xrpl-blue text-white shadow-xl shadow-xrpl-blue/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <Zap className="w-6 h-6 text-xrpl-blue" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-xrpl-blue/20 text-xrpl-blue font-bold">
                      XRPL TESTNET
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">XRPL (XRP)</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Altnet WebSocket • Deterministic 32-bit Destination Tag
                    </p>
                  </div>
                </button>

                {/* Stellar */}
                <button
                  type="button"
                  onClick={() => handleSelectRail('STELLAR')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'STELLAR'
                      ? 'bg-stellar-cyan/15 border-stellar-cyan text-white shadow-xl shadow-stellar-cyan/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <Rocket className="w-6 h-6 text-stellar-cyan" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stellar-cyan/20 text-stellar-cyan font-bold">
                      STELLAR TESTNET
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Stellar (XLM)</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Horizon Testnet • Order-Bound Text Memo Verification
                    </p>
                  </div>
                </button>

                {/* Stripe */}
                <button
                  type="button"
                  onClick={() => handleSelectRail('STRIPE')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'STRIPE'
                      ? 'bg-rail-emerald/15 border-rail-emerald text-white shadow-xl shadow-rail-emerald/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <CreditCard className="w-6 h-6 text-rail-emerald" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rail-emerald/20 text-rail-emerald font-bold">
                      STRIPE CARD
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Stripe Checkout</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Instant Webhook & IPFS Hash Attestation
                    </p>
                  </div>
                </button>

                {/* Internal Wallet */}
                <button
                  type="button"
                  onClick={() => handleSelectRail('WALLET')}
                  className={`p-5 rounded-2xl border flex flex-col justify-between text-left transition-all ${
                    selectedRail === 'WALLET'
                      ? 'bg-cyber-purple/15 border-cyber-purple text-white shadow-xl shadow-cyber-purple/10 scale-[1.02]'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-3">
                    <Wallet className="w-6 h-6 text-cyber-purple" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple font-bold">
                      DOUBLE-ENTRY LEDGER
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Internal Wallet</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Balance: ${walletBalance?.usd ? (walletBalance.usd / 100).toFixed(2) : '0.00'} USD
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Invoice Terminal Card */}
            {invoice && (
              <div className="p-6 rounded-2xl bg-nexus-card border border-gray-700 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-rail-emerald" />
                    <span className="text-sm font-bold text-white font-mono uppercase">
                      {invoice.chain} Testnet Invoice Ready
                    </span>
                  </div>
                  <span className="text-xs font-mono text-gray-400">
                    Expires: {new Date(invoice.expiresAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Amount to send */}
                <div className="p-4 rounded-xl bg-gray-900/90 border border-gray-800 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-400 font-mono">Amount Required</div>
                    <div className="text-2xl font-black text-white mt-1">
                      {selectedRail === 'XRPL' ? `${invoice.amountXrp || invoice.amount} XRP` : `${invoice.amountXlm || invoice.amount} XLM`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 font-mono">Equivalent Fiat</div>
                    <div className="text-lg font-bold text-rail-emerald mt-1">${orderPriceUsd} USD</div>
                  </div>
                </div>

                {/* Destination Address */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Merchant Vault Address ({invoice.chain} Testnet)</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(invoice.destination, 'dest')}
                      className="text-rail-emerald hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'dest' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'dest' ? 'Copied!' : 'Copy Address'}</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-900/90 border border-gray-800 text-xs font-mono text-gray-200 break-all select-all">
                    {invoice.destination}
                  </div>
                </div>

                {/* Memo / Destination Tag */}
                {selectedRail === 'XRPL' && invoice.destinationTag != null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-400 font-mono">
                      <span className="text-amber-400 font-bold">CRITICAL: Destination Tag (Required for credit)</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(invoice.destinationTag), 'tag')}
                        className="text-xrpl-blue hover:underline flex items-center gap-1 font-bold"
                      >
                        {copiedKey === 'tag' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'tag' ? 'Copied!' : 'Copy Tag'}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-xrpl-blue/10 border border-xrpl-blue/30 text-base font-black text-xrpl-blue font-mono flex items-center justify-between">
                      <span>{invoice.destinationTag}</span>
                      <span className="text-[11px] font-normal text-gray-400">Deterministic 32-bit uint</span>
                    </div>
                  </div>
                )}

                {selectedRail === 'STELLAR' && invoice.memo && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-400 font-mono">
                      <span className="text-amber-400 font-bold">CRITICAL: Stellar Memo (Required for credit)</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(invoice.memo), 'memo')}
                        className="text-stellar-cyan hover:underline flex items-center gap-1 font-bold"
                      >
                        {copiedKey === 'memo' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'memo' ? 'Copied!' : 'Copy Memo'}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-stellar-cyan/10 border border-stellar-cyan/30 text-base font-black text-stellar-cyan font-mono flex items-center justify-between">
                      <span>{invoice.memo}</span>
                      <span className="text-[11px] font-normal text-gray-400">Memo Type: {invoice.memoType || 'text'}</span>
                    </div>
                  </div>
                )}

                {/* Explorer Links */}
                <div className="pt-2 flex flex-wrap gap-3 text-xs font-mono">
                  {selectedRail === 'XRPL' && (
                    <a
                      href={`https://testnet.xrpl.org/accounts/${invoice.destination}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xrpl-blue hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Vault on XRPL Testnet Explorer
                    </a>
                  )}
                  {selectedRail === 'STELLAR' && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${invoice.destination}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-stellar-cyan hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Vault on StellarExpert Testnet
                    </a>
                  )}
                </div>

                {/* On-Chain Payment Verification Form */}
                <div className="pt-4 border-t border-gray-800 space-y-3">
                  <label className="text-xs font-mono text-gray-300 uppercase tracking-wider block">
                    Verify Your Payment
                  </label>
                  <p className="text-xs text-gray-400">
                    Once you send funds from your testnet wallet, paste the transaction hash below or check status:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Paste Transaction Hash (TxHash / Ledger Hash)"
                      value={inputTxHash}
                      onChange={(e) => setInputTxHash(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-nexus-dark border border-gray-700 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-rail-emerald"
                    />
                    <button
                      type="button"
                      onClick={verifyPaymentOnChain}
                      disabled={verifying || !inputTxHash.trim()}
                      className="px-5 py-2.5 rounded-xl bg-rail-emerald text-nexus-dark font-extrabold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 hover:opacity-95"
                    >
                      {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Verify On-Chain</span>
                    </button>
                    <button
                      type="button"
                      onClick={checkOrderStatus}
                      disabled={verifying}
                      className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-rail-emerald' : ''}`} />
                      <span>Check Status</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Wallet Option Explanation */}
            {selectedRail === 'WALLET' && (
              <div className="p-6 rounded-2xl bg-cyber-purple/10 border border-cyber-purple/30 space-y-4">
                <div className="flex items-center gap-2 text-cyber-purple font-bold">
                  <Wallet className="w-5 h-5" />
                  <span>Double-Entry Internal Wallet</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Your internal wallet balance is strictly validated against MongoDB double-entry records. Purchases using this wallet are initiated and confirmed through the AI Agent Desk or proposal locks.
                </p>
                <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-nexus-dark border border-gray-800">
                    <div className="text-gray-400">USD Balance</div>
                    <div className="text-white font-bold mt-1">${walletBalance?.usd ? (walletBalance.usd / 100).toFixed(2) : '0.00'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-nexus-dark border border-gray-800">
                    <div className="text-gray-400">XRP Balance</div>
                    <div className="text-white font-bold mt-1">{walletBalance?.xrp || 0} XRP</div>
                  </div>
                  <div className="p-3 rounded-xl bg-nexus-dark border border-gray-800">
                    <div className="text-gray-400">XLM Balance</div>
                    <div className="text-white font-bold mt-1">{walletBalance?.xlm || 0} XLM</div>
                  </div>
                </div>
                <Link
                  href="/app/guide"
                  className="inline-flex items-center gap-1.5 text-xs text-cyber-purple font-bold hover:underline"
                >
                  <span>Open AI Agent Desk to confirm purchase &rarr;</span>
                </Link>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary & Verification Feedback */}
          <div className="p-6 rounded-2xl bg-gray-900/90 border border-gray-800 space-y-6 h-fit shadow-2xl">
            <h3 className="text-base font-bold border-b border-gray-800 pb-3 flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs font-mono text-gray-400">{orderInfo?.orderNumber || orderId || 'No Order'}</span>
            </h3>

            {/* Order selector if user has multiple pending */}
            {userOrders.length > 1 && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-gray-400 uppercase">Select Order</label>
                <select
                  value={orderId}
                  onChange={(e) => {
                    setOrderId(e.target.value);
                    const sel = userOrders.find((o) => o.id === e.target.value);
                    if (sel) setOrderInfo(sel);
                    setInvoice(null);
                    setError('');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-nexus-dark border border-gray-700 text-xs font-mono text-white focus:outline-none"
                >
                  {userOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber || o.id} (${((o.totalCents || 0) / 100).toFixed(2)} - {o.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3 text-xs font-mono text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Order Title</span>
                <span className="text-white font-bold text-right truncate max-w-[160px]">
                  {paramTitle || (orderInfo?.items?.map((i) => i.title).join(', ') || 'Items')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Selected Rail</span>
                <span className="text-rail-emerald font-bold">{selectedRail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Order Status</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    isOrderPaid
                      ? 'bg-rail-emerald/20 text-rail-emerald border border-rail-emerald/40'
                      : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  }`}
                >
                  {orderInfo?.status || 'PENDING'}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-3 text-sm font-bold text-white">
                <span>Total Charge</span>
                <span className="text-rail-emerald">${orderPriceUsd} USD</span>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success banner */}
            {verifySuccess && (
              <div className="p-4 rounded-xl bg-rail-emerald/20 border border-rail-emerald/50 text-rail-emerald text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <CheckCircle2 className="w-5 h-5 text-rail-emerald" />
                  <span>{verifySuccess}</span>
                </div>
                {orderInfo?.ipfsHash && (
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${orderInfo.ipfsHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-stellar-cyan hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Pinned IPFS Receipt ({orderInfo.ipfsHash.slice(0, 10)}...)</span>
                  </a>
                )}
                <Link
                  href={`/app/orders?orderId=${encodeURIComponent(orderId)}`}
                  className="block mt-2 text-center py-2 rounded-lg bg-rail-emerald text-nexus-dark font-extrabold text-xs"
                >
                  View Order in Dashboard &rarr;
                </Link>
              </div>
            )}

            {/* Paid state */}
            {isOrderPaid && !verifySuccess && (
              <div className="p-4 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>This order is already PAID!</span>
                </div>
                <Link
                  href={`/app/orders?orderId=${encodeURIComponent(orderId)}`}
                  className="block text-center py-2 rounded-lg bg-rail-emerald text-nexus-dark font-bold text-xs"
                >
                  View in Orders
                </Link>
              </div>
            )}

            {/* Primary Action Button */}
            {!isOrderPaid && !invoice && (
              <button
                type="button"
                onClick={requestInvoice}
                disabled={busy}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-rail-emerald via-emerald-500 to-teal-400 text-nexus-dark font-extrabold text-sm shadow-xl shadow-rail-emerald/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Contacting {selectedRail} Provider…</span>
                  </>
                ) : selectedRail === 'STRIPE' ? (
                  <>
                    <span>Continue to Stripe Checkout</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                ) : (
                  <>
                    <span>Generate {selectedRail} Invoice</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-nexus-dark text-white p-12 font-mono">Loading checkout terminal...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
