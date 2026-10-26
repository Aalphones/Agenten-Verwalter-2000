import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { HandoffLine } from '@/lib/bindings/HandoffLine';
import type { KnownRepository } from '@/lib/bindings/KnownRepository';

const SESSION_PREFIX = 'Weiter:';
const PROJECT_PREFIX = 'Neues Vorhaben';
const REPOSITORY_NAME_CHARACTER = /[a-z0-9_-]/;

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

/** Der Auftrag einer Zeile „Neues Vorhaben … : <Auftrag>“ — alles hinter dem ersten Doppelpunkt. */
export function taskOfProjectLine(text: string): string {
  return text.slice(text.indexOf(':') + 1).trim();
}

/** Die Zeile ohne ihr Kennwort („Weiter:“ bzw. „Neues Vorhaben“) — für die Anzeige in einer Reihe. */
export function handoffExcerpt(line: HandoffLine): string {
  const prefix: string = line.kind === 'session' ? SESSION_PREFIX : PROJECT_PREFIX;
  return line.text.slice(prefix.length).trim();
}

/** IDs der vorhandenen Repositories, deren Name in `text` als ganzes Wort steht (ohne Groß-/Kleinschreibung). */
export function matchingRepositoryIds(
  text: string,
  repositories: readonly KnownRepository[],
): string[] {
  const haystack: string = text.toLowerCase();
  return repositories
    .filter(
      (repository: KnownRepository) =>
        !repository.isMissing && containsWholeWord(haystack, repository.name.toLowerCase()),
    )
    .map((repository: KnownRepository) => repository.id);
}

function containsWholeWord(haystack: string, word: string): boolean {
  if (word === '') {
    return false;
  }
  let from = 0;
  for (;;) {
    const index: number = haystack.indexOf(word, from);
    if (index === -1) {
      return false;
    }
    const before: string = haystack.charAt(index - 1);
    const after: string = haystack.charAt(index + word.length);
    const isBounded: boolean =
      (before === '' || !REPOSITORY_NAME_CHARACTER.test(before)) &&
      (after === '' || !REPOSITORY_NAME_CHARACTER.test(after));
    if (isBounded) {
      return true;
    }
    from = index + 1;
  }
}
