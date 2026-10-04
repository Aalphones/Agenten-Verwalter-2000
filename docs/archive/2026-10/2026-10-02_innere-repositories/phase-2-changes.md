# Phase 2 — Changes: Einträge für innere Repositories, Schlüssel `<P>:<Ordner>`, Diff

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ und „Kontrakt“ (`sources.rs`, `ChangesInput`) — verbindlich.
- Report-Back von [Phase 1](phase-1-erkennung.md) und [FINDINGS.md](FINDINGS.md).
- `src-tauri/src/changes/mod.rs` ganz (`ChangesInput`, `load`, `load_one`, `load_repository`, `load_ticket`, `read_changes`, `file_diff`, `failed`, `failed_repository`, `branch_label`, `is_app_worktree_missing`).
- `src-tauri/src/changes/scan.rs` (`session_dirs` — bleibt in dieser Phase, bekommt aber die neue `ChangesInput`-Form erst in Phase 3; hier nur so weit anpassen, dass es kompiliert, siehe Checkliste).
- `src-tauri/src/changes/attribution.rs` (`Ownership`, `normalize_path`).
- `src-tauri/src/commands/changes.rs` ganz.
- `src-tauri/src/sessions/registry.rs`: `changes_input`, `project_ticket_worktrees`, `lock_projects`, `ProjectState.created_at`, `SessionState.created_at`; `sessions/registry/commit_scan.rs`.
- `src-tauri/src/worktrees/mod.rs` nach Phase 1 (`TicketRoot`, `ticket_root_of`, `inner_checkout`, `ticket_worktrees`, `ticket_worktrees_in`, `mentioned_ticket_worktrees`, `normalized_dir`).
- `src-tauri/examples/changes-probe.rs` aus Phase 1.
- [docs/conventions/rust.md](../../../conventions/rust.md), [linting.md](../../../conventions/linting.md).
- Fehlerklassen: wie Phase 1, keine weitere einschlägig.

**Chesterton:** `changes_file_diff` prüft heute, dass ein Ordner aus der Oberfläche einem gemerkten Ticket-Worktree des Vorhabens entspricht und laut Git noch einer ist, bevor er zum Pfad wird (AGENTS.md Regel 5). Diese Grenze bleibt, nur an einer Stelle: `sources::find` akzeptiert ausschließlich Schlüssel, die `sources` für die Reichweite selbst gebaut hat — und `sources` nimmt Ticket-Worktrees nur über `ticket_worktrees`/`ticket_worktrees_in` (Git-Prüfung) und innere Repositories nur aus `ticket_roots` (Verzeichnis-Prüfung). `validate_folder` (kein `/`, `\`, `:`, `.`, `..`) bleibt als erste Prüfung des Schlüssels.

## Abnahmekriterien

- `changes-probe <Kopie> a6357b9c-e08c-411a-9fcc-62a88321300a session` gibt `SessionChanges` als JSON aus; darin ein Eintrag mit `key` `0:app-wt-gymid-2288`, `name` `facepass/app · app-wt-gymid-2288` und den uncommitteten Python-Dateien, die die Session geschrieben hat (`fitness_app/applets/common/qr.py`, `…/check_in/check_in.py` u. a. — Gegenprobe `git -C …\facepass\app-wt-gymid-2288 status --porcelain`). Kein Eintrag `facepass/admin-app`, `facepass/device-agent` o. ä. (unberührt).
- Dasselbe für `dd292f1c-4a58-4804-8cdc-0533ca2c1314`: Eintrag `0:android-wt-gymid-799` mit `app/src/main/java/com/example/faceloginapp/TimedSessionActivity.kt`.
- `changes-probe <Kopie> a6357b9c-… session 0:app-wt-gymid-2288 fitness_app/applets/common/qr.py` gibt Diff-Zeilen aus. Mit Schlüssel `0:..`, `0:fremder-ordner`, `0:app-wt-gibtsnicht`, `9`, `x` → Fehler, keine Zeilen.
- Eine Session dieses Repos (`Agenten-Verwalter-2000`, falls in der Datenbank) bzw. jede Session ohne innere Repositories: gleiche Einträge und Schlüssel wie vor der Phase (Probe vorher/nachher vergleichen — Ausgabe vor dem Umbau einmal sichern).
- `pnpm check` grün, `pnpm bindings` ändert nichts.

## Checkliste

### `src-tauri/src/changes/mod.rs`

- [x] `pub mod sources;` zu den Modulen.
- [x] `ChangesInput` laut Kontrakt: neue Felder `ticket_roots: Vec<TicketRoot>` und `since_ms: f64`.
- [x] `load` umbauen: `plain_folders` wie bisher; `let sources = sources::sources(input);` dann `thread::scope` mit **einem Thread je `Source`** (`scope.spawn(move || read_source(source, own))`). Ein panischer Thread → `failed(source.key.clone(), source.name.clone(), branch_label(&source.repository), source.repository.base_ref.clone(), THREAD_FAILED.to_owned())`. Danach Einträge mit `source.optional && changes.files.is_empty() && changes.commit_count == 0 && !has_touched_under(&source.dir, own)` weglassen. Reihenfolge = Reihenfolge von `sources`.
- [x] `fn has_touched_under(dir: &Path, own: &Ownership) -> bool`: `let prefix = format!("{}\\", attribution::normalize_path(&dir.to_string_lossy()));` → `own.touched.keys().any(|path| path.starts_with(&prefix))`.
- [x] `fn read_source(source: &Source, own: &Ownership) -> RepositoryChanges`: `source.error` gesetzt → `failed(…, error.clone())`; sonst `match &source.ticket { Some(ticket) => load_ticket(source, ticket, own), None => load_repository(source, own) }`.
- [x] Vorprüfung für `source.optional` in `read_source`, vor allem anderen: hat die Reichweite darunter nichts geschrieben (`!has_touched_under(&source.dir, own)`) und liefert `history::read(&source.dir, &source.repository.base_commit)` keinen eigenen Commit (`attribution::own_commit_count(&commits, &own.commits) == 0`; ein Fehler von `history::read` zählt wie „keiner“), dann sofort einen leeren Eintrag zurückgeben (`files: Vec::new()`, `commit_count: 0`, `error: None`) — er fällt danach weg. Grund als Kommentar: gemessen 2026-10-02 kostet ein Git-Aufruf über acht innere Repositories von facepass zusammen gut 1 s; die volle Lesung (fünf Aufrufe je Repository) nur für berührte.
- [x] `load_repository(source, own)`: Körper wie bisher, aber `key`/`name` aus `source`, Arbeitsordner = `source.dir` (statt `working_dir(workspace)`), Prüfungen `.git` vorhanden und `is_app_worktree_missing(&source.repository, &source.dir)` unverändert.
- [x] `load_ticket(source, worktree, own)`: Körper wie bisher, `key`/`name` aus `source` statt selbst gebaut.
- [x] `load_one`, `failed_repository`, `folders_of` entfallen, sobald unbenutzt (`folders_of` wandert nach `sources.rs`, falls dort gebraucht).
- [x] `file_diff` neue Signatur `pub fn file_diff(source: &Source, path: &str, scope: ChangeScope, own: &Ownership) -> Result<FileDiff, CommandError>`: `validate_path(path)?`; `source.error` gesetzt → `Err(CommandError::Io(error.clone()))`; `.git`-Prüfung von `source.repository.repository_path` wie bisher; `worktree = source.dir.clone()`; `base` = bei `source.ticket` `worktrees::ticket_base(&source.repository, ticket)?.0`, sonst (nach `is_app_worktree_missing`-Prüfung wie bisher) `source.repository.base_commit.clone()`. Der Rest ab `let base = base.as_str();` unverändert. Die Prüfung „Ordner ohne Git hat keinen Diff“ entfällt (für einen Ordner ohne Git gibt es keine `Source`).

### Neue Datei `src-tauri/src/changes/sources.rs`

- [x] Kopfkommentar: „Die Einträge der Changes-Ansicht einer Reichweite — die eine Stelle, die Schlüssel baut und auflöst (ADR 020).“
- [x] `pub struct Source` laut Kontrakt.
- [x] `pub fn sources(input: &ChangesInput) -> Vec<Source>` — je Repository mit `position` (Index als `u32`):
  1. `folders` = Ticket-Ordner dieser Position aus `input.ticket_folders`; aufteilen mit `worktrees::ticket_root_of(&input.ticket_roots, position, folder)`: `inner == None` → `sibling: Vec<String>`; `inner == Some(name)` → `inner_folders: BTreeMap<String, Vec<String>>` unter `name`; keine Wurzel → weglassen.
  2. Ist das Repository kein Ordner ohne Git: `Source { key: position.to_string(), name: repository.name.clone(), repository: repository.clone(), ticket: None, dir: repository.working_dir(&input.workspace), optional: false, error: None }`, dann je `worktrees::ticket_worktrees(repository, position, &sibling)` eine `Source { key: format!("{position}/{}", worktree.folder), name: format!("{} · {}", repository.name, worktree.folder), dir: worktree.path.clone(), ticket: Some(worktree), optional: false, … }`.
  3. Je Wurzel an dieser Position mit `inner: Some(inner)`, in der Reihenfolge von `input.ticket_roots`: `key = format!("{position}:{inner}")`, `name = format!("{}/{inner}", repository.name)`. `worktrees::inner_checkout(repository, inner, input.since_ms)`:
     - `Ok(inner_repository)` → `Source { key, name, dir: inner_repository.repository_path.clone(), repository: inner_repository.clone(), ticket: None, optional: true, error: None }`; dann je `worktrees::ticket_worktrees_in(&inner_repository, position, inner_folders.get(inner) (leer, wenn keiner), &repository.repository_path)` eine `Source { key: format!("{position}:{}", worktree.folder), name: format!("{name} · {}", worktree.folder), repository: inner_repository.clone(), dir: worktree.path.clone(), ticket: Some(worktree), optional: false, error: None }`.
     - `Err(error)` → `Source { key, name, repository: SessionRepository { name: inner.clone(), repository_path: repository.repository_path.join(inner), base_ref: String::new(), base_commit: String::new(), checkout: RepositoryCheckout::Main }, dir: <derselbe Pfad>, ticket: None, optional: true, error: Some(error.to_string()) }`.
- [x] `pub fn find(input: &ChangesInput, key: &str) -> Result<Source, CommandError>`:
  - Zerlegen: erstes Vorkommen von `/` oder `:` (`key.find(['/', ':'])`) trennt Position und Ordner; Position muss `u32` sein, sonst `CommandError::Internal(format!("Ungültiger Schlüssel {key}"))`; ein Ordner geht durch `validate_folder` (aus `commands/changes.rs` hierher verschoben, Text unverändert).
  - `sources(input).into_iter().find(|source| source.key.eq_ignore_ascii_case(key))`, sonst `CommandError::Io("Diesen Eintrag gibt es in den Changes nicht mehr.".to_owned())`.
- [x] `pub fn scope_ticket_folders(roots: &[TicketRoot], remembered: Vec<(u32, String)>, touched: &HashMap<String, f64>) -> Vec<(u32, String)>`: Ergebnis beginnt mit `remembered`; danach die Pfade aus `touched` **sortiert**, je Pfad `worktrees::mentioned_ticket_worktrees(roots, path)`; ein Treffer kommt dazu, wenn kein Eintrag mit gleicher Position und `eq_ignore_ascii_case`-gleichem Ordner da ist. Doc-Kommentar: rückwirkend aus geschriebenen Dateien (README, Entscheidungen).

### `src-tauri/src/commands/changes.rs`

- [x] `changes_file_diff`: `let input = registry.changes_input(&session_id, reach)?; let source = changes::sources::find(&input, &key)?; changes::file_diff(&source, &path, scope, &input.own)`. Doc-Kommentar: Schlüsselformen laut README, Prüfung in `sources::find`. `validate_folder` und die Imports `worktrees`, `TicketWorktree` entfernen.

### `src-tauri/src/sessions/registry.rs`

- [x] `changes_input`:
  - Zuerst, ohne andere Sperre: `let project_created = self.lock_projects().get(&session.project_id).map(|project: &ProjectState| project.created_at);` (eigene Anweisung, Sperre danach frei).
  - Reichweite `Session`: unter **einer** Session-Sperre `ticket_worktrees`, `ticket_roots` und `created_at` klonen; `since_ms = created_at`.
  - Reichweite `Project`: `remembered = self.project_ticket_worktrees(session_id)?`; danach `ticket_roots` und `created_at` der aufrufenden Session unter ihrer Sperre klonen; `since_ms = project_created.unwrap_or(created_at)`.
  - `own` wie bisher aus der Datenbank (nach den Sperren).
  - `ticket_folders = changes::sources::scope_ticket_folders(&ticket_roots, remembered, &own.touched)`.
  - `ChangesInput { workspace, repositories, ticket_roots, ticket_folders, since_ms, own }`.

### Übergang für die Commit-Suche (Phase 3 baut sie um)

- [x] `sessions/registry/commit_scan.rs` und `changes/scan.rs::session_dirs` kompilieren weiter unverändert (sie nutzen `ChangesInput` nicht). Benutzt `scan.rs` `folders_of`/`is_plain_folder` aus `super`, bleiben diese als `pub(super)`/`fn` in `mod.rs` bzw. `sources.rs` erreichbar — nichts an ihrem Verhalten ändern.

### Prüfprogramm

- [x] `changes-probe` baut jetzt eine vollständige `ChangesInput` wie `changes_input`: `workspace` aus `sessions.workspace_dir`; `ticket_roots` aus `worktrees::ticket_roots`; `remembered` aus `session_ticket_worktrees::load` (Reichweite `project`: Vereinigung über alle Sessions mit gleicher `project_id`, per SQL `SELECT id FROM sessions WHERE project_id = ?1`); `own` aus `session_commits::load_for`, `session_files::load_for`, `db::sessions::untracked_before`; `since_ms` aus `sessions.created_at` bzw. `projects.created_at`. Ausgabe: `serde_json::to_string_pretty(&changes::load(&input))`.
- [x] Optional zwei weitere Argumente `<Schlüssel> <Pfad>`: statt `load` `sources::find` + `changes::file_diff(…, ChangeScope::All, …)`, Ausgabe Zeilenzahl und die ersten 20 Zeilen (`kind` und `text`), bei Fehler die Fehlermeldung und Exit-Code 1.

### Abschluss

- [x] `pnpm check` grün; `pnpm bindings` ändert nichts.
- [x] Commit `fix(changes): Changes für innere Repositories und ihre Ticket-Worktrees` (Body: Schlüsselform `<P>:<Ordner>`, ADR 020).

## Definition of Done

- Alle Abnahmekriterien erfüllt, belegt durch Probe-Ausgaben (gekürzt auf die Einträge `key`/`name`/Dateipfade) im Report-Back.
- Sichtbar für Sascha (nach Bau): Reiter „Changes“ einer FacePass-Session zeigt `facepass/app · app-wt-gymid-2288` bzw. `facepass/android · android-wt-gymid-799` mit den offenen Dateien.
- Artefakt: Probe-Ausgabe vorher/nachher für eine Session ohne innere Repositories (gleich) und für die beiden FacePass-Sessions.
- Sieben Ziele kurz geprüft.

## Report-Back

**Status:** complete (2026-10-02, auf der Privatmaschine).

- **Prüfgrundlage:** wie Phase 1 die Nachbildung unter `%TEMP%\verwalter-probe\` (Session `b1b4ca67-…` der Datenbank-Kopie), dazu drei geschriebene Dateien angelegt (`app-wt-gymid-2288\src\main.py`, `android-wt-gymid-799\TimedSessionActivity.kt`, `app\direkt.py`) und eine fremde Änderung an `app-wt-gymid-2288\readme.txt`. Die facepass-Sessions `a6357b9c-…` und `dd292f1c-…` liegen nur auf dem Arbeitslaptop — ihr Lauf steht als Finding für Phase 3.
- **`changes-probe … session` (Nachbildung):** Einträge `0` `dach`, `0/dach-wt-x`, `0:admin-app-wt-gymid-2111` (`dach/admin-app · admin-app-wt-gymid-2111`, leer — geschriebene Datei existiert nicht), `0:android-wt-gymid-799` mit `TimedSessionActivity.kt`, `0:app` (`dach/app`) mit `direkt.py`, `0:app-wt-gymid-2288` mit `src/main.py`; die fremde `readme.txt` erscheint nicht. Unberührte innere Repositories `admin-app`, `Android`, `notes` erscheinen nicht; `ordner` steht in `plainFolders`.
- **Diff:** `0:app-wt-gymid-2288 src/main.py` (auch in Großbuchstaben), `0:android-wt-gymid-799 TimedSessionActivity.kt`, `0:app direkt.py` liefern Zeilen. Abgewiesen: `0:..` (Ungültiger Ordner), `0:fremder-ordner`, `0:app-wt-gibtsnicht`, `9`, `1` (Ordner ohne Git) mit „Diesen Eintrag gibt es in den Changes nicht mehr.“, `x` (Ungültiger Schlüssel), Pfad `../../x` (Ungültiger Pfad). `0:admin-app` und `1:notes` werden angenommen (0 Zeilen): `sources` baut sie, `load` blendet sie nur aus, weil sie nichts zeigen — innerhalb der Grenze, kein Pfad außerhalb eines Eintrags.
- **Vorher/nachher:** Probe-Ausgabe vor dem Umbau gesichert (alte `ChangesInput`-Form) für HomeChat `1f95c3b5-…` (session, project), Photofant `d8c9276b-…`, Verwalter `e824d4cc-…` (session, project) — nach dem Umbau bytegleich.
- **Abweichung:** Die Vorprüfung unberührter innerer Repositories ruft nur `git::commits_since` + `scan::parse_rev_list` statt `history::read` — ein Git-Aufruf statt zwei (`history::read` holt zusätzlich die Dateien je Commit), passend zur Begründung im Plan. Die Vorprüfung läuft vor der Fehlerprüfung: ein inneres Repository mit Fehler erscheint nur, wenn die Reichweite darin geschrieben hat (Entscheidungen).
- **`changes-probe`** gibt jetzt JSON auf stdout aus, die Wurzeln auf stderr; die Zuordnungs-Ausgabe je Datei aus Phase 1 ist entfallen (steckt in den Schlüsseln).
- `pnpm check` grün, `pnpm bindings` ändert nichts.
- **Sieben Ziele:** Stabilität — Vorhaben ohne innere Repositories bytegleich, ein Thread je Eintrag, Panik trifft nur den Eintrag; Sicherheit — eine Stelle löst Schlüssel auf, nur selbst gebaute Schlüssel, `validate_folder`/`validate_path` bleiben; Simplicity — `load_one`/`failed_repository` entfallen, `file_diff` nimmt eine `Source`; Wartbarkeit — Schlüsselformen im Doc-Kommentar von `changes_file_diff` und `Source`; Performance — unberührte innere Repositories ein Git-Aufruf, Basis aus dem Zwischenspeicher.
