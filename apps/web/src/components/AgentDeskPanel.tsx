'use client';

import React, { useState } from 'react';
import { Bot, Send, Sparkles, CheckCircle2, Clock, X } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  proposal?: {
    proposalId: string;
    title: string;
    priceCents: number;
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

  if (!isOpen) return null;

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, sender: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      if (query.toLowerCase().includes('buy') || query.toLowerCase().includes('order')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'agent',
            text: 'I have generated a proposal lock for your order. Confirm below to execute atomic settlement.',
            proposal: {
              proposalId: `prop_${Math.random().toString(36).substring(2, 8)}`,
              title: 'XRPL Starter Validator Node Hardware',
              priceCents: 49900,
            },
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'agent',
            text: 'NexusRail multi-rail desk is ready. You can query live exchange rates, check internal USD wallet balance, or execute payments.',
          },
        ]);
      }
      setLoading(false);
    }, 400);
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
            <span className="text-[10px] text-rail-emerald flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-rail-emerald animate-pulse" />
              Sub-300ms Ready
            </span>
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
                <button
                  type="button"
                  onClick={() => alert(`Proposal ${m.proposal?.proposalId} confirmed!`)}
                  className="w-full py-2 rounded-lg bg-rail-emerald text-nexus-dark font-bold text-xs hover:bg-rail-emerald/90 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm & Authorize Order
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-xs text-gray-500 italic">Agent is thinking...</div>}
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
