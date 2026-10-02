import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { modelName, repositoryCountLabel } from '@/lib/labels';

export const STATUS_LABEL: Record<SessionStatus, string> = {
  starting: 'Startet',
  running: 'Läuft',
  waiting: 'Wartet',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
  error: 'Fehler',
  new: 'Neu',
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
    case 'new':
      return 'noch nicht gestartet';
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
