'use client';

import React from 'react';
import {
  X,
  Sparkles,
  Crown,
  Sun,
  Flame,
  Zap,
  Activity,
  Check,
  Compass,
} from 'lucide-react';
import { useTheme, ThemePreset } from './ThemeProvider';
import { FX_MODES, type FxMode, readFxMode, writeFxMode, FX_CHANGE_EVENT } from '@/lib/visual-fx';

interface PresetOption {
  id: ThemePreset;
  title: string;
  description: string;
  icon: React.ReactNode;
  colors: string[];
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'dark-glass',
    title: 'Dark Glass',
    description: 'Deep obsidian frosted panels with icy cyan & gold highlights',
    icon: <Sparkles className="w-4 h-4 text-[#00E5FF]" />,
    colors: ['#090B0E', '#161B26', '#00E5FF', '#D4AF37'],
  },
  {
    id: 'black-gold',
    title: 'Black & Gold',
    description: 'Executive deep matte charcoal with champagne gold metallic accents',
    icon: <Crown className="w-4 h-4 text-[#D4AF37]" />,
    colors: ['#141619', '#26282C', '#D4AF37', '#E8CE90'],
  },
  {
    id: 'light-glass',
    title: 'Light Glass',
    description: 'Frosted crystalline pearlescent panels with sharp slate contrast',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
    colors: ['#F4F6F9', '#FFFFFF', '#0F172A', '#D4AF37'],
  },
];

export function ThemeCustomizerModal() {
  const {
    settings,
    setPreset,
    setEffects,
    setMotion,
    isCustomizerOpen,
    setIsCustomizerOpen,
  } = useTheme();

  const [fxMode, setFxMode] = React.useState<FxMode>(readFxMode);

  React.useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<FxMode>).detail;
      if (detail) setFxMode(detail);
      else setFxMode(readFxMode());
    };
    window.addEventListener(FX_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(FX_CHANGE_EVENT, onChange);
  }, []);

  const handleFxChange = (mode: FxMode) => {
    setFxMode(mode);
    writeFxMode(mode);
  };

  if (!isCustomizerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={() => setIsCustomizerOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[var(--surface-solid)] border border-[var(--border)] shadow-2xl p-6 relative overflow-hidden text-[var(--foreground)] animate-fade-in-up"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--border-highlight)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Glow behind Modal */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[var(--gold)]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[var(--border-focus)]/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[var(--border)] relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)]">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 id="customizer-title" className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                Interface & Display Controls
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1 font-mono">
              Personalize themes, frosted glass surfaces, and ambient animations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCustomizerOpen(false)}
            aria-label="Close customizer"
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-6 relative z-10 text-xs font-mono">
          {/* Section 1: Visual Theme Presets */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)] mb-3">
              1. Visual Theme Presets
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = settings.preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreset(opt.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[var(--gold)] bg-[var(--card)] shadow-lg'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-highlight)] hover:bg-[var(--card-hover)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] shrink-0 mt-0.5">
                        {opt.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[var(--foreground)]">
                            {opt.title}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded bg-[var(--gold)]/20 border border-[var(--gold)]/40 text-[var(--gold)] text-[10px] font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5 font-sans">
                          {opt.description}
                        </p>
                      </div>
                    </div>

                    {/* Color Swatch Dots */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      {opt.colors.map((c, i) => (
                        <span
                          key={i}
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-sm"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Interactive Background Visual Effects (Canvas 2D) */}
          <div className="border-t border-[var(--border)] pt-4">
            <div className="flex items-start justify-between gap-4 mb-2.5">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[12px] text-[var(--foreground)]">
                    Interactive Background Effects
                  </p>
                  <p className="text-[11px] text-[var(--muted)] font-sans">
                    Silk 2D canvas effects with cursor reactive beams and nodes.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FX_MODES.map((item) => {
                const isSelected = item.id === fxMode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleFxChange(item.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-[var(--gold)] bg-[var(--card)] text-[var(--gold)] font-bold shadow-sm'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                    }`}
                  >
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[9px] text-[var(--muted)] font-sans truncate mt-0.5">
                      {item.desc.split(' ')[0]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Background Ambient Lighting */}
          <div className="border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Flame className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[12px] text-[var(--foreground)]">
                    Ambient Background Lighting
                  </p>
                  <p className="text-[11px] text-[var(--muted)] font-sans">
                    Subtle, floating gradient mesh glow beneath glass panels.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--card)] border border-[var(--border)] shrink-0">
                <button
                  type="button"
                  onClick={() => setEffects('ambient')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                    settings.effects === 'ambient'
                      ? 'bg-[var(--gold)] text-black shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => setEffects('minimal')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                    settings.effects === 'minimal'
                      ? 'bg-[var(--gold)] text-black shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Off
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Motion & Accessibility */}
          <div className="border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Activity className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[12px] text-[var(--foreground)]">
                    Motion & Micro-Interactions
                  </p>
                  <p className="text-[11px] text-[var(--muted)] font-sans">
                    Reduced motion stops floating orbs and respects accessibility.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--card)] border border-[var(--border)] shrink-0">
                <button
                  type="button"
                  onClick={() => setMotion('full')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    settings.motion === 'full'
                      ? 'bg-[var(--gold)] text-black shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setMotion('reduced')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    settings.motion === 'reduced'
                      ? 'bg-[var(--gold)] text-black shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Reduced
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] relative z-10 text-[11px] font-mono">
          <span className="text-[var(--muted)] flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preferences auto-saved to device</span>
          </span>

          <button
            type="button"
            onClick={() => setIsCustomizerOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-bold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
