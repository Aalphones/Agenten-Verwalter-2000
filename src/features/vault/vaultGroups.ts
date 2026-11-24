import type { VaultHit } from '@/lib/bindings/VaultHit';

/** Gruppen des Dialogs. In Phase 6 gibt es nur „Wissen“ (der Vault-Ordner); Anweisungen und Skills
 *  kommen mit dem Folgeplan Bibliothek. */
export const VAULT_GROUPS = [{ id: 'wissen', label: 'Wissen' }] as const;

export const ALL_SCOPE = 'all';
export const RECENT_COUNT = 10;
/** Ohne Gruppenwahl zeigt jeder Abschnitt höchstens so viele Einträge. */
export const SECTION_LIMIT = 4;

const ROOT_LABEL = 'Hauptordner';

/** Der erste Ordner im Pfad; leer bei einer Datei im Wurzelordner des Vault. */
export function folderOf(path: string): string {
  const slash: number = path.indexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}

export function folderLabel(folder: string): string {
  return folder === '' ? ROOT_LABEL : folder;
}

/** `wissen` für die ganze Gruppe, `wissen/<Ordner>` für eine Untergruppe, sonst `all`. */
export function scopeOfFolder(folder: string): string {
  return `wissen/${folder}`;
}

export function scopeFolder(scope: string): string | null {
  return scope.startsWith('wissen/') ? scope.slice('wissen/'.length) : null;
}

function inScope(hit: VaultHit, scope: string): boolean {
  const folder: string | null = scopeFolder(scope);
  return folder === null || folderOf(hit.path) === folder;
}

export interface VaultSection {
  /** `recent` oder der Ordner der Untergruppe (leer für den Hauptordner). */
  key: string;
  /** `null` bei „Zuletzt geändert“ und in einer gewählten Untergruppe (dort steht der Ordner schon links). */
  label: string | null;
  isRecent: boolean;
  items: VaultHit[];
  /** Zahl aller Einträge der Untergruppe, wenn `items` gekürzt ist; sonst 0. */
  more: number;
}

export interface VaultFolderCount {
  folder: string;
  count: number;
}

/** Untergruppen mit Zahl der Einträge unter den geladenen Treffern, in der Reihenfolge ihres ersten Treffers. */
export function folderCounts(hits: VaultHit[]): VaultFolderCount[] {
  const counts = new Map<string, number>();
  for (const hit of hits) {
    const folder: string = folderOf(hit.path);
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return Array.from(counts, ([folder, count]) => ({ folder, count })).sort(
    (left: VaultFolderCount, right: VaultFolderCount) =>
      left.folder === ''
        ? 1
        : right.folder === ''
          ? -1
          : left.folder.localeCompare(right.folder, 'de'),
  );
}

/** Die Abschnitte der Liste: ohne Suche und ohne Gruppenwahl „Zuletzt geändert“, sonst je Untergruppe. */
export function buildSections(hits: VaultHit[], scope: string, hasQuery: boolean): VaultSection[] {
  const scoped: VaultHit[] = hits.filter((hit: VaultHit) => inScope(hit, scope));
  if (scoped.length === 0) {
    return [];
  }
  if (!hasQuery && scope === ALL_SCOPE) {
    return [
      {
        key: 'recent',
        label: null,
        isRecent: true,
        items: scoped.slice(0, RECENT_COUNT),
        more: 0,
      },
    ];
  }
  const limit: number = scope === ALL_SCOPE ? SECTION_LIMIT : Number.POSITIVE_INFINITY;
  const isFolderScope: boolean = scopeFolder(scope) !== null;
  return folderCounts(scoped).map(({ folder }: VaultFolderCount): VaultSection => {
    const items: VaultHit[] = scoped.filter((hit: VaultHit) => folderOf(hit.path) === folder);
    return {
      key: folder,
      label: isFolderScope ? null : folderLabel(folder),
      isRecent: false,
      items: items.slice(0, limit),
      more: items.length > limit ? items.length : 0,
    };
  });
}

export function visibleHits(sections: VaultSection[]): VaultHit[] {
  return sections.flatMap((section: VaultSection) => section.items);
}
