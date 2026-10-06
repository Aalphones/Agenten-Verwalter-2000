import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { ModelId } from '@/lib/bindings/ModelId';

const HANDOFF_MODEL_PATTERN = /\bModell\s+(fable|opus|sonnet|haiku)\b/i;

/** `seq` der letzten Textantwort, wenn nach ihr keine Nutzernachricht steht; sonst `null`. */
export function lastAnswerSeq(entries: readonly ChatEntry[]): number | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry: ChatEntry | undefined = entries[index];
    if (entry?.kind === 'user') {
      return null;
    }
    if (entry?.kind === 'text') {
      return entry.seq;
    }
  }
  return null;
}

/** Das Modell, das die Einstiegszeile empfiehlt (`Modell sonnet`); `null` ohne Angabe. */
export function modelOfHandoff(line: string): ModelId | null {
  const match: RegExpMatchArray | null = HANDOFF_MODEL_PATTERN.exec(line);
  const name: string | undefined = match?.[1];
  switch (name?.toLowerCase()) {
    case 'fable':
      return 'fable';
    case 'opus':
      return 'opus';
    case 'sonnet':
      return 'sonnet';
    case 'haiku':
      return 'haiku';
    default:
      return null;
  }
}
