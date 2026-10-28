import { invoke } from '@tauri-apps/api/core';
import type { ToolDetail } from '@/lib/bindings/ToolDetail';

/** Eingabe (höchstens 32 KiB) und Ausgabe (höchstens 128 KiB) eines Werkzeug-Aufrufs; `missing`,
 *  wenn zu dem Aufruf nichts gespeichert ist (älterer Verlauf).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `database` */
export function loadToolDetail(sessionId: string, toolUseId: string): Promise<ToolDetail> {
  return invoke<ToolDetail>('tool_detail', { sessionId, toolUseId });
}
