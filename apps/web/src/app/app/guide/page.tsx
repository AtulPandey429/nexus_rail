'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bot, ArrowLeft, Send, Sparkles, PlusCircle, Check } from 'lucide-react';

interface GuideMessage {
  role: 'user' | 'assistant';
  body: string;
  suggestedSkus?: string[];
}

export default function CatalogGuidePage() {
  const [messages, setMessages] = useState<GuideMessage[]>([
    {
      role: 'assistant',
      body: 'Welcome to the NexusRail Catalog Guide! Ask me questions about our desk kit products. I will give recommendations, but I cannot execute purchases directly for safety.',
      suggestedSkus: ['NL-NOTE-A5', 'NL-PEN-SET'],
    },
  ]);
  const [input, setInput] = useState('');
  const [addedSkus, setAddedSkus] = useState<Record<string, boolean>>({});

  const handleSend = () => {
    if (!input.trim()) return;

    const userText = input;
    setInput('');

    const newMsgs = [...messages, { role: 'user' as const, body: userText, suggestedSkus: [] }];

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
      setMessages([...newMsgs, { role: 'assistant' as const, body: reply, suggestedSkus }]);
    }, 400);
  };

  const handleAddToCart = (sku: string) => {
    setAddedSkus((prev) => ({ ...prev, [sku]: true }));
  };

  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12 flex flex-col">
      <div className="max-w-4xl w-full mx-auto space-y-6 flex-1 flex flex-col">
        <Link href="/app" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Buyer Dashboard
        </Link>

        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Bot className="w-7 h-7 text-cyber-purple" />
            <span>Read-Only Catalog Guide</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Spectrum Security Rule: Model suggests product SKUs only. Buyer confirms cart addition.</p>
        </div>

        {/* Chat Thread */}
        <div className="flex-1 bg-gray-900/80 border border-gray-800 rounded-2xl p-4 md:p-6 space-y-4 overflow-y-auto min-h-[400px]">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl max-w-xl text-xs space-y-2 ${
                msg.role === 'user'
                  ? 'ml-auto bg-cyber-purple/20 text-white border border-cyber-purple/40'
                  : 'mr-auto bg-nexus-dark text-gray-200 border border-gray-800'
              }`}
            >
              <div className="font-bold font-mono text-[10px] text-gray-400">
                {msg.role === 'user' ? 'Buyer' : 'Catalog Guide'}
              </div>
              <p className="leading-relaxed text-sm">{msg.body}</p>

              {msg.suggestedSkus && msg.suggestedSkus.length > 0 && (
                <div className="pt-2 border-t border-gray-800/80 flex flex-wrap gap-2">
                  {msg.suggestedSkus.map((sku) => (
                    <button
                      key={sku}
                      onClick={() => handleAddToCart(sku)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        addedSkus[sku]
                          ? 'bg-rail-emerald/20 text-rail-emerald border border-rail-emerald/40'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                      }`}
                    >
                      {addedSkus[sku] ? <Check className="w-3.5 h-3.5 text-rail-emerald" /> : <PlusCircle className="w-3.5 h-3.5" />}
                      <span>{addedSkus[sku] ? `Added ${sku}` : `Add ${sku} to Cart`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Catalog Guide about desk kits..."
            className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white focus:outline-none focus:border-cyber-purple font-mono"
          />
          <button
            onClick={handleSend}
            className="px-5 py-3 rounded-xl bg-cyber-purple text-nexus-dark font-bold text-xs hover:opacity-90 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
