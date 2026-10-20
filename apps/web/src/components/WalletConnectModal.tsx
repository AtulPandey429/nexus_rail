'use client';

import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Search,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  QrCode,
  ExternalLink,
  ArrowLeft,
  Smartphone,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  FreighterIcon,
  GemWalletIcon,
  CrossmarkIcon,
  XamanIcon,
  AlbedoIcon,
  LobstrIcon,
} from './WalletIcons';
import {
  checkFreighterInstalled,
  checkGemWalletInstalled,
  isCrossmarkAvailable,
  connectFreighter,
  connectGemWallet,
  connectCrossmark,
  authenticateWalletWithChallenge,
  buildSep0007Uri,
} from '@/lib/wallets';
import { notifySession, readSession } from '@/lib/shop';

export interface WalletConnectedAccount {
  address: string;
  chain: 'stellar' | 'xrpl';
  walletName: string;
}

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (account: WalletConnectedAccount) => void;
  initialNetwork?: 'stellar' | 'xrpl';
}

interface WalletOption {
  id: string;
  name: string;
  subtitle: string;
  chain: 'stellar' | 'xrpl';
  icon: React.ReactNode;
  installed: boolean;
  installUrl: string;
  type: 'extension' | 'web' | 'mobile';
  description: string;
}

export function WalletConnectModal({
  isOpen,
  onClose,
  onConnected,
  initialNetwork,
}: WalletConnectModalProps) {
  // Network selection tabs: 'stellar' or 'xrpl'
  const [activeTab, setActiveTab] = useState<'stellar' | 'xrpl'>('stellar');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Installed extension states
  const [freighterReady, setFreighterReady] = useState(false);
  const [gemWalletReady, setGemWalletReady] = useState(false);
  const [crossmarkReady, setCrossmarkReady] = useState(false);

  // Last-connected wallet from localStorage
  const [lastWallet, setLastWallet] = useState<{
    network: 'stellar' | 'xrpl';
    provider: string;
    address: string;
    connectedAt: string;
  } | null>(null);

  // Mobile QR Code state (for Xaman and LOBSTR SEP-0007)
  const [activeQrModal, setActiveQrModal] = useState<{
    walletName: string;
    chain: 'stellar' | 'xrpl';
    qrDataUrl: string;
    deepLinkUrl: string;
    instructions: string;
  } | null>(null);

  // Educational guide state
  const [showGuide, setShowGuide] = useState(false);

  // Initialize and check extension availability
  useEffect(() => {
    if (!isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setConnectingWallet(null);
      setActiveQrModal(null);
      setShowGuide(false);
      return;
    }

    // Read stored last wallet
    try {
      const stored = localStorage.getItem('nexus_last_wallet');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.network && parsed?.provider && parsed?.address) {
          setLastWallet(parsed);
          if (!initialNetwork) {
            setActiveTab(parsed.network);
          }
        }
      }
    } catch {
      // quiet fallback
    }

    if (initialNetwork) {
      setActiveTab(initialNetwork);
    }

    // Probe native extensions
    checkFreighterInstalled().then(setFreighterReady);
    checkGemWalletInstalled().then(setGemWalletReady);
    setCrossmarkReady(isCrossmarkAvailable());
  }, [isOpen, initialNetwork]);

  // Persist last connected wallet and synchronize with backend profile
  const recordSuccessfulConnection = async (account: WalletConnectedAccount) => {
    const record = {
      network: account.chain,
      provider: account.walletName,
      address: account.address,
      connectedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('nexus_last_wallet', JSON.stringify(record));
      setLastWallet(record);
    } catch {}

    // If user is already authenticated with session token, link wallet on backend
    const session = readSession();
    if (session.token) {
      try {
        await fetch('/api/v1/user/wallets/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            walletAddress: account.address,
            chain: account.chain,
            provider: account.walletName,
          }),
        });
      } catch (err) {
        console.warn('Could not auto-link wallet to user profile:', err);
      }
    }

    onConnected?.(account);
  };

  // Finalize wallet session and cryptographic verification
  const handleWalletSuccess = async (address: string, chain: 'stellar' | 'xrpl', walletName: string) => {
    setSuccessMsg(`Authorizing session with ${walletName}...`);
    try {
      const auth = await authenticateWalletWithChallenge({
        address,
        chain,
        walletName,
      });

      localStorage.setItem('nexus_user', JSON.stringify(auth.user));
      localStorage.setItem('nexus_token', auth.token);
      notifySession();

      const account: WalletConnectedAccount = { address, chain, walletName };
      await recordSuccessfulConnection(account);

      setSuccessMsg(`Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(`Authentication failed: ${err.message || 'Signature rejected'}`);
    } finally {
      setConnectingWallet(null);
    }
  };

  // Connect native wallet
  const handleConnectWallet = async (wallet: WalletOption) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setConnectingWallet(wallet.id);

    try {
      if (wallet.id === 'freighter') {
        if (!freighterReady) {
          window.open(wallet.installUrl, '_blank');
          setErrorMsg('Freighter extension not detected. Opening install page...');
          setConnectingWallet(null);
          return;
        }
        const { address } = await connectFreighter();
        await handleWalletSuccess(address, 'stellar', 'Freighter');
      } else if (wallet.id === 'gemwallet') {
        if (!gemWalletReady) {
          window.open(wallet.installUrl, '_blank');
          setErrorMsg('GemWallet extension not detected. Opening install page...');
          setConnectingWallet(null);
          return;
        }
        const { address } = await connectGemWallet();
        await handleWalletSuccess(address, 'xrpl', 'GemWallet');
      } else if (wallet.id === 'crossmark') {
        if (!crossmarkReady) {
          window.open(wallet.installUrl, '_blank');
          setErrorMsg('Crossmark extension not detected. Opening install page...');
          setConnectingWallet(null);
          return;
        }
        const { address } = await connectCrossmark();
        await handleWalletSuccess(address, 'xrpl', 'Crossmark');
      } else if (wallet.id === 'albedo') {
        // Universal web signer without installing any browser extensions
        const albedoUrl = 'https://albedo.link/confirm?action=public_key';
        const popup = window.open(albedoUrl, 'albedo_auth', 'width=500,height=650');

        const messageHandler = async (event: MessageEvent) => {
          if (event.origin !== 'https://albedo.link') return;
          if (event.data?.albedo_intent && event.data?.pubkey) {
            window.removeEventListener('message', messageHandler);
            const pubkey = String(event.data.pubkey).trim();
            await handleWalletSuccess(pubkey, 'stellar', 'Albedo');
          }
        };

        window.addEventListener('message', messageHandler);

        // Fallback polling if popup is closed manually
        const checkClosedInterval = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosedInterval);
            window.removeEventListener('message', messageHandler);
            setConnectingWallet(null);
          }
        }, 1000);
      } else if (wallet.id === 'xaman') {
        // XRPL Mobile App: Generate QR Code and Deep Link
        const deepLink = 'https://xumm.app/detect/xapp:nexusrail';
        const qr = await QRCode.toDataURL(deepLink, { margin: 1, width: 240 });
        setActiveQrModal({
          walletName: 'Xaman (formerly Xumm)',
          chain: 'xrpl',
          qrDataUrl: qr,
          deepLinkUrl: deepLink,
          instructions: 'Scan with the Xaman app on iOS or Android to connect your XRPL account.',
        });
        setConnectingWallet(null);
      } else if (wallet.id === 'lobstr') {
        // Stellar Mobile App: Generate SEP-0007 QR code & deep link
        const sep0007Uri = buildSep0007Uri({
          destination: 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC',
          amount: '0.00001',
          memo: 'NEXUSCONNECT',
        });
        const qr = await QRCode.toDataURL(sep0007Uri, { margin: 1, width: 240 });
        setActiveQrModal({
          walletName: 'LOBSTR (Stellar)',
          chain: 'stellar',
          qrDataUrl: qr,
          deepLinkUrl: sep0007Uri,
          instructions: 'Scan with LOBSTR or any SEP-0007 compliant Stellar mobile wallet to connect.',
        });
        setConnectingWallet(null);
      }
    } catch (err: any) {
      if (err?.message?.includes('cancel') || err?.message?.includes('decline') || err?.message?.includes('reject')) {
        setErrorMsg('Wallet authorization was cancelled by the user.');
      } else {
        setErrorMsg(err.message || `Failed to connect ${wallet.name}.`);
      }
      setConnectingWallet(null);
    }
  };

  // Supported Wallets Catalog (strictly categorized)
  const STELLAR_WALLETS: WalletOption[] = [
    {
      id: 'freighter',
      name: 'Freighter',
      subtitle: 'Official browser extension',
      chain: 'stellar',
      icon: <FreighterIcon className="w-10 h-10 rounded-xl shrink-0" />,
      installed: freighterReady,
      installUrl: 'https://www.freighter.app/',
      type: 'extension',
      description: 'Official non-custodial browser wallet for Stellar and Soroban contracts',
    },
    {
      id: 'albedo',
      name: 'Albedo',
      subtitle: 'Web signer · No installation needed',
      chain: 'stellar',
      icon: <AlbedoIcon className="w-10 h-10 rounded-xl shrink-0 border border-gray-700/50" />,
      installed: true,
      installUrl: 'https://albedo.link/',
      type: 'web',
      description: 'Universal zero-install web signer for Stellar (Mobile & Desktop)',
    },
    {
      id: 'lobstr',
      name: 'LOBSTR',
      subtitle: 'Mobile wallet · SEP-0007 QR',
      chain: 'stellar',
      icon: <LobstrIcon className="w-10 h-10 rounded-xl shrink-0" />,
      installed: false,
      installUrl: 'https://lobstr.co/',
      type: 'mobile',
      description: 'Leading mobile and web wallet for Stellar XLM and Soroban assets',
    },
  ];

  const XRPL_WALLETS: WalletOption[] = [
    {
      id: 'gemwallet',
      name: 'GemWallet',
      subtitle: 'Official browser extension',
      chain: 'xrpl',
      icon: <GemWalletIcon className="w-10 h-10 rounded-xl shrink-0" />,
      installed: gemWalletReady,
      installUrl: 'https://gemwallet.app/',
      type: 'extension',
      description: 'High-speed non-custodial browser wallet for XRP Ledger payments & assets',
    },
    {
      id: 'crossmark',
      name: 'Crossmark',
      subtitle: 'Browser extension',
      chain: 'xrpl',
      icon: <CrossmarkIcon className="w-10 h-10 rounded-xl shrink-0" />,
      installed: crossmarkReady,
      installUrl: 'https://crossmark.io/',
      type: 'extension',
      description: 'First-class browser extension wallet for XRP Ledger dApps',
    },
    {
      id: 'xaman',
      name: 'Xaman (formerly Xumm)',
      subtitle: 'Mobile app · QR & Deep Link',
      chain: 'xrpl',
      icon: <XamanIcon className="w-10 h-10 rounded-xl shrink-0" />,
      installed: false,
      installUrl: 'https://xaman.app/',
      type: 'mobile',
      description: 'Leading self-custody mobile wallet for XRP Ledger ecosystem',
    },
  ];

  const activeWallets = activeTab === 'stellar' ? STELLAR_WALLETS : XRPL_WALLETS;

  const filteredWallets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeWallets;
    return activeWallets.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.subtitle.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q)
    );
  }, [searchQuery, activeWallets]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md p-4 flex min-h-screen items-center justify-center animate-in fade-in duration-200">
      <div className="nexus-glass-card w-full max-w-lg my-auto rounded-3xl border border-[var(--border-highlight)] p-5 sm:p-7 space-y-5 shadow-2xl relative text-[var(--foreground)]">
        {/* Glow backdrop accents */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--gold)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[var(--gold)]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Bar */}
        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2">
              {activeQrModal && (
                <button
                  type="button"
                  onClick={() => setActiveQrModal(null)}
                  className="p-1 -ml-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  aria-label="Back to wallet selection"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                {activeQrModal ? `Connect ${activeQrModal.walletName}` : 'Connect Wallet'}
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {activeQrModal
                ? 'Scan the QR code with your mobile app or use the deep link'
                : 'Select your blockchain network and authorize with your verified wallet'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-highlight)] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notifications & Status Alerts */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-mono font-medium">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-mono">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-mono text-rose-400 hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SUBVIEW: MOBILE QR CODE / DEEP LINK PAIRING */}
        {activeQrModal ? (
          <div className="space-y-4 py-2 text-center animate-in fade-in duration-150">
            <div className="p-4 bg-white rounded-2xl inline-block shadow-lg mx-auto border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeQrModal.qrDataUrl}
                alt={`${activeQrModal.walletName} QR Code`}
                className="w-48 h-48 mx-auto"
              />
            </div>

            <p className="text-xs text-[var(--muted)] max-w-sm mx-auto leading-relaxed">
              {activeQrModal.instructions}
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
              <a
                href={activeQrModal.deepLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 rounded-xl bg-[var(--gold)] text-[#08090C] font-mono text-xs font-bold hover:bg-[var(--gold-bright)] transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open in App</span>
              </a>

              <button
                type="button"
                onClick={() => setActiveQrModal(null)}
                className="py-2.5 px-4 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--foreground)] font-mono text-xs hover:border-[var(--border-highlight)] transition-colors"
              >
                Choose another wallet
              </button>
            </div>
          </div>
        ) : (
          /* MAIN VIEW: SEPARATE NETWORK TABS & WALLET CATALOG */
          <>
            {/* LAST-CONNECTED WALLET RECOMMENDED QUICK-CONNECT */}
            {lastWallet && (
              <div className="p-3.5 rounded-2xl nexus-glass-card border border-[var(--gold)]/40 bg-[var(--gold)]/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/20 text-[var(--gold)] flex items-center justify-center shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--gold)] font-bold">
                        Recently Used
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--card-subtle)] text-[var(--muted)] font-mono uppercase">
                        {lastWallet.network}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--foreground)] truncate">
                      {lastWallet.provider} ({lastWallet.address.slice(0, 6)}...{lastWallet.address.slice(-4)})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(connectingWallet)}
                  onClick={() => {
                    const matched = (lastWallet.network === 'stellar' ? STELLAR_WALLETS : XRPL_WALLETS).find(
                      (w) => w.name.toLowerCase() === lastWallet.provider.toLowerCase() || w.id === lastWallet.provider.toLowerCase()
                    );
                    if (matched) {
                      handleConnectWallet(matched);
                    } else {
                      setActiveTab(lastWallet.network);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[var(--gold)] text-[#08090C] text-xs font-mono font-bold hover:bg-[var(--gold-bright)] transition-colors shrink-0 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  Reconnect
                </button>
              </div>
            )}

            {/* TWO DEDICATED NETWORK TABS (Requirement 1) */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('stellar');
                  setSearchQuery('');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'stellar'
                    ? 'bg-[var(--card)] text-[var(--gold)] shadow-md border border-[var(--border-highlight)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <span>Stellar</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-solid)] opacity-80">
                  XLM
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('xrpl');
                  setSearchQuery('');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'xrpl'
                    ? 'bg-[var(--card)] text-[var(--gold)] shadow-md border border-[var(--border-highlight)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <span>XRP Ledger</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-solid)] opacity-80">
                  XRP
                </span>
              </button>
            </div>

            {/* Search Filter Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'stellar' ? 'Stellar' : 'XRPL'} wallets...`}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder-[var(--muted)]/60 focus:outline-none focus:border-[var(--gold)] transition-colors font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Compatible Wallets Catalog */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredWallets.map((wallet) => {
                const isConnecting = connectingWallet === wallet.id;
                return (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => handleConnectWallet(wallet)}
                    disabled={Boolean(connectingWallet)}
                    className="w-full p-3 rounded-2xl bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--border-highlight)] transition-all flex items-center justify-between group text-left shadow-sm cursor-pointer disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                        {wallet.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--gold)] transition-colors truncate">
                            {wallet.name}
                          </h4>
                          {wallet.type === 'mobile' && (
                            <span className="text-[10px] font-mono text-[var(--muted)] px-1.5 py-0.2 rounded bg-[var(--card)] border border-[var(--border)]">
                              QR / App
                            </span>
                          )}
                          {wallet.type === 'web' && (
                            <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                              Instant Web
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted)] font-mono truncate mt-0.5">
                          {wallet.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {wallet.installed && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-solid)] border border-[var(--border)] text-[11px] font-mono text-[var(--foreground)] font-medium">
                          Installed
                        </span>
                      )}

                      {isConnecting ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-[var(--gold)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--foreground)] group-hover:translate-x-0.5 transition-all" />
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredWallets.length === 0 && (
                <div className="p-8 text-center text-xs font-mono text-[var(--muted)] space-y-2">
                  <p>No compatible wallets match &quot;{searchQuery}&quot;</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[var(--gold)] hover:underline cursor-pointer"
                  >
                    Reset search
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Security Assurance Note & Guide */}
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs font-mono">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>New to Web3 wallets?</span>
              </button>

              <div className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>Cryptographically verified</span>
              </div>
            </div>

            {/* Informational Guide Drawer */}
            {showGuide && (
              <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] text-xs text-[var(--muted)] space-y-2.5 leading-relaxed animate-in fade-in duration-200">
                <p className="font-bold text-[var(--foreground)]">How Wallet Authentication Works</p>
                <p>
                  NexusRail uses genuine non-custodial cryptographic signatures to authenticate your identity without passwords or mock IDs. We never request private keys or seed phrases.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                  <a
                    href="https://www.freighter.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--gold)] text-[var(--foreground)] flex items-center justify-between"
                  >
                    <span>Freighter (XLM)</span>
                    <ExternalLink className="w-3 h-3 text-[var(--gold)]" />
                  </a>
                  <a
                    href="https://gemwallet.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--gold)] text-[var(--foreground)] flex items-center justify-between"
                  >
                    <span>GemWallet (XRP)</span>
                    <ExternalLink className="w-3 h-3 text-[var(--gold)]" />
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
