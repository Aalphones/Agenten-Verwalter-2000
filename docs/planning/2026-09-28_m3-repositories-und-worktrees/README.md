# Meilenstein 3 — Repositories & Worktrees

Ziel: Eine Session umfasst ein oder mehrere Git-Repositories. Unter „Neue Session“ wählt man bekannte Repositories aus oder fügt neue per Ordner-Dialog hinzu; beim Start legt die App pro Repository einen Worktree mit eigenem Branch im Session-Workspace an, und der Agent sieht dort die Repositories samt ihren Skills und Projekt-Anweisungen. Fehlerfälle (Branch existiert, Repository fehlt, Anlegen schlägt halb fehl) enden nie in einem halben Zustand. Beim Archivieren räumt die App die Worktrees ohne offene Änderungen wieder weg.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 005](../../decisions/005-repositories-und-worktrees.md) (entsteht in Phase 1, alle Entscheidungen dieses Plans), [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md), die Konventionen unter [docs/conventions/](../../conventions/), besonders [rust.md](../../conventions/rust.md) (Abschnitte „Git“ und „Datenbank“).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Git-Modul, Schema und Repository-Liste | [phase-1-git-und-repositories.md](phase-1-git-und-repositories.md) | standard | complete |
| 2 | Worktrees beim Session-Start anlegen | [phase-2-worktrees-anlegen.md](phase-2-worktrees-anlegen.md) | heikel | complete |
| 3 | Oberfläche: Schritt „Repositories“ und Sidebar | [phase-3-oberflaeche.md](phase-3-oberflaeche.md) | standard | complete |
| 4 | Fehlerfälle und Aufräumen | [phase-4-fehlerfaelle-und-aufraeumen.md](phase-4-fehlerfaelle-und-aufraeumen.md) | heikel | pending |

Umsetzung direkt auf `main`, ein Commit pro Phase, `pnpm check` vor jedem Commit grün (rustfmt und Clippy brauchen `cargo` im PATH: `$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings`. Erkenntnisse während der Umsetzung → [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Begründungen und verworfene Alternativen: ADR 005 (Phase 1 schreibt es aus diesem Abschnitt). Kurzfassung:

- **Bekannte Repositories** stehen in einer eigenen Tabelle `repositories`. Hinzufügen über den Ordner-Dialog des Systems (`tauri-plugin-dialog`); der Core prüft mit `git rev-parse --show-toplevel` und speichert den Wurzelordner — wer einen Unterordner wählt, bekommt das Repository drumherum. Schon bekannt → kein Fehler, das vorhandene wird zurückgegeben. Name = Ordnername des Wurzelordners.
- **Die Session kopiert, was sie braucht.** `session_repositories` speichert Name, Pfad des Haupt-Checkouts, Unterordner, Branch und Basis als Kopie, ohne Fremdschlüssel auf `repositories`. Wer ein Repository aus der Liste entfernt, zerstört keine Session.
- **Basis = der aktuell ausgecheckte Stand des Haupt-Checkouts**, kein `fetch`, kein `origin/main`. Gespeichert werden `base_ref` (Branch-Name, bei losgelöstem HEAD die Commit-ID) und `base_commit` (Commit-ID beim Anlegen). Deterministisch, offline, schnell; Meilenstein 5 misst Changes dagegen. Alternative `origin/<Standard-Branch>` nach `fetch` verworfen: braucht Netz und Anmeldedaten, und ein Repository ohne Remote hätte keine Basis.
- **Branch** `verwalter/<slug>`; der Slug entsteht aus dem Session-Namen (Kleinbuchstaben, ä→ae, ö→oe, ü→ue, ß→ss, alles andere außer `a-z0-9` → `-`, Bindestriche zusammengezogen und außen entfernt, höchstens 40 Zeichen, leer → `session`). Existiert der Branch in **einem** der gewählten Repositories schon, hängt die App `-2`, `-3` … an, bis der Name in **allen** frei ist — eine Session hat überall denselben Branch-Namen, und „Branch existiert“ ist kein Fehler, den der Nutzer lösen muss.
- **Workspace-Ordner** neuer Sessions: `<Benutzerordner>\.verwalter\workspaces\<erste 8 Zeichen der Session-ID>` (existiert der Ordner schon: die volle ID), gespeichert in der neuen Spalte `sessions.workspace_dir`. Sessions von vor Meilenstein 3 haben dort `NULL` und behalten `workspaces\<volle ID>` — **der Arbeitsordner einer Session ändert sich nie**, weil Claude den Verlauf unter dem Arbeitsordner ablegt (`%USERPROFILE%\.claude\projects\<Arbeitsordner>\`) und `--resume` ihn sonst nicht findet.
- **Worktree-Ordner** = `<workspace_dir>\<Name des Repositorys>`; zwei gleichnamige Repositories in einer Session → `name`, `name-2`.
- **Agent-Start:** Arbeitsverzeichnis bleibt der Workspace. Pro Worktree `--add-dir <Pfad>`, dazu die Umgebungsvariable `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`. Belegt am 2026-09-28 mit Claude Code 2.1.220: ohne `--add-dir` findet Claude die Skills eines Unterordners nicht (`system/init` → `skills` leer), mit `--add-dir` schon; die `CLAUDE.md` eines hinzugefügten Ordners lädt Claude nur mit der Variable.
- **Anlegen ist alles oder nichts.** Scheitert ein Worktree, entfernt die App die schon angelegten Worktrees und Branches dieser Session wieder, löscht den Workspace-Ordner und meldet den Fehler mit dem Namen des Repositorys; es entsteht keine Session. Die Claude-Kommandozeile wird **vor** dem ersten Git-Aufruf gesucht.
- **Repository fehlt:** In „Neue Session“ steht ein bekanntes Repository, dessen Ordner fehlt oder kein Git-Repository mehr ist, als „nicht gefunden“ da, ist nicht wählbar und hat „Entfernen“. Bei einer bestehenden Session prüft der Core vor jedem Agent-Start die Worktrees: fehlt nur der Worktree-Ordner, legt er ihn aus dem Session-Branch neu an; fehlt der Haupt-Checkout, startet der Agent ohne dieses Repository und der Chat bekommt einen Fehler-Eintrag.
- **Aufräumen beim Archivieren:** Nach dem Archivieren entfernt die App die Worktrees der Session mit `git worktree remove` **ohne** `--force` — Git verweigert das bei geänderten oder neuen, nicht ignorierten Dateien, solche Worktrees bleiben liegen. Branches bleiben immer (Commits gehen nie verloren). Der Workspace-Ordner wird gelöscht, wenn er danach leer ist. Das ändert die Archivieren-Bedeutung aus Meilenstein 4 („Arbeitsordner bleiben erhalten“) — Glossar und Menü-Erklärung ziehen mit.
- **Keine Einstellungen-Oberfläche** in diesem Plan (M6): Präfix `verwalter/`, Basis-Regel und Workspace-Wurzel sind feste Werte im Code.
- **Scratchpad** gehört mit dem Hintergrund-Panel zu Meilenstein 2b, nicht hierher; die Tafel `BgScratch` wird im Entwurfs-README umgehängt.
- **Git-Aufrufe** laufen ausschließlich über `src-tauri/src/git/`: `git` aus dem PATH, ohne Shell, ohne Konsolenfenster, Standardeingabe `null`, `GIT_TERMINAL_PROMPT=0`, Pfade als eigene Argumente.

## Kontrakt

### Datenbank — Migration 2 (`src-tauri/src/db/migrations/002_repositories_and_worktrees.sql`)

```sql
CREATE TABLE repositories (
  id       TEXT PRIMARY KEY,   -- UUID v4
  name     TEXT NOT NULL,      -- Ordnername des Wurzelordners
  path     TEXT NOT NULL,      -- Wurzelordner, Backslashes (aus git rev-parse --show-toplevel umgewandelt)
  added_at REAL NOT NULL       -- Millisekunden seit 1970
);

CREATE TABLE session_repositories (
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,   -- Reihenfolge der Auswahl, ab 0
  name            TEXT NOT NULL,
  repository_path TEXT NOT NULL,      -- Wurzelordner des Haupt-Checkouts
  folder          TEXT NOT NULL,      -- Unterordner im Workspace
  branch          TEXT NOT NULL,
  base_ref        TEXT NOT NULL,
  base_commit     TEXT NOT NULL,
  PRIMARY KEY (session_id, position)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN workspace_dir TEXT;  -- NULL: <Benutzerordner>\.verwalter\workspaces\<id>
```

`db/migrations.rs`: `MIGRATIONS` wird `[&str; 2]` mit der neuen Datei hinten.

### Rust-Schnittstellen

```rust
// git/mod.rs — einziger Ort, der git aufruft
pub fn toplevel(dir: &Path) -> Result<PathBuf, CommandError>;              // rev-parse --show-toplevel, Backslashes
pub fn head_commit(repo: &Path) -> Result<String, CommandError>;           // rev-parse --verify HEAD
pub fn head_branch(repo: &Path) -> Result<Option<String>, CommandError>;   // symbolic-ref --short -q HEAD; Exit 1 → None
pub fn branch_exists(repo: &Path, branch: &str) -> Result<bool, CommandError>;  // show-ref --verify --quiet refs/heads/<branch>
pub fn worktree_add_new(repo: &Path, path: &Path, branch: &str, start: &str) -> Result<(), CommandError>;  // worktree add -b <branch> <path> <start>
pub fn worktree_add_existing(repo: &Path, path: &Path, branch: &str) -> Result<(), CommandError>;         // worktree add <path> <branch>
pub fn worktree_remove(repo: &Path, path: &Path) -> Result<(), CommandError>;        // worktree remove <path>
pub fn worktree_remove_force(repo: &Path, path: &Path) -> Result<(), CommandError>;  // worktree remove --force <path>  (nur Rollback)
pub fn worktree_prune(repo: &Path) -> Result<(), CommandError>;
pub fn branch_delete_force(repo: &Path, branch: &str) -> Result<(), CommandError>;   // branch -D  (nur Rollback)

// processes/mod.rs
pub fn hide_console(command: &mut std::process::Command);   // CREATE_NO_WINDOW unter Windows, sonst nichts

// repositories/model.rs (derive TS)
pub struct KnownRepository { pub id: String, pub name: String, pub path: String, pub skill_count: u32, pub is_missing: bool }

// repositories/mod.rs
pub fn list(database: &Database) -> Result<Vec<KnownRepository>, CommandError>;   // Name aufsteigend, ohne Groß/Klein
pub fn add(database: &Database, path: &str) -> Result<KnownRepository, CommandError>;
pub fn remove(database: &Database, id: &str) -> Result<(), CommandError>;
pub fn count_skills(root: &Path) -> u32;   // Unterordner von <root>\.claude\skills mit SKILL.md

// worktrees/mod.rs
pub struct SessionRepository { pub name: String, pub repository_path: PathBuf, pub folder: String, pub branch: String, pub base_ref: String, pub base_commit: String }
pub fn branch_slug(session_name: &str) -> String;
pub fn create_all(workspace: &Path, session_name: &str, repositories: &[RepositoryRow]) -> Result<Vec<SessionRepository>, CommandError>;  // alles oder nichts
pub fn ensure(workspace: &Path, repositories: &[SessionRepository]) -> Vec<WorktreeCheck>;   // Phase 4
pub fn remove_clean(workspace: &Path, repositories: &[SessionRepository]);                  // Phase 4
pub(crate) fn rollback(workspace: &Path, created: &[SessionRepository]);                    // Rückbau nach gescheitertem Anlegen
pub enum WorktreeCheck { Ready(PathBuf), Missing { name: String, reason: String } }

// db/repositories.rs
pub struct RepositoryRow { pub id: String, pub name: String, pub path: String, pub added_at: f64 }
pub fn insert(connection: &Connection, row: &RepositoryRow) -> Result<(), CommandError>;
pub fn list(connection: &Connection) -> Result<Vec<RepositoryRow>, CommandError>;
pub fn get_many(connection: &Connection, ids: &[String]) -> Result<Vec<RepositoryRow>, CommandError>;  // Reihenfolge wie ids; unbekannte id → Internal
pub fn delete(connection: &Connection, id: &str) -> Result<(), CommandError>;

// db/session_repositories.rs
pub fn insert_all(connection: &mut Connection, session_id: &str, repositories: &[SessionRepository]) -> Result<(), CommandError>;  // eine Transaktion, position = Index
pub fn load(connection: &Connection, session_id: &str) -> Result<Vec<SessionRepository>, CommandError>;                          // nach position
```

`SessionRow` (`db/sessions.rs`) bekommt `workspace_dir: Option<String>`: `upsert` schreibt die Spalte nur beim ersten `INSERT` (nicht in `DO UPDATE SET`), `load_active` liest sie mit.

### Fehler (`src-tauri/src/error.rs`)

| Variante | Text | Wann |
|---|---|---|
| `GitNotFound` | „Git nicht gefunden“ | `git` fehlt im PATH (Start des Prozesses schlägt mit `NotFound` fehl) |
| `Git(String)` | „Git: {0}“ | Git endet mit Fehler; Inhalt = Standardfehlerausgabe, gekürzt auf 500 Zeichen |
| `NotARepository(String)` | „Kein Git-Repository: {0}“ | `repository_add` mit einem Ordner außerhalb eines Repositorys |
| `RepositoryMissing(String)` | „Repository nicht gefunden: {0}“ | Session-Anlage mit einem Repository, dessen Ordner fehlt; Inhalt = Pfad |

Die generierte `src/lib/bindings/CommandError.ts` erhält `gitNotFound`, `git`, `notARepository`, `repositoryMissing`.

### Tauri Commands

| Command | Parameter | Rückgabe | Wrapper |
|---|---|---|---|
| `repository_list` (`commands/repositories.rs`) | — | `KnownRepository[]` | `listRepositories` in `src/lib/repositories.ts` |
| `repository_add` | `path: String` | `KnownRepository` | `addRepository` |
| `repository_remove` | `repository_id: String` | `()` | `removeRepository` |
| `session_create` (geändert) | zusätzlich `repository_ids: Vec<String>` | `SessionSummary` | `createSession(task, repositoryIds, model, effort, mode)` |

`SessionSummary` bekommt `repository_count: u32`.

### Abhängigkeit (Phase 3)

`tauri-plugin-dialog` (Rust, Version 2) und `@tauri-apps/plugin-dialog` (JS, Version 2), registriert in `lib.rs`, Berechtigung `dialog:allow-open` in `src-tauri/capabilities/default.json`.

## Finale Abnahmekriterien

1. „Neue Session“ zeigt den Schritt „2 Repositories“ nach Entwurf: bekannte Repositories mit Häkchen, Pfad und Skill-Zahl, „Repository hinzufügen …“ öffnet den Ordner-Dialog, der Hinweis mit ⓘ steht daneben, die Fußzeile nennt „n Repositories · Modell · Modus“. „Agent“ ist Schritt 3.
2. Eine Session mit zwei Repositories starten: unter `%USERPROFILE%\.verwalter\workspaces\<8 Zeichen>\` liegen zwei Worktrees; in beiden ist der Branch `verwalter/<slug>` ausgecheckt, ausgehend vom Stand des Haupt-Checkouts; die Haupt-Checkouts sind unverändert (gleicher Branch, keine neuen Dateien).
3. Der Agent sieht beide Repositories: er nennt auf Nachfrage die Skills aus `<repo>\.claude\skills` und kennt die `CLAUDE.md` der Repositories — auch nach einem App-Neustart mit der nächsten Nachricht.
4. Existiert `verwalter/<slug>` in einem der Repositories schon, bekommt die neue Session `verwalter/<slug>-2` in allen.
5. Scheitert das Anlegen im zweiten Repository, bleibt nichts zurück: kein Worktree, kein neuer Branch, kein Workspace-Ordner, keine Session; das Formular nennt Repository und Grund.
6. Ein bekanntes Repository, dessen Ordner umbenannt wurde, steht als „nicht gefunden“ mit „Entfernen“ in der Liste und lässt sich nicht wählen.
7. Wird der Worktree-Ordner einer Session gelöscht, legt die nächste Nachricht ihn aus dem Session-Branch neu an; fehlt der Haupt-Checkout, arbeitet der Agent ohne ihn weiter und der Chat zeigt „Repository nicht gefunden“.
8. Archivieren entfernt saubere Worktrees; ein Worktree mit nicht committeten Änderungen bleibt samt Änderungen liegen; Branches bleiben in beiden Fällen.
9. Sessions von vor Meilenstein 3 laufen unverändert weiter (gleicher Arbeitsordner, `--resume` findet den Verlauf).
10. Die Sidebar-Meta-Zeile laufender und pausierter Sessions nennt „n Repositories · Modell“ (bei 0 Repositories nur das Modell).
11. `pnpm check` grün; ADR 005, Code-Map, Glossar, PROJECT.md, AGENTS.md, GAPS und Entwurfs-README beschreiben den tatsächlichen Stand.

## Smoke-Checkliste (macht Sascha am Plan-Ende)

Wackelstellen zuerst:

- [ ] **Skills und CLAUDE.md nach Neustart:** Session mit einem Repository starten, das Skills und eine `CLAUDE.md` hat. Fragen „Welche Skills aus dem Repository kennst du, und was steht in der CLAUDE.md?“ → nennt beides. App schließen, neu starten, dieselbe Frage erneut senden → wieder beides (prüft `--add-dir` auf dem `--resume`-Weg; geprobt ist nur ein frischer Start).
- [ ] **Archivieren mit laufendem Dev-Server:** Agent einen Dev-Server im Worktree starten lassen, Session archivieren, 15 s warten → Worktree ist weg oder liegt vollständig samt Dateien da (nie halb gelöscht); `git -C <repo> worktree list` zeigt keinen kaputten Eintrag (`prunable` ist in Ordnung). Windows hält Dateien offener Prozesse fest — hier bricht es, wenn überhaupt.
- [ ] **Großes Repository mit tiefen Pfaden** (z. B. eins mit `node_modules`-artigen Strukturen im Repository): Session anlegen → klappt, oder Fehlermeldung nennt Repository und Grund und es bleibt nichts zurück.
- [ ] Zwei Repositories wählen, starten → beide Worktrees da, Branch in beiden gleich, Haupt-Checkouts unverändert (`git status` dort sauber, alter Branch).
- [ ] Zweite Session mit gleichem ersten Satz → Branch `…-2`.
- [ ] Unterordner eines Repositorys über „Repository hinzufügen …“ wählen → das Repository selbst erscheint; einen Nicht-Repository-Ordner wählen → Meldung, nichts hinzugefügt; dasselbe Repository noch mal → keine Dopplung.
- [ ] Repository-Ordner umbenennen, „Neue Session“ öffnen → „nicht gefunden“, nicht wählbar, „Entfernen“ entfernt es.
- [ ] Worktree-Ordner einer Session im Explorer löschen, Nachricht senden → Ordner ist wieder da, Agent arbeitet.
- [ ] Session mit einer Datei-Änderung im Worktree archivieren → Worktree mit Änderung bleibt; Session ohne Änderung archivieren → Worktree weg, Branch da.
- [ ] Alte Session (vor M3 angelegt) öffnen und eine Nachricht senden → Agent kennt den Verlauf.
- [ ] Session ohne Repository starten → funktioniert wie bisher (leerer Ordner).
- [ ] Die offenen Smoke-Checklisten aus [Meilenstein 4](../2026-09-28_m4-persistenz-und-wiederherstellung/README.md) und [Meilenstein 2a](../../archive/2026-09/2026-09-28_m2a-durchstich-chat/README.md), falls noch nicht abgenommen.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups

- Backlog (beim Planen aufgefallen, nicht beauftragt): git-ignorierte Dateien wie `.env` fehlen im Worktree, Dev-Server starten dort deshalb oft nicht. Kopieren berührt die Sicherheitsgrenze (der Agent sähe dann Zugangsdaten) — eigene Entscheidung nötig.
