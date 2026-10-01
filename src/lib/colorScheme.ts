import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ColorScheme } from '@/lib/bindings/ColorScheme';

const STORAGE_KEY = 'verwalter.colorScheme';

const COLOR_SCHEMES: readonly ColorScheme[] = ['dark', 'light', 'system'];

/** `theme.css` kennt drei Zustände: ohne Klasse folgt die Seite Windows, `dark` und `light` erzwingen ein Schema. */
export function applyColorSchemeClass(scheme: ColorScheme): void {
  const classList: DOMTokenList = document.documentElement.classList;
  classList.remove('dark', 'light');
  if (scheme === 'dark' || scheme === 'light') {
    classList.add(scheme);
  }
}

/** Spiegel der Datenbank, den `main.tsx` vor dem ersten Rendern liest — sonst blitzt bei jedem Start das falsche Schema auf. */
export function rememberColorScheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch (reason: unknown) {
    console.error('Farbschema nicht gemerkt', reason);
  }
}

export function readRememberedColorScheme(): ColorScheme | null {
  try {
    const stored: string | null = localStorage.getItem(STORAGE_KEY);
    return COLOR_SCHEMES.find((scheme: ColorScheme) => scheme === stored) ?? null;
  } catch {
    return null;
  }
}

/** Färbt die Windows-Titelleiste; `null` überlässt sie der Systemeinstellung. */
export async function applyWindowTheme(scheme: ColorScheme): Promise<void> {
  await getCurrentWindow().setTheme(scheme === 'system' ? null : scheme);
}

/** Inhalt, Spiegel und Titelleiste in einem Zug. Die Titelleiste ist kosmetisch — ihr Fehler bleibt in der Konsole. */
export function applyColorScheme(scheme: ColorScheme): void {
  applyColorSchemeClass(scheme);
  rememberColorScheme(scheme);
  applyWindowTheme(scheme).catch((reason: unknown) => {
    console.error('Titelleiste nicht umgefärbt', reason);
  });
}
