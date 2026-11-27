# Phase 2 — Kern: Spur und Haiku-Ordnung am Phasenende

Rating: standard. Wird die letzte Agenten-Station einer Phase fertig, ordnet ein Haiku-Aufruf ohne Werkzeuge die Rohfassung samt Spur; der Verwalter prüft die IDs und speichert die geordnete Fassung oder den Grund, warum sie verworfen wurde.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt: Begriffe „Spur“, „Geordnete Fassung“, Abschnitt „Haiku-Ordnung“ (Systemtext, Schema, ID-Prüfung, Rohgruppierung, Auslöser)
- `src-tauri/src/agents/claude/print.rs` (`print_program`, `ask_haiku`, `HaikuRequest`)
- `src-tauri/src/retro/tools.rs` (`build_trace`, `render_spur`, `haiku_input`, `lines_within`, `MIDDLE_CUT_LINE`) und `src-tauri/src/sessions/registry/retro.rs` (wie die Retro Haiku in einem Thread aufruft)
- `src-tauri/src/tldr/brief.rs` (zweites Beispiel für einen Haiku-Aufruf mit Ausweichweg)
- `src-tauri/src/implementation/tools.rs` (`complete_station`), `src-tauri/src/commands/implementation.rs` (`implementation_complete_station`), `src-tauri/src/sessions/registry/implementation.rs` (`store_station_completion`, `implementation_view`)
- Phase-1-Dateien `src-tauri/src/report/*`, `src-tauri/src/db/report.rs`
- Fehlerklassen geprüft: keine einschlägig.

## AK

1. `report::tidy::spur(...)` liefert je Station der Phase außer Test- und Review-Stationen einen Abschnitt `### #<Nr> <Stage>` mit: Zweckzeilen (`ChatEntry::Text` mit höchstens 120 Zeichen, auf die direkt ein `ChatEntry::Tool` folgt) als `- <Zeile>`, darunter je Werkzeug-Aufruf mit `description` `  - <Werkzeug>: <description>` und je Schreib-Aufruf `  - <Werkzeug> <Pfad relativ zum Repository>`; über 40 000 Zeichen Mitte gekürzt wie `haiku_input`.
2. Wird die letzte Agenten-Station einer Phase fertig (über das Werkzeug oder den Befehl; Stationen `by: "you"` zählen nicht), startet höchstens ein Thread `report-tidy` je Phase; ein zweiter Auslöser während des Laufs wird verworfen.
3. Eine gültige Antwort wird als `tidy` (Markdown nach Kontrakt) und `tidy_json` gespeichert, `tidy_entries` = höchste Nummer der Phase, `tidy_error = NULL`; danach `report://changed`.
4. Eine Antwort, die die ID-Prüfung nicht besteht, schreibt nur `tidy_error = "Ordnung verworfen: <Grund>"` (Grund z. B. „n4 fehlt“, „n2 doppelt“, „n9 unbekannt“, „Etappe 3 zeigt auf keinen Stopp“); ein Fehler von `ask_haiku` schreibt `tidy_error = "Haiku nicht erreichbar: <Satz>"`.
5. Hat eine Phase nichts zu ordnen (keine Einträge außer Befunden), entfällt der Aufruf; `result` und `way` bleiben leer, `tidy_error = NULL`.
6. `report_retidy(phase_id)` startet die Ordnung erneut, auch für eine Phase mit `tidy`.
7. `report-probe … tidy <Phasen-Key> [--haiku]` druckt ohne `--haiku` die Eingabe an Haiku, mit `--haiku` zusätzlich Antwort und Prüfergebnis, ohne etwas zu speichern; `pnpm check` grün.

## Checkliste

- [x] `src-tauri/src/report/tidy.rs`: `pub const TIDY_SYSTEM: &str` und `pub const TIDY_SCHEMA: &str` wörtlich aus dem Kontrakt; `pub struct TidyAnswer { result, way: Vec<TidyWay>, stops: Vec<TidyStop> }` (serde); `pub fn to_order(entries: &[EntryRow], review_stations: &HashSet<String>) -> Vec<u32>` (zu ordnende Nummern); `pub fn check(answer: &TidyAnswer, to_order: &[u32]) -> Result<(), String>`; `pub fn tidy_markdown(phase_key, title, answer) -> String`; `pub fn spur(...) -> String`; `pub fn haiku_input(raw, to_order, spur) -> String`.
- [x] `retro::tools::lines_within` und `MIDDLE_CUT_LINE` auf `pub(crate)` stellen und wiederverwenden.
- [x] `src-tauri/src/db/report.rs`: `pub fn store_tidy(connection, phase_id, implementation_id, tidy, tidy_json, tidy_entries)`, `pub fn store_tidy_error(connection, phase_id, implementation_id, error)`, `pub fn load_phases(connection, implementation_id) -> Vec<PhaseRow>` (Upsert per `INSERT … ON CONFLICT(phase_id) DO UPDATE`).
- [x] `src-tauri/src/report/mod.rs`: `pub fn on_station_completed(app: &AppHandle, station_id: &str)` — prüft über `implementation_view`, ob alle Stationen der Phase der Station `completed_at` haben, und startet dann `std::thread::Builder::new().name("report-tidy")` mit `run_phase_end(app, phase_id)`; Sperre gegen Doppellauf als `Mutex<HashSet<String>>` im verwalteten Zustand (`app.manage` in `lib.rs` `setup`).
- [x] `run_phase_end`: Einträge laden, Rohfassung (Phase 1) und Spur bauen, `ask_haiku` mit Zeitlimit 120 s, prüfen, speichern, Ereignis senden; danach (Platzhalter bis Phase 4) nichts weiter.
- [x] Aufruf von `report::on_station_completed` nach erfolgreichem Speichern in `implementation/tools.rs` `complete_station` und in `commands/implementation.rs` `implementation_complete_station`.
- [x] `src-tauri/src/commands/report.rs`: `report_retidy(phase_id)`; in `lib.rs` registrieren; Wrapper in `src/lib/report.ts` (`retidyReport`).
- [x] `report-probe`: Unterbefehl `tidy`; `AGENTS.md` nachziehen.
- [x] Doc: `docs/code-map.md` Zeile „Review-Bericht“ um `tidy.rs` und den Thread ergänzen; `docs/glossary.md`: „Geordnete Fassung“, „Spur (Bericht)“.
- [x] `pnpm check`.

## Report-Back

**Status:** complete (2026-11-26).

**Nachweis:** `report-probe … tidy 2 --haiku` gegen eine Datenbank-Kopie mit vier Testeinträgen (Umsetzung „Session-Dateien“): Haiku antwortete, die ID-Prüfung bestand, der Befund stand nicht unter „Zu ordnen“. Die Spur der laufenden Umsetzung (Phase 1) hat Pfade relativ zum Repository. Der Auslöser in der App (Fertigmeldung → Thread → Speichern → `report://changed`) und `report_retidy` sind nur per `pnpm check` belegt.

**Abweichungen:**

- Auslöser: Stationen `by: "you"` zählen nicht (Entscheidung des Benutzers; Kontrakt und ADR 073 nachgezogen). AK 2 angepasst.
- `on_station_completed(app, implementation_id, station_id)` hängt einmal in `implementation::complete_station`, durch das Werkzeug und Befehl beide laufen.
- `tidy_markdown` bekommt zusätzlich die Nummern der Bildschirme (Abschnitt „Sichtabnahme“), `store_tidy` den Zeitpunkt.
- Statt `lines_within`/`MIDDLE_CUT_LINE` ist die Kürzung als `retro::tools::cut_middle` herausgezogen und von beiden genutzt.
- Eine geschriebene Datei außerhalb der Repositorys steht nur mit ihrem Namen in der Spur. Für eine archivierte Session gibt es keine Repository-Einträge: dann nur Dateinamen.
