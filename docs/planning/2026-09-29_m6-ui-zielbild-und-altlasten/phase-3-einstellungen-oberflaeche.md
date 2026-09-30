# Phase 3 — Oberfläche: Einstellungsseite, Farbschema, Standardwerte in „Neue Session“

Rating: standard. Struktur und Texte stehen unten; Maße aus dem Entwurfs-README und dem Prototyp.

## Kontext

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ → „Einstellungen“, „Farbschema“; „Kontrakt“ → „Oberfläche“
- Entwurf: [Entwurfs-README](../../design/2026-09-28_hauptansichten/README.md) (Layout-Maße „Neue Session, Einstellungen“, Sidebar, Tokens), Prototyp `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html`: Einstellungen-Knopf der Sidebar Zeilen 71–76, Einstellungsseite Zeilen 627–669, Zeilen-Daten `settingSections` Zeilen 1301–1332 (die Quellen laufen nur in der Zeichenfläche von claude.ai; zum Nachbauen reicht das Lesen des Markups)
- Wrapper aus Phase 2: `src/lib/settings.ts`; Typen `src/lib/bindings/{ColorScheme,Settings,SettingsOverview,SettingsChange}.ts`
- `src/styles/theme.css` (Klassen `:root.dark` / `:root.light`, ohne Klasse System), `src/main.tsx`, `src/app/App.tsx`, `src/app/Sidebar.tsx` + `Sidebar.css`, `src/stores/sessions.ts`
- Bestehende Bauteile: `src/components/Popover.tsx`, `ModelMenu.tsx`, `ModeMenu.tsx` (enthält die Denkaufwand-Punkte), `src/lib/labels.ts` (`MODEL_OPTIONS`, `MODE_OPTIONS`, `EFFORT_OPTIONS`), Segment-Vorlage `src/features/changes/ChangesToolbar.tsx` + `.css` (`changes-toolbar__segment`, `__segment-button`, `--pressed`, `aria-pressed`), `src/lib/errors.ts` (`commandErrorText`), `src/features/repositories/useKnownRepositories.ts` + `RepositoryPicker.tsx` (Erklärtext mit `verwalter/`), `src/features/sessions/NewSession.tsx` (Startwerte Zeilen 42–44), `revealItemInDir` wie in `src/features/background/ScratchpadTab.tsx`
- `src-tauri/capabilities/default.json`
- Konventionen: [react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md) (BEM pro Komponente, nur semantische Tokens)
- Vault-Fehlerklassen React und Tailwind gelesen: keine einschlägig (die React-Einträge betreffen Tests, das Projekt hat keine; die Tailwind-Klasse betrifft Einbau ohne Preflight — `theme.css` importiert `tailwindcss` vollständig).

## Abnahmekriterien

1. Sidebar: unter der Vorhaben-Liste ein Fuß (`padding: 8px 10px`, `border-top: 1px solid var(--color-border-subtle)`) mit dem Knopf „Einstellungen“ (volle Breite, 30 px, Radius 6 px, Symbol 14 px aus dem Prototyp Zeile 73, Farbe `fg-secondary`, Hintergrund `bg-selected`, solange die Seite offen ist, sonst transparent mit `bg-hover` beim Überfahren, `aria-current="page"` wenn offen).
2. Klick öffnet die Einstellungsseite im Inhaltsbereich statt Session bzw. „Neue Session“; die Sidebar markiert dann keine Session, das Hintergrund-Panel ist zu. Klick auf eine Session, ein Vorhaben, „Neues Vorhaben“ oder Ctrl+N verlässt die Seite.
3. Seite nach Prototyp: Kopf 48 px mit `<h1>` „Einstellungen“ (13,5 px, 600), `border-bottom` `border-subtle`, 20 px Seitenrand; Inhalt höchstens 780 px, zentriert, Rand 20 px / 32 px, scrollt senkrecht, Abstand 22 px zwischen Abschnitten; Abschnitts-Überschrift 11 px, 600, Großbuchstaben, `letter-spacing: 0.05em`, `fg-muted`, 6 px Abstand darunter; jede Zeile ein Raster `230px minmax(0, 1fr)`, 16 px Spaltenabstand, 8 px oben/unten, `border-top` `border-subtle`; in der Beschriftung neben dem Text ein ⓘ-Knopf 18 × 18 px (Symbol aus Prototyp Zeile 640, `fg-muted`, `cursor: help`, `title` = Erklärung, `aria-label` = „Erklärung zu <Beschriftung>: <Erklärung>“).
4. Die acht Zeilen und ihre Bedienelemente wie unter „Zeilen“ unten; Texte wörtlich.
5. Farbschema wirkt beim Klick sofort (Klasse an `<html>`, Titelleiste), wird gespeichert und in `localStorage` gespiegelt; beim nächsten Start setzt `main.tsx` die Klasse vor dem ersten Rendern. Scheitert das Speichern, springt das Segment auf den gespeicherten Wert zurück und die Seite zeigt den Fehler (AK 9).
6. „Neues Vorhaben“ startet mit Standardmodell, Standard-Modus und Standard-Denkaufwand aus den Einstellungen; sind die Einstellungen noch nicht geladen, mit `sonnet` / `auto` / `high`.
7. Der Erklärtext der Repository-Auswahl nennt den eingestellten Präfix statt fest `verwalter/`.
8. Branch-Präfix: Enter oder Verlassen des Felds speichert, wenn sich der Wert geändert hat; Esc setzt das Feld auf den gespeicherten Wert zurück. Ein Fehler steht als Satz in Fehlerfarbe (12 px) in der zweiten Rasterspalte unter dem Feld, bis der nächste Speicherversuch gelingt.
9. Scheitert `loadSettings` oder ein Speichern (außer Branch-Präfix, AK 8), steht unter dem Seitenkopf ein Satz in Fehlerfarbe: „Einstellungen nicht ladbar: <Grund>“ bzw. „Nicht gespeichert: <Grund>“ (`commandErrorText`).
10. Tab-Reihenfolge: Einstellungen-Knopf, dann auf der Seite je Zeile ⓘ, dann das Bedienelement; alle mit 2 px Fokusring `accent`, Abstand 2 px.

## Zeilen

| Abschnitt | Beschriftung | Bedienelement | ⓘ-Erklärung (wörtlich) |
|---|---|---|---|
| Darstellung | Farbschema | Segment (`role="group"`, `aria-label="Farbschema"`) Dunkel · Hell · System; Rahmen 1 px `border-subtle`, Radius 8 px, 2 px Innenabstand, 2 px Lücke; Knöpfe 26 px hoch, 14 px seitlich, Radius 6 px, 12,5 px, 500; gewählt `bg-selected` + `fg-primary`, sonst transparent + `fg-secondary`; `aria-pressed` | System folgt der Windows-Einstellung für hell oder dunkel. |
| Agent | Standardmodell | Auswahlknopf (s. u.) mit Modellname aus `MODEL_OPTIONS`; öffnet `ModelMenu` unterhalb, `title="Modell für neue Vorhaben"`, `note="Gilt ab dem nächsten neuen Vorhaben."` | Mit diesem Modell startet die erste Session eines neuen Vorhabens; weitere Sessions im Vorhaben übernehmen den Stand der letzten. In der Session jederzeit über die Eingabeleiste änderbar. |
| Agent | Standard-Modus | Auswahlknopf mit „<Modus-Label> · Denkaufwand <Effort-Label>“; öffnet `ModeMenu` unterhalb mit `align="start"` | Wie selbstständig Claude arbeitet und wie gründlich es nachdenkt. Gilt für neue Vorhaben; in der Session mit Umschalt + Tab bzw. über die Eingabeleiste wechselbar. |
| Skills | Benutzer-Skills | Text: Pfad (`font-mono` 12 px `fg-secondary`, abgeschnitten mit …), daneben „<n> Skills“ (12 px `fg-muted`; bei 1 „1 Skill“); Knopf „Im Explorer zeigen“ | Skills aus deinem Benutzerordner stehen in jeder Session zur Verfügung. |
| Skills | Projekt-Skills | Text: „<Name> <n>“ je bekanntem, nicht fehlendem Repository mit `skillCount > 0`, getrennt mit „ · “, daneben „je Repository“; keines → „Keine Repository-Skills“ ohne Zusatz; während des Ladens „…“ | Skills aus den .claude\skills-Ordnern der Repositories einer Session. Welche gelten, hängt davon ab, welche Repositories die Session umfasst. |
| Git | Branch-Präfix | Textfeld 300 × 30 px, `font-mono` 12,5 px, Rahmen 1 px `border`, Radius 6 px, `bg-surface`, `aria-label="Branch-Präfix"` | Jedes neue Vorhaben legt pro Repository einen Branch mit diesem Präfix und seinem Namen an. Gilt für neue Vorhaben. |
| Git | Ordner für Worktrees | Text: Pfad wie bei Benutzer-Skills, ohne Zusatz; Knopf „Im Explorer zeigen“ | Hier legt die App die Arbeitsordner der Sessions an. Ein kurzer Pfad vermeidet die Windows-Grenze von 260 Zeichen. |
| Rechte | Dateizugriff | Text „Nur Session-Workspace“ (13 px `fg-secondary`, keine Monoschrift) | Ein Agent sieht nur die Worktrees seiner eigenen Session, nicht dein Benutzerverzeichnis. |

Auswahlknopf: 300 × 30 px, 10 px seitlich, Rahmen 1 px `border`, Radius 6 px, `bg-surface`, `fg-primary`, Text links mit Rest-Breite, Pfeil-Symbol 12 px rechts (Prototyp Zeile 651), `aria-haspopup="dialog"`, `aria-expanded`, `aria-label="<Beschriftung>: <Wert>"`; die Hülle ist `position: relative`, damit das Menü am Knopf hängt (Popover-Vertrag). Knopf „Im Explorer zeigen“: 30 px hoch, 12 px seitlich, Rahmen 1 px `border`, Radius 6 px, transparent, `fg-secondary`, 12,5 px; Fehler beim Öffnen → Satz wie AK 9 („Explorer nicht geöffnet: <Grund>“).

## Checkliste

### Farbschema-Mechanik

- [ ] `src/lib/colorScheme.ts`: `const STORAGE_KEY = 'verwalter.colorScheme'`; `export function applyColorSchemeClass(scheme: ColorScheme): void` (entfernt `dark` und `light` von `document.documentElement.classList`, setzt bei `dark`/`light` die gleichnamige Klasse); `export function rememberColorScheme(scheme: ColorScheme): void` (`localStorage.setItem`); `export function readRememberedColorScheme(): ColorScheme | null` (nur `'dark' | 'light' | 'system'` gelten, sonst `null`; Zugriffsfehler → `null`); `export async function applyWindowTheme(scheme: ColorScheme): Promise<void>` (`getCurrentWindow().setTheme(scheme === 'system' ? null : scheme)`).
- [ ] `src/main.tsx`: vor `createRoot` `const remembered = readRememberedColorScheme(); if (remembered !== null) applyColorSchemeClass(remembered);`.
- [ ] `src-tauri/capabilities/default.json`: `"core:window:allow-set-theme"` in `permissions`. Startet `pnpm tauri dev` danach mit einem Fehler zur Berechtigung, den genauen Namen aus `src-tauri/gen/schemas/desktop-schema.json` nehmen (entsteht beim Build) und nach FINDINGS.
- [ ] `src/stores/settings.ts`: Zustand-Slice nach Kontrakt (`settings: Settings | null`, `setSettings`).
- [ ] `src/features/settings/useSettings.ts`: Hook `useSettings(): { overview: SettingsOverview | null; error: string | null; reload(): void }` — lädt beim Einhängen `loadSettings()`, schreibt `overview.settings` in den Slice, ruft `applyColorSchemeClass`, `rememberColorScheme`, `applyWindowTheme` (Fehler von `applyWindowTheme` nur Konsole: die Titelleiste ist kosmetisch) und hält Ladefehler als Text. `App.tsx` ruft den Hook einmal (damit Farbschema und Standardwerte ab Start gelten) und gibt `overview`, `error` und `reload` an die Seite weiter.
- [ ] `src/features/settings/useSettingsUpdate.ts`: `useSettingsUpdate(): { save(change: SettingsChange): Promise<boolean>; error: string | null }` — ruft `updateSettings`, schreibt das Ergebnis in den Slice, wendet bei `colorScheme` Klasse, Spiegel und Titelleiste an; Fehler → `error` gesetzt, Rückgabe `false`.

### Navigation

- [ ] `src/stores/sessions.ts`: `showSettings`, `openSettings`, `closeSettings` nach Kontrakt; `selectSession`, `selectProject` und `openNewSession` setzen zusätzlich `showSettings: false`; `openSettings` setzt zusätzlich `showProjectOverview: false` (Felder aus dem Plan „Vorhaben und Sessions“).
- [ ] `src/app/Sidebar.tsx` + `.css`: neue Props `isSettingsOpen: boolean`, `onOpenSettings: () => void`; Fuß `sidebar__footer` mit Knopf `sidebar__settings` (`--active` bei offen) nach AK 1, nach `sidebar__list`.
- [ ] `src/app/App.tsx`: `showSettings` lesen; `renderMain` zeigt bei `showSettings` die Seite (vor der Prüfung auf `showNewSession`); `visibleSession` ist `null`, wenn `showSettings` oder `showNewSession`; `activeSessionId` an die Sidebar `null`, wenn eines davon offen ist; ebenso ist bei offenen Einstellungen keine Vorhaben-Übersicht hervorgehoben (`isOverviewActive` false) und `renderMain` prüft `showSettings` vor `showProjectOverview`. `useSessionChanges` bekommt dann `null` wie bei „Neue Session“.

### Seite

- [ ] `src/features/settings/SettingsView.tsx` + `.css` (BEM-Block `settings-view`): Kopf, Fehlersatz nach AK 9, Abschnitte nach Tabelle „Zeilen“. Props `overview`, `loadError`, `onReload`; `onReload` hängt an einem Knopf „Erneut laden“ direkt hinter dem Ladefehler-Satz (Stil wie „Im Explorer zeigen“).
- [ ] `src/features/settings/SettingRow.tsx` + `.css` (Block `setting-row`): Props `label`, `info`, `children` (Bedienelement), `error: string | null` (Satz unter dem Bedienelement, AK 8).
- [ ] `src/features/settings/ColorSchemeSegment.tsx` (Styles in `SettingsView.css` unter `settings-view__segment…` nach Vorlage `changes-toolbar__segment`), Beschriftungen `Dunkel`, `Hell`, `System`.
- [ ] `src/features/settings/SelectButton.tsx` + `.css` (Block `select-button`): Props `label` (für `aria-label`), `value`, `isOpen`, `onToggle`, `children` (das Menü, gerendert wenn `isOpen`).
- [ ] `src/components/ModelMenu.tsx`: optionale Prop `title` (Standard „Modell für diese Session“) statt des festen Kopftexts. `src/components/ModeMenu.tsx`: optionale Prop `align: 'start' | 'end'` (Standard `'end'`) an `Popover` durchreichen. Bestehende Aufrufer bleiben unverändert.
- [ ] Standard-Modus-Menü: `onModeChange` und `onEffortChange` speichern je sofort `{ kind: 'defaultMode', mode, effort }` mit dem jeweils anderen Wert aus dem Slice; das Menü bleibt offen (wie in der Eingabeleiste).
- [ ] Projekt-Skills über `useKnownRepositories()` (`isLoading` → „…“).
- [ ] „Im Explorer zeigen“ → `revealItemInDir(overview.userSkillsDir)` bzw. `revealItemInDir(overview.workspacesDir)`.

### Standardwerte und Präfix-Text

- [ ] `NewSession.tsx` (seit dem Plan „Vorhaben und Sessions“ die Seite „Neues Vorhaben“; „Neue Session“ im Vorhaben übernimmt Modell, Modus und Denkaufwand der letzten Session und liest die Einstellungen nicht): `useState<ModelId>(() => useSettingsStore.getState().settings?.defaultModel ?? 'sonnet')`, ebenso Modus (`'auto'`) und Denkaufwand (`'high'`).
- [ ] `RepositoryPicker.tsx`: der Erklärtext wird eine Funktion `pickerHint(prefix: string): string`; Präfix aus `useSettingsStore((state) => state.settings?.branchPrefix ?? 'verwalter/')`.

### Doku

- [ ] Code-Map: Zeile „Settings“ um `src/features/settings/` (`SettingsView`, `SettingRow`, `ColorSchemeSegment`, `SelectButton`, `useSettings`, `useSettingsUpdate`), `src/stores/settings.ts`, `src/lib/colorScheme.ts` ergänzen; Zeile „Sessions“: `showSettings` im Store; Zeile „App-Rahmen“: Einstellungen-Knopf im Sidebar-Fuß; Zeile „Geteilte UI-Bausteine“: `ModelMenu` (`title`), `ModeMenu` (`align`).
- [ ] Entwurfs-README: Tafel-Tabelle `Settings.dc.html` → „M6“ bestätigt, `Light.dc.html` → „M6“; „Fehlt ganz“: „Einstellungen-Knopf (M6)“ streichen; neue Abweichungen: Zeile „Basis für Changes“ fehlt (Base ref je Repository, ADR 006); „Ordner für Worktrees“ und „Dateizugriff“ nur Anzeige; Denkaufwand in der Zeile „Standard-Modus“ statt „Standardmodell“; „Im Explorer zeigen“ statt „Ordner öffnen“ und „Ändern …“; Fehlersätze der Seite und unter dem Branch-Präfix.
- [ ] Glossar: neuer Eintrag **Farbschema**: „Dunkel, Hell oder System (folgt Windows); gilt für Inhalt und Titelleiste, gespeichert in den Einstellungen.“

## Report-Back
