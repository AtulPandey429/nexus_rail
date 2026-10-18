'use client';

import React, { useRef, useState } from 'react';
import { Bot, Send, Sparkles, CheckCircle2, Clock, X } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  proposal?: {
    proposalId: string;
    title: string;
    priceCents: number;
    executed?: boolean;
    txHash?: string;
    error?: string;
  };
}

export function AgentDeskPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_1',
      sender: 'agent',
      text: 'Hello! I am your NexusRail AI Desk Agent. Ask me about products, XRP/XLM balances, or order hardware kits!',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const confirmedIds = useRef(new Set<string>());

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
        { id: `a_${Date.now()}`, sender: 'agent', text: 'Sign in before asking the assistant to do anything.' },
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

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'agent',
            text: data.reply,
            proposal: data.proposal
              ? {
                  proposalId: data.proposal.proposalId,
                  title: data.proposal.payload?.title || 'Proposed purchase',
                  priceCents: data.proposal.payload?.priceCents || 0,
                }
              : undefined,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'agent',
            text: data.error || 'Agent execution encountered an error',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'agent',
          text: 'The assistant is unreachable. Nothing was proposed.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-nexus-card border-l border-gray-800 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-nexus-dark/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyber-purple/20 border border-cyber-purple/40 flex items-center justify-center text-cyber-purple">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">AI Agent Desk</h3>
            <span className="text-[10px] text-gray-400">Proposes first. You confirm before it runs.</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-cyber-purple text-white rounded-br-none'
                  : 'bg-nexus-dark border border-gray-800 text-gray-200 rounded-bl-none'
              }`}
            >
              {m.text}
            </div>

            {/* Proposal Lock Card */}
            {m.proposal && (
              <div className="mt-3 p-4 rounded-xl bg-nexus-dark border border-cyber-purple/40 space-y-3 w-[90%] shadow-lg">
                <div className="flex items-center justify-between text-[11px] text-cyber-purple font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Lock TTL: 04:59
                  </span>
                  <span>{m.proposal.proposalId}</span>
                </div>
                <div className="text-xs font-bold text-white">{m.proposal.title}</div>
                <div className="text-sm font-black text-rail-emerald">${(m.proposal.priceCents / 100).toFixed(2)} USD</div>
                {m.proposal.executed ? (
                  <div className="p-3 rounded-lg bg-rail-emerald/10 border border-rail-emerald/30 text-rail-emerald text-xs font-mono space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Proposal Executed & Settled
                    </div>
                    <div className="text-[10px] text-gray-400">{m.proposal.txHash ? `Reference: ${m.proposal.txHash}` : 'Confirmed by the API.'}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {m.proposal.error && <p className="text-xs text-rose-300">{m.proposal.error}</p>}
                    <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      const proposalId = m.proposal?.proposalId;
                      if (!proposalId || confirmedIds.current.has(proposalId) || m.proposal?.executed) return;
                      confirmedIds.current.add(proposalId);
                      setLoading(true);
                      try {
                        const token = localStorage.getItem('nexus_token');
                        if (!token) return;
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
                          const message = data.error || 'Confirmation did not run.';
                          setMessages((prev) =>
                            prev.map((msg) =>
                              msg.proposal?.proposalId === proposalId
                                ? { ...msg, proposal: { ...msg.proposal!, error: message } }
                                : msg
                            )
                          );
                          return;
                        }
                        const txHash = data.txHash || data.transaction?.id;
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.proposal?.proposalId === proposalId
                              ? {
                                  ...msg,
                                  proposal: {
                                    ...msg.proposal!,
                                    executed: true,
                                    txHash,
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
                              ? {
                                  ...msg,
                                  proposal: {
                                    ...msg.proposal!,
                                    error: 'Confirmation did not reach the API. Nothing ran.',
                                  },
                                }
                              : msg
                          )
                        );
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full py-2 rounded-lg bg-rail-emerald text-nexus-dark font-bold text-xs hover:bg-rail-emerald/90 flex items-center justify-center gap-1.5 shadow-md shadow-rail-emerald/10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirm and run once
                  </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-xs text-gray-500 italic">Agent is processing proposal lock...</div>}
      </div>

      {/* Suggestion Pills */}
      <div className="p-3 bg-nexus-dark/50 border-t border-gray-800/60 flex gap-2 overflow-x-auto">
        <button
          onClick={() => handleSend('Order XRPL validator node hardware')}
          className="px-2.5 py-1 rounded-full bg-gray-800 text-[10px] text-gray-300 hover:border-cyber-purple border border-transparent whitespace-nowrap"
        >
          ✨ Order XRPL Hardware
        </button>
        <button
          onClick={() => handleSend('Buy 1 Gram Gold Token nGOLD')}
          className="px-2.5 py-1 rounded-full bg-amber-500/10 text-[10px] text-amber-300 hover:border-amber-400 border border-amber-400/30 whitespace-nowrap"
        >
          🥇 Mint 1g nGOLD
        </button>
        <button
          onClick={() => handleSend('Check wallet balance')}
          className="px-2.5 py-1 rounded-full bg-gray-800 text-[10px] text-gray-300 hover:border-cyber-purple border border-transparent whitespace-nowrap"
        >
          👛 Check Balance
        </button>
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-gray-800 bg-nexus-dark flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI Agent Desk..."
          className="flex-1 bg-nexus-card border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-purple"
        />
        <button
          onClick={() => handleSend()}
          className="p-2 rounded-xl bg-cyber-purple text-white hover:bg-cyber-purple/90"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
