# Phase 1 — Core: Changes lesen

**Status:** pending · **Rating:** heikel (Git-Ausgaben parsen, drei Blickwinkel zusammenführen, ein Thread je Repository, Mitlesen neben einem arbeitenden Agenten ohne Sperren)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ (alle Punkte) und „Kontrakt“ (Git, Typen, Core-Schnittstellen, Command `changes_load`)
- [ADR 005](../../decisions/005-repositories-und-worktrees.md) — Basis (`base_ref`, `base_commit`), Worktree-Ordner = `<workspace>\<folder>`
- [docs/conventions/rust.md](../../conventions/rust.md) — Abschnitte „Git“, „Fehlerbehandlung“, „Typen für die UI“
- Bestand:
  - `src-tauri/src/git/mod.rs` — Muster aller Git-Aufrufe (`run`, `run_allowing_failure`, `args`, `git_error`, `stdout_text`)
  - `src-tauri/src/worktrees/mod.rs` — `SessionRepository` (Felder `name`, `repository_path`, `folder`, `branch`, `base_ref`, `base_commit`)
  - `src-tauri/src/sessions/registry.rs` — `SessionRegistry::get`, Struct `Session` (Felder `workspace`, `repositories`, nach dem Anlegen unveränderlich)
  - `src-tauri/src/commands/repositories.rs` und `src-tauri/src/commands/sessions.rs` — Muster eines Commands (`async`, `tauri::State<'_, SessionRegistry>`)
  - `src-tauri/src/repositories/model.rs` — Muster eines TS-Typs (`derive(TS)`, `serde(rename_all = "camelCase")`)
  - `src-tauri/src/bin/gen-bindings.rs`, `src-tauri/src/lib.rs` (Modul-Liste, `generate_handler!`)
- Fehlerklassen: Vault `werkzeuge/git.md` gelesen — einschlägig nur **Zeilenenden unter Windows** (`core.autocrlf`: Arbeitsbaum CRLF, Repository LF). Hier ohne Folgen, weil `diff-index` den Arbeitsbaum vor dem Vergleich normalisiert; relevant wird es in Phase 2 (Diff-Text). `sprachen/rust.md` und `frameworks/tauri.md` gibt es im Vault nicht. Projekteigen einschlägig:
  - **Sperre im Worktree des Agenten:** nie `git diff` oder `git status` benutzen (README, „Nur Plumbing-Befehle“) — prüfen per Grep nach `"diff"` und `"status"` als Argument in `git/mod.rs`: kein Treffer.
  - **Gekürzte Ausgabe:** `stdout_text` schneidet Leerraum am Ende ab; für `-z`-Ausgaben und Diff-Text die neue `run_raw` benutzen.

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` erzeugt `ChangeKind.ts`, `ChangeScope.ts`, `LineStat.ts`, `FileChange.ts`, `RepositoryChanges.ts`, `SessionChanges.ts` in `src/lib/bindings/`.
2. `changes_load` für eine Session mit einem Repository, in dessen Worktree per Hand (a) eine Datei geändert und committet, (b) eine weitere nur geändert, (c) eine neue Datei angelegt wurde (Aufruf aus der Entwicklerkonsole der laufenden App: `await window.__TAURI_INTERNALS__.invoke('changes_load', { sessionId: '<id>' })`): (a) hat `all` und `committed`, `uncommitted` = `null`; (b) hat `all` und `uncommitted`, `committed` = `null`; (c) hat `all` und `uncommitted` mit `kind: 'added'` und der richtigen Zeilenzahl; `commitCount` = 1; `baseRef` und `branch` wie in `session_repositories`.
3. Die Zahlen aus 2. stimmen mit `git -C <worktree> diff --numstat <base_commit>` (für `all`) bzw. `… <base_commit> HEAD` (für `committed`) überein.
4. Eine Datei, deren Änderungszeit per `touch` (Git Bash) verändert wurde, ohne Inhalt zu ändern, erscheint nicht.
5. Nach Umbenennen des Worktree-Ordners liefert `changes_load` für dieses Repository `error: "Worktree fehlt — die nächste Nachricht an den Agenten legt ihn neu an."`, `files: []`; andere Repositories der Session unverändert. Es entsteht kein Ordner.
6. Während `changes_load` läuft, entsteht im Worktree keine `index.lock` (Git-Aufrufe in `git/mod.rs` sind ausschließlich `diff-index`, `diff-tree`, `ls-files`, `rev-list` für diese Phase — per Code-Blick belegt).
7. ADR 006 liegt unter `docs/decisions/006-changes-und-diff.md`.

## Checkliste

- [ ] `git/mod.rs`:
  - In `run_allowing_failure` zusätzlich `.env("GIT_OPTIONAL_LOCKS", "0")` setzen, mit Kommentar: „Lesende Aufrufe sollen nie eine Sperre im Worktree des Agenten nehmen.“
  - Private Hilfsfunktion `fn run_raw(dir: &Path, arguments: &[&OsStr]) -> Result<String, CommandError>` wie `run`, aber mit `String::from_utf8_lossy(&output.stdout).into_owned()` statt `stdout_text` (nichts abschneiden).
  - Neue Funktionen nach Kontrakt (README): `diff_tree_name_status`, `diff_tree_numstat`, `diff_index_name_status`, `diff_index_numstat`, `untracked_files` — alle über `run_raw`, Argumente genau wie im Kontrakt-Kommentar, `from`/`to` als eigene Argumente. `commit_count(worktree, from)`: `run` mit `rev-list --count <from>..HEAD` (ein Argument `format!("{from}..HEAD")`), Ausgabe `.trim().parse::<u32>()`, Parse-Fehler → `CommandError::Git(format!("rev-list lieferte keine Zahl: {text}"))`. Jede Funktion bekommt eine Doc-Zeile mit dem Git-Befehl.
- [ ] `changes/model.rs` (neu): Typen `ChangeKind`, `ChangeScope`, `LineStat`, `FileChange`, `RepositoryChanges`, `SessionChanges` genau nach Kontrakt (die Diff-Typen folgen in Phase 2). Modul-Doc: „Typen der Changes-Ansicht über die Tauri-Grenze.“
- [ ] `changes/parse.rs` (neu, reine Funktionen ohne Git):
  - `pub fn name_status(raw: &str) -> HashMap<String, ChangeKind>`: `raw.split('\0')`, leere Stücke überspringen, abwechselnd Status und Pfad. Status beginnt mit `A` → `Added`, `D` → `Deleted`, alles andere (`M`, `T`, `U` …) → `Modified`.
  - `pub fn numstat(raw: &str) -> Vec<(String, u32, u32, bool)>` (Pfad, hinzugefügt, gelöscht, binär): `raw.split('\0')`, leere Stücke überspringen, je Stück `splitn(3, '\t')`; Feld `-` in beiden Zahlen → binär mit 0/0; sonst `parse::<u32>().unwrap_or(0)`; Stück mit weniger als drei Feldern überspringen.
  - `pub fn scope_stats(name_status_raw: &str, numstat_raw: &str) -> BTreeMap<String, LineStat>`: die Dateimenge kommt **nur** aus `numstat`; `kind` aus `name_status`, fehlt der Pfad dort → `Modified`. Doc-Kommentar mit dem Grund (angefasste, unveränderte Dateien stehen in `--name-status`, nicht in `--numstat`).
  - `pub fn paths(raw: &str) -> Vec<String>`: NUL-getrennte Liste, leere Stücke weg (für `untracked_files`).
- [ ] `changes/mod.rs` (neu), Konstanten `const MAX_UNTRACKED_BYTES: u64 = 8 * 1024 * 1024;` `const BINARY_PROBE_BYTES: usize = 8000;` `const WORKTREE_MISSING: &str = "Worktree fehlt — die nächste Nachricht an den Agenten legt ihn neu an.";`
  - `pub fn load(workspace: &Path, repositories: &[SessionRepository]) -> SessionChanges`: `std::thread::scope`, pro Repository ein `scope.spawn(move || load_one(workspace, position, repository))`, Ergebnisse in der Reihenfolge der Eingabe einsammeln (`position` = Index als `u32`). Ein Thread, der panikt (`join` → `Err`), wird zu `RepositoryChanges` mit `error: Some("interner Fehler beim Lesen der Changes".into())`.
  - `fn load_one(workspace, position, repository) -> RepositoryChanges`: (1) `!repository.repository_path.join(".git").exists()` → Fehler-Eintrag mit `CommandError::RepositoryMissing(pfad).to_string()`; (2) `worktree = workspace.join(&repository.folder)`, `!worktree.exists()` → Fehler-Eintrag `WORKTREE_MISSING`; (3) sonst `read_changes(&worktree, &repository.base_commit)`; `Err(error)` → Fehler-Eintrag `error.to_string()`. Fehler-Eintrag = `files: vec![]`, `commit_count: 0`, `name`, `branch`, `base_ref` aus `repository`.
  - `fn read_changes(worktree: &Path, base: &str) -> Result<(Vec<FileChange>, u32), CommandError>`: `committed = parse::scope_stats(&git::diff_tree_name_status(worktree, base, "HEAD")?, &git::diff_tree_numstat(worktree, base, "HEAD")?)`; `all = scope_stats(diff_index_name_status(worktree, base), diff_index_numstat(worktree, base))`; `uncommitted = scope_stats(… "HEAD" …)`; für jeden Pfad aus `parse::paths(&git::untracked_files(worktree)?)`: `stat = untracked_stat(&worktree.join(pfad mit '/' → '\\'))`, in `all` und `uncommitted` einfügen; `count = git::commit_count(worktree, base)?`. Zusammenführen: `BTreeMap<String, FileChange>` über die Vereinigung aller Pfade, je Pfad die drei `Option<LineStat>` aus den drei Maps; `values().cloned().collect()` ist dann nach Pfad sortiert.
  - `fn untracked_stat(path: &Path) -> LineStat`: `kind: Added`, `deleted: 0`. `fs::metadata` → Fehler oder `len() > MAX_UNTRACKED_BYTES` → `binary: true, added: 0`. Sonst `fs::read`; Fehler → `binary: true, added: 0` (Kommentar: Datei verschwand zwischen Auflisten und Lesen, der nächste Durchlauf korrigiert); NUL in den ersten `BINARY_PROBE_BYTES` Bytes → binär; sonst `added` = Anzahl `b'\n'` plus 1, wenn die Datei nicht leer ist und nicht auf `b'\n'` endet.
- [ ] `sessions/registry.rs`: `pub fn repositories_of(&self, session_id: &str) -> Result<(PathBuf, Vec<SessionRepository>), CommandError>` — `let session = self.get(session_id)?;` und `Ok((session.workspace.clone(), session.repositories.clone()))`. Keine Session-Sperre nötig (beide Felder unveränderlich); Doc-Zeile sagt das.
- [ ] `commands/changes.rs` (neu): `#[tauri::command] pub async fn changes_load(registry: tauri::State<'_, SessionRegistry>, session_id: String) -> Result<SessionChanges, CommandError>` → `let (workspace, repositories) = registry.repositories_of(&session_id)?; Ok(changes::load(&workspace, &repositories))`. In `commands/mod.rs` `pub mod changes;`.
- [ ] `lib.rs`: `pub mod changes;` in die Modul-Liste (alphabetisch nach `agents`), `commands::changes::changes_load` in `generate_handler!`.
- [ ] `bin/gen-bindings.rs`: die sechs neuen Typen exportieren (Import `changes::model::{…}`); `pnpm bindings`.
- [ ] `src/lib/changes.ts` (neu): `loadChanges(sessionId: string): Promise<SessionChanges>` → `invoke<SessionChanges>('changes_load', { sessionId })`, JSDoc wie in `src/lib/repositories.ts` (`@throws … sessionNotFound`).
- [ ] ADR `docs/decisions/006-changes-und-diff.md` (Format wie ADR 005: Status/Datum, Kontext, Optionen, Entscheidung, Konsequenzen) aus README „Festgelegte Entscheidungen“; Optionen: Diff-Quelle (`git diff`/`status` vs. Plumbing), Anzeige (Monaco vs. eigene Zeilen), Aktualisieren (Beobachter vs. Nachladen bei Anlass + 5-s-Takt), Umbenennungen (erkennen vs. `--no-renames`). Konsequenzen: umbenannte Dateien erscheinen doppelt (D + A); Änderungen erscheinen bis zu 5 s verzögert; keine Syntaxfarben im Diff.
- [ ] Code-Map: Zeile „Changes“ → Core `src-tauri/src/changes/` (`model.rs` Typen, `parse.rs` Git-Ausgaben lesen, `mod.rs` drei Blickwinkel je Repository), `src-tauri/src/commands/changes.rs`, Wrapper `src/lib/changes.ts`; Zeile „Git-Aufrufe“ um „lesend nur Plumbing (`diff-index`, `diff-tree`, `ls-files`, `rev-list`)“ ergänzen.
- [ ] Laufzeit messen (für den Report-Back, ändert nichts am Code): in Git Bash im größten lokalen Repository `time` für die sieben Aufrufe aus `read_changes` hintereinander. Über 1 s → als Finding „→ Phase 3: Takt auf 10 s“ eintragen.
- [ ] `pnpm check`, Commit `feat(changes): read session changes from git per repository`.

## Report-Back
