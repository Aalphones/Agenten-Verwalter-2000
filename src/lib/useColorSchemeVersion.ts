import { useSyncExternalStore } from 'react';

const DARK_QUERY = '(prefers-color-scheme: dark)';

let version = 0;
const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

function bump(): void {
  version += 1;
  listeners.forEach((listener: () => void) => {
    listener();
  });
}

/** Beobachtet die Klasse `dark`/`light` an `<html>` (Wahl in den Einstellungen) und die Windows-Einstellung. */
function startWatching(): () => void {
  const observer = new MutationObserver(bump);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  const query: MediaQueryList = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', bump);
  return (): void => {
    observer.disconnect();
    query.removeEventListener('change', bump);
  };
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    stopWatching = startWatching();
  }
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}

function getSnapshot(): number {
  return version;
}

/** Zählt mit, wie oft sich das Farbschema geändert hat; wer Farben aus den Tokens liest und selbst zeichnet
 *  (Schaubilder), rechnet bei einer neuen Zahl neu. */
export function useColorSchemeVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}
