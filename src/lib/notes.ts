import { invoke } from '@tauri-apps/api/core';
import type { NoteSaved } from '@/lib/bindings/NoteSaved';
import type { NoteText } from '@/lib/bindings/NoteText';

/** Die Notiz des Vorhabens; ohne Datei ein leerer Text.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` (unbekanntes Vorhaben, ungültige ID, zu groß), `io` */
export function readNote(projectId: string): Promise<NoteText> {
  return invoke<NoteText>('note_read', { projectId });
}

/** Ersetzt die Notiz des Vorhabens.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` (unbekanntes Vorhaben, ungültige ID, über 1 MiB), `io` */
export function writeNote(projectId: string, text: string): Promise<NoteSaved> {
  return invoke<NoteSaved>('note_write', { projectId, text });
}
