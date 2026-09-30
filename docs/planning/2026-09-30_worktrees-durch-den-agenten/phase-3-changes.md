# Phase 3 — Changes: Ticket-Worktrees gegen den Standard-Branch

Rating: **heikel** (ein Schlüssel aus der Oberfläche wird zu einem Pfad, die Grenze muss dicht bleiben; Kontrakt-Änderung über die Tauri-Grenze).

Nach dieser Phase zeigen die Changes jeder Session ihre Ticket-Worktrees als eigene Einträge, gemessen gegen den Standard-Branch. Das ist die Ansicht fürs Merge-Gate: alles, was auf dem Branch liegt, egal welche Session es gemacht hat.

## Kontext — vorher lesen

- [README.md](README.md) dieses Plans, Abschnitt „Kontrakt" (`key` statt `position`)
- [phase-2-zuordnung.md](phase-2-zuordnung.md), Report-Back: `ticket_worktrees_of`
- [docs/decisions/006-changes-und-diff.md](../../decisions/006-changes-und-diff.md): nur Befehle, die keine Sperre nehmen
- [docs/conventions/rust.md](../../conventions/rust.md), [docs/conventions/react.md](../../conventions/react.md), [docs/conventions/typescript.md](../../conventions/typescript.md)
- `src-tauri/src/git/mod.rs` (Muster `run`, `run_allowing_failure`, `head_branch`, `branch_exists`)
- `src-tauri/src/changes/mod.rs`, `src-tauri/src/changes/model.rs`, `src-tauri/src/commands/changes.rs`
- Oberfläche: `src/lib/changes.ts`, `src/stores/changes.ts`, `src/features/changes/` (`buildFileRows.ts`, `ChangesOverview.tsx`, `ChangesToolbar.tsx`, `ChangesView.tsx`, `DiffView.tsx`, `FileTree.tsx`, `useFileDiff.ts`)
- Fehlerklassen (Vault: git): **Ausgecheckter Branch ≠ Standard-Branch.** Der Standard-Branch wird über `refs/remotes/origin/HEAD` ermittelt, nie über den Stand des Haupt-Checkouts. Ist `origin/HEAD` nicht gesetzt, wird `main`, dann `master` geprüft. Erst danach gilt der ausgecheckte Stand als Notlösung.

## Abnahmekriterien

- `changes_load` liefert je Session-Repository zuerst dessen Eintrag (Schlüssel `"<Position>"`). Danach folgt je zugeordnetem Ticket-Worktree dieses Repositorys, der laut `git worktree list --porcelain` des Haupt-Checkouts existiert, ein Eintrag mit Schlüssel `"<Position>/<Ordner>"` und Name `"<Repository> · <Ordner>"`, sortiert nach Ordner.
- Ein zugeordneter Ordner, der kein Worktree (mehr) ist, erscheint gar nicht, ohne Fehler-Eintrag.
- Pfadvergleich mit der Worktree-Liste: ohne Groß/Klein, `/` gleich `\`. Git liefert unter Windows `C:/Users/...`, belegt am 2026-09-30.
- Basis eines Ticket-Worktrees ist `git merge-base HEAD refs/heads/<Standard-Branch>`, ausgeführt im Worktree. `base_ref` ist der Name des Standard-Branches. Ohne Standard-Branch ist die Basis `merge-base HEAD <HEAD-Commit des Haupt-Checkouts>` und `base_ref` der Branch-Text des Haupt-Checkouts. Die drei Blickwinkel gelten unverändert: „Alle" ist Abzweigung → Arbeitsverzeichnis, also genau der Merge-Gate-Diff.
- `branch` eines Ticket-Worktrees ist sein Branch aus der Liste, bei losgelöstem HEAD die ersten 7 Zeichen seines HEAD.
- `changes_file_diff` mit `"<Position>/<Ordner>"` liefert den Diff im Ticket-Worktree. Ein Ordner mit `/`, `\`, `:`, leer, `.` oder `..`, einer, der nicht der Session zugeordnet ist, oder einer, der kein Worktree ist, ergibt einen Fehler, bevor ein Pfad benutzt wird.
- Scheitert `git worktree list`, fehlen nur die Ticket-Einträge. Der Repository-Eintrag erscheint trotzdem.
- Alte Sessions liefern genau einen Eintrag je Repository wie bisher, nur mit `key`.
- Die Oberfläche filtert, öffnet und lädt Diffs über `key`, für alle Eintragsarten.
- `pnpm bindings` ausgeführt, `pnpm check` grün.

## Checkliste

**Git (`git/mod.rs`)**

- [ ] `pub struct WorktreeEntry { pub path: PathBuf, pub head: String, pub branch: Option<String> }`, Doc-Kommentar „Ein Eintrag aus `git worktree list --porcelain`; `path` mit Backslashes, `branch` ohne `refs/heads/`, `None` bei losgelöstem HEAD."
- [ ] `pub fn worktree_list(repo: &Path) -> Result<Vec<WorktreeEntry>, CommandError>`: `run(repo, &args(&["worktree", "list", "--porcelain"]))`. Blöcke sind durch Leerzeilen getrennt. `worktree <pfad>` wird mit `/`→`\` zu `path`, `HEAD <sha>` zu `head`, `branch refs/heads/<name>` zu `branch`. Alle anderen Zeilen übergehen. Einen Block ohne `worktree`-Zeile verwerfen. Kommentar: liest nur, nimmt keine Index-Sperre (ADR 006).
- [ ] `pub fn merge_base(dir: &Path, first: &str, second: &str) -> Result<String, CommandError>`: `run(dir, &args(&["merge-base", first, second]))`.
- [ ] `pub fn default_branch(repo: &Path) -> Result<Option<String>, CommandError>`:
  1. `run_allowing_failure(repo, &args(&["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]))`. Bei Erfolg den Teil nach dem ersten `/` nehmen (`origin/main` → `main`). Existiert er laut `branch_exists`, ist er das Ergebnis.
  2. Sonst `main`, dann `master`, jeweils per `branch_exists`.
  3. Sonst `None`. Doc-Kommentar: „Der Standard-Branch, nicht der ausgecheckte."

**Ticket-Worktrees (`worktrees/mod.rs`)**

- [ ] `pub struct TicketWorktree { pub position: u32, pub folder: String, pub path: PathBuf, pub head: String, pub branch: Option<String> }`.
- [ ] `pub fn ticket_worktrees(repository: &SessionRepository, position: u32, folders: &[String]) -> Vec<TicketWorktree>`: Bei `AppWorktree` oder leeren `folders` ein leerer Vektor. Sonst `git::worktree_list(&repository.repository_path)`, bei Fehler ein leerer Vektor. Je `folder` ist der erwartete Pfad `repository_path.parent()` + `folder`. Gesucht wird der Listeneintrag mit `same_dir(entry.path, erwartet)`. Ohne Treffer wird der Ordner übergangen. Sortiert nach `folder`.
- [ ] Private `fn same_dir(a: &Path, b: &Path) -> bool`: beide per `to_string_lossy()`, `/`→`\`, abschließende `\` weg, `to_lowercase()`, dann gleich.
- [ ] `pub fn ticket_base(repository: &SessionRepository, worktree: &TicketWorktree) -> Result<(String, String), CommandError>` gibt `(base_commit, base_ref)` nach der Regel aus den Abnahmekriterien zurück.

**Changes (`changes/model.rs`, `changes/mod.rs`, `commands/changes.rs`)**

- [ ] `RepositoryChanges`: `position: u32` ersetzen durch `pub key: String` mit Doc-Kommentar „Kennung für Filter und Diff: `"<Position>"` für ein Session-Repository, `"<Position>/<Ordner>"` für einen Ticket-Worktree." `SessionChanges.repositories`, Doc-Kommentar: „Je Session-Repository erst sein Eintrag, dann seine Ticket-Worktrees."
- [ ] `load(workspace, repositories, ticket_folders: &[(u32, String)])`: ein Thread je Session-Repository, der `Vec<RepositoryChanges>` liefert. `load` hängt die Ergebnisse in Reihenfolge aneinander. Ein panischer Thread ergibt einen `failed`-Eintrag mit Schlüssel `"<Position>"`.
- [ ] `load_one(workspace, position, repository, folders: Vec<String>) -> Vec<RepositoryChanges>`: erst der bisherige Eintrag (Schlüssel `position.to_string()`), dann je `ticket_worktrees(...)` ein Eintrag über `load_ticket`.
- [ ] Private `fn load_ticket(repository, worktree: &TicketWorktree) -> RepositoryChanges`: `key = format!("{}/{}", worktree.position, worktree.folder)`, `name = format!("{} · {}", repository.name, worktree.folder)`, `branch` = `worktree.branch` oder die ersten 7 Zeichen von `worktree.head`. `ticket_base`, dann `read_changes(&worktree.path, &base_commit)`. Fehler ergeben einen Eintrag mit `error` und denselben Kopfdaten.
- [ ] `failed` nimmt `(key: String, name: String, branch: String, base_ref: String, error: String)`. Alle Aufrufer passen.
- [ ] `file_diff(workspace, repository, ticket: Option<&TicketWorktree>, path, scope)`: Bei `None` gilt das bisherige Verhalten. Bei `Some` ist der Ordner `ticket.path` und die Basis aus `ticket_base`. Der Rest bleibt.
- [ ] `commands/changes.rs`: `changes_load` holt zusätzlich `registry.ticket_worktrees_of(&session_id)?`. `changes_file_diff(registry, session_id, key: String, path, scope)`: `key.split_once('/')` ergibt Positions-Text und optionalen Ordner, die Position kommt per `parse::<usize>()`. Scheitert das, gibt es `CommandError::Internal(format!("Ungültiger Schlüssel {key}"))`. Bei einem Ordner folgen `validate_folder` (Fehler `CommandError::Internal(format!("Ungültiger Ordner: {folder}"))`, wenn leer, `.`, `..` oder mit `/`, `\`, `:`). Dann muss `(position, folder)` in `ticket_worktrees_of` stehen (ohne Groß/Klein), sonst gibt es `CommandError::Io("Dieser Worktree gehört nicht zur Session.".to_owned())`. Danach muss `ticket_worktrees(repository, position, &[folder])` genau einen Treffer liefern, sonst `CommandError::Io("Diesen Worktree gibt es nicht mehr.".to_owned())`.
- [ ] `pnpm bindings`.

**Oberfläche** (reine Umbenennung `position` → `key`, `number` → `string`)

- [ ] `src/lib/changes.ts`: `loadFileDiff(sessionId, key: string, path, scope)`. Doc-Kommentar oben: „Was in den Repositories der Session und in ihren Ticket-Worktrees geändert ist — je Eintrag gegen seine Basis."
- [ ] `src/stores/changes.ts`: Geöffnete Datei `{ key: string; path: string }`, Filter `string | null`, `setRepositoryFilter(sessionId, key: string | null)`. Doc-Kommentar: „`key` des gewählten Eintrags; `null` zeigt alle."
- [ ] `buildFileRows.ts`, `ChangesOverview.tsx`, `ChangesToolbar.tsx`, `ChangesView.tsx`, `DiffView.tsx`, `FileTree.tsx`, `useFileDiff.ts`: jede Verwendung von `position` für Einträge auf `key`. Zeilen- und React-Keys werden `` `${key}:branch` `` usw. Danach per Grep-Werkzeug `position` in `src/features/changes/*.ts*` und `src/stores/changes.ts` prüfen: Kein Treffer darf noch einen Eintrag meinen.
- [ ] `ChangesToolbar.tsx`: Die bestehende Logik „alle Einträge haben dieselbe `baseRef` → ‚gegen <baseRef>', sonst Liste je Eintrag" bleibt. Sie zeigt Ticket-Worktrees damit automatisch „gegen main".

**Prüfen**

- [ ] `pnpm check` grün.
- [ ] Handprobe: Im Nachbarordner eines bekannten Repositorys `git -C <Repo> worktree add ../<repo>-wt-probe -b test/probe` ausführen, dort eine Datei ändern und committen, eine zweite nur ändern. In einer neuen Session den Agenten bitten: „Lies die README in ../<repo>-wt-probe". Die Changes zeigen „<Repository> · <repo>-wt-probe" gegen `main` mit beiden Dateien, und der Diff lädt. Aufräumen: `git -C <Repo> worktree remove --force ../<repo>-wt-probe`, `git -C <Repo> branch -D test/probe`.

## Report-Back
