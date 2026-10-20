'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  Clock,
  X,
  ShieldCheck,
  RotateCcw,
  Wallet,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Coins,
  Check,
  AlertCircle,
  Receipt,
  CreditCard,
  Layers,
  Sparkles,
} from 'lucide-react';
import { RobotMascot } from './RobotMascot';
import { useTheme } from './ThemeProvider';
import { WalletConnectModal } from './WalletConnectModal';
import { readSession, onSessionChange } from '@/lib/shop';

export interface ProposalData {
  proposalId: string;
  action?: 'PURCHASE_ORDER' | 'PAY_ORDER' | 'DEPOSIT_FUNDS';
  title: string;
  sku?: string;
  qty?: number;
  priceCents: number;
  networkFeeCents?: number;
  paymentRail?: string;
  walletAddress?: string;
  itemsSummary?: string;
  orderNumber?: string;
  orderId?: string;
  status?: 'PROPOSED' | 'CONFIRMED' | 'REJECTED';
  executed?: boolean;
  rejected?: boolean;
  txHash?: string;
  error?: string;
}

export interface OrderItemSummary {
  sku?: string;
  title: string;
  qty: number;
  unit_price_cents?: number;
}

export interface OrderData {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'UNDERPAID' | string;
  totalCents: number;
  rail: string;
  txHash?: string;
  createdAt: string;
  items: OrderItemSummary[];
}

export interface HoldingsData {
  walletAddress: string;
  totalUsd: number;
  rates?: {
    xrpUsd: number;
    xlmUsd: number;
  };
  assets: Array<{
    symbol: string;
    name: string;
    type: string;
    amount: string;
    usdValue: number;
    rail: string;
  }>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  proposal?: ProposalData;
  orders?: OrderData[];
  holdings?: HoldingsData;
  requiresWallet?: boolean;
}

export function AgentDeskPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [input, setInput] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_1',
      sender: 'agent',
      text: 'Greetings. I am your NexusRail Autonomous Commerce Agent. You can prompt me to add orders, view order history, authorize payments, or inspect your multi-rail wallet balance. What would you like to do?',
    },
  ]);

  const [loading, setLoading] = useState(false);
  const confirmedIds = useRef(new Set<string>());
  const rejectedIds = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync session on mount and change
  useEffect(() => {
    const sync = () => {
      const sess = readSession();
      setSessionUser(sess.user);
    };
    sync();
    return onSessionChange(sync);
  }, []);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [isOpen, messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, sender: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const token = localStorage.getItem('nexus_token');
    if (!token) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'agent',
          text: 'To execute agent actions, view orders, or inspect live balances, please connect your wallet or sign in first.',
          requiresWallet: true,
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: query }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'agent',
            text: 'Your session has expired. Please reconnect your wallet to continue.',
            requiresWallet: true,
          },
        ]);
        return;
      }

      if (data.success) {
        const proposalObj: ProposalData | undefined = data.proposal
          ? {
              proposalId: data.proposal.proposalId,
              action: data.proposal.action,
              title: data.proposal.payload?.title || 'Proposed Transaction',
              sku: data.proposal.payload?.sku,
              qty: data.proposal.payload?.qty,
              priceCents: data.proposal.payload?.priceCents || 0,
              networkFeeCents: data.proposal.payload?.networkFeeCents || 0,
              paymentRail: data.proposal.payload?.paymentRail,
              walletAddress: data.proposal.payload?.walletAddress,
              itemsSummary: data.proposal.payload?.itemsSummary,
              orderNumber: data.proposal.payload?.orderNumber,
              orderId: data.proposal.payload?.orderId,
            }
          : undefined;

        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'agent',
            text: data.reply,
            proposal: proposalObj,
            orders: data.orders,
            holdings: data.holdings,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'agent',
            text: data.reply || data.error || 'The assistant encountered an issue processing your request.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'agent',
          text: 'The autonomous assistant service is currently unreachable. Please verify your connection.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handler for approving a proposal
  const handleApprove = async (proposalId: string) => {
    if (confirmedIds.current.has(proposalId) || rejectedIds.current.has(proposalId)) return;
    confirmedIds.current.add(proposalId);
    setLoading(true);

    const token = localStorage.getItem('nexus_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/agent/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proposalId }),
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        confirmedIds.current.delete(proposalId);
        const errMsg = data.error || 'Authorization failed.';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.proposal?.proposalId === proposalId
              ? { ...msg, proposal: { ...msg.proposal!, error: errMsg } }
              : msg
          )
        );
        return;
      }

      const txHash = data.txHash || data.order?.tx_hash;
      const orderNumber = data.order?.order_number;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.proposal?.proposalId === proposalId
            ? {
                ...msg,
                proposal: {
                  ...msg.proposal!,
                  executed: true,
                  txHash,
                  orderNumber: orderNumber || msg.proposal!.orderNumber,
                  error: undefined,
                },
              }
            : msg
        )
      );
    } catch {
      confirmedIds.current.delete(proposalId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.proposal?.proposalId === proposalId
            ? { ...msg, proposal: { ...msg.proposal!, error: 'Network error executing proposal.' } }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Handler for rejecting a proposal
  const handleReject = async (proposalId: string) => {
    if (confirmedIds.current.has(proposalId) || rejectedIds.current.has(proposalId)) return;
    rejectedIds.current.add(proposalId);

    const token = localStorage.getItem('nexus_token');
    if (token) {
      fetch('/api/v1/agent/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proposalId }),
      }).catch(console.error);
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.proposal?.proposalId === proposalId
          ? {
              ...msg,
              proposal: {
                ...msg.proposal!,
                rejected: true,
                error: undefined,
              },
            }
          : msg
      )
    );
  };

  return (
    <div className="fixed top-16 inset-x-0 bottom-0 z-40 flex flex-col bg-[var(--background)] overscroll-contain animate-in fade-in duration-200">
      {/* Wallet Connect Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={(acc) => {
          setIsWalletModalOpen(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `w_${Date.now()}`,
              sender: 'agent',
              text: `Wallet connected successfully (${acc.walletName} · ${acc.address.slice(0, 8)}...). How can I assist you now?`,
            },
          ]);
        }}
      />

      {/* TOP HEADER */}
      <div className="h-16 px-4 sm:px-8 border-b border-[var(--border)] bg-[var(--surface-solid)]/90 backdrop-blur-xl flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* Back button to close chat and wrap into floating bot icon */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-xs font-mono text-[var(--foreground)] transition-all cursor-pointer shadow-sm group"
            title="Minimize to Bot Icon"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--gold)] group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-bold">Back</span>
          </button>

          <div className="w-10 h-10 rounded-2xl bg-[var(--surface-solid)] border border-[var(--gold)]/40 flex items-center justify-center overflow-hidden shadow-md shrink-0 p-1">
            <RobotMascot isLight={isLight} className="w-full h-auto" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base text-[var(--foreground)] tracking-tight">
                NexusRail AI Agent Desk
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Autonomous Assistant</span>
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)] font-mono">
              Deterministic Zero-Trust Sandbox · Every state mutation requires your explicit confirmation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessionUser?.walletAddress ? (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono text-[var(--foreground)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{sessionUser.walletAddress.slice(0, 6)}...{sessionUser.walletAddress.slice(-4)}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsWalletModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[var(--gold)] text-[#08090C] text-xs font-bold font-mono hover:bg-[var(--gold-bright)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              confirmedIds.current.clear();
              rejectedIds.current.clear();
              setMessages([
                {
                  id: `msg_${Date.now()}`,
                  sender: 'agent',
                  text: 'Conversation reset. I can help you add orders, view orders, pay for pending orders, or check multi-rail balances.',
                },
              ]);
            }}
            title="Reset conversation"
            className="p-2 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hidden sm:flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Agent Desk"
            className="p-2 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-highlight)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* SCROLLABLE MESSAGE STREAM */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-6 scrollbar-thin scrollbar-thumb-[var(--border)]">
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {/* Safety Sandbox Callout */}
          <div className="p-4 rounded-2xl nexus-glass-card border border-[var(--border)] bg-[var(--card-subtle)] text-xs text-[var(--muted)] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[var(--foreground)] font-mono uppercase tracking-wider text-[11px]">
                Deterministic Safety Sandbox
              </span>
              <p className="leading-relaxed text-[11px]">
                Actions that change data or move funds (Add Order, Payment) will never execute automatically. The agent presents a Confirmation Card with item, amount, network fee, and wallet details. Execution requires your explicit click on [Approve].
              </p>
            </div>
          </div>

          {/* Messages Loop */}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'} space-y-2`}
            >
              {m.sender === 'agent' ? (
                <div className="flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%]">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0 mt-0.5 shadow-sm p-0.5">
                    <RobotMascot isLight={isLight} className="w-full h-auto" />
                  </div>
                  <div className="space-y-3 w-full">
                    {/* Message Text Bubble */}
                    <div className="nexus-glass-card border border-[var(--border)] text-[var(--foreground)] p-4 rounded-3xl rounded-tl-none shadow-sm text-sm leading-relaxed whitespace-pre-line">
                      {m.text}
                    </div>

                    {/* Connect Wallet Callout */}
                    {m.requiresWallet && (
                      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--gold)]/30 flex items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <Wallet className="w-4 h-4 text-[var(--gold)] shrink-0" />
                          <span className="text-xs font-mono text-[var(--foreground)] font-semibold">
                            Wallet connection required to proceed
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsWalletModalOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-[var(--gold)] text-[#08090C] font-bold text-xs font-mono hover:bg-[var(--gold-bright)] transition-colors cursor-pointer shrink-0 shadow-sm"
                        >
                          Connect Wallet
                        </button>
                      </div>
                    )}

                    {/* Orders List Rendering (Read-only, Instant Action) */}
                    {m.orders && m.orders.length > 0 && (
                      <div className="p-4 rounded-3xl nexus-glass-card border border-[var(--border)] space-y-3 w-full shadow-lg">
                        <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] border-b border-[var(--border)] pb-2">
                          <span className="flex items-center gap-1.5 font-bold text-[var(--foreground)]">
                            <Receipt className="w-4 h-4 text-[var(--gold)]" />
                            <span>Your Order History</span>
                          </span>
                          <span>{m.orders.length} order(s)</span>
                        </div>

                        <div className="space-y-2">
                          {m.orders.map((ord) => {
                            const isPaid = ord.status === 'PAID';
                            const dateStr = ord.createdAt
                              ? new Date(ord.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '';

                            return (
                              <div
                                key={ord.id}
                                className="p-3.5 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[var(--border-highlight)] transition-colors"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-sm text-[var(--foreground)]">
                                      {ord.orderNumber}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                                        isPaid
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                      }`}
                                    >
                                      {ord.status}
                                    </span>
                                    <span className="text-[11px] font-mono text-[var(--muted)]">
                                      {ord.rail}
                                    </span>
                                  </div>
                                  <div className="text-xs text-[var(--muted)] font-mono">
                                    {ord.items?.map((it) => `${it.qty}x ${it.title}`).join(', ') || 'Item'}
                                    {dateStr ? ` · ${dateStr}` : ''}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                  <span className="font-mono font-bold text-sm text-[var(--gold)]">
                                    ${(ord.totalCents / 100).toFixed(2)} USD
                                  </span>

                                  {isPaid ? (
                                    <a
                                      href={`/receipt?orderId=${ord.orderNumber}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2.5 py-1 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[11px] font-mono text-[var(--foreground)] flex items-center gap-1 transition-colors"
                                    >
                                      <span>Receipt</span>
                                      <ExternalLink className="w-3 h-3 text-[var(--muted)]" />
                                    </a>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSend(`Pay for order #${ord.orderNumber}`)}
                                      className="px-3 py-1 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[#08090C] text-[11px] font-bold font-mono transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                                    >
                                      <CreditCard className="w-3 h-3" />
                                      <span>Pay Now</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Holdings / Balance Rendering (Read-only, Instant Action) */}
                    {m.holdings && (
                      <div className="p-5 rounded-3xl nexus-glass-card border border-[var(--border)] space-y-4 w-full shadow-lg">
                        <div className="flex items-center justify-between text-xs font-mono border-b border-[var(--border)] pb-3">
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-[var(--gold)]" />
                            <span className="font-bold text-[var(--foreground)]">
                              Multi-Rail Holdings
                            </span>
                          </div>
                          <span className="text-[11px] text-[var(--muted)]">
                            {m.holdings.walletAddress.slice(0, 10)}...
                          </span>
                        </div>

                        {/* Total Portfolio Valuation */}
                        <div className="p-4 rounded-2xl bg-[var(--card-subtle)] border border-[var(--border)] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-[var(--muted)] block">
                              Total Portfolio Valuation
                            </span>
                            <span className="text-2xl font-black font-mono text-[var(--gold)]">
                              ${m.holdings.totalUsd.toFixed(2)} USD
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold">
                            Live Oracle Synced
                          </span>
                        </div>

                        {/* Breakdown per Asset */}
                        <div className="space-y-2">
                          {m.holdings.assets.map((asset) => (
                            <div
                              key={asset.symbol}
                              className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between text-xs font-mono"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] flex items-center justify-center font-bold text-[var(--gold)] text-[11px]">
                                  {asset.symbol.slice(0, 3)}
                                </span>
                                <div>
                                  <div className="font-bold text-[var(--foreground)]">
                                    {asset.name}
                                  </div>
                                  <div className="text-[10px] text-[var(--muted)]">
                                    {asset.rail}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-[var(--foreground)]">
                                  {asset.amount}
                                </div>
                                <div className="text-[10px] text-[var(--muted)]">
                                  ≈ ${asset.usdValue.toFixed(2)} USD
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CONFIRMATION CARD (Approval Flow: Crucial Safety Check) */}
                    {m.proposal && (
                      <div className="p-5 rounded-3xl nexus-glass-card border border-[var(--gold)]/50 space-y-4 max-w-lg w-full shadow-2xl">
                        {/* Proposal Card Header */}
                        <div className="flex items-center justify-between text-xs text-[var(--gold)] font-mono border-b border-[var(--border)] pb-3">
                          <span className="flex items-center gap-1.5 font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {m.proposal.action === 'PAY_ORDER'
                                ? 'Payment Authorization Lock'
                                : 'Order Proposal Lock'}
                            </span>
                          </span>
                          <span className="opacity-70 text-[10px]">{m.proposal.proposalId}</span>
                        </div>

                        {/* Proposal Details Grid */}
                        <div className="space-y-2 text-xs font-mono">
                          <div className="p-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] space-y-1">
                            <span className="text-[10px] text-[var(--muted)] uppercase block">
                              {m.proposal.action === 'PAY_ORDER' ? 'Payment Reference' : 'Item Description'}
                            </span>
                            <div className="font-bold text-sm text-[var(--foreground)]">
                              {m.proposal.qty ? `${m.proposal.qty}x ` : ''}
                              {m.proposal.title}
                            </div>
                            {m.proposal.itemsSummary && (
                              <div className="text-[11px] text-[var(--muted)]">
                                Items: {m.proposal.itemsSummary}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)]">
                              <span className="text-[10px] text-[var(--muted)] uppercase block">
                                Amount Due
                              </span>
                              <span className="font-bold text-base text-[var(--gold)]">
                                ${(m.proposal.priceCents / 100).toFixed(2)} USD
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)]">
                              <span className="text-[10px] text-[var(--muted)] uppercase block">
                                Network Fee
                              </span>
                              <span className="font-bold text-xs text-[var(--foreground)]">
                                {m.proposal.networkFeeCents && m.proposal.networkFeeCents > 0
                                  ? `$${(m.proposal.networkFeeCents / 100).toFixed(2)} USD`
                                  : '$0.00 (Gasless)'}
                              </span>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[var(--card-subtle)] border border-[var(--border)] flex items-center justify-between text-[11px]">
                            <span className="text-[var(--muted)]">Signer / Wallet</span>
                            <span className="font-mono text-[var(--foreground)] font-semibold">
                              {m.proposal.walletAddress
                                ? `${m.proposal.walletAddress.slice(0, 10)}...`
                                : 'Connected Account'}
                            </span>
                          </div>
                        </div>

                        {/* State 1: Executed & Settled */}
                        {m.proposal.executed ? (
                          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono space-y-1.5">
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Proposal Approved &amp; Settled</span>
                            </div>
                            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                              {m.proposal.orderNumber ? `Order #${m.proposal.orderNumber} confirmed. ` : ''}
                              {m.proposal.txHash
                                ? `Tx Reference: ${m.proposal.txHash.slice(0, 24)}...`
                                : 'Successfully recorded on cryptographic ledger.'}
                            </p>
                            {m.proposal.orderNumber && (
                              <a
                                href={`/receipt?orderId=${m.proposal.orderNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[var(--gold)] hover:underline pt-1 font-bold"
                              >
                                <span>View Cryptographic Receipt</span>
                                <ArrowRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : m.proposal.rejected ? (
                          /* State 2: Rejected by user */
                          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono space-y-1">
                            <div className="flex items-center gap-2 font-bold">
                              <X className="w-4 h-4" />
                              <span>Proposal Rejected by User</span>
                            </div>
                            <p className="text-[11px] text-[var(--muted)]">
                              The proposed action was cancelled. No funds were debited and no order state was altered.
                            </p>
                          </div>
                        ) : (
                          /* State 3: Pending Authorization (Approve / Reject buttons) */
                          <div className="space-y-2 pt-1">
                            {m.proposal.error && (
                              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{m.proposal.error}</span>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              {/* APPROVE BUTTON */}
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleApprove(m.proposal!.proposalId)}
                                className="py-3 px-4 rounded-2xl bg-[var(--gold)] text-[#08090C] font-extrabold text-xs hover:bg-[var(--gold-bright)] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[var(--gold)]/20 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" />
                                <span>
                                  {m.proposal.action === 'PAY_ORDER' ? 'Approve Payment' : 'Approve Order'}
                                </span>
                              </button>

                              {/* REJECT BUTTON */}
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleReject(m.proposal!.proposalId)}
                                className="py-3 px-4 rounded-2xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-4 h-4 text-rose-400" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* User Message Bubble */
                <div className="max-w-[85%] sm:max-w-[75%] p-4 rounded-3xl text-sm leading-relaxed bg-[var(--gold)] text-[#08090C] font-semibold rounded-tr-none shadow-md">
                  {m.text}
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex items-start gap-2.5 max-w-[85%]">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0 mt-0.5 shadow-sm p-0.5">
                <RobotMascot isLight={isLight} className="w-full h-auto" />
              </div>
              <div className="nexus-glass-card border border-[var(--border)] p-3.5 rounded-3xl rounded-tl-none flex items-center gap-2 text-xs font-mono text-[var(--muted)] shadow-sm">
                <span className="flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-bounce" />
                </span>
                <span className="ml-1 text-[var(--foreground)] font-medium">
                  NexusRail Agent is thinking...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* BOTTOM INPUT BAR */}
      <div className="border-t border-[var(--border)] bg-[var(--surface-solid)]/90 backdrop-blur-xl p-4 sm:p-5 shrink-0 z-10">
        <div className="max-w-3xl mx-auto w-full space-y-3">
          {/* Quick Natural-Language Suggestion Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => handleSend('Add order for 2 NR tokens')}
              className="px-3 py-1.5 rounded-full bg-[var(--gold)]/15 hover:bg-[var(--gold)]/25 border border-[var(--gold)]/30 text-[11px] font-mono text-[var(--gold)] whitespace-nowrap transition-colors cursor-pointer font-semibold flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-[var(--gold)]" />
              <span>Add order for 2 NR tokens</span>
            </button>
            <button
              type="button"
              onClick={() => handleSend('Show my orders')}
              className="px-3 py-1.5 rounded-full bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] whitespace-nowrap transition-colors cursor-pointer"
            >
              📋 Show my orders
            </button>
            <button
              type="button"
              onClick={() => handleSend('Show my balance')}
              className="px-3 py-1.5 rounded-full bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] whitespace-nowrap transition-colors cursor-pointer"
            >
              👛 Show my balance
            </button>
            <button
              type="button"
              onClick={() => handleSend('Pay for order #NR-1001')}
              className="px-3 py-1.5 rounded-full bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] whitespace-nowrap transition-colors cursor-pointer"
            >
              💳 Pay for order
            </button>
            <button
              type="button"
              onClick={() => handleSend('Live exchange rates for XRP and XLM')}
              className="px-3 py-1.5 rounded-full bg-[var(--card-subtle)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted)] hover:text-[var(--foreground)] whitespace-nowrap transition-colors cursor-pointer"
            >
              🔄 Exchange Rates
            </button>
          </div>

          {/* Form Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--card)] border border-[var(--border)] focus-within:border-[var(--gold)] shadow-xl transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 'Add order for 2 NR tokens', 'Show my orders', 'Pay for order #12', or 'Show my balance'..."
              className="flex-1 bg-transparent px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)]/50 focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-3 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[#08090C] transition-colors disabled:opacity-40 cursor-pointer shrink-0 shadow-md"
              aria-label="Send message to AI Desk"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[10px] text-[var(--muted)]/70 text-center font-mono">
            NexusRail AI operates strictly on non-custodial proposals. It cannot move funds or sign transactions without your explicit approval.
          </p>
        </div>
      </div>
    </div>
  );
}
