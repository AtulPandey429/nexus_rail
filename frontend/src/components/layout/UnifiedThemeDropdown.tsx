'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Crown,
  Sun,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { useTheme, ThemePreset } from './ThemeProvider';
import { FX_MODES, type FxMode, readFxMode, writeFxMode, FX_CHANGE_EVENT } from '@/lib/visual-fx';

interface ThemeOption {
  id: ThemePreset;
  title: string;
  icon: React.ReactNode;
  dots: string[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark-glass',
    title: 'Dark Glass',
    icon: <Sparkles className="w-4 h-4 text-[#00E5FF]" />,
    dots: ['#00E5FF', '#D4AF37'],
  },
  {
    id: 'black-gold',
    title: 'Black & Gold',
    icon: <Crown className="w-4 h-4 text-[#D4AF37]" />,
    dots: ['#D4AF37', '#E8CE90'],
  },
  {
    id: 'light-glass',
    title: 'Light Glass',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
    dots: ['#D97706', '#0284C7'],
  },
];

export function UnifiedThemeDropdown() {
  const { settings, setPreset, setIsCustomizerOpen, theme } = useTheme();
  const isLight = theme === 'light';

  const [fxMode, setFxMode] = useState<FxMode>(readFxMode);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync FX mode on external changes
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<FxMode>).detail;
      if (detail) setFxMode(detail);
      else setFxMode(readFxMode());
    };
    window.addEventListener(FX_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(FX_CHANGE_EVENT, onChange);
  }, []);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
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

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 220);
  };

  const handleThemeSelect = (preset: ThemePreset) => {
    setPreset(preset);
  };

  const handleFxSelect = (mode: FxMode) => {
    setFxMode(mode);
    writeFxMode(mode);
  };

  // Active theme icon for trigger button
  const currentThemeOption = THEME_OPTIONS.find((t) => t.id === settings.preset) || THEME_OPTIONS[0];

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Single Unified Theme Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:text-[var(--gold)] hover:border-[var(--border-highlight)] transition-all hover:scale-105 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
        aria-label="Theme & Visual Effects Settings"
        aria-expanded={isOpen}
        title={`Current Theme: ${currentThemeOption.title} (Hover to switch)`}
      >
        <span className="shrink-0">{currentThemeOption.icon}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--gold)]' : ''
          }`}
          strokeWidth={2.4}
        />
      </button>

      {/* Unified Hover Dropdown Menu (100% Solid Opaque Background to prevent any page text bleed-through) */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 z-[100] rounded-2xl border p-3.5 shadow-2xl animate-fade-in-up text-[var(--foreground)] select-none"
          style={{
            backgroundColor: isLight ? '#FFFFFF' : '#0F131D',
            borderColor: isLight ? 'rgba(217, 119, 6, 0.40)' : 'rgba(212, 175, 55, 0.45)',
            boxShadow: isLight
              ? '0 20px 50px -8px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(217, 119, 6, 0.35)'
              : '0 25px 60px -12px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(212, 175, 55, 0.40)',
            opacity: 1,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1 pb-2.5 mb-2.5 border-b border-[var(--border)]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--gold)] font-bold">
              Theme & Effects
            </span>
            <span className="text-[10px] font-mono text-[var(--muted)]">v2.4</span>
          </div>

          {/* Section 1: Themes with Side Toggle Switches */}
          <div className="space-y-1.5 mb-3.5">
            <p className="px-1 text-[9.5px] font-mono uppercase tracking-wider text-[var(--muted)] font-semibold">
              Color Preset
            </p>
            {THEME_OPTIONS.map((themeOpt) => {
              const isSelected = settings.preset === themeOpt.id;
              return (
                <div
                  key={themeOpt.id}
                  onClick={() => handleThemeSelect(themeOpt.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                    isSelected
                      ? isLight
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 font-bold'
                        : 'bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--foreground)] font-bold'
                      : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--foreground)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {themeOpt.icon}
                    <span>{themeOpt.title}</span>
                  </div>

                  {/* Toggle Switch Component on the Side */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1 mr-1">
                      {themeOpt.dots.map((dotColor, i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full border border-black/30"
                          style={{ backgroundColor: dotColor }}
                        />
                      ))}
                    </div>

                    <div
                      className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                        isSelected
                          ? 'bg-[var(--gold)] justify-end'
                          : isLight
                          ? 'bg-slate-200 border border-slate-300 justify-start'
                          : 'bg-slate-700/60 border border-slate-600/50 justify-start'
                      }`}
                      title={isSelected ? 'Active theme' : 'Switch to this theme'}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full shadow-sm transition-transform ${
                          isSelected
                            ? 'bg-black'
                            : isLight
                            ? 'bg-slate-400'
                            : 'bg-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section 2: Background Effects with Side Toggle Switches */}
          <div className="space-y-1.5 mb-2.5 pt-2.5 border-t border-[var(--border)]">
            <p className="px-1 text-[9.5px] font-mono uppercase tracking-wider text-[var(--muted)] font-semibold">
              Background Canvas FX
            </p>
            <div className="space-y-1 pt-0.5">
              {FX_MODES.map((fx) => {
                const isSelected = fxMode === fx.id;
                return (
                  <div
                    key={fx.id}
                    onClick={() => handleFxSelect(fx.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? isLight
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 font-bold'
                          : 'bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--foreground)] font-bold'
                        : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--foreground)] border border-transparent'
                    }`}
                  >
                    <span>{fx.label}</span>

                    {/* Side Toggle Switch */}
                    <div
                      className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                        isSelected
                          ? 'bg-[var(--gold)] justify-end'
                          : isLight
                          ? 'bg-slate-200 border border-slate-300 justify-start'
                          : 'bg-slate-700/60 border border-slate-600/50 justify-start'
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full shadow-sm transition-transform ${
                          isSelected
                            ? 'bg-black'
                            : isLight
                            ? 'bg-slate-400'
                            : 'bg-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Action: Detailed Settings Modal */}
          <div className="pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCustomizerOpen(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-mono text-[var(--muted)] hover:text-[var(--gold)] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Full Customizer Panel...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
