'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreset = 'dark-glass' | 'black-gold' | 'light-glass';
export type EffectsMode = 'ambient' | 'minimal';
export type MotionMode = 'full' | 'reduced';

export interface ThemeSettings {
  preset: ThemePreset;
  effects: EffectsMode;
  motion: MotionMode;
}

interface ThemeContextType {
  settings: ThemeSettings;
  setPreset: (preset: ThemePreset) => void;
  setEffects: (effects: EffectsMode) => void;
  setMotion: (motion: MotionMode) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isCustomizerOpen: boolean;
  setIsCustomizerOpen: (open: boolean) => void;
}

const DEFAULT_SETTINGS: ThemeSettings = {
  preset: 'dark-glass',
  effects: 'ambient',
  motion: 'full',
};

const ThemeContext = createContext<ThemeContextType>({
  settings: DEFAULT_SETTINGS,
  setPreset: () => {},
  setEffects: () => {},
  setMotion: () => {},
  theme: 'dark',
  toggleTheme: () => {},
  isCustomizerOpen: false,
  setIsCustomizerOpen: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Detect OS prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 2. Load stored settings from localStorage
    let initialSettings = { ...DEFAULT_SETTINGS };
    if (prefersReducedMotion) {
      initialSettings.motion = 'reduced';
    }

    try {
      const stored = localStorage.getItem('nexus_display_preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.preset) initialSettings.preset = parsed.preset;
        if (parsed.effects) initialSettings.effects = parsed.effects;
        if (parsed.motion) initialSettings.motion = parsed.motion;
      } else {
        // Fallback check legacy nexus_theme key
        const legacyTheme = localStorage.getItem('nexus_theme');
        if (legacyTheme === 'light') initialSettings.preset = 'light-glass';
      }
    } catch {}

    setSettingsState(initialSettings);
    applyAttributes(initialSettings);
    setMounted(true);
  }, []);

  const applyAttributes = (s: ThemeSettings) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // 1. Set explicit data-attributes for tokenized styling
    root.setAttribute('data-theme', s.preset);
    root.setAttribute('data-effects', s.effects);
    root.setAttribute('data-motion', s.motion);

    // 2. Sync Tailwind darkMode 'dark' class
    if (s.preset === 'light-glass') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  };

  const updateSettings = (updater: (prev: ThemeSettings) => ThemeSettings) => {
    setSettingsState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem('nexus_display_preferences', JSON.stringify(next));
        // Keep legacy key synced for backward compatibility
        localStorage.setItem('nexus_theme', next.preset === 'light-glass' ? 'light' : 'dark');
      } catch {}
      applyAttributes(next);
      return next;
    });
  };

  const setPreset = (preset: ThemePreset) => {
    updateSettings((prev) => ({ ...prev, preset }));
  };

  const setEffects = (effects: EffectsMode) => {
    updateSettings((prev) => ({ ...prev, effects }));
  };

  const setMotion = (motion: MotionMode) => {
    updateSettings((prev) => ({ ...prev, motion }));
  };

  const toggleTheme = () => {
    // Quick toggle between dark and light glass
    if (settings.preset === 'light-glass') {
      setPreset('dark-glass');
    } else {
      setPreset('light-glass');
    }
  };

  const theme: 'dark' | 'light' = settings.preset === 'light-glass' ? 'light' : 'dark';

  return (
    <ThemeContext.Provider
      value={{
        settings,
        setPreset,
        setEffects,
        setMotion,
        theme,
        toggleTheme,
        isCustomizerOpen,
        setIsCustomizerOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
