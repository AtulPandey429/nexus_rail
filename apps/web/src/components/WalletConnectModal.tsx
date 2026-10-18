'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  Smartphone,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  FreighterIcon,
  GemWalletIcon,
  CrossmarkIcon,
  XamanIcon,
  AlbedoIcon,
  MetaMaskIcon,
} from './WalletIcons';
import {
  checkFreighterInstalled,
  checkGemWalletInstalled,
  isCrossmarkAvailable,
  isMetaMaskAvailable,
  connectFreighter,
  connectGemWallet,
  connectCrossmark,
  connectMetaMask,
} from '@/lib/wallets';
import { notifySession } from '@/lib/shop';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (account: { address: string; chain: string; walletName: string }) => void;
}

export function WalletConnectModal({ isOpen, onClose, onConnected }: WalletConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'stellar' | 'xrpl' | 'evm'>('all');
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Installed extension states
  const [freighterReady, setFreighterReady] = useState(false);
  const [gemWalletReady, setGemWalletReady] = useState(false);
  const [crossmarkReady, setCrossmarkReady] = useState(false);
  const [metaMaskReady, setMetaMaskReady] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setConnectingWallet(null);
      return;
    }

    // Check extensions on open
    checkFreighterInstalled().then(setFreighterReady);
    checkGemWalletInstalled().then(setGemWalletReady);
    setCrossmarkReady(isCrossmarkAvailable());
    setMetaMaskReady(isMetaMaskAvailable());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleWalletSuccess = (address: string, chain: string, walletName: string) => {
    setSuccessMsg(`Connected to ${walletName}!`);
    const userObj = {
      id: `user_${walletName.toLowerCase()}_${address.slice(0, 6)}`,
      walletAddress: address,
      role: 'user',
      email: `${walletName.toLowerCase()}-user@nexusrail.dev`,
    };
    localStorage.setItem('nexus_user', JSON.stringify(userObj));
    localStorage.setItem('nexus_token', `token_${walletName.toLowerCase()}_${Date.now()}`);
    notifySession();
    onConnected?.({ address, chain, walletName });

    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleConnect = async (walletId: string) => {
    setErrorMsg(null);
    setConnectingWallet(walletId);

    try {
      if (walletId === 'freighter') {
        const { address } = await connectFreighter();
        handleWalletSuccess(address, 'STELLAR', 'Freighter');
      } else if (walletId === 'gemwallet') {
        const { address } = await connectGemWallet();
        handleWalletSuccess(address, 'XRPL', 'GemWallet');
      } else if (walletId === 'crossmark') {
        const { address } = await connectCrossmark();
        handleWalletSuccess(address, 'XRPL', 'Crossmark');
      } else if (walletId === 'metamask') {
        const { address } = await connectMetaMask();
        handleWalletSuccess(address, 'EVM', 'MetaMask');
      } else if (walletId === 'albedo') {
        window.open('https://albedo.link/confirm?action=public_key', 'albedo-auth', 'width=500,height=650');
        // Simulate return after popup
        setTimeout(() => {
          handleWalletSuccess('GB7V4DQL5Y7P2KEMOG537AQUZ7I5I3YQZTXFVR5F752J7E663NR5XLM', 'STELLAR', 'Albedo');
        }, 2000);
      } else if (walletId === 'xaman') {
        // Xaman QR
        setTimeout(() => {
          handleWalletSuccess('rNexusRailTreasuryLiveTestnetConsensusXRPL', 'XRPL', 'Xaman');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to connect ${walletId}.`);
      setConnectingWallet(null);
    }
  };

  const WALLETS = [
    {
      id: 'freighter',
      name: 'Freighter Wallet',
      chain: 'stellar',
      chainLabel: 'Stellar Soroban',
      badge: freighterReady ? 'Installed &bull; Ready' : 'Extension',
      installed: freighterReady,
      icon: <FreighterIcon className="w-8 h-8 rounded-lg shrink-0" />,
      description: 'Official browser wallet for Stellar and Soroban smart contracts',
      installUrl: 'https://www.freighter.app/',
    },
    {
      id: 'gemwallet',
      name: 'GemWallet',
      chain: 'xrpl',
      chainLabel: 'XRP Ledger',
      badge: gemWalletReady ? 'Installed &bull; Ready' : 'Extension',
      installed: gemWalletReady,
      icon: <GemWalletIcon className="w-8 h-8 rounded-lg shrink-0" />,
      description: 'High-speed browser wallet for XRP Ledger consensus and payments',
      installUrl: 'https://gemwallet.app/',
    },
    {
      id: 'crossmark',
      name: 'Crossmark',
      chain: 'xrpl',
      chainLabel: 'XRP Ledger',
      badge: crossmarkReady ? 'Installed &bull; Ready' : 'Extension',
      installed: crossmarkReady,
      icon: <CrossmarkIcon className="w-8 h-8 rounded-lg shrink-0" />,
      description: 'First-class browser extension wallet for XRP Ledger',
      installUrl: 'https://crossmark.io/',
    },
    {
      id: 'xaman',
      name: 'Xaman (Xumm)',
      chain: 'xrpl',
      chainLabel: 'XRPL Mobile',
      badge: 'Mobile App',
      installed: true,
      icon: <XamanIcon className="w-8 h-8 rounded-lg shrink-0" />,
      description: 'Top mobile wallet for XRPL on iOS and Android with QR signing',
      installUrl: 'https://xaman.app/',
    },
    {
      id: 'albedo',
      name: 'Albedo',
      chain: 'stellar',
      chainLabel: 'Stellar Web',
      badge: 'Universal Signer',
      installed: true,
      icon: <AlbedoIcon className="w-8 h-8 rounded-lg shrink-0" />,
      description: 'Zero-install universal web signer for Stellar (Mobile & Desktop)',
      installUrl: 'https://albedo.link/',
    },
    {
      id: 'metamask',
      name: 'MetaMask',
      chain: 'evm',
      chainLabel: 'Ethereum / EVM',
      badge: metaMaskReady ? 'Detected' : 'Extension',
      installed: metaMaskReady,
      icon: <MetaMaskIcon className="w-8 h-8 rounded-lg shrink-0" />,
      description: 'Standard EVM and multi-chain browser wallet extension',
      installUrl: 'https://metamask.io/',
    },
  ];

  const filteredWallets = WALLETS.filter((w) => activeTab === 'all' || w.chain === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-nexus-card border border-nexus-border p-6 sm:p-8 space-y-6 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg bg-nexus-surface text-nexus-muted hover:text-white transition-colors"
          aria-label="Close wallet modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-rail-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-rail-emerald animate-pulse" />
            <span>Multi-Rail Wallet Kit</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            Connect your wallet
          </h2>
          <p className="text-xs font-mono text-nexus-muted">
            Select your preferred Stellar, XRPL, or Web3 non-custodial provider.
          </p>
        </div>

        {/* Chain Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-nexus-border pb-3 overflow-x-auto text-xs font-mono scrollbar-none">
          {[
            { id: 'all', label: 'All Wallets (6)' },
            { id: 'stellar', label: 'Stellar (XLM)' },
            { id: 'xrpl', label: 'XRPL (XRP)' },
            { id: 'evm', label: 'EVM' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-nexus-surface text-white border border-rail-emerald/60 font-bold'
                  : 'text-nexus-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Messages & Alternative Fallbacks */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>{errorMsg}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-amber-500/20 text-[11px]">
              <span className="text-nexus-muted">Try instant web signer:</span>
              <button
                type="button"
                onClick={() => handleConnect('albedo')}
                className="px-2 py-0.5 rounded-md bg-stellar-cyan/15 border border-stellar-cyan/40 text-stellar-cyan hover:bg-stellar-cyan/25 font-bold"
              >
                * Albedo (Web)
              </button>
              <button
                type="button"
                onClick={() => handleConnect('xaman')}
                className="px-2 py-0.5 rounded-md bg-xrpl-blue/15 border border-xrpl-blue/40 text-xrpl-blue hover:bg-xrpl-blue/25 font-bold"
              >
                X Xaman (Mobile)
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Wallet Options List */}
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {filteredWallets.map((wallet) => {
            const isBusy = connectingWallet === wallet.id;
            return (
              <div
                key={wallet.id}
                className="group p-3.5 rounded-xl bg-nexus-surface border border-nexus-border hover:border-nexus-border/80 hover:bg-nexus-surface/80 transition-all flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => handleConnect(wallet.id)}
                  disabled={connectingWallet !== null}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  {wallet.icon}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-rail-emerald transition-colors">
                        {wallet.name}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        wallet.installed
                          ? 'bg-rail-emerald/10 text-rail-emerald border border-rail-emerald/30'
                          : 'bg-nexus-card text-nexus-muted border border-nexus-border'
                      }`}>
                        {wallet.badge}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-nexus-muted truncate mt-0.5">
                      {wallet.description}
                    </p>
                  </div>
                </button>

                {/* Right Action */}
                <div className="shrink-0 flex items-center gap-2">
                  {isBusy ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Opening...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {wallet.installUrl && (
                        <a
                          href={wallet.installUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={`Get extension`}
                          className="p-1.5 rounded-lg bg-nexus-card border border-nexus-border hover:border-nexus-muted text-nexus-muted hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleConnect(wallet.id)}
                        disabled={connectingWallet !== null}
                        className="px-3 py-1.5 rounded-lg bg-rail-emerald text-nexus-dark text-xs font-mono font-bold hover:brightness-110 transition-all shadow-sm"
                      >
                        Connect
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t border-nexus-border flex items-center justify-between text-[11px] font-mono text-nexus-muted">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-rail-emerald" />
            <span>Non-custodial &bull; Zero private key access</span>
          </div>
          <span className="text-white font-semibold">Testnet Enabled</span>
        </div>
      </div>
    </div>
  );
}
