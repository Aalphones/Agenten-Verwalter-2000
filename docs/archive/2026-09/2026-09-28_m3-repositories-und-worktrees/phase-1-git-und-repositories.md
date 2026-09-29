# Phase 1 — Git-Modul, Schema und Repository-Liste

**Status:** complete · **Rating:** standard (Kontrakt liegt fest; neue Module nach vorhandenen Mustern, keine Oberfläche)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ und „Kontrakt“ (Migration 2, `git/`, `processes/`, `repositories/`, `db/repositories.rs`, `db/session_repositories.rs`, Fehler, Commands)
- [docs/conventions/rust.md](../../conventions/rust.md) — „Git“, „Datenbank“, „Typen für die UI“, „Critical Rules“
- Bestand als Muster:
  - `src-tauri/src/agents/claude/process.rs` — `CREATE_NO_WINDOW` und `build_command` (zieht in `processes::hide_console` um)
  - `src-tauri/src/db/sessions.rs` (Zeilen-Muster `StoredRow`, `upsert`, `load_active`), `src-tauri/src/db/chat_entries.rs` (Transaktion in `upsert_all`), `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/mod.rs` (`Database::with`)
  - `src-tauri/src/commands/sessions.rs` (Command-Muster: `async`, `tauri::State`), `src-tauri/src/lib.rs` (`generate_handler!`, `Arc<Database>` ist schon als State registriert)
  - `src-tauri/src/bin/gen-bindings.rs` (Export-Liste), `src/lib/sessions.ts` (Wrapper-Muster mit JSDoc `@throws`)
  - `src-tauri/src/error.rs`
- ADR-Vorlage: [docs/decisions/004-persistenz-und-wiederherstellung.md](../../decisions/004-persistenz-und-wiederherstellung.md) (Aufbau Kontext / Optionen / Entscheidung / Konsequenzen)
- Fehlerklassen: Vault-Entities für Git, Rust, Tauri, SQLite nicht vorhanden (Glob am 2026-09-28 leer). Einschlägig aus dem Projekt:
  - **Konsolenfenster:** Jeder Kindprozess aus der GUI-App öffnet unter Windows ein schwarzes Fenster, wenn `CREATE_NO_WINDOW` fehlt — prüfen per Blick: beim Hinzufügen eines Repositorys blitzt kein Fenster auf.
  - **Git wartet auf Eingabe:** Ohne `stdin(Stdio::null())` und `GIT_TERMINAL_PROMPT=0` kann ein Git-Aufruf auf eine Anmeldung warten und den Command für immer blockieren.
  - **Pfade:** `git rev-parse --show-toplevel` liefert unter Windows `C:/Users/...` mit Schrägstrichen — vor dem Speichern `/` durch `\` ersetzen, sonst schlägt der Dopplungs-Vergleich fehl.
  - **Migrationen:** eine bestehende Migration wird nie geändert (`db/migrations.rs`).

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` erzeugt `KnownRepository.ts` und die vier neuen `CommandError`-Varianten.
2. Die App startet mit einer vorhandenen Datenbank aus Meilenstein 4: `PRAGMA user_version` = 2, die Tabellen `repositories` und `session_repositories` existieren, `sessions.workspace_dir` ist bei allen alten Zeilen `NULL`, alle alten Sessions stehen weiter in der Sidebar.
3. Über die Entwicklerkonsole der App (`window.__TAURI_INTERNALS__.invoke`) oder einen temporären Aufruf: `repository_add` mit einem Unterordner eines Repositorys liefert das Repository mit Wurzelpfad (Backslashes) und Skill-Zahl; ein zweiter Aufruf mit demselben Repository liefert denselben Eintrag, keinen zweiten; ein Ordner ohne Repository liefert `notARepository`. `repository_list` zeigt den Eintrag; nach Umbenennen des Ordners `isMissing: true`. `repository_remove` entfernt ihn.
4. Kein Konsolenfenster blitzt bei Git-Aufrufen auf.
5. `docs/decisions/005-repositories-und-worktrees.md` existiert.

## Checkliste

- [x] `src-tauri/src/processes/mod.rs` (neu): `pub fn hide_console(command: &mut Command)` — unter `#[cfg(windows)]` `CommandExt::creation_flags(0x0800_0000)`, sonst leer. `lib.rs`: `pub mod processes;`. In `agents/claude/process.rs` den eigenen `CREATE_NO_WINDOW`-Block durch `hide_console(&mut command)` ersetzen.
- [x] `src-tauri/src/error.rs`: Varianten `GitNotFound`, `Git(String)`, `NotARepository(String)`, `RepositoryMissing(String)` mit den Texten aus dem Kontrakt.
- [x] `src-tauri/src/git/mod.rs` (neu, `lib.rs`: `pub mod git;`): private Hilfe `fn run(dir: &Path, args: &[&OsStr]) -> Result<String, CommandError>` — `Command::new("git").arg("-C").arg(dir).args(args)`, `.stdin(Stdio::null())`, `.env("GIT_TERMINAL_PROMPT", "0")`, `hide_console`, `.output()`. Startfehler mit `ErrorKind::NotFound` → `GitNotFound`, andere → `Io`. Exit ≠ 0 → `Git(stderr)` (UTF-8 verlustbehaftet, `trim()`, auf 500 Zeichen gekürzt; leer → „Exit-Code n“). Erfolg → stdout ohne Zeilenende am Schluss. Dazu eine zweite private Hilfe `fn run_status(dir, args) -> Result<bool, CommandError>` für Aufrufe, deren Exit-Code 1 „nein“ heißt (`show-ref --quiet`, `symbolic-ref -q`): Exit 0 → `true`, 1 → `false`, sonst `Git(stderr)`. Die zehn öffentlichen Funktionen aus dem Kontrakt, jede ein Einzeiler auf `run`/`run_status`; Pfade immer als eigenes `OsStr`-Argument. `toplevel` ersetzt `/` durch `\` (`#[cfg(windows)]`). `head_branch`: `symbolic-ref --short -q HEAD` — Exit 1 → `None`. Modul-Doc: „Einziger Ort, der `git` aufruft (AGENTS.md, Regel 2).“
- [x] `src-tauri/src/db/migrations/002_repositories_and_worktrees.sql` mit dem SQL aus dem Kontrakt; `db/migrations.rs`: `MIGRATIONS: [&str; 2]`.
- [x] `src-tauri/src/db/sessions.rs`: `SessionRow.workspace_dir: Option<String>`; `upsert` nimmt die Spalte in `INSERT (…)`/`VALUES` auf (als `?12`), **nicht** in `DO UPDATE SET`; `StoredRow` und `load_active` lesen sie als Spalte 11. In `sessions/registry.rs` `row_of` setzt `workspace_dir: Some(session.workspace.to_string_lossy().into_owned())` — alte Sessions haben ihre Zeile schon, dort bleibt `NULL`.
- [x] `src-tauri/src/db/repositories.rs` (neu, in `db/mod.rs` registrieren): `RepositoryRow` und die vier Funktionen aus dem Kontrakt; `list` mit `ORDER BY name COLLATE NOCASE`; `get_many` liest Zeile für Zeile per `SELECT … WHERE id = ?1` in der Reihenfolge der `ids`, fehlende → `Internal(format!("Unbekanntes Repository: {id}"))`.
- [x] `src-tauri/src/worktrees/mod.rs` (neu, `lib.rs`: `pub mod worktrees;`): vorerst nur `pub struct SessionRepository` aus dem Kontrakt (`#[derive(Debug, Clone)]`), damit `db/session_repositories.rs` kompiliert. Die Funktionen kommen in Phase 2 und 4.
- [x] `src-tauri/src/db/session_repositories.rs` (neu, registrieren): `insert_all` (eine Transaktion, `position` = Index, `repository_path` als `to_string_lossy`) und `load` (`ORDER BY position`).
- [x] `src-tauri/src/repositories/model.rs` + `mod.rs` (neu, `lib.rs`: `pub mod repositories;`): `KnownRepository` mit `#[derive(Debug, Clone, Serialize, TS)]`, `#[serde(rename_all = "camelCase")]`. `add`: `git::toplevel(Path::new(path))` — `Git(_)` → `NotARepository(path.to_owned())`, andere Fehler durchreichen; Name = letzte Pfadkomponente; bekannt, wenn `list` eine Zeile hat, deren `path` ohne Groß/Klein gleich ist (`eq_ignore_ascii_case`) → diese zurückgeben; sonst `RepositoryRow { id: Uuid v4, name, path, added_at: jetzt in ms }` einfügen. `list`: Zeilen → `KnownRepository` mit `is_missing = !Path::new(&path).join(".git").exists()` und `skill_count = count_skills(path)` (bei fehlendem Ordner 0). `count_skills`: `read_dir(root.join(".claude").join("skills"))`, zählt Einträge, die Ordner sind und eine `SKILL.md` enthalten; jeder Fehler → 0.
- [x] `src-tauri/src/commands/repositories.rs` (neu, `commands/mod.rs` ergänzen): `repository_list`, `repository_add(path: String)`, `repository_remove(repository_id: String)`, alle `async`, Parameter `database: tauri::State<'_, Arc<Database>>`; in `lib.rs` in `generate_handler!` eintragen.
- [x] `gen-bindings.rs`: `KnownRepository` exportieren; `pnpm bindings`.
- [x] `src/lib/repositories.ts` (neu): `listRepositories(): Promise<KnownRepository[]>`, `addRepository(path: string): Promise<KnownRepository>` (`@throws … notARepository, gitNotFound`), `removeRepository(repositoryId: string): Promise<void>` — Muster `src/lib/sessions.ts`.
- [x] `docs/decisions/005-repositories-und-worktrees.md` (neu): Status angenommen, Datum 2026-09-28. Kontext: Meilenstein 3, Konzept Abschnitte 20–23 und 52, Workspace-Contract, Windows-Pfadlänge. Optionen/Entscheidung aus README → „Festgelegte Entscheidungen“ (Basis-Regel mit verworfener `origin/main`-Alternative; Branch-Name gleich in allen Repositories statt Fehlerdialog; Workspace-Ordner 8 Zeichen und unveränderlicher Arbeitsordner wegen `--resume`; `--add-dir` + `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` mit dem Beleg vom 2026-09-28; Kopie in `session_repositories` statt Fremdschlüssel; Aufräumen beim Archivieren ohne `--force`). Konsequenzen: Branches sammeln sich in den Repositories (Aufräumen der Branches bleibt Handarbeit); Haupt-Checkout ohne Commit kann nicht Teil einer Session werden; Einstellungen folgen in M6.
- [x] Doku (im selben Commit): `docs/code-map.md` — Zeilen „Repositories“ (Core `src-tauri/src/repositories/`, `commands/repositories.rs`, `db/repositories.rs`; Oberfläche folgt in Phase 3), „Git“ neu (`src-tauri/src/git/`), „Prozesse ohne Konsolenfenster“ (`src-tauri/src/processes/`), Persistenz-Zeile um `session_repositories.rs` und Migration 2 ergänzen; Stand-Satz am Kopf auf „Meilenstein 3“. `docs/glossary.md`: „Repository“ um „Die App kennt es, sobald es einmal über ‚Repository hinzufügen‘ gewählt wurde; gespeichert ist der Wurzelordner.“ ergänzen.

## Report-Back
Umgesetzt wie geplant. `pnpm check` grün. Nicht geprüft (wandert in die Smoke-Checkliste am Plan-Ende): Ablauf von `repository_add`/`repository_list` in der laufenden App (AK 3), Migration auf einer echten M4-Datenbank (AK 2), kein aufblitzendes Konsolenfenster (AK 4).
