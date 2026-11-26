import { invoke } from '@tauri-apps/api/core';
import type { FileContent } from '@/lib/bindings/FileContent';
import type { SessionFilesListing } from '@/lib/bindings/SessionFilesListing';

/** Die Session-Dateien des Vorhabens, zu dem die Session gehört; ihre eigene Gruppe steht zuerst.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` */
export function listSessionFiles(sessionId: string): Promise<SessionFilesListing> {
  return invoke<SessionFilesListing>('session_files_list', { sessionId });
}

/** Der Inhalt einer Session-Datei (`path` absolut): Text, Bild oder nur ihr Zustand.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `fileNotFound`,
 *    `fileNotAllowed` (keine Session-Datei des Vorhabens), `io`, `internal` */
export function readSessionFile(sessionId: string, path: string): Promise<FileContent> {
  return invoke<FileContent>('session_file_read', { sessionId, path });
}
