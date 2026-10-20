export type FxMode = 'constellation' | 'starfield' | 'waves' | 'off';

export const FX_STORAGE_KEY = 'nexus-fx-mode';
export const FX_CHANGE_EVENT = 'nexus-fx-change';

export const FX_MODES: Array<{ id: FxMode; label: string; desc: string }> = [
  { id: 'constellation', label: 'Constellation', desc: 'Interactive connected multi-rail network nodes' },
  { id: 'starfield', label: 'Starfield', desc: 'Hyperspace 3D warp particle field' },
  { id: 'waves', label: 'Aurora', desc: 'Ambient flowing luminous wave gradient' },
  { id: 'off', label: 'Off', desc: 'Clean static background' },
];

export function readFxMode(): FxMode {
  if (typeof window === 'undefined') return 'constellation';
  const saved = localStorage.getItem(FX_STORAGE_KEY) as FxMode | null;
  if (saved && FX_MODES.some((m) => m.id === saved)) return saved;
  return 'constellation';
}

export function writeFxMode(mode: FxMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FX_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(FX_CHANGE_EVENT, { detail: mode }));
}
