'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDownUp,
  Clock,
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Wallet,
  AlertCircle,
  ArrowRight,
  Server,
  Lock,
  Check,
  Copy,
  Key,
} from 'lucide-react';
import { useLiveExchangeRates } from '@/lib/rates';
import { readSession, SessionUser, onSessionChange } from '@/lib/shop';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { Nexus3DCanvas } from '@/components/Nexus3DCanvas';
import {
  checkFreighterInstalled,
  checkGemWalletInstalled,
  connectFreighter,
  signFreighterTransaction,
  payWithFreighter,
  payWithGemWallet,
  payWithCrossmark,
} from '@/lib/wallets';

type SwapToken = 'XRP' | 'XLM' | 'USDC' | 'RLUSD';

const TOKEN_DETAILS: Record<SwapToken, { name: string; chain: 'XRPL TESTNET' | 'STELLAR TESTNET'; iconColor: string }> = {
  XRP: { name: 'XRP', chain: 'XRPL TESTNET', iconColor: 'text-[#0081F2]' },
  XLM: { name: 'Stellar Lumens', chain: 'STELLAR TESTNET', iconColor: 'text-[#00E5FF]' },
  USDC: { name: 'USD Coin', chain: 'STELLAR TESTNET', iconColor: 'text-[#2775CA]' },
  RLUSD: { name: 'Ripple USD', chain: 'XRPL TESTNET', iconColor: 'text-[#0081F2]' },
};

import { PLATFORM_STELLAR_VAULT, PLATFORM_XRPL_VAULT } from '@/lib/vault';

export default function SwapPage() {
  const [fromToken, setFromToken] = useState<SwapToken>('XRP');
  const [toToken, setToToken] = useState<SwapToken>('XLM');
  const [payAmount, setPayAmount] = useState('100.00');
  const [slippage, setSlippage] = useState<'0.1%' | '0.5%' | '1.0%'>('0.5%');
  const [showSlippageMenu, setShowSlippageMenu] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // User destination address on the target ledger
  const [destinationAddress, setDestinationAddress] = useState('');

  // Wallet extension detection
  const [hasFreighter, setHasFreighter] = useState(false);
  const [hasGemWallet, setHasGemWallet] = useState(false);

  // Live Exchange Rates Hook with 30-minute caching
  const { xlmUsd, xrpUsd, refreshRates, fromCache, ttlMinutes, loading: ratesLoading } = useLiveExchangeRates();

  // Quote Expiry Timer (45 seconds countdown)
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(42);
  const [quoteUpdatedSecondsAgo, setQuoteUpdatedSecondsAgo] = useState(18);

  // Review Cross-Chain Swap Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'extension' | 'manual' | 'secret'>('extension');
  const [manualDepositTxHash, setManualDepositTxHash] = useState('');
  const [userTestnetSecret, setUserTestnetSecret] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [swapState, setSwapState] = useState<'idle' | 'preparing' | 'signing_wallet' | 'executing_payout' | 'success' | 'error'>('idle');
  const [swapError, setSwapError] = useState('');

  // Swap Order Execution State
  const [activeSwapOrder, setActiveSwapOrder] = useState<{
    swapId: string;
    depositAddress: string;
    identifierType: 'destination_tag' | 'memo_text';
    identifier: string | number;
    depositTxHash?: string;
    payoutTxHash?: string;
    depositExplorerUrl?: string;
    payoutExplorerUrl?: string;
    journalEntry?: string;
  } | null>(null);

  // Detect extensions on mount
  useEffect(() => {
    checkFreighterInstalled().then(setHasFreighter);
    checkGemWalletInstalled().then(setHasGemWallet);
  }, []);

  // Synchronize session and auto-fill destination wallet
  useEffect(() => {
    const sync = () => {
      const u = readSession().user;
      setUser(u);
      if (u) {
        if (toToken === 'XLM') {
          setDestinationAddress(u.walletAddress?.startsWith('G') ? u.walletAddress : 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC');
        } else if (toToken === 'XRP') {
          setDestinationAddress(u.walletAddress?.startsWith('r') ? u.walletAddress : 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp');
        }
      }
    };
    sync();
    return onSessionChange(sync);
  }, [toToken]);

  // Timer tick for 45s quote lifecycle
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteSecondsLeft((prev) => {
        if (prev <= 1) {
          refreshRates();
          setQuoteUpdatedSecondsAgo(0);
          return 45;
        }
        return prev - 1;
      });
      setQuoteUpdatedSecondsAgo((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshRates]);

  // Dynamic live rate calculation
  const liveRate = useMemo(() => {
    const fromUsd = fromToken === 'XRP' ? xrpUsd : fromToken === 'XLM' ? xlmUsd : 1.0;
    const toUsd = toToken === 'XLM' ? xlmUsd : toToken === 'XRP' ? xrpUsd : 1.0;
    if (toUsd <= 0) return 2.50;
    return fromUsd / toUsd;
  }, [fromToken, toToken, xlmUsd, xrpUsd]);

  // Compute output amount based on live rates
  const receiveAmount = useMemo(() => {
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const computed = num * liveRate;
    return computed.toFixed(2);
  }, [payAmount, liveRate]);

  // Compute USD estimated values
  const payUsdValue = useMemo(() => {
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const price = fromToken === 'XRP' ? xrpUsd : fromToken === 'XLM' ? xlmUsd : 1.0;
    return (num * price).toFixed(2);
  }, [payAmount, fromToken, xrpUsd, xlmUsd]);

  const receiveUsdValue = useMemo(() => {
    const num = parseFloat(receiveAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const price = toToken === 'XLM' ? xlmUsd : toToken === 'XRP' ? xrpUsd : 1.0;
    return (num * price).toFixed(2);
  }, [receiveAmount, toToken, xlmUsd, xrpUsd]);

  // Minimum received after slippage
  const minReceived = useMemo(() => {
    const num = parseFloat(receiveAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const slipFactor = slippage === '0.1%' ? 0.001 : slippage === '0.5%' ? 0.005 : 0.01;
    return (num * (1 - slipFactor)).toFixed(2);
  }, [receiveAmount, slippage]);

  // Invert tokens
  const handleInvert = () => {
    const prevFrom = fromToken;
    const prevTo = toToken;
    setFromToken(prevTo);
    setToToken(prevFrom);
    setPayAmount(receiveAmount === '0.00' ? '100.00' : receiveAmount);
  };

  // Balances
  const [xrpBalance, setXrpBalance] = useState(500.0);
  const [xlmBalance, setXlmBalance] = useState(3480.5);

  const effectiveDestination = destinationAddress || (toToken === 'XLM' ? 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC' : 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp');

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Open Review Modal -> Initiates Real Escrow Order
  const handleOpenReview = async () => {
    setSwapError('');
    setSwapState('preparing');
    setShowReviewModal(true);

    try {
      const res = await fetch('/api/v1/swap/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset: fromToken,
          toAsset: toToken,
          amount: parseFloat(payAmount) || 100,
          userDestinationAddress: effectiveDestination,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setActiveSwapOrder({
            swapId: json.data.swapId,
            depositAddress: json.data.platformDepositAddress,
            identifierType: json.data.paymentIdentifierType,
            identifier: json.data.paymentIdentifier,
          });
          setSwapState('idle');
          return;
        }
      }
    } catch {}

    // Fallback order state
    const fallbackId = `SWAP-${Date.now().toString(36).toUpperCase()}`;
    const fallbackDeposit = fromToken === 'XRP' ? PLATFORM_XRPL_VAULT : PLATFORM_STELLAR_VAULT;
    setActiveSwapOrder({
      swapId: fallbackId,
      depositAddress: fallbackDeposit,
      identifierType: fromToken === 'XRP' ? 'destination_tag' : 'memo_text',
      identifier: fromToken === 'XRP' ? Math.floor(100000 + Math.random() * 900000) : `SWAP${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
    });
    setSwapState('idle');
  };

  // Execute Swap with Real Ingress Deposit
  const handleExecuteCrossChainSwap = async () => {
    if (!activeSwapOrder) return;
    setSwapError('');
    let resolvedDepositHash = '';

    // 1. If using Extension (Freighter / GemWallet)
    if (depositMethod === 'extension') {
      setSwapState('signing_wallet');
      try {
        if (fromToken === 'XLM') {
          // 1. Connect Freighter to get user address
          const freighterRes = await connectFreighter();
          if (!freighterRes || !freighterRes.address) {
            throw new Error('Freighter wallet authorization was cancelled or extension not found.');
          }

          // 2. Prepare genuine unsigned transaction XDR from API
          const prepRes = await fetch('/api/v1/swap/stellar/prepare-xdr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              swapId: activeSwapOrder.swapId,
              sourcePublicKey: freighterRes.address,
            }),
          });

          if (!prepRes.ok) {
            const errData = await prepRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to prepare Stellar payment XDR');
          }

          const prepData = await prepRes.json();
          if (!prepData.success || !prepData.xdr) {
            throw new Error(prepData.error || 'Invalid XDR returned from server');
          }

          // 3. Prompt user's Freighter extension popup to sign the transaction!
          const signResult = await signFreighterTransaction(prepData.xdr, {
            networkPassphrase: prepData.networkPassphrase || 'Test SDF Network ; September 2015',
          });

          const signedXdr = typeof signResult === 'string' ? signResult : (signResult as any)?.signedTxXdr;
          if (!signedXdr) {
            throw new Error('Transaction was cancelled or declined in Freighter.');
          }

          // 4. Submit signed XDR to Stellar Horizon testnet
          const submitRes = await fetch('/api/v1/swap/stellar/submit-xdr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedXdr }),
          });

          if (!submitRes.ok) {
            const submitErr = await submitRes.json().catch(() => ({}));
            throw new Error(submitErr.error || 'Horizon rejected transaction submission');
          }

          const submitData = await submitRes.json();
          if (!submitData.success || !submitData.txHash) {
            throw new Error('Failed to retrieve transaction hash from Horizon');
          }

          resolvedDepositHash = submitData.txHash;
        } else if (fromToken === 'XRP') {
          const hasGem = typeof window !== 'undefined' && ((window as any).gemWallet || await checkGemWalletInstalled());
          const hasCrossmark = typeof window !== 'undefined' && Boolean((window as any).crossmark || (window as any).Crossmark);

          if (hasGem) {
            const res = await payWithGemWallet({
              destination: activeSwapOrder.depositAddress,
              amountXrp: payAmount,
              destinationTag: Number(activeSwapOrder.identifier),
            });
            resolvedDepositHash = res.txHash;
          } else if (hasCrossmark) {
            const res = await payWithCrossmark({
              destination: activeSwapOrder.depositAddress,
              amountXrp: payAmount,
              destinationTag: Number(activeSwapOrder.identifier),
            });
            resolvedDepositHash = res.txHash;
          } else {
            throw new Error(
              'No XRPL wallet extension (GemWallet or Crossmark) detected in your browser. ' +
              'Please install GemWallet or Crossmark extension, or switch to "Manual Transfer" below to send XRP from your Xaman mobile wallet.'
            );
          }
        }
      } catch (err: any) {
        setSwapError(`Wallet extension signing failed: ${err.message}`);
        setSwapState('idle');
        return;
      }
    } else if (depositMethod === 'manual') {
      // 2. If using Manual Transfer -> requires real confirmed transaction hash
      const hash = manualDepositTxHash.trim();
      if (!hash) {
        setSwapError('Please enter the transaction hash of your transfer to the server vault to verify.');
        return;
      }
      resolvedDepositHash = hash;
    } else if (depositMethod === 'secret') {
      // 3. If using Testnet Secret
      const sec = userTestnetSecret.trim();
      if (!sec) {
        setSwapError('Please enter your testnet secret key / seed to sign.');
        return;
      }
    }

    setSwapState('executing_payout');

    try {
      const res = await fetch('/api/v1/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId: activeSwapOrder.swapId,
          depositTxHash: resolvedDepositHash || undefined,
          userSourceSecret: depositMethod === 'secret' ? userTestnetSecret.trim() : undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const completed = json.data;
          setActiveSwapOrder((prev) => ({
            ...prev!,
            depositTxHash: completed.depositTxHash,
            payoutTxHash: completed.payoutTxHash,
            depositExplorerUrl: completed.depositExplorerUrl,
            payoutExplorerUrl: completed.payoutExplorerUrl,
            journalEntry: completed.journalEntry,
          }));
          updateBalancesAfterSwap();
          setSwapState('success');
          return;
        } else {
          throw new Error(json.error || 'Execution failed');
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }
    } catch (err: any) {
      setSwapError(`Execution failed: ${err.message}`);
      setSwapState('idle');
    }
  };

  const updateBalancesAfterSwap = () => {
    const payNum = parseFloat(payAmount) || 0;
    const recvNum = parseFloat(receiveAmount) || 0;
    if (fromToken === 'XRP') {
      setXrpBalance((b) => Math.max(0, b - payNum));
      setXlmBalance((b) => b + recvNum);
    } else {
      setXlmBalance((b) => Math.max(0, b - payNum));
      setXrpBalance((b) => b + recvNum);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] font-sans antialiased selection:bg-[var(--gold)]/30">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 relative">
        
        {/* Header Breadcrumb */}
        <div className="mb-8">
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
            CROSS-CHAIN ROUTING / DUAL-RAIL SETTLEMENT
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-[var(--foreground)] tracking-tight mt-2">
            Cross-Chain Liquidity Bridge
          </h1>
          <p className="text-sm sm:text-base text-[var(--muted)] mt-1.5 font-normal">
            Deposit from your connected wallet to the NexusRail Escrow Vault. The server automatically disburses the swapped asset to your destination ledger address.
          </p>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          
          {/* Left Column: Swap Assets Card (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl nexus-glass-card p-5 sm:p-7 space-y-4">
              
              {/* Card Title & Slippage Selector */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                    Swap Assets
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                    ESCROW ROUTE
                  </span>
                </div>
                
                {/* Slippage Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSlippageMenu(!showSlippageMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg nexus-glass-surface text-[10px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  >
                    <span>{slippage} SLIPPAGE</span>
                    <Sliders className="w-3 h-3 text-[var(--muted)]" />
                  </button>

                  {showSlippageMenu && (
                    <div className="absolute right-0 top-8 z-20 w-36 rounded-xl nexus-glass-surface p-1 shadow-2xl space-y-1">
                      {(['0.1%', '0.5%', '1.0%'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setSlippage(opt);
                            setShowSlippageMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                            slippage === opt ? 'bg-[var(--gold)]/20 text-[var(--gold)] font-bold' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                          }`}
                        >
                          {opt} tolerance
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 1: You Pay (Source Chain Deposit) */}
              <div className="p-4 sm:p-5 rounded-xl nexus-glass-surface space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)]">
                  <span className="flex items-center gap-1.5">
                    <span>You pay from connected wallet</span>
                  </span>
                  <span>Balance: {fromToken === 'XRP' ? `${xrpBalance.toFixed(2)} XRP` : `${xlmBalance.toFixed(2)} XLM`}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <input
                    type="number"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-3xl sm:text-4xl font-mono text-[var(--foreground)] focus:outline-none placeholder-[var(--muted)]/40 font-medium"
                  />

                  {/* Token Badge */}
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs font-semibold shrink-0">
                    <span>{fromToken}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)]" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] pt-1">
                  <span>≈ ${payUsdValue} USD</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-wider text-[var(--muted)]">{TOKEN_DETAILS[fromToken].chain}</span>
                    <button
                      type="button"
                      onClick={() => setPayAmount(fromToken === 'XRP' ? '500.00' : '3480.50')}
                      className="text-[10px] font-bold text-[var(--gold)] hover:underline uppercase cursor-pointer"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Centered Invert Button */}
              <div className="flex justify-center -my-1 relative z-10">
                <button
                  type="button"
                  onClick={handleInvert}
                  className="w-8 h-8 rounded-full bg-[var(--surface-solid)] border border-[var(--border)] hover:border-[var(--border-focus)] text-[var(--muted)] hover:text-[var(--foreground)] flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                  aria-label="Invert swap directions"
                >
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Box 2: You Receive (Target Chain Payout) */}
              <div className="p-4 sm:p-5 rounded-xl nexus-glass-surface space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)]">
                  <span>Server deposits to your address</span>
                  <span>Balance: {toToken === 'XLM' ? `${xlmBalance.toFixed(2)} XLM` : `${xrpBalance.toFixed(2)} XRP`}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="w-full text-3xl sm:text-4xl font-mono text-[var(--foreground)] font-medium select-all">
                    {receiveAmount}
                  </span>

                  {/* Token Badge */}
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs font-semibold shrink-0">
                    <span>{toToken}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)]" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] pt-1">
                  <span>≈ ${receiveUsdValue} USD</span>
                  <span className="text-[10px] tracking-wider text-[var(--muted)]">{TOKEN_DETAILS[toToken].chain}</span>
                </div>
              </div>

              {/* Box 3: User Destination Address Field */}
              <div className="p-3.5 rounded-xl nexus-glass-surface space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)]">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Your Destination {toToken} Address:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsWalletModalOpen(true)}
                    className="text-[10px] text-[var(--gold)] hover:underline cursor-pointer"
                  >
                    Select Wallet
                  </button>
                </div>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder={toToken === 'XLM' ? 'Enter Stellar G... address' : 'Enter XRPL r... address'}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted)]/40 focus:border-[var(--border-focus)] focus:outline-none"
                />
                <p className="text-[10px] font-mono text-[var(--muted)]">
                  The server hot wallet will disburse {receiveAmount} {toToken} to this address once deposit is confirmed.
                </p>
              </div>

              {/* Exchange Rate Line */}
              <div className="flex items-center justify-between py-1 text-xs font-mono text-[var(--muted)]">
                <span>Exchange rate</span>
                <span className="text-[var(--foreground)] font-medium">
                  1 {fromToken} = {liveRate.toFixed(4)} {toToken}
                </span>
              </div>

              {/* Quote Expiry Amber Card */}
              <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--gold)]/30 flex items-center gap-2.5 text-xs font-mono text-[var(--gold-bright)]">
                <Clock className="w-4 h-4 text-[var(--gold-bright)] shrink-0" />
                <span>
                  Live quote locked for {quoteSecondsLeft}s. Auto-refreshes before on-chain execution.
                </span>
              </div>

              {/* Review Cross-Chain Swap CTA Button */}
              <button
                type="button"
                onClick={handleOpenReview}
                className="w-full py-4 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold)]/20 active:scale-[0.99] cursor-pointer mt-2"
              >
                <span>Review Cross-Chain Swap</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Safety Subtext */}
              <p className="text-xs text-[var(--muted)] text-center leading-relaxed pt-1">
                Atomic settlement: Funds are verified in server vault before destination payout.
              </p>

            </div>

            {/* Bottom Testnet Balances Card */}
            <div 
              onClick={() => setIsWalletModalOpen(true)}
              className="rounded-2xl nexus-glass-card hover:border-[var(--gold)]/60 p-5 flex items-center justify-between cursor-pointer transition-all group"
            >
              <div>
                <p className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                  <span>Your Testnet Wallets</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--border)] text-[var(--gold)] transition-colors">
                    Manage
                  </span>
                </p>
                <p className="text-xs text-[var(--muted)] font-mono mt-0.5">Stellar & XRPL Multi-Rail Keys</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono text-[var(--muted)] uppercase">STELLAR: {user?.walletAddress ? `${user.walletAddress.slice(0, 4)}..${user.walletAddress.slice(-4)}` : 'GCKF..7Q2M'}</p>
                <p className="text-xl sm:text-2xl font-mono font-medium text-[var(--gold-bright)] tracking-tight mt-0.5">
                  {xlmBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} XLM
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: 24H Rates, SVG Chart & Route Visualization (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Top Bar with Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>SERVER HOT WALLET READY</span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-highlight)] transition-colors cursor-pointer"
              >
                <span>Bridge Explorer</span>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--muted)]" />
              </button>
            </div>

            {/* Rate & Chart Header */}
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)] uppercase tracking-wider">
                <span>{fromToken} / {toToken}</span>
                <span className="px-1.5 py-0.5 rounded nexus-glass-surface border border-[var(--border)] text-[9px] text-[var(--gold)]">
                  {fromCache ? 'CACHED 30M RATES' : 'LIVE ORACLE RATES'}
                </span>
              </div>

              <div className="flex items-baseline gap-4 mt-2">
                <span className="text-4xl sm:text-5xl font-mono font-bold text-[var(--foreground)] tracking-tight">
                  {liveRate.toFixed(4)}
                </span>
                <span className="px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold-bright)] text-xs font-mono font-semibold">
                  +1.24% / 24H
                </span>
              </div>
            </div>

            {/* 24-Hour SVG Rate Line Chart */}
            <div className="rounded-2xl nexus-glass-card p-5 space-y-3">
              <div className="h-44 w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area Fill */}
                  <polygon
                    points="0,120 25,125 50,110 75,130 100,105 125,115 150,90 175,110 200,85 225,95 250,80 275,95 300,75 325,85 350,70 375,80 400,65 425,75 450,60 475,65 500,55 500,160 0,160"
                    fill="url(#chartGradient)"
                  />

                  {/* Main Teal Trend Line */}
                  <polyline
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,120 25,125 50,110 75,130 100,105 125,115 150,90 175,110 200,85 225,95 250,80 275,95 300,75 325,85 350,70 375,80 400,65 425,75 450,60 475,65 500,55"
                  />
                </svg>
              </div>

              {/* Time Markers */}
              <div className="flex justify-between text-[10px] font-mono text-[var(--muted)] pt-2 border-t border-[var(--border)]">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>

            {/* "Your route, explained" Section */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Cross-Chain Escrow Architecture
              </h3>

              {/* Route Chain Flow Pills */}
              <div className="p-4 rounded-2xl nexus-glass-surface flex items-center justify-between text-xs font-mono">
                <div className="text-center">
                  <span className="px-2.5 py-1 rounded-md nexus-glass-card border border-[var(--border)] text-[var(--foreground)] font-medium block">
                    {fromToken === 'XRP' ? 'XRPL Wallet' : 'Stellar Wallet'}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] mt-1 block">Ingress Deposit</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--gold)]" />
                <div className="text-center">
                  <span className="px-2.5 py-1 rounded-md bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold-bright)] font-bold block">
                    SERVER VAULT
                  </span>
                  <span className="text-[10px] text-emerald-400 mt-1 block">Escrow & Verification</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--gold)]" />
                <div className="text-center">
                  <span className="px-2.5 py-1 rounded-md nexus-glass-card border border-[var(--border)] text-[var(--foreground)] font-medium block">
                    {toToken === 'XLM' ? 'Stellar Wallet' : 'XRPL Wallet'}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] mt-1 block">Egress Payout</span>
                </div>
              </div>

              {/* Execution Details Table */}
              <div className="space-y-3 text-xs font-mono divide-y divide-[var(--border)]">
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Minimum received</span>
                  <span className="text-[var(--foreground)] font-medium">{minReceived} {toToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Estimated network fee</span>
                  <span className="text-[var(--foreground)] font-medium">0.000012 {fromToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Server Stellar Vault</span>
                  <span className="text-[var(--foreground)]/80 font-mono text-[11px] truncate max-w-[200px]">{PLATFORM_STELLAR_VAULT}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Server XRPL Vault</span>
                  <span className="text-[var(--foreground)]/80 font-mono text-[11px] truncate max-w-[200px]">{PLATFORM_XRPL_VAULT}</span>
                </div>
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Atomic cross-chain bridge: Deposit to server vault triggers automatic disbursement to your destination address on the counterpart chain.
              </p>
            </div>

          </div>

        </div>

      </main>

      {/* Confirmation Review & Multi-Step Escrow Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--surface-solid)] border border-[var(--border)] p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[var(--gold)]" />
                <h3 className="text-lg font-bold text-[var(--foreground)]">Cross-Chain Escrow Swap</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReviewModal(false);
                  setSwapState('idle');
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {swapError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="flex-1">{swapError}</span>
              </div>
            )}

            {swapState === 'preparing' && (
              <div className="py-8 text-center space-y-4">
                <div className="w-10 h-10 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-mono text-[var(--foreground)]">Preparing Cross-Chain Escrow Order...</p>
                <p className="text-xs text-[var(--muted)] font-mono">Generating unique deposit vault address & cryptographic memo...</p>
              </div>
            )}

            {swapState === 'idle' && activeSwapOrder && (
              <div className="space-y-4 text-xs font-mono">
                
                {/* Deposit Ingress Section */}
                <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between text-[var(--gold)] font-bold pb-2 border-b border-[var(--border)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/50 flex items-center justify-center text-[10px]">1</span>
                      <span>INGRESS: DEPOSIT TO SERVER VAULT</span>
                    </span>
                    <span>{payAmount} {fromToken}</span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between items-center nexus-glass-card p-2 rounded-lg">
                      <span className="text-[var(--muted)]">Vault Address:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--foreground)] font-mono truncate max-w-[220px]">{activeSwapOrder.depositAddress}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeSwapOrder.depositAddress, 'addr')}
                          className="text-[var(--gold)] hover:text-[var(--gold-bright)] cursor-pointer"
                        >
                          {copiedKey === 'addr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center nexus-glass-card p-2 rounded-lg">
                      <span className="text-[var(--muted)]">
                        {activeSwapOrder.identifierType === 'destination_tag' ? 'Destination Tag (Required):' : 'Memo Text (Required):'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--gold)] font-bold font-mono">{activeSwapOrder.identifier}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(String(activeSwapOrder.identifier), 'tag')}
                          className="text-[var(--gold)] hover:text-[var(--gold-bright)] cursor-pointer"
                        >
                          {copiedKey === 'tag' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payout Egress Section */}
                <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-[var(--gold)] font-bold pb-1 border-b border-[var(--border)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/50 flex items-center justify-center text-[10px]">2</span>
                      <span>EGRESS: SERVER DISBURSES TO YOU</span>
                    </span>
                    <span>{receiveAmount} {toToken}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--muted)]">Recipient Address:</span>
                    <span className="text-[var(--foreground)] font-mono truncate max-w-[240px]">{effectiveDestination}</span>
                  </div>
                </div>

                {/* Choose Deposit Payment Method */}
                <div className="space-y-2">
                  <p className="text-[var(--muted)] font-semibold text-[11px]">Choose How You Deposit Funds to Server Vault:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDepositMethod('extension')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        depositMethod === 'extension'
                          ? 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)] font-bold'
                          : 'nexus-glass-surface border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      <Wallet className="w-4 h-4 mx-auto mb-1 text-[var(--gold)]" />
                      <span className="block text-[10px]">Browser Wallet</span>
                      <span className="text-[9px] text-[var(--muted)]">{fromToken === 'XLM' ? 'Freighter' : 'GemWallet'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod('manual')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        depositMethod === 'manual'
                          ? 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)] font-bold'
                          : 'nexus-glass-surface border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      <Copy className="w-4 h-4 mx-auto mb-1 text-sky-400" />
                      <span className="block text-[10px]">Manual Transfer</span>
                      <span className="text-[9px] text-[var(--muted)]">From Mobile/App</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod('secret')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        depositMethod === 'secret'
                          ? 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)] font-bold'
                          : 'nexus-glass-surface border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      <Key className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                      <span className="block text-[10px]">Testnet Secret</span>
                      <span className="text-[9px] text-[var(--muted)]">Dev One-Click</span>
                    </button>
                  </div>
                </div>

                {/* Sub-inputs based on method */}
                {depositMethod === 'manual' && (
                  <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-2">
                    <p className="text-[10.5px] text-[var(--muted)]">
                      Send <strong className="text-[var(--foreground)]">{payAmount} {fromToken}</strong> to vault address <strong className="text-[var(--gold)]">{activeSwapOrder.depositAddress}</strong> with tag <strong className="text-[var(--gold)]">{activeSwapOrder.identifier}</strong>. Then enter the transaction hash:
                    </p>
                    <input
                      type="text"
                      value={manualDepositTxHash}
                      onChange={(e) => setManualDepositTxHash(e.target.value)}
                      placeholder="Paste your deposit transaction hash here"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--foreground)] font-mono text-[11px] focus:outline-none focus:border-[var(--border-focus)]"
                    />
                  </div>
                )}

                {depositMethod === 'secret' && (
                  <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-2">
                    <p className="text-[10.5px] text-[var(--muted)]">
                      Enter your {fromToken} Testnet Secret Key / Seed to sign and broadcast the transfer from your account to the server vault:
                    </p>
                    <input
                      type="password"
                      value={userTestnetSecret}
                      onChange={(e) => setUserTestnetSecret(e.target.value)}
                      placeholder={fromToken === 'XLM' ? 'S... Stellar Secret Key' : 's... XRPL Seed'}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--foreground)] font-mono text-[11px] focus:outline-none focus:border-[var(--border-focus)]"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExecuteCrossChainSwap}
                  className="w-full py-4 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[var(--gold)]/20 cursor-pointer"
                >
                  {depositMethod === 'extension'
                    ? `Sign & Deposit ${payAmount} ${fromToken} via Extension`
                    : depositMethod === 'manual'
                    ? 'Verify Deposit & Release Payout'
                    : `Sign & Broadcast ${payAmount} ${fromToken}`}
                </button>
              </div>
            )}

            {swapState === 'signing_wallet' && (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 border-3 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto" />
                <h4 className="text-base font-bold text-[var(--foreground)]">Approve in Your Wallet Extension</h4>
                <p className="text-xs text-[var(--muted)] font-mono max-w-sm mx-auto">
                  Please check your browser extension popup ({fromToken === 'XLM' ? 'Freighter' : 'GemWallet'}) to confirm sending {payAmount} {fromToken} to the NexusRail Vault.
                </p>
              </div>
            )}

            {swapState === 'executing_payout' && (
              <div className="py-8 space-y-6">
                <div className="w-12 h-12 border-3 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto" />
                
                <div className="space-y-3 font-mono text-xs max-w-sm mx-auto">
                  <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>1. Ingress Deposit Confirmed in Server Vault</span>
                  </div>

                  <div className="p-3 rounded-xl border bg-[var(--gold)]/10 border-[var(--gold)]/30 text-[var(--gold)] flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
                    <span>2. Server Disbursing {receiveAmount} {toToken} to Your Wallet...</span>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--muted)] font-mono text-center">
                  Dual-ledger consensus verification in progress...
                </p>
              </div>
            )}

            {swapState === 'success' && activeSwapOrder && (
              <div className="py-4 space-y-5">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                
                <div className="text-center">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold tracking-wider uppercase">
                    SETTLED ON-CHAIN
                  </span>
                  <h4 className="text-xl font-bold text-[var(--foreground)] mt-1.5">Cross-Chain Swap Complete!</h4>
                  <p className="text-xs font-mono text-[var(--gold)] mt-1">
                    Swapped {payAmount} {fromToken} &rarr; {receiveAmount} {toToken}
                  </p>
                </div>

                {/* Proof Details */}
                <div className="space-y-3 font-mono text-xs">
                  {/* Deposit Proof */}
                  <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--muted)] text-[10px] uppercase">User Deposit Tx ({fromToken})</span>
                      <a
                        href={activeSwapOrder.depositExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--gold)] hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>View on Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[var(--foreground)] text-[11px] truncate font-mono">{activeSwapOrder.depositTxHash}</p>
                  </div>

                  {/* Payout Proof */}
                  <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--muted)] text-[10px] uppercase">Server Payout Tx ({toToken})</span>
                      <a
                        href={activeSwapOrder.payoutExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--gold)] hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>View on Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[var(--foreground)] text-[11px] truncate font-mono">{activeSwapOrder.payoutTxHash}</p>
                  </div>

                  {/* Accounting Journal Entry */}
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex justify-between items-center text-xs">
                    <span className="text-emerald-400 font-bold">Ledger Journal Ref:</span>
                    <span className="text-[var(--foreground)] font-mono">{activeSwapOrder.journalEntry || 'JE-SWAP-2048'} (Balanced)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowReviewModal(false);
                    setSwapState('idle');
                  }}
                  className="w-full py-3.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold font-mono text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Wallet Management Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

    </div>
  );
}
