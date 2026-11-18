# Phase 2 — Kern: Verlauf je Session und Diff eines Commits

Rating: standard. Der Kern liefert, welche Session welche Commits gemacht hat, mit Betreff, Zeit und Dateien, und den Diff eines einzelnen eigenen Commits an einer Datei. Dazu der Befehl, der eine Datei in VS Code öffnet. Keine Oberfläche in dieser Phase.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (`HistoryFile`, `HistoryCommit`, `HistorySession`, `ProjectHistory`, Commands, `EMPTY_TREE`)
- [phase-1-kern-baum.md](phase-1-kern-baum.md) → `files/mod.rs` (`checked_path`), `commands/files.rs`
- `src-tauri/src/db/session_commits.rs` — `load_for` (Muster für die neue Abfrage)
- `src-tauri/src/sessions/registry.rs` — `changes_input` (wie die Session-IDs eines Vorhabens über `project_members` entstehen und wie `self.database.with(...)` benutzt wird), der Bau von `SessionSummary` (woher `number` und `name` einer Session kommen)
- `src-tauri/src/changes/mod.rs` — `read_source` (wie die Basis eines Eintrags bestimmt wird: `source_base` für Repositories, `base_of` für Ticket-Worktrees), `file_diff` (Muster: `git::diff_tree_patch` → `parse::unified` → `new_line_count`), `own_commits`
- `src-tauri/src/changes/history.rs` — `read`, `files_of`, `split_by_commit`, der Speicher `COMMIT_FILES` (Muster für einen Speicher je Commit)
- `src-tauri/src/changes/parse.rs` — `scope_stats(name_status, numstat)`, `unified`
- `src-tauri/src/git/mod.rs` — `subjects`, `commit_files`, `diff_tree_patch`, `run_raw`, `args`
- `src-tauri/src/git/actions.rs` — `open_in_vs_code`, `hide_console`; `src-tauri/src/commands/git.rs` — `git_open`, `entry_dir`
- `docs/conventions/rust.md`
- Fehlerklassen geprüft (Vault `werkzeuge/git`): keine einschlägig.

## AK

1. `files_history` liefert je Session des Vorhabens, die mindestens einen gespeicherten Commit hat, einen `HistorySession` mit `sessionId`, `number`, `name`; Sessions nach `number` absteigend, bei gleicher Nummer nach Anlegezeit absteigend; Commits je Session nach `time` absteigend.
2. Jeder `HistoryCommit` trägt `id`, `shortId` (7 Zeichen), `subject`, `time`, `group`, `groupName`, `key` und je Datei `kind`, `added`, `deleted`, `binary`, gemessen gegen den ersten Elternteil und ohne Umbenennungs-Erkennung. Merge-Commits kommen in `session_commits` nicht vor und brauchen keinen Sonderfall.
3. Ein Commit, den kein Eintrag zwischen seiner Basis und `HEAD` enthält, der aber im Objektspeicher eines Repositorys liegt, trägt `loose: true` und als `key` den Schlüssel des ersten Eintrags dieser Gruppe. Ein Commit, den kein Repository des Vorhabens kennt, fehlt in der Liste und zählt in `missing`.
4. `files_commit_diff` liefert für einen Commit aus `session_commits` des Vorhabens den `FileDiff` der Datei gegen den ersten Elternteil; für einen Commit ohne Elternteil gegen `EMPTY_TREE`. Eine ID, die nicht zu den eigenen Commits des Vorhabens gehört, endet in `CommandError::Internal("Kein eigener Commit des Vorhabens")`.
5. Ändert ein Commit an einer Datei nur die Dateirechte, ist `FileDiff.lines` leer und `binary` `false`; `HistoryFile` trägt dafür `added: 0`, `deleted: 0`.
6. `files_open_in_editor` startet `code --goto <absoluter Pfad>:<Zeile>` (ohne Zeile `code <absoluter Pfad>`), unter Windows über `cmd /C code`; fehlt `code`, kommt die Meldung von `open_in_vs_code`.
7. Der zweite Aufruf von `files_history` für dasselbe Vorhaben startet für schon gelesene Commits keinen Git-Prozess mehr.
8. `pnpm bindings` ausgeführt (neu: `ProjectHistory.ts`, `HistorySession.ts`, `HistoryCommit.ts`, `HistoryFile.ts`), `pnpm check` grün.

## Checkliste

- [ ] `db/session_commits.rs`: `pub fn load_by_session(connection, session_ids: &[String]) -> Result<Vec<(String, String)>, CommandError>` — Paare `(session_id, commit_id)`, ein vorbereitetes Statement wie in `load_for`.
- [ ] `sessions/registry.rs`: `pub fn history_input(&self, session_id: &str) -> Result<(ChangesInput, Vec<(String, u32, String, f64)>, Vec<(String, String)>), CommandError>` — das `ChangesInput` der Reichweite `Project`, dazu je Session des Vorhabens `(id, number, name, created_at)` und die Paare aus `load_by_session`. Namen und Nummer aus derselben Quelle wie `SessionSummary`.
- [ ] `changes/mod.rs`: aus `read_source` die Bestimmung der Basis als `pub(crate) fn entry_base(source: &Source) -> Result<String, CommandError>` herausziehen (Repository: `source_base`, Ticket-Worktree: erste Komponente von `base_of`); `read_source` benutzt sie.
- [ ] `git/mod.rs`: `existing_commits(dir, ids: &[String]) -> Result<HashSet<String>, CommandError>` (`git cat-file --batch-check` mit den IDs je Zeile auf der Standardeingabe; eine Zeile `<id> commit <Größe>` zählt, `<id> missing` nicht — dafür eine Variante von `run_raw` mit Standardeingabe, falls es keine gibt), `commit_heads(dir, ids)` (`git log --no-walk=unsorted --format=%H%x09%P%x09%ct%x09%s <ids>`), `commit_name_status(dir, ids)` (`git log --no-walk=unsorted --no-renames --format=%x01%H --name-status <ids>`), `commit_numstat(dir, ids)` (dasselbe mit `--numstat`). Bei mehr als 200 IDs in Blöcken zu 200 aufrufen (Länge der Befehlszeile unter Windows).
- [ ] `files/history.rs` → `pub fn history(input: &ChangesInput, sessions: &[(String, u32, String, f64)], pairs: &[(String, String)]) -> ProjectHistory`:
  1. `sources::sources(input)`; je Gruppe der erste `Source` ohne `error` ist ihr Leseordner.
  2. Je Gruppe `existing_commits(Leseordner, noch nicht zugeordnete IDs)`; ein Commit gehört der ersten Gruppe, die ihn kennt. Rest → `missing`.
  3. Je Eintrag `changes::own_commits(&source.dir, &entry_base(source)?, &input.own)`; die Vereinigung der IDs ist „enthalten“. `key` eines Commits = Schlüssel des ersten Eintrags, der ihn enthält; sonst `loose: true` und der Schlüssel des Leseordners. Scheitert ein Eintrag, gilt er als leer.
  4. Kopf und Dateien je Commit aus `commit_heads`, `commit_name_status`, `commit_numstat`: die Ausgaben an `\x01` trennen, je Commit `parse::scope_stats(name_status, numstat)` → `HistoryFile` (`kind`, `added`, `deleted`, `binary` aus `LineStat`).
  5. Speicher `static COMMITS: OnceLock<Mutex<HashMap<String, (Kopf, Vec<HistoryFile>)>>>` wie `COMMIT_FILES`, Schlüssel `<kanonischer Leseordner>|<id>`, höchstens 50 000 Einträge (dann leeren); nur fehlende IDs gehen an Git.
  6. Sessions und Commits nach AK 1 sortieren; Sessions ohne Commit auslassen.
- [ ] `files/history.rs` → `pub fn commit_diff(source: &Source, own: &Ownership, commit: &str, path: &str) -> Result<FileDiff, CommandError>`: `own.commits.contains(commit)` verlangen, `validate_path`, Elternteil über `commit_heads` (erstes Feld von `%P`, leer → `EMPTY_TREE`), `git::diff_tree_patch(&source.dir, <Elternteil>, commit, path)`, `parse::unified`; `new_line_count` aus `git::show_file(&source.dir, commit, path, MAX_UNTRACKED_BYTES)` wie in `file_diff`.
- [ ] `git/actions.rs`: `pub fn open_file_in_vs_code(file: &Path, line: Option<u32>) -> Result<(), CommandError>` nach dem Muster von `open_in_vs_code`; mit Zeile die Argumente `--goto` und `<Pfad>:<Zeile>`.
- [ ] `commands/files.rs`: `files_history` (ruft `registry.history_input`, dann `files::history::history`), `files_commit_diff` (Reichweite `Project`, `sources::find`), `files_open_in_editor` (`files::checked_path`, dann `open_file_in_vs_code`); im `invoke_handler` eintragen.
- [ ] `src/lib/files.ts`: `loadHistory(sessionId)`, `loadCommitDiff(sessionId, key, commit, path)`, `openInEditor(sessionId, key, path, line)`.
- [ ] `pnpm bindings`, `pnpm check`.
- [ ] Doku: Code-Map-Zeile „Dateien“ um „Verlauf je Session, Schritt-Diff“ ergänzen; Glossar-Einträge „Schritt“ und „Loser Commit“ (ein gespeicherter Commit, den kein Eintrag zwischen Basis und `HEAD` enthält).

## Report-Back
