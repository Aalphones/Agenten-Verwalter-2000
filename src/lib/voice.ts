import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { VoiceModelEvent } from '@/lib/bindings/VoiceModelEvent';
import type { VoiceModelState } from '@/lib/bindings/VoiceModelState';

const VOICE_MODEL_EVENT = 'voice://model';

/** Zustand des Sprachmodells: fehlt, wird geladen (mit Bytes) oder ist fertig.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `io` */
export function loadVoiceModelState(): Promise<VoiceModelState> {
  return invoke<VoiceModelState>('voice_model_status');
}

/** Startet den Download des Sprachmodells im Hintergrund; läuft schon einer, passiert nichts. Fortschritt
 *  und Ende kommen über `onVoiceModel`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `io`, `voiceDownload` */
export async function downloadVoiceModel(): Promise<void> {
  await invoke('voice_model_download');
}

/** Bricht einen laufenden Download ab; ohne Download passiert nichts. */
export async function cancelVoiceModelDownload(): Promise<void> {
  await invoke('voice_model_cancel_download');
}

/** Meldet jeden Zustandswechsel des Sprachmodells, beim Laden höchstens alle 250 ms. */
export function onVoiceModel(callback: (event: VoiceModelEvent) => void): Promise<UnlistenFn> {
  return listen<VoiceModelEvent>(VOICE_MODEL_EVENT, (event: Event<VoiceModelEvent>) => {
    callback(event.payload);
  });
}
