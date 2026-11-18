'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Send, ShoppingBag, Check } from 'lucide-react';
import { addSkuToCart, fetchGuideMessages, GuideMessage, sendGuideMessage } from '@/lib/shop';

const QUICK_PROMPTS = [
  'Suggest a low-risk gold basket',
  'Best hardware for Stellar & XRPL',
  'What can I buy under $50?',
];

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

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    setInput('');
    try {
      const next = await sendGuideMessage(text);
      setMessages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The shopping guide could not respond.');
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
    <main className="min-h-screen bg-transparent text-[var(--foreground)] px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Shopping guide
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Ask for product or Smart Basket recommendations — nothing is added until you click.
            </p>
          </div>
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--foreground)] hover:border-[var(--gold)]/50 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>View cart</span>
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="min-h-[380px] max-h-[520px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-14 space-y-4">
              <p className="text-sm text-[var(--muted)] max-w-md">
                Not sure which Smart Basket or hardware fits your budget? Pick a question below or type your own.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-subtle)] text-xs text-[var(--foreground)] hover:border-[var(--gold)]/50 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-lg rounded-xl px-4 py-3 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'ml-auto bg-[var(--gold)] text-[#08090C] font-medium'
                  : 'bg-[var(--card-subtle)] border border-[var(--border)] text-[var(--foreground)]'
              }`}
            >
              <p>{message.body}</p>
              {message.suggestedSkus && message.suggestedSkus.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-[var(--border)]">
                  {message.suggestedSkus.map((sku) => (
                    <button
                      key={sku}
                      type="button"
                      onClick={() => void addSku(sku)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-mono text-[var(--gold)] hover:border-[var(--gold)]/60 transition-colors cursor-pointer"
                    >
                      {added[sku] ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                      <span>{added[sku] ? `Added ${sku}` : `Add ${sku}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about Smart Baskets, gold packs, or hardware…"
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--gold)]/60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[#08090C] text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Sending…' : 'Send'}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
