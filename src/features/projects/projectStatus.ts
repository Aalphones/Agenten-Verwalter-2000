import { metaLine } from '@/features/sessions/sessionStatus';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';

/** Vom Dringendsten zum Unwichtigsten — die dringendste Session bestimmt das Symbol des Vorhabens. */
export const URGENCY: readonly SessionStatus[] = [
  'waiting',
  'error',
  'running',
  'starting',
  'paused',
  'new',
  'completed',
  'cancelled',
];

const SHORT_STATUS: Record<SessionStatus, string> = {
  starting: 'startet',
  running: 'läuft',
  waiting: 'wartet auf dich',
  paused: 'pausiert',
  new: 'neu',
  error: 'Fehler',
  completed: 'abgeschlossen',
  cancelled: 'abgebrochen',
};

/** Sessions eines Vorhabens, aufsteigend nach Nummer. */
export function sessionsOf(
  projectId: string,
  sessions: readonly SessionSummary[],
): SessionSummary[] {
  return sessions
    .filter((session: SessionSummary) => session.projectId === projectId)
    .sort((first: SessionSummary, second: SessionSummary) => first.number - second.number);
}

/** Sessions eines Vorhabens, zuletzt aktive zuerst — die Reihenfolge in der Sidebar. */
export function sessionsByActivity(
  projectId: string,
  sessions: readonly SessionSummary[],
): SessionSummary[] {
  return sessions
    .filter((session: SessionSummary) => session.projectId === projectId)
    .sort(
      (first: SessionSummary, second: SessionSummary) =>
        second.lastActivityAt - first.lastActivityAt || second.number - first.number,
    );
}

/** Jüngste Aktivität im Vorhaben; ohne Sessions sein Anlegezeitpunkt. */
export function projectActivity(
  project: ProjectSummary,
  sessions: readonly SessionSummary[],
): number {
  return sessions.reduce(
    (latest: number, session: SessionSummary) => Math.max(latest, session.lastActivityAt),
    project.createdAt,
  );
}

export function hasUnread(sessions: readonly SessionSummary[]): boolean {
  return sessions.some((session: SessionSummary) => session.unread);
}

/** Die dringendste Session; bei Gleichstand die mit der höheren Nummer. */
export function mostUrgent(sessions: readonly SessionSummary[]): SessionSummary | null {
  let best: SessionSummary | null = null;
  for (const session of sessions) {
    if (best === null) {
      best = session;
      continue;
    }
    const rank: number = URGENCY.indexOf(session.status);
    const bestRank: number = URGENCY.indexOf(best.status);
    if (rank < bestRank || (rank === bestRank && session.number > best.number)) {
      best = session;
    }
  }
  return best;
}

/** Zweite Zeile eines Vorhabens in der Sidebar; `null`, wenn es nichts Nützliches zu sagen gibt. */
export function projectMetaLine(sessions: readonly SessionSummary[]): string | null {
  const urgent: SessionSummary | null = mostUrgent(sessions);
  if (urgent === null) {
    return null;
  }
  if (sessions.length === 1) {
    return metaLine(urgent);
  }
  if (urgent.status === 'completed' || urgent.status === 'cancelled') {
    return null;
  }
  return `${String(sessions.length)} Sessions · #${String(urgent.number)} ${SHORT_STATUS[urgent.status]}`;
}
