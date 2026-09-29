import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { modelName, repositoryCountLabel } from '@/lib/labels';

export const GROUP_ORDER = ['needsYou', 'running', 'done'] as const;
export type SessionGroup = (typeof GROUP_ORDER)[number];

export const GROUP_LABEL: Record<SessionGroup, string> = {
  needsYou: 'Braucht dich',
  running: 'Läuft',
  done: 'Abgeschlossen',
};

export const STATUS_LABEL: Record<SessionStatus, string> = {
  starting: 'Startet',
  running: 'Läuft',
  waiting: 'Wartet',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
  error: 'Fehler',
};

export const STATUS_GROUP: Record<SessionStatus, SessionGroup> = {
  starting: 'running',
  running: 'running',
  waiting: 'needsYou',
  paused: 'running',
  completed: 'done',
  cancelled: 'done',
  error: 'needsYou',
};

/** Zweite Zeile eines Sidebar-Eintrags; `null`, wenn es nichts Nützliches zu sagen gibt. */
export function metaLine(session: SessionSummary): string | null {
  switch (session.status) {
    case 'waiting':
      return 'wartet auf deine Antwort';
    case 'error':
      return 'Agent-Prozess beendet';
    case 'paused':
      return `pausiert · ${modelAndRepositories(session)}`;
    case 'completed':
    case 'cancelled':
      return null;
    case 'starting':
    case 'running':
      return modelAndRepositories(session);
  }
}

function modelAndRepositories(session: SessionSummary): string {
  if (session.repositoryCount === 0) {
    return modelName(session.model);
  }
  return `${repositoryCountLabel(session.repositoryCount)} · ${modelName(session.model)}`;
}

/** Ob die Meta-Zeile in Statusfarbe statt gedämpft erscheint. */
export function isMetaHighlighted(status: SessionStatus): boolean {
  return status === 'waiting' || status === 'error';
}
