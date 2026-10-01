import type { SessionGroup } from '@/features/sessions/sessionStatus';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';

export type SidebarRow =
  | { kind: 'group'; key: string; group: SessionGroup; count: number; isFirst: boolean }
  | {
      kind: 'project';
      key: string;
      project: ProjectSummary;
      sessions: readonly SessionSummary[];
      isExpanded: boolean;
    }
  | { kind: 'session'; key: string; session: SessionSummary; isLast: boolean };

export interface SidebarGroup {
  group: SessionGroup;
  projects: readonly SidebarGroupProject[];
}

export interface SidebarGroupProject {
  project: ProjectSummary;
  /** Sessions des Vorhabens, aufsteigend nach Nummer. */
  sessions: readonly SessionSummary[];
  isExpanded: boolean;
}

/** Die flache Zeilenliste der Sidebar: je nicht leerer Gruppe Überschrift, Vorhaben und die Sessions der aufgeklappten Vorhaben. */
export function buildSidebarRows(groups: readonly SidebarGroup[]): SidebarRow[] {
  const rows: SidebarRow[] = [];
  for (const { group, projects } of groups) {
    if (projects.length === 0) {
      continue;
    }
    rows.push({
      kind: 'group',
      key: `group:${group}`,
      group,
      count: projects.length,
      isFirst: rows.length === 0,
    });
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
  }
  return rows;
}
