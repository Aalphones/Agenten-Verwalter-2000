import { invoke } from '@tauri-apps/api/core';
import type { Attachment } from '@/lib/bindings/Attachment';

/** Kopiert Dateien in den Zwischenordner. Alles oder nichts: scheitert eine, ist keine angehängt.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `io` (Ordner, unlesbare Datei) */
export function addAttachmentFiles(paths: string[]): Promise<Attachment[]> {
  return invoke<Attachment[]>('attachment_add_files', { paths });
}

/** Legt eingefügte Daten (z.B. ein Bild aus der Zwischenablage) als Anhang ab; ohne Name heißt er `bild.png`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `io` (kein gültiges Base64) */
export function addAttachmentBytes(name: string, dataBase64: string): Promise<Attachment> {
  return invoke<Attachment>('attachment_add_bytes', { name, dataBase64 });
}

/** Verwirft einen noch nicht gesendeten Anhang; ein schon verschwundener ist kein Fehler.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `io` (ungültige ID) */
export async function discardAttachment(id: string): Promise<void> {
  await invoke('attachment_discard', { id });
}
