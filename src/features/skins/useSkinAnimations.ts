import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Folgt der Benutzer Windows („reduzierte Bewegung“), solange er keine Wahl getroffen hat. */
function useSystemPrefersReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState<boolean>(
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  useEffect(() => {
    const query: MediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
    function handleChange(event: MediaQueryListEvent): void {
      setIsReduced(event.matches);
    }
    query.addEventListener('change', handleChange);
    return (): void => {
      query.removeEventListener('change', handleChange);
    };
  }, []);
  return isReduced;
}

/** Dürfen sich Figuren bewegen? Die Einstellung gewinnt; ohne sie gilt die Systemeinstellung. */
export function useSkinAnimations(): boolean {
  const choice: boolean | null = useSettingsStore(
    (state) => state.settings?.skinAnimations ?? null,
  );
  const isSystemReduced: boolean = useSystemPrefersReducedMotion();
  return choice ?? !isSystemReduced;
}
