import type { VaultHit } from '@/lib/bindings/VaultHit';

type SubgroupDefinition = readonly [id: string, label: string];

/** Gruppen der Bibliothek in der Reihenfolge des Dialogs; die Untergruppen des Wissens sind die
 *  Ordner unter `_vault/` und kommen aus den Treffern. */
export const LIBRARY_GROUPS = [
  {
    id: 'anweisungen',
    label: 'Anweisungen',
    subs: [
      ['grundregeln', 'Grundregeln'],
      ['ausgabestile', 'Ausgabestile'],
      ['gedaechtnis', 'Gedächtnis'],
    ],
  },
  {
    id: 'skills',
    label: 'Skills',
    subs: [
      ['arbeitsweise', 'Arbeitsweise'],
      ['sprachen', 'Sprachen'],
      ['frameworks', 'Frameworks'],
      ['werkzeuge', 'Werkzeuge'],
      ['befehle', 'Befehle'],
    ],
  },
  { id: 'wissen', label: 'Wissen', subs: [] },
] as const;

export const KNOWLEDGE_GROUP = 'wissen';
export const ALL_SCOPE = 'all';
export const RECENT_COUNT = 10;
/** Ohne Gruppenwahl zeigt jeder Abschnitt höchstens so viele Einträge. */
export const SECTION_LIMIT = 4;

const ROOT_LABEL = 'Hauptordner';

/** `all` · `<Gruppe>` · `<Gruppe>/<Untergruppe>` (die Untergruppe darf leer sein: `wissen/`). */
export function scopeOfGroup(group: string): string {
  return group;
}

export function scopeOfSubgroup(group: string, subgroup: string): string {
  return `${group}/${subgroup}`;
}

export interface ParsedScope {
  group: string | null;
  subgroup: string | null;
}

export function parseScope(scope: string): ParsedScope {
  if (scope === ALL_SCOPE) {
    return { group: null, subgroup: null };
  }
  const slash: number = scope.indexOf('/');
  if (slash < 0) {
    return { group: scope, subgroup: null };
  }
  return { group: scope.slice(0, slash), subgroup: scope.slice(slash + 1) };
}

export function inScope(hit: VaultHit, scope: string): boolean {
  const { group, subgroup }: ParsedScope = parseScope(scope);
  if (group === null) {
    return true;
  }
  return hit.group === group && (subgroup === null || hit.subgroup === subgroup);
}

export function groupLabel(group: string): string {
  return LIBRARY_GROUPS.find((entry) => entry.id === group)?.label ?? group;
}

/** Label der Untergruppe; im Wissen der Ordnername, leer = „Hauptordner“. */
export function subgroupLabel(group: string, subgroup: string): string {
  if (group === KNOWLEDGE_GROUP) {
    return subgroup === '' ? ROOT_LABEL : subgroup;
  }
  const definitions: readonly SubgroupDefinition[] =
    LIBRARY_GROUPS.find((entry) => entry.id === group)?.subs ?? [];
  return definitions.find((entry: SubgroupDefinition) => entry[0] === subgroup)?.[1] ?? subgroup;
}

export interface SubgroupCount {
  subgroup: string;
  label: string;
  count: number;
}

export interface GroupCount {
  group: string;
  label: string;
  count: number;
  subs: SubgroupCount[];
}

function compareKnowledgeFolders(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left === '') {
    return 1;
  }
  if (right === '') {
    return -1;
  }
  return left.localeCompare(right, 'de');
}

function subgroupOrder(group: string, subgroups: string[]): string[] {
  if (group === KNOWLEDGE_GROUP) {
    return [...subgroups].sort(compareKnowledgeFolders);
  }
  const definitions: readonly SubgroupDefinition[] =
    LIBRARY_GROUPS.find((entry) => entry.id === group)?.subs ?? [];
  const known: string[] = definitions
    .map((entry: SubgroupDefinition) => entry[0])
    .filter((id: string) => subgroups.includes(id));
  const unknown: string[] = subgroups
    .filter((id: string) => !known.includes(id))
    .sort((left: string, right: string) => left.localeCompare(right, 'de'));
  return [...known, ...unknown];
}

/** Gruppen mit Zahl unter den geladenen Treffern, in der Reihenfolge von `LIBRARY_GROUPS`; Gruppen
 *  und Untergruppen ohne Treffer fehlen. */
export function groupCounts(hits: VaultHit[]): GroupCount[] {
  const counts: GroupCount[] = [];
  for (const definition of LIBRARY_GROUPS) {
    const inGroup: VaultHit[] = hits.filter((hit: VaultHit) => hit.group === definition.id);
    if (inGroup.length === 0) {
      continue;
    }
    const perSubgroup = new Map<string, number>();
    for (const hit of inGroup) {
      perSubgroup.set(hit.subgroup, (perSubgroup.get(hit.subgroup) ?? 0) + 1);
    }
    counts.push({
      group: definition.id,
      label: definition.label,
      count: inGroup.length,
      subs: subgroupOrder(definition.id, Array.from(perSubgroup.keys())).map(
        (subgroup: string): SubgroupCount => ({
          subgroup,
          label: subgroupLabel(definition.id, subgroup),
          count: perSubgroup.get(subgroup) ?? 0,
        }),
      ),
    });
  }
  return counts;
}

export interface VaultSection {
  /** `recent` oder `<Gruppe>/<Untergruppe>`. */
  key: string;
  group: string;
  subgroup: string;
  /** `null` bei „Zuletzt geändert“ und in einer gewählten Untergruppe (dort steht sie schon links). */
  label: string | null;
  isRecent: boolean;
  items: VaultHit[];
  /** Zahl aller Einträge der Untergruppe, wenn `items` gekürzt ist; sonst 0. */
  more: number;
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
        group: '',
        subgroup: '',
        label: null,
        isRecent: true,
        items: scoped.slice(0, RECENT_COUNT),
        more: 0,
      },
    ];
  }
  const limit: number = scope === ALL_SCOPE ? SECTION_LIMIT : Number.POSITIVE_INFINITY;
  const isSubgroupScope: boolean = parseScope(scope).subgroup !== null;
  return groupCounts(scoped).flatMap((entry: GroupCount): VaultSection[] =>
    entry.subs.map((sub: SubgroupCount): VaultSection => {
      const items: VaultHit[] = scoped.filter(
        (hit: VaultHit) => hit.group === entry.group && hit.subgroup === sub.subgroup,
      );
      return {
        key: scopeOfSubgroup(entry.group, sub.subgroup),
        group: entry.group,
        subgroup: sub.subgroup,
        label: isSubgroupScope ? null : sub.label,
        isRecent: false,
        items: items.slice(0, limit),
        more: items.length > limit ? items.length : 0,
      };
    }),
  );
}

export function visibleHits(sections: VaultSection[]): VaultHit[] {
  return sections.flatMap((section: VaultSection) => section.items);
}
