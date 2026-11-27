# Phase 3 — Vollständiges Löschen nach der Frist, Verdichten der Datenbank

## Kontext

Lesen: [README.md](README.md) (Kontrakt, Sperre, „Von mir gesetzt“), Ergebnis von Phase 2 (`src-tauri/src/retention/`), `src-tauri/src/sessions/registry/restore.rs` (`restore_project`), `src-tauri/src/sessions/registry.rs` → `delete_session` (Muster für das Löschen einer Session samt `McpAccess::forget`), `src-tauri/src/db/projects.rs`, `src-tauri/src/db/sessions.rs` (`load_for_project`, `delete`, Spalten `workspace_dir`, `cli_scratchpad_dir`), `src-tauri/src/db/implementations.rs`, `src-tauri/src/agents/claude/locate.rs` (`has_transcript`, `config_dir`), `src-tauri/src/codex/mod.rs` (Thread-Datei `<Datenordner>\codex\<id>.json`), `src-tauri/src/standalone/mod.rs` (`transcript_path`), `src-tauri/src/notes/mod.rs` (`<Datenordner>\notizen\<Vorhaben-ID>.txt`), `src-tauri/src/report/mod.rs` (`report_dir`), `src-tauri/src/mcp_access/mod.rs` (`forget`), `src-tauri/src/db/mod.rs` (Sperr-Reihenfolge).

Fehlerklasse aus dem Vault (`systeme/sqlite` → „Fehlerklassen“): Kopier- und Neubau-Läufe einer großen Datei kosten Zeit und blockieren. Prüfpunkt hier: `VACUUM` läuft nur beim Start, vor `SessionRegistry::restore`, nie im Betrieb.

Welche Zeilen von selbst mitgehen (belegt an einer Kopie, 27.11.2026): das Löschen einer Session löscht über `ON DELETE CASCADE` ihre Zeilen in `chat_entries`, `tool_details`, `background_items`, `session_repositories`, `session_ticket_worktrees`, `session_commits`, `session_files`, `session_links`; das Löschen des Vorhabens löscht `implementations` und darüber Phasen, Stationen, Änderungen, `report_entries`, `report_phases`. **Nicht** von selbst: `command_runs` (kein Fremdschlüssel) — von Hand über `project_id`.

## Ablauf `purge_due(app, database, days)`

`cutoff = now_ms − days × 86 400 000`. Kandidaten: `SELECT id FROM projects WHERE archived_at IS NOT NULL AND archived_at < cutoff`. Je Kandidat:

1. `archive_gate` der Registry sperren (`app.state::<SessionRegistry>()`), bis das Vorhaben fertig ist.
2. Zeile neu lesen; ist `archived_at` jetzt `NULL` oder nicht mehr kleiner als `cutoff` → überspringen.
3. Sammeln: Sessions des Vorhabens (ID, `workspace_dir`, `cli_scratchpad_dir`), IDs seiner Umsetzungen (`SELECT id FROM implementations WHERE project_id = ?1`).
4. **Workspace prüfen:** der Pfad muss nach `fs::canonicalize` direkt in `<Datenordner>\workspaces` liegen (Elternordner gleich, nicht nur Präfix) — sonst Vorhaben überspringen und protokollieren. Enthält er einen Unterordner ohne führenden Punkt, in dem `.git` existiert → Vorhaben überspringen und protokollieren.
5. **Dateien löschen**, jeder Schritt für sich, Fehler protokollieren und weitermachen:
   - Workspace-Ordner (`fs::remove_dir_all`).
   - `<Datenordner>\notizen\<Vorhaben-ID>.txt`.
   - je Umsetzung `report::report_dir(app, id)`.
   - je Session: `McpAccess::forget(id)` (falls der Zustand existiert), `<Datenordner>\codex\<id>.json`, `standalone::transcript_path(id)`, das Kommandozeilen-Transkript, das Temp-Scratchpad.
   - **Kommandozeilen-Transkript:** in jedem Ordner direkt unter `<config_dir>\projects` die Datei `<id>.jsonl` und den Ordner `<id>` löschen, wenn vorhanden; ist der Projektordner danach leer, ihn mit `fs::remove_dir` entfernen (nicht `remove_dir_all` — ein Ordner `memory` darin bleibt). Dafür `config_dir` in `locate.rs` auf `pub(crate)` stellen und daneben `pub fn remove_transcript(session_id: &str)` anlegen.
   - **Temp-Scratchpad:** `cli_scratchpad_dir` nur löschen, wenn der letzte Pfadteil `scratchpad` heißt und der Elternordner genau die Session-ID als Namen trägt; dann den Elternordner mit `fs::remove_dir_all` entfernen. Sonst nichts tun.
6. Existiert der Workspace-Ordner noch → dieses Vorhaben abbrechen, Zeilen bleiben, nächster Lauf versucht es erneut.
7. **Datenbank**, eine Transaktion: `DELETE FROM sessions WHERE project_id = ?1`, `DELETE FROM command_runs WHERE project_id = ?1`, `DELETE FROM projects WHERE id = ?1 AND archived_at IS NOT NULL`. Betrifft das letzte `DELETE` keine Zeile → Transaktion verwerfen.

Rückgabe: Zahl der vollständig gelöschten Vorhaben; eine Zeile je Vorhaben nach `eprintln!` („Aufbewahrung: Vorhaben <Name> gelöscht“ bzw. der Grund fürs Überspringen).

`run_once` (aus Phase 2) ruft nach dem Ausdünnen, wenn `archive_purge` an ist, `purge_due(app, database, settings.archive_purge_days)`. `preview(database, days)` zählt dieselben Kandidaten und deren Sessions, ohne etwas zu ändern.

## Verdichten

`compact_if_worthwhile(database)`: liest `PRAGMA freelist_count`, `PRAGMA page_count`, `PRAGMA page_size`. Ist `archive_purge` an **und** `freelist_count × 5 ≥ page_count` **und** `freelist_count × page_size ≥ 50 × 1024 × 1024`, führt es `VACUUM` aus. Aufruf in `lib.rs` → `setup` direkt nach `Database::open`, vor `SessionRegistry::restore`. Ein Fehler geht nach `eprintln!`, die App startet weiter.

## Akzeptanzkriterien

- Prüfprogramm `retention-probe purge <Datenbank-Kopie> <Tage> [--dry]` druckt je fälligem Vorhaben Name, Sessions und die Pfade, die es löschen würde; ohne `--dry` löscht es **nur die Zeilen in der Kopie**, keine Dateien (das Programm bekommt keinen `AppHandle`; die Datei-Schritte liegen dafür in einer Funktion `purge_files(...)`, die das Prüfprogramm nicht ruft). Danach gilt in der Kopie: keine Zeile in `chat_entries`, `tool_details`, `background_items`, `command_runs`, `implementations`, `report_entries` verweist auf ein gelöschtes Vorhaben oder eine gelöschte Session.
- Probe der Datei-Schritte ohne Eingriff in die echte Datenbank: die Umgebungsvariable `VERWALTER_RETENTION_NOW_OFFSET_DAYS` (nur wirksam in einem Debug-Bau, also `pnpm tauri dev`) verschiebt „jetzt“ für den Lauf um so viele Tage. 🔴 Diese Probe löscht echte archivierte Vorhaben — sie läuft nur, wenn der Benutzer sie ausdrücklich freigibt; sonst gilt das Kriterium als über `retention-probe purge --dry` und Code-Abgleich belegt und steht als Lücke im Report-Back.
- Ein aktives Vorhaben und ein archiviertes innerhalb der Frist sind nach demselben Lauf unverändert.
- `restore_project` hält `archive_gate`; ein Lauf, der währenddessen dasselbe Vorhaben erreicht, überspringt es nach Schritt 2.
- Ein Workspace außerhalb von `<Datenordner>\workspaces` oder mit einem `.git`-Unterordner wird nicht gelöscht, die Zeilen bleiben.
- `compact_if_worthwhile` führt bei abgeschaltetem `archive_purge` nie `VACUUM` aus.

## Checkliste

- [ ] `src-tauri/src/sessions/registry.rs`: Feld `archive_gate: Mutex<()>`, `lock_archive_gate`; `registry/restore.rs`: Sperre am Anfang von `restore_project` nehmen und bis zum Ende halten.
- [ ] `src-tauri/src/agents/claude/locate.rs`: `config_dir` → `pub(crate)`, neue Funktion `remove_transcript`.
- [ ] `src-tauri/src/retention/purge.rs`: `purge_due`, `purge_files`, `preview` nach dem Ablauf oben; `model.rs`: `RetentionPreview` mit TS-Binding.
- [ ] `src-tauri/src/retention/mod.rs`: `run_once` um den Aufruf erweitern; `compact_if_worthwhile`; Zeitquelle `now_ms()` des Moduls berücksichtigt `VERWALTER_RETENTION_NOW_OFFSET_DAYS` nur bei `cfg!(debug_assertions)`.
- [ ] `src-tauri/src/lib.rs`: Aufruf von `compact_if_worthwhile` nach `Database::open`.
- [ ] `src-tauri/src/commands/retention.rs`: `retention_preview(days)`; in `lib.rs` im `invoke_handler` registrieren; `pnpm bindings`; Wrapper `src/lib/retention.ts`.
- [ ] `src-tauri/examples/retention-probe.rs`: Unterbefehl `purge`.
- [ ] `AGENTS.md`: Zeilen für `retention-probe purge` und `VERWALTER_RETENTION_NOW_OFFSET_DAYS`. `docs/code-map.md`: Zeile „Aufbewahrung“ vervollständigen.
- [ ] `pnpm check` grün.

## Report-Back
