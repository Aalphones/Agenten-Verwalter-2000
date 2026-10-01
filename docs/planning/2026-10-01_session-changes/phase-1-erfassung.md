# Phase 1 — Erfassen: eigene Commits und geschriebene Dateien je Session, ADR 015

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Messungen und Belege“, „Festgelegte Entscheidungen“ und **„Kontrakt“** (Agent-Ereignis, Schema). Der Kontrakt ist verbindlich.
- `src-tauri/src/agents/claude/translate.rs`: `Translator` (Felder `bash_calls`, `started_tasks`), `handle_assistant`, `remember_bash`, `handle_user`, `subagent_events`, `used_paths`, Konstante `BASH_TOOL`.
- `src-tauri/src/agents/claude/protocol.rs`: `ContentBlock` (`ToolUse { id, name, input }`, `ToolResult { tool_use_id, .. }`), `UserContent`, `MessageLine` (`parent_tool_use_id`).
- `src-tauri/src/agents/event.rs`: `AgentEvent` (`ToolStarted`, `SubagentStep` mit `tool` und `used_paths`).
- `src-tauri/src/sessions/registry.rs`: `Session` (Felder `workspace`, `database`, Methoden `lock`, `log_line`, `repositories`), `SessionState::apply_event`, `note_ticket_worktrees`, `Outbox`, `update`, `persist`, `schedule_worktree_cleanup` (Vorbild für einen benannten Hintergrund-Thread), `now_ms`, Kindmodul `mod tldr;` (Vorbild für ein Kindmodul).
- `src-tauri/src/sessions/registry/tldr.rs`: Kopf (`use super::{…}`) als Vorbild für `registry/commit_scan.rs`.
- `src-tauri/src/worktrees/mod.rs`: `SessionRepository` (`working_dir`, `base_commit`, `checkout`), `TicketWorktree`, `ticket_worktrees`, `ticket_base`.
- `src-tauri/src/changes/mod.rs`: `is_app_worktree_missing`, wie `load_repository` und `load_ticket` Ordner und Basis bestimmen.
- `src-tauri/src/git/mod.rs`: `commit_count` (Vorbild für einen `rev-list`-Aufruf), `run`, `run_raw`, `args`.
- `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/migrations/004_main_checkout.sql`, `src-tauri/src/db/session_ticket_worktrees.rs` (Vorbild für beide neuen DB-Dateien), `src-tauri/src/db/mod.rs` (Modulliste, `Database::with`).
- [docs/decisions/006-changes-und-diff.md](../../decisions/006-changes-und-diff.md), [010](../../decisions/010-worktrees-durch-den-agenten.md), [011](../../decisions/011-vorhaben-und-sessions.md) (Format eines ADR).
- [docs/conventions/rust.md](../../conventions/rust.md), [linting.md](../../conventions/linting.md), [commits.md](../../conventions/commits.md).
- Fehlerklassen geprüft (Vault `werkzeuge/git`, `systeme/sqlite`; keine Rust-/Tauri-Entity vorhanden): keine einschlägig. `werkzeuge/git` warnt vor `rev-parse --abbrev-ref HEAD` als Standard-Branch. Diese Phase bestimmt keinen Standard-Branch neu, sie benutzt `worktrees::ticket_base`.

**Chesterton:** `handle_user` verwirft heute alle Werkzeug-Ergebnisse von Subagenten, weil ihre Ausgaben nur in der Schrittliste des Subagenten erscheinen sollen und nicht als Befehl im Hintergrund-Panel. Das bleibt so: die Änderung liest aus diesen Zeilen nur die `tool_use_id`, um ein Zeitfenster zu schließen, und gibt sonst weiter nichts aus. `persist` schreibt unter der Session-Sperre, damit Änderungen derselben Session in der richtigen Reihenfolge ankommen. Die neuen Datei-Einträge laufen über denselben Weg. Die Commit-Suche braucht Git und läuft deshalb **nicht** unter der Sperre, sondern in einem eigenen Thread nach `update`.

## Abnahmekriterien

- `pnpm check` grün. Eine bestehende Datenbank wird auf Version 7 gehoben, alle bestehenden Sessions haben danach `changes_tracked_at` gesetzt. Eine danach angelegte Session hat `NULL`.
- Ein Bash- oder PowerShell-Aufruf mit `git` im Befehl (Hauptagent oder Subagent, Vordergrund) erzeugt beim Eingang seines Ergebnisses genau ein `GitCommandEnded`, andere Aufrufe keins. Ein Aufruf mit `run_in_background: true` erzeugt keins.
- Ein Commit, den der Agent oder ein Subagent macht, steht kurz darauf in `session_commits` mit der Session-ID. Ein Commit, der zur selben Zeit nicht in einem Fenster der Session lag, steht dort nicht.
- `Edit`, `Write`, `MultiEdit` und `NotebookEdit` von Agent und Subagenten hinterlassen den normalisierten Pfad in `session_files`. Ein erneutes Schreiben hebt `touched_at` an und senkt es nie.
- Die Anzeige der Changes ist in dieser Phase **unverändert** (die neuen Daten werden erst in Phase 2 gelesen).
- `docs/decisions/015-changes-je-session.md` existiert. ADR 006 und 011 tragen je einen Verweis-Satz.

## Checkliste

### Schema

- [ ] Neue Datei `src-tauri/src/db/migrations/007_session_changes.sql` mit genau dem SQL aus dem Kontrakt.
- [ ] `src-tauri/src/db/migrations.rs`: `MIGRATIONS` auf `[&str; 7]`, Eintrag `include_str!("migrations/007_session_changes.sql")` hinten anhängen.
- [ ] Neue Datei `src-tauri/src/db/session_commits.rs`, Kopf `//! Tabelle \`session_commits\`: Commits, die eine Session gemacht hat (ADR 015).`, aufgebaut wie `session_ticket_worktrees.rs`:
  - `pub fn insert_all(connection: &mut Connection, session_id: &str, commits: &[String]) -> Result<(), CommandError>`: eine Transaktion, `INSERT OR IGNORE INTO session_commits (session_id, commit_id) VALUES (?1, ?2)`.
  - `pub fn load_for(connection: &Connection, session_ids: &[String]) -> Result<HashSet<String>, CommandError>`: je Session-ID `SELECT commit_id FROM session_commits WHERE session_id = ?1`, alles in ein `HashSet`.
- [ ] Neue Datei `src-tauri/src/db/session_files.rs`, Kopf `//! Tabelle \`session_files\`: Dateien, die der Agent einer Session geschrieben hat, mit der letzten Uhrzeit (ADR 015).`:
  - `pub fn upsert_all(connection: &mut Connection, session_id: &str, files: &[(String, f64)]) -> Result<(), CommandError>`: eine Transaktion, `INSERT INTO session_files (session_id, path, touched_at) VALUES (?1, ?2, ?3) ON CONFLICT(session_id, path) DO UPDATE SET touched_at = max(touched_at, excluded.touched_at)`.
  - `pub fn load_for(connection: &Connection, session_ids: &[String]) -> Result<HashMap<String, f64>, CommandError>`: je Session-ID `SELECT path, touched_at FROM session_files WHERE session_id = ?1`. Bei gleichem Pfad aus mehreren Sessions gilt der größere Wert.
- [ ] `src-tauri/src/db/sessions.rs`: `pub fn untracked_before(connection: &Connection, session_ids: &[String]) -> Result<Option<f64>, CommandError>`: je Session-ID `SELECT changes_tracked_at FROM sessions WHERE id = ?1` (`Option<f64>`, Zeile fehlt → `None`), Ergebnis = größter gesetzter Wert. Doc-Kommentar: „Wann die Aufzeichnung für die älteste Session der Auswahl begann; `None`, wenn alle ab Anlegen aufgezeichnet sind.“ `upsert` bleibt unverändert (es schreibt die Spalte nicht, sie bleibt erhalten).
- [ ] `src-tauri/src/db/mod.rs`: `pub mod session_commits;` und `pub mod session_files;` alphabetisch einreihen.

### Pfade normalisieren

- [ ] Neue Datei `src-tauri/src/changes/attribution.rs`, Kopf `//! Was zu einer Session gehört: eigene Commits, geschriebene Dateien (ADR 015).`. In dieser Phase nur:
  - `pub fn normalize_path(path: &str) -> String`: `\\?\` am Anfang entfernen, `/` → `\`, abschließende `\` entfernen, `to_lowercase()`. Doc-Kommentar: „Windows-Pfade unterscheiden keine Groß-/Kleinschreibung; so vergleicht die App, was der Agent schrieb, mit dem, was Git meldet.“
- [ ] `src-tauri/src/changes/mod.rs`: `pub mod attribution;` und `pub mod scan;` zu den Modulen.

### Commits im Fenster finden

- [ ] `src-tauri/src/git/mod.rs`: `pub fn commits_since(worktree: &Path, from: &str) -> Result<String, CommandError>`, Doc `/// \`git rev-list --reverse --topo-order --no-merges --timestamp --parents <from>..HEAD\``, Aufruf mit `run` wie `commit_count`.
- [ ] Neue Datei `src-tauri/src/changes/scan.rs`, Kopf `//! Welche neuen Commits ein beendeter Git-Befehl der Session hinterlassen hat (ADR 015).`:
  - `const START_SLACK_SECONDS: i64 = 2;` mit Kommentar „Git speichert ganze Sekunden, und der Werkzeugaufruf kommt eventuell erst nach dem Start an — gemessen lag ein Commit genau auf der Startsekunde.“, `const END_SLACK_SECONDS: i64 = 1;`.
  - `pub struct ScanDir { pub dir: PathBuf, pub base: String }`.
  - `pub fn session_dirs(workspace: &Path, repositories: &[SessionRepository], ticket_folders: &[(u32, String)]) -> Vec<ScanDir>`: je Repository an Position `i` zuerst `repository.working_dir(workspace)` mit `repository.base_commit` (übersprungen, wenn `repository.repository_path.join(".git")` fehlt oder der Ordner nicht existiert), dann je `worktrees::ticket_worktrees(repository, i, &super::folders_of(ticket_folders, i))` (das Kindmodul darf die private Funktion aus `changes/mod.rs` benutzen) der Pfad mit der Basis aus `worktrees::ticket_base` (Fehler → überspringen).
  - `pub fn own_commits(dirs: &[ScanDir], windows: &[(f64, f64)]) -> Vec<String>`: je Ordner `git::commits_since`, Fehler → Ordner überspringen. Jede Zeile `<Zeit> <ID> …` zerlegen. Ein Commit gehört dazu, wenn für irgendein Fenster `(start, end)` gilt: `zeit >= (start / 1000.0).floor() as i64 - START_SLACK_SECONDS` und `zeit <= (end / 1000.0).ceil() as i64 + END_SLACK_SECONDS`. Ergebnis ohne Doppelte, in Fundreihenfolge.
  - Die Zeilen-Zerlegung als `pub fn parse_rev_list(text: &str) -> Vec<RevListEntry>` mit `pub struct RevListEntry { pub id: String, pub time: i64, pub first_parent: Option<String> }`. Zeilen, die sich nicht zerlegen lassen, werden übersprungen. Phase 2 benutzt sie wieder.

### Übersetzer

- [ ] `translate.rs`: Konstante `const POWERSHELL_TOOL: &str = "PowerShell";` neben `BASH_TOOL`, `const GIT_WORD: &str = "git";`.
- [ ] `Translator`: Feld `git_calls: HashMap<String, f64>` mit Doc „Laufende Bash-/PowerShell-Aufrufe mit \`git\` im Befehl (Hauptagent und Subagenten, nur Vordergrund) nach \`tool_use_id\` → Eingang in ms; ihr Ergebnis schließt das Zeitfenster für die Commit-Suche (ADR 015).“
- [ ] Freie Funktion `fn now_ms() -> f64` in `translate.rs` (gleiche Rechnung wie `now_ms` in `registry.rs`, `SystemTime`/`UNIX_EPOCH` importieren).
- [ ] Methode `fn remember_git_call(&mut self, block: &ContentBlock)`: nur `ContentBlock::ToolUse { id, name, input }` mit `name == BASH_TOOL || name == POWERSHELL_TOOL`, `input["command"]` als String enthält `GIT_WORD`, `input["run_in_background"]` ist nicht `true` → `self.git_calls.insert(id.clone(), now_ms())`.
- [ ] `handle_assistant`: als erste Anweisung `for block in &line.message.content { self.remember_git_call(block); }` — **vor** dem `if let Some(parent)`-Zweig, damit Subagenten-Aufrufe mitzählen.
- [ ] Methode `fn ended_git_calls(&mut self, blocks: &[ContentBlock]) -> Vec<AgentEvent>`: für jeden `ContentBlock::ToolResult { tool_use_id, .. }`, dessen ID in `git_calls` steht: entfernen und `AgentEvent::GitCommandEnded { started_at, ended_at: now_ms() }` liefern.
- [ ] `handle_user` umbauen, in dieser Reihenfolge: (1) `let resolved_model: Option<String> = …` unverändert aus dem bisherigen Rumpf an den Anfang ziehen. (2) `let UserContent::Blocks(blocks) = line.message.content else { return Vec::new(); };` (3) `let mut events = self.ended_git_calls(&blocks);` (4) `if line.parent_tool_use_id.is_some() { return events; }` mit dem Kommentar „Von einem Subagenten zählt nur das Ende eines Git-Befehls; seine Ergebnisse zeigt nur seine Schrittliste.“ (5) Die bisherige Schleife `for block in blocks` unverändert, sie schreibt in dasselbe `events`. Die alte Zeile `let mut events: Vec<AgentEvent> = Vec::new();` entfällt.

### Ereignis und Registry

- [ ] `agents/event.rs`: Variante `GitCommandEnded` laut Kontrakt hinter `CommandFinished`.
- [ ] `registry.rs`, `Outbox`: Felder `touched_files: Vec<(String, f64)>` (Doc „Von Agent oder Subagent geschriebene Dateien als (normalisierter Pfad, ms).“) und `commit_windows: Vec<(f64, f64)>` (Doc „Zeitfenster beendeter Git-Befehle; nach dem Freigeben der Sperre sucht ein Thread darin die eigenen Commits.“).
- [ ] `registry.rs`: Konstante `const WRITING_TOOLS: [&str; 4] = ["Edit", "Write", "MultiEdit", "NotebookEdit"];`. Methode `SessionState::note_touched_files(&mut self, outbox: &mut Outbox, tool: &str, used_paths: &[String])`: nur wenn `WRITING_TOOLS.contains(&tool)`, je Pfad `outbox.touched_files.push((attribution::normalize_path(path), now_ms()))`. Doc „Liest nur Text — wie \`note_ticket_worktrees\`.“
- [ ] `apply_event`: in den Zweigen `ToolStarted` und `SubagentStep` direkt nach `note_ticket_worktrees` `self.note_touched_files(outbox, &tool, &used_paths);`. Neuer Zweig `AgentEvent::GitCommandEnded { started_at, ended_at } => outbox.commit_windows.push((started_at, ended_at)),` ohne `wake_if_idle`.
- [ ] `persist`: hinter dem Block für `ticket_worktrees` `if !outbox.touched_files.is_empty() { session_files::upsert_all(connection, &session.id, &outbox.touched_files)?; }`; Import `session_files` zu den `db`-Importen.
- [ ] `update`: direkt nach `outbox.emit(app, session);` `let windows = std::mem::take(&mut outbox.commit_windows); if !windows.is_empty() { commit_scan::schedule(Arc::clone(session), windows); }` mit dem Kommentar „Git gehört nicht unter die Session-Sperre.“ (`outbox` wird dazu `let mut`, falls nicht schon so).
- [ ] Neues Kindmodul `src-tauri/src/sessions/registry/commit_scan.rs` (in `registry.rs` `mod commit_scan;` neben `mod tldr;`; der Name vermeidet einen Konflikt mit `crate::changes`). Kopf `//! Commits einer Session finden und speichern (ADR 015).`, Importe nach dem Vorbild von `tldr.rs` (`use super::Session;`, `use crate::changes::scan;`, `use crate::db::session_commits;`). Inhalt:
  - `pub(super) fn schedule(session: Arc<Session>, windows: Vec<(f64, f64)>)`: ein Thread `thread::Builder::new().name("commit-scan".to_owned()).spawn(move || …)` wie `schedule_worktree_cleanup`, Fehler beim Starten ignorieren mit Kommentar „Startet der Thread nicht, fehlen diese Commits in den Changes — kein Fehler für den Nutzer.“ Im Thread: `let repositories = session.repositories(); let ticket_folders = session.lock().ticket_worktrees.clone();` (Sperre nur für diese Zeile), `let dirs = scan::session_dirs(&session.workspace, &repositories, &ticket_folders); let commits = scan::own_commits(&dirs, &windows);` leer → fertig, sonst `session.database.with(|connection| session_commits::insert_all(connection, &session.id, &commits))`, Fehler → `session.log_line(format!("Commits der Session nicht gespeichert: {error}"))`.
  - Braucht das Kindmodul private Felder oder Methoden von `Session` (`workspace`, `database`, `lock`, `log_line`, `repositories`), reicht die Sichtbarkeit aus: Kindmodule sehen private Elemente des Elternmoduls.
- [ ] Alle `match`-Stellen über `AgentEvent`, die der Compiler als unvollständig meldet, ergänzen (nur `registry.rs` erwartet).

### ADR

- [ ] Neue Datei `docs/decisions/015-changes-je-session.md` im Format von ADR 011: Titel „015 — Changes je Session: eigene Commits und geschriebene Dateien“, Status angenommen, Datum des Commits. **Kontext:** Changes zeigten alles seit der Basis des Vorhabens, auch fremde Commits und Änderungen im geteilten Haupt-Checkout. **Optionen:** Commit-IDs aus der Ausgabe von `git commit` lesen / HEAD vor und nach jedem Befehl vergleichen / Zeitfenster der Git-Befehle gegen die Committer-Zeit; für uncommittete Änderungen: alles / geschriebene Dateien / Schnappschüsse je Befehl. **Entscheidung** und **Konsequenzen:** jeden Punkt aus „Festgelegte Entscheidungen“ der README übernehmen, mit den Messwerten (Fenster, Toleranzen 2 s/1 s), dazu die Grenzen: Commits aus Hintergrund-Befehlen, Konfliktlösungen in Merge-Commits, per Shell erzeugte uncommittete Dateien und Commits außerhalb von HEAD (Branch gewechselt) fehlen. Parallele Sessions im selben Fenster teilen sich einen Commit. Ein Commit, den Sascha selbst für die Session macht, gehört ihr nicht.
- [ ] `docs/decisions/011-vorhaben-und-sessions.md`, Punkt „Gemeinsam im Vorhaben“: hinter „…erscheinen in den Changes jeder seiner Sessions.“ den Satz „Abgelöst durch [ADR 015](015-changes-je-session.md): eine Session zeigt nur ihre eigenen Änderungen, die Übersicht des Vorhabens die Summe.“
- [ ] `docs/decisions/006-changes-und-diff.md`, unter „Konsequenzen“ letzter Punkt: „Welche Commits und Dateien in die drei Blickwinkel eingehen, regelt seit [ADR 015](015-changes-je-session.md) die Zuordnung zur Session.“

### Doku und Commit

- [ ] `docs/code-map.md`, Zeile „Persistenz (SQLite)“: Dateien `session_commits.rs`, `session_files.rs` und „Migration 7 = Commits und geschriebene Dateien je Session, `sessions.changes_tracked_at`“ ergänzen. Zeile „Changes“ (Core): „`attribution.rs` Zuordnung zur Session (ab Phase 2 vollständig), `scan.rs` Commits im Zeitfenster eines Git-Befehls; Thread `sessions/registry/commit_scan.rs`“. Zeile „Git-Aufrufe“ bleibt (nur `rev-list`).
- [ ] Commit `feat(changes): record commits and written files per session`.

## Report-Back
