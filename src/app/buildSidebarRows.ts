import {
  liveStations,
  NEEDS_USER_STATES,
  type StationRef,
} from '@/features/implementation/implementationOrder';
import { visibleSessions } from '@/features/projects/projectStatus';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';

/** Ab so vielen Sessions kürzt die Sidebar ein aufgeklapptes Vorhaben. */
export const COLLAPSE_FROM = 5;
/** So viele der zuletzt aktiven Sessions bleiben im gekürzten Vorhaben sichtbar. */
export const VISIBLE_COUNT = 3;

export type SidebarRow =
  | {
      kind: 'project';
      key: string;
      project: ProjectSummary;
      sessions: readonly SessionSummary[];
      isExpanded: boolean;
    }
  | { kind: 'implementation'; key: string; implementation: ImplementationView; isLast: boolean }
  | {
      kind: 'station';
      key: string;
      implementationId: string;
      entry: StationRef;
      /** `true`: eine Ebene unter der Umsetzung; `false`: auf Höhe der Umsetzungen (zugeklapptes Vorhaben). */
      isNested: boolean;
      isLast: boolean;
    }
  | { kind: 'session'; key: string; session: SessionSummary; isLast: boolean }
  | {
      kind: 'more';
      key: string;
      projectId: string;
      /** Anzahl der ausgeblendeten Sessions; im aufgeklappten Zustand die der eingeklappten Ansicht. */
      hiddenCount: number;
      isShowingAll: boolean;
    };

export interface SidebarProjectEntry {
  project: ProjectSummary;
  /** Sessions des Vorhabens samt Stationen, zuletzt aktive zuerst; Stationen bekommen keine Session-Zeile,
   *  aktive erscheinen als Stationszeile (ADR 056). */
  sessions: readonly SessionSummary[];
  /** Umsetzungen des Vorhabens, neueste zuerst (ADR 048). */
  implementations: readonly ImplementationView[];
  isExpanded: boolean;
  /** `true`: alle Sessions zeigen, auch bei langer Liste. */
  showAll: boolean;
  /** Sessions, die auch in der gekürzten Liste stehen bleiben (die offene und die, die gerade umbenannt wird). */
  pinnedIds: ReadonlySet<string>;
}

/** Die flache Zeilenliste der Sidebar: je Vorhaben seine Zeile, bei aufgeklappten Vorhaben darunter
 *  ihre Umsetzungen samt aktiven Stationen und Sessions, bei zugeklappten die Stationen, die auf den
 *  Benutzer warten. */
export function buildSidebarRows(projects: readonly SidebarProjectEntry[]): SidebarRow[] {
  const rows: SidebarRow[] = [];
  for (const entry of projects) {
    const { project, sessions, isExpanded } = entry;
    const projectRow: SidebarRow = {
      kind: 'project',
      key: `project:${project.id}`,
      project,
      sessions,
      isExpanded,
    };
    const children: SidebarRow[] = isExpanded ? expandedChildren(entry) : waitingChildren(entry);
    rows.push(projectRow, ...markLast(children));
  }
  return rows;
}

function expandedChildren({
  project,
  sessions,
  implementations,
  showAll,
  pinnedIds,
}: SidebarProjectEntry): SidebarRow[] {
  const children: SidebarRow[] = [];
  for (const implementation of implementations) {
    children.push({
      kind: 'implementation',
      key: `implementation:${implementation.id}`,
      implementation,
      isLast: false,
    });
    for (const entry of liveStations(implementation)) {
      children.push(stationRow(implementation.id, entry, true));
    }
  }
  const ownSessions: SessionSummary[] = visibleSessions(sessions);
  const isLong: boolean = ownSessions.length >= COLLAPSE_FROM;
  const shown: SessionSummary[] =
    isLong && !showAll
      ? ownSessions.filter(
          (session: SessionSummary, index: number) =>
            index < VISIBLE_COUNT || pinnedIds.has(session.id),
        )
      : ownSessions;
  const hiddenCount: number = ownSessions.length - shown.length;
  for (const session of shown) {
    children.push({ kind: 'session', key: `session:${session.id}`, session, isLast: false });
  }
  if (isLong && (showAll || hiddenCount > 0)) {
    children.push({
      kind: 'more',
      key: `more:${project.id}`,
      projectId: project.id,
      hiddenCount: showAll ? ownSessions.length - VISIBLE_COUNT : hiddenCount,
      isShowingAll: showAll,
    });
  }
  return children;
}

/** Zugeklappt bleiben nur die Stationen sichtbar, die auf den Benutzer warten. */
function waitingChildren({ implementations }: SidebarProjectEntry): SidebarRow[] {
  const children: SidebarRow[] = [];
  for (const implementation of implementations) {
    for (const entry of liveStations(implementation)) {
      if (NEEDS_USER_STATES.includes(entry.station.state)) {
        children.push(stationRow(implementation.id, entry, false));
      }
    }
  }
  return children;
}

function stationRow(implementationId: string, entry: StationRef, isNested: boolean): SidebarRow {
  return {
    kind: 'station',
    key: `station:${entry.station.id}`,
    implementationId,
    entry,
    isNested,
    isLast: false,
  };
}

/** Die letzte Kindzeile schließt die Baumlinie ab; `more` kennt keine Linie und bleibt unberührt. */
function markLast(children: SidebarRow[]): SidebarRow[] {
  const last: SidebarRow | undefined = children[children.length - 1];
  if (last === undefined || last.kind === 'project' || last.kind === 'more') {
    return children;
  }
  return [...children.slice(0, -1), { ...last, isLast: true }];
}
