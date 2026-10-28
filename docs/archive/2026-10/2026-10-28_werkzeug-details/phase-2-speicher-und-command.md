# Phase 2 — Eingabe und Ausgabe je Aufruf speichern und liefern

Rating: heikel (neues Schema, Persistenzpfad, Deckel) · Wave 2 · setzt Phase 1 voraus (gleiche Datei `registry.rs`)

## Kontext (lesen)

- `README.md` dieses Plans: Entscheidungen und Kontrakt — verbindlich.
- Ereignisse: `src-tauri/src/agents/event.rs:332-347` (`ToolStarted`, `ToolOutput`); Erzeugung `agents/claude/translate.rs:455-470` (`translate_tool_use`) und `:302-329` (Ergebnis, `ToolOutput { text }`); `result_text` ebd. `:540`.
- Verarbeitung: `sessions/registry.rs:2837-2867` (`apply_event`), `Outbox` `:336-360`, `persist` `:3541-3570` (Muster `outputs` → `background_rows::set_output`).
- DB-Muster: `db/chat_entries.rs` (Upsert in Transaktion), `db/background.rs:69-80` (`load_output`), Tabellen-Muster `db/migrations/001_sessions_and_chat.sql:16-21` (`REFERENCES sessions(id) ON DELETE CASCADE`), Registrierung der Migrationen `db/migrations.rs:22` (nach `014_…` eintragen).
- Command-Muster: Command `background_output` (Wrapper `src/lib/background.ts:19`), Rust-Seite in `src-tauri/src/commands/background.rs`; Registrierung in `commands/mod.rs` und der Handler-Liste der App.
- Kürzen: `background/output.rs` — `tail_text(text, max_bytes) -> (String, bool)`.
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/linting.md`.
- Fehlerklassen der beteiligten Technik: Rust und SQLite sind nicht in `~/.claude/knowledge/` geprüft worden → **vor Beginn** `sprachen/rust.md` und `werkzeuge/sqlite.md` (je Abschnitt `## Fehlerklassen`, falls vorhanden) lesen und einschlägige Punkte als Prüfpunkte in den Report-Back übernehmen; sonst „keine einschlägig" vermerken.

## AK

1. Nach einem Aufruf (z. B. Bash `echo hi`) liefert `tool_detail(session, id)` `input == "echo hi"`, `output` enthält `hi`, `missing == false`.
2. Ein `Read` einer Datei > 128 KiB liefert `output_truncated == true` und `output.len() <= 131072` (Anfang erhalten); ein Bash-Aufruf mit langer Ausgabe liefert `output_truncated == true` mit dem **Ende** der Ausgabe.
3. Eine Eingabe > 32 KiB liefert `input_truncated == true`, Länge ≤ 32768 Bytes, Schnitt an einer Zeichengrenze (kein Panic bei Umlauten/Emoji an der Grenze).
4. Ein Aufruf aus einem Verlauf von vor der Änderung (oder eine unbekannte `tool_use_id`) liefert `missing == true`, kein Fehler.
5. Ein laufender Aufruf liefert `input` gefüllt, `output == ""`, `missing == false`.
6. Session löschen entfernt die Zeilen (Fremdschlüssel `ON DELETE CASCADE`).
7. `ChatEntry` ist **unverändert**; `chat_entries::load_all` lädt keine Detail-Texte.

## Checkliste

- [x] ADR `docs/decisions/042-werkzeug-details.md` (10 Zeilen: Kontext, Optionen „in `ChatEntry`" / „neue Tabelle" / „aus Claudes eigenem Transkript nachladen", Entscheidung neue Tabelle, Folgen: Datenbankwachstum, Deckel).
- [x] `db/migrations/015_tool_details.sql`: `tool_details (session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, tool_use_id TEXT NOT NULL, input TEXT NOT NULL DEFAULT '', input_truncated INTEGER NOT NULL DEFAULT 0, output TEXT NOT NULL DEFAULT '', output_truncated INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (session_id, tool_use_id)) WITHOUT ROWID;` + Eintrag in `db/migrations.rs`.
- [x] `db/tool_details.rs`: `set_input(connection, session_id, tool_use_id, input, truncated)` und `set_output(…)`, beide `INSERT … ON CONFLICT(session_id, tool_use_id) DO UPDATE SET <nur ihre Spalten>` (Reihenfolge Eingabe/Ausgabe darf egal sein); `load(connection, session_id, tool_use_id) -> Result<Option<ToolDetail-Zeile>>`; Deckel als Konstanten `MAX_TOOL_INPUT_BYTES = 32_768`, `MAX_TOOL_OUTPUT_BYTES = 131_072`; Modul in `db/mod.rs` eintragen.
- [x] `event.rs`: `ToolStarted` + `input`, `input_truncated`; `ToolOutput` + `tool_use_id`, `truncated`. Alle Konstruktoren und Matches per `cargo check` finden und nachziehen (Codex/Autark-Pfade eingeschlossen, falls sie die Ereignisse bauen).
- [x] `translate.rs`: `translate_tool_use` bildet den Eingabe-Text (Bash/PowerShell → `command`, sonst `to_string_pretty`) und kürzt auf den Deckel am Zeichenrand; der Ergebnis-Zweig (`:327`) kürzt `text` (Bash/PowerShell: `tail_text`, sonst Anfang) und trägt `tool_use_id` ein. **Achtung:** `ToolOutput { text }` speist heute `turn_sources.push_text` (ADR 036, Abgleich der Antwort) — der dort übergebene Text muss derselbe bleiben wie vorher (ungekürzt oder mit demselben Verhalten); `registry.rs:2867` entsprechend anpassen und prüfen, dass der Abgleich unverändert arbeitet (→ in der Phase verifizieren: `docs/decisions/036-ohne-fundstelle.md` lesen).
- [x] `registry.rs`: `Outbox` + `tool_inputs: Vec<(String, String, bool)>` und `tool_outputs: Vec<(String, String, bool)>` (je `(tool_use_id, Text, gekürzt)`); `apply_event` füllt sie bei `ToolStarted`/`ToolOutput`; `persist` schreibt sie (nach den Einträgen, Muster `outputs`); neue Methode `tool_detail(session_id, tool_use_id) -> Result<ToolDetail, CommandError>` (Muster `background_output`, `:1860`).
- [x] `commands/tool_details.rs` + Registrierung; `ToolDetail` mit `#[derive(Serialize, TS)]` laut Kontrakt; `pnpm bindings`.
- [x] `src/lib/toolDetails.ts`: `loadToolDetail` (Muster `lib/background.ts:19`, JSDoc mit `@throws`).
- [x] Doc: `docs/code-map.md` (Zeile Werkzeug-Details: `db/tool_details.rs`, `commands/tool_details.rs`, `lib/toolDetails.ts`, `features/chat/ToolDetail*`), `docs/glossary.md` („Werkzeug-Detail"), `docs/conventions/` nur bei Abweichung.
- [~] DoD: `pnpm check` grün (ja); Selbst-Verifikation per Wegwerf-Prüfprogramm gegen eine frische Datenbank-Datei (ja, siehe Report-Back); in der laufenden App offen: App starten, in einer Session Bash `echo hi` und ein `Read` ausführen, danach `tool_detail` aufrufen und die Antwort festhalten (Weg: temporär im Browser-Devtools `invoke('tool_detail', …)` oder ein Aufruf aus Phase 3, sobald vorhanden); Eintrag in der Datenbank-**Kopie** per `sqlite3` belegen (nie gegen `%USERPROFILE%\.verwalter\verwalter.db`, `AGENTS.md`).

## Report-Back

Stand: alle Punkte der Checkliste umgesetzt; `pnpm bindings` und `pnpm check` grün (ESLint, tsc, Prettier, Build, rustfmt, Clippy). Fehlerklassen: `sprachen/rust.md` und `werkzeuge/sqlite.md` gibt es im Vault nicht — keine einschlägig.
Verifikation: Wegwerf-Prüfprogramm (Beispielprogramm, nicht committet) speiste echte Claude-Zeilen in den `Translator` und schrieb wie `persist` in eine frische Datenbank: AK 1 `input "echo hi"`, `output "hi"`; AK 2 Read 240 000 Bytes → 131 072 Bytes ab Anfang, gekürzt, Bash gleiche Ausgabe → 131 064 Bytes, endet mit der letzten Zeile; AK 3 PowerShell-Befehl aus `äö😀` → 32 768 Bytes, gekürzt, kein Panic; AK 4 unbekannte ID → keine Zeile (`tool_detail` macht daraus `missing`); AK 5 nach `ToolStarted` Eingabe da, Ausgabe leer; AK 6 Session gelöscht → 0 Zeilen; AK 7 `ChatEntry` unverändert. Der Abgleich (ADR 036) bekam die vollen 240 000 Bytes. Offen: Lauf in der echten App (`tool_detail` aus Phase 3 heraus).
Abweichungen: (1) Kontrakt `ToolOutput`: statt eines schon gekürzten `text` trägt das Ereignis `text` ungekürzt (für den Abgleich, wie vorher) und zusätzlich `detail` gekürzt plus `truncated` — sonst hätte der Abgleich bei großen Ausgaben weniger gesehen als vorher. README nachgezogen. (2) `ToolDetail` liegt in `agents/event.rs` neben `ChatEntry`, nicht in `db/`; die Deckel-Konstanten wie geplant in `db/tool_details.rs`; neues `head_text` neben `tail_text` in `background/output.rs`. (3) `translate.rs` merkt sich Bash/PowerShell-Aufrufe des Hauptagenten in `shell_calls`, um beim Ergebnis Ende statt Anfang zu behalten.
Unsicherste Stelle: `translate.rs`, Zweig der Werkzeug-Ergebnisse — Ergebnisse ohne vorheriges `ToolStarted` (TodoWrite, AskUserQuestion) legen eine Zeile nur mit Ausgabe an; harmlos, aber Datenbankzeilen ohne sichtbaren Aufruf.
Keine Tester-/Reviewer-Agenten: das Projekt hat keine Tests, die Umsetzung lief in der Session selbst; der Gesamt-Review am Plan-Ende deckt Phase 2 mit ab.
