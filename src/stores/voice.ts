import { create } from 'zustand';
import type { VoiceModelState } from '@/lib/bindings/VoiceModelState';

export const DICTATION_PHASES = ['idle', 'recording', 'transcribing'] as const;
export type DictationPhase = (typeof DICTATION_PHASES)[number];

/** Schlüssel der Eingabe in „Neues Vorhaben“; Eingaben einer Session nutzen deren ID. */
export const NEW_SESSION_OWNER = 'new-session';

interface VoiceState {
  phase: DictationPhase;
  /** Die Eingabe, die gerade diktiert; app-weit läuft höchstens ein Diktat. */
  owner: string | null;
  /** Pegel 0 bis 1; liegt hier und nicht im Hook, damit nur der Mikrofon-Knopf alle 50 ms neu zeichnet. */
  level: number;
  modelState: VoiceModelState | null;
  downloadError: string | null;
  setPhase: (phase: DictationPhase, owner: string | null) => void;
  setLevel: (level: number) => void;
  setModelState: (modelState: VoiceModelState) => void;
  setDownloadError: (downloadError: string | null) => void;
  /** Zurück in den Ruhezustand: kein Besitzer, kein Pegel. */
  resetDictation: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  phase: 'idle',
  owner: null,
  level: 0,
  modelState: null,
  downloadError: null,
  setPhase: (phase: DictationPhase, owner: string | null): void => {
    set({ phase, owner });
  },
  setLevel: (level: number): void => {
    set({ level });
  },
  setModelState: (modelState: VoiceModelState): void => {
    set({ modelState });
  },
  setDownloadError: (downloadError: string | null): void => {
    set({ downloadError });
  },
  resetDictation: (): void => {
    set({ phase: 'idle', owner: null, level: 0 });
  },
}));
