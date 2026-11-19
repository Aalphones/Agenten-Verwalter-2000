import { formatDuration } from '@/features/background/backgroundLabels';
import { runClockLabel, runView } from '@/features/runs/runTexts';
import type { RunInput } from '@/features/runs/runTexts';
import type { AwaitedScript } from '@/lib/bindings/AwaitedScript';
import type { RunStatus } from '@/lib/bindings/RunStatus';
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

/**
 * Status, wie die Sidebar ihn zeigt: `handoff` = abgeschlossen mit Einstiegszeile, Folgesession noch nicht gestartet (ADR 027);
 * `script` = abgeschlossen, aber ein Hintergrund-Befehl läuft noch (ADR 032).
 */
export type DisplayStatus = SessionStatus | 'handoff' | 'script';

export const HANDOFF_LABEL = 'wartet auf Wiedereinstieg';

/** `sessions`: alle bekannten Sessions (oder die des Vorhabens). */
export function displayStatus(
  session: SessionSummary,
  sessions: readonly SessionSummary[],
): DisplayStatus {
  // Der Core liefert `awaitedScript` nur bei `completed`.
  if (session.awaitedScript !== null) {
    return 'script';
  }
  if (session.status !== 'completed' || session.handoffLines.length === 0) {
    return session.status;
  }
  const hasFollowUp: boolean = sessions.some(
    (other: SessionSummary) =>
      other.projectId === session.projectId &&
      other.number > session.number &&
      other.status !== 'new',
  );
  return hasFollowUp ? session.status : 'handoff';
}

/** Kurzangabe eines Laufs: `noch ~1:25`, sonst `12/40`, sonst die Laufzeit; unter 5 s die Laufzeit mit Zehntel. */
function runClock(run: RunInput, now: number): string {
  const clock: string = runClockLabel(runView(run, now));
  return clock === '' ? formatDuration(now - run.startedAt) : clock;
}

/** Der Befehl, der gerade läuft: bei einer fertigen Session der wartende, sonst der laufende; `null` ohne. */
export function activeRun(session: SessionSummary): (RunInput & { target: string }) | null {
  if (session.awaitedScript !== null) {
    const script: AwaitedScript = session.awaitedScript;
    return { ...script, target: script.description ?? script.title };
  }
  if (session.runningCommand !== null) {
    const command: RunStatus = session.runningCommand;
    return { ...command, target: command.description ?? command.command };
  }
  return null;
}

/** „wartet auf Skript · noch ~2:14“, bei mehreren „wartet auf 2 Skripte · …“; gezählt wird der älteste Befehl. */
export function scriptLabel(script: AwaitedScript, now: number): string {
  const duration: string = runClock(script, now);
  if (script.count === 1) {
    return `wartet auf Skript · ${duration}`;
  }
  return `wartet auf ${String(script.count)} Skripte · ${duration}`;
}

/** Status in der Kopfzeile: wie `displayStatus`, aber ohne `handoff` (dort gilt der Session-Status). */
export function headerStatus(session: SessionSummary): SessionStatus | 'script' {
  return session.awaitedScript === null ? session.status : 'script';
}

/** Text der Status-Pille in der Kopfzeile, z.B. „Läuft“ oder „Wartet auf Skript · 2:14“. */
export function headerStatusLabel(session: SessionSummary, now: number): string {
  if (session.awaitedScript === null) {
    const command: RunStatus | null = session.runningCommand;
    if (session.status === 'running' && command !== null) {
      const clock: string = runClockLabel(runView(command, now));
      return clock === '' ? STATUS_LABEL.running : `${STATUS_LABEL.running} · ${clock}`;
    }
    return STATUS_LABEL[session.status];
  }
  const label: string = scriptLabel(session.awaitedScript, now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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
      return session.inquiryOf === null ? 'noch nicht gestartet' : 'Rückfrage zur Umsetzung';
    case 'completed':
    case 'cancelled':
      return null;
    case 'starting':
    case 'running':
      return session.awaitingSubagent ? 'wartet auf Subagent' : modelAndRepositories(session);
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
