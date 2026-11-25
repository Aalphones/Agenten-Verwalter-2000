import type { LoadState } from '@/features/files/buildTreeRows';
import type { RepoGroup } from '@/features/files/mergeGroups';
import type { FileLinkTarget } from '@/lib/bindings/FileLinkTarget';
import type { RepoTree } from '@/lib/bindings/RepoTree';
import { useFilesStore } from '@/stores/files';
import type { PendingLink } from '@/stores/files';
import { useSessionsStore } from '@/stores/sessions';

/** Was „Dateien“ mit einem Dateilink aus dem Chat jetzt tun kann. */
export type LinkOutcome =
  | { kind: 'wait' }
  | { kind: 'open'; group: RepoGroup; entryKey: string; path: string; line: number | null }
  | { kind: 'search'; name: string }
  | { kind: 'missing'; message: string };

/** Schlüssel der Auswahl, die zum Chat der Session gehört. */
export function filesViewKeyOfSession(sessionId: string): string {
  return `session:${sessionId}`;
}

/** Merkt das Ziel eines Dateilinks und schaltet den Reiter „Dateien“ ein; `FilesView` öffnet es, sobald die
 *  Changes (und für einen Namen die Bäume aller Repositories) geladen sind. Alle anderen Ziele öffnet der
 *  Aufrufer. */
export function openFromLink(
  sessionId: string,
  target: Extract<FileLinkTarget, { kind: 'view' | 'name' }>,
): void {
  let pending: PendingLink;
  if (target.kind === 'view') {
    pending = { kind: 'view', key: target.key, path: target.path, line: target.line };
  } else {
    pending = { kind: 'name', name: target.name };
  }
  useFilesStore.getState().update(filesViewKeyOfSession(sessionId), { pendingLink: pending });
  useSessionsStore.getState().showView('files');
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function groupOfEntry(groups: readonly RepoGroup[], key: string): RepoGroup | undefined {
  return groups.find((group: RepoGroup) => group.entries.some((entry) => entry.key === key));
}

/** Der Eintrag, aus dem die Datei geöffnet wird: der genannte, wenn er die Datei geändert hat; sonst die gezeigte
 *  Fassung; ohne Änderung der genannte Eintrag. */
function entryKeyFor(group: RepoGroup, path: string, linkedKey: string): string {
  const file = group.byPath.get(path);
  if (file === undefined) {
    return linkedKey;
  }
  const own = file.variants.find((variant) => variant.entryKey === linkedKey);
  return own?.entryKey ?? file.shown.entryKey;
}

interface NameMatch {
  group: RepoGroup;
  path: string;
}

/** Alle Pfade im Vorhaben, die auf `name` enden; geändert und im Baum Bekanntes zählt einmal. */
function matchesByName(
  name: string,
  groups: readonly RepoGroup[],
  trees: ReadonlyMap<string, LoadState<RepoTree>>,
): NameMatch[] {
  const matches: NameMatch[] = [];
  for (const group of groups) {
    const paths = new Set<string>();
    const state: LoadState<RepoTree> | undefined = trees.get(group.anchorKey);
    if (state?.status === 'ready') {
      for (const file of state.value.files) {
        paths.add(file.path);
      }
    }
    for (const file of group.files) {
      paths.add(file.path);
    }
    for (const path of paths) {
      if (baseName(path) === name) {
        matches.push({ group, path });
      }
    }
  }
  return matches;
}

function isSettled(group: RepoGroup, trees: ReadonlyMap<string, LoadState<RepoTree>>): boolean {
  if (group.anchorKey === '') {
    return true;
  }
  const state: LoadState<RepoTree> | undefined = trees.get(group.anchorKey);
  return state !== undefined && state.status !== 'loading';
}

/** Entscheidet für einen gemerkten Dateilink; bei `wait` später mit neuem Stand erneut aufrufen. */
export function resolvePendingLink(
  pending: PendingLink,
  groups: readonly RepoGroup[],
  trees: ReadonlyMap<string, LoadState<RepoTree>>,
): LinkOutcome {
  if (pending.kind === 'view') {
    const group: RepoGroup | undefined = groupOfEntry(groups, pending.key);
    if (group === undefined) {
      return { kind: 'missing', message: `Datei nicht gefunden: ${pending.path}` };
    }
    return {
      kind: 'open',
      group,
      entryKey: entryKeyFor(group, pending.path, pending.key),
      path: pending.path,
      line: pending.line,
    };
  }
  if (!groups.every((group: RepoGroup) => isSettled(group, trees))) {
    return { kind: 'wait' };
  }
  const matches: NameMatch[] = matchesByName(pending.name, groups, trees);
  const [only] = matches;
  if (only === undefined) {
    return { kind: 'missing', message: `Datei nicht gefunden: ${pending.name}` };
  }
  if (matches.length > 1) {
    return { kind: 'search', name: pending.name };
  }
  return {
    kind: 'open',
    group: only.group,
    entryKey: entryKeyFor(only.group, only.path, only.group.anchorKey),
    path: only.path,
    line: null,
  };
}
