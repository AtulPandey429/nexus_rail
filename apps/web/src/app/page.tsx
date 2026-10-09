'use client';

import React, { useState } from 'react';
import { MultiRailCheckoutSelector } from '@/components/MultiRailCheckoutSelector';
import { AgentDeskPanel } from '@/components/AgentDeskPanel';
import { ProductShowdownCard } from '@/components/ProductShowdownCard';
import { AnalyticsLedgerDashboard } from '@/components/AnalyticsLedgerDashboard';
import { PluginsShowcase } from '@/components/PluginsShowcase';
import { RwaGoldVaultCard } from '@/components/RwaGoldVaultCard';
import { Navbar, ViewType } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import {
  Zap,
  Bot,
  ShieldCheck,
  Layers,
  Sparkles,
  Cpu,
  BarChart3,
  ShoppingBag,
  Coins,
  PackageCheck,
  User,
  CreditCard,
  Trash2,
  Send,
  PlusCircle,
  Check,
  ArrowRightCircle,
  CheckCircle,
  LayoutDashboard,
  ShoppingCart,
  Users,
  QrCode,
  TrendingUp,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export default function Home() {
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authUser, setAuthUser] = useState<{
    id: string;
    email?: string;
    walletAddress?: string;
    role: 'user' | 'admin';
  } | null>({
    id: 'usr_buyer_101',
    email: 'buyer@nexusrail.io',
    role: 'user',
  });
  const [authToken, setAuthToken] = useState<string | null>('demo_jwt_token_123');
  const [activeView, setActiveView] = useState<ViewType>('rwa');

  // Shared Global State Engine
  const [cartItems, setCartItems] = useState([
    { sku: 'NL-NOTE-A5', title: 'Nexus A5 Hardcover Notebook Set', priceCents: 2400, qty: 1 },
    { sku: 'NL-PEN-SET', title: 'Nexus Precision Gel Pen Set', priceCents: 1800, qty: 1 },
  ]);

  const [orders, setOrders] = useState([
    {
      id: 'ord_1001',
      orderNumber: 'NR-1001',
      buyerEmail: 'buyer@example.com',
      status: 'PAID' as 'PENDING' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'FAILED',
      totalCents: 2400,
      createdAt: '2026-10-09T00:00:00.000Z',
      items: [{ sku: 'NL-NOTE-A5', title: 'Nexus A5 Hardcover Notebook Set', qty: 1 }],
    },
    {
      id: 'ord_1002',
      orderNumber: 'NR-1002',
      buyerEmail: 'buyer2@example.com',
      status: 'FULFILLING' as 'PENDING' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'FAILED',
      totalCents: 4200,
      createdAt: '2026-10-08T18:30:00.000Z',
      items: [{ sku: 'NL-LAMP', title: 'Nexus Minimalist LED Desk Lamp', qty: 1 }],
    },
  ]);

  const [guideMessages, setGuideMessages] = useState<
    { role: 'user' | 'assistant'; body: string; suggestedSkus?: string[] }[]
  >([
    {
      role: 'assistant',
      body: 'Welcome to the NexusRail Catalog Guide! Ask me questions about our desk kit products. I will give recommendations, but I cannot execute purchases directly for safety.',
      suggestedSkus: ['NL-NOTE-A5', 'NL-PEN-SET'],
    },
  ]);

  const [guideInput, setGuideInput] = useState('');
  const [addedSkus, setAddedSkus] = useState<Record<string, boolean>>({});

  // RWA Buy Form State
  const [rwaAsset, setRwaAsset] = useState<'nGOLD' | 'nSILVER'>('nGOLD');
  const [rwaAmountInr, setRwaAmountInr] = useState('1000');
  const [rwaPayMethod, setRwaPayMethod] = useState<'upi' | 'card' | 'stellar'>('upi');
  const [isRwaProcessing, setIsRwaProcessing] = useState(false);
  const [rwaReceipt, setRwaReceipt] = useState<any | null>(null);

  // Perps State
  const [perpPair, setPerpPair] = useState<'XAU/USD' | 'XAG/USD'>('XAU/USD');
  const [perpLeverage, setPerpLeverage] = useState(2);
  const [perpSize, setPerpSize] = useState('100');
  const [isPerpOpening, setIsPerpOpening] = useState(false);
  const [activePerpPosition, setActivePerpPosition] = useState<any | null>(null);

  // Cart Handlers
  const handleQtyChange = (sku: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.sku === sku ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const handleRemoveCartItem = (sku: string) => {
    setCartItems((prev) => prev.filter((item) => item.sku !== sku));
  };

  const handleAddToCart = (sku: string) => {
    setAddedSkus((prev) => ({ ...prev, [sku]: true }));
    const existing = cartItems.find((i) => i.sku === sku);
    if (existing) {
      existing.qty += 1;
      setCartItems([...cartItems]);
    } else {
      setCartItems([...cartItems, { sku, title: `Nexus Product ${sku}`, priceCents: 2400, qty: 1 }]);
    }
  };

  // Guide Send Handler
  const handleSendGuideMsg = () => {
    if (!guideInput.trim()) return;
    const userText = guideInput;
    setGuideInput('');

    const newMsgs = [...guideMessages, { role: 'user' as const, body: userText, suggestedSkus: [] }];

    let reply = 'Our catalog includes the A5 Notebook Set ($24), Gel Pen Set ($18), and Minimalist LED Desk Lamp ($42).';
    let suggestedSkus: string[] = [];

    const lower = userText.toLowerCase();
    if (lower.includes('notebook') || lower.includes('paper') || lower.includes('note') || lower.includes('25') || lower.includes('30')) {
      reply = 'The Nexus A5 Hardcover Notebook Set is $24.00 USD. It features 120gsm paper and lay-flat binding.';
      suggestedSkus = ['NL-NOTE-A5'];
    } else if (lower.includes('pen') || lower.includes('write')) {
      reply = 'The Nexus Precision Gel Pen Set is $18.00 USD. It includes 3 ultra-smooth 0.5mm matte black pens.';
      suggestedSkus = ['NL-PEN-SET'];
    } else if (lower.includes('lamp') || lower.includes('light')) {
      reply = 'The Nexus Minimalist LED Desk Lamp is $42.00 USD. It offers touch-dimmable warm LED lighting.';
      suggestedSkus = ['NL-LAMP'];
    } else {
      suggestedSkus = ['NL-NOTE-A5', 'NL-PEN-SET', 'NL-LAMP'];
    }

    setTimeout(() => {
      setGuideMessages([...newMsgs, { role: 'assistant' as const, body: reply, suggestedSkus }]);
    }, 400);
  };

  // Admin Order Transition Handler
  const handleAdminStatusTransition = (orderId: string, nextStatus: 'FULFILLING' | 'FULFILLED' | 'FAILED') => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
  };

  // RWA Buy Handler
  const handleRwaPurchase = () => {
    setIsRwaProcessing(true);
    setRwaReceipt(null);
    const rate = rwaAsset === 'nGOLD' ? 7420.0 : 88.5;
    const grams = (parseFloat(rwaAmountInr || '0') / rate).toFixed(4);

    setTimeout(() => {
      const txHash = `tx_stl_testnet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      setRwaReceipt({
        asset: rwaAsset,
        amountGrams: parseFloat(grams),
        paymentMethod: rwaPayMethod,
        txHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
      });
      setIsRwaProcessing(false);
    }, 1200);
  };

  // Perps Long Handler
  const handleOpenPerp = () => {
    setIsPerpOpening(true);
    const spotPrice = perpPair === 'XAU/USD' ? 2740.50 : 32.50;
    const marginUsd = (parseFloat(perpSize || '0') / perpLeverage).toFixed(2);
    const liquidationPrice = (spotPrice - spotPrice * (0.8 / perpLeverage)).toFixed(2);

    setTimeout(() => {
      setActivePerpPosition({
        pair: perpPair,
        leverage: perpLeverage,
        entryPrice: spotPrice,
        sizeUsd: parseFloat(perpSize),
        marginUsd: parseFloat(marginUsd),
        liquidationPrice: parseFloat(liquidationPrice),
      });
      setIsPerpOpening(false);
    }, 1000);
  };

  const cartTotalCents = cartItems.reduce((acc, item) => acc + item.priceCents * item.qty, 0);

  return (
    <main className="min-h-screen bg-nexus-dark text-white flex flex-col items-center justify-between p-3 md:p-8 relative overflow-x-hidden">
      {/* Ambient Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-rail-emerald/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-cyber-purple/10 blur-[180px] rounded-full pointer-events-none" />

      {/* Top Navbar & Auth Modal */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        cartCount={cartItems.reduce((acc, i) => acc + i.qty, 0)}
        onOpenAgentDesk={() => setIsAgentOpen(true)}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        user={authUser}
        onLogout={() => setAuthUser(null)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user, token) => {
          setAuthUser(user);
          setAuthToken(token);
        }}
      />

      {/* Main Container View Switcher (Zero 404 Page Reloads) */}
      <div className="w-full max-w-6xl z-10 py-4 flex-1">
        {/* VIEW 1: RWA VAULT OVERVIEW */}
        {activeView === 'rwa' && (
          <div className="space-y-6">
            <RwaGoldVaultCard />
          </div>
        )}

        {/* VIEW 2: RWA MULTI-RAIL BUY */}
        {activeView === 'rwa_buy' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="p-6 rounded-3xl bg-nexus-card border border-gray-800 space-y-6 shadow-2xl">
              <div className="border-b border-gray-800 pb-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Coins className="w-6 h-6 text-amber-400" />
                  <span>Multi-Rail RWA Commodity Acquisition</span>
                </h1>
                <p className="text-xs text-gray-400 font-mono mt-1">Buy fractional Gold or Silver tokens using Instant UPI QR, Stripe Card, or Stellar Testnet</p>
              </div>

              {/* Asset Selector */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRwaAsset('nGOLD')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    rwaAsset === 'nGOLD' ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/10' : 'bg-gray-900/60 border-gray-800'
                  }`}
                >
                  <div className="text-xs font-mono text-amber-400 font-bold">nGOLD Token</div>
                  <div className="text-lg font-bold mt-1">₹7,420 INR / Gram</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">1 Token = 1g Physical Gold</div>
                </button>

                <button
                  onClick={() => setRwaAsset('nSILVER')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    rwaAsset === 'nSILVER' ? 'bg-slate-400/20 border-slate-300 shadow-lg shadow-slate-400/10' : 'bg-gray-900/60 border-gray-800'
                  }`}
                >
                  <div className="text-xs font-mono text-slate-300 font-bold">nSILVER Token</div>
                  <div className="text-lg font-bold mt-1">₹88.50 INR / Gram</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">1 Token = 1g Fine Silver</div>
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400">Enter Purchase Amount (₹ INR)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={rwaAmountInr}
                    onChange={(e) => setRwaAmountInr(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-nexus-dark border border-gray-700 text-base font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                  <div className="px-4 py-3 rounded-xl bg-nexus-dark border border-gray-800 font-mono text-xs text-amber-400 font-bold whitespace-nowrap">
                    = {(parseFloat(rwaAmountInr || '0') / (rwaAsset === 'nGOLD' ? 7420.0 : 88.5)).toFixed(4)} Grams
                  </div>
                </div>
              </div>

              {/* Payment Rail Selector */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400">Select Payment Rail</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setRwaPayMethod('upi')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                      rwaPayMethod === 'upi' ? 'bg-rail-emerald/20 border-rail-emerald text-rail-emerald' : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    <QrCode className="w-4 h-4" /> UPI Instant QR
                  </button>
                  <button
                    onClick={() => setRwaPayMethod('card')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                      rwaPayMethod === 'card' ? 'bg-stellar-cyan/20 border-stellar-cyan text-stellar-cyan' : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Stripe Test Card
                  </button>
                  <button
                    onClick={() => setRwaPayMethod('stellar')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                      rwaPayMethod === 'stellar' ? 'bg-cyber-purple/20 border-cyber-purple text-cyber-purple' : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    <Zap className="w-4 h-4" /> Stellar XLM
                  </button>
                </div>
              </div>

              <button
                onClick={handleRwaPurchase}
                disabled={isRwaProcessing}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-nexus-dark font-extrabold text-xs shadow-lg shadow-amber-500/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
              >
                {isRwaProcessing ? <Zap className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{isRwaProcessing ? 'Executing Payment & Minting Tokens...' : `Confirm Purchase of ${rwaAsset}`}</span>
              </button>

              {rwaReceipt && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-xs space-y-2 font-mono">
                  <div className="flex justify-between items-center text-amber-400 font-bold">
                    <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Purchase Confirmed & Tokens Issued!</span>
                    <span>{rwaReceipt.paymentMethod.toUpperCase()}</span>
                  </div>
                  <p className="text-gray-300">
                    Acquired <strong>{rwaReceipt.amountGrams} Grams</strong> of <strong>{rwaReceipt.asset}</strong> on Stellar Testnet.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Tx: {rwaReceipt.txHash}</span>
                    <a href={rwaReceipt.explorerUrl} target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-amber-300 flex items-center gap-1">
                      View on Stellar Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: OSTIUM PERPS */}
        {activeView === 'rwa_perps' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="p-6 rounded-3xl bg-nexus-card border border-gray-800 space-y-6 shadow-2xl">
              <div className="border-b border-gray-800 pb-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-cyber-purple" />
                  <span>Ostium Gold & Silver Perps Trading (2x - 5x Leverage)</span>
                </h1>
                <p className="text-xs text-gray-400 font-mono mt-1">Hedge your physical gold & silver token positions against market volatility</p>
              </div>

              {/* Pair & Leverage Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-gray-400 mb-1 block">Trading Pair</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPerpPair('XAU/USD')}
                      className={`p-2.5 rounded-xl border text-xs font-bold ${
                        perpPair === 'XAU/USD' ? 'bg-amber-500/20 border-amber-400 text-amber-400' : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}
                    >
                      XAU/USD (Gold)
                    </button>
                    <button
                      onClick={() => setPerpPair('XAG/USD')}
                      className={`p-2.5 rounded-xl border text-xs font-bold ${
                        perpPair === 'XAG/USD' ? 'bg-slate-400/20 border-slate-300 text-slate-300' : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}
                    >
                      XAG/USD (Silver)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-gray-400 mb-1 block">Leverage Multiplier ({perpLeverage}x)</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[2, 3, 4, 5].map((lev) => (
                      <button
                        key={lev}
                        onClick={() => setPerpLeverage(lev)}
                        className={`p-2 rounded-xl border text-xs font-bold ${
                          perpLeverage === lev ? 'bg-cyber-purple/20 border-cyber-purple text-cyber-purple' : 'bg-gray-900 border-gray-800 text-gray-400'
                        }`}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Position Inputs */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400">Position Size (USD $)</label>
                <input
                  type="number"
                  value={perpSize}
                  onChange={(e) => setPerpSize(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-nexus-dark border border-gray-700 text-sm font-mono text-white focus:outline-none focus:border-cyber-purple"
                />
              </div>

              <button
                onClick={handleOpenPerp}
                disabled={isPerpOpening}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyber-purple to-stellar-cyan text-nexus-dark font-extrabold text-xs shadow-lg shadow-cyber-purple/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
              >
                {isPerpOpening ? <Zap className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                <span>{isPerpOpening ? 'Executing Order...' : `Open Long ${perpPair} Position (${perpLeverage}x Leverage)`}</span>
              </button>

              {activePerpPosition && (
                <div className="p-4 rounded-2xl bg-cyber-purple/10 border border-cyber-purple/40 text-xs space-y-2 font-mono">
                  <div className="flex justify-between items-center text-cyber-purple font-bold">
                    <span>Position Active • Ostium Protocol</span>
                    <span className="px-2 py-0.5 rounded bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/20 text-[10px]">
                      {activePerpPosition.leverage}x LONG
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-300 text-[11px] pt-1">
                    <div>Entry Price: <strong>${activePerpPosition.entryPrice}</strong></div>
                    <div>Position Size: <strong>${activePerpPosition.sizeUsd}</strong></div>
                    <div>Margin Locked: <strong>${activePerpPosition.marginUsd}</strong></div>
                    <div>Liquidation: <strong>${activePerpPosition.liquidationPrice}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: STOREFRONT */}
        {activeView === 'storefront' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold">Enterprise Multi-Rail Storefront</h2>
              <p className="text-xs text-gray-400 font-mono">Select products and test Stripe, XRPL, Stellar, or nGOLD payment rails.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
              <div className="flex flex-col items-center">
                <div className="w-full text-xs font-mono text-rail-emerald uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Live Multi-Rail Checkout Selector
                </div>
                <MultiRailCheckoutSelector priceCents={49900} productTitle="XRPL Starter Validator Node Hardware Kit" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full text-xs font-mono text-stellar-cyan uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Live Mento Product Showdown & Community Voting
                </div>
                <ProductShowdownCard />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: BUYER DASHBOARD */}
        {activeView === 'buyer' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold">Buyer Account Overview</h2>
                <p className="text-xs text-gray-400 font-mono">Logged in as buyer@example.com</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button onClick={() => setActiveView('cart')} className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-rail-emerald text-left space-y-2">
                <ShoppingBag className="w-6 h-6 text-rail-emerald" />
                <h3 className="font-bold text-base">Shopping Cart</h3>
                <p className="text-xs text-gray-400">View items ({cartItems.reduce((a, b) => a + b.qty, 0)}) and proceed to Stripe test checkout.</p>
              </button>
              <button onClick={() => setActiveView('orders')} className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-stellar-cyan text-left space-y-2">
                <PackageCheck className="w-6 h-6 text-stellar-cyan" />
                <h3 className="font-bold text-base">Order History</h3>
                <p className="text-xs text-gray-400">Track order timeline (PENDING → PAID → FULFILLED).</p>
              </button>
              <button onClick={() => setActiveView('guide')} className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-cyber-purple text-left space-y-2">
                <Bot className="w-6 h-6 text-cyber-purple" />
                <h3 className="font-bold text-base">Catalog Guide</h3>
                <p className="text-xs text-gray-400">Chat with AI to discover recommended desk kits.</p>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 6: SHOPPING CART */}
        {activeView === 'cart' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-rail-emerald" />
                <span>Shopping Cart</span>
              </h2>
            </div>
            {cartItems.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-gray-900/60 border border-gray-800">
                <p className="text-gray-400 text-xs">Cart is empty.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.sku} className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800 flex justify-between items-center text-xs">
                      <div>
                        <h4 className="font-bold text-white text-sm">{item.title}</h4>
                        <span className="text-rail-emerald font-bold">${(item.priceCents / 100).toFixed(2)} USD</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-gray-700 rounded-lg bg-nexus-dark">
                          <button onClick={() => handleQtyChange(item.sku, -1)} className="px-2 py-1 text-gray-400 hover:text-white">-</button>
                          <span className="px-3 font-mono font-bold">{item.qty}</span>
                          <button onClick={() => handleQtyChange(item.sku, 1)} className="px-2 py-1 text-gray-400 hover:text-white">+</button>
                        </div>
                        <button onClick={() => handleRemoveCartItem(item.sku)} className="p-1 text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 space-y-4 h-fit text-xs font-mono">
                  <div className="flex justify-between text-sm font-bold text-white">
                    <span>Total Due</span>
                    <span className="text-rail-emerald">${(cartTotalCents / 100).toFixed(2)} USD</span>
                  </div>
                  <button onClick={() => setActiveView('storefront')} className="w-full py-3 rounded-xl bg-gradient-to-r from-rail-emerald to-stellar-cyan text-nexus-dark font-bold text-xs">
                    Checkout with Stripe Test Mode
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 7: ORDERS */}
        {activeView === 'orders' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <PackageCheck className="w-6 h-6 text-stellar-cyan" />
                <span>My Order History</span>
              </h2>
            </div>
            <div className="space-y-3">
              {orders.map((ord) => (
                <div key={ord.id} className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white text-sm">{ord.orderNumber}</span>
                    <span className="text-gray-400 font-mono ml-3">{new Date(ord.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/30 font-bold">
                      {ord.status}
                    </span>
                    <span className="font-bold text-white">${(ord.totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 8: AI GUIDE */}
        {activeView === 'guide' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="border-b border-gray-800 pb-3">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Bot className="w-6 h-6 text-cyber-purple" />
                <span>Read-Only AI Catalog Guide</span>
              </h2>
            </div>
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-3 min-h-[350px]">
              {guideMessages.map((m, idx) => (
                <div key={idx} className={`p-3 rounded-xl max-w-lg text-xs space-y-1 ${m.role === 'user' ? 'ml-auto bg-cyber-purple/20 text-white border border-cyber-purple/30' : 'mr-auto bg-nexus-dark text-gray-200 border border-gray-800'}`}>
                  <p className="text-sm">{m.body}</p>
                  {m.suggestedSkus && m.suggestedSkus.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      {m.suggestedSkus.map((sku) => (
                        <button key={sku} onClick={() => handleAddToCart(sku)} className="px-2.5 py-1 rounded bg-gray-800 text-[11px] font-bold text-rail-emerald hover:bg-gray-700">
                          + Add {sku} to Cart
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={guideInput}
                onChange={(e) => setGuideInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendGuideMsg()}
                placeholder="Ask catalog guide..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-nexus-dark border border-gray-800 text-xs text-white"
              />
              <button onClick={handleSendGuideMsg} className="px-4 py-2.5 rounded-xl bg-cyber-purple text-nexus-dark font-bold text-xs">
                Send
              </button>
            </div>
          </div>
        )}

        {/* VIEW 9: ADMIN */}
        {activeView === 'admin' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold">Operator Admin Dashboard</h2>
                <p className="text-xs text-gray-400 font-mono">Restricted Operator Controls</p>
              </div>
              <button onClick={() => setActiveView('admin_orders')} className="px-3.5 py-2 rounded-xl bg-rail-emerald/20 text-rail-emerald border border-rail-emerald/50 text-xs font-bold">
                Order Fulfillment Manager
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
                <span className="text-gray-400">Total Volume USD</span>
                <div className="text-2xl font-bold text-rail-emerald mt-1">$66.00</div>
              </div>
              <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
                <span className="text-gray-400">Total Orders</span>
                <div className="text-2xl font-bold text-white mt-1">{orders.length} Orders</div>
              </div>
              <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
                <span className="text-gray-400">Active SKUs</span>
                <div className="text-2xl font-bold text-stellar-cyan mt-1">3 SKUs</div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 10: ADMIN ORDERS */}
        {activeView === 'admin_orders' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-bold">Admin Order Fulfillment Manager</h2>
            </div>
            <div className="space-y-3">
              {orders.map((ord) => (
                <div key={ord.id} className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white text-sm">{ord.orderNumber}</span>
                    <span className="text-gray-400 font-mono ml-3">{ord.buyerEmail}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full bg-stellar-cyan/10 text-stellar-cyan border border-stellar-cyan/30 font-bold">
                      {ord.status}
                    </span>
                    {ord.status === 'PAID' && (
                      <button onClick={() => handleAdminStatusTransition(ord.id, 'FULFILLING')} className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                        Start Fulfilling
                      </button>
                    )}
                    {ord.status === 'FULFILLING' && (
                      <button onClick={() => handleAdminStatusTransition(ord.id, 'FULFILLED')} className="px-3 py-1.5 rounded-lg bg-rail-emerald/20 text-rail-emerald font-bold border border-rail-emerald/40">
                        Mark Fulfilled
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 11: ANALYTICS */}
        {activeView === 'analytics' && <AnalyticsLedgerDashboard />}

        {/* VIEW 12: PLUGINS */}
        {activeView === 'plugins' && <PluginsShowcase />}
      </div>

      {/* Floating AI Launcher Button */}
      <button
        onClick={() => setIsAgentOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-2xl bg-gradient-to-br from-rail-emerald via-stellar-cyan to-cyber-purple text-nexus-dark font-bold text-xs shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform z-40"
      >
        <Sparkles className="w-5 h-5" />
        <span>Ask AI Agent Desk</span>
      </button>

      {/* Slide-over Agent Chat Panel */}
      <AgentDeskPanel isOpen={isAgentOpen} onClose={() => setIsAgentOpen(false)} />

      {/* Footer */}
      <footer className="w-full max-w-6xl border-t border-gray-800/60 pt-6 mt-12 text-center text-xs text-gray-500 z-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>NexusRail Monorepo • Full Flagship Super-Platform Architecture</div>
        <div className="font-mono text-[11px] text-gray-400">
          Deployed on Vercel & Render • 100% Free Tier Stack
        </div>
      </footer>
    </main>
  );
}
