import { formatClock } from '@/features/context/formatTokens';
import type { Artifact } from '@/lib/bindings/Artifact';

export const ARTIFACTS_HEADING = 'Artefakte des Vorhabens, neueste zuerst';
export const ARTIFACTS_INFO =
  'Seiten, die ein Agent dieses Vorhabens als HTML abgelegt hat – Bericht, Präsentation, Entwurf. Sie liegen im Ordner .artefakte des Vorhabens und aktualisieren sich, sobald der Agent sie neu speichert.';
export const JUST_UPDATED = 'gerade aktualisiert';

/** „diese Session“, „#N Name“ oder `null`, wenn keine Session die Datei zuletzt angefasst hat. */
export function ownerLabel(item: Artifact, currentSessionId: string | null): string | null {
  if (item.sessionId === null) {
    return null;
  }
  if (item.sessionId === currentSessionId) {
    return 'diese Session';
  }
  return `#${String(item.sessionNumber ?? '')} ${item.sessionName ?? ''}`.trim();
}

/** Uhrzeit der letzten Änderung; liegt sie nicht am heutigen Tag, steht das Datum davor. */
export function clockLabel(modifiedAt: number): string {
  const clock: string = formatClock(modifiedAt);
  if (new Date(modifiedAt).toDateString() === new Date().toDateString()) {
    return clock;
  }
  const date: string = new Date(modifiedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
  return `${date} ${clock}`;
}

export function metaLine(item: Artifact, currentSessionId: string | null): string {
  const owner: string | null = ownerLabel(item, currentSessionId);
  const parts: string[] = owner === null ? [] : [owner];
  parts.push(clockLabel(item.modifiedAt));
  return parts.join(' · ');
}
