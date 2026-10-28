# Phase 1 — Prozess-Ausgabe: ehrlicher Text, Pfad früher

Rating: standard · Wave 1 · Status: umgesetzt, uncommitted (Commit-Gate)

## Kontext (lesen)

- `src-tauri/src/sessions/registry.rs:1860-1893` — `background_output`: Prozess ohne `output_file` → `missing: true`.
- `src-tauri/src/background/model.rs:76-83` — `TextPreview.missing` heißt „die Datei gibt es (noch) nicht".
- `src-tauri/src/agents/claude/translate.rs:129-157` (`task_started`), `:303-319` (Pfad aus „Output is being written to:" im sofortigen Ergebnis), `:525-537` (`task_ended` liefert `output_file`), `protocol.rs:36-72` (`SystemLine`).
- `src/features/background/ProcessesTab.tsx:35, 183-191` — `MISSING_NOTICE`, `outputNotice`.
- Befund (aus dem Code abgeleitet, noch nicht am laufenden Fall belegt): Ein Vordergrund-Befehl, den die Kommandozeile in den Hintergrund schiebt, erscheint über `task_started` als Prozess; sein Ergebnis (mit dem Pfad) kommt erst am Ende. Bis dahin ist `output_file` leer.

## AK

1. Ausgewählter Prozess mit `state === 'running'` und fehlender Datei zeigt: „Ausgabe noch nicht verfügbar — sie liegt erst vor, wenn der Befehl endet." (`TextPreview.missing` bleibt unverändert; nur der Text hängt am Zustand.)
2. Beendeter Prozess mit fehlender Datei zeigt weiter „Ausgabe nicht mehr verfügbar."
3. Beleg zur Ursache liegt im Report-Back: die rohe `task_started`-Zeile eines lang laufenden Vordergrund-Befehls (`output_file` vorhanden: ja/nein).
4. Ist `output_file` in `task_started` vorhanden: es wird dort gelesen und als `AgentEvent::TaskOutputFile` ausgegeben (gleiche Form wie `translate.rs:314-318`); der laufende Prozess zeigt dann seine Ausgabe. Ist es nicht vorhanden: bleibt es beim Text aus AK 1, und das steht als Follow-up in der README.

## Checkliste

- [ ] Rohzeile belegen (OFFEN: braucht laufende App mit echter Session, in dieser Sitzung nicht möglich): in `translate.rs` bei `"task_started"` (Zeile 106) vorübergehend `eprintln!("{system:?}")` (`SystemLine` hat `Debug`), `pnpm tauri dev`, in einer Session Bash `sleep 150` im Vordergrund starten, die Zeile aus dem Terminal kopieren — **`eprintln!` danach wieder entfernen**, nichts davon committen.
- [x] `ProcessesTab.tsx`: `outputNotice(output)` bekommt den Zustand des Eintrags; Konstante `MISSING_RUNNING_NOTICE` neben `MISSING_NOTICE`.
- [x] Falls AK 4 greift (defensiv umgesetzt, Beleg offen): `task_started` (translate.rs:129) hängt `TaskOutputFile` an `events`, wenn `system.output_file` gesetzt ist — `system` vorher nicht verbrauchen (Feld vor dem Verschieben lesen).
- [x] Doc: `docs/glossary.md` falls „Ausgabe" dort definiert ist; Code-Map braucht nichts.
- [~] DoD: `pnpm check` grün (ja); Screenshot des Reiters „Prozesse" mit laufendem Befehl (neuer Text bzw. Ausgabe) im Report-Back; Selbst-Verifikation in der laufenden App.

## Report-Back

Stand: AK 1, 2 umgesetzt (`ProcessesTab.tsx`: `outputNotice(output, state)`, `MISSING_RUNNING_NOTICE`). AK 4 defensiv umgesetzt: `task_started` (`translate.rs`) gibt `TaskOutputFile` aus, sobald `output_file` gesetzt und nicht leer ist; fehlt das Feld, ändert sich nichts. `docs/glossary.md` definiert „Ausgabe" nicht — keine Doc-Änderung.
Offen: AK 3 (Rohzeile `task_started` eines `sleep 150` im Vordergrund) ist nicht belegt — braucht `pnpm tauri dev` mit echter Session. Ergibt sie „`output_file` fehlt", gehört das Follow-up „Pfad früher" in die README. Selbst-Verifikation und Screenshot des Reiters „Prozesse" stehen aus (gleiche Ursache).
Verifikation: `pnpm check` grün (ESLint, tsc, Build, rustfmt, Clippy). Keine Tester-/Reviewer-Agenten (Diff: zwei Dateien, ~15 Zeilen); der Plan-Gesamtreview deckt Phase 1 mit ab.
