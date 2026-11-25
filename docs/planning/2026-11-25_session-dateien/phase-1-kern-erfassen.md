# Phase 1 — Kern: Verweise im Chat erfassen, Scratchpad der Kommandozeile merken

Rating: standard. Jede Agenten-Antwort trägt ihre absoluten Dateiverweise in die neue Tabelle `session_links` ein, und der Scratchpad, den die Kommandozeile meldet, steht in der Datenbank statt nur im Speicher. Sichtbar ändert sich nichts.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Migration 022, Begriff „Verlinkt“), „Von mir gesetzt“
- `src/lib/fileLinks.ts` — `OPENABLE_EXTENSIONS`, `VIEWABLE_EXTENSIONS`, `extensionOf`, `filePathOf` (das Vorbild der Erkennung)
- `src/components/Markdown.tsx` — `InlineCode`, `MarkdownLink`, `decodeHref` (welche Stellen zu Links werden)
- `src-tauri/src/file_links/mod.rs` — `OPENABLE_EXTENSIONS`, `clean`, `without_scheme`, `strip_line_number`
- `src-tauri/src/sourcing/mod.rs` — `strip_fences` (Code-Blöcke entfernen)
- `src-tauri/src/sessions/registry.rs` — `Outbox` (Feld `touched_files`), `AgentEvent::Text`-Zweig, `AgentEvent::ScratchpadDir`-Zweig, Schreiben der Outbox (`session_files::upsert_all`)
- `src-tauri/src/db/session_files.rs` (Muster für `upsert_all`), `src-tauri/src/db/migrations.rs` (Liste der Migrationen), `src-tauri/src/db/mod.rs` (Modul-Liste), die Datei, die `sessions.scratchpad_dir` schreibt (`grep -n "scratchpad_dir" src-tauri/src/db/*.rs`)
- `src-tauri/src/agents/event.rs` — `ChatEntry::Text` (Felder `text`, `at`)
- Fehlerklassen geprüft (Vault `systeme/sqlite`): keine einschlägig.

## AK

1. Migration 022 nach dem Kontrakt der README; `PRAGMA user_version` steigt auf 22; bestehende Sessions haben `links_scanned = 0`, `cli_scratchpad_dir = NULL`.
2. `file_links::link_candidates(text)` liefert für eine Antwort mit `` `C:\Users\u\x.mp4` ``, `` `C:/Users/u/b.log:12` ``, `[Bericht](file:///C:/Users/u/r.pdf)`, `` `src/app/App.tsx` ``, `` `state.open` `` und einem Pfad nur in einem ```-Block genau `C:\Users\u\x.mp4`, `C:\Users\u\b.log`, `C:\Users\u\r.pdf` (unter Windows mit `\`); relative Pfade, Text ohne Dateiendung und Inhalte von Code-Blöcken fehlen. Unter Unix gilt ein Pfad mit `/` am Anfang als absolut.
3. Nach jeder Agenten-Antwort (`AgentEvent::Text`) stehen ihre Kandidaten in `session_links` der Session; derselbe Pfad zweimal erhöht nur `last_seen_at`.
4. Nach `AgentEvent::ScratchpadDir(dir)` steht `dir` in `sessions.cli_scratchpad_dir` (nur schreiben, wenn er sich ändert).
5. `pnpm check` grün.

## Checkliste

- [ ] `src-tauri/src/db/migrations/022_session_links.sql` mit dem SQL der README; in `db/migrations.rs` als letzte Zeile `include_str!("migrations/022_session_links.sql")`.
- [ ] `src-tauri/src/db/session_links.rs`: `pub fn upsert_all(connection: &mut Connection, session_id: &str, links: &[(String, f64)]) -> Result<(), CommandError>` (eine Transaktion; `INSERT … ON CONFLICT(session_id, path) DO UPDATE SET last_seen_at = max(last_seen_at, excluded.last_seen_at)`, `first_seen_at` nur beim Einfügen); `pub fn load(connection: &Connection, session_id: &str) -> Result<Vec<String>, CommandError>`; `pub fn is_scanned(connection, session_id) -> Result<bool, …>` und `pub fn mark_scanned(connection, session_id) -> Result<(), …>` auf `sessions.links_scanned`. In `db/mod.rs` eintragen.
- [ ] Spalte `cli_scratchpad_dir`: in der Datei, die `sessions.scratchpad_dir` schreibt und liest, `pub fn set_cli_scratchpad(connection, session_id, dir: &str)` und das Lesen in die Zeile der Session (`SessionRow` o. ä.) aufnehmen, Feld `cli_scratchpad_dir: Option<String>`.
- [ ] `src-tauri/src/file_links/mod.rs`: `pub const VIEWABLE_EXTENSIONS` mit genau der Liste aus `src/lib/fileLinks.ts` (Rust wird maßgeblich; Kommentar in `fileLinks.ts` auf „Gespiegelt aus `file_links::VIEWABLE_EXTENSIONS`“ ändern). `clean` wird `pub(crate)`.
- [ ] `src-tauri/src/session_files/mod.rs` (neu, in `lib.rs` als `mod session_files;`) und `src-tauri/src/session_files/links.rs`: `pub fn link_candidates(text: &str) -> Vec<String>`. Ablauf: `sourcing::strip_fences` (dafür `pub(crate)` machen) → Inline-Code-Spannen (Folge von n Backticks bis zur nächsten gleich langen Folge, Inhalt getrimmt) und Ziele von Markdown-Links (`](` bis zur schließenden `)`, `<…>` und ein Titel in Anführungszeichen entfernt, `%XX` dekodiert) sammeln → je Kandidat `is_link_path` → `file_links::clean` → nur absolute Pfade (`Path::is_absolute`; unter Windows zusätzlich nicht mit `\\` beginnend) → Dubletten raus, Reihenfolge des ersten Auftretens. `fn is_link_path(text: &str) -> bool` bildet `filePathOf` nach: getrimmt nicht leer, keine Zeilenumbrüche, höchstens 400 Zeichen, nach Entfernen von `file:///` kein `://`, Endung (ohne angehängtes `:Zahl` bzw. `:Zahl:Zahl`, Punkt nach dem letzten Trenner und nicht an erster Stelle des Namens) klein in `OPENABLE_EXTENSIONS` oder `VIEWABLE_EXTENSIONS`.
- [ ] `sessions/registry.rs`: `Outbox` bekommt `linked_files: Vec<(String, f64)>`; im Zweig `AgentEvent::Text` vor `push_entry`: `for path in session_files::links::link_candidates(&text) { outbox.linked_files.push((path, now_ms())); }`. Beim Schreiben der Outbox neben `session_files::upsert_all`: `if !outbox.linked_files.is_empty() { session_links::upsert_all(connection, &session.id, &outbox.linked_files)?; }`.
- [ ] `sessions/registry.rs`, Zweig `AgentEvent::ScratchpadDir(dir)`: zusätzlich `outbox.cli_scratchpad = Some(dir.clone())` (neues Feld `Option<String>`), wenn er vom zuletzt geschriebenen abweicht (Feld `cli_scratchpad_dir: Option<String>` im `SessionState`, beim Laden der Session aus der Zeile gefüllt); beim Schreiben der Outbox `set_cli_scratchpad`. `cli_tasks_dir` bleibt wie es ist.
- [ ] Doku: `docs/code-map.md` Zeile „Dateiverweise im Chat“ um `session_files/links.rs` (Erkennung beim Eintreffen) ergänzen; neue Zeile „Session-Dateien“ anlegen (Kern-Spalte: `src-tauri/src/session_files/`, `src-tauri/src/db/session_links.rs`; Oberfläche folgt in Phase 4); Migrationsliste in `docs/code-map.md` um „Migration 22 = `session_links`, `sessions.cli_scratchpad_dir`, `sessions.links_scanned`“ ergänzen.

## Report-Back
