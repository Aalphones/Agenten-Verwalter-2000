# Phase 3 — Oberfläche: Terminal-Dock (standard)

## Kontext

- [README](README.md): Entscheidungen, Kontrakt, finale AK.
- Entwurf: [artifacts/entwurf-terminal-anordnung.html](artifacts/entwurf-terminal-anordnung.html), Varianten A und B ([artifacts/README.md](artifacts/README.md)).
- `src/app/App.tsx` (`renderMain`, `<main className="app__main">`, `BackgroundPanel` als Geschwister, `isBackgroundOpen`/`toggleBackground`, `currentSession`, `isMainReplaced`, Tastenkürzel `Strg+;`), `src/app/App.css` (`.app` ist `display: flex`), `src/stores/background.ts` (`isOpen`, `toggle`), `src/app/SessionHeader.tsx` und `src/app/ProjectHeader.tsx` (Bereich `session-header__tools`, Knopf des Hintergrund-Panels als Muster samt `runningBackgroundCount`), `src/stores/settings.ts` (geladener Stand, `terminalPlacement` und `colorScheme`), `src/lib/artifacts.ts` und `src/lib/projects.ts` (Muster Wrapper und Abo), `src/lib/errors.ts` (`commandErrorText`), `src/styles/theme.css` (Tokens).
- Doku xterm.js 6 (`Terminal`, `ITheme`, `attachCustomKeyEventHandler`, `onData`, `hasSelection`, `getSelection`, `options.theme`) und `@xterm/addon-fit` (`FitAddon.fit`).
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md).
- Fehlerklassen (Vault TypeScript/React): keine einschlägig.

## AK der Phase

- Finale AK 1, 2, 5–11 erfüllt; `pnpm check` grün; jede Schaltfläche des Docks hat einen Tooltip (`title`).
- Entwurf A und B als Struktur: **A** Dock unter dem Inhalt in `app__main`, oben eine 5 px hohe Ziehkante, darunter Leiste (Terminal-Knöpfe mit „×“, „+“, rechts „Maximieren“ und „Ausblenden“), darunter xterm über die Resthöhe; **B** Dock als Spalte zwischen `app__main` und Hintergrund-Panel, links eine 5 px breite Ziehkante, gleiche Leiste ohne „Maximieren“.

## Checkliste

- [ ] `pnpm add @xterm/xterm@6.0.0 @xterm/addon-fit@0.11.0 --save-exact`.
- [ ] `src/lib/terminal.ts`: Wrapper aus dem Kontrakt; `attachTerminal(id, onOutput: (message: TerminalOutput) => void): Promise<string>` legt `new Channel<TerminalOutput>()` (`@tauri-apps/api/core`) an und setzt `onmessage`.
- [ ] `src/stores/terminal.ts` (flüchtig): `isOpen: boolean` (false), `isMaximized: boolean` (false), `dragSize: number | null` (Größe während des Ziehens, sonst `null`), `selected: Record<string, string>` (Vorhaben-ID → Terminal-ID); Aktionen `toggle()`, `close()`, `setDragSize(px | null)`, `toggleMaximized()`, `select(projectId, terminalId)`. `close()` setzt auch `isMaximized = false`. Die gespeicherte Höhe/Breite kommt aus dem Settings-Store (`terminalHeight`, `terminalWidth`), nicht von hier.
- [ ] `src/stores/background.ts`: Aktion `close()` ergänzen, falls nur `toggle` existiert.
- [ ] `src/features/terminal/useProjectTerminals.ts`: lädt `listTerminals(projectId)` beim Mount und bei jedem `terminal://changed` mit passender `projectId`; liefert `{ terminals, error }`; `projectId === null` → leere Liste.
- [ ] `src/features/terminal/terminalTheme.ts`: `terminalTheme(): ITheme` aus `getComputedStyle(document.documentElement)`: `--color-bg-base` (background), `--color-fg-primary` (foreground, cursor), `--color-accent-subtle` (selectionBackground); `terminalFont(): string` aus `--font-mono`.
- [ ] `src/features/terminal/TerminalPane.tsx` (Props `terminalId: string`), `TerminalPane.css`, importiert `@xterm/xterm/css/xterm.css`:
  - Mount: `new Terminal({ fontFamily: terminalFont(), fontSize: 13, cursorBlink: true, scrollback: 5000, theme: terminalTheme() })`, `FitAddon` laden, `open(host)`, `fit()`.
  - Ausgabe: Warteschlange `pending: TerminalOutput[]`, `ready = false`; `attachTerminal` mit Handler, der vor `ready` in `pending` legt, danach direkt schreibt; nach Auflösen `term.write(snapshot)`, `pending` abspielen, `ready = true`. `data` → `term.write(text)`; `exit` → `term.write('\r\n[Prozess beendet' + (code === null ? '' : `, Code ${code}`) + ']\r\n')`.
  - Eingabe: `term.onData((data) => writeTerminal(id, data))`, Fehler in die Konsole.
  - Tasten: `attachCustomKeyEventHandler`, nur `keydown`: Kopier-Taste (`Strg+C`, macOS `Cmd+C`) bei `term.hasSelection()` → `navigator.clipboard.writeText(term.getSelection())`, `false`; Einfüge-Taste (`Strg+V` bzw. `Cmd+V`) → `false` ohne `preventDefault`; `Strg+Ö` → `false` (geht an das globale Kürzel); sonst `true`.
  - Größe: `ResizeObserver` auf den Host; je Meldung: hat der Host Breite oder Höhe 0 (versteckt), nichts tun; sonst `fit()`, bei geänderten `cols`/`rows` `resizeTerminal` (entprellt 50 ms).
  - Prop `isVisible: boolean`: wird es `true`, einmal `fit()` und `term.focus()`.
  - Farbschema: bei Wechsel von `colorScheme` im Settings-Store `term.options.theme = terminalTheme()` nach einem `requestAnimationFrame`.
  - Unmount: `detachTerminal`, Observer trennen, `term.dispose()`.
- [ ] `src/features/terminal/TerminalDock.tsx` (Props `projectId: string`, `terminals: TerminalInfo[]`, `placement: TerminalPlacement`), `TerminalDock.css` (BEM `terminal-dock`, Modifikatoren `terminal-dock--bottom`, `terminal-dock--right`, `terminal-dock--maximized`; Tokens wie `session-header__tab`):
  - Prop `isOpen: boolean`: bei `false` Modifikator `terminal-dock--hidden` (`display: none`) — das Dock bleibt eingehängt.
  - Größe: angezeigt wird `dragSize ?? gespeicherter Wert`, geklemmt auf die Grenzen (`--bottom` 120 px bis Höhe von `app__main` − 160 px, `--right` 320 px bis 60 % von `window.innerWidth`).
  - Ziehkante: `--bottom` oben (`cursor: row-resize`), `--right` links (`cursor: col-resize`), per Pointer-Capture; während des Ziehens `setDragSize(px)`; beim Loslassen `save({ kind: 'terminalHeight' | 'terminalWidth', value: Math.round(px) })` über `useSettingsUpdate`, danach `setDragSize(null)`; bei `--maximized` keine Ziehkante.
  - Leiste: je Terminal ein Knopf `<label> <number>`, bei `running === false` Zusatz „beendet“ in `--color-fg-muted`; aktiver hervorgehoben; „×“ (`title="Terminal schließen und Prozess beenden"`) → `closeTerminal`; „+“ (`title="Neues Terminal im Arbeitsordner des Vorhabens"`) → `openTerminal(projectId, 80, 24)`, danach auswählen; rechts „Maximieren“ (nur `bottom`, `title="Terminal maximieren"` bzw. „Wiederherstellen“) und „Ausblenden“ (`title="Terminal ausblenden (Strg+Ö)"`) → `close()`.
  - Fehler von `openTerminal`/`closeTerminal` als Satz über der Leiste in `--color-status-error` über `commandErrorText`.
  - Auswahl: gespeicherte aus dem Store, sonst das letzte. Ist die Liste nach dem ersten Laden leer → einmal `openTerminal` (Schutz per `useRef` gegen Strict Mode; je `projectId` neu scharf).
  - Darunter je Terminal der Liste ein `<TerminalPane key={terminal.id} terminalId={terminal.id} isVisible={isOpen && terminal.id === selectedId} />` über die Restfläche; nur das gewählte ist sichtbar, die übrigen tragen `display: none`.
- [ ] `src/app/App.tsx`:
  - `terminalProjectId = isMainReplaced ? null : (currentSession?.projectId ?? null)`; `useProjectTerminals(terminalProjectId)` einmal; `runningTerminalCount`.
  - `placement` aus dem Settings-Store, solange nicht geladen `'bottom'`.
  - `toggleTerminal()`: öffnet bzw. schließt; öffnet es bei `placement === 'right'` und ist das Hintergrund-Panel offen → Hintergrund `close()`. `onToggleBackground` an die Kopfzeilen wird zu: öffnet es den Hintergrund bei `placement === 'right'` und offenem Dock → Dock `close()`; dann `toggleBackground()`.
  - Tastenkürzel `Strg+Ö` (`event.ctrlKey && event.key.toLowerCase() === 'ö'`) neben dem bestehenden `Strg+;`, nur mit `terminalProjectId !== null`, `preventDefault`.
  - `bottom`: in `<main className="app__main">` den bisherigen Inhalt in `<div className="app__content">` (flex 1, `min-height: 0`, als Spalte) legen; bei `isOpen && isMaximized` bekommt er `app__content--hidden` (`display: none`, bleibt eingehängt); darunter `<TerminalDock key={terminalProjectId} isOpen={isOpen} … />`, sobald `terminalProjectId !== null` und das Dock in diesem Vorhaben einmal geöffnet wurde (danach bleibt es eingehängt, auch zugeklappt).
  - `right`: `TerminalDock` mit denselben Props als Geschwister zwischen `<main>` und `BackgroundPanel`.
- [ ] `src/app/App.css`: `&__content` und `&__content--hidden`.
- [ ] `src/app/SessionHeader.tsx` und `src/app/ProjectHeader.tsx`: Props `terminalCount: number`, `isTerminalOpen: boolean`, `onToggleTerminal: () => void`; Knopf `>_` im Bereich `session-header__tools` vor dem Knopf des Hintergrund-Panels (Übersicht: am Ende von `session-header__tools`), gleiche Klassen wie dieser, aktiv bei `isTerminalOpen`, Zahl nur bei `> 0`, `title="Terminal ein-/ausblenden (Strg+Ö)"`.
- [ ] Doku: `docs/code-map.md` neue Zeile „Terminal (Pseudo-Terminal je Vorhaben, Dock unten/rechts; ADR 052)“ mit Oberfläche (`src/features/terminal/`, `src/stores/terminal.ts`, `src/lib/terminal.ts`, Anschluss in `App.tsx` und den Kopfzeilen, Einstellung `TerminalPlacementSegment`) und Core (`src-tauri/src/terminal/`, `commands/terminal.rs`, `sessions/registry/terminal.rs`, Exit-Hook in `lib.rs`, `settings/` Schlüssel `terminal_placement`), `terminal` in der Feature-Liste; `docs/glossary.md` Begriffe „Terminal“ und „Terminal-Dock“.
- [ ] Commit `feat(terminal): Terminal-Dock unten oder rechts mit xterm.js`.
- [ ] Planabschluss nach [releases.md](../../conventions/releases.md) (Minor-Version, Archiv, STATE.md).

## Report-Back
