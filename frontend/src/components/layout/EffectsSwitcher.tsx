'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { FX_MODES, type FxMode, readFxMode, writeFxMode } from '@/lib/visual-fx';

export function EffectsSwitcher() {
  const [mode, setMode] = useState<FxMode>(readFxMode);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const changeMode = (next: FxMode) => {
    setMode(next);
    writeFxMode(next);
    setIsOpen(false);
  };

  const activeModeObj = FX_MODES.find((m) => m.id === mode) || FX_MODES[0];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:text-[var(--gold)] hover:border-[var(--border-highlight)] transition-all hover:scale-105 active:scale-95 shadow-sm flex items-center justify-center cursor-pointer"
        title={`Background Visual Effect: ${activeModeObj.label}`}
        aria-label="Background Visual Effects"
        aria-expanded={isOpen}
      >
        <Sparkles className="w-5 h-5 text-[var(--gold)]" strokeWidth={2.4} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 flex w-60 flex-col gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-2.5 shadow-2xl backdrop-blur-2xl animate-fade-in-up">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--border)] mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--gold)] font-bold">
              Background Effects
            </span>
            <span className="text-[10px] font-mono text-[var(--muted)]">Canvas 2D</span>
          </div>

          {FX_MODES.map((item) => {
            const isSelected = item.id === mode;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => changeMode(item.id)}
                className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-left font-mono text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--foreground)] font-bold'
                    : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--foreground)] border border-transparent'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--foreground)] font-semibold">{item.label}</span>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] font-sans font-normal leading-tight mt-0.5">
                    {item.desc}
                  </p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
