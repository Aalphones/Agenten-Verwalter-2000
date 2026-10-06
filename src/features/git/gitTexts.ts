import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitOperation } from '@/lib/bindings/GitOperation';

export const DETACHED_HEAD_LABEL = 'losgelöst';
export const LOCKED_TITLE = 'Gesperrt, solange der Agent arbeitet';

export const LOCK_HINT_OWN_BEFORE = 'Der Agent arbeitet: ';
export const LOCK_HINT_OWN_AFTER = ' warten, bis er ruht. Commit und Push gehen.';
export const LOCK_HINT_LOCKED_ACTIONS: readonly string[] = [
  'Branch wechseln',
  'Pull',
  'Verwerfen',
  'Stash',
  'Merge',
];

export const FAILURE = {
  commit: 'Commit fehlgeschlagen',
  push: 'Push fehlgeschlagen',
  pull: 'Pull fehlgeschlagen',
  pullThenPush: 'Pull, dann Push fehlgeschlagen',
  fetch: 'Fetch fehlgeschlagen',
  switchBranch: 'Wechsel fehlgeschlagen',
  createBranch: 'Branch anlegen fehlgeschlagen',
  abort: 'Abbrechen fehlgeschlagen',
  pause: 'Pausieren fehlgeschlagen',
  discard: 'Verwerfen fehlgeschlagen',
  stashPush: 'Beiseitelegen fehlgeschlagen',
  stashPop: 'Zurückholen fehlgeschlagen',
  pullRebase: 'Pull mit Rebase fehlgeschlagen',
  merge: 'Merge fehlgeschlagen',
  deleteBranch: 'Branch löschen fehlgeschlagen',
  ticketWorktree: 'Ticket-Worktree anlegen fehlgeschlagen',
  open: 'Öffnen fehlgeschlagen',
} as const;

/** Beginn des Fehlersatzes, mit dem der Core einen ungemergten Branch beim Löschen meldet. */
export const NOT_MERGED_PREFIX = 'not-merged:';

export const DISCARD_TITLE = 'Änderung verwerfen …';
export const DISCARD_LOCKED_TITLE = 'Wartet, bis der Agent ruht';
export const NO_STASH_TEXT = 'Kein Stash vorhanden';

export function discardQuestion(path: string): string {
  return `${path} wird auf den letzten Commit zurückgesetzt. Das lässt sich nicht rückgängig machen.`;
}

export function notMergedQuestion(branch: string): string {
  return `${branch} ist nicht gemergt. Trotzdem löschen?`;
}

/** Nur der Haupt-Checkout eines Repositorys (`<P>`) bekommt einen Ticket-Worktree daneben. */
export function isMainCheckoutKey(key: string): boolean {
  return !key.includes('/') && !key.includes(':');
}

/** Beginnt der Fehlersatz des Core so, ist der Commit schon da — dann steht kein „Commit fehlgeschlagen“ davor. */
export const COMMIT_CREATED_PREFIX = 'Commit angelegt';

export const COMMIT_MESSAGE_MISSING = 'Erst eine Nachricht eingeben, dann committen.';
export const AMEND_ONLY_UNPUSHED =
  'Ergänzen geht nur, solange der letzte Commit nicht gepusht ist.';
export const PUSH_REJECTED_PULL_LOCKED = 'Pull ist gesperrt, solange der Agent arbeitet';
export const BRANCH_MENU_LOCKED = 'Wechseln gesperrt, solange der Agent hier arbeitet.';
export const BRANCH_IN_WORKTREE_TITLE = 'In einem anderen Worktree ausgecheckt';

const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Die Art eines Eintrags nach seinem Schlüssel (`<P>`, `<P>/<Ordner>`, `<P>:<inneres Repository>`); der Ticket-
 *  Worktree eines inneren Repositories trägt `<P>:<Ordner>` und im Namen ` · `. */
export function entryKindLabel(key: string, name: string): string {
  if (key.includes('/') || (key.includes(':') && name.includes(' · '))) {
    return 'Ticket-Worktree';
  }
  return key.includes(':') ? 'Inneres Repository' : 'Haupt-Checkout';
}

export function branchLabel(branch: string | null): string {
  return branch ?? DETACHED_HEAD_LABEL;
}

export function filesLabel(count: number): string {
  return count === 1 ? '1 Datei' : `${String(count)} Dateien`;
}

export function commitButtonLabel(checkedCount: number): string {
  return checkedCount === 0 ? 'Commit' : `Commit · ${filesLabel(checkedCount)}`;
}

export function commitPlaceholder(branch: string | null): string {
  return `Nachricht (Strg+Enter committet auf „${branchLabel(branch)}“)`;
}

export function fetchStampText(lastFetchMs: number | null): string {
  if (lastFetchMs === null) {
    return 'noch kein Fetch in dieser Sitzung';
  }
  return `Stand vom letzten Fetch: ${TIME_FORMAT.format(lastFetchMs)}`;
}

export function pullTitle(entry: GitEntryStatus): string {
  return `Pull — ${String(entry.behind)} eingehend\n${fetchStampText(entry.lastFetchMs)}`;
}

export function pushTitle(entry: GitEntryStatus): string {
  return `Push — ${String(entry.ahead)} ausgehend\n${fetchStampText(entry.lastFetchMs)}`;
}

export const PUBLISH_TITLE = 'Branch zum ersten Mal pushen';

export function operationText(operation: GitOperation, conflictCount: number): string {
  if (operation === 'rebase') {
    return 'Rebase angehalten';
  }
  const files: string = conflictCount === 1 ? '1 Datei' : `${String(conflictCount)} Dateien`;
  return `Merge mit Konflikten in ${files}`;
}

export function abortLabel(operation: GitOperation): string {
  return operation === 'rebase' ? 'Rebase abbrechen' : 'Merge abbrechen';
}

export function pushRejectedText(entry: GitEntryStatus): string {
  const upstream: string = entry.upstream ?? `origin/${branchLabel(entry.branch)}`;
  if (entry.behind === 1) {
    return `${upstream} hat 1 Commit, den du noch nicht hast. Erst holen, dann pushen.`;
  }
  return `${upstream} hat ${String(entry.behind)} Commits, die du noch nicht hast. Erst holen, dann pushen.`;
}

export function switchQuestion(changeCount: number, entryName: string): string {
  const changes: string =
    changeCount === 1
      ? '1 ungecommittete Änderung'
      : `${String(changeCount)} ungecommittete Änderungen`;
  return `${changes} in ${entryName}. Was soll mit ihnen passieren?`;
}

export function busyOtherSessionText(number: number, name: string): string {
  return `Session #${String(number)} „${name}“ arbeitet gerade.`;
}
