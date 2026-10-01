# Phase 2 — Core-Anzeige: Changes und Diff nach Reichweite, fremde Anteile markieren

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ (vor allem „Diff aus verstreuten Commits je Datei“, „Uncommittete Änderungen …“, „Merge-Commits zählen nie“) und **„Kontrakt“** (Typen, Commands). Der Kontrakt ist verbindlich.
- [phase-1-erfassung.md](phase-1-erfassung.md), Abschnitt „Report-Back“: was Phase 1 tatsächlich gebaut hat (Namen von `scan::parse_rev_list`, `RevListEntry`, `db::session_commits`, `db::session_files`, `db::sessions::untracked_before`).
- `src-tauri/src/changes/mod.rs` (ganz): `load`, `load_one`, `load_repository`, `load_ticket`, `read_changes`, `file_diff`, `untracked_stat`, `failed`.
- `src-tauri/src/changes/model.rs`, `src-tauri/src/changes/parse.rs` (`scope_stats` liefert `BTreeMap<String, LineStat>`, `paths` zerlegt `-z`-Ausgaben), `src-tauri/src/changes/attribution.rs`, `src-tauri/src/changes/scan.rs`.
- `src-tauri/src/commands/changes.rs` (ganz).
- `src-tauri/src/sessions/registry.rs`: `get`, `repositories_of`, `project_ticket_worktrees`, Feld `database`.
- `src-tauri/src/git/mod.rs`: `diff_tree_name_status`, `diff_tree_numstat`, `diff_index_*`, `run_raw`.
- `src-tauri/examples/gen-bindings.rs`, `src/lib/changes.ts`, `src/features/changes/useSessionChanges.ts`, `src/features/changes/useFileDiff.ts`.
- [ADR 015](../../decisions/015-changes-je-session.md), [ADR 006](../../decisions/006-changes-und-diff.md).
- [docs/conventions/rust.md](../../conventions/rust.md), [typescript.md](../../conventions/typescript.md), [linting.md](../../conventions/linting.md).
- Fehlerklassen geprüft (Vault `werkzeuge/git`, `systeme/sqlite`, `sprachen/typescript`): keine einschlägig.

**Chesterton:** `read_changes` misst heute alles gegen `base_commit` (ADR 006). Das ist die Grenze „seit Beginn des Vorhabens“, und sie bleibt die Untergrenze: die Commit-Liste ist weiter `base..HEAD`, nur gefiltert. `changes_file_diff` prüft Ticket-Worktree-Ordner gegen die Worktrees des **Vorhabens** (Sicherheitsgrenze, AGENTS.md Regel 5). Diese Prüfung bleibt unverändert und wird auch bei Reichweite `Session` nicht enger, denn sie schützt Pfade und nicht die Anzeige. Die drei Git-Aufrufe für den Schmutz im Arbeitsverzeichnis (`diff-index HEAD`, `ls-files --others`) bleiben dieselben.

## Abnahmekriterien

- `pnpm check` grün. `pnpm bindings` erzeugt `ChangesReach.ts`, `LineStat.ts` mit `foreign: boolean`, `SessionChanges.ts` mit `untrackedBefore: number | null`.
- `changes_load(id, "session")` liefert nur Dateien aus eigenen Commits der Session und eigene, noch offene geschriebene Dateien. Commit-Zahl = eigene Commits ohne Merges.
- `changes_load(id, "project")` liefert die Summe aller Sessions des Vorhabens und alle Ticket-Worktrees des Vorhabens. `"session"` liefert nur die Ticket-Worktrees der Session.
- `foreign` ist gesetzt nach den Regeln in „Zuordnung“ unten. Unter Uncommitted ist es immer `false`.
- `changes_file_diff` mit `Committed` zeigt `from → to` der Datei. Mit `All` zeigt es `from → Arbeitsverzeichnis` bzw. `HEAD → Arbeitsverzeichnis` für Dateien ohne eigene Commits. `Uncommitted` bleibt unverändert, ebenso untracked Dateien.
- Zweites Laden derselben Changes ohne neue Commits ruft `diff-tree` nicht erneut auf (Zwischenspeicher).
- Die Oberfläche läuft weiter: Session-Ansicht und Vorhaben-Übersicht fragen vorerst beide `"session"` (Phase 3 verdrahtet die Übersicht).

## Checkliste

### Typen

- [ ] `changes/model.rs`: `ChangesReach`, `LineStat.foreign`, `SessionChanges.untracked_before`, Doc von `commit_count` laut Kontrakt.
- [ ] Jede Stelle, die `LineStat { … }` baut (`parse::scope_stats`, `changes::untracked_stat`, per Compiler finden), setzt `foreign: false`.
- [ ] `examples/gen-bindings.rs`: `ChangesReach::export_all(&cfg)?;` neben `ChangeScope`.

### Git

- [ ] `git/mod.rs`: `pub fn commit_files(worktree: &Path, parent: &str, commit: &str) -> Result<String, CommandError>`, Doc `/// \`git diff-tree -r --no-renames --name-only -z <parent> <commit>\``, über `run_raw`.

### Commit-Verlauf mit Zwischenspeicher

- [ ] Neue Datei `src-tauri/src/changes/history.rs`, Kopf `//! Die Commits seit der Basis mit ihren Dateien. Was ein Commit geändert hat, ändert sich nie — deshalb merkt es sich der Core (ADR 015).`; in `changes/mod.rs` `pub mod history;`.
  - `pub struct CommitInfo { pub id: String, pub time: i64, pub first_parent: Option<String>, pub files: Vec<String> }` (`#[derive(Debug, Clone)]`), Doc: „\`files\` relativ zum Repository mit \`/\`; gegen den ersten Elternteil.“
  - `const MAX_CACHED_COMMITS: usize = 50_000;`, `const MAX_CACHED_RANGES: usize = 2_000;` mit Kommentar „Darüber wird der Speicher geleert statt einzeln verdrängt: ein Neuaufbau kostet nur Git-Aufrufe.“
  - `static COMMIT_FILES: OnceLock<Mutex<HashMap<String, Vec<String>>>>` und `static RANGE_STATS: OnceLock<Mutex<HashMap<String, BTreeMap<String, LineStat>>>>`. Zugriff über `fn commit_files_cache() -> MutexGuard<…>` bzw. `fn range_stats_cache()` mit `unwrap_or_else(PoisonError::into_inner)`. **Die Sperre nie während eines Git-Aufrufs halten:** erst nachsehen und freigeben, dann Git, dann einfügen.
  - `pub fn read(worktree: &Path, base: &str) -> Result<Vec<CommitInfo>, CommandError>`: `scan::parse_rev_list(&git::commits_since(worktree, base)?)`. Je Eintrag sind die Dateien entweder im Speicher, oder sie kommen aus `parse::paths(&git::commit_files(worktree, parent, &id)?)` (ohne Elternteil: leere Liste). Ergebnis in der Reihenfolge von `rev-list` (älteste zuerst).
  - `pub fn range_stats(worktree: &Path, from: &str, to: &str) -> Result<BTreeMap<String, LineStat>, CommandError>`: Schlüssel `format!("{from}..{to}")`, sonst `parse::scope_stats(&git::diff_tree_name_status(worktree, from, to)?, &git::diff_tree_numstat(worktree, from, to)?)`.
  - Einfügen: ist die Map danach größer als die Obergrenze, vorher `clear()`.

### Zuordnung (`changes/attribution.rs`, ohne Git)

- [ ] `pub struct Ownership { pub commits: HashSet<String>, pub touched: HashMap<String, f64>, pub untracked_before: Option<f64> }` (`#[derive(Debug, Clone, Default)]`), Doc je Feld: eigene Commit-IDs der Reichweite; geschriebene Dateien als normalisierter absoluter Pfad → letzte Uhrzeit in ms; wie `SessionChanges.untracked_before`.
- [ ] `pub struct OwnFile { pub from: String, pub to: String, pub foreign_between: bool, pub foreign_after: bool }` (`#[derive(Debug, Clone)]`) mit Doc: `from` = erster Elternteil des ersten eigenen Commits an der Datei, `to` = letzter eigener Commit an der Datei, `foreign_between` = ein fremder Commit ändert sie zwischen beiden, `foreign_after` = ein fremder Commit ändert sie nach dem ersten eigenen.
- [ ] `pub fn own_files(commits: &[CommitInfo], own: &HashSet<String>) -> BTreeMap<String, OwnFile>`:
  1. Erster Durchlauf mit Index `i` über `commits`: nur Commits mit `own.contains(&id)` und `first_parent == Some(…)`. Je Datei beim ersten Treffer `first_index = i`, `from = first_parent`; bei jedem Treffer `last_index = i`, `to = id`.
  2. Zweiter Durchlauf mit Index `j` über die **nicht** eigenen Commits: je Datei, die in der Map steht, `foreign_between |= first_index < j && j < last_index` und `foreign_after |= j > first_index`.
  3. Indizes nur intern (Hilfs-Struct), Ergebnis ohne sie.
- [ ] `pub fn own_commit_count(commits: &[CommitInfo], own: &HashSet<String>) -> u32`.
- [ ] `pub fn is_open(touched_at: f64, path: &str, commits: &[CommitInfo], own: &HashSet<String>) -> bool`: `false`, wenn ein eigener Commit `c` mit `c.time >= (touched_at / 1000.0).floor() as i64` die Datei `path` (relativ, mit `/`) enthält, sonst `true`. Doc: „Nach dem letzten Schreiben committet: neuer Schmutz stammt nicht mehr von der Reichweite. Dieselbe Sekunde zählt als committet.“

### Changes lesen

- [ ] `changes/mod.rs`: `pub struct ChangesInput { pub workspace: PathBuf, pub repositories: Vec<SessionRepository>, pub ticket_folders: Vec<(u32, String)>, pub own: Ownership }`, Doc „Alles, was die Changes einer Reichweite brauchen; gebaut von \`SessionRegistry::changes_input\`.“
- [ ] `pub fn load(input: &ChangesInput) -> SessionChanges` statt der bisherigen drei Parameter. `own: &Ownership` geht durch `load_one` → `load_repository`/`load_ticket` → `read_changes(worktree, base, own)`. Rückgabe `SessionChanges { repositories, untracked_before: input.own.untracked_before }`.
- [ ] `read_changes(worktree: &Path, base: &str, own: &Ownership)` neu, in dieser Reihenfolge:
  1. `let commits = history::read(worktree, base)?; let own_files = attribution::own_files(&commits, &own.commits);`
  2. **Schmutz** `dirty`: wie bisher `uncommitted` (`diff_index_*` gegen `HEAD` plus untracked Dateien mit `untracked_stat`).
  3. **Uncommitted:** aus `dirty` nur Pfade, für die `own.touched.get(&attribution::normalize_path(&worktree.join(path.replace('/', "\\")).to_string_lossy()))` einen Wert `t` hat und `attribution::is_open(t, path, &commits, &own.commits)` gilt. `foreign` bleibt `false`.
  4. **Committed:** `own_files` nach `(from, to)` gruppieren, je Gruppe einmal `history::range_stats(worktree, from, to)?`. Je Pfad der Gruppe den Eintrag übernehmen (fehlt er, ist die Datei netto unverändert und entfällt), `foreign = own_file.foreign_between`.
  5. **Alle:** `own_files` nach `from` gruppieren, je Gruppe einmal `parse::scope_stats(&git::diff_index_name_status(worktree, from)?, &git::diff_index_numstat(worktree, from)?)` (ganzer Baum, gefiltert auf die Pfade der Gruppe). `foreign = own_file.foreign_after || (dirty.contains_key(path) && !uncommitted.contains_key(path))`. Dazu jeder Pfad aus Uncommitted, der nicht in `own_files` steht, mit seinem Uncommitted-Eintrag.
  6. `commit_count = attribution::own_commit_count(&commits, &own.commits)`.
  7. Zusammenführen zu `FileChange` wie bisher (sortiert nach Pfad).
  Kommentar über der Funktion: „Nur was der Reichweite gehört (ADR 015): eigene Commits je Datei von ihrem ersten bis zum letzten, eigene geschriebene Dateien, solange sie seit dem letzten Schreiben nicht committet sind.“
- [ ] `pub fn file_diff(workspace, repository, ticket, path, scope, own: &Ownership)`: nach Bestimmen von `worktree` und `base`:
  - Hilfsfunktion `fn own_file(worktree: &Path, base: &str, own: &Ownership, path: &str) -> Result<Option<OwnFile>, CommandError>` = `history::read` + `attribution::own_files` + `remove(path)`.
  - `Committed` → `own_file(…)?` fehlt → `CommandError::Internal("Die Datei hat keine eigenen Commits in dieser Ansicht".to_owned())`, sonst `git::diff_tree_patch(&worktree, &file.from, &file.to, path)?`.
  - `All` → mit `own_file` `git::diff_index_patch(&worktree, &file.from, path)?`, ohne `git::diff_index_patch(&worktree, HEAD, path)?`.
  - `Uncommitted` → unverändert.
  - Der Zweig für untracked Dateien danach bleibt unverändert.

### Registry und Commands

- [ ] `registry.rs`: private Methode `fn project_members(&self, session_id: &str) -> Result<Vec<Arc<Session>>, CommandError>` aus dem Anfang von `project_ticket_worktrees` herausziehen (gleiche Filterung, nach `number` sortiert). `project_ticket_worktrees` benutzt sie und bleibt sonst gleich.
- [ ] `registry.rs`, direkt hinter `project_ticket_worktrees`: `pub fn changes_input(&self, session_id: &str, reach: ChangesReach) -> Result<ChangesInput, CommandError>` mit Doc „Workspace, Repositories, Ticket-Worktrees und eigene Commits/Dateien der Reichweite. Nie zwei Session-Sperren zugleich; die Datenbank erst nach den Sperren.“
  - `Session` → Session-IDs `[session.id]`, Ticket-Worktrees `session.lock().ticket_worktrees.clone()`.
  - `Project` → Session-IDs aller `project_members`, Ticket-Worktrees `self.project_ticket_worktrees(session_id)?`.
  - Dann `self.database.with(|connection| Ok(Ownership { commits: session_commits::load_for(connection, &ids)?, touched: session_files::load_for(connection, &ids)?, untracked_before: session_rows::untracked_before(connection, &ids)? }))?` (den Alias für `db::sessions` so verwenden, wie `registry.rs` ihn schon importiert).
  - `ChangesInput { workspace: session.workspace.clone(), repositories: session.repositories(), ticket_folders, own }`.
- [ ] `commands/changes.rs`:
  - `changes_load(registry, session_id: String, reach: ChangesReach)` → `let input = registry.changes_input(&session_id, reach)?; Ok(changes::load(&input))`.
  - `changes_file_diff(registry, session_id: String, reach: ChangesReach, key: String, path: String, scope: ChangeScope)`: `registry.repositories_of(&session_id)?` ersetzen durch `let input = registry.changes_input(&session_id, reach)?;` und `input.workspace`/`input.repositories` verwenden; beide `changes::file_diff`-Aufrufe bekommen `&input.own`. Die Prüfung `is_assigned` mit `project_ticket_worktrees` bleibt wörtlich.
  - Doc-Kommentar von `changes_load`: „Die Changes der Reichweite (ADR 015): nur die Session oder das ganze Vorhaben.“

### Oberfläche (nur Anschluss)

- [ ] `pnpm bindings`.
- [ ] `src/lib/changes.ts`: `loadChanges(sessionId: string, reach: ChangesReach)` → `invoke('changes_load', { sessionId, reach })`; `loadFileDiff(sessionId, reach, key, path, scope)` → `invoke('changes_file_diff', { sessionId, reach, key, path, scope })`. JSDoc: „\`reach\`: \`session\` nur die Session, \`project\` alle Sessions des Vorhabens (ADR 015).“ und bei `loadFileDiff` `internal` um „Datei ohne eigene Commits“ ergänzen.
- [ ] `useSessionChanges.ts` und `useFileDiff.ts`: vorerst `'session'` als zweites Argument übergeben, sonst unverändert.

### Doku und Commit

- [ ] Ladezeit messen: App mit `pnpm tauri dev`, Vorhaben „Spracheingabe“ (oder ein anderes mit mehreren Commits), Changes der Session öffnen. Dauer von `changes_load` per `console.time` im Entwicklerfenster um `loadChanges` (danach wieder entfernen) für den ersten und zweiten Aufruf ins Report-Back schreiben.
- [ ] `docs/code-map.md`, Zeile „Changes“ (Core): „`history.rs` Commits seit der Basis mit Dateien, Zwischenspeicher; `attribution.rs` `Ownership`, `own_files`, `is_open`; `ChangesInput` und `SessionRegistry::changes_input` (Reichweite Session/Vorhaben)“. Den Teil „Ticket-Worktrees aller Sessions des Vorhabens“ ersetzen durch „Ticket-Worktrees der Reichweite“.
- [ ] Commit `feat(changes): show only the changes of the session or project`.

## Report-Back
