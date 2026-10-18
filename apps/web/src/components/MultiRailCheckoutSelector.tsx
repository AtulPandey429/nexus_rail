'use client';

import React, { useState } from 'react';
import { CreditCard, Wallet, Zap, Rocket, CheckCircle, RefreshCw, ExternalLink, Copy, Check, AlertCircle } from 'lucide-react';
import { StripeCheckoutModal } from './StripeCheckoutModal';

export type PaymentRailChoice = 'STRIPE' | 'WALLET' | 'XRPL' | 'STELLAR';

interface MultiRailCheckoutProps {
  priceCents: number;
  productTitle: string;
  orderId?: string;
  sku?: string;
  onSelectRail?: (rail: PaymentRailChoice) => void;
  onPaymentSuccess?: (receipt: any) => void;
}

export function MultiRailCheckoutSelector({
  priceCents,
  productTitle,
  orderId: initialOrderId,
  sku,
  onSelectRail,
  onPaymentSuccess,
}: MultiRailCheckoutProps) {
  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('STRIPE');
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string>(initialOrderId || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  const usdPrice = (priceCents / 100).toFixed(2);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelect = async (rail: PaymentRailChoice) => {
    setSelectedRail(rail);
    onSelectRail?.(rail);
    setInvoiceData(null);
    setIsLoading(true);
    setIsStripeModalOpen(false);
    setVerificationResult(null);

    const token = localStorage.getItem('nexus_token');
    if (!token) {
      setInvoiceData({ error: 'Please sign in before initiating checkout.' });
      setIsLoading(false);
      return;
    }

    try {
      if (rail === 'STRIPE') {
        setIsStripeModalOpen(true);
        setIsLoading(false);
        return;
      }
      if (rail === 'WALLET') {
        setInvoiceData({ message: 'Internal USD Wallet settles through AI Agent Desk or confirmed proposals.' });
        setIsLoading(false);
        return;
      }

      let currentOrderId = activeOrderId;
      // If no orderId is present, create one in the database
      if (!currentOrderId) {
        const orderRes = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rail,
            items: [{ sku: sku || 'HARDWARE-WALLET-01', qty: 1, unitPriceCents: priceCents }],
          }),
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok || !orderData?.data?.order?.id) {
          setInvoiceData({ error: orderData.error || 'Failed to create order.' });
          setIsLoading(false);
          return;
        }
        currentOrderId = orderData.data.order.id;
        setActiveOrderId(currentOrderId);
      }

      const path = rail === 'XRPL' ? 'xrpl' : 'stellar';
      const res = await fetch(`/api/v1/checkout/${path}/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: currentOrderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.invoice) {
        setInvoiceData({ error: data.error || 'The network did not return an invoice.' });
        return;
      }
      setInvoiceData(data.invoice);
    } catch (err) {
      setInvoiceData({ error: err instanceof Error ? err.message : 'Checkout failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!activeOrderId || !txHashInput.trim()) return;
    setVerifying(true);
    setVerificationResult(null);
    const token = localStorage.getItem('nexus_token');
    const path = selectedRail === 'XRPL' ? 'xrpl' : 'stellar';
    try {
      const res = await fetch(`/api/v1/checkout/${path}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: activeOrderId, txHash: txHashInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerificationResult('Payment confirmed on-chain! Order marked PAID.');
        onPaymentSuccess?.(data);
      } else {
        setVerificationResult(data.error || 'Verification not confirmed on ledger yet.');
      }
    } catch (err) {
      setVerificationResult(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleStripeSuccess = () => {
    setIsStripeModalOpen(false);
    onPaymentSuccess?.({ rail: 'STRIPE', status: 'PAID' });
  };

  return (
    <div className="w-full max-w-lg p-6 rounded-2xl bg-nexus-card border border-gray-800 space-y-6 shadow-2xl">
      <StripeCheckoutModal
        isOpen={isStripeModalOpen}
        onClose={() => setIsStripeModalOpen(false)}
        productTitle={productTitle}
        priceCents={priceCents}
        onSuccess={handleStripeSuccess}
      />

      <div className="border-b border-gray-800 pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-rail-emerald">Multi-Rail Payment Engine</span>
        <h2 className="text-xl font-bold text-white mt-1">{productTitle}</h2>
        <div className="text-2xl font-black text-white mt-2">
          ${usdPrice} <span className="text-xs text-gray-400 font-normal">USD</span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Select Payment Rail</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSelect('STRIPE')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'STRIPE'
                ? 'bg-rail-emerald/10 border-rail-emerald text-white shadow-lg shadow-rail-emerald/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <CreditCard className="w-5 h-5 text-rail-emerald" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Stripe Card</div>
              <div className="text-xs text-gray-400">${usdPrice} Fiat</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('WALLET')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'WALLET'
                ? 'bg-cyber-purple/10 border-cyber-purple text-white shadow-lg shadow-cyber-purple/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <Wallet className="w-5 h-5 text-cyber-purple" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Internal Wallet</div>
              <div className="text-xs text-gray-400">Double-Entry USD</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('XRPL')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'XRPL'
                ? 'bg-xrpl-blue/10 border-xrpl-blue text-white shadow-lg shadow-xrpl-blue/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <Zap className="w-5 h-5 text-xrpl-blue" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">XRPL (XRP)</div>
              <div className="text-xs text-gray-400">Testnet Altnet</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('STELLAR')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 transition-all ${
              selectedRail === 'STELLAR'
                ? 'bg-stellar-cyan/10 border-stellar-cyan text-white shadow-lg shadow-stellar-cyan/10'
                : 'bg-nexus-dark/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <Rocket className="w-5 h-5 text-stellar-cyan" />
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Stellar (XLM)</div>
              <div className="text-xs text-gray-400">Horizon Testnet</div>
            </div>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center gap-2 text-xs font-mono text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin text-rail-emerald" />
          <span>Generating {selectedRail} payment invoice from live testnet…</span>
        </div>
      )}

      {invoiceData && !isLoading && (
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-3 text-xs font-mono">
          <div className="flex justify-between items-center text-rail-emerald font-bold">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Invoice Ready</span>
            <span className="uppercase text-[11px] px-2 py-0.5 rounded bg-rail-emerald/10 border border-rail-emerald/30">
              {selectedRail} TESTNET
            </span>
          </div>

          {invoiceData.error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{String(invoiceData.error)}</span>
            </div>
          )}

          {selectedRail === 'XRPL' && (invoiceData.amountXrp != null || invoiceData.amount != null) && (
            <div className="space-y-2 text-gray-300">
              <div className="flex justify-between items-center">
                <span>Send Exactly:</span>
                <strong className="text-white text-sm">{String(invoiceData.amountXrp || invoiceData.amount)} XRP</strong>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-gray-400">
                  <span>Merchant Vault:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(invoiceData.destination, 'dest')}
                    className="text-rail-emerald hover:underline flex items-center gap-1 text-[11px]"
                  >
                    {copiedKey === 'dest' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'dest' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-nexus-dark border border-gray-800 text-[11px] text-gray-300 break-all select-all">
                  {invoiceData.destination}
                </div>
              </div>
              {invoiceData.destinationTag != null && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-amber-400 font-bold">Required Destination Tag:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(invoiceData.destinationTag), 'tag')}
                      className="text-xrpl-blue hover:underline flex items-center gap-1 text-[11px] font-bold"
                    >
                      {copiedKey === 'tag' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'tag' ? 'Copied' : 'Copy Tag'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded bg-xrpl-blue/10 border border-xrpl-blue/30 text-xrpl-blue font-bold text-sm">
                    {invoiceData.destinationTag}
                  </div>
                </div>
              )}
              <div className="pt-1">
                <a
                  href={`https://testnet.xrpl.org/accounts/${invoiceData.destination}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xrpl-blue hover:underline flex items-center gap-1 text-[11px]"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Vault on XRPL Testnet Explorer
                </a>
              </div>
            </div>
          )}

          {selectedRail === 'STELLAR' && (invoiceData.amountXlm != null || invoiceData.amount != null) && (
            <div className="space-y-2 text-gray-300">
              <div className="flex justify-between items-center">
                <span>Send Exactly:</span>
                <strong className="text-white text-sm">{String(invoiceData.amountXlm || invoiceData.amount)} XLM</strong>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-gray-400">
                  <span>Merchant Vault:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(invoiceData.destination, 'dest')}
                    className="text-rail-emerald hover:underline flex items-center gap-1 text-[11px]"
                  >
                    {copiedKey === 'dest' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'dest' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-nexus-dark border border-gray-800 text-[11px] text-gray-300 break-all select-all">
                  {invoiceData.destination}
                </div>
              </div>
              {invoiceData.memo && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-amber-400 font-bold">Required Memo (text):</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(invoiceData.memo), 'memo')}
                      className="text-stellar-cyan hover:underline flex items-center gap-1 text-[11px] font-bold"
                    >
                      {copiedKey === 'memo' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'memo' ? 'Copied' : 'Copy Memo'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded bg-stellar-cyan/10 border border-stellar-cyan/30 text-stellar-cyan font-bold text-sm">
                    {invoiceData.memo}
                  </div>
                </div>
              )}
              <div className="pt-1">
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${invoiceData.destination}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stellar-cyan hover:underline flex items-center gap-1 text-[11px]"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Vault on StellarExpert Explorer
                </a>
              </div>
            </div>
          )}

          {/* Verification section */}
          {(selectedRail === 'XRPL' || selectedRail === 'STELLAR') && (
            <div className="pt-2 border-t border-gray-800 space-y-2">
              <div className="text-[11px] text-gray-400">Verify Payment Hash:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="TxHash / Ledger Hash"
                  value={txHashInput}
                  onChange={(e) => setTxHashInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded bg-nexus-dark border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying || !txHashInput.trim()}
                  className="px-3 py-1.5 rounded bg-rail-emerald text-nexus-dark font-bold text-xs disabled:opacity-50"
                >
                  {verifying ? 'Verifying…' : 'Verify'}
                </button>
              </div>
              {verificationResult && (
                <div className={`p-2 rounded text-xs ${verificationResult.includes('PAID') ? 'bg-rail-emerald/20 text-rail-emerald' : 'bg-rose-500/10 text-rose-300'}`}>
                  {verificationResult}
                </div>
              )}
            </div>
          )}

          {selectedRail === 'WALLET' && (
            <p className="text-rail-emerald">{invoiceData.message || 'Payment confirmed via Internal Wallet'}</p>
          )}
        </div>
      )}
    </div>
  );
}
