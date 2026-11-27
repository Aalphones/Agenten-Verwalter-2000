import type { SessionSummary } from '@/lib/bindings/SessionSummary';

/**
 * Die Rückfrage, die die Kommentare des Berichts bekommt: die neueste Session der Umsetzung mit `inquiryOf`
 * (auch eine von Hand angelegte); `null`, wenn es noch keine gibt. Stationen sind nie Ziel.
 */
export function reportTargetSession(
  sessions: readonly SessionSummary[],
  implementationId: string,
): SessionSummary | null {
  let newest: SessionSummary | null = null;
  for (const session of sessions) {
    if (session.inquiryOf !== implementationId) {
      continue;
    }
    if (newest === null || session.createdAt > newest.createdAt) {
      newest = session;
    }
  }
  return newest;
}
