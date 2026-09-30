# Phase 1 — Core: Haupt-Checkout statt App-Worktree, Freigabe der Ticket-Worktree-Ordner

Rating: **heikel** (Datenmodell, Sicherheitsgrenze des Agenten).

Nach dieser Phase legt eine neue Session keine Worktrees mehr an. Der Agent arbeitet mit den Haupt-Checkouts und darf in Ticket-Worktrees `<repo>-wt-*` neben ihnen lesen und schreiben. Die Changes zeigen für neue Sessions die Änderungen im Haupt-Checkout. Ticket-Worktrees sieht die App erst ab Phase 3.

## Kontext — vorher lesen

- [README.md](README.md) dieses Plans, Abschnitt „Kontrakt"
- [docs/decisions/005-repositories-und-worktrees.md](../../decisions/005-repositories-und-worktrees.md): das bisherige Modell, das hier für neue Sessions abgelöst wird
- [docs/conventions/rust.md](../../conventions/rust.md): Fehlerbehandlung, Git nur über `git/`
- `src-tauri/src/worktrees/mod.rs` (ganz)
- `src-tauri/src/db/session_repositories.rs`, `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/migrations/002_repositories_and_worktrees.sql`
- `src-tauri/src/sessions/registry.rs`: `create`, `discard_created`, `archive`, `skill_roots`, `start_process`, `schedule_worktree_cleanup`
- `src-tauri/src/agents/claude/process.rs`: `SpawnOptions`, `build_command`
- `src-tauri/src/changes/mod.rs`: `load_one`, `file_diff`, `failed`. Hier nur anpassen, damit es kompiliert. Umgebaut wird in Phase 3.
- Fehlerklassen geprüft (Vault: git, claude-code, sqlite). Einschlägig ist eine: Der **ausgecheckte** Branch ist nicht der Standard-Branch. Der Branch-Text des Haupt-Checkouts wird hier nur als „was gerade ausgecheckt ist" angezeigt.

## Was der entfernte Code tut (Chesterton)

- `create_all`, `free_branch`, `branch_slug`, `folder_names`, `BRANCH_PREFIX` und die Slug-Konstanten erzeugen je Session einen Branch `verwalter/<slug>` und einen Worktree-Ordner je Repository. Nach dieser Phase ruft sie niemand mehr auf. Alte Sessions haben Ordner und Branch in der Datenbank.
- `rollback` baut nach gescheitertem Anlegen App-Worktrees und Branches ab. Neue Sessions haben keine, deshalb entfällt es. Alte Sessions laufen nie durch `create` oder `discard_created`.
- `ensure` (bleibt) legt einen gelöschten App-Worktree vor dem Agent-Start neu an. Für alte Sessions bleibt das Verhalten gleich.

## Abnahmekriterien

- Neue Session: kein `git worktree add`, kein neuer Branch. In `session_repositories` steht `checkout = 'main'`, `folder = ''`, `branch = ''`, dazu `base_ref`/`base_commit` wie bisher aus dem ausgecheckten HEAD.
- Alte Sessions laden mit `checkout = 'app_worktree'` (Standardwert der Migration) und verhalten sich wie vorher.
- Der Agent-Start übergibt je `Main`-Repository den Haupt-Checkout per `--add-dir` und die beiden Freigaben aus dem Kontrakt.
- Fehlt der Haupt-Checkout eines `Main`-Repositorys, startet der Agent ohne ihn, und im Chat steht der bestehende Fehler-Eintrag „Repository nicht gefunden".
- Das `/`-Menü einer neuen Session findet die Skills im Haupt-Checkout.
- Archivieren einer neuen Session lässt Haupt-Checkouts und Ticket-Worktrees unangetastet.
- Die Freigabe ist am echten Claude belegt (Prüfschritt unten).
- `pnpm check` ist grün, ohne `#[allow(dead_code)]`.

## Checkliste

**Datenbank**

- [x] `src-tauri/src/db/migrations/004_main_checkout.sql` anlegen:

  ```sql
  ALTER TABLE session_repositories ADD COLUMN checkout TEXT NOT NULL DEFAULT 'app_worktree';

  CREATE TABLE session_ticket_worktrees (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    folder     TEXT NOT NULL,
    PRIMARY KEY (session_id, position, folder)
  ) WITHOUT ROWID;
  ```

  In `migrations.rs` als viertes `include_str!` nach `003_background.sql` eintragen. Die Tabelle benutzt erst Phase 2.
- [x] `db/session_repositories.rs`: `insert_all` schreibt die Spalte `checkout`. Bei `AppWorktree { folder, branch }` gehen `'app_worktree'`, `folder` und `branch` hinein, bei `Main` gehen `'main'`, `''` und `''` hinein. `load` liest `checkout` mit und baut daraus die Enum-Variante. Ein unbekannter Wert gibt `CommandError::Internal(format!("Unbekannte Checkout-Art {value}"))`.

**Datenmodell (`worktrees/mod.rs`)**

- [x] `pub enum RepositoryCheckout` und `pub const TICKET_WORKTREE_INFIX` wie im Kontrakt der README, Enum mit `#[derive(Debug, Clone)]`.
- [x] `SessionRepository`: Felder `folder` und `branch` entfernen, `pub checkout: RepositoryCheckout` ergänzen.
- [x] `impl SessionRepository { pub fn working_dir(&self, workspace: &Path) -> PathBuf }`: bei `AppWorktree` `workspace.join(folder)`, bei `Main` `self.repository_path.clone()`. Doc-Kommentar: „Der Ordner, in dem der Agent dieses Repository vorfindet."
- [x] `pub fn main_checkouts(repositories: &[RepositoryRow]) -> Result<Vec<SessionRepository>, CommandError>`: prüft je Zeile `.git` (sonst `CommandError::RepositoryMissing(row.path.clone())`), liest `read_base` (Fehler mit `prefixed(&row.name, …)`) und gibt `SessionRepository { …, checkout: RepositoryCheckout::Main }` zurück. Doc-Kommentar: legt nichts an, liest nur die Basis.
- [x] `ensure_one`: `match &repository.checkout`. `Main`: Fehlt `repository_path/.git`, gibt es `Missing` mit demselben Satz wie bisher, sonst `Ready(repository.repository_path.clone())`. `AppWorktree { folder, branch }`: die bisherige Logik mit Werten aus der Variante.
- [x] `remove_clean`: nur `AppWorktree` wie bisher, `Main` überspringen. Doc-Kommentar ergänzen: „Haupt-Checkouts und Ticket-Worktrees fasst sie nicht an — deren Lebenszyklus gehört den Anweisungen des Agenten (ADR 010)."
- [x] `pub fn permission_rules(repositories: &[SessionRepository]) -> Vec<String>`: Je `Main`-Repository mit Elternordner und Ordnernamen entstehen zwei Einträge, `format!("Edit({pattern})")` und `format!("Read({pattern})")`. Dabei gilt `pattern = format!("{}/{}{TICKET_WORKTREE_INFIX}*/**", rule_path(parent), folder_name)`. Private `fn rule_path(dir: &Path) -> String`: `to_string_lossy()`, `\`→`/`. Beginnt der Text mit `<Buchstabe>:`, wird daraus `//<Buchstabe klein><Rest ohne Doppelpunkt>`, also `C:\Users\x\develop` → `//c/Users/x/develop`. Doc-Kommentar: Schreibweise belegt am 2026-09-30 mit Claude Code 2.1.284, `Edit`-Regeln decken alle Schreibwerkzeuge ab, `Write(...)` wird von Claude ignoriert.
- [x] Entfernen: `create_all`, `free_branch`, `branch_slug`, `folder_names`, `rollback`, `BRANCH_PREFIX`, `MAX_SLUG_CHARS`, `MAX_BRANCH_SUFFIX`, `EMPTY_SLUG`, den dann unbenutzten `HashSet`-Import. Danach per Grep-Werkzeug `branch_delete_force` und `worktree_remove_force` in `src-tauri/src` suchen. Was nur noch in `git/` steht, wird ebenfalls entfernt.

**Agent-Start (`agents/claude/process.rs`)**

- [x] `SpawnOptions`: Doc-Kommentar von `add_dirs` auf „Ordner der Session-Repositories (Haupt-Checkout oder App-Worktree): ohne `--add-dir` findet Claude ihre Skills nicht." ändern. Neues Feld `pub allowed_rules: Vec<String>` mit Doc-Kommentar „Freigaben für Ticket-Worktrees neben den Haupt-Checkouts (`worktrees::permission_rules`)."
- [x] `build_command`: Ist `allowed_rules` nicht leer, folgt vor der `--add-dir`-Schleife einmal `--allowedTools` und danach jede Regel als eigenes Argument. Kommentar: `--allowedTools` nimmt mehrere Werte, und die nächste Option (`--add-dir`, `--resume`, `--session-id`) beendet die Liste.

**Sessions (`sessions/registry.rs`)**

- [x] `create`: `worktrees::main_checkouts(&rows)?` direkt nach dem Laden von `rows` und vor `new_session_workspace`. Das `match` mit `create_all` und den Kommentar „Die Worktrees entstehen ohne Session-Sperre …" entfernen. Scheitert `take_for_workspace`, bleibt nur `fs::remove_dir_all(&workspace)`. Den Kommentar „Im Haupt-Checkout suchen: der Worktree der neuen Session hat dieselben Dateien." zu „Skills liegen im Haupt-Checkout." kürzen. Doc-Kommentar von `create`: „Legt den Workspace an, liest die Basis jedes Repositorys, speichert die Session und startet ihren Agenten. Alles oder nichts: scheitert ein Schritt, bleibt weder der Workspace-Ordner noch eine Datenbankzeile zurück. Worktrees und Branches legt die App nicht an (ADR 010)."
- [x] `discard_created`: Aufruf `worktrees::rollback(…)` entfernen.
- [x] `skill_roots`: `repository.working_dir(&workspace)` statt `workspace.join(&repository.folder)`. Doc-Kommentar: „Name und Arbeitsordner jedes Repositorys der Session — dort suchen Skills und Befehle."
- [x] `start_process`: `allowed_rules: worktrees::permission_rules(&session.repositories)` in `SpawnOptions` setzen.

**Changes, nur so weit, dass es kompiliert (`changes/mod.rs`)**

- [x] In `load_one` und `file_diff` `repository.working_dir(workspace)` statt `workspace.join(&repository.folder)` verwenden. Die Prüfung „Ordner fehlt → `WORKTREE_MISSING`" gilt nur für `AppWorktree`.
- [x] Neue private `fn branch_label(repository: &SessionRepository) -> String`: bei `AppWorktree` `branch.clone()`. Bei `Main` `git::head_branch(&repository.repository_path)`, bei `Ok(None)` oder Fehler die ersten 7 Zeichen von `git::head_commit`, wenn auch das scheitert `"HEAD"`. `load_one` und `failed` benutzen sie statt `repository.branch`.

**ADR**

- [x] `docs/decisions/010-worktrees-durch-den-agenten.md` im Format von ADR 005. Inhalt:
  - **Kontext:** Die App erzwang pro Session und Repository einen Worktree mit Branch `verwalter/<slug>`. Das Regelwerk des Agenten soll entscheiden, ob er direkt im Haupt-Checkout arbeitet oder in einem Ticket-Worktree mit Ticket-Branch. Die Namensregel dieses Regelwerks ist ein Nachbarordner `<repo>-wt-<Name>`. Mehrere Sessions können nacheinander denselben Ticket-Worktree bearbeiten, und das Merge-Gate braucht den ganzen Branch gegen den Standard-Branch.
  - **Optionen:** (a) App-Worktree wie bisher; (b) Schalter in „Neue Session"; (c) Haupt-Checkout per `--add-dir`, Ticket-Worktrees nach der Namensregel des Agenten freigegeben (`--allowedTools`) und der Session zugeordnet, sobald ihr Agent sie benutzt; (d) wie (c), aber Worktrees im Session-Ordner mit Ortsvorgabe im Systemprompt. Bei der Zuordnung: (1) alle `-wt-`-Worktrees des Repositorys, (2) die seit Session-Start neuen, (3) die vom Agenten benutzten.
  - **Entscheidung:** (c) mit (3). Gegen (b) spricht, dass die Regel im Agenten-Regelwerk steht und nicht pro Session geklickt wird. Gegen (d) spricht, dass das Regelwerk den Ort festlegt und die App sich danach richtet. Außerdem schreibt Claude den Systemprompt bei der ersten Anfrage einer Unterhaltung fest (`--system-prompt-snapshot`). Gegen (1) und (2) spricht, dass parallele Sessions auf demselben Repository sonst fremde Tickets sehen. Belegt am 2026-09-30 (Claude Code 2.1.284): Ohne Freigabe verweigert Claude Schreibzugriffe im Nachbarordner. `Edit(//c/…/<repo>-wt-*/**)` erlaubt sie, ein anderer Nachbarordner bleibt gesperrt. Ticket-Worktrees werden gegen den Standard-Branch gemessen, nicht gegen den Session-Start. Alte Sessions behalten ihre App-Worktrees (Spalte `checkout`).
  - **Konsequenzen:** Die Sicherheitsgrenze umfasst die Haupt-Checkouts und alle `<repo>-wt-*`-Nachbarordner der Session-Repositories. Parallele Sessions auf demselben Repository teilen sich den Haupt-Checkout, und die App verhindert das nicht. Die App hängt an der Namensregel `-wt-` (Konstante `TICKET_WORKTREE_INFIX`). Ändert das Regelwerk sie, muss die App nachziehen. Ein Ticket-Worktree erscheint erst, wenn der Agent der Session ihn benutzt hat. Die App räumt Ticket-Worktrees nie auf. Enthält ein Pfad Glob-Zeichen (`*`, `?`, `[`), greift die Freigabe nicht zuverlässig. ADR 005 gilt nur noch für Sessions vor dieser Entscheidung.
- [x] ADR 005: Statuszeile auf `**Status:** für neue Sessions abgelöst durch [ADR 010](010-worktrees-durch-den-agenten.md) · **Datum:** 2026-09-28` ändern.

**Prüfen**

- [x] `pnpm check` grün (`cargo` aus `%USERPROFILE%\.cargo\bin` im PATH).
- [x] Freigabe am echten Claude belegen. Im Scratchpad zwei Ordner `ws` und `repo-wt-x` anlegen und in `ws` ausführen:

  ```bash
  echo "Lies mit dem Read-Werkzeug <abs>/repo-wt-x/a.txt und schreibe mit dem Write-Werkzeug <abs>/repo-wt-x/b.txt mit Inhalt hallo. Keine Rueckfragen." | claude -p --model haiku --permission-mode acceptEdits --allowedTools "Edit(//c/<pfad>/repo-wt-*/**)" "Read(//c/<pfad>/repo-wt-*/**)"
  ```

  `b.txt` muss entstehen, und die Antwort nennt den Inhalt von `a.txt`. Weicht die Lese-Freigabe ab, gehört das als Finding nach FINDINGS.md.

## Report-Back

Status: **complete** (2026-09-30).

- Umgesetzt wie geplant. `pnpm check` grün, ohne `#[allow(dead_code)]`. `git::worktree_remove_force` und `git::branch_delete_force` entfernt (nur `rollback` benutzte sie); `worktree_add_new` bleibt für `ensure` alter Sessions.
- Freigabe belegt mit Claude Code 2.1.284 (`--model haiku`, `acceptEdits`, Muster `//c/…/permtest/repo-wt-*/**`): `a.txt` im Ticket-Worktree gelesen, `b.txt` dort geschrieben, `d.txt` im Nachbarordner `other` verweigert. Lese-Freigabe verhält sich wie erwartet, kein Finding.
- Abweichung (Chesterton): `SessionRegistry::create_lock` entfernt. Die Sperre hielt das Anlegen nacheinander, damit zwei gleichzeitige Sessions nicht denselben freien Branch-Namen wählen. Ohne Branch hat sie keinen Zweck mehr; die Workspace-Ordner sind je Session-ID eindeutig.
- Zusätzlich: `rule_path` kürzt einen abschließenden `/`, damit ein Repository direkt unter dem Laufwerksstamm (`C:\repo`) kein `//c//repo-wt-*` erzeugt. `db/session_repositories.rs` liest über eine private Zeilen-Struktur `StoredRepository` statt eines Siebener-Tupels.
- Unsicherste Stelle: `worktrees::permission_rules` hängt die Regeln auch für ein `Main`-Repository an, dessen Haupt-Checkout fehlt. Harmlos (die Freigabe zeigt ins Leere), aber nicht gefiltert.
