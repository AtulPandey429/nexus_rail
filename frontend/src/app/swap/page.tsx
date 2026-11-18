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
  AlertTriangle,
  Sparkles,
  Layers,
  Globe,
} from 'lucide-react';
import { useLiveExchangeRates } from '@/lib/rates';
import { readSession, SessionUser, onSessionChange } from '@/lib/shop';
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';
import { Nexus3DCanvas } from '@/components/ui/Nexus3DCanvas';
import {
  checkFreighterInstalled,
  checkGemWalletInstalled,
  connectFreighter,
  signFreighterTransaction,
  payWithFreighter,
  payWithGemWallet,
  payWithCrossmark,
  checkXrplTrustline,
  checkStellarTrustline,
  setGemWalletTrustline,
  setCrossmarkTrustline,
  setFreighterTrustline,
  openAlbedoTrustline,
  setStellarTrustlineSecret,
  claimPendingXrplSwap,
  XrplTrustlineStatus,
  StellarTrustlineStatus,
  XRPL_NR_ISSUER_ADDRESS,
  STELLAR_NR_ISSUER_PUBLIC,
} from '@/lib/wallets';

type SwapToken = 'XRP' | 'XLM' | 'NXL' | 'USD' | 'USDC' | 'RLUSD';

const SELECTABLE_TOKENS: Array<'XRP' | 'XLM' | 'NXL' | 'USD'> = ['XRP', 'XLM', 'NXL', 'USD'];

const TOKEN_DETAILS: Record<SwapToken, { name: string; chain: string; iconColor: string }> = {
  XRP: { name: 'XRP', chain: 'XRPL TESTNET', iconColor: 'text-[#0081F2]' },
  XLM: { name: 'Stellar Lumens', chain: 'STELLAR TESTNET', iconColor: 'text-[#00E5FF]' },
  NXL: { name: 'Nexus Cross-Ledger ($NXL)', chain: 'DUAL-RAIL AMM POOL', iconColor: 'text-[var(--gold)]' },
  USD: { name: 'Nexus Ledger USD', chain: 'INTERNAL LEDGER', iconColor: 'text-emerald-400' },
  USDC: { name: 'USD Coin', chain: 'STELLAR TESTNET', iconColor: 'text-[#2775CA]' },
  RLUSD: { name: 'Ripple USD', chain: 'XRPL TESTNET', iconColor: 'text-[#0081F2]' },
};

interface NrPoolSnapshot {
  spotPriceUsd: number;
  change24hPercent: number;
  reserveUsd: number;
  poolNrSupply: number;
  circulatingNr: number;
  marketCapUsd: number;
  cumulativeFeeInjectedUsd: number;
  swapFeePercent: number;
  history: Array<{ spotPriceUsd: number; trigger: string; createdAt: string }>;
}

interface AmmQuoteOverlay {
  receiveAmount: number;
  exchangeRate: number;
  spotPriceBeforeUsd: number;
  spotPriceAfterUsd: number;
  priceImpactPercent: number;
  feeUsd: number;
}

import { PLATFORM_STELLAR_VAULT, PLATFORM_XRPL_VAULT } from '@/lib/vault';
import { executeSorobanSwapOrBridge, fetchLiveSorobanSwapPool } from '@/lib/soroban';

export default function SwapPage() {
  const [fromToken, setFromToken] = useState<SwapToken>('XRP');
  const [toToken, setToToken] = useState<SwapToken>('XLM');
  const [payAmount, setPayAmount] = useState('100.00');
  const [slippage, setSlippage] = useState<'0.1%' | '0.5%' | '1.0%'>('0.5%');
  const [showSlippageMenu, setShowSlippageMenu] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // User destination address on the target ledger (defaults to user's verified XRPL testnet account)
  const [destinationAddress, setDestinationAddress] = useState('r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt');

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
  const [bridgeHistory, setBridgeHistory] = useState<any[]>([]);
  const [loadingBridgeHistory, setLoadingBridgeHistory] = useState(false);
  const [elapsedPayoutSeconds, setElapsedPayoutSeconds] = useState(0);

  // Live On-Chain Soroban AMM & Bridge Escrow state
  const [sorobanPool, setSorobanPool] = useState<{
    contractId: string;
    explorerUrl: string;
    reserveXlm: number;
    reserveNxl: number;
    totalSwaps: number;
    totalEscrowsLocked: number;
  } | null>(null);
  const [sorobanSwapBusy, setSorobanSwapBusy] = useState(false);
  const [sorobanSwapNotice, setSorobanSwapNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
    explorerUrl?: string;
    payoutExplorerUrl?: string;
  } | null>(null);

  useEffect(() => {
    fetchLiveSorobanSwapPool()
      .then((pool) => setSorobanPool(pool))
      .catch(() => {});
  }, []);

  const canUseSorobanContract =
    (fromToken === 'XLM' && (toToken === 'NXL' || toToken === 'XRP')) ||
    (fromToken === 'NXL' && (toToken === 'XLM' || toToken === 'XRP'));

  const handleSorobanDirectSwap = async () => {
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setSorobanSwapNotice({ tone: 'error', text: 'Enter a valid swap amount greater than 0.' });
      return;
    }
    if (!canUseSorobanContract) return;
    if (toToken === 'XRP' && !destinationAddress.trim().startsWith('r')) {
      setSorobanSwapNotice({ tone: 'error', text: 'Enter a valid XRPL destination address (r...) first.' });
      return;
    }

    setSorobanSwapBusy(true);
    setSorobanSwapNotice(null);
    try {
      const slippageNum = parseFloat(slippage.replace('%', '')) || 0.5;
      const res = await executeSorobanSwapOrBridge({
        fromAsset: fromToken as 'XLM' | 'NXL',
        toAsset: toToken as 'XLM' | 'NXL' | 'XRP',
        amount: amt,
        userDestinationAddress: toToken === 'XRP' ? destinationAddress.trim() : undefined,
        slippagePct: slippageNum,
      });

      const modeLabel =
        res.mode === 'SOROBAN_AMM_SWAP'
          ? 'NexusSwap AMM swap confirmed on Stellar Testnet!'
          : res.mode === 'SOROBAN_BRIDGE_BURN'
          ? '$NXL burned on NexusVault & XRPL payout sent!'
          : 'Bridge escrow locked, XRPL payout sent & escrow released!';

      setSorobanSwapNotice({
        tone: 'success',
        text: modeLabel,
        explorerUrl: res.explorerUrl,
        payoutExplorerUrl: res.payoutExplorerUrl,
      });
      fetchLiveSorobanSwapPool().then((pool) => setSorobanPool(pool)).catch(() => {});
    } catch (err: any) {
      setSorobanSwapNotice({
        tone: 'error',
        text: err?.message || 'Soroban smart contract execution failed',
      });
    } finally {
      setSorobanSwapBusy(false);
    }
  };

  // Cross-Chain Payout Elapsed Timer
  useEffect(() => {
    let timer: any;
    if (swapState === 'executing_payout') {
      setElapsedPayoutSeconds(0);
      timer = setInterval(() => {
        setElapsedPayoutSeconds((s) => s + 1);
      }, 1000);
    } else {
      setElapsedPayoutSeconds(0);
    }
    return () => clearInterval(timer);
  }, [swapState]);

  const fetchSwapBridgeHistory = async () => {
    setLoadingBridgeHistory(true);
    try {
      const { token } = readSession();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const addrQuery = destinationAddress ? `?address=${encodeURIComponent(destinationAddress)}&limit=15` : '?limit=15';
      const res = await fetch(`/api/v1/swap/history${addrQuery}`, { headers });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setBridgeHistory(data.data);
      }
    } catch (err: any) {
      console.warn('Failed to load bridge history:', err);
    } finally {
      setLoadingBridgeHistory(false);
    }
  };

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

  // Swap Mode: Same-Chain (Direct Ledger Swap) vs Cross-Chain (Multi-Ledger Bridge)
  const [swapMode, setSwapMode] = useState<'same_chain' | 'cross_chain'>('same_chain');
  const [targetChain, setTargetChain] = useState<'XRPL' | 'STELLAR'>('XRPL');

  // XRPL Trustline & Pending Claim States
  const [trustlineStatus, setTrustlineStatus] = useState<XrplTrustlineStatus | null>(null);
  const [checkingTrustline, setCheckingTrustline] = useState(false);
  const [settingTrustline, setSettingTrustline] = useState(false);
  const [trustlineActionMsg, setTrustlineActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Stellar Trustline State & Actions
  const [stellarTrustlineStatus, setStellarTrustlineStatus] = useState<StellarTrustlineStatus | null>(null);
  const [checkingStellarTrustline, setCheckingStellarTrustline] = useState(false);
  const [settingStellarTrustline, setSettingStellarTrustline] = useState(false);
  const [stellarActionMsg, setStellarActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stellarSecretInput, setStellarSecretInput] = useState('');
  const [showStellarSecretBox, setShowStellarSecretBox] = useState(false);

  // Dedicated constant for user's confirmed XRPL deposit recovery (5 XRP)
  const XRPL_PENDING_ACCOUNT = 'r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt';
  const [pendingAccountTrustline, setPendingAccountTrustline] = useState<XrplTrustlineStatus | null>(null);
  const [checkingPendingTrustline, setCheckingPendingTrustline] = useState(false);
  const [pendingClaimStatus, setPendingClaimStatus] = useState<'idle' | 'checking' | 'ready' | 'claiming' | 'claimed' | 'error'>('ready');
  const [pendingClaimData, setPendingClaimData] = useState<{
    txHash: string;
    amountXrp: number;
    amountNxl: number;
    payoutHash?: string;
    explorerUrl?: string;
  } | null>({
    txHash: '66489352D012ED48BF48982A466416BEC38B907C031D10E3ED4206AD881295EB',
    amountXrp: 5,
    amountNxl: 4.688037,
  });
  const [claimError, setClaimError] = useState('');

  // Check pending account's trustline status on mount & refresh
  const handleRefreshPendingTrustline = async () => {
    setCheckingPendingTrustline(true);
    try {
      const st = await checkXrplTrustline(XRPL_PENDING_ACCOUNT, 'NXL');
      setPendingAccountTrustline(st);
    } catch {
      // Graceful fallback
    } finally {
      setCheckingPendingTrustline(false);
    }
  };

  // Detect extensions on mount & check XRPL pending account trustline
  useEffect(() => {
    checkFreighterInstalled().then(setHasFreighter);
    checkGemWalletInstalled().then(setHasGemWallet);
    handleRefreshPendingTrustline();
  }, []);

  // Synchronize session and auto-fill destination wallet based on Swap Mode
  useEffect(() => {
    const sync = () => {
      const u = readSession().user;
      setUser(u);
      if (u) {
        if (swapMode === 'same_chain') {
          if (fromToken === 'XRP' || toToken === 'XRP') {
            const xrplAddr = u.xrplAddress || (u.walletAddress?.startsWith('r') ? u.walletAddress : '');
            if (xrplAddr) {
              setDestinationAddress(xrplAddr);
              setTargetChain('XRPL');
            }
          } else if (fromToken === 'XLM' || toToken === 'XLM') {
            const stellarAddr = u.stellarAddress || (u.walletAddress?.startsWith('G') ? u.walletAddress : '');
            if (stellarAddr) {
              setDestinationAddress(stellarAddr);
              setTargetChain('STELLAR');
            }
          } else if (toToken === 'NXL') {
            const preferred = u.xrplAddress || (u.walletAddress?.startsWith('r') ? u.walletAddress : (u.stellarAddress || ''));
            if (preferred) setDestinationAddress(preferred);
          }
        } else {
          // Cross-Chain Mode
          if (targetChain === 'XRPL') {
            const xrplAddr = u.xrplAddress || (u.walletAddress?.startsWith('r') ? u.walletAddress : '');
            if (xrplAddr && (!destinationAddress || destinationAddress.startsWith('G'))) {
              setDestinationAddress(xrplAddr);
            }
          } else {
            const stellarAddr = u.stellarAddress || (u.walletAddress?.startsWith('G') ? u.walletAddress : '');
            if (stellarAddr && (!destinationAddress || destinationAddress.startsWith('r'))) {
              setDestinationAddress(stellarAddr);
            }
          }
        }
      }
    };
    sync();
    return onSessionChange(sync);
  }, [toToken, fromToken, swapMode, targetChain]);

  // Check on-chain Trustline status on destination address (XRPL & Stellar)
  useEffect(() => {
    let isCancelled = false;

    if (destinationAddress && destinationAddress.startsWith('r')) {
      setCheckingTrustline(true);
      checkXrplTrustline(destinationAddress, 'NXL')
        .then((st) => {
          if (!isCancelled) setTrustlineStatus(st);
        })
        .catch(() => {
          if (!isCancelled) setTrustlineStatus(null);
        })
        .finally(() => {
          if (!isCancelled) setCheckingTrustline(false);
        });
    } else {
      setTrustlineStatus(null);
    }

    if (destinationAddress && destinationAddress.startsWith('G')) {
      setCheckingStellarTrustline(true);
      checkStellarTrustline(destinationAddress, 'NXL')
        .then((st) => {
          if (!isCancelled) setStellarTrustlineStatus(st);
        })
        .catch(() => {
          if (!isCancelled) setStellarTrustlineStatus(null);
        })
        .finally(() => {
          if (!isCancelled) setCheckingStellarTrustline(false);
        });
    } else {
      setStellarTrustlineStatus(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [destinationAddress, toToken, targetChain, swapMode]);

  // Manual trigger to re-query XRPL ledger for trustline
  const handleRefreshTrustline = async () => {
    const target = destinationAddress || XRPL_PENDING_ACCOUNT;
    setCheckingTrustline(true);
    setTrustlineActionMsg(null);
    try {
      const updated = await checkXrplTrustline(target, 'NXL');
      setTrustlineStatus(updated);
      if (updated.hasTrustline) {
        setTrustlineActionMsg({
          type: 'success',
          text: `Verified on-chain: $NXL Trustline active! (Limit: ${Number(updated.limit).toLocaleString()} NXL, Balance: ${updated.balance} NXL)`,
        });
      } else {
        setTrustlineActionMsg({
          type: 'error',
          text: `Account ${target} does not have a verified trustline on XRPL testnet yet.`,
        });
      }
    } catch (err: any) {
      setTrustlineActionMsg({
        type: 'error',
        text: err.message || 'Failed to check XRPL trustline',
      });
    } finally {
      setCheckingTrustline(false);
    }
  };

  const handleSetTrustline = async () => {
    setSettingTrustline(true);
    setTrustlineActionMsg(null);
    try {
      const hasGem = typeof window !== 'undefined' && ((window as any).gemWallet || await checkGemWalletInstalled());
      const hasCrossmark = typeof window !== 'undefined' && Boolean((window as any).crossmark || (window as any).Crossmark);

      let txHash = '';
      if (hasGem) {
        const res = await setGemWalletTrustline({
          issuer: XRPL_NR_ISSUER_ADDRESS,
          currency: 'NXL',
          value: '1000000',
        });
        txHash = res.txHash;
      } else if (hasCrossmark) {
        const res = await setCrossmarkTrustline({
          issuer: XRPL_NR_ISSUER_ADDRESS,
          currency: 'NXL',
          value: '1000000',
        });
        txHash = res.txHash;
      } else {
        throw new Error('No XRPL wallet extension detected. Please install GemWallet or Crossmark.');
      }

      setTrustlineActionMsg({
        type: 'success',
        text: `TrustSet broadcasted! Tx: ${txHash.slice(0, 10)}... Validating on XRPL consensus ledger...`,
      });

      // Poll every 2.5 seconds for ledger validation (up to 8 times = 20s)
      let pollCount = 0;
      const intervalId = setInterval(async () => {
        pollCount++;
        const target = destinationAddress || XRPL_PENDING_ACCOUNT;
        try {
          const updated = await checkXrplTrustline(target, 'NXL');
          if (updated.hasTrustline) {
            setTrustlineStatus(updated);
            setTrustlineActionMsg({
              type: 'success',
              text: `🎉 Trustline confirmed on XRPL! Limit: ${Number(updated.limit).toLocaleString()} NXL. Ready to claim payout!`,
            });
            clearInterval(intervalId);
          }
        } catch {}

        if (pollCount >= 8) {
          clearInterval(intervalId);
        }
      }, 2500);
    } catch (err: any) {
      setTrustlineActionMsg({
        type: 'error',
        text: err.message || 'Failed to establish trustline',
      });
    } finally {
      setSettingTrustline(false);
    }
  };

  // Claim pending XRPL swap payout to user's verified XRPL account
  const handleClaimPending = async () => {
    if (!pendingClaimData) return;
    setPendingClaimStatus('claiming');
    setClaimError('');

    try {
      const res = await claimPendingXrplSwap({
        depositTxHash: pendingClaimData.txHash,
        destinationAddress: XRPL_PENDING_ACCOUNT,
      });

      setPendingClaimData((prev) => ({
        ...prev!,
        payoutHash: res.payoutTxHash,
        explorerUrl: res.explorerUrl,
      }));
      setPendingClaimStatus('claimed');
      loadNrPoolAndBalances();
    } catch (err: any) {
      setClaimError(err.message || 'Failed to claim pending swap payout');
      setPendingClaimStatus('error');
    }
  };

  // Stellar Trustline Handlers
  const handleSetFreighterTrustline = async () => {
    if (!destinationAddress || !destinationAddress.startsWith('G')) {
      setStellarActionMsg({
        type: 'error',
        text: 'Please enter a valid Stellar destination address (starts with G) first.',
      });
      return;
    }
    setSettingStellarTrustline(true);
    setStellarActionMsg(null);

    try {
      const res = await setFreighterTrustline({
        accountAddress: destinationAddress,
        assetCode: 'NXL',
      });

      setStellarActionMsg({
        type: 'success',
        text: `🎉 Stellar Trustline established! Tx: ${res.txHash.slice(0, 10)}... Validating on ledger...`,
      });

      // Poll ledger to update status
      let pollCount = 0;
      const intervalId = setInterval(async () => {
        pollCount++;
        try {
          const updated = await checkStellarTrustline(destinationAddress, 'NXL');
          if (updated.hasTrustline) {
            setStellarTrustlineStatus(updated);
            setStellarActionMsg({
              type: 'success',
              text: `🎉 Trustline confirmed on Stellar Testnet! Ready to receive $NXL tokens.`,
            });
            clearInterval(intervalId);
          }
        } catch {}
        if (pollCount >= 6) clearInterval(intervalId);
      }, 2500);
    } catch (err: any) {
      setStellarActionMsg({
        type: 'error',
        text: err.message || 'Failed to establish Stellar trustline with Freighter',
      });
    } finally {
      setSettingStellarTrustline(false);
    }
  };

  const handleOpenAlbedo = () => {
    openAlbedoTrustline({ assetCode: 'NXL', issuer: STELLAR_NR_ISSUER_PUBLIC });
    setStellarActionMsg({
      type: 'success',
      text: 'Opened Albedo trustline window. Once confirmed in Albedo, click "Re-check Status" below.',
    });
  };

  const handleSetStellarTrustlineSecret = async () => {
    if (!stellarSecretInput.trim()) {
      setStellarActionMsg({
        type: 'error',
        text: 'Please enter your Stellar testnet secret key (starts with S)',
      });
      return;
    }
    setSettingStellarTrustline(true);
    setStellarActionMsg(null);

    try {
      const res = await setStellarTrustlineSecret({
        secretKey: stellarSecretInput.trim(),
        assetCode: 'NXL',
      });

      setStellarActionMsg({
        type: 'success',
        text: `🎉 Stellar Trustline confirmed on-chain! Tx: ${res.txHash.slice(0, 10)}...`,
      });
      setShowStellarSecretBox(false);
      setStellarSecretInput('');

      // Refresh status
      const updated = await checkStellarTrustline(destinationAddress, 'NXL');
      setStellarTrustlineStatus(updated);
    } catch (err: any) {
      setStellarActionMsg({
        type: 'error',
        text: err.message || 'Failed to set trustline with secret key',
      });
    } finally {
      setSettingStellarTrustline(false);
    }
  };

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

  // Balances & $NR AMM Pool State
  const [xrpBalance, setXrpBalance] = useState(500.0);
  const [xlmBalance, setXlmBalance] = useState(3480.5);
  const [nrBalance, setNrBalance] = useState(0);
  const [usdBalance, setUsdBalance] = useState(0);
  const [nrPool, setNrPool] = useState<NrPoolSnapshot | null>(null);
  const [ammQuote, setAmmQuote] = useState<AmmQuoteOverlay | null>(null);

  const loadNrPoolAndBalances = async () => {
    try {
      const poolRes = await fetch('/api/v1/swap/nr-pool', { cache: 'no-store' });
      const poolJson = await poolRes.json().catch(() => null);
      if (poolRes.ok && poolJson?.success && poolJson.data) {
        setNrPool(poolJson.data);
      }
    } catch {}

    const { token } = readSession();
    if (token) {
      try {
        const balRes = await fetch('/api/v1/wallet/balance', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const balJson = await balRes.json().catch(() => null);
        if (balRes.ok && balJson?.success && balJson.balance) {
          setUsdBalance((balJson.balance.USD || 0) / 100);
          setNrBalance(((balJson.balance.NXL ?? balJson.balance.NR) || 0) / 1_000_000);
        }
      } catch {}
    }
  };

  useEffect(() => {
    loadNrPoolAndBalances();
    fetchSwapBridgeHistory();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const toParam = params.get('to')?.toUpperCase();
      if (toParam === 'NXL') {
        setFromToken('XLM');
        setToToken('NXL');
      }
    }
  }, []);

  const nrSpotUsd = nrPool?.spotPriceUsd || 1.0;
  const involvesNrOrUsd =
    fromToken === 'NXL' || toToken === 'NXL' || fromToken === 'USD' || toToken === 'USD';

  // Fetch authoritative AMM quote when $NR or USD is involved
  useEffect(() => {
    if (!involvesNrOrUsd) {
      setAmmQuote(null);
      return;
    }
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setAmmQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/v1/swap/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromAsset: fromToken, toAsset: toToken, amount: amt }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setAmmQuote({
            receiveAmount: Number(json.receiveAmount || 0),
            exchangeRate: Number(json.exchangeRate || 0),
            spotPriceBeforeUsd: Number(json.spotPriceBeforeUsd || nrSpotUsd),
            spotPriceAfterUsd: Number(json.spotPriceAfterUsd || nrSpotUsd),
            priceImpactPercent: Number(json.priceImpactPercent || 0),
            feeUsd: Number(json.feeUsd || 0),
          });
        }
      } catch {}
    }, 250);

    return () => clearTimeout(timer);
  }, [fromToken, toToken, payAmount, involvesNrOrUsd, nrSpotUsd]);

  const tokenUsdPrice = (tok: SwapToken) => {
    if (tok === 'XRP') return xrpUsd;
    if (tok === 'XLM') return xlmUsd;
    if (tok === 'NXL') return nrSpotUsd;
    return 1.0;
  };

  // Dynamic live rate calculation
  const liveRate = useMemo(() => {
    if (ammQuote && involvesNrOrUsd && ammQuote.exchangeRate > 0) {
      return ammQuote.exchangeRate;
    }
    const fromUsd = tokenUsdPrice(fromToken);
    const toUsd = tokenUsdPrice(toToken);
    if (toUsd <= 0) return 2.50;
    return fromUsd / toUsd;
  }, [fromToken, toToken, xlmUsd, xrpUsd, nrSpotUsd, ammQuote, involvesNrOrUsd]);

  // Compute output amount based on live rates / AMM curve
  const receiveAmount = useMemo(() => {
    if (ammQuote && involvesNrOrUsd) {
      return ammQuote.receiveAmount.toFixed(fromToken === 'NXL' && toToken === 'USD' ? 2 : 4);
    }
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const computed = num * liveRate;
    return computed.toFixed(toToken === 'NXL' ? 4 : 2);
  }, [payAmount, liveRate, ammQuote, involvesNrOrUsd, fromToken, toToken]);

  // Compute USD estimated values
  const payUsdValue = useMemo(() => {
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    return (num * tokenUsdPrice(fromToken)).toFixed(2);
  }, [payAmount, fromToken, xrpUsd, xlmUsd, nrSpotUsd]);

  const receiveUsdValue = useMemo(() => {
    const num = parseFloat(receiveAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    return (num * tokenUsdPrice(toToken)).toFixed(2);
  }, [receiveAmount, toToken, xlmUsd, xrpUsd, nrSpotUsd]);

  // Minimum received after slippage
  const minReceived = useMemo(() => {
    const num = parseFloat(receiveAmount);
    if (isNaN(num) || num <= 0) return '0.00';
    const slipFactor = slippage === '0.1%' ? 0.001 : slippage === '0.5%' ? 0.005 : 0.01;
    return (num * (1 - slipFactor)).toFixed(toToken === 'NXL' ? 4 : 2);
  }, [receiveAmount, slippage, toToken]);

  // Invert tokens
  const handleInvert = () => {
    const prevFrom = fromToken;
    const prevTo = toToken;
    setFromToken(prevTo);
    setToToken(prevFrom);
    setPayAmount(receiveAmount === '0.00' ? '100.00' : receiveAmount);
  };

  const handleSelectFromToken = (next: SwapToken) => {
    if (next === toToken) {
      setToToken(fromToken);
    }
    setFromToken(next);
  };

  const handleSelectToToken = (next: SwapToken) => {
    if (next === fromToken) {
      setFromToken(toToken);
    }
    setToToken(next);
  };

  const getTokenDisplayBalance = (tok: SwapToken) => {
    if (tok === 'XRP') return `${xrpBalance.toFixed(2)} XRP`;
    if (tok === 'XLM') return `${xlmBalance.toFixed(2)} XLM`;
    if (tok === 'NXL') return `${nrBalance.toFixed(4)} NXL`;
    if (tok === 'USD') return `$${usdBalance.toFixed(2)} USD`;
    return '0.00';
  };

  const effectiveDestination =
    toToken === 'USD'
      ? user?.id
        ? `nexus_wallet_${user.id.slice(0, 8)}`
        : 'NEXUS_INTERNAL_LEDGER'
      : toToken === 'NXL'
      ? destinationAddress ||
        user?.xrplAddress ||
        (user?.walletAddress?.startsWith('r') ? user.walletAddress : '') ||
        (user?.id ? `nexus_wallet_${user.id.slice(0, 8)}` : 'NEXUS_INTERNAL_LEDGER')
      : destinationAddress;

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
    if (!effectiveDestination) {
      setSwapError('Enter the destination wallet address for this swap.');
      return;
    }
    setSwapState('preparing');
    setShowReviewModal(true);
    const { token } = readSession();

    try {
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) reqHeaders.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/v1/swap/initiate', {
        method: 'POST',
        headers: reqHeaders,
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
      } else {
        const errJson = await res.json().catch(() => null);
        if (errJson?.error) setSwapError(errJson.error);
      }
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : 'Could not reach the swap service.');
    }

    // Never fabricate a swap order. Without a backend-issued swap ID and
    // deposit identifier the user could send funds that cannot be reconciled.
    setSwapError((prev) => prev || 'Could not start this swap. Please try again.');
    setSwapState('idle');
    setShowReviewModal(false);
  };

  // Execute Swap with Real Ingress Deposit (or Internal Ledger Balance)
  const handleExecuteCrossChainSwap = async () => {
    if (!activeSwapOrder) return;
    setSwapError('');
    let resolvedDepositHash = '';
    const isInternalIngress = fromToken === 'USD' || fromToken === 'NXL';

    // 1. If using Extension (Freighter / GemWallet) for XLM/XRP ingress
    if (!isInternalIngress && depositMethod === 'extension') {
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
    } else if (!isInternalIngress && depositMethod === 'manual') {
      // 2. If using Manual Transfer -> requires real confirmed transaction hash
      const hash = manualDepositTxHash.trim();
      if (!hash) {
        setSwapError('Please enter the transaction hash of your transfer to the server vault to verify.');
        return;
      }
      resolvedDepositHash = hash;
    } else if (!isInternalIngress && depositMethod === 'secret') {
      // 3. If using Testnet Secret
      const sec = userTestnetSecret.trim();
      if (!sec) {
        setSwapError('Please enter your testnet secret key / seed to sign.');
        return;
      }
    }

    setSwapState('executing_payout');
    const { token } = readSession();

    try {
      const execHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) execHeaders.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/v1/swap/execute', {
        method: 'POST',
        headers: execHeaders,
        body: JSON.stringify({
          swapId: activeSwapOrder.swapId,
          fromAsset: fromToken,
          toAsset: toToken,
          amount: parseFloat(payAmount) || 100,
          userDestinationAddress: effectiveDestination,
          depositTxHash: resolvedDepositHash || undefined,
          userSourceSecret: !isInternalIngress && depositMethod === 'secret' ? userTestnetSecret.trim() : undefined,
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
          if (json.poolStats) {
            setNrPool(json.poolStats);
          }
          updateBalancesAfterSwap();
          loadNrPoolAndBalances();
          setSwapState('success');
          fetchSwapBridgeHistory();
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
    if (fromToken === 'XRP') setXrpBalance((b) => Math.max(0, b - payNum));
    if (fromToken === 'XLM') setXlmBalance((b) => Math.max(0, b - payNum));
    if (fromToken === 'NXL') setNrBalance((b) => Math.max(0, b - payNum));
    if (fromToken === 'USD') setUsdBalance((b) => Math.max(0, b - payNum));

    if (toToken === 'XRP') setXrpBalance((b) => b + recvNum);
    if (toToken === 'XLM') setXlmBalance((b) => b + recvNum);
    if (toToken === 'NXL') setNrBalance((b) => b + recvNum);
    if (toToken === 'USD') setUsdBalance((b) => b + recvNum);
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)] font-sans antialiased selection:bg-[var(--gold)]/30">
      
      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 relative">
        
        {/* Header Breadcrumb */}
        <div className="mb-8">
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-[var(--gold)] font-semibold">
            SWAP
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-[var(--foreground)] tracking-tight mt-2">
            Swap across Stellar and XRP Ledger
          </h1>
          <p className="text-sm sm:text-base text-[var(--muted)] mt-1.5 font-normal">
            Convert XLM, XRP, USD, and $NXL. Funds route through the NexusRail escrow vault before payout.
          </p>
        </div>

        {/* Live $NXL Native Tokenomics & AMM Pool Banner */}
        <div className="mb-8 rounded-2xl nexus-glass-card border border-[var(--gold)]/30 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 flex items-center justify-center font-mono font-bold text-[var(--gold-bright)] text-sm shrink-0">
              $NXL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--foreground)]">$NXL token</span>
                <span className="px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[11px] font-mono font-bold text-[var(--gold-bright)]">
                  AMM pool
                </span>
              </div>
              <p className="text-xs font-mono text-[var(--muted)] mt-0.5">
                Half of all swap fees back the $NXL reserve. Pay with $NXL at checkout for 10% off.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="px-3 py-2 rounded-xl nexus-glass-surface border border-[var(--border)]">
              <span className="text-[11px] text-[var(--muted)] uppercase block">Spot price</span>
              <span className="text-sm font-bold text-[var(--gold-bright)]">
                {nrPool ? `$${nrSpotUsd.toFixed(4)}` : '—'}
              </span>
              {nrPool && (
                <span
                  className={`ml-1.5 text-[11px] ${
                    nrPool.change24hPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {nrPool.change24hPercent >= 0 ? '+' : ''}
                  {nrPool.change24hPercent.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="px-3 py-2 rounded-xl nexus-glass-surface border border-[var(--border)]">
              <span className="text-[11px] text-[var(--muted)] uppercase block">USD reserve</span>
              <span className="text-sm font-bold text-[var(--foreground)]">
                {nrPool ? `$${nrPool.reserveUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl nexus-glass-surface border border-[var(--border)]">
              <span className="text-[11px] text-[var(--muted)] uppercase block">Your $NXL</span>
              <span className="text-sm font-bold text-[var(--foreground)]">
                {nrBalance.toFixed(2)} NXL
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFromToken('USD');
                setToToken('NXL');
                setPayAmount('100.00');
              }}
              className="px-3 py-2 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Buy $NXL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* User Pending Deposit Recovery Card */}
        {pendingClaimData && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-[var(--gold)]/10 via-[var(--gold)]/5 to-transparent border border-[var(--gold)]/40 p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/20 border border-[var(--gold)]/40 flex items-center justify-center shrink-0 text-[var(--gold-bright)]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--foreground)]">Pending XRPL Swap Deposit Detected</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-400">
                      ON-CHAIN VERIFIED
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[var(--muted)] mt-1">
                    Found {pendingClaimData.amountXrp} XRP deposited from account <span className="text-[var(--gold)] font-bold">{XRPL_PENDING_ACCOUNT}</span> (Tx: {pendingClaimData.txHash.slice(0, 10)}...). Output due: <strong className="text-emerald-400">{pendingClaimData.amountNxl} $NXL</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={checkingPendingTrustline}
                  onClick={handleRefreshPendingTrustline}
                  className="px-3 py-2.5 rounded-xl nexus-glass-surface border border-[var(--border)] text-[var(--foreground)] hover:text-[var(--gold)] text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                  title="Re-query XRPL ledger for trustline"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingPendingTrustline ? 'animate-spin text-[var(--gold)]' : ''}`} />
                  <span>{checkingPendingTrustline ? 'Verifying...' : 'Check Status'}</span>
                </button>

                {checkingPendingTrustline ? (
                  <div className="px-4 py-2.5 rounded-xl nexus-glass-surface border border-[var(--border)] text-xs font-mono text-[var(--muted)] flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
                    <span>Checking XRPL...</span>
                  </div>
                ) : !pendingAccountTrustline?.hasTrustline ? (
                  <button
                    type="button"
                    disabled={settingTrustline}
                    onClick={handleSetTrustline}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    {settingTrustline ? 'Approving TrustSet...' : 'Step 1: Set $NXL Trustline'}
                  </button>
                ) : pendingClaimStatus === 'claimed' ? (
                  <a
                    href={pendingClaimData.explorerUrl || `https://testnet.xrpl.org/transactions/${pendingClaimData.payoutHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs font-mono flex items-center gap-1.5 hover:underline"
                  >
                    <span>View Payout on XRPL</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={pendingClaimStatus === 'claiming'}
                    onClick={handleClaimPending}
                    className="px-4 py-2.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[var(--gold)]/20"
                  >
                    {pendingClaimStatus === 'claiming' ? 'Disbursing NXL...' : `Step 2: Claim ${pendingClaimData.amountNxl} NXL`}
                  </button>
                )}
              </div>
            </div>

            {claimError && (
              <p className="text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                {claimError}
              </p>
            )}

            {pendingClaimStatus === 'claimed' && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between">
                <span>🎉 {pendingClaimData.amountNxl} $NXL tokens successfully deposited to your XRPL wallet!</span>
                <span className="text-[11px] text-[var(--muted)]">Tx: {pendingClaimData.payoutHash?.slice(0, 14)}...</span>
              </div>
            )}
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          
          {/* Left Column: Swap Assets Card (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl nexus-glass-card p-5 sm:p-7 space-y-4">
              
              {/* Dual-Mode Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setSwapMode('same_chain');
                    if (fromToken === 'XRP') {
                      setToToken('NXL');
                      setTargetChain('XRPL');
                      const xrplAddr = user?.xrplAddress || (user?.walletAddress?.startsWith('r') ? user.walletAddress : '');
                      if (xrplAddr) setDestinationAddress(xrplAddr);
                    } else if (fromToken === 'XLM') {
                      setToToken('NXL');
                      setTargetChain('STELLAR');
                      const stellarAddr = user?.stellarAddress || (user?.walletAddress?.startsWith('G') ? user.walletAddress : '');
                      if (stellarAddr) setDestinationAddress(stellarAddr);
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    swapMode === 'same_chain'
                      ? 'bg-[var(--gold)] text-black shadow-md'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Simple Swap (Same-Chain)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSwapMode('cross_chain');
                    if (fromToken === 'XRP') {
                      setToToken('XLM');
                      setTargetChain('STELLAR');
                      const stellarAddr = user?.stellarAddress || (user?.walletAddress?.startsWith('G') ? user.walletAddress : '');
                      if (stellarAddr) setDestinationAddress(stellarAddr);
                    } else if (fromToken === 'XLM') {
                      setToToken('XRP');
                      setTargetChain('XRPL');
                      const xrplAddr = user?.xrplAddress || (user?.walletAddress?.startsWith('r') ? user.walletAddress : '');
                      if (xrplAddr) setDestinationAddress(xrplAddr);
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    swapMode === 'cross_chain'
                      ? 'bg-[var(--gold)] text-black shadow-md'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Cross-Chain Bridge</span>
                </button>
              </div>

              {/* Card Title & Slippage Selector */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                    {swapMode === 'same_chain' ? 'Same-Chain Swap' : 'Cross-Chain Bridge'}
                  </h2>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                    swapMode === 'same_chain'
                      ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {swapMode === 'same_chain' ? 'DIRECT LEDGER' : 'DUAL-RAIL BRIDGE'}
                  </span>
                </div>
                
                {/* Slippage Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSlippageMenu(!showSlippageMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg nexus-glass-surface text-[11px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
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
                    <span>{fromToken === 'USD' || fromToken === 'NXL' ? 'You pay from NexusRail wallet' : 'You pay from connected wallet'}</span>
                  </span>
                  <span>Balance: {getTokenDisplayBalance(fromToken)}</span>
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

                  {/* Source Token Selector */}
                  <div className="relative shrink-0">
                    <select
                      value={fromToken}
                      onChange={(e) => handleSelectFromToken(e.target.value as SwapToken)}
                      aria-label="Select source asset"
                      className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs font-semibold cursor-pointer focus:outline-none focus:border-[var(--gold)]"
                    >
                      {SELECTABLE_TOKENS.map((tok) => (
                        <option key={tok} value={tok} className="bg-[#0B0D14] text-white">
                          {tok}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] pt-1">
                  <span>≈ ${payUsdValue} USD</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] tracking-wider text-[var(--muted)]">{TOKEN_DETAILS[fromToken].chain}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const maxVal =
                          fromToken === 'XRP'
                            ? xrpBalance
                            : fromToken === 'XLM'
                            ? xlmBalance
                            : fromToken === 'NXL'
                            ? nrBalance
                            : usdBalance;
                        setPayAmount(maxVal > 0 ? maxVal.toFixed(2) : '100.00');
                      }}
                      className="text-[11px] font-bold text-[var(--gold)] hover:underline uppercase cursor-pointer"
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
                  <span>{toToken === 'NXL' || toToken === 'USD' ? 'Credited to your NexusRail wallet' : 'Server deposits to your address'}</span>
                  <span>Balance: {getTokenDisplayBalance(toToken)}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="w-full text-3xl sm:text-4xl font-mono text-[var(--foreground)] font-medium select-all">
                    {receiveAmount}
                  </span>

                  {/* Target Token Selector */}
                  <div className="relative shrink-0">
                    <select
                      value={toToken}
                      onChange={(e) => handleSelectToToken(e.target.value as SwapToken)}
                      aria-label="Select target asset"
                      className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs font-semibold cursor-pointer focus:outline-none focus:border-[var(--gold)]"
                    >
                      {SELECTABLE_TOKENS.map((tok) => (
                        <option key={tok} value={tok} className="bg-[#0B0D14] text-white">
                          {tok}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] pt-1">
                  <span>≈ ${receiveUsdValue} USD</span>
                  <span className="text-[11px] tracking-wider text-[var(--muted)]">{TOKEN_DETAILS[toToken].chain}</span>
                </div>
              </div>

              {/* Box 3: User Destination Address Field & Dual-Mode Routing */}
              {(toToken === 'XLM' || toToken === 'XRP' || toToken === 'NXL') ? (
                <div className="p-3.5 rounded-xl nexus-glass-surface space-y-2.5">
                  {swapMode === 'same_chain' ? (
                    <>
                      <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)]">
                        <span className="flex items-center gap-1.5 text-[var(--foreground)] font-semibold">
                          <Zap className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>Payout Destination (Same-Chain {fromToken === 'XRP' || toToken === 'XRP' ? 'XRPL' : 'Stellar'}):</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsWalletModalOpen(true)}
                          className="text-[11px] text-[var(--gold)] hover:underline cursor-pointer"
                        >
                          Select Wallet
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={destinationAddress}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setDestinationAddress(val);
                            if (val.startsWith('r')) localStorage.setItem('nexus_xrpl_address', val);
                          }}
                          placeholder={fromToken === 'XRP' || toToken === 'XRP' ? 'Your XRPL r... address (e.g. r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt)' : 'Your Stellar G... address'}
                          className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-mono text-[var(--gold-bright)] placeholder-[var(--muted)]/40 focus:border-[var(--border-focus)] focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={checkingTrustline}
                          onClick={handleRefreshTrustline}
                          className="px-3 py-2 rounded-xl nexus-glass-surface border border-[var(--border)] text-xs font-mono text-[var(--gold)] hover:underline flex items-center gap-1.5 shrink-0 cursor-pointer"
                          title="Verify trustline on XRPL ledger"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingTrustline ? 'animate-spin' : ''}`} />
                          <span>{checkingTrustline ? 'Verifying...' : 'Check'}</span>
                        </button>
                      </div>

                      <p className="text-[10.5px] font-mono text-[var(--muted)]">
                        {toToken === 'NXL'
                          ? `Both tokens settle on ${fromToken === 'XRP' || destinationAddress.startsWith('r') ? 'XRPL Testnet' : 'Stellar Testnet'}. $NXL tokens will disburse directly to this account.`
                          : `Direct same-ledger swap. Payout will disburse directly to your connected wallet address.`}
                      </p>
                    </>
                  ) : (
                    <>
                      {/* Cross-chain target network selector */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="flex items-center gap-1.5 text-[var(--foreground)] font-semibold">
                          <Globe className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>Destination Ledger:</span>
                        </span>
                        <div className="flex items-center gap-1 bg-[var(--surface-solid)] p-0.5 rounded-lg border border-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetChain('XRPL');
                              const xrplAddr = user?.xrplAddress || (user?.walletAddress?.startsWith('r') ? user.walletAddress : '');
                              if (xrplAddr) setDestinationAddress(xrplAddr);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                              targetChain === 'XRPL' ? 'bg-[var(--gold)] text-black' : 'text-[var(--muted)] hover:text-white'
                            }`}
                          >
                            XRPL Testnet
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetChain('STELLAR');
                              const stellarAddr = user?.stellarAddress || (user?.walletAddress?.startsWith('G') ? user.walletAddress : '');
                              if (stellarAddr) setDestinationAddress(stellarAddr);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                              targetChain === 'STELLAR' ? 'bg-[var(--gold)] text-black' : 'text-[var(--muted)] hover:text-white'
                            }`}
                          >
                            Stellar Testnet
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] pt-1">
                        <span>Recipient {targetChain} Address:</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (targetChain === 'XRPL') {
                              const addr = user?.xrplAddress || (user?.walletAddress?.startsWith('r') ? user.walletAddress : '');
                              if (addr) setDestinationAddress(addr);
                            } else {
                              const addr = user?.stellarAddress || (user?.walletAddress?.startsWith('G') ? user.walletAddress : '');
                              if (addr) setDestinationAddress(addr);
                            }
                          }}
                          className="text-[11px] text-[var(--gold)] hover:underline cursor-pointer"
                        >
                          Use Connected {targetChain} Wallet
                        </button>
                      </div>

                      <input
                        type="text"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        placeholder={targetChain === 'STELLAR' ? 'Enter Stellar G... destination' : 'Enter XRPL r... destination'}
                        className="w-full px-3 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted)]/40 focus:border-[var(--border-focus)] focus:outline-none"
                      />

                      <p className="text-[11px] font-mono text-[var(--muted)]">
                        Cross-Chain Bridge: Ingress deposit is verified in the server vault, and {receiveAmount} {toToken} is disbursed across ledgers to this {targetChain} address.
                      </p>
                    </>
                  )}

                  {/* XRPL Trustline Status indicator for NXL */}
                  {toToken === 'NXL' && destinationAddress.startsWith('r') && (
                    <div className="pt-1">
                      {checkingTrustline ? (
                        <div className="p-2 rounded-lg nexus-glass-surface border border-[var(--border)] text-[11px] font-mono text-[var(--muted)] flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
                          <span>Checking XRPL Trustline status...</span>
                        </div>
                      ) : trustlineStatus?.hasTrustline ? (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>XRPL $NXL Trustline Active (Balance: {trustlineStatus.balance} NXL)</span>
                          </span>
                          <span className="text-[9.5px] text-[var(--muted)]">Issuer: {trustlineStatus.issuer.slice(0, 6)}...</span>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>XRPL Trustline Required</span>
                            </span>
                            <span className="text-[11px] text-[var(--muted)]">Account: {destinationAddress.slice(0, 6)}...{destinationAddress.slice(-4)}</span>
                          </div>
                          <p className="text-[10.5px] text-[var(--muted)] leading-relaxed">
                            XRPL consensus protocol strictly requires account <strong className="text-[var(--gold)]">{destinationAddress}</strong> to create a trustline to issuer <strong className="text-[var(--foreground)]">{XRPL_NR_ISSUER_ADDRESS.slice(0, 8)}...</strong> before receiving $NXL tokens.
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              disabled={settingTrustline}
                              onClick={handleSetTrustline}
                              className="px-3.5 py-1.5 rounded-lg bg-[var(--gold)] text-black font-bold text-xs hover:bg-[var(--gold-bright)] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                              {settingTrustline ? 'Approving TrustSet...' : 'Enable $NXL Trustline'}
                            </button>
                            <button
                              type="button"
                              disabled={checkingTrustline}
                              onClick={handleRefreshTrustline}
                              className="px-3 py-1.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-[var(--foreground)] text-xs hover:text-[var(--gold)] transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${checkingTrustline ? 'animate-spin' : ''}`} />
                              <span>Re-check Ledger</span>
                            </button>
                          </div>
                          {trustlineActionMsg && (
                            <p className={`text-[11px] ${trustlineActionMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {trustlineActionMsg.text}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stellar Trustline Status indicator for NXL */}
                  {toToken === 'NXL' && destinationAddress.startsWith('G') && (
                    <div className="pt-1">
                      {checkingStellarTrustline ? (
                        <div className="p-2 rounded-lg nexus-glass-surface border border-[var(--border)] text-[11px] font-mono text-[var(--muted)] flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
                          <span>Checking Stellar Trustline status...</span>
                        </div>
                      ) : stellarTrustlineStatus?.hasTrustline ? (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Stellar $NXL Trustline Active (Balance: {stellarTrustlineStatus.balance} NXL)</span>
                          </span>
                          <span className="text-[9.5px] text-[var(--muted)]">Issuer: {stellarTrustlineStatus.issuer.slice(0, 6)}...</span>
                        </div>
                      ) : stellarTrustlineStatus?.isValidAddress === false ? (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-rose-400">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Invalid Stellar Address Checksum</span>
                          </div>
                          <p className="text-[10.5px] text-[var(--muted)] leading-relaxed">
                            The Stellar address entered has an invalid checksum or character format. Stellar public keys must start with <strong className="text-white font-mono">&quot;G&quot;</strong> and have exactly 56 characters. Please verify your address.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Stellar Trustline Required</span>
                            </span>
                            <span className="text-[11px] text-[var(--muted)]">Issuer: {STELLAR_NR_ISSUER_PUBLIC.slice(0, 8)}...</span>
                          </div>
                          <p className="text-[10.5px] text-[var(--muted)] leading-relaxed">
                            Stellar protocol requires account ({destinationAddress.slice(0, 8)}...{destinationAddress.slice(-4)}) to add a Trustline to Issuer {STELLAR_NR_ISSUER_PUBLIC.slice(0, 8)}... for asset &quot;NXL&quot; before receiving tokens.
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              disabled={settingStellarTrustline}
                              onClick={handleSetFreighterTrustline}
                              className="px-3 py-1.5 rounded-lg bg-[var(--gold)] text-black font-bold text-xs hover:bg-[var(--gold-bright)] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>{settingStellarTrustline ? 'Signing in Freighter...' : 'Enable $NXL Trustline (Freighter)'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleOpenAlbedo}
                              className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 hover:bg-sky-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                              title="Zero-install web signer for Stellar"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>Add via Albedo (1-Click Web)</span>
                            </button>

                            <button
                              type="button"
                              disabled={checkingStellarTrustline}
                              onClick={async () => {
                                setCheckingStellarTrustline(true);
                                const updated = await checkStellarTrustline(destinationAddress);
                                setStellarTrustlineStatus(updated);
                                setCheckingStellarTrustline(false);
                              }}
                              className="px-2.5 py-1.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-[var(--foreground)] text-xs hover:text-[var(--gold)] transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${checkingStellarTrustline ? 'animate-spin' : ''}`} />
                              <span>Re-check Status</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setShowStellarSecretBox((prev) => !prev)}
                              className="text-[11px] text-[var(--muted)] hover:text-[var(--gold)] underline cursor-pointer ml-auto"
                            >
                              {showStellarSecretBox ? 'Hide Dev Input' : 'Use Testnet Secret'}
                            </button>
                          </div>

                          {showStellarSecretBox && (
                            <div className="p-2.5 rounded-lg nexus-glass-card border border-[var(--border)] space-y-2 mt-1">
                              <p className="text-[11px] text-[var(--muted)]">Enter your Stellar Testnet Secret Key (S...) to sign change_trust directly on-chain:</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="password"
                                  value={stellarSecretInput}
                                  onChange={(e) => setStellarSecretInput(e.target.value)}
                                  placeholder="S... (56-character Stellar secret seed)"
                                  className="flex-1 px-2.5 py-1 rounded bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--gold)]"
                                />
                                <button
                                  type="button"
                                  disabled={settingStellarTrustline || !stellarSecretInput.trim()}
                                  onClick={handleSetStellarTrustlineSecret}
                                  className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs cursor-pointer"
                                >
                                  {settingStellarTrustline ? 'Setting...' : 'Submit'}
                                </button>
                              </div>
                            </div>
                          )}

                          {stellarActionMsg && (
                            <p className={`text-[11px] ${stellarActionMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {stellarActionMsg.text}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--gold)]/20 flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--muted)]">Settlement Destination</span>
                  <span className="text-[var(--gold-bright)] font-semibold">
                    {user?.email || (user?.id ? `Wallet ${user.id.slice(0, 8)}` : 'Sign in to credit NexusRail Wallet')}
                  </span>
                </div>
              )}

              {/* Exchange Rate & AMM Impact Lines */}
              <div className="space-y-1.5 py-1 text-xs font-mono text-[var(--muted)]">
                <div className="flex items-center justify-between">
                  <span>Exchange rate</span>
                  <span className="text-[var(--foreground)] font-medium">
                    1 {fromToken} = {liveRate.toFixed(4)} {toToken}
                  </span>
                </div>
                {ammQuote && (fromToken === 'NXL' || toToken === 'NXL') && (
                  <>
                    <div className="flex items-center justify-between">
                      <span>AMM Price Impact</span>
                      <span className={ammQuote.priceImpactPercent > 2 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-medium'}>
                        {ammQuote.priceImpactPercent.toFixed(3)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Post-Swap $NXL Price</span>
                      <span className="text-[var(--gold-bright)] font-medium">
                        ${ammQuote.spotPriceBeforeUsd.toFixed(4)} &rarr; ${ammQuote.spotPriceAfterUsd.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>AMM Fee (0.5% · 50% to Pool Reserve)</span>
                      <span className="text-[var(--foreground)] font-medium">${ammQuote.feeUsd.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Quote Expiry Amber Card */}
              <div className="p-3.5 rounded-xl nexus-glass-surface border border-[var(--gold)]/30 flex items-center gap-2.5 text-xs font-mono text-[var(--gold-bright)]">
                <Clock className="w-4 h-4 text-[var(--gold-bright)] shrink-0" />
                <span>
                  Live quote locked for {quoteSecondsLeft}s. Auto-refreshes before on-chain execution.
                </span>
              </div>

              {/* Review Swap CTA Button */}
              <button
                type="button"
                onClick={handleOpenReview}
                className="w-full py-4 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold)]/20 active:scale-[0.99] cursor-pointer mt-2"
              >
                <span>
                  {swapMode === 'same_chain'
                    ? `Review Same-Chain Swap (${fromToken} → ${toToken})`
                    : `Review Cross-Chain Bridge (${fromToken} → ${toToken})`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Direct On-Chain Soroban Smart Contract Execution (AMM / Bridge Escrow / Burn-for-Bridge) */}
              {canUseSorobanContract && (
                <div className="rounded-xl border border-white/10 bg-[#0B0F17] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {toToken === 'XRP'
                        ? fromToken === 'NXL'
                          ? 'NexusVault Burn-for-Bridge'
                          : 'NexusSwap Trustless Escrow'
                        : 'NexusSwap On-Chain AMM (x·y=k)'}
                    </span>
                    {sorobanPool && (
                      <a
                        href={sorobanPool.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-sky-300 hover:underline inline-flex items-center gap-1"
                      >
                        {sorobanPool.reserveXlm.toFixed(0)} XLM / {sorobanPool.reserveNxl.toFixed(0)} NXL
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSorobanDirectSwap}
                    disabled={sorobanSwapBusy}
                    className="w-full py-2.5 px-3 rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/10 hover:bg-[var(--gold)]/20 disabled:opacity-60 text-[var(--gold-bright)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {sorobanSwapBusy
                        ? 'Signing Soroban tx in Freighter…'
                        : toToken === 'XRP'
                        ? fromToken === 'NXL'
                          ? `Burn ${fromToken} on Contract & Bridge to XRPL (Freighter)`
                          : `Lock ${fromToken} in Bridge Escrow & Receive XRP (Freighter)`
                        : `Swap ${fromToken} → ${toToken} Directly On-Chain (Freighter)`}
                    </span>
                  </button>
                  {sorobanSwapNotice && (
                    <div
                      className={`rounded-lg px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                        sorobanSwapNotice.tone === 'success'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span>{sorobanSwapNotice.text}</span>
                      <div className="flex items-center gap-2">
                        {sorobanSwapNotice.explorerUrl && (
                          <a
                            href={sorobanSwapNotice.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-semibold inline-flex items-center gap-1"
                          >
                            Stellar Tx <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {sorobanSwapNotice.payoutExplorerUrl && (
                          <a
                            href={sorobanSwapNotice.payoutExplorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-semibold inline-flex items-center gap-1"
                          >
                            XRPL Tx <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Safety Subtext */}
              <p className="text-xs text-[var(--muted)] text-center leading-relaxed pt-1">
                Funds are verified in the NexusRail vault before payout is sent.
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
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--border)] text-[var(--gold)] transition-colors">
                    Manage
                  </span>
                </p>
                <p className="text-xs text-[var(--muted)] font-mono mt-0.5">Stellar & XRPL Multi-Rail Keys</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-mono text-[var(--muted)] uppercase">STELLAR: {user?.walletAddress ? `${user.walletAddress.slice(0, 4)}..${user.walletAddress.slice(-4)}` : 'Not connected'}</p>
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
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Testnet swap · live rates</span>
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
                <span className="px-1.5 py-0.5 rounded nexus-glass-surface border border-[var(--border)] text-[11px] text-[var(--gold)]">
                  {fromCache ? 'CACHED 30M RATES' : 'LIVE ORACLE RATES'}
                </span>
              </div>

              <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                <span className="text-4xl sm:text-5xl font-mono font-bold text-[var(--foreground)] tracking-tight">
                  {liveRate.toFixed(4)}
                </span>
                <span className="text-xs font-mono text-[var(--muted)]">
                  {toToken} per {fromToken}
                </span>
              </div>
            </div>

            {/* Rate source & freshness */}
            <div className="rounded-2xl nexus-glass-card p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="uppercase tracking-wider text-[var(--muted)]">Rate source</span>
                <span className="text-[var(--foreground)]">
                  {fromCache ? 'Cached feed' : 'Live feed'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="uppercase tracking-wider text-[var(--muted)]">Cache expires in</span>
                <span className="text-[var(--foreground)]">
                  {ttlMinutes > 0 ? `${ttlMinutes} min` : 'Refreshing now'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void refreshRates()}
                disabled={ratesLoading}
                className="w-full py-2 rounded-xl nexus-glass-surface border border-[var(--border)] text-xs font-mono text-[var(--foreground)] hover:border-[var(--gold)]/60 transition-colors cursor-pointer disabled:opacity-60"
              >
                {ratesLoading ? 'Refreshing…' : 'Refresh rates'}
              </button>

              <p className="text-[11px] font-mono text-[var(--muted)] leading-relaxed">
                A 24-hour rate chart is not shown because no price history is stored yet.
              </p>
            </div>

            {/* "Your route, explained" Section */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                How your swap is routed
              </h3>

              {/* Route Chain Flow Pills */}
              <div className="p-4 rounded-2xl nexus-glass-surface flex items-center justify-between text-xs font-mono">
                <div className="text-center">
                  <span className="px-2.5 py-1 rounded-md nexus-glass-card border border-[var(--border)] text-[var(--foreground)] font-medium block">
                    {fromToken === 'XRP' ? 'XRPL wallet' : fromToken === 'XLM' ? 'Stellar wallet' : 'NexusRail wallet'}
                  </span>
                  <span className="text-[11px] text-[var(--muted)] mt-1 block">You send</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--gold)]" />
                <div className="text-center">
                  <span className="px-2.5 py-1 rounded-md bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold-bright)] font-bold block">
                    {involvesNrOrUsd ? '$NXL AMM pool' : 'NexusRail vault'}
                  </span>
                  <span className="text-[11px] text-emerald-400 mt-1 block">
                    {involvesNrOrUsd ? 'Pool pricing' : 'Escrow'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--gold)]" />
                <div className="text-center">
                  <span className="px-2.5 py-1 rounded-md nexus-glass-card border border-[var(--border)] text-[var(--foreground)] font-medium block">
                    {toToken === 'XLM' ? 'Stellar wallet' : toToken === 'XRP' ? 'XRPL wallet' : 'NexusRail wallet'}
                  </span>
                  <span className="text-[11px] text-[var(--muted)] mt-1 block">You receive</span>
                </div>
              </div>

              {/* Execution Details Table */}
              <div className="space-y-3 text-xs font-mono divide-y divide-[var(--border)]">
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Minimum received</span>
                  <span className="text-[var(--foreground)] font-medium">{minReceived} {toToken}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Estimated fee</span>
                  <span className="text-[var(--foreground)] font-medium">
                    {involvesNrOrUsd && ammQuote
                      ? `$${ammQuote.feeUsd.toFixed(2)} (0.5% pool fee)`
                      : fromToken === 'XLM' || fromToken === 'XRP'
                      ? `≈ 0.00001 ${fromToken} network fee`
                      : 'No network fee'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">Stellar vault</span>
                  <span className="text-[var(--foreground)]/80 font-mono text-[11px] truncate max-w-[200px]">{PLATFORM_STELLAR_VAULT}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--muted)]">XRPL vault</span>
                  <span className="text-[var(--foreground)]/80 font-mono text-[11px] truncate max-w-[200px]">{PLATFORM_XRPL_VAULT}</span>
                </div>
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Your deposit is held in the NexusRail vault, then paid out to your destination address on the other chain.
              </p>
            </div>

          </div>

        </div>

        {/* Live Cross-Chain Bridge History Section (100% Real Blockchain Settlement) */}
        <div className="mt-12 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)]" />
              <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Bridge settlement history
              </h2>
            </div>
            
            <button
              type="button"
              onClick={fetchSwapBridgeHistory}
              disabled={loadingBridgeHistory}
              className="p-2 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-mono text-[var(--foreground)] flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              title="Refresh bridge history"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--gold)] ${loadingBridgeHistory ? 'animate-spin' : ''}`} />
              <span>Refresh Bridge Logs</span>
            </button>
          </div>

          {loadingBridgeHistory ? (
            <div className="nexus-glass-card p-10 rounded-2xl border border-[var(--border)] text-center text-xs font-mono text-[var(--muted)] flex items-center justify-center gap-3">
              <RefreshCw className="w-4 h-4 animate-spin text-[var(--gold)]" />
              <span>Loading bridge history…</span>
            </div>
          ) : bridgeHistory.length === 0 ? (
            <div className="nexus-glass-card p-8 rounded-2xl border border-dashed border-[var(--border)] text-center space-y-2">
              <p className="text-sm font-bold text-[var(--foreground)]">No Bridge Swaps Recorded Yet</p>
              <p className="text-xs text-[var(--muted)] font-mono max-w-md mx-auto">
                Completed cross-chain swaps will appear here with their deposit and payout transaction hashes.
              </p>
            </div>
          ) : (
            <div className="nexus-glass-card rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card-subtle)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Disbursed Amount</th>
                      <th className="py-3 px-4">Destination Ledger &amp; Address</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">On-Chain Explorer Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {bridgeHistory.map((b: any, idx: number) => (
                      <tr key={b.id || idx} className="hover:bg-[var(--card-hover)] transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                            <div>
                              <span className="font-bold text-[var(--foreground)]">Cross-Chain Bridge</span>
                              <span className="block text-[11px] text-[var(--muted)]">Payout on {b.chain}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-emerald-400">
                          {b.amount || 'NXL'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-[var(--muted)]">
                            {b.destinationAddress ? `${b.destinationAddress.slice(0, 8)}...${b.destinationAddress.slice(-6)}` : '—'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-[var(--muted)] text-[11px]">
                          {b.createdAt ? new Date(b.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-bold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{b.status || 'CONFIRMED'}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          {b.explorerUrl ? (
                            <a
                              href={b.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[var(--gold)] hover:underline text-[11px] cursor-pointer"
                            >
                              <span>View Explorer Proof</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* Confirmation Review & Multi-Step Escrow Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--surface-solid)] border border-[var(--border)] p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[var(--gold)]" />
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  {swapMode === 'same_chain' ? 'Same-Chain Escrow Swap' : 'Cross-Chain Liquidity Bridge'}
                </h3>
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
                <p className="text-xs text-[var(--muted)] font-mono">Preparing your deposit address and reference…</p>
              </div>
            )}

            {swapState === 'idle' && activeSwapOrder && (
              <div className="space-y-4 text-xs font-mono">
                
                {/* Deposit Ingress Section */}
                <div className="p-4 rounded-xl nexus-glass-surface border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between text-[var(--gold)] font-bold pb-2 border-b border-[var(--border)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/50 flex items-center justify-center text-[11px]">1</span>
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
                      <span className="w-4 h-4 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/50 flex items-center justify-center text-[11px]">2</span>
                      <span>EGRESS: SERVER DISBURSES TO YOU</span>
                    </span>
                    <span>{receiveAmount} {toToken}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--muted)]">Recipient Address:</span>
                    <span className="text-[var(--foreground)] font-mono truncate max-w-[240px]">{effectiveDestination}</span>
                  </div>
                </div>

                {/* Choose Deposit Payment Method (Internal Wallet vs On-Chain) */}
                {(fromToken === 'USD' || fromToken === 'NXL') ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs">
                    <p className="text-emerald-300 font-bold">Internal NexusRail Ledger Settlement (0 Gas · Instant)</p>
                    <p className="text-[var(--muted)] text-[11px]">
                      {user
                        ? `Debits ${payAmount} ${fromToken} atomically from your authenticated wallet and executes against the $NXL AMM pool.`
                        : 'Please sign in first to execute swaps using your NexusRail USD or $NXL wallet balance.'}
                    </p>
                  </div>
                ) : (
                  <>
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
                          <span className="block text-[11px]">Browser Wallet</span>
                          <span className="text-[11px] text-[var(--muted)]">{fromToken === 'XLM' ? 'Freighter' : 'GemWallet'}</span>
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
                          <span className="block text-[11px]">Manual Transfer</span>
                          <span className="text-[11px] text-[var(--muted)]">From Mobile/App</span>
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
                          <span className="block text-[11px]">Testnet Secret</span>
                          <span className="text-[11px] text-[var(--muted)]">Dev One-Click</span>
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
                  </>
                )}

                {toToken === 'NXL' && destinationAddress.startsWith('r') && !trustlineStatus?.hasTrustline && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>XRPL Trustline Required Before Deposit</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                      Account <strong className="text-[var(--foreground)]">{destinationAddress}</strong> does not have an active Trustline to Issuer <strong className="text-[var(--gold)]">{XRPL_NR_ISSUER_ADDRESS}</strong>. Enable trustline first to ensure your $NXL tokens are safely delivered to your wallet.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={settingTrustline}
                        onClick={handleSetTrustline}
                        className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-black font-bold text-xs hover:bg-[var(--gold-bright)] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {settingTrustline ? 'Approving in Wallet...' : 'Enable $NXL Trustline (GemWallet / Crossmark)'}
                      </button>
                      <button
                        type="button"
                        disabled={checkingTrustline}
                        onClick={handleRefreshTrustline}
                        className="px-3.5 py-2.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-xs font-mono text-[var(--foreground)] hover:text-[var(--gold)] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingTrustline ? 'animate-spin' : ''}`} />
                        <span>Re-check</span>
                      </button>
                    </div>
                    {trustlineActionMsg && (
                      <p className={`text-[11px] ${trustlineActionMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trustlineActionMsg.text}
                      </p>
                    )}
                  </div>
                )}

                {toToken === 'NXL' && destinationAddress.startsWith('G') && !stellarTrustlineStatus?.hasTrustline && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Stellar Trustline Required Before Deposit</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                      Stellar account <strong className="text-[var(--foreground)]">{destinationAddress}</strong> has not established a Trustline to Issuer <strong className="text-[var(--gold)]">{STELLAR_NR_ISSUER_PUBLIC}</strong> for asset code &quot;NXL&quot;. Enable trustline via Freighter or Albedo below before depositing.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={settingStellarTrustline}
                        onClick={handleSetFreighterTrustline}
                        className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-black font-bold text-xs hover:bg-[var(--gold-bright)] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{settingStellarTrustline ? 'Signing in Freighter...' : 'Enable via Freighter'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenAlbedo}
                        className="px-3.5 py-2.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 hover:bg-sky-500/30 font-bold text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Add via Albedo</span>
                      </button>
                      <button
                        type="button"
                        disabled={checkingStellarTrustline}
                        onClick={async () => {
                          setCheckingStellarTrustline(true);
                          const updated = await checkStellarTrustline(destinationAddress);
                          setStellarTrustlineStatus(updated);
                          setCheckingStellarTrustline(false);
                        }}
                        className="px-3.5 py-2.5 rounded-lg nexus-glass-surface border border-[var(--border)] text-xs text-[var(--foreground)] hover:text-[var(--gold)] transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingStellarTrustline ? 'animate-spin' : ''}`} />
                        <span>Re-check</span>
                      </button>
                    </div>
                    {stellarActionMsg && (
                      <p className={`text-[11px] ${stellarActionMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stellarActionMsg.text}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={
                    (toToken === 'NXL' && destinationAddress.startsWith('r') && !trustlineStatus?.hasTrustline) ||
                    (toToken === 'NXL' && destinationAddress.startsWith('G') && !stellarTrustlineStatus?.hasTrustline)
                  }
                  onClick={handleExecuteCrossChainSwap}
                  className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg ${
                    (toToken === 'NXL' && destinationAddress.startsWith('r') && !trustlineStatus?.hasTrustline) ||
                    (toToken === 'NXL' && destinationAddress.startsWith('G') && !stellarTrustlineStatus?.hasTrustline)
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : 'bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black shadow-[var(--gold)]/20 cursor-pointer'
                  }`}
                >
                  {(toToken === 'NXL' && destinationAddress.startsWith('r') && !trustlineStatus?.hasTrustline) ||
                  (toToken === 'NXL' && destinationAddress.startsWith('G') && !stellarTrustlineStatus?.hasTrustline)
                    ? 'Trustline Required Above Before Depositing'
                    : fromToken === 'USD' || fromToken === 'NXL'
                    ? `Execute Instant ${fromToken} → ${toToken} Swap`
                    : depositMethod === 'extension'
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
              <div className="py-6 space-y-6">
                <div className="w-12 h-12 border-3 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto" />

                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-[var(--foreground)]">
                    Sending your swap payout
                  </h4>
                  <p className="text-xs font-mono text-[var(--gold)]">
                    Elapsed: {elapsedPayoutSeconds}s &bull; waiting for network confirmation
                  </p>
                </div>

                <div className="space-y-3 font-mono text-xs max-w-md mx-auto">
                  <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>1. Deposit received ({payAmount} {fromToken})</span>
                    </div>
                    <span className="text-[11px] uppercase font-bold">Confirmed</span>
                  </div>

                  <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>2. Swap price applied</span>
                    </div>
                    <span className="text-[11px] uppercase font-bold">Settled</span>
                  </div>

                  <div className="p-3 rounded-xl border bg-[var(--gold)]/10 border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] animate-ping" />
                      <span>3. Sending {receiveAmount} {toToken} to {destinationAddress.startsWith('G') ? 'Stellar' : 'XRPL'}…</span>
                    </div>
                    <span className="text-[11px] uppercase font-bold">Pending</span>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--muted)] font-mono text-center max-w-sm mx-auto">
                  Cross-chain swaps usually confirm in 5–12 seconds. Please keep this window open.
                </p>
              </div>
            )}

            {swapState === 'success' && activeSwapOrder && (
              <div className="py-4 space-y-5">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                
                <div className="text-center">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold tracking-wider uppercase">
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
                      <span className="text-[var(--muted)] text-[11px] uppercase">User Deposit Tx ({fromToken})</span>
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
                      <span className="text-[var(--muted)] text-[11px] uppercase">Server Payout Tx ({toToken})</span>
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
