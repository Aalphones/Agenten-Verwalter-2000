# Phase 4 — Oberfläche: Übersicht des Vorhabens, „Neue Session“

Rating: standard · Commit-Scope: `projects`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: Abnahmekriterien 5–7, „Kontrakt / Oberfläche (Zustand)“.
- **Entwurf (verbindlich):** [docs/design/2026-09-30_vorhaben-und-tldr/](../../design/2026-09-30_vorhaben-und-tldr/README.md), Tafeln `Vorhaben` (Übersicht) und `NewSession` (Einstieg einer neuen Session). Die TL;DR-Teile dieser Tafeln kommen erst in Phase 6 — hier bleibt ihr Platz leer.
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md).
- Code: `src/app/App.tsx` (`renderMain`, Übergang aus Phase 3), `src/app/SessionHeader.tsx` + `.css` (Aufbau der Kopfzeile: drei Spalten, Reiter, Status-Pille), `src/features/changes/ChangesView.tsx`, `useSessionChanges.ts`, `changesScope.ts` (`countChangedFiles`, `sumLines`, `LineSums`, `formatCount`, `NUMBER_FORMAT`), `src/features/chat/ChatView.tsx`, `src/features/chat/Composer.tsx` (`placeholderFor`), `src/features/projects/projectStatus.ts` (Phase 3), `src/lib/sessions.ts` (`createSessionInProject`, Phase 2), `src/lib/labels.ts` (`modelName`, `effortLabel`, `modeOption`), `src/components/StatusIcon.tsx`.
- Vault-Fehlerklassen: geprüft (React, TypeScript) — keine einschlägig.

## Abnahmekriterien

1. **Kopfzeile der Übersicht** (`ProjectHeader`, dieselben Klassen `session-header*` wie die Session-Kopfzeile, gleiche 48 px und drei Spalten): links Name des Vorhabens (`h1`) und Status-Pille des dringendsten Status; Mitte Reiter „Übersicht“ · „Changes“ (Changes nur mit mindestens einem Repository, mit Dateizahl wie in der Session-Kopfzeile); rechts in `--font-mono` 11.5 px „<n> Sessions · <Laufzeit gesamt>“ (Summe `runningMs` aller Sessions, Format wie `formatRuntime` in `SessionHeader.tsx`, die Funktion wird dafür exportiert).
2. **Reiter „Changes“** zeigt `ChangesView` mit der Session höchster Nummer (der Core liefert die Änderungen des ganzen Vorhabens).
3. **Übersicht** (`ProjectOverview`), Spalte höchstens 780 px, zentriert, Innenabstand `24px 32px`, Abstand 22 px zwischen den Blöcken, von oben:
   - (Platz für das TL;DR des Vorhabens — Phase 6.)
   - **Repository-Zeile** 12 px `--color-fg-muted`: „Repositories“, je Name ein Chip (22 px hoch, Innenabstand `0 8px`, Radius 5 px, `--color-bg-hover`, `--color-fg-secondary`, 500); dann mit 6 px Abstand „Changes: <n> Dateien“ (`countChangedFiles`, Singular „1 Datei“) und in `--font-mono` `+<added>` in `--color-diff-add-fg` und `−<deleted>` in `--color-diff-del-fg` (Summe von `sumLines(repository, 'all')` über alle Einträge). Ohne Repository nur „Keine Repositories“. Solange die Changes nicht geladen sind, fehlt der Changes-Teil.
   - **Sessions-Abschnitt:** Kopf mit `h2` „Sessions“ (13.5 px, 600) + Anzahl (400, `--color-fg-muted`), darunter 12 px `--color-fg-muted` „Jede Session ist ein eigener Claude-Verlauf mit frischem Kontext.“; rechts 12 px `--color-fg-muted` „übernimmt <Modell> · <Denkaufwand> · <Modus> aus #<k>“ (Werte der Session mit der höchsten Nummer `k`; gibt es eine Session „Neu“, stattdessen „#<k> ist noch nicht gestartet“) und der Hauptknopf „Neue Session“ (30 px hoch, Innenabstand `0 12px`, Radius 6 px, `--color-accent`, `--color-fg-on-accent`, 600, Plus-Symbol 12 px; `title` „Startet eine frische Claude-Session in diesem Vorhaben: gleiche Repositories und gleicher Arbeitsordner, aber ohne den bisherigen Verlauf.“).
   - **Session-Karten**, aufsteigend nach Nummer, Abstand 10 px: je Karte ein `div` (Innenabstand `10px 12px`, Rahmen `1px solid var(--color-border-subtle)`, Radius 8 px, Spalte mit 4 px Abstand) mit einem Kopf-Knopf über die ganze Breite (öffnet die Session): Statussymbol 12 px in 14-px-Kasten, `#N` in `--font-mono` 11.5 px `--color-fg-muted`, Name 600 mit Auslassung, Abstandhalter, rechts 12 px `--color-fg-muted` „<Modell> · <Laufzeit> · Kontext <p> %“ bzw. bei „Neu“ „<Modell> · noch nicht gestartet“. Die zweite Zeile (TL;DR) kommt in Phase 6.
4. **„Neue Session“** ruft `createSessionInProject`, übernimmt die Rückgabe in die Session-Liste und öffnet sie. Ein Fehler steht als Satz in `--color-status-error` unter dem Sessions-Kopf.
5. **Einstieg einer Session im Status „Neu“** (`NewSessionIntro`, statt des leeren Verlaufs in `ChatView`, Spalte wie der Verlauf, unten verankert, über der Eingabeleiste): Titel 13.5 px 600 „Neue Session im Vorhaben „<Name>““, darunter 12.5 px `--color-fg-secondary` „Startet mit leerem Kontext, ohne den Verlauf von #1 bis #<N−1>. Modell, Modus und Denkaufwand sind aus #<N−1> übernommen und lassen sich unten vor der ersten Nachricht ändern.“ (bei N = 2: „ohne den Verlauf von #1“). Platzhalter der Eingabeleiste in diesem Status: „Erste Nachricht an Claude … (/ für Skills)“.
6. `App.tsx` zeigt die Übersicht statt der Übergangslösung aus Phase 3; Esc, Hintergrund-Panel und Changes der Sessions funktionieren wie vorher. `pnpm check` grün.

## Checkliste

- [ ] `src/app/SessionHeader.tsx`: `formatRuntime` exportieren.
- [ ] Neue Datei `src/app/ProjectHeader.tsx` (importiert `SessionHeader.css`, kein eigenes CSS): Props `project: ProjectSummary`, `sessions: readonly SessionSummary[]`, `activeView: 'overview' | 'changes'`, `changesCount: number | null`, `onShowView`. Inhalt nach AK 1; Laufzeit tickt wie in `SessionHeader`, solange eine Session `runningSince` hat.
- [ ] Neue Datei `src/features/projects/ProjectOverview.tsx` + `ProjectOverview.css` (Block `project-overview`): Props `project`, `sessions` (nach Nummer), `changes: SessionChanges | null`, `onOpenSession(id)`, `onSessionCreated(summary)`. Inhalt nach AK 3 und 4; Fehlerzustand lokal mit `useState`, Text über `commandErrorText` aus `src/lib/errors.ts`.
- [ ] Neue Datei `src/features/projects/ProjectSessionCard.tsx` + `.css` (Block `project-session-card`): Props `session`, `onOpen`; Aufbau nach AK 3 (Karte als `div`, Kopf als `button` — Phase 6 hängt darunter eine zweite Zeile mit eigenem Knopf an).
- [ ] Neue Datei `src/features/projects/NewSessionIntro.tsx` + `.css` (Block `new-session-intro`): Props `projectName`, `number`; Text nach AK 5.
- [ ] `ChatView.tsx`: neue Props `projectName: string`; bei `session.status === 'new'` statt `ChatTimeline` die `NewSessionIntro` (unten verankert in derselben Fläche); Composer unverändert darunter.
- [ ] `Composer.tsx` `placeholderFor`: Fall `'new'` nach AK 5.
- [ ] `App.tsx`: Übergang aus Phase 3 ersetzen — bei `showProjectOverview` und bekanntem `activeProjectId`: `ProjectHeader` + je nach `projectView` `ProjectOverview` oder `ChangesView` (Session höchster Nummer). Die Changes für Zähler und Übersicht einmal laden: `useSessionChanges(<Session höchster Nummer>, true)`, solange die Übersicht offen ist. `onSessionCreated`: `upsertSession` + `selectSession`. `ChatView` bekommt `projectName`. Existiert das aktive Vorhaben nicht mehr (archiviert), fällt `App` auf die bisherige Auswahl zurück (neueste Session).
- [ ] Doku: `docs/code-map.md` Zeile „Vorhaben“ um `ProjectHeader`, `ProjectOverview`, `ProjectSessionCard`, `NewSessionIntro` ergänzen; README dieses Plans: Phase 4 auf `complete`.

## Report-Back
