# Phase 1 — Core liest den Git-Zustand

Ziel: Der Core liefert je Eintrag der Session-Changes Branch, Upstream, ↓/↑, laufenden Merge/Rebase samt Konflikt-Dateien, fremde uncommittete Dateien, die eigenen Commits mit „gepusht ja/nein“ und welche Sessions des Vorhabens gerade arbeiten (Sperre). Dazu die Branch-Liste fürs Menü. Noch keine Oberfläche, nichts Schreibendes.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ und „Kontrakt“ (Typen, `git_status`, `git_branches`).
- `src-tauri/src/git/mod.rs` — `run`, `run_raw`, `run_raw_with_input`, `run_allowing_failure`, `git_command` (setzt `GIT_TERMINAL_PROMPT=0` und `GIT_OPTIONAL_LOCKS=0`), `head_branch`, `default_branch`, `diff_index_name_status`, `diff_index_numstat`, `untracked_files`.
- `src-tauri/src/changes/mod.rs` — `load`, `load_repository`, `load_ticket` (Basis je Eintrag), `read_changes`, `dirty_stats` (alles Uncommittete), `open_uncommitted` (der eigene Teil davon). `changes/history.rs` (`read`, `CommitInfo`), `changes/attribution.rs` (`Ownership`, `own_files`, `is_open`), `changes/sources.rs` (`Source`, `sources`, `find`).
- `src-tauri/src/commands/changes.rs` — Muster für Commands mit `session_id` + `key` (`registry.changes_input(&session_id, ChangesReach::Session)`, dann `sources::find`).
- `src-tauri/src/sessions/registry.rs` — `changes_input`; `src-tauri/src/sessions/model.rs` — `SessionStatus`, `SessionSummary` (`number`, `name`, `project_id`).
- `src-tauri/examples/gen-bindings.rs` — Export-Liste.
- [docs/conventions/rust.md](../../conventions/rust.md), [ADR 014](../../decisions/014-changes-je-session.md), [ADR 020](../../decisions/020-innere-repositories.md).
- Fehlerklassen: Vault `werkzeuge/git.md` — einschlägig: (a) „Negativbefund aus einer nicht aktualisierten Historie“: ↓/↑ gegen `@{u}` sind ohne Fetch beliebig alt → der Fetch-Zeitpunkt wird mitgeführt (Phase 2/3); (b) „`rev-parse --abbrev-ref HEAD` als Default-Branch gelesen“: für den Standard-Branch nur `git::default_branch` verwenden, nie den ausgecheckten Branch.

## AK der Phase

- `cargo run --manifest-path src-tauri/Cargo.toml --example git-probe -- <Datenbank-Kopie> <Session-ID>` gibt `GitSessionStatus` als JSON aus; für eine Session mit dem Verwalter-Repository stehen dort `branch`, `upstream` (`origin/main`), `ahead`/`behind` wie `git rev-list --left-right --count HEAD...@{u}` sie zeigt.
- Eine von Hand angelegte Datei `probe.txt` im Repository steht unter `foreign`, eine vom Agenten der Session geschriebene nicht.
- Ein lokaler, nicht gepushter eigener Commit hat `pushed: false`, ältere eigene `pushed: true`; ohne Upstream sind alle `false`.
- Läuft ein Merge mit Konflikt (von Hand erzeugt), ist `operation` `merge` und `conflicted` nennt die Datei.
- `git_branches` liefert lokale und Remote-Branches ohne `origin/HEAD`, `current` am ausgecheckten, `worktree` gesetzt für einen Branch, der in einem Ticket-Worktree ausgecheckt ist.
- `busy` enthält die eigene Session, solange sie im Status `Running` ist, und ist leer, sobald sie `Paused`/`Completed` ist.
- ADR 025 liegt unter `docs/decisions/025-git-werkzeuge.md`.
- `pnpm check` grün.

## Checkliste

### Typen `src-tauri/src/git/model.rs`

- [ ] Alle Typen aus README „Kontrakt / Typen“ wörtlich anlegen, `#[derive(Debug, Clone, Serialize, Deserialize, TS)]`, `#[serde(rename_all = "camelCase")]`, Enums ebenso. `GitOpenTarget { Explorer, VsCode }` gleich mit anlegen (Phase 4 nutzt ihn).
- [ ] `pub mod model;` in `git/mod.rs`; alle Typen in `examples/gen-bindings.rs` eintragen; `pnpm bindings`.

### Git-Aufrufe in `src-tauri/src/git/mod.rs` (lesend, nur über `run`/`run_raw`/`run_allowing_failure`)

- [ ] `pub fn upstream(dir) -> Result<Option<String>>`: `rev-parse --abbrev-ref --symbolic-full-name @{u}` über `run_allowing_failure`; Exit ≠ 0 → `None`.
- [ ] `pub fn remotes(dir) -> Result<Vec<String>>`: `remote`, je Zeile ein Name.
- [ ] `pub fn ahead_behind(dir, upstream) -> Result<(u32, u32)>`: `rev-list --left-right --count HEAD...<upstream>` → „links rechts“ = (ahead, behind).
- [ ] `pub fn unpushed(dir, upstream) -> Result<HashSet<String>>`: `rev-list <upstream>..HEAD`.
- [ ] `pub fn git_path_exists(dir, name) -> Result<bool>`: `rev-parse --git-path <name>`, Ergebnis relativ zu `dir` auflösen, `exists()`. Für `MERGE_HEAD`, `rebase-merge`, `rebase-apply` — funktioniert auch in Worktrees, deren `.git` eine Datei ist.
- [ ] `pub fn conflicted(dir) -> Result<Vec<String>>`: `diff --name-only --diff-filter=U -z` über `run_raw`, an `\0` trennen.
- [ ] `pub fn subjects(dir, ids: &[String]) -> Result<HashMap<String, String>>`: `log --no-walk=unsorted --stdin --format=%H%x00%s` über `run_raw_with_input` (IDs zeilenweise); leere `ids` → leere Map ohne Aufruf.
- [ ] `pub fn is_ancestor(dir, commit, of) -> Result<bool>`: `merge-base --is-ancestor`, Exit 0 → true, 1 → false, sonst Fehler (Muster wie die bestehende Funktion mit `Some(0)`/`Some(1)`).
- [ ] `pub fn branch_refs(dir) -> Result<String>`: `for-each-ref --format=%(refname)%00%(HEAD)%00%(worktreepath) refs/heads refs/remotes` über `run_raw`.
- [ ] Doc-Kommentar oben in `git/mod.rs` ergänzen: ab Phase 2 auch schreibende Befehle; lesende weiter ohne Index-Sperre.

### Zuschnitt in `src-tauri/src/changes/mod.rs` (keine Verhaltensänderung der Changes)

- [ ] Aus `load_repository`/`load_ticket` die Bestimmung der Basis als `pub(crate) fn source_base(source: &Source) -> Result<String, CommandError>` herausziehen; beide rufen sie. Bestehende Fehlerfälle (`RepositoryMissing`, fehlender App-Worktree, `source.error`) bleiben, wo sie sind, und liefern weiter dieselben Sätze.
- [ ] `pub(crate) fn uncommitted_split(dir: &Path, base: &str, own: &Ownership) -> Result<(BTreeMap<String, LineStat>, BTreeMap<String, LineStat>), CommandError>`: `history::read(dir, base)`, `dirty_stats(dir)`, `open_uncommitted(…)`; liefert (eigen, fremd = dirty ohne die eigenen Schlüssel).
- [ ] `pub(crate) fn own_commits(dir: &Path, base: &str, own: &Ownership) -> Result<Vec<CommitInfo>, CommandError>`: `history::read` gefiltert auf `own.commits`, neueste zuerst.

### Status `src-tauri/src/git/status.rs`

- [ ] `pub fn entry_status(source: &Source, own: &Ownership) -> GitEntryStatus`. Ablauf: `source.error` gesetzt → `error` aus dem Eintrag, Rest leer. Sonst `dir = &source.dir`, `base = changes::source_base(source)`; `branch = git::head_branch(dir)`; `upstream = git::upstream(dir)`; `remote` = `"origin"` falls in `git::remotes`, sonst der einzige Remote, sonst `None`; `(ahead, behind)` = `ahead_behind` bei Upstream, ohne Upstream `(0, 0)` — die Oberfläche zeigt dann statt ↑n den Push-Knopf „Veröffentlichen“ (Phase 3). `operation`: `MERGE_HEAD` → `Merge`, `rebase-merge`/`rebase-apply` → `Rebase`, sonst `None`; `conflicted` nur bei `operation ≠ None`. `foreign` aus `uncommitted_split(...).1` → `GitForeignFile` (Pfad, `kind`, Zeilen, `binary`). `commits` aus `own_commits` + `subjects` + `unpushed` (`pushed = upstream.is_some() && !unpushed.contains(id)`), `short_id` = erste 7 Zeichen, `files` aus `CommitInfo.files`. `head_pushed` = Upstream vorhanden und `is_ancestor(HEAD, upstream)`.
- [ ] Jeder Git-Fehler in einem Teilschritt → `error: Some(<Satz>)`, übrige Felder leer bzw. 0 — ein Eintrag scheitert, die anderen nicht.
- [ ] `pub fn session_status(input: &ChangesInput, busy: Vec<GitBusySession>) -> GitSessionStatus`: `changes::sources::sources(input)`, nur Einträge, deren `dir` ein Git-Ordner ist (Ordner ohne Git haben ohnehin keinen Eintrag), je Eintrag `entry_status` in einem eigenen Thread (`thread::scope`, Muster wie `changes::load`); Reihenfolge wie `sources`. Optionale innere Repositories (`source.optional`) nur, wenn `changes::load` sie auch zeigen würde — dieselbe Bedingung `has_touched_under` verwenden (dafür `pub(crate)` machen).
- [ ] `pub fn branches(dir: &Path) -> Result<Vec<GitBranch>>`: `branch_refs` parsen; `refs/heads/x` → `name x, remote false`; `refs/remotes/o/x` → `name o/x, remote true`; `refs/remotes/*/HEAD` überspringen; `current` = `%(HEAD)` ist `*`; `worktree` = Ordnername (letzte Pfadkomponente) von `%(worktreepath)`, wenn gesetzt und ≠ `dir` (Pfade über `attribution::normalize_path` vergleichen). Sortierung: lokal vor remote, sonst nach Name.

### Sperre `src-tauri/src/sessions/registry.rs`

- [ ] `pub fn busy_in_project(&self, session_id: &str) -> Result<Vec<GitBusySession>, CommandError>`: Vorhaben der Session bestimmen; alle Sessions mit derselben `project_id`, deren Status `Starting`, `Running` oder `Waiting` ist, als `GitBusySession { id, number, name }`. Status aus derselben Quelle, die `SessionSummary.status` füllt. Unbekannte Session → `CommandError::SessionNotFound` (vorhandene Variante).
- [ ] `pub fn ensure_not_busy(&self, session_id: &str) -> Result<(), CommandError>`: `busy_in_project` nicht leer → `CommandError::Git(format!("Gesperrt: Session #{} „{}“ arbeitet gerade in diesem Ordner.", n, name))` (erste busy-Session). Wird ab Phase 2 benutzt.

### Commands `src-tauri/src/commands/git.rs`

- [ ] `git_status(session_id)`: `input = registry.changes_input(&session_id, ChangesReach::Session)?`, `busy = registry.busy_in_project(&session_id)?`, `Ok(git::status::session_status(&input, busy))`.
- [ ] `git_branches(session_id, key)`: `sources::find(&input, &key)?` → `git::status::branches(&source.dir)`.
- [ ] Beide in `lib.rs` registrieren; `pub mod git;` in `commands/mod.rs`.

### Prüfprogramm

- [ ] `src-tauri/examples/git-probe.rs` nach dem Muster von `changes-probe.rs`: Datenbank-Kopie + Session-ID → `GitSessionStatus` als JSON auf stdout. Nie gegen `%USERPROFILE%\.verwalter\verwalter.db` (Hinweis im Kopfkommentar wie bei `changes-probe`). Für `busy` leere Liste übergeben (kein laufender Registry-Zustand im Prüfprogramm).

### Doc-Updates

- [ ] `docs/decisions/025-git-werkzeuge.md` aus README „Festgelegte Entscheidungen“ (Kontext / betrachtete Optionen — eigenes Panel vs. in den Changes, Staging-Bereich vs. Häkchen im UI-Zustand / Entscheidung / Konsequenzen).
- [ ] `docs/code-map.md`: `git` aus dem Querschnitt in die Feature-Liste; neue Tabellenzeile „Git-Werkzeuge“ (Oberfläche folgt in Phase 3, Core: `src-tauri/src/git/` `model.rs`, `status.rs`, `commands/git.rs`, `busy_in_project`); Zeile „Git-Aufrufe“ ergänzt um die neuen lesenden Befehle.
- [ ] `AGENTS.md` Befehle-Tabelle: Zeile für `git-probe` wie bei `changes-probe`.
- [ ] `docs/glossary.md`: „Fremde Änderung“ — uncommittete Datei im Ordner eines Eintrags, die nicht zu den eigenen Changes der Session gehört; „Sperre (Git)“ — Befehle, die Dateien ändern, warten, solange eine Session des Vorhabens arbeitet.

## Report-Back
