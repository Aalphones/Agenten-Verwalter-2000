import { useEffect, useEffectEvent } from 'react';
import { isTextTarget } from '@/lib/keyTargets';

/** ↑ ↑ ↓ ↓ ← → ← → B A */
export const KONAMI_SEQUENCE: readonly string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

/** Die Taste im Vergleich zur Folge: Buchstaben ohne Groß-/Kleinschreibung. */
function keyName(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Hört auf den Konami-Code und ruft `onUnlock`, sobald die Folge getippt ist. Tasten in einem
 * Eingabefeld und Tasten mit Strg, Alt oder Meta zählen nicht (weder für noch gegen die Folge).
 */
export function useKonami(isEnabled: boolean, onUnlock: () => void): void {
  const unlock = useEffectEvent(onUnlock);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    let position = 0;
    function handleKeyDown(event: KeyboardEvent): void {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.repeat ||
        isTextTarget(event.target)
      ) {
        return;
      }
      const key: string = keyName(event.key);
      if (key === KONAMI_SEQUENCE[position]) {
        position += 1;
      } else {
        position = key === KONAMI_SEQUENCE[0] ? 1 : 0;
      }
      if (position === KONAMI_SEQUENCE.length) {
        position = 0;
        unlock();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled]);
}
