import { invoke } from '@tauri-apps/api/core';
import type { Settings } from '@/lib/bindings/Settings';
import type { SettingsChange } from '@/lib/bindings/SettingsChange';
import type { SettingsOverview } from '@/lib/bindings/SettingsOverview';

/** Einstellungen samt der Ordner, die die Einstellungsseite anzeigt; fehlende Werte als Standardwert.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `database`, `io` */
export function loadSettings(): Promise<SettingsOverview> {
  return invoke<SettingsOverview>('settings_load');
}

/** Speichert eine Änderung und gibt den ganzen neuen Stand zurück.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `database` */
export function updateSettings(change: SettingsChange): Promise<Settings> {
  return invoke<Settings>('settings_update', { change });
}
