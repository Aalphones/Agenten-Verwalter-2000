import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ArtifactMark, ArtifactPick } from '@/features/artifacts/artifactBridge';
import { parsePick } from '@/features/artifacts/artifactBridge';

interface BridgeMessage {
  verwalter: 1;
  type: 'mode' | 'marks';
  on?: boolean;
  marks?: readonly ArtifactMark[];
}

function isReady(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).verwalter === 1 &&
    (data as Record<string, unknown>).type === 'ready'
  );
}

/** Synchronisiert Kommentiermodus und Marken mit dem isolierten Artefakt-Rahmen. */
export function useArtifactPicker(
  frameRef: RefObject<HTMLIFrameElement | null>,
  isOn: boolean,
  marks: readonly ArtifactMark[],
  onPick: (pick: ArtifactPick) => void,
): void {
  useEffect(() => {
    function send(): void {
      const target = frameRef.current?.contentWindow;
      if (target === null || target === undefined) return;
      const mode: BridgeMessage = { verwalter: 1, type: 'mode', on: isOn };
      const nextMarks: BridgeMessage = { verwalter: 1, type: 'marks', marks };
      target.postMessage(mode, '*');
      target.postMessage(nextMarks, '*');
    }

    function handleMessage(event: MessageEvent<unknown>): void {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (isReady(event.data)) {
        send();
        return;
      }
      if (!isOn) return;
      const pick = parsePick(event.data);
      if (pick !== null) onPick(pick);
    }

    window.addEventListener('message', handleMessage);
    send();
    return (): void => {
      window.removeEventListener('message', handleMessage);
    };
  }, [frameRef, isOn, marks, onPick]);
}
