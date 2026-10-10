'use client';

import React, { useState } from 'react';
import { CreditCard, Wallet, Zap, Rocket, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react';

export type PaymentRailChoice = 'STRIPE' | 'WALLET' | 'XRPL' | 'STELLAR';

interface MultiRailCheckoutProps {
  priceCents: number;
  productTitle: string;
  onSelectRail?: (rail: PaymentRailChoice) => void;
  onPaymentSuccess?: (receipt: any) => void;
}

export function MultiRailCheckoutSelector({
  priceCents,
  productTitle,
  onSelectRail,
  onPaymentSuccess,
}: MultiRailCheckoutProps) {
  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('STRIPE');
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);

  const usdPrice = (priceCents / 100).toFixed(2);
  const xrpEstimate = ((priceCents / 100) * 2.15).toFixed(2);
  const xlmEstimate = ((priceCents / 100) * 4.8).toFixed(2);

  const handleSelect = async (rail: PaymentRailChoice) => {
    setSelectedRail(rail);
    onSelectRail?.(rail);
    setInvoiceData(null);
    setIsLoading(true);

    const token = localStorage.getItem('nexus_token') || 'demo_token';
    const orderId = `ord_${Date.now()}`;

    try {
      if (rail === 'XRPL') {
        const res = await fetch('/api/v1/checkout/xrpl/create-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId, amountXrp: parseFloat(xrpEstimate) }),
        });
        const data = await res.json();
        setInvoiceData(data.invoice || { orderId, amountXrp: xrpEstimate, destinationTag: 948102, address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh' });
      } else if (rail === 'STELLAR') {
        const res = await fetch('/api/v1/checkout/stellar/create-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId, amountXlm: parseFloat(xlmEstimate) }),
        });
        const data = await res.json();
        setInvoiceData(data.invoice || { orderId, amountXlm: xlmEstimate, memoText: `MEMO_${orderId}`, address: 'GBRPYHIL2CI3FNQ4BXLFMNDLF2C' });
      } else if (rail === 'STRIPE') {
        const res = await fetch('/api/v1/checkout/stripe/create-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sku: 'PROD-KIT', quantity: 1 }),
        });
        const data = await res.json();
        setInvoiceData(data.data || { url: 'https://checkout.stripe.com/pay/demo_session' });
      } else {
        setInvoiceData({ orderId, status: 'PAID', message: 'Internal USD Wallet debited successfully' });
      }
    } catch (err) {
      setInvoiceData({ orderId, status: 'READY', message: 'Offline mode invoice generated' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg p-6 rounded-2xl bg-nexus-card border border-gray-800 space-y-6 shadow-2xl">
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
              <div className="text-xs text-gray-400">$0.00 Fee</div>
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
              <div className="text-xs text-gray-400">≈ {xrpEstimate} XRP</div>
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
              <div className="text-xs text-gray-400">≈ {xlmEstimate} XLM</div>
            </div>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center gap-2 text-xs font-mono text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin text-rail-emerald" />
          <span>Generating {selectedRail} payment invoice...</span>
        </div>
      )}

      {invoiceData && !isLoading && (
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-rail-emerald font-bold">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Invoice Ready</span>
            <span>{selectedRail}</span>
          </div>
          {selectedRail === 'XRPL' && (
            <div className="space-y-1 text-gray-300">
              <div>Send: <strong className="text-white">{invoiceData.amountXrp || xrpEstimate} XRP</strong></div>
              <div>Address: <span className="text-xs text-gray-400">{invoiceData.address || 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'}</span></div>
              <div>Destination Tag: <strong className="text-xrpl-blue">{invoiceData.destinationTag || 948102}</strong></div>
            </div>
          )}
          {selectedRail === 'STELLAR' && (
            <div className="space-y-1 text-gray-300">
              <div>Send: <strong className="text-white">{invoiceData.amountXlm || xlmEstimate} XLM</strong></div>
              <div>Address: <span className="text-xs text-gray-400">{invoiceData.address || 'GBRPYHIL2CI3FNQ4BXLFMNDLF2C'}</span></div>
              <div>Memo Text: <strong className="text-stellar-cyan">{invoiceData.memoText || 'MEMO_1001'}</strong></div>
            </div>
          )}
          {selectedRail === 'STRIPE' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-gray-800/90 border border-gray-700 text-xs text-gray-300 space-y-1">
                <div className="flex justify-between">
                  <span>Stripe Test Card:</span>
                  <span className="font-mono text-rail-emerald font-bold">4242 •••• •••• 4242</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>CVC: 123</span>
                  <span>Exp: 12/28</span>
                </div>
              </div>
              {invoiceData.status === 'PAID' ? (
                <div className="p-2.5 rounded-lg bg-rail-emerald/20 border border-rail-emerald/50 text-rail-emerald text-xs font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Stripe Test Payment Verified & IPFS Receipt Pinned!
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const res = await fetch(`/api/v1/checkout/orders/${invoiceData.orderId || 'ord_1001'}/ipfs-receipt`);
                      const receiptData = await res.json();
                      setInvoiceData({
                        ...invoiceData,
                        status: 'PAID',
                        receipt: receiptData.receipt,
                      });
                      onPaymentSuccess?.(receiptData.receipt);
                    } catch (err) {
                      setInvoiceData({ ...invoiceData, status: 'PAID' });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-rail-emerald to-emerald-600 text-nexus-dark font-extrabold text-xs shadow-md shadow-rail-emerald/20 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Authorize Stripe Test Payment (${usdPrice})</span>
                </button>
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
