import { create } from 'zustand';

interface UsageState {
  /** Schlüssel der Kontingent-Warnung, die der User ausgeblendet hat (`alertKey`). */
  dismissedAlertKey: string | null;
  dismissAlert: (key: string) => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  dismissedAlertKey: null,
  dismissAlert: (key: string): void => {
    set({ dismissedAlertKey: key });
  },
}));
