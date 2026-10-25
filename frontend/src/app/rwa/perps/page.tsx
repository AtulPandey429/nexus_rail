'use client';

import React, { useState } from 'react';
import { fetchPerpQuote, PerpQuote } from '@/lib/shop';

export default function RwaPerpsPage() {
  const [pair, setPair] = useState<'XAU/USD' | 'XAG/USD'>('XAU/USD');
  const [leverage, setLeverage] = useState(2);
  const [positionSize, setPositionSize] = useState('100');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<PerpQuote | null>(null);

  const loadQuote = async () => {
    setIsLoading(true);
    setError('');
    setQuote(null);
    try {
      setQuote(await fetchPerpQuote(pair, leverage, positionSize));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load a quote.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="p-6 rounded-3xl bg-nexus-card border border-gray-800 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gold and silver price quote</h1>
          <p className="text-sm text-gray-400 mt-2">
            A quote is shown only when a provider returns one.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['XAU/USD', 'XAG/USD'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPair(option)}
              className={`p-3 rounded-xl border text-sm ${pair === option ? 'border-cyber-purple text-cyber-purple' : 'border-gray-800 text-gray-300'}`}
            >
              {option === 'XAU/USD' ? 'Gold' : 'Silver'} ({option})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setLeverage(level)}
              className={`px-3 py-2 rounded-xl border text-sm ${leverage === level ? 'border-cyber-purple text-cyber-purple' : 'border-gray-800 text-gray-300'}`}
            >
              {level}x
            </button>
          ))}
        </div>
        <label className="block text-sm text-gray-300">
          Notional size in USD
          <input
            type="number"
            value={positionSize}
            onChange={(event) => setPositionSize(event.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-nexus-dark border border-gray-700"
          />
        </label>
        <button
          type="button"
          onClick={loadQuote}
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-cyber-purple text-white font-bold disabled:opacity-60"
        >
          {isLoading ? 'Getting quote…' : 'Get quote'}
        </button>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {quote && (
          <div className="p-4 rounded-2xl border border-cyber-purple/40 bg-cyber-purple/10 text-sm space-y-1">
            <p className="font-semibold text-cyber-purple">Quote, not a filled trade</p>
            <p>Index price: ${quote.indexPrice}</p>
            <p>Size: ${quote.sizeUsd}</p>
            <p>Illustrative margin: ${quote.marginUsd}</p>
            <p>Illustrative liquidation: ${quote.liquidationPrice}</p>
          </div>
        )}
      </div>
    </div>
  );
}
