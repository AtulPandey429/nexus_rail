'use client';

import React, { useState } from 'react';
import { Swords, ThumbsUp } from 'lucide-react';

export function ProductShowdownCard() {
  const [votesA, setVotesA] = useState(142);
  const [votesB, setVotesB] = useState(98);

  const total = votesA + votesB;
  const percentA = Math.round((votesA / total) * 100);
  const percentB = 100 - percentA;

  return (
    <div className="w-full max-w-xl p-6 rounded-2xl bg-nexus-card border border-gray-800 space-y-5 shadow-2xl">
      <div className="flex items-center gap-2 text-cyber-purple text-xs font-mono font-bold uppercase tracking-wider">
        <Swords className="w-4 h-4" />
        <span>Mento Product Showdown</span>
      </div>

      <h2 className="text-lg font-bold text-white">XRPL Hardware Kit vs Stellar Soroban License</h2>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-nexus-dark border border-xrpl-blue/30 space-y-3">
          <div className="text-xs font-bold text-white">XRPL Hardware</div>
          <div className="text-xl font-black text-xrpl-blue">{percentA}%</div>
          <button
            onClick={() => setVotesA(votesA + 1)}
            className="w-full py-1.5 rounded-lg bg-xrpl-blue/20 text-xrpl-blue border border-xrpl-blue/40 text-xs font-semibold hover:bg-xrpl-blue/30 flex items-center justify-center gap-1"
          >
            <ThumbsUp className="w-3 h-3" /> Vote ({votesA})
          </button>
        </div>

        <div className="p-4 rounded-xl bg-nexus-dark border border-stellar-cyan/30 space-y-3">
          <div className="text-xs font-bold text-white">Stellar Soroban</div>
          <div className="text-xl font-black text-stellar-cyan">{percentB}%</div>
          <button
            onClick={() => setVotesB(votesB + 1)}
            className="w-full py-1.5 rounded-lg bg-stellar-cyan/20 text-stellar-cyan border border-stellar-cyan/40 text-xs font-semibold hover:bg-stellar-cyan/30 flex items-center justify-center gap-1"
          >
            <ThumbsUp className="w-3 h-3" /> Vote ({votesB})
          </button>
        </div>
      </div>
    </div>
  );
}
