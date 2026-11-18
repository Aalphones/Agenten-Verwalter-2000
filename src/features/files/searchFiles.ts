import type { LoadState } from '@/features/files/buildTreeRows';
import type { MergedFile, RepoGroup } from '@/features/files/mergeGroups';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { LineStat } from '@/lib/bindings/LineStat';
import type { RepoTree } from '@/lib/bindings/RepoTree';

/** So viele Treffer zeigt die Liste höchstens. */
export const MAX_RESULTS = 40;

const NAME_BASE_SCORE = 1000;
const NAME_START_BONUS = 200;
const PATH_BASE_SCORE = 500;
const SEQUENCE_BASE_SCORE = 100;
const CHANGED_BONUS = 50;
const POSITION_WEIGHT = 0.1;

export interface SearchHit {
  group: string;
  /** Für geänderte Dateien der Eintrag der gezeigten Fassung, sonst der Anker des Knotens. */
  entryKey: string;
  path: string;
  change: FileChange | null;
  /** Zahlen im gewählten Blickwinkel; `null` bei unveränderten Dateien. */
  stat: LineStat | null;
  /** Anfang und Ende des Treffers im Dateinamen (nicht im Pfad); `null`, wenn der Name nicht passt. */
  nameMatch: [number, number] | null;
}

export interface SearchOutcome {
  /** Die besten `MAX_RESULTS`, beste zuerst. */
  hits: SearchHit[];
  /** Alle Treffer, auch die nicht gezeigten. */
  matchCount: number;
  /** Durchsuchte Dateien. */
  fileCount: number;
  /** Knoten, deren Baum noch nicht gelesen ist: dort gelten vorerst nur die geänderten Dateien. */
  pendingGroups: number;
}

interface IndexedTree {
  paths: readonly string[];
  lower: readonly string[];
  known: ReadonlySet<string>;
}

interface Scored {
  group: RepoGroup;
  path: string;
  score: number;
  nameMatch: [number, number] | null;
}

// Der Index (Kleinschreibung, Pfadmenge) entsteht einmal je geladenem Baum, nicht je Tastendruck.
const indexByTree = new WeakMap<RepoTree, IndexedTree>();

function indexOf(tree: RepoTree): IndexedTree {
  const cached: IndexedTree | undefined = indexByTree.get(tree);
  if (cached !== undefined) {
    return cached;
  }
  const paths: string[] = tree.files.map((file) => file.path);
  const created: IndexedTree = {
    paths,
    lower: paths.map((path: string) => path.toLowerCase()),
    known: new Set<string>(paths),
  };
  indexByTree.set(tree, created);
  return created;
}

/** Ob die Zeichen des Suchtexts in Reihenfolge im Pfad vorkommen. */
function isSequence(needle: string, haystack: string): boolean {
  let matched = 0;
  for (let index = 0; index < haystack.length && matched < needle.length; index += 1) {
    if (haystack[index] === needle[matched]) {
      matched += 1;
    }
  }
  return matched === needle.length;
}

/** Wertung eines Pfads nach der README; `null`: kein Treffer. `lower` ist der Pfad in Kleinbuchstaben. */
function scorePath(
  needle: string,
  lower: string,
): { score: number; nameMatch: [number, number] | null } | null {
  const nameStart: number = lower.lastIndexOf('/') + 1;
  const name: string = lower.slice(nameStart);
  const inName: number = name.indexOf(needle);
  if (inName >= 0) {
    const bonus: number = inName === 0 ? NAME_START_BONUS : 0;
    return {
      score: NAME_BASE_SCORE - inName - POSITION_WEIGHT * name.length + bonus,
      nameMatch: [inName, inName + needle.length],
    };
  }
  const inPath: number = lower.indexOf(needle);
  if (inPath >= 0) {
    return { score: PATH_BASE_SCORE - POSITION_WEIGHT * inPath, nameMatch: null };
  }
  if (isSequence(needle, lower)) {
    return { score: SEQUENCE_BASE_SCORE - POSITION_WEIGHT * lower.length, nameMatch: null };
  }
  return null;
}

/** Hält die besten `MAX_RESULTS`; bei gleicher Wertung bleibt der frühere vorn. */
function keepBest(best: Scored[], candidate: Scored): void {
  const worst: Scored | undefined = best[best.length - 1];
  if (best.length >= MAX_RESULTS && worst !== undefined && candidate.score <= worst.score) {
    return;
  }
  let index: number = best.length;
  while (index > 0 && (best[index - 1]?.score ?? 0) < candidate.score) {
    index -= 1;
  }
  best.splice(index, 0, candidate);
  if (best.length > MAX_RESULTS) {
    best.pop();
  }
}

function toHit(scored: Scored): SearchHit {
  const file: MergedFile | undefined = scored.group.byPath.get(scored.path);
  return {
    group: scored.group.group,
    entryKey: file?.shown.entryKey ?? scored.group.anchorKey,
    path: scored.path,
    change: file?.shown.change ?? null,
    stat: file?.shown.stat ?? null,
    nameMatch: scored.nameMatch,
  };
}

function stateOf(
  group: RepoGroup,
  trees: ReadonlyMap<string, LoadState<RepoTree>>,
): LoadState<RepoTree> | undefined {
  return trees.get(group.anchorKey);
}

/** Leeres Suchfeld: die geänderten Dateien, zuletzt geänderte zuerst. */
function recentlyChanged(groups: readonly RepoGroup[]): Scored[] {
  const best: Scored[] = [];
  for (const group of groups) {
    for (const file of group.files) {
      keepBest(best, {
        group,
        path: file.path,
        score: file.shown.change.changedAt,
        nameMatch: null,
      });
    }
  }
  return best;
}

/** Sucht in den Pfaden der Bäume (nie ignorierte Einträge) nach Name und Pfad, ohne Unterschied der Groß- und
 *  Kleinschreibung; `Readme.md` und `README.md` sind zwei Pfade und damit zwei Treffer. Die Wertung steht in der
 *  README des Plans. Ein Knoten ohne gelesenen Baum liefert vorerst nur seine geänderten Dateien. */
export function searchFiles(
  query: string,
  groups: readonly RepoGroup[],
  trees: ReadonlyMap<string, LoadState<RepoTree>>,
): SearchOutcome {
  const needle: string = query.trim().toLowerCase();
  let fileCount = 0;
  let pendingGroups = 0;
  let matchCount = 0;
  const best: Scored[] = [];

  for (const group of groups) {
    const state: LoadState<RepoTree> | undefined = stateOf(group, trees);
    // Ein Baum mit Fehler wird nicht mehr „gelesen“; dort bleiben die geänderten Dateien.
    if (state === undefined || state.status === 'loading') {
      pendingGroups += 1;
    }
    const indexed: IndexedTree | null = state?.status === 'ready' ? indexOf(state.value) : null;
    fileCount += indexed === null ? group.files.length : indexed.paths.length;

    const consider = (path: string, lower: string): void => {
      const scored = scorePath(needle, lower);
      if (scored === null) {
        return;
      }
      matchCount += 1;
      const changedBonus: number = group.byPath.has(path) ? CHANGED_BONUS : 0;
      keepBest(best, {
        group,
        path,
        score: scored.score + changedBonus,
        nameMatch: scored.nameMatch,
      });
    };

    if (needle === '') {
      continue;
    }
    if (indexed !== null) {
      for (let index = 0; index < indexed.paths.length; index += 1) {
        consider(indexed.paths[index] ?? '', indexed.lower[index] ?? '');
      }
    }
    // Gelöschte Pfade fehlen im Ordner; ohne gelesenen Baum sind die geänderten Dateien alles, was bekannt ist.
    for (const file of group.files) {
      if (indexed === null || !indexed.known.has(file.path)) {
        consider(file.path, file.path.toLowerCase());
      }
    }
  }

  if (needle === '') {
    for (const group of groups) {
      matchCount += group.files.length;
    }
    return { hits: recentlyChanged(groups).map(toHit), matchCount, fileCount, pendingGroups };
  }
  return { hits: best.map(toHit), matchCount, fileCount, pendingGroups };
}
