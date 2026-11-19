# Phase 3 — Laufzeit-Gedächtnis und Schätzung

Status: complete. Rating: standard. Der Kern merkt sich die Dauer erfolgreicher Läufe je Befehl und Vorhaben, schätzt beim Start die Dauer und meldet den laufenden Vordergrund-Befehl im Session-Stand. Einmalig füllt er das Gedächtnis aus den vorhandenen Hintergrund-Einträgen. Noch keine neue Anzeige.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Typen `RunStatus`, Konstanten, Tabelle, „Befehl vereinheitlichen“, „Schätzung“)
- `src-tauri/src/db/migrations.rs` (Liste `MIGRATIONS`), `src-tauri/src/db/migrations/020_skins.sql` als Muster, `src-tauri/src/db/mod.rs` (Modul-Liste), `src-tauri/src/db/settings.rs` (`read_all`, `write`), `src-tauri/src/db/background.rs` (Nutzlast `payload` = `BackgroundItem` als JSON)
- `src-tauri/src/sessions/registry.rs` — `Outbox`, `update`, `persist`, `summarize`, `finish_command`, `end_task`, `start_background`, `awaited_script`; `Session.project_id`
- `src-tauri/src/sessions/model.rs` — `SessionSummary`, `AwaitedScript`
- `src-tauri/src/lib.rs` — `setup` (Start anderer Dienste, Öffnen der Datenbank)
- `src-tauri/src/tldr/` oder `src-tauri/src/skins/mod.rs` — Muster für ein Modul mit Datenbankzugriff über `database.with(|connection| …)`
- `src-tauri/examples/git-probe.rs` — Muster eines Prüfprogramms gegen eine Datenbank-Kopie
- `docs/conventions/rust.md`
- Fehlerklassen geprüft (Vault `systeme/sqlite`): „Eine lange Leseverbindung lässt das WAL unbegrenzt wachsen“ → das einmalige Übernehmen liest in einer Abfrage, sammelt im Speicher und schreibt danach in einer Transaktion; keine offene Leseabfrage über die Schreibphase.

## AK

1. `cargo run --manifest-path src-tauri/Cargo.toml --example runs-probe -- key "pnpm   check 2>&1 | tail -30"` und `… key "pnpm check"` drucken denselben Schlüssel; `… key "cd a && pnpm check"` und `… key "cd b && pnpm check"` zwei verschiedene.
2. `runs-probe estimate <Datenbank-Kopie> <Vorhaben-ID> "<Befehl>"` druckt die Schätzung in ms oder `keine` und die Zahl der zugrunde liegenden Läufe.
3. Endet ein Vordergrund-Befehl oder ein Hintergrundprozess mit Exit-Code 0 nach mindestens 3 s, steht danach eine Zeile in `command_runs`; je (`project_id`, `command_key`) bleiben höchstens 10.
4. Startet derselbe Befehl im selben Vorhaben erneut, trägt sein `BackgroundItem` `expected_ms` (Median der letzten 5). In einem anderen Vorhaben ohne eigene Läufe gilt der Median über alle Vorhaben.
5. `SessionSummary.running_command` ist gesetzt, solange ein Vordergrund-Befehl des Hauptagenten läuft (der älteste), und `null`, sobald keiner mehr läuft; `AwaitedScript.expected_ms` ist gefüllt, wenn es eine Schätzung gibt.
6. Nach dem ersten Start mit Migration 021 enthält `command_runs` die Läufe aus `background_items` (Art Befehl oder Prozess, Exit-Code 0, Dauer ≥ 3 s, je Schlüssel und Vorhaben die jüngsten 10); `settings` trägt `runs_backfilled = 1`; ein zweiter Start übernimmt nichts mehr. `runs-probe backfill <Datenbank-Kopie>` druckt die Zahl der übernommenen Läufe.
7. `pnpm bindings` ausgeführt, `pnpm check` grün.

## Checkliste

### Speicher

- [x] `src-tauri/src/db/migrations/021_command_runs.sql` mit dem SQL aus dem Kontrakt; in `MIGRATIONS` anhängen.
- [x] `src-tauri/src/db/runs.rs`: `insert(connection, project_id, key, duration_ms, finished_at)` — fügt ein und löscht danach alle Zeilen desselben (`project_id`, `command_key`) außer den jüngsten `KEPT_RUNS`; `recent_durations(connection, key, project_id: Option<&str>, limit) -> Vec<i64>` (nach `finished_at` absteigend).
- [x] `src-tauri/src/runs/mod.rs`: Konstanten laut Kontrakt; `estimate(connection, project_id, command) -> Option<f64>` (Regel „Schätzung“; Median: sortieren, mittleres Element, bei gerader Zahl Mittel der beiden mittleren); `record(connection, project_id, command, duration_ms, finished_at)` (prüft `MIN_RECORDED_MS`).
- [x] `src-tauri/src/runs/normalize.rs`: `normalized(command) -> String` und `command_key(command) -> String` nach den vier Schritten des Kontrakts; die Filter-Wörter als Konstante.
- [x] `src-tauri/src/runs/model.rs`: `ProgressUnit`, `RunProgress`, `RunStatus` laut Kontrakt (in dieser Phase bleiben `progress` und `last_line` `None`).

### Session

- [x] `background/model.rs`: `expected_ms`, `progress`, `last_line` am `BackgroundItem` (`#[serde(default)]`); `start_background` setzt sie auf `None`.
- [x] `Outbox`: `run_starts: Vec<String>` (IDs neu gestarteter Einträge der Art Befehl oder Prozess) und `run_records: Vec<(String, f64, f64)>` (Befehl, Dauer ms, Ende ms).
- [x] `start_background`: bei `Command` und `Process` die ID in `run_starts` legen. `finish_command` mit `exit_code == Some(0)` und `end_task` für `Process` mit Ende `Completed` und Exit-Code 0: (`item.title`, `ended_at − started_at`, `ended_at`) in `run_records`.
- [x] `persist`: nach den bestehenden Schreibzugriffen je `run_records` `runs::record(connection, &session.project_id, …)`; je `run_starts` den Eintrag in `state.background` suchen und `expected_ms = runs::estimate(connection, &session.project_id, &item.title)` setzen. Kommentar: geschätzt wird hier, weil nur `persist` Zustand und Datenbank zugleich hält; ein Fehler bricht das Speichern der übrigen Änderungen nicht ab (eigener `if let Err`).
- [x] `update`: gibt es `run_starts`, `summary_dirty` behandeln wie gesetzt, damit `summarize` den Wert sieht (vor `persist` setzen).
- [x] `sessions/model.rs`: `SessionSummary.running_command`, neue Felder an `AwaitedScript`. `registry.rs`: `fn running_command(&self) -> Option<RunStatus>` (ältester laufender Eintrag `kind == Command`; `command` = `title`) neben `awaited_script`; `summarize` füllt beide. `finish_command` und der Zweig `CommandStarted` setzen `summary_dirty`.

### Einmaliges Übernehmen

- [x] `src-tauri/src/runs/backfill.rs`: `run(connection) -> Result<usize, CommandError>`: steht `runs_backfilled` in `settings`, sofort `Ok(0)`. Sonst eine Abfrage `SELECT s.project_id, b.payload FROM background_items b JOIN sessions s ON s.id = b.session_id` (Spaltennamen vorher in den Migrationen nachlesen), Nutzlasten als `BackgroundItem` lesen (unlesbare überspringen), behalten: Art `Command` oder `Process`, `exit_code == Some(0)`, `ended_at` gesetzt, Dauer ≥ `MIN_RECORDED_MS`. Im Speicher je (`project_id`, Schlüssel) die jüngsten `KEPT_RUNS`, dann alle in einer Transaktion einfügen und `runs_backfilled = "1"` schreiben.
- [x] `lib.rs`, `setup`: nach dem Öffnen der Datenbank in einem eigenen Thread (`thread::Builder`, Name `runs-backfill`) `backfill::run` aufrufen; ein Fehler geht ins Protokoll, die App startet weiter.

### Prüfprogramm

- [x] `src-tauri/examples/runs-probe.rs` mit den Unterbefehlen `key "<Befehl>"`, `estimate <Datenbank-Kopie> <Vorhaben-ID> "<Befehl>"`, `backfill <Datenbank-Kopie>`; die Datenbank wird wie in `git-probe.rs` geöffnet (inklusive Migrationen), nie `%USERPROFILE%\.verwalter\verwalter.db`.
- [x] `AGENTS.md`, Tabelle „Befehle“: Zeile für `runs-probe`.

### Doku

- [x] `docs/code-map.md`: neue Zeile „Läufe (Laufzeit-Gedächtnis, Schätzung)“; Feature `runs` in der Liste; Zeile „Persistenz“ um Migration 21.
- [x] `docs/glossary.md`: „Lauf“, „Laufzeit-Gedächtnis“, „Schätzung (Restdauer)“.
- [x] `docs/conventions/commits.md`: Scope `runs`.

## Report-Back

AK 1, 2 und 6 per `runs-probe` belegt (Kopie der echten Datenbank: Schlüssel gleich bzw. verschieden wie gefordert; Schätzung 59229 ms aus 5 Läufen, `keine` bei unbekanntem Befehl; Übernahme 1896 Läufe, zweiter Aufruf 0). AK 3 bis 5 nur am Code und per `pnpm check` belegt, nicht in der echten App gelaufen. AK 7: `pnpm bindings` und `pnpm check` grün.

Abweichungen: `db::runs::insert` nimmt die Aufbewahrungszahl als Parameter (`KEPT_RUNS` bleibt in `runs/mod.rs`); `estimate_run_starts` läuft vor dem Schreiben in `persist`, nicht danach, damit die gespeicherte Nutzlast `expected_ms` schon trägt; dazu `runs::sample_size` für das Prüfprogramm.
