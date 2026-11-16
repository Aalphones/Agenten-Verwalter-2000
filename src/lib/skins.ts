import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ImageSource } from '@/lib/bindings/ImageSource';
import type { ImageTarget } from '@/lib/bindings/ImageTarget';
import type { SkinData } from '@/lib/bindings/SkinData';
import type { SkinKind } from '@/lib/bindings/SkinKind';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SkinPackSummary } from '@/lib/bindings/SkinPackSummary';
import type { ToolUsage } from '@/lib/bindings/ToolUsage';

const SKINS_CHANGED_EVENT = 'skins://changed';

/** Alle nicht gelöschten Pakete nach Name.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} wenn der Core ablehnt */
export function listSkins(): Promise<SkinPackSummary[]> {
  return invoke<SkinPackSummary[]>('skins_list');
}

/** Ein Paket mit allen Daten und dem absoluten Bildordner.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `skin` (Paket fehlt oder ist gelöscht) */
export function getSkin(id: string): Promise<SkinPack> {
  return invoke<SkinPack>('skins_get', { id });
}

/** Legt ein leeres Paket an, mit `copyOf` eine Kopie samt Bildern (gleiche Art).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `skin` (Name leer oder über 40 Zeichen,
 *    Vorlage fehlt oder hat andere Art) */
export function createSkin(kind: SkinKind, name: string, copyOf: string | null): Promise<SkinPack> {
  return invoke<SkinPack>('skins_create', { kind, name, copyOf });
}

/** @throws {import('@/lib/bindings/CommandError').CommandError} `skin` (Paket fehlt, Name ungültig) */
export function renameSkin(id: string, name: string): Promise<SkinPack> {
  return invoke<SkinPack>('skins_rename', { id, name });
}

/** Speichert die Daten; bestehen sie die Prüfung nicht, bleibt das Paket unverändert.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `skin` mit einem Satz zum Grund */
export function saveSkin(id: string, data: SkinData): Promise<SkinPack> {
  return invoke<SkinPack>('skins_save', { id, data });
}

/** Legt ein Bild (Datei, https-Adresse oder Bytes; GIF, PNG, WebP, am Symbol auch ICO; höchstens
 *  2 MiB) im Paket ab und trägt es am Ziel ein.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `skin` mit einem Satz zum Grund */
export function setSkinImage(
  id: string,
  target: ImageTarget,
  source: ImageSource,
): Promise<SkinPack> {
  return invoke<SkinPack>('skins_set_image', { id, target, source });
}

/** @throws {import('@/lib/bindings/CommandError').CommandError} `skin` (Paket oder Ziel fehlt) */
export function removeSkinImage(id: string, target: ImageTarget): Promise<SkinPack> {
  return invoke<SkinPack>('skins_remove_image', { id, target });
}

/** Löscht weich; `undeleteSkin` holt das Paket 24 Stunden lang zurück.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `skin` (Paket fehlt) */
export async function deleteSkin(id: string): Promise<void> {
  await invoke('skins_delete', { id });
}

/** @throws {import('@/lib/bindings/CommandError').CommandError} `skin` (Paket endgültig weg) */
export function undeleteSkin(id: string): Promise<SkinPack> {
  return invoke<SkinPack>('skins_undelete', { id });
}

/** Die 30 häufigsten Werkzeug-Aufrufe der Sessions mit Aktivität in den letzten `days` Tagen.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} wenn der Core ablehnt */
export function getToolUsage(days: number): Promise<ToolUsage[]> {
  return invoke<ToolUsage[]>('skins_tool_usage', { days });
}

/** Meldet jede Änderung an Paketen (anlegen, ändern, Bild, löschen, zurückholen); die Nutzlast ist leer. */
export function onSkinsChanged(handler: () => void): Promise<UnlistenFn> {
  return listen(SKINS_CHANGED_EVENT, () => {
    handler();
  });
}
