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
  /** Sessions des Vorhabens, zuletzt aktive zuerst. */
  sessions: readonly SessionSummary[];
  isExpanded: boolean;
  /** `true`: alle Sessions zeigen, auch bei langer Liste. */
  showAll: boolean;
  /** Sessions, die auch in der gekürzten Liste stehen bleiben (die offene und die, die gerade umbenannt wird). */
  pinnedIds: ReadonlySet<string>;
}

/** Die flache Zeilenliste der Sidebar: je Vorhaben seine Zeile und die Sessions der aufgeklappten Vorhaben. */
export function buildSidebarRows(projects: readonly SidebarProjectEntry[]): SidebarRow[] {
  const rows: SidebarRow[] = [];
  for (const { project, sessions, isExpanded, showAll, pinnedIds } of projects) {
    rows.push({ kind: 'project', key: `project:${project.id}`, project, sessions, isExpanded });
    if (!isExpanded) {
      continue;
    }
    const isLong: boolean = sessions.length >= COLLAPSE_FROM;
    const shown: SessionSummary[] =
      isLong && !showAll
        ? sessions.filter(
            (session: SessionSummary, index: number) =>
              index < VISIBLE_COUNT || pinnedIds.has(session.id),
          )
        : [...sessions];
    const hiddenCount: number = sessions.length - shown.length;
    const hasMoreRow: boolean = isLong && (showAll || hiddenCount > 0);
    shown.forEach((session: SessionSummary, index: number) => {
      rows.push({
        kind: 'session',
        key: `session:${session.id}`,
        session,
        isLast: !hasMoreRow && index === shown.length - 1,
      });
    });
    if (hasMoreRow) {
      rows.push({
        kind: 'more',
        key: `more:${project.id}`,
        projectId: project.id,
        hiddenCount: showAll ? sessions.length - VISIBLE_COUNT : hiddenCount,
        isShowingAll: showAll,
      });
    }
  }
  return rows;
}
