# Phase 3 — App-Rahmen, Leerzustand, Neue Session

**Status:** complete · **Rating:** standard (Struktur und Maße stehen im Entwurf; hier wird nachgebaut)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Status-Maschine (Anzeige, Sidebar-Gruppe), „Keine Wegwerf-Oberfläche“ (was fehlt), Kontrakt (Wrapper)
- [Design-README](../../design/2026-09-28_hauptansichten/README.md) — Gestaltung, Layout-Maße, Tokens
- Entwurfsquelle `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html` (inline-Styles = die Maße): Sidebar Zeilen 15–77, Session-Kopfzeile 81–130, Neue Session 569–625, Leerzustand 671–678, Modell- und Modus-Menü 349–381, Listen `MODELS`/`EFFORTS`/`MODES` 826–837, Sidebar-Meta-Zeile 881–904
- [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md) (BEM, nur semantische Tokens, kein Hex, keine Utility-Klassen), [typescript.md](../../conventions/typescript.md)
- Bestand: `src/app/App.tsx`, `src/app/App.css`, `src/styles/theme.css` (Token-Namen), `src/lib/sessions.ts` aus Phase 2
- Vault-Fehlerklassen `frameworks/react.md`, `sprachen/typescript.md`: geprüft, keine einschlägig (betreffen Tests bzw. `fetch`).

## Abnahmekriterien der Phase

1. Erster Start: Sidebar (256 px, Kopf 48 px mit Symbol und „Agenten Verwalter 2000“, Knopf „Neue Session“ 30 px mit `Ctrl N`) und rechts der Leerzustand (Symbol 36 px, „Noch keine Session“ 18 px, Erklärsatz, Knopf „Erste Session anlegen“). Sidebar-Liste zeigt „Noch keine Sessions.“
2. „Neue Session“, „Erste Session anlegen“ und Ctrl+N öffnen Neue Session: Kopf 48 px „Neue Session“, Formular höchstens 720 px zentriert; Abschnitt 1 „Was soll erledigt werden?“ mit Textfeld (4 Zeilen, Platzhalter aus dem Entwurf) und Satz darunter; Abschnitt 2 „Agent“ mit Modell-Pille „Claude · Sonnet 5 Hoch“ und Modus-Knopf „ϟ Auto“; unten „Session starten“ (Akzent, gesperrt bei leerem Text), „Abbrechen“, rechts „Sonnet 5 · Auto“.
3. Modell-Pille öffnet das Modell-Menü (340 px, vier Modelle mit Hinweis, Haken am gewählten), Modus-Knopf das Modus-Menü (430 px, vier Modi mit Symbol und Hinweis, darunter Denkaufwand mit fünf Punkten); Esc und Klick daneben schließen.
4. „Session starten“ (oder Ctrl+Enter im Textfeld) legt die Session an: sie erscheint in der Sidebar in der richtigen Gruppe mit Statussymbol, Name aus dem ersten Satz, Meta-Zeile; rechts erscheint die Session-Kopfzeile.
5. Kopfzeile 48 px, drei Spalten: links Name + Status-Pille (Symbol + Text in Statusfarbe), Mitte Reiterleiste mit genau einem Reiter „Chat“, rechts Kontext-Balken 48 × 4 px mit „12k / 200k“, Laufzeit mit Uhr-Symbol, Knöpfe nach Status (Tabelle unten). Pause, Abbrechen und Fortsetzen wirken.
6. Status wechselt live (Event `session://changed`), Sidebar-Gruppen „Braucht dich“ / „Läuft“ / „Abgeschlossen“ in dieser Reihenfolge, leere Gruppen fehlen.
7. `ClaudeNotFound` beim Start zeigt unter den Knöpfen: „Claude-Kommandozeile nicht gefunden. Installiere Claude Code oder setze VERWALTER_CLAUDE_PATH auf den Pfad zu claude.exe.“ (`role="alert"`, Statusfarbe Fehler).
8. Tastaturfokus sichtbar: 2 px Ring `--color-accent` mit 2 px Abstand an allen Knöpfen und Menüpunkten.
9. `pnpm check` grün.

## Checkliste

### Abhängigkeit und Zustand

- [x] `pnpm add zustand` (aktuelle stabile Hauptversion; Version in FINDINGS notieren).
- [x] `src/stores/sessions.ts`: `useSessionsStore` mit `activeSessionId: string | null`, `showNewSession: boolean`, Aktionen `selectSession(id: string)` (setzt `activeSessionId`, `showNewSession = false`), `openNewSession()`, `closeNewSession()`. Nichts weiter — die Session-Liste gehört **nicht** in den Store.
- [x] `src/features/sessions/useSessionSummaries.ts`: Hook, lädt `listSessions()` und abonniert `onSessionChanged` (ersetzt den Eintrag gleicher `id` oder fügt vorn an), Rückgabe `SessionSummary[]` nach `createdAt` absteigend; Abo und Ladevorgang werden im Cleanup freigegeben (`AbortController`-Muster wie in `App.tsx`).
- [x] `src/lib/labels.ts`: `MODEL_OPTIONS` (`id`, `name`, `hint` aus `MODELS` im Entwurf, `id` als `ModelId`), `MODE_OPTIONS` (`id` als `Mode`: `manual`, `edit`, `plan`, `auto`; `icon`, `label`, `hint` aus `MODES`), `EFFORT_OPTIONS` (`id` als `Effort`, `label`: Niedrig, Mittel, Hoch, Sehr hoch, Max), Hilfsfunktionen `modelName(id)`, `effortLabel(id)`, `modeOption(id)`. `as const`-Arrays, keine `enum`.
- [x] `src/features/sessions/sessionStatus.ts`: `STATUS_LABEL: Record<SessionStatus, string>` (Anzeige-Spalte der Status-Tabelle im README), `STATUS_GROUP` (Gruppen-Spalte), `GROUP_ORDER = ['needsYou', 'running', 'done'] as const` mit Überschriften „Braucht dich“, „Läuft“, „Abgeschlossen“, `metaLine(s: SessionSummary): string | null`: `waiting` → „wartet auf deine Antwort“, `error` → „Agent-Prozess beendet“, `paused` → „pausiert · <Modellname>“, `completed`/`cancelled` → `null`, sonst Modellname. Meta-Farbe: `waiting`/`error` in Statusfarbe, sonst `--color-fg-muted`.

### Geteilte Bausteine (`src/components/`)

- [x] `StatusIcon.tsx` + `.css`: Props `status: SessionStatus`, `size: 10 | 12`; die fünf SVGs aus Main.dc.html Zeilen 45–49 (`starting` = Läuft-Symbol, `cancelled` = Haken); Farbe über Klasse `status-icon--<status>` → `--color-status-*` (`cancelled` → `--color-fg-muted`, `starting` → `--color-status-running`).
- [x] `Popover.tsx` + `.css`: Hülle für alle Menüs — Props `label`, `placement: 'above' | 'below'`, `align: 'start' | 'end'`, `width` (px, als CSS-Variable über `style`, Laufzeitwert), `onClose`, `children`. Rahmen 1 px `--color-border`, Radius `--radius-xl`, `--color-bg-popover`, `--shadow-popover`, Abstand 8 px zum Auslöser, `z-index: var(--z-dropdown)`. Esc (Listener auf `window` in der **Capture-Phase** — `addEventListener('keydown', h, true)` —, ruft `preventDefault`, damit der Esc-Listener des Chats in Phase 6 nicht zusätzlich pausiert) und `pointerdown` außerhalb rufen `onClose`; Listener im Cleanup entfernen. Erstes fokussierbares Element bekommt beim Öffnen den Fokus.
- [x] `EffortDots.tsx` + `.css`: Zeile „Denkaufwand (<Label>)“ + Gruppe mit fünf Knöpfen nach Main.dc.html 373–378 (Punktgröße wächst mit der Stufe, gewählte Stufe und darunter `--color-fg-primary`, Rest `--color-fg-muted`, „Max“ unausgewählt in `--color-accent`); Props `value: Effort`, `onChange`.
- [x] `ModelMenu.tsx` + `.css`: `Popover` 340 px, Kopf „Modell für diese Session“, vier `menuitemradio` mit Name, Hinweis, Haken; Fuß mit Prop `note`. Props `value: ModelId`, `onChange`, `onClose`, `placement`, `note`.
- [x] `ModeMenu.tsx` + `.css`: `Popover` 430 px, Kopf „Modus“ + `Umschalt + Tab`, vier `menuitemradio` (Symbol in `--font-mono`, Label, Hinweis, Haken), Fuß mit `EffortDots`. Props `mode`, `effort`, `onModeChange`, `onEffortChange`, `onClose`, `placement`.
- [x] Fokusring global in `src/styles/theme.css` **nicht** anfassen; stattdessen jede neue Komponenten-CSS nutzt `&:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` an ihren Knöpfen.

### Rahmen (`src/app/`)

- [x] `App.tsx` + `App.css` ersetzen: `app` = Flex-Zeile über die volle Fensterhöhe, `--color-bg-base`, Schrift `--font-sans` / `--font-size-md`; links `Sidebar`, rechts Spalte mit Inhalt nach `renderMain()`: `showNewSession` → `NewSession`; aktive Session vorhanden → `SessionHeader` + `<div className="app__content" />` (Platz für den Chat aus Phase 4); sonst `EmptyState`. Globaler Tastendruck Ctrl+N → `openNewSession()` (Listener auf `window`, Cleanup). Der Versions-Aufruf `getAppInfo` entfällt aus der Oberfläche; `src/lib/app.ts` und der Command bleiben bestehen.
- [x] `Sidebar.tsx` + `.css` nach Main.dc.html 15–70 (ohne Umbenennen, ohne Kontextmenü, ohne Einstellungen-Fuß): Props `sessions`, `activeSessionId`, `onSelect`, `onNew`. Gruppen nach `GROUP_ORDER`, Überschrift 11 px Großbuchstaben mit Zähler, Eintrag = Knopf mit `StatusIcon` 12, Name (500, einzeilig mit Auslassung), Meta-Zeile 12 px; aktiver Eintrag `--color-bg-selected` und `aria-current="page"`.
- [x] `SessionHeader.tsx` + `.css` nach Main.dc.html 82–130 ohne ⋯-Menü und ohne Hintergrund-Knopf: Props `session: SessionSummary`. Laufzeit = `runningMs + (jetzt − runningSince)`, Anzeige `m:ss` bzw. `h:mm:ss`, jede Sekunde neu per `setInterval` (nur solange `runningSince !== null`, Cleanup). Kontext: `Math.round(contextUsed / 1000)`k / `Math.round(contextWindow / 1000)`k, Balkenbreite in Prozent als Laufzeitwert per `style`, ab 90 % `--color-status-waiting`, `title` „Kontext: 12k von 200k Tokens belegt“. Knöpfe:

  | Status | Knöpfe |
  |---|---|
  | `starting`, `running`, `waiting` | „Pause“ (zwei Balken), „Abbrechen“ (Quadrat) — Rahmen-Knöpfe 28 px |
  | `paused` | „Fortsetzen“ (Dreieck, Akzent) |
  | `completed`, `cancelled`, `error` | keine |

  Aktionen rufen `pauseSession` / `cancelSession` / `resumeSession`; Fehler landen per `console.error` (Anzeige kommt mit dem Chat).

### Inhalte (`src/features/sessions/`)

- [x] `EmptyState.tsx` + `.css` nach Main.dc.html 671–678; Erklärsatz ohne Worktree-Teil: „Eine Session ist eine Aufgabe für einen Agenten. Er arbeitet in einem eigenen Ordner, damit parallele Agenten sich nicht in die Quere kommen.“
- [x] `NewSession.tsx` + `.css` nach Main.dc.html 569–625 **ohne** Anhang-Zeile, ohne `+`/`/`-Leiste im Textfeld und ohne Abschnitt „Repositories“; der Agent-Abschnitt trägt die Nummer 2. Satz unter dem Textfeld: „Der erste Satz wird zum Namen der Session, der ganze Text zur ersten Nachricht an den Agenten.“ Zustand lokal: Text, Modell (`sonnet`), Denkaufwand (`high`), Modus (`auto`), offenes Menü, Fehler, „startet gerade“. Menüs öffnen nach unten (`placement="below"`). „Session starten“: `createSession(text.trim(), model, effort, mode)` → `selectSession(summary.id)`; während des Aufrufs gesperrt. Fehler `claudeNotFound` → Meldung aus AK 7; andere Fehler → „Session konnte nicht starten: <message>“. „Abbrechen“ → `closeNewSession()`. Zusammenfassung rechts: „<Modellname> · <Modus-Label>“.

### Doku

- [x] Design-README: Tafel-Tabelle — `Empty.dc.html` → „M2a“, `NewSession.dc.html` → „M2a (Aufgabe, Agent) · M3 (Repositories) · M2b (Anhänge, `/`)“; `Model.dc.html`, `Mode.dc.html` → „M2a“; neuer Abschnitt „Abweichungen bis Meilenstein 3“: fehlende Elemente laut Plan-README („Keine Wegwerf-Oberfläche“), Status „Abgebrochen“ (Haken-Symbol in gedämpfter Farbe, Gruppe „Abgeschlossen“), Status „Startet“ (Läuft-Symbol), Agent-Abschnitt in Neue Session als Nummer 2, Leerzustands-Satz ohne Worktrees.
- [x] `docs/code-map.md`: Zeilen App-Rahmen (`src/app/Sidebar.tsx`, `SessionHeader.tsx`), Sessions (`src/features/sessions/`, `src/stores/sessions.ts`), Geteilte UI-Bausteine (`StatusIcon`, `Popover`, `ModelMenu`, `ModeMenu`, `EffortDots`), neue Zeile „Anzeige-Texte für Modell, Modus, Denkaufwand“ → `src/lib/labels.ts`.

## Report-Back

- `zustand` 5.0.15. `pnpm check` grün (Rust-Teil mit `cargo` aus `~/.cargo/bin`, in der Bash-Shell nicht auf dem PATH).
- Abweichung: `useSessionSummaries` liefert `{ sessions, upsertSession }` statt nur der Liste — `upsertSession` fügt die Rückgabe von `createSession` ein (Finding aus Phase 2). Der erste Listenabruf überschreibt keine Einträge, die per Ereignis schon da sind.
- Abweichung: Denkaufwand-Punkte wie im Entwurf-Quelltext (gewählte Stufe = großer Punkt), nicht als Füllstand wie im Plantext. Breite des Popover als direkte `width` per `style` statt Umweg über eine CSS-Variable.
- Fußzeile des Modell-Menüs in Neue Session: „Gilt für den Start dieser Session. Später im Chat änderbar.“ (Text stand nicht im Entwurf).
- Nicht gesehen: die Oberfläche lief nicht (kein `pnpm tauri dev`); Layout und Fokusring sind nur gegen den Entwurf-Quelltext geprüft, nicht am Bildschirm. Erster Blick beim Smoke am Plan-Ende.
- Unsicherste Stelle: `src/components/Popover.tsx` — der „außerhalb“-Test zählt den ganzen Eltern-Container (Auslöser + Menü) als innen; ein Menü, das ohne solchen Container gerendert wird, schließt sich beim Klick auf den Auslöser und öffnet sich sofort wieder.
