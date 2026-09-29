# Phase 2 — Worktrees beim Session-Start anlegen

**Status:** complete · **Rating:** heikel (Alles-oder-nichts über mehrere Repositories, Reihenfolge Datenbank/Registry/Prozess, Arbeitsordner darf sich nie ändern)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ (Branch, Workspace-Ordner, Agent-Start, Alles oder nichts) und „Kontrakt“ (`worktrees/`, `db/session_repositories.rs`, `session_create`, `SessionSummary.repository_count`)
- [ADR 005](../../decisions/005-repositories-und-worktrees.md) (aus Phase 1)
- Bestand:
  - `src-tauri/src/sessions/registry.rs` — `SessionRegistry::create` (Zeile ~163: Registrieren, `update`, Löschen der Zeile bei Fehler), `restore` (~123), `Session`-Struct (~49), `start_process` (~1067), `row_of`, `summarize`; Modul-Kommentar oben (keine Pipe-Schreibvorgänge unter der Sperre; Reihenfolge Session-Sperre → Datenbank-Sperre)
  - `src-tauri/src/agents/claude/process.rs` — `SpawnOptions`, `build_command`
  - `src-tauri/src/filesystem/workspace.rs` — `data_dir`, `session_workspace`
  - `src-tauri/src/git/mod.rs`, `src-tauri/src/worktrees/mod.rs`, `src-tauri/src/db/repositories.rs`, `src-tauri/src/db/session_repositories.rs` (aus Phase 1)
  - `src-tauri/src/commands/sessions.rs` (`session_create`), `src/lib/sessions.ts` (`createSession`), `src/features/sessions/NewSession.tsx` (Aufruf von `createSession`)
- Fehlerklassen: Vault-Entities nicht vorhanden. Einschlägig:
  - **Arbeitsordner wechselt → Verlauf weg:** Claude legt den Verlauf unter `%USERPROFILE%\.claude\projects\<Arbeitsordner mit - statt \ und :>\` ab (belegt: dort liegen Ordner `C--Users-sasch--verwalter-workspaces-<uuid>`). `restore` muss für alte Sessions (`workspace_dir` = `NULL`) exakt den bisherigen Pfad `workspaces\<volle ID>` liefern — prüfen per AK 5.
  - **Halber Zustand:** Jeder Fehlerpfad in `create` nach dem ersten `worktree add` muss das Aufräumen auslösen — prüfen per AK 4.
  - **Lange Arbeit unter Sperre:** `worktree add` kann bei großen Repositories Sekunden dauern. Er läuft **vor** dem Registrieren der Session, ohne Session-Sperre.

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` ergänzt `repositoryCount` in `SessionSummary.ts`.
2. `session_create` mit zwei bekannten Repositories (Aufruf über die Entwicklerkonsole, `repositoryIds` aus `repository_list`): unter `%USERPROFILE%\.verwalter\workspaces\<erste 8 Zeichen der ID>\` liegen zwei Worktrees mit Branch `verwalter/<slug>`; `session_repositories` hat zwei Zeilen; `sessions.workspace_dir` ist gesetzt; die Haupt-Checkouts sind auf ihrem alten Branch.
3. Der gestartete `claude.exe` hat pro Worktree ein `--add-dir` (sichtbar im Protokoll der Session oder per `Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Select CommandLine`), und die Antwort auf „Welche Skills aus den Repositories kennst du?“ nennt die Skills der Repositories.
4. Existiert `verwalter/<slug>` in einem Repository schon (vorher per `git branch verwalter/<slug>` anlegen), heißt der Branch in allen `verwalter/<slug>-2`. Scheitert das zweite `worktree add` (Probe: im zweiten Repository vorher `git worktree add <workspace-ziel>` von Hand belegen oder den Zielordner als Datei anlegen), existieren danach weder der erste Worktree noch sein Branch noch der Workspace-Ordner noch eine Session-Zeile, und `session_create` meldet `git` mit dem Repository-Namen im Text.
5. Eine Session von vor Meilenstein 3 startet nach dem Update mit ihrem alten Arbeitsordner, und die nächste Nachricht setzt ihren Verlauf fort.
6. `session_create` mit leerer `repositoryIds`-Liste verhält sich wie bisher (leerer Workspace, kein Git-Aufruf).

## Checkliste

- [x] `filesystem/workspace.rs`: `pub fn new_session_workspace(app, session_id) -> Result<PathBuf, CommandError>` — Wurzel `data_dir(app)?.join("workspaces")`, Kandidat `session_id[..8]` (die UUID hat immer ≥ 8 ASCII-Zeichen), existiert er schon → volle ID; `create_dir_all`, Pfad zurück. `session_workspace` in `legacy_session_workspace` umbenennen (Doc: „Ordner der Sessions von vor Meilenstein 3“) und dazu `pub fn stored_session_workspace(app, session_id, workspace_dir: Option<&str>) -> Result<PathBuf, CommandError>`: `Some(dir)` → `PathBuf::from(dir)` mit `create_dir_all`, `None` → `legacy_session_workspace`.
- [x] `worktrees/mod.rs`: `pub const BRANCH_PREFIX: &str = "verwalter/";` `const MAX_SLUG_CHARS: usize = 40;` `const MAX_BRANCH_SUFFIX: u32 = 99;`
  - `pub fn branch_slug(session_name: &str) -> String`: je Zeichen `'ä' | 'Ä' → "ae"`, `'ö' | 'Ö' → "oe"`, `'ü' | 'Ü' → "ue"`, `'ß' → "ss"`, ASCII-Buchstabe oder -Ziffer → kleingeschrieben übernehmen, alles andere → `-`; danach Folgen von `-` zu einem zusammenziehen, `-` an Anfang und Ende entfernen, auf `MAX_SLUG_CHARS` Zeichen kürzen, erneut `-` am Ende entfernen; leer → `"session"`. Beispiel: „OAuth Login für Backend“ → `oauth-login-fuer-backend`.
  - `fn free_branch(repositories: &[RepositoryRow], slug: &str) -> Result<String, CommandError>`: `n = 1..=MAX_BRANCH_SUFFIX`, Name `verwalter/<slug>` bzw. `verwalter/<slug>-<n>` ab `n = 2`; der erste Name, für den `git::branch_exists` in **keinem** Repository `true` ist; keiner frei → `Git("Kein freier Branch-Name für <slug>")`.
  - `fn folder_names(repositories: &[RepositoryRow]) -> Vec<String>`: Name des Repositorys, bei Dopplung (ohne Groß/Klein) `name-2`, `name-3`.
  - `pub fn create_all(workspace, session_name, repositories) -> Result<Vec<SessionRepository>, CommandError>`: leere Liste → `Ok(vec![])` ohne Git. Sonst zuerst für jedes Repository prüfen: `Path::new(&row.path).join(".git").exists()`, sonst `RepositoryMissing(row.path)`; dann `head_commit` (Fehler → `Git(format!("{name}: {message}"))`) und `head_branch` (`base_ref` = Branch oder Commit-ID); `free_branch`; dann pro Repository `git::worktree_add_new(repo, workspace.join(folder), branch, base_commit)`. Jeder Fehler eines `worktree add` → `rollback(workspace, &bisher_angelegte)` und Fehler mit vorangestelltem Repository-Namen (`Git(format!("{name}: {message}"))`); ein `Git`-Fehler wird dabei neu verpackt, andere Varianten (`GitNotFound`, `Io`) unverändert durchgereicht. `pub(crate) fn rollback(workspace: &Path, created: &[SessionRepository])`: je Eintrag `worktree_remove_force(repository_path, workspace.join(folder))` und `branch_delete_force(repository_path, branch)` (Fehler ignorieren, sie ändern den Ausgang nicht), danach `worktree_prune` je Eintrag. Den Workspace-Ordner selbst löscht der Aufrufer.
- [x] `agents/claude/process.rs`: `SpawnOptions.add_dirs: Vec<PathBuf>`; `build_command` hängt je Eintrag `--add-dir <Pfad>` an (Pfad als eigenes Argument) und setzt immer `.env("CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD", "1")`.
- [x] `sessions/registry.rs`:
  - `Session` bekommt `repositories: Vec<SessionRepository>` (nach dem Anlegen unveränderlich).
  - `SessionRegistry` bekommt `create_lock: Mutex<()>` (in `new` initialisieren): zwei gleichzeitige `create` würden sonst denselben freien Branch-Namen wählen.
  - `create(app, task, repository_ids: &[String], model, effort, mode)`: Reihenfolge — `let _creating = lock(create_lock)`; `find_claude().ok_or(ClaudeNotFound)?` (vor jedem Git-Aufruf; `start_process` sucht später noch einmal, das ist billig); `rows = database.with(|c| db::repositories::get_many(c, repository_ids))?`; `id`; `name = name_from_task(task)`; `workspace = new_session_workspace(app, &id)?`; `repositories = match worktrees::create_all(&workspace, &name, &rows) { Ok(r) => r, Err(e) => { let _ = fs::remove_dir_all(&workspace); return Err(e); } }`. Danach Session mit `name`, `workspace`, `repositories` bauen, in **einem** `database.with`-Aufruf nacheinander `session_rows::upsert(connection, &row_of(&session, &state))` und `session_repositories::insert_all(connection, &id, &repositories)` — die Session-Zeile muss vor `session_repositories` stehen (Fremdschlüssel); `insert_all` öffnet seine eigene Transaktion, deshalb keine äußere. Schlägt dieser Schritt fehl, gilt derselbe Rückbau wie beim Fehlschlag von `update` (unten). Dann wie bisher registrieren und `update(… start_process …)`. Schlägt `update` fehl: wie bisher Registry-Eintrag entfernen und Zeile löschen (kaskadiert `session_repositories`), zusätzlich `worktrees::rollback(&workspace, &repositories)` und `let _ = fs::remove_dir_all(&workspace)`. Hinweis: der Agent-Prozess ist in diesem Fall nie gestartet oder schon wieder beendet; hält Windows den Ordner trotzdem fest, bleibt er liegen — kein Fehler für den Nutzer.
  - `start_process`: `add_dirs = session.repositories.iter().map(|r| session.workspace.join(&r.folder)).collect()` an `SpawnOptions` (Phase 4 ersetzt das durch `worktrees::ensure`).
  - `restore`: `workspace = stored_session_workspace(app, &row.id, row.workspace_dir.as_deref())?`; `repositories = database.with(|c| session_repositories::load(c, &row.id))?`.
  - `summarize`: `repository_count: u32::try_from(session.repositories.len()).unwrap_or(u32::MAX)`.
- [x] `sessions/model.rs`: `SessionSummary.repository_count: u32`.
- [x] `commands/sessions.rs`: `session_create` bekommt `repository_ids: Vec<String>` (zwischen `task` und `model`) und reicht `&repository_ids` durch.
- [x] `src/lib/sessions.ts`: `createSession(task, repositoryIds: string[], model, effort, mode)`, `invoke('session_create', { task, repositoryIds, model, effort, mode })`, JSDoc-`@throws` um `repositoryMissing`, `git`, `gitNotFound` ergänzen. `NewSession.tsx`: vorerst `createSession(text.trim(), [], model, effort, mode)` — die Auswahl kommt in Phase 3.
- [x] `pnpm bindings`.
- [x] Doku (im selben Commit): `docs/code-map.md` — Zeile „Worktrees anlegen/aufräumen“: `src-tauri/src/worktrees/` (Branch-Name, Ordnernamen, Anlegen mit Rückbau); Zeile „Session-Arbeitsordner“: `new_session_workspace`, `stored_session_workspace`; Zeile „Agent-Provider“: „`--add-dir` je Worktree“. `docs/glossary.md`: „Workspace“ um „Liegt unter `<Benutzerordner>\.verwalter\workspaces\<8 Zeichen>`; ändert sich für eine Session nie.“ ergänzen; neuer Eintrag **Session-Branch** — „Der Branch `verwalter/<Name>`, den die App beim Anlegen einer Session in jedem ihrer Repositories anlegt; in allen Repositories einer Session gleich.“ `docs/knowledge/GAPS.md`: Frage „Skills in einer Session mit mehreren Repositories“ als geklärt entfernen und in `docs/knowledge/claude-stream-json.md` einen Abschnitt „Mehrere Repositories“ mit dem Beleg (Skills nur mit `--add-dir`, `CLAUDE.md` nur mit `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`, Claude Code 2.1.220, 2026-09-28) anlegen.

## Report-Back

- Geprüft: AK 1 (`pnpm check` grün, `repositoryCount` in `SessionSummary.ts`). AK 2–6 sind Laufzeit-Proben und gehen in die Smoke-Abnahme am Plan-Ende; von Hand geprobt ist davon nichts.
- Abweichung: `legacy_session_workspace` ist privat statt `pub` — nur `stored_session_workspace` ruft es auf.
- Abweichung: der Rückbau nach einem gescheiterten `worktree add` schließt das gescheiterte Repository selbst mit ein (Begründung und bessere Probe für AK 4 in [FINDINGS.md](FINDINGS.md), → Phase 4).
- `restore` lädt `session_repositories` aller Sessions in demselben Datenbankzugriff wie die Session-Zeilen, vor dem Sperren der Session-Liste.
