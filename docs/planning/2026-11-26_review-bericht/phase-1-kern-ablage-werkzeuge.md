# Phase 1 — Kern: Ablage, Werkzeuge `report_note`/`report_figure`/`report_screen`, Anweisung an Stationen

Rating: heikel. Stationen können Einträge in den Review-Bericht schreiben; sie stehen in SQLite, Bilder im Bericht-Ordner, die Rohfassung lässt sich als Markdown drucken. Sichtbar in der App ändert sich noch nichts.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt: Namensschema, Begriffe, Migration 023, Werkzeuge, Rohfassung, Anweisung an Stationen, Typen; „Von mir gesetzt“
- [artifacts/README.md](artifacts/README.md) und im Entwurf `artifacts/_review-bericht-entwurf/review.js` die Funktion `phaseMd` (Vorbild der Rohfassung)
- `docs/decisions/046-mcp-zugang.md`, `docs/decisions/048-umsetzung.md`, `docs/decisions/061-schlanke-werkzeuge-in-stationen.md`
- `src-tauri/src/mcp_access/tools.rs` (`ToolSet`, `ToolSpec`, `ToolCall`, `ToolResult`), `src-tauri/src/mcp_access/mod.rs` (`tool_sets`)
- `src-tauri/src/implementation/tools.rs` (Muster eines Satzes: Konstanten, `parse`, `station_of_session`, `announce`)
- `src-tauri/src/sessions/registry/implementation.rs` (`station_of_session`, `implementation_view`, `delete_implementation`)
- `src-tauri/src/agents/claude/process.rs` (`prompts`, `artifacts_prompt`, `lean_tools`, `verwalter_mcp`)
- `src-tauri/src/agents/event.rs` (`ChatEntry::Tool`), `src-tauri/src/db/chat_entries.rs` (Einträge einer Session laden), `src-tauri/src/db/tool_details.rs` (`ToolSummary.input`)
- `src-tauri/src/changes/sources.rs` (`sources`, `find`: Repository-Einträge einer Session und ihre Ordner)
- `src-tauri/src/filesystem/workspace.rs` (`data_dir`)
- `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/mod.rs`, `src-tauri/src/db/session_links.rs` (Muster einer kleinen Tabelle)
- `src-tauri/examples/implementation-probe.rs` (Muster eines Prüfprogramms gegen eine Datenbank-Kopie)
- `docs/conventions/rust.md`
- Fehlerklassen geprüft (Vault `systeme/sqlite`): keine einschlägig.

## AK

1. Migration 023 nach dem Kontrakt; `PRAGMA user_version` steigt auf 23.
2. `tools/list` einer Station enthält `report_note`, `report_figure` und `report_screen` mit den Schemas des Kontrakts; ein Aufruf aus einer Session, die keine Station ist, endet mit „Diese Session ist keine Station.“
3. `report_note` mit `at` speichert Repository-Schlüssel, relativen Pfad, Zeilen und `anchor_text`; ohne `at` nimmt es den letzten Schreib-Aufruf nach der Regel des Kontrakts oder meldet „Stelle nicht eindeutig: gib at an.“
4. `report_note` mit `resolves` auf eine Nummer, die in der Phase kein Befund ist, scheitert mit „Befund n<k> gibt es in dieser Phase nicht.“
5. `report_figure` mit `image` kopiert die Datei nach `<data_dir>\reports\<implementation_id>\<number>.<ext>` und speichert Breite und Höhe; mit `mermaid` und `image` zugleich oder keinem von beiden scheitert es mit einem Satz; `text` wird gespeichert.
5a. `report_screen` kopiert alle Bilder nach den Dateinamen des Kontrakts, speichert `ScreenRow` als JSON in `screen` samt Breite und Höhe jedes Bilds und `text`; ein fehlendes oder zu großes Bild lässt den ganzen Aufruf scheitern („Bild <Pfad>: <Grund>“), ohne Dateien zurückzulassen.
6. Die Nummer `n<k>` ist je Phase fortlaufend ab 1, auch bei zwei gleichzeitigen Aufrufen (Vergabe in derselben Transaktion wie das Einfügen).
7. Nach jedem Eintrag geht `report://changed` mit `{ implementationId }` hinaus.
8. Stationen der Betriebsart Claude bekommen `report_prompt()` wörtlich nach dem Kontrakt im `--append-system-prompt`; Einzel-Sessions nicht.
9. `delete_implementation` löscht den Bericht-Ordner der Umsetzung; die Zeilen fallen per `ON DELETE CASCADE`.
10. `cargo run --example report-probe -- <DB-Kopie> <Umsetzungs-ID> raw <Phasen-Key>` druckt die Rohfassung (auch `screen`-Einträge nach Kontrakt); `… anchor <Session-ID>` druckt den Ort, den ein `report_note` ohne `at` jetzt bekäme, oder den Fehlersatz.
11. ADR 073 liegt in `docs/decisions/073-review-bericht.md`; `pnpm check` grün.

## Checkliste

- [ ] `src-tauri/src/db/migrations/023_report.sql` mit dem SQL des Kontrakts; in `db/migrations.rs` als letzte Zeile `include_str!("migrations/023_report.sql")`.
- [ ] `src-tauri/src/db/report.rs`: `EntryRow` (alle Spalten von `report_entries`), `pub fn insert_entry(connection: &mut Connection, entry: &NewEntry) -> Result<u32, CommandError>` (Transaktion: `SELECT COALESCE(MAX(number),0)+1 … WHERE phase_id = ?`, dann `INSERT`, liefert die Nummer), `pub fn load_entries(connection, implementation_id) -> Result<Vec<EntryRow>, _>` (sortiert nach Phase und Nummer), `pub fn is_finding(connection, phase_id, number) -> Result<bool, _>`; in `db/mod.rs` eintragen.
- [ ] `src-tauri/src/report/model.rs`: alle Typen des Kontrakts mit `derive(Debug, Clone, Serialize, Deserialize, TS)` und `#[serde(rename_all = "camelCase")]`; in `src-tauri/examples/gen-bindings.rs` eintragen; `pnpm bindings`.
- [ ] `src-tauri/src/report/anchor.rs`:
  - `pub fn parse_at(at: &str) -> Result<(String, u32, u32), String>` — Pfad bis zum letzten `:`, Zeile bzw. `von-bis`, `von ≤ bis`, höchstens 80 Zeilen.
  - `pub fn resolve_path(sources, path) -> Result<(repository_key, relativer Pfad mit /, absoluter Pfad), String>` — relativer Pfad: der Eintrag, in dessen Ordner die Datei existiert (genau einer, sonst Fehler mit den Kandidaten); absoluter Pfad: der Eintrag, unter dessen Ordner er liegt (Vergleich wie `changes::attribution::normalize_path`).
  - `pub fn last_edit_anchor(entries: &[ChatEntry], details: &HashMap<String, ToolSummary>, read: impl Fn(&Path) -> Option<String>) -> Result<(PathBuf, u32, u32), String>` — Regel „Ohne `at`“ des Kontrakts; `new_string` aus `ToolSummary.input` (JSON) lesen; Zeilenende beim Vergleich auf `\n` vereinheitlichen.
  - `pub fn lines_text(content: &str, from: u32, to: u32) -> Option<String>` für `anchor_text`.
- [ ] `src-tauri/src/report/raw.rs`: `pub fn raw_markdown(phase_key: &str, entries: &[EntryRow], labels: &HashMap<String, String>) -> String` nach dem Format des Kontrakts (`labels`: Session-ID → `#<Nr> <Stage>`).
- [ ] `src-tauri/src/report/tools.rs`: `pub struct ReportTools;` mit `prefix() = "report_"`, drei `ToolSpec` (`report_screen`: „Hängt je Bildschirm deine Fotos für die Sichtabnahme an den Review-Bericht: Ansichten je Breite und Thema, Entwurfsbild daneben, Abweichung in einer Zeile, Klickpfad mit Vorher/Nachher.“), (Beschreibungen: `report_note` „Hängt eine Erklärung, ein Risiko oder einen Befund an den Review-Bericht dieser Phase; ohne at gilt der letzte Edit.“, `report_figure` „Hängt ein Schaubild (Mermaid, Zeilen mit „+ “, „- “, „~ “ markieren neu, entfällt, geändert) oder ein Bild mit nummerierten Marken an den Review-Bericht dieser Phase.“), `call` prüft Station (`station_of_session`) und findet die Phase der Station über `implementation_view`. Bildgröße per `image::image_dimensions`, falls das Crate `image` im Core ist, sonst PNG/JPEG/GIF/WebP-Kopf selbst lesen (prüfen: `grep -n "^image" src-tauri/Cargo.toml`). Nach Erfolg `report://changed` senden.
- [ ] `src-tauri/src/report/images.rs`: `pub fn copy_image(src: &Path, dir: &Path, name: &str) -> Result<(String, u32, u32), String>` (Endung, Größe, Maße prüfen, kopieren) — gemeinsam für `report_figure` und `report_screen`; bei einem Fehler in `report_screen` die schon kopierten Dateien wieder löschen.
- [ ] `src-tauri/src/report/mod.rs`: `pub const REPORT_CHANGED_EVENT: &str = "report://changed";`, `pub fn report_dir(app, implementation_id) -> PathBuf`, Module.
- [ ] `ReportTools` in `mcp_access::tool_sets` aufnehmen.
- [ ] `delete_implementation` (`sessions/registry/implementation.rs`): danach `std::fs::remove_dir_all(report_dir)`, Fehler „nicht gefunden“ ignorieren.
- [ ] `process.rs`: `fn report_prompt() -> String` mit dem Text des Kontrakts; in der Liste `prompts` anhängen, wenn `opts.lean_tools && opts.verwalter_mcp.is_some()`.
- [ ] `src-tauri/examples/report-probe.rs` mit `raw` und `anchor` (Muster `implementation-probe.rs`, Datenbank nur als Kopie öffnen); Aufruf in `AGENTS.md` → Befehle eintragen (Zeile ergänzen, wenn Phase 2–4 Unterbefehle hinzufügen).
- [ ] `docs/decisions/073-review-bericht.md` (10 Zeilen: Kontext, Optionen React vs. Betrachter-iframe, Ablage SQLite vs. Markdown-Dateien, Haiku-JSON vs. Markdown-Antwort; Entscheidung wie „Von mir gesetzt“ in der README; Konsequenzen).
- [ ] Doc: `docs/code-map.md` neue Zeile „Review-Bericht“ (Core-Teil), Namensschema-Liste um `report` ergänzen; `docs/glossary.md`: „Review-Bericht“, „Eintrag (Bericht)“, „Rohfassung“, „Stopp“.
- [ ] `pnpm check`.

## Report-Back
