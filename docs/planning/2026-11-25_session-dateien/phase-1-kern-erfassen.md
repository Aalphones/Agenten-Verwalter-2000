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

- [x] `src-tauri/src/db/migrations/022_session_links.sql` mit dem SQL der README; in `db/migrations.rs` als letzte Zeile `include_str!("migrations/022_session_links.sql")`.
- [x] `src-tauri/src/db/session_links.rs`: `pub fn upsert_all(connection: &mut Connection, session_id: &str, links: &[(String, f64)]) -> Result<(), CommandError>` (eine Transaktion; `INSERT … ON CONFLICT(session_id, path) DO UPDATE SET last_seen_at = max(last_seen_at, excluded.last_seen_at)`, `first_seen_at` nur beim Einfügen); `pub fn load(connection: &Connection, session_id: &str) -> Result<Vec<String>, CommandError>`; `pub fn is_scanned(connection, session_id) -> Result<bool, …>` und `pub fn mark_scanned(connection, session_id) -> Result<(), …>` auf `sessions.links_scanned`. In `db/mod.rs` eintragen.
- [x] Spalte `cli_scratchpad_dir`: in der Datei, die `sessions.scratchpad_dir` schreibt und liest, `pub fn set_cli_scratchpad(connection, session_id, dir: &str)` und das Lesen in die Zeile der Session (`SessionRow` o. ä.) aufnehmen, Feld `cli_scratchpad_dir: Option<String>`.
- [x] `src-tauri/src/file_links/mod.rs`: `pub const VIEWABLE_EXTENSIONS` mit genau der Liste aus `src/lib/fileLinks.ts` (Rust wird maßgeblich; Kommentar in `fileLinks.ts` auf „Gespiegelt aus `file_links::VIEWABLE_EXTENSIONS`“ ändern). `clean` wird `pub(crate)`.
- [x] `src-tauri/src/session_files/mod.rs` (neu, in `lib.rs` als `mod session_files;`) und `src-tauri/src/session_files/links.rs`: `pub fn link_candidates(text: &str) -> Vec<String>`. Ablauf: `sourcing::strip_fences` (dafür `pub(crate)` machen) → Inline-Code-Spannen (Folge von n Backticks bis zur nächsten gleich langen Folge, Inhalt getrimmt) und Ziele von Markdown-Links (`](` bis zur schließenden `)`, `<…>` und ein Titel in Anführungszeichen entfernt, `%XX` dekodiert) sammeln → je Kandidat `is_link_path` → `file_links::clean` → nur absolute Pfade (`Path::is_absolute`; unter Windows zusätzlich nicht mit `\\` beginnend) → Dubletten raus, Reihenfolge des ersten Auftretens. `fn is_link_path(text: &str) -> bool` bildet `filePathOf` nach: getrimmt nicht leer, keine Zeilenumbrüche, höchstens 400 Zeichen, nach Entfernen von `file:///` kein `://`, Endung (ohne angehängtes `:Zahl` bzw. `:Zahl:Zahl`, Punkt nach dem letzten Trenner und nicht an erster Stelle des Namens) klein in `OPENABLE_EXTENSIONS` oder `VIEWABLE_EXTENSIONS`.
- [x] `sessions/registry.rs`: `Outbox` bekommt `linked_files: Vec<(String, f64)>`; im Zweig `AgentEvent::Text` vor `push_entry`: `for path in session_files::links::link_candidates(&text) { outbox.linked_files.push((path, now_ms())); }`. Beim Schreiben der Outbox neben `session_files::upsert_all`: `if !outbox.linked_files.is_empty() { session_links::upsert_all(connection, &session.id, &outbox.linked_files)?; }`.
- [x] `sessions/registry.rs`, Zweig `AgentEvent::ScratchpadDir(dir)`: zusätzlich `outbox.cli_scratchpad = Some(dir.clone())` (neues Feld `Option<String>`), wenn er vom zuletzt geschriebenen abweicht (Feld `cli_scratchpad_dir: Option<String>` im `SessionState`, beim Laden der Session aus der Zeile gefüllt); beim Schreiben der Outbox `set_cli_scratchpad`. `cli_tasks_dir` bleibt wie es ist.
- [x] Doku: `docs/code-map.md` Zeile „Dateiverweise im Chat“ um `session_files/links.rs` (Erkennung beim Eintreffen) ergänzen; neue Zeile „Session-Dateien“ anlegen (Kern-Spalte: `src-tauri/src/session_files/`, `src-tauri/src/db/session_links.rs`; Oberfläche folgt in Phase 4); Migrationsliste in `docs/code-map.md` um „Migration 22 = `session_links`, `sessions.cli_scratchpad_dir`, `sessions.links_scanned`“ ergänzen.

## Report-Back

**Ergebnis:** Status `complete`, alle fünf AK erfüllt bis auf die Lint-Stufe von `pnpm check` (unten). Migration 22 liegt an, jede Agenten-Antwort trägt ihre absoluten Dateipfade in `session_links` ein, der Scratchpad der Kommandozeile steht in `sessions.cli_scratchpad_dir`. Sichtbar ändert sich nichts.

**Geändert:** `db/migrations/022_session_links.sql` und `migrations.rs`; `db/session_links.rs` (`upsert_all`, `load`, `is_scanned`, `mark_scanned`); `db/sessions.rs` (`SessionRow.cli_scratchpad_dir`, `set_cli_scratchpad`, Spalte in beiden Abfragen); `file_links/mod.rs` (`VIEWABLE_EXTENSIONS`, `clean` `pub(crate)`); `sourcing/mod.rs` (`strip_fences` `pub(crate)`); `session_files/{mod,links}.rs` (`link_candidates`); `sessions/registry.rs` (`Outbox.linked_files`/`cli_scratchpad`, `SessionState.cli_scratchpad_dir`, Zweige `Text` und `ScratchpadDir`, `persist`, `row_of`); Kommentar in `src/lib/fileLinks.ts`; `docs/code-map.md`.

**Abweichungen:**
- AK 2 nennt `x.mp4`, die Endungslisten des Plans (`OPENABLE_EXTENSIONS`, `VIEWABLE_EXTENSIONS`) kennen `mp4` nicht — die Erkennung nach `filePathOf` hätte es verworfen. `is_link_path` nimmt deshalb zusätzlich jede Endung, die `artifacts::kind_of` als Video oder Ton führt (einzige Zuordnungstabelle der App); keine neue Liste. Folge für Phase 4 steht in `FINDINGS.md`.
- `link_candidates` steht direkt importiert in `registry.rs`: der Name `session_files` ist dort schon die Datenbank-Tabelle `db::session_files`.
- `pub mod session_files;` statt `mod …;` in `lib.rs`, wie alle anderen Module (Beispiele und Prüfprogramme brauchen sie öffentlich).
- `SessionRow` trägt `cli_scratchpad_dir` nur zum Lesen; `upsert` schreibt die Spalte nicht (wie bei den TL;DR-Spalten), `set_cli_scratchpad` tut es.

**Belegt:** Wegwerf-Probelauf (nicht committet) mit der Beispielantwort aus AK 2 plus `.gitignore`, UNC-Pfad, `https://…`, Titel im Link, `%20`, Pfad mit Klammern, doppelte Backticks: Ausgabe `C:\Users\u\x.mp4`, `…\b.log`, `…\r.pdf`, `…\mit leer.csv`, `…\zwei.md`, `C:\Program Files (x86)\a.txt`; relative Pfade, `state.open`, Block-Inhalt, UNC, Adressen fehlen; Dublette einmal. Migration auf einer leeren Datenbank: `user_version` 22, `links_scanned` 0, `cli_scratchpad_dir` NULL; zweimal derselben Pfad hebt nur `last_seen_at`. `pnpm typecheck`, `format:check`, `build`, `rust:fmt`, `rust:clippy` grün.

**Offen 🟡:** `pnpm lint` ist rot, aber nicht durch diese Phase: ESLint scheitert an `docs/planning/2026-11-25_bibliothek-bearbeiten/artifacts/_entwurf-bibliothek-bearbeiten/daten.js` (Commit `d8a1d15` aus dem Plan „Bibliothek“; die Ignorierliste in `eslint.config.js` kennt nur `*.cjs`). Mein Code lint-frei (einziger Fund der Datei). Nicht angefasst, da Ignorierliste ein Gate ist.

**Nicht belegt:** die zwei Registry-Zweige (`Text`, `ScratchpadDir`) in einer laufenden App; geprüft nur über Übersetzung und Clippy, nicht über einen echten Agenten-Lauf.
