import { create } from 'zustand';
import type { AppUpdateStatus } from '@/lib/bindings/AppUpdateStatus';

interface AppUpdateState {
  /** `null`, bis die erste Abfrage zurück ist. */
  status: AppUpdateStatus | null;
  setStatus: (status: AppUpdateStatus) => void;
}

/** Ergebnis der letzten Abfrage der Releases — gelesen von den Einstellungen und vom Punkt am
 *  Knopf „Einstellungen“ in der Sidebar. */
export const useAppUpdateStore = create<AppUpdateState>((set) => ({
  status: null,
  setStatus: (status: AppUpdateStatus): void => {
    set({ status });
  },
}));
