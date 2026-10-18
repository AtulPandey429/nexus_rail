'use client';

import React, { useEffect, useState } from 'react';
import { addSkuToCart, fetchGuideMessages, GuideMessage, sendGuideMessage } from '@/lib/shop';

export default function CatalogGuidePage() {
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchGuideMessages()
      .then(setMessages)
      .catch((err: Error) => setError(err.message));
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    setInput('');
    try {
      const next = await sendGuideMessage(text);
      setMessages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The guide did not answer.');
    } finally {
      setSending(false);
    }
  };

  const addSku = async (sku: string) => {
    setError('');
    try {
      await addSkuToCart(sku);
      setAdded((prev) => ({ ...prev, [sku]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that item.');
    }
  };

  return (
    <main className="min-h-screen bg-nexus-dark text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-3xl font-bold">What should I buy?</h1>
          <p className="text-sm text-gray-400 mt-1">
            The guide only suggests items. You add them to the cart yourself.
          </p>
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <div className="min-h-[360px] rounded-2xl border border-gray-800 bg-nexus-card p-4 space-y-3">
          {messages.length === 0 && <p className="text-sm text-gray-400">Ask about a notebook, a pen, or a lamp.</p>}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-lg p-3 rounded-xl text-sm ${
                message.role === 'user' ? 'ml-auto bg-cyber-purple/20' : 'bg-nexus-dark border border-gray-800'
              }`}
            >
              <p>{message.body}</p>
              {message.suggestedSkus && message.suggestedSkus.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {message.suggestedSkus.map((sku) => (
                    <button
                      key={sku}
                      type="button"
                      onClick={() => addSku(sku)}
                      className="px-2 py-1 rounded-lg bg-gray-800 text-xs text-rail-emerald"
                    >
                      {added[sku] ? `Added ${sku}` : `Add ${sku}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder="Ask about the catalog"
            className="flex-1 px-4 py-3 rounded-xl bg-nexus-card border border-gray-800 text-sm"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="px-4 py-3 rounded-xl bg-cyber-purple text-white text-sm font-semibold disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </main>
  );
}
