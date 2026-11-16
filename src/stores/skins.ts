import { create } from 'zustand';
import type { SkinPack } from '@/lib/bindings/SkinPack';

export type StyleScheme = 'dark' | 'light';

interface SkinsState {
  /** Das aktive Figurenpaket; `null` = Aus. */
  activeFigures: SkinPack | null;
  /** Das aktive Stilpaket; `null` = Standard. */
  activeStyle: SkinPack | null;
  /** Paket, das die Seite „Skins“ gerade im Editor zeigt (Phase 4). */
  editingPackId: string | null;
  /** Aufgeklapptes Fach im Editor (Phase 4). */
  openSlot: string | null;
  /** Welches Farbschema die Vorschau des Stil-Editors zeigt (Phase 4). */
  styleScheme: StyleScheme;
  /** Werkzeugnamen in der Fächerliste des Editors zeigen (Phase 4). */
  showToolNames: boolean;
  setActive: (figures: SkinPack | null, style: SkinPack | null) => void;
  setEditingPackId: (id: string | null) => void;
  setOpenSlot: (slot: string | null) => void;
  setStyleScheme: (scheme: StyleScheme) => void;
  setShowToolNames: (isShown: boolean) => void;
}

export const useSkinsStore = create<SkinsState>((set) => ({
  activeFigures: null,
  activeStyle: null,
  editingPackId: null,
  openSlot: null,
  styleScheme: 'dark',
  showToolNames: false,
  setActive: (figures: SkinPack | null, style: SkinPack | null): void => {
    set({ activeFigures: figures, activeStyle: style });
  },
  setEditingPackId: (id: string | null): void => {
    set({ editingPackId: id });
  },
  setOpenSlot: (slot: string | null): void => {
    set({ openSlot: slot });
  },
  setStyleScheme: (scheme: StyleScheme): void => {
    set({ styleScheme: scheme });
  },
  setShowToolNames: (isShown: boolean): void => {
    set({ showToolNames: isShown });
  },
}));
