import { invoke } from '@tauri-apps/api/core';
import type { CodexModels } from '@/lib/bindings/CodexModels';

/** Die Modelle, die Codex anbietet (zehn Minuten zwischengespeichert); ein Fehler steht in
 *  `error`, kein Throw. */
export function loadCodexModels(): Promise<CodexModels> {
  return invoke<CodexModels>('codex_models');
}
