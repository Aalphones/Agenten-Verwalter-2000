import type { LoadState } from '@/features/files/buildTreeRows';
import type { RepoGroup } from '@/features/files/mergeGroups';
import type { FileLinkTarget } from '@/lib/bindings/FileLinkTarget';
import type { RepoTree } from '@/lib/bindings/RepoTree';
import type { SessionFile } from '@/lib/bindings/SessionFile';
import type { SessionFileGroup } from '@/lib/bindings/SessionFileGroup';
import type { SessionFilesListing } from '@/lib/bindings/SessionFilesListing';
import { useArtifactsStore } from '@/stores/artifacts';
import { useFilesStore } from '@/stores/files';
import type { PendingLink } from '@/stores/files';
import { useSessionsStore } from '@/stores/sessions';

/** Ein Linkziel, das die App selbst zeigt; `external` öffnet der Aufrufer im Standardprogramm. */
export type ShownLinkTarget = Exclude<FileLinkTarget, { kind: 'external' }>;

/** Ein Link, den der Reiter „Dateien“ in den Bäumen der Repositories auflöst. */
export type RepoPendingLink = Exclude<PendingLink, { kind: 'session' }>;

/** Die Session, in deren Chat geklickt wurde. */
export interface LinkSession {
  sessionId: string;
  projectId: string;
}

/** Was „Dateien“ mit einem Dateilink aus dem Chat jetzt tun kann. */
export type LinkOutcome =
  | { kind: 'wait' }
  | { kind: 'open'; group: RepoGroup; entryKey: string; path: string; line: number | null }
  | { kind: 'search'; name: string }
  | { kind: 'missing'; message: string };

/** Eine Datei der Liste samt der Gruppe, unter der sie steht. */
export interface SessionFileMatch {
  group: SessionFileGroup;
  file: SessionFile;
}

const WINDOWS_PATH = /^(?:[a-z]:[\\/]|\\\\)/i;

/** Schlüssel der Auswahl, die zum Chat der Session gehört. */
export function filesViewKeyOfSession(sessionId: string): string {
  return `session:${sessionId}`;
}

function pendingLinkOf(target: Exclude<ShownLinkTarget, { kind: 'artifact' }>): PendingLink {
  switch (target.kind) {
    case 'view':
      return { kind: 'view', key: target.key, path: target.path, line: target.line };
    case 'name':
      return { kind: 'name', name: target.name };
    case 'sessionFile':
      return { kind: 'session', path: target.path, real: target.real, line: target.line };
  }
}

/** Führt zum Ziel eines Dateilinks: ein Artefakt wählt der Reiter „Artefakte“ aus; alles andere merkt sich der
 *  Reiter „Dateien“, und `FilesView` öffnet es, sobald Changes (für einen Namen auch die Bäume aller
 *  Repositories) bzw. die Session-Dateien geladen sind. */
export function openFromLink(session: LinkSession, target: ShownLinkTarget): void {
  if (target.kind === 'artifact') {
    useArtifactsStore.getState().select(session.projectId, target.file);
    useSessionsStore.getState().showView('artifacts');
    return;
  }
  useFilesStore
    .getState()
    .update(filesViewKeyOfSession(session.sessionId), { pendingLink: pendingLinkOf(target) });
  useSessionsStore.getState().showView('files');
}

/** Unter Windows zählen weder Groß-/Kleinschreibung noch die Richtung der Trennzeichen. */
function comparablePath(path: string): string {
  return WINDOWS_PATH.test(path) ? path.replace(/\//g, '\\').toLowerCase() : path;
}

/** Die Datei in der Liste, zuerst nach dem echten, dann nach dem genannten Pfad. Führen mehrere Sessions sie,
 *  gewinnt die klickende: der Core stellt ihre Gruppe nach vorn. */
export function findSessionFile(
  listing: SessionFilesListing,
  real: string,
  path: string,
): SessionFileMatch | null {
  for (const wanted of [comparablePath(real), comparablePath(path)]) {
    for (const group of listing.groups) {
      const file: SessionFile | undefined = group.files.find(
        (candidate: SessionFile) => comparablePath(candidate.path) === wanted,
      );
      if (file !== undefined) {
        return { group, file };
      }
    }
  }
  return null;
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
  pending: RepoPendingLink,
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
