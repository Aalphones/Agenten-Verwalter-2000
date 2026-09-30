import { formatClock } from '@/features/context/formatTokens';
import type { ProjectTldrView } from '@/lib/bindings/ProjectTldrView';
import type { SessionTldrView } from '@/lib/bindings/SessionTldrView';

/** Einträge seit dem TL;DR; 0 ohne TL;DR. */
export function newEntryCount(view: SessionTldrView, entryCount: number): number {
  if (view.tldr === null) {
    return 0;
  }
  return Math.max(0, entryCount - view.seq);
}

export function entriesSinceText(count: number): string {
  if (count === 1) {
    return '1 neuer Eintrag seitdem';
  }
  return `${String(count)} neue Einträge seitdem`;
}

/** „Stand 14:32 · aktuell“ beziehungsweise „Stand 14:32 · 23 neue Einträge seitdem“. */
export function stampText(view: SessionTldrView, entryCount: number): string {
  if (view.createdAt === null) {
    return '';
  }
  const clock: string = formatClock(view.createdAt);
  const added: number = newEntryCount(view, entryCount);
  if (added === 0) {
    return `Stand ${clock} · aktuell`;
  }
  return `Stand ${clock} · ${entriesSinceText(added)}`;
}

/** „aus 3 Session-TL;DRs · Stand 14:32“, bei fehlenden „aus 2 von 3 Session-TL;DRs · Stand 14:32“. */
export function projectStampText(view: ProjectTldrView, sessionsWithHistory: number): string {
  if (view.createdAt === null) {
    return '';
  }
  const clock: string = formatClock(view.createdAt);
  if (sessionsWithHistory > view.sourceCount) {
    return `aus ${String(view.sourceCount)} von ${String(sessionsWithHistory)} Session-TL;DRs · Stand ${clock}`;
  }
  return `aus ${String(view.sourceCount)} Session-TL;DRs · Stand ${clock}`;
}
