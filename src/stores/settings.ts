import { create } from 'zustand';
import type { Settings } from '@/lib/bindings/Settings';

interface SettingsState {
  /** Flüchtige Kopie des Stands, den der Core zuletzt geliefert hat; `null`, bis er geladen ist. */
  settings: Settings | null;
  setSettings: (settings: Settings) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  setSettings: (settings: Settings): void => {
    set({ settings });
  },
}));
