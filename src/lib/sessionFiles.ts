import { invoke } from '@tauri-apps/api/core';
import type { FileContent } from '@/lib/bindings/FileContent';
import type { FileRef } from '@/lib/bindings/FileRef';
import type { SessionFilesListing } from '@/lib/bindings/SessionFilesListing';

/** Die Session-Dateien des Vorhabens, zu dem die Session gehört; ihre eigene Gruppe steht zuerst.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` */
export function listSessionFiles(sessionId: string): Promise<SessionFilesListing> {
  return invoke<SessionFilesListing>('session_files_list', { sessionId });
}

/** Der Inhalt einer Session-Datei (`path` absolut): Text oder nur ihr Zustand.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `fileNotFound`,
 *    `fileNotAllowed` (keine Session-Datei des Vorhabens), `io`, `internal` */
export function readSessionFile(sessionId: string, path: string): Promise<FileContent> {
  return invoke<FileContent>('session_file_read', { sessionId, path });
}

/** Adresse der Betrachter-Seite einer Datei, für ein abgeschottetes `iframe`. Sie gilt nur bis zum Neustart der
 *  App und verfällt nach 512 anderen Dateien: bei jedem Öffnen neu holen, nicht speichern.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `fileNotFound`,
 *    `fileNotAllowed`, `io`, `internal` */
export function fileViewUrl(sessionId: string, file: FileRef): Promise<string> {
  return invoke<string>('file_view_url', { sessionId, file });
}

/** Zeigt die Datei im Dateisystem, markiert in ihrem Ordner.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} wie `fileViewUrl` */
export async function revealFile(sessionId: string, file: FileRef): Promise<void> {
  await invoke('file_reveal', { sessionId, file });
}

/** Öffnet die Datei mit dem Standardprogramm; der Core lehnt ausführbare Typen ab.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} wie `fileViewUrl`; `fileNotAllowed` mit
 *    „Ausführbare Datei wird nicht geöffnet“ bei einem ausführbaren Typ */
export async function openFileDefault(sessionId: string, file: FileRef): Promise<void> {
  await invoke('file_open_default', { sessionId, file });
}

/** Öffnet die Datei in VS Code, mit Zeile an dieser Stelle.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} wie `fileViewUrl`; `git` (VS Code nicht gefunden) */
export async function openFileInEditor(
  sessionId: string,
  file: FileRef,
  line: number | null,
): Promise<void> {
  await invoke('file_open_in_editor', { sessionId, file, line });
}
