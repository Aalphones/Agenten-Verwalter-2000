# Phase 2 — Core schreibt: Commit, Push, Pull, Fetch, Branch

Ziel: Die schreibenden Kern-Befehle im Core — Commit der angehakten Pfade (auch „Commit & Push“ und „Ergänzen“), Push, Pull, Fetch, Branch wechseln (ohne und mit Stash), Branch anlegen, Merge/Rebase abbrechen. Ein Commit aus der App zählt als Commit der Session. Die Sperre greift im Core.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ (Sperre, Commit, Ergänzen, Push, Pull, Fetch, Anmeldung, Index-Sperre, Branch wechseln, Neuer Branch) und „Kontrakt“.
- Phase 1: `git/model.rs`, `git/status.rs`, `commands/git.rs`, `registry.busy_in_project`, `registry.ensure_not_busy`.
- `src-tauri/src/git/mod.rs` — `run`, `run_raw_with_input`, `run_allowing_failure`, `git_error`, `head_commit`, `branch_exists`.
- `src-tauri/src/db/session_commits.rs` — `insert_all`; Zugriff auf die Datenbank wie in `sessions/registry/commit_scan.rs` (`with(|connection| …)`).
- `src-tauri/src/changes/attribution.rs` — `is_open` (warum der Commit der Session gehören muss).
- Fehlerklassen: Vault `werkzeuge/git.md` — „Negativbefund aus einer nicht aktualisierten Historie“ → Fetch nach Pull/Push, Fetch-Zeitpunkt mitführen (unten).

## AK der Phase

- `git_commit` mit zwei Pfaden (eine geänderte, eine neue Datei) committet genau diese zwei, auch wenn eine dritte Datei schon gestaged war; die dritte bleibt gestaged. Die neue Commit-ID steht danach in `session_commits` dieser Session; `changes_load` zeigt die beiden Dateien unter Committed, nicht mehr unter Uncommitted.
- `git_commit` mit `push: true` committet und pusht; ohne Upstream mit `-u`.
- `git_commit` mit `amend: true` auf einem gepushten `HEAD` → Fehler „Der letzte Commit ist schon gepusht — Ergänzen nicht möglich.“
- `git_switch`, `git_pull`, `git_abort_operation` liefern bei laufender Session des Vorhabens den Sperr-Fehler aus Phase 1, ohne Git aufzurufen.
- `git_switch` mit `Stash` legt einen Stash `verwalter: vor Wechsel auf <branch>` an und wechselt; auf `origin/x` entsteht ein lokaler Tracking-Branch `x`.
- `git_create_branch("a..b")` → Fehler „Ungültiger Branch-Name: a..b“.
- Ein schreibender Befehl, der an `index.lock` scheitert, wird einmal wiederholt (Protokollzeile im Session-Log nicht nötig).
- `pnpm check` grün.

## Checkliste

### Schreibende Aufrufe `src-tauri/src/git/mod.rs`

- [x] `fn run_write(dir, arguments) -> Result<String, CommandError>`: wie `run`, aber ohne `GIT_OPTIONAL_LOCKS=0` (eigener Builder `git_write_command` = `git_command` ohne diese Variable). Scheitert der Aufruf und enthält der Fehlertext `index.lock`, 500 ms schlafen und genau einmal wiederholen; scheitert auch das mit `index.lock` → `CommandError::Git("Git ist gerade beschäftigt — gleich noch einmal versuchen.".into())`.
- [x] `fn run_write_with_input(dir, arguments, input)`: dasselbe für `run_raw_with_input` (für `commit -F -`).
- [x] Öffentliche Funktionen, je ein Git-Aufruf, alle über `run_write*`:
  - `add_paths(dir, paths)`: `add -A -- <pfade…>`
  - `commit_paths(dir, paths, message)`: `commit -F - --only -- <pfade…>`, Nachricht über stdin
  - `commit_amend(dir, paths, message: Option<&str>)`: `add -A -- <pfade>` vorher durch den Aufrufer; dann `commit --amend --only -F - -- <pfade>` bzw. ohne Nachricht `commit --amend --no-edit --only -- <pfade>`; leere `paths` → ohne `--only -- …`
  - `push(dir)`: `push`; `push_set_upstream(dir, remote, branch)`: `push -u <remote> <branch>`
  - `pull_merge(dir)`: `pull --no-rebase`
  - `fetch(dir)`: `fetch --prune`
  - `switch(dir, branch)`: `switch <branch>`; `switch_track(dir, remote_branch)`: `switch --track <remote_branch>`; `switch_create(dir, name)`: `switch -c <name>`
  - `stash_push(dir, message)`: `stash push -u -m <message>`
  - `merge_abort(dir)`: `merge --abort`; `rebase_abort(dir)`: `rebase --abort`
- [x] `check_branch_name(dir, name) -> Result<(), CommandError>`: `check-ref-format --branch <name>` über `run_allowing_failure`; Exit ≠ 0 → `CommandError::Git(format!("Ungültiger Branch-Name: {name}"))`.
- [x] Pfade aus der Oberfläche vor jedem Aufruf prüfen: relativ, ohne `..`-Komponente, ohne Laufwerk, nicht leer — dieselbe Prüfung wie `changes::validate_path` (dafür `pub(crate)` machen und hier aufrufen). Pfade immer hinter `--`.

### Aktionen `src-tauri/src/git/actions.rs`

- [x] `pub fn commit(dir, paths, message, amend) -> Result<String /* neue HEAD-ID */, CommandError>`: Nachricht trimmen; leer und nicht `amend` → Fehler „Commit-Nachricht fehlt.“; `paths` leer und nicht `amend` → Fehler „Keine Datei ausgewählt.“. `amend`: zuerst `upstream` + `is_ancestor(HEAD, upstream)` → wahr → Fehler aus den AK. `add_paths` (falls `paths` nicht leer), dann `commit_paths` bzw. `commit_amend`; Rückgabe `git::head_commit(dir)`.
- [x] `pub fn push(dir) -> Result<(), CommandError>`: Branch = `head_branch`; `None` → Fehler „Losgelöster HEAD — erst einen Branch anlegen.“ Upstream vorhanden → `git::push`; sonst Remote wie in `status` bestimmt → `push_set_upstream`; kein Remote → „Kein Remote eingerichtet.“
- [x] `pub fn pull(dir)`: ohne Upstream → „Kein Upstream — erst veröffentlichen.“; sonst `pull_merge`. Scheitert Git mit Konflikten, gibt die Funktion **keinen** Fehler zurück, wenn danach `MERGE_HEAD` existiert (der Status zeigt die Konflikte) — sonst den Git-Satz.
- [x] `pub fn switch(dir, branch, mode)`: `branch` beginnt mit einem Remote-Namen aus `git::remotes` + `/` → lokaler Name = Rest; existiert er (`branch_exists`) → `switch(lokal)`, sonst `switch_track(branch)`. Sonst `switch(branch)`. Bei `GitSwitchMode::Stash` vorher `stash_push(dir, "verwalter: vor Wechsel auf <branch>")`.
- [x] `pub fn create_branch(dir, name)`: `check_branch_name`, `branch_exists` → Fehler „Branch <name> gibt es schon.“, sonst `switch_create`.
- [x] `pub fn abort_operation(dir)`: `MERGE_HEAD` → `merge_abort`; `rebase-merge`/`rebase-apply` → `rebase_abort`; sonst Fehler „Kein Merge oder Rebase im Gang.“

### Fetch-Zeitpunkt `src-tauri/src/git/status.rs` + `model.rs`

- [x] `GitEntryStatus.last_fetch_ms` (seit Phase 1 im Typ, bisher `None`) füllen. Gespeichert im Arbeitsspeicher des Core: `static FETCHED: Mutex<HashMap<PathBuf, f64>>` in `git/status.rs` (Schlüssel = normalisierter Ordner), gesetzt nach jedem erfolgreichen `fetch`. Kein Speichern in der Datenbank — der Wert gilt für diesen App-Lauf.

### Commands `src-tauri/src/commands/git.rs`

- [x] Gemeinsamer Helfer `fn entry_dir(registry, session_id, key) -> Result<PathBuf, CommandError>` (`changes_input` mit `ChangesReach::Session`, `sources::find`, `source.error` gesetzt → `CommandError::Git(error)`).
- [x] `git_commit(session_id, key, paths, message, push, amend)`: `actions::commit` → neue ID per `session_commits::insert_all(connection, &session_id, &[id])`; bei `push` danach `actions::push` und `git::fetch` (Fehler des Fetch ignorieren). Kein Sperr-Check.
- [x] `git_push`: `actions::push`, danach `fetch` (Fehler ignorieren). `git_pull`: `registry.ensure_not_busy`, `actions::pull`, danach `fetch`. `git_fetch`: `git::fetch`, Zeitpunkt setzen.
- [x] `git_switch(session_id, key, branch, mode)` und `git_abort_operation`: zuerst `registry.ensure_not_busy(&session_id)?`.
- [x] `git_create_branch`: zuerst `ensure_not_busy` (der Wechsel auf den neuen Branch fasst den Ordner an, auch wenn sich keine Datei ändert — einheitlich mit `git_switch`).
- [x] Alle in `lib.rs` registrieren; Wrapper folgen in Phase 3.

### Doc-Updates

- [x] `docs/code-map.md`: Zeile „Git-Werkzeuge“ um `actions.rs` und die Commands; Zeile „Git-Aufrufe“: „ab ADR 025 auch schreibend (`run_write`, einmal wiederholt bei `index.lock`)“.
- [x] ADR 025: Abschnitt „Konsequenzen“ um „App-Commits landen in `session_commits`“ ergänzen, falls in Phase 1 noch nicht drin.

## Report-Back

Status: complete. `pnpm check` grün. Git-Semantik einmal in einem Wegwerf-Repository geprüft: `commit --only -- a new` committet genau die zwei, eine vorher gestagte dritte Datei bleibt gestaged; `check-ref-format --branch` lehnt `a..b` und `-x` ab. Die übrigen AK (Sperre, Push mit `-u`, Stash-Wechsel, `index.lock`-Wiederholung, `session_commits`) sind gebaut, aber erst mit der Oberfläche aus Phase 3 von Hand prüfbar — sie stehen in der Smoke-Checkliste der README.

Abweichungen:

- Ergänzen ohne Pfade läuft mit `--only` ohne Pfadangabe statt ganz ohne `--only`: so bleibt schon Gestagtes auch beim Ergänzen draußen (Git: „--amend --only“ ändert dann nur die Nachricht), wie beim normalen Commit.
- `git_switch` prüft auch den Ziel-Branch mit `check-ref-format --branch` — ein Name wie `-f` käme sonst als Option bei Git an.
- „Commit & Push“: scheitert der Push, lautet der Fehler „Commit angelegt, Push gescheitert: …“ — der Commit ist dann schon da und der Session zugeordnet.
- Fetch-Zeitpunkt ist mit dem normalisierten Ordnertext verschlüsselt statt mit `PathBuf` (dieselbe Normalisierung wie die Branch-Liste).
- `entry_dir` meldet einen Eintrag mit Fehler (Basis nicht bestimmbar) als `CommandError::Git`; `git_branches` bleibt wie in Phase 1.
- Bleibt ein Wechsel mit „Beiseitelegen“ nach dem Stash an Git hängen, liegt der Stash trotzdem — zurückholen kommt mit Phase 4.
