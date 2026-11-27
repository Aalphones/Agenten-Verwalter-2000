# Phase 1 — Core: Ordnen sichtbar, jederzeit, abbrechbar; Fertigmeldung ohne Bericht

Status: pending · Rating: heikel · Modell: opusplan

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans (Kontrakt, finale AK).
- `docs/decisions/073-review-bericht.md` (Review-Bericht, Ordnung durch Haiku) samt Nachtrag „abschaltbar“.
- `src-tauri/src/report/mod.rs` — `TidyRuns`, `TidyClaim`, `on_station_completed`, `retidy`, `start_phase_end`, `run_phase_end`, `tidy_phase`, `haiku_input_of`, `emit_changed`, `load`, `context_of`.
- `src-tauri/src/report/tidy.rs` — `TIDY_SYSTEM`, `to_order`, `spur_stations`, `spur`, `check`.
- `src-tauri/src/report/assemble.rs` — `AssembleContext`, `empty_phase`, `phase_of`, `phase_state`.
- `src-tauri/src/report/model.rs` — `ReportPhase`, `ReportChangedEvent`.
- `src-tauri/src/agents/claude/print.rs` — `ask_haiku`, `HaikuRequest`, `run_print`, `exchange` (Zeitgrenze über `recv_timeout`).
- `src-tauri/src/sessions/registry/report.rs` — `report_sessions`, `ReportSessions`; `src-tauri/src/db/session_files.rs` — `load_for`.
- `src-tauri/src/implementation/mod.rs` — `complete_station`, `plan_completion`.
- `src-tauri/src/commands/report.rs` und die Registrierung der Befehle und von `TidyRuns` in `src-tauri/src/lib.rs`.
- `src-tauri/examples/report-probe.rs` (Befehl in `AGENTS.md`).
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/linting.md`.
- Fehlerklassen (Vault): `werkzeuge/git.md` → „`git add <Ordner>` nimmt fremde ungetrackte Dateien mit“ (Commit: Dateien einzeln nennen, der Baum kann fremde Änderungen tragen); „Ersetzungsskript findet im Windows-Arbeitsbaum seinen Anker nicht“ (Skript-Edits mit `newline=""`). Rust/Tauri: keine Vault-Entity vorhanden.

## AK der Phase

1. `TidyRuns` hält je laufender Ordnung Phase, Umsetzung, Startzeit (ms) und ein Abbruch-Flag; `report://changed` geht beim Start **und** nach dem Ende jeder Ordnung raus und trägt `tidyingPhaseIds`.
2. `report_cancel_tidy(phaseId)` beendet den Haiku-Prozess innerhalb von 0,5 s; danach gilt die vorherige Ordnung unverändert (kein `tidy_error`, kein Überschreiben), `tidyingSince` ist wieder `null`.
3. `report_retidy` auf eine laufende Phase ordnet ohne Prüfwerte zu lesen (`report_phases.checks` unverändert); auf eine fertige Phase wie bisher mit Prüfwerten.
4. Hat eine Phase keinen zu ordnenden Eintrag, aber eine nicht leere Spur, ruft `tidy_phase` Haiku trotzdem; `stops` der Antwort ist dann leer, `result` und `way` kommen aus der Spur. Ohne Eintrag **und** ohne Spur bleibt es beim bisherigen Speichern ohne Haiku.
5. `ReportPhase` liefert `tidyingSince`, `tidiedAt`, `filesSince`, `entriesSince`, `stationResult` wie im Kontrakt.
6. `implementation_complete_station` lehnt die erste Fertigmeldung einer Station ab, wenn alle Bedingungen unten gelten, mit dem Text `NO_REPORT_HINT`; die zweite Meldung derselben Station geht durch.
7. `report-probe … view` druckt die neuen Felder je Phase; `report-probe … gap <Station-ID>` druckt den Ablehnungstext oder `keine Lücke`.
8. ADR 075 liegt unter `docs/decisions/075-bericht-zustand.md`.
9. `powershell -File scripts/check.ps1` endet mit `exit 0`.

## Checkliste

### Laufende Ordnungen (`report/mod.rs`)

- [ ] `TidyRuns(Mutex<HashMap<String, TidyRun>>)` statt `HashSet`; `struct TidyRun { implementation_id: String, started_at: f64, cancel: Arc<AtomicBool> }`. Methoden: `claim(&self, phase_id, implementation_id) -> Option<Arc<AtomicBool>>` (None, wenn die Phase schon läuft), `release(&self, phase_id)`, `since(&self, phase_id) -> Option<f64>`, `tidying_of(&self, implementation_id) -> Vec<String>`, `cancel(&self, phase_id) -> bool` (setzt das Flag, `true` wenn die Phase lief).
- [ ] `TidyClaim` trägt zusätzlich `implementation_id`; `Drop` ruft erst `release`, dann `emit_changed(&self.app, &self.implementation_id)`.
- [ ] `emit_changed` füllt `tidying_phase_ids` aus `TidyRuns::tidying_of`. `start_phase_end` ruft `emit_changed` direkt nach erfolgreichem `claim`, vor dem Thread-Start.
- [ ] `run_phase_end`: Zustand der Phase per `assemble::phase_state(phase)`; bei `ReportPhaseState::Running` entfällt `check_phase` (und sein `emit_changed`), Rückgabe ist dann `tidied`.

### Abbruch (`agents/claude/print.rs`)

- [ ] `HaikuRequest` bekommt `pub cancel: Option<&'a AtomicBool>`; alle bestehenden Aufrufer übergeben `None` (Fundstellen per Grep auf `HaikuRequest {`).
- [ ] `exchange` wartet in Schritten von 250 ms (`recv_timeout(STEP)`), prüft nach jedem Schritt das Flag und die verstrichene Zeit gegen `timeout`. Flag gesetzt → `child.kill()` wie beim Zeitablauf, Fehler `CANCELLED` (`pub const CANCELLED: &str = "abgebrochen";`).
- [ ] `tidy_phase` gibt das Flag aus dem Claim weiter; endet `ask_haiku` mit genau `CANCELLED`, kehrt `tidy_phase` mit `Ok(())` zurück, **ohne** `store_report_tidy` oder `store_report_tidy_error` aufzurufen.

### Ordnen ohne Einträge (`report/mod.rs`, `report/tidy.rs`)

- [ ] `haiku_input_of` liefert zusätzlich, ob die Spur leer ist (Rückgabe `(String, bool)`); `tidy_phase` speichert nur dann ohne Haiku (`store_report_tidy_error(…, None)`), wenn `to_order` leer **und** die Spur leer ist.
- [ ] `TIDY_SYSTEM` am Ende ergänzen: „Ist „Zu ordnen“ leer, bleibt stops leer; result und way stützt du dann allein auf die Spur.“ `check` bleibt unverändert (leere Liste besteht).

### Felder der Ansicht (`report/model.rs`, `report/assemble.rs`, `sessions/registry/report.rs`, `db/session_files.rs`)

- [ ] `ReportPhase` um `tidying_since`, `tidied_at`, `files_since`, `entries_since`, `station_result`, `station_session_id` erweitern (Typen laut Kontrakt, `#[ts(type = "number | null")]` für die `Option<f64>`); `ReportChangedEvent` um `tidying_phase_ids: Vec<String>`.
- [ ] `db/session_files.rs`: neue Funktion `load_rows_for(connection, session_ids: &[String]) -> Result<Vec<(String, String, f64)>, CommandError>` — `(session_id, path, touched_at)`, gleiche Abfrage wie `load_for`, ohne Zusammenführen.
- [ ] `ReportSessions` bekommt `files: Vec<(String, String, f64)>` aus `load_rows_for`; `AssembleContext` bekommt `files: &[(String, String, f64)]` und `tidying: HashMap<String, f64>` (Phase → Startzeit aus `TidyRuns::since`, in `report::load` befüllt; `check_phase` übergibt eine leere Map).
- [ ] `phase_of`: `tidied_at` = `row.tidy_at`, wenn `row.tidy_json` vorhanden ist; `entries_since` = Einträge der Phase mit `number > row.tidy_entries` (nur mit `tidied_at`); `files_since` = Zahl der verschiedenen Pfade aus `ctx.files`, deren Session eine Station der Phase ist und deren `touched_at > tidied_at` (nur mit `tidied_at`); `tidying_since` aus `ctx.tidying`.
- [ ] `empty_phase`: `station_result` = die nicht leeren `result` der Stationen aus `tidy::spur_stations(phase)` in Reihenfolge, mit `"\n"` verbunden; ohne → `None`. (Das Feld heißt in `StationView` so, wie `implementation_get` es als `result` zeigt.) `station_session_id` = `session_id` der ersten Station aus `tidy::spur_stations(phase)`.

### Neue Befehle (`commands/report.rs`, `lib.rs`)

- [ ] `report_cancel_tidy(phase_id: String) -> Result<(), CommandError>` ruft `TidyRuns::cancel`; läuft nichts, ist es kein Fehler.
- [ ] `report_tidying(implementation_id: String) -> Result<Vec<String>, CommandError>` liefert `TidyRuns::tidying_of`.
- [ ] Beide im `invoke_handler` registrieren; `pnpm bindings` laufen lassen.

### Fertigmeldung ohne Bericht (`report/mod.rs`, `implementation/mod.rs`, `lib.rs`)

- [ ] `#[derive(Default)] pub struct ReportNudges(Mutex<HashSet<String>>)` (Station-IDs, die schon einen Hinweis bekamen), neben `TidyRuns` in `lib.rs` verwalten.
- [ ] `pub fn completion_gap(app: &AppHandle, view: &ImplementationView, station_id: &str) -> Option<&'static str>` in `report/mod.rs`: liefert `Some(NO_REPORT_HINT)` genau dann, wenn (a) der Schalter „Review-Bericht“ an ist (`!is_switched_off`), (b) die Station `!by_user` ist und zu `tidy::spur_stations` ihrer Phase gehört, (c) ihre Session mindestens eine Zeile in `session_files` mit `touched_at >= station.started_at` hat, (d) kein Eintrag in `report_entries` mit `station_id` dieser Station existiert, (e) `ReportNudges` die Station noch nicht enthält — dann wird sie eingetragen. Jeder Lesefehler ergibt `None` (die Fertigmeldung blockiert nie an einem Fehler).
- [ ] `NO_REPORT_HINT`: „Du hast Dateien geändert, aber nichts im Review-Bericht erklärt. Erkläre deine Änderungen jetzt mit mcp__verwalter__report_note (das Warum in zwei, drei Sätzen, at auf die Stelle) und melde dann erneut fertig. Eine zweite Meldung ohne Erklärung geht durch.“
- [ ] `complete_station`: nach `plan_completion`, vor `store_station_completion`: `if let Some(hint) = crate::report::completion_gap(app, &view, station_id) { return Err(CommandError::Implementation(hint.to_owned())); }`. Prüfen, dass der MCP-Pfad von `implementation_complete_station` den Fehlertext an den Agenten gibt (Fundstelle des Aufrufs per Grep auf `complete_station(`); falls er ihn verschluckt, dort als Werkzeug-Fehlertext durchreichen.

### Probe, Doku

- [ ] `report-probe`: in `view` je Phase eine Zeile `ordnet seit / geordnet um / seitdem Dateien / seitdem Einträge / Meldung`; neuer Unterbefehl `<Datenbank-Kopie> <Umsetzungs-ID> gap <Station-ID>` (ohne `ReportNudges`-Eintrag, nur die Bedingungen a–d); Zeile in `AGENTS.md` → Befehle ergänzen.
- [ ] ADR `docs/decisions/075-bericht-zustand.md` (10 Zeilen: Kontext / Optionen / Entscheidung / Konsequenzen): Haiku ordnet auch ohne Einträge aus Verlauf und Diff; Ordnen jederzeit, laufende Phase ohne Prüfwerte; Abbruch über Flag im Haiku-Aufruf; erste Fertigmeldung ohne Bericht wird abgelehnt; Repos außerhalb des Vorhabens über `session_files` und Git (Phase 2, Kritische Regel 2: Diff aus Git, nicht aus Werkzeug-Eingaben); Stopps aus dem Diff je Repository.
- [ ] `docs/glossary.md`: „Zwischenstand“ (Ordnung einer laufenden Phase), „Stopp aus dem Diff“. `docs/code-map.md`: Zeile Review-Bericht um die neuen Befehle ergänzen.
- [ ] Probe gegen eine Kopie: `scripts/db-copy.ps1 -Target <Scratchpad>\v.db`, dann `report-probe <Kopie> 73cb952b-6cdf-4e41-bae2-a3300187e377 view` und `… gap 40d2e021-d268-422c-946a-e57148f5f254` (Station #14: erwartet der Ablehnungstext). Ausgabe in den Report-Back.
- [ ] `scripts/check.ps1` grün; Commit nur mit einzeln genannten Dateien (`git status` vorher lesen — der Baum kann fremde Änderungen tragen).

## Report-Back
