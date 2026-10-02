import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';

export type SidebarRow =
  | {
      kind: 'project';
      key: string;
      project: ProjectSummary;
      sessions: readonly SessionSummary[];
      isExpanded: boolean;
    }
  | { kind: 'session'; key: string; session: SessionSummary; isLast: boolean };

export interface SidebarProjectEntry {
  project: ProjectSummary;
  /** Sessions des Vorhabens, zuletzt aktive zuerst. */
  sessions: readonly SessionSummary[];
  isExpanded: boolean;
}

/** Die flache Zeilenliste der Sidebar: je Vorhaben seine Zeile und die Sessions der aufgeklappten Vorhaben. */
export function buildSidebarRows(projects: readonly SidebarProjectEntry[]): SidebarRow[] {
  const rows: SidebarRow[] = [];
  for (const { project, sessions, isExpanded } of projects) {
    rows.push({ kind: 'project', key: `project:${project.id}`, project, sessions, isExpanded });
    if (!isExpanded) {
      continue;
    }
    sessions.forEach((session: SessionSummary, index: number) => {
      rows.push({
        kind: 'session',
        key: `session:${session.id}`,
        session,
        isLast: index === sessions.length - 1,
      });
    });
  }
  return rows;
}
