# Phase 1 — Core: Vorhaben als Datenmodell

Rating: heikel · Commit-Scope: `projects`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Festgelegte Entscheidungen“ (Begriffe, Datenmodell) und „Kontrakt“ (Datenbank, Typen, Commands, Ereignisse).
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (Migrationen, Wiederherstellung), [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md) (Haupt-Checkout, Ticket-Worktrees, App-Worktrees alter Sessions).
- [docs/conventions/rust.md](../../conventions/rust.md), [typescript.md](../../conventions/typescript.md), [react.md](../../conventions/react.md).
- Code, Core: `src-tauri/src/db/migrations.rs` + `migrations/004_main_checkout.sql` (Form einer Migration), `src-tauri/src/db/sessions.rs` (`SessionRow`, `StoredRow`, `upsert`, `load_active`, `archive`, `delete`), `src-tauri/src/db/session_repositories.rs`, `src-tauri/src/db/mod.rs` (`Database::with`), `src-tauri/src/sessions/model.rs` (`SessionSummary`), `src-tauri/src/sessions/mod.rs` (`name_from_task`, `MAX_NAME_CHARS`), `src-tauri/src/sessions/registry.rs` — dort `SessionRegistry` (Felder, `restore`, `create`, `discard_created`, `list`, `rename`, `archive`, `repositories_of`, `ticket_worktrees_of`), `Session` (Felder), `row_of`, `summarize`, `schedule_worktree_cleanup`, `now_ms`; `src-tauri/src/commands/sessions.rs`, `src-tauri/src/commands/changes.rs`, `src-tauri/src/lib.rs` (Registrierung), `src-tauri/src/filesystem/workspace.rs` (`new_session_workspace`), `gen-bindings.rs`.
- Code, Oberfläche (nur der Übergang, siehe Checkliste): `src/lib/sessions.ts` (`createSession`, `archiveSession`), `src/features/sessions/NewSession.tsx` (Aufruf von `createSession`, `onCreated`), `src/app/Sidebar.tsx` (`archive`), `src/app/App.tsx` (`handleCreated`, `removeSession`).
- Vault-Fehlerklassen: geprüft (SQLite, TypeScript, React) — keine einschlägig.

## Abnahmekriterien

1. Eine bestehende Datenbank auf dem bisherigen Stand wird beim Start ohne Datenverlust umgestellt: je Session ein Vorhaben gleicher ID, gleichen Namens, gleicher Anlagezeit, gleichen Archiv-Stands; jede Session hat `project_id = id`, `number = 1`. Eine frische Datenbank durchläuft alle Migrationen.
2. `project_list` liefert alle nicht archivierten Vorhaben, neueste zuerst, mit den Repository-Namen; `session_list` liefert jede Session mit `projectId` und `number`.
3. `project_create` legt Vorhaben und Session `#1` an (beide Namen aus dem ersten Satz der Aufgabe), startet den Agenten und schickt die Aufgabe — Verhalten wie bisher `session_create`. Scheitert ein Schritt, bleibt weder Vorhaben- noch Session-Zeile noch Workspace-Ordner zurück.
4. `project_rename` ändert nur den Vorhaben-Namen (höchstens 60 Zeichen, getrimmt, leer → Fehler `internal` mit „Der Name darf nicht leer sein.“) und sendet `project://changed`; `session_rename` ändert weiter nur die Session.
5. `project_archive` bricht jede Session des Vorhabens ab, setzt `archived_at` auf Vorhaben und allen seinen Sessions, nimmt alles aus dem Speicher und plant das Aufräumen der App-Worktrees genau einmal. Nach einem Neustart ist nichts davon wieder da.
6. `changes_load` und `changes_file_diff` sehen die Ticket-Worktrees **aller** Sessions des Vorhabens der übergebenen Session.
7. Die Oberfläche funktioniert unverändert weiter: „Neue Session“ legt über `project_create` an, „Archivieren“ im Menü einer Session archiviert ihr Vorhaben.
8. ADR 011 existiert; `pnpm check` grün.

## Checkliste

### Datenbank

- [x] Neue Datei `src-tauri/src/db/migrations/<NNN>_projects.sql` — `<NNN>` = nächste freie Nummer in diesem Ordner, dreistellig — mit genau dem SQL aus README → „Kontrakt / Datenbank“. `migrations.rs`: Array-Länge um eins erhöhen, Zeile `include_str!("migrations/<NNN>_projects.sql")` hinten anhängen.
- [x] Neue Datei `src-tauri/src/db/projects.rs` (Kopfkommentar wie in `db/sessions.rs`): `pub struct ProjectRow { pub id: String, pub name: String, pub created_at: f64 }`; `pub fn insert(connection: &Connection, row: &ProjectRow)` (`INSERT INTO projects (id, name, created_at) VALUES (?1, ?2, ?3)`); `pub fn load_active(connection: &Connection) -> Result<Vec<ProjectRow>, CommandError>` (`WHERE archived_at IS NULL ORDER BY created_at DESC`); `pub fn rename(connection, id, name)`; `pub fn archive(connection: &mut Connection, id: &str, archived_at: f64)` — **eine Transaktion** mit `UPDATE projects SET archived_at = ?2 WHERE id = ?1` und `UPDATE sessions SET archived_at = ?2 WHERE project_id = ?1`; `pub fn delete(connection, id)` (`DELETE FROM projects WHERE id = ?1`). Modul in `db/mod.rs` eintragen. Die TL;DR-Spalten liest und schreibt diese Datei nicht (kommt in Phase 5).
- [x] `src-tauri/src/db/sessions.rs`: `SessionRow` und `StoredRow` bekommen `project_id: String` und `number: u32`. `load_active` liest `COALESCE(project_id, id)` und `number`; `upsert` schreibt beide beim `INSERT`, der `ON CONFLICT … DO UPDATE` ändert sie **nicht** (sie sind nach dem Anlegen fest). Die TL;DR-Spalten bleiben unberührt. `archive` (Einzel-Session) entfällt, falls danach unbenutzt (Clippy meldet toten Code).

### Typen

- [x] Neues Modul `src-tauri/src/projects/` mit `mod.rs` (`pub mod model;`) und `model.rs`: `ProjectSummary`, `ProjectCreated` genau wie im Kontrakt. Modul in `lib.rs` eintragen.
- [x] `src-tauri/src/sessions/model.rs`: `SessionSummary` bekommt `pub project_id: String` und `pub number: u32` (hinter `repository_count`).
- [x] `gen-bindings.rs`: `ProjectSummary` und `ProjectCreated` exportieren; `pnpm bindings`.

### Registry (`src-tauri/src/sessions/registry.rs`)

- [x] Neue Struktur `struct ProjectState { name: String, created_at: f64 }`; `SessionRegistry` bekommt das Feld `projects: Mutex<HashMap<String, ProjectState>>` (Schlüssel = Vorhaben-ID) samt Hilfsfunktion `lock_projects()` nach dem Muster von `lock_sessions()`. Regel aus README „Sperren im Core“: nie Vorhaben-Sperre und Session-Sperre gleichzeitig halten — `lock_sessions()` (die Map der Sessions) darf zusammen mit `lock_projects()` genommen werden, **nicht** `Session::lock()`.
- [x] `Session` bekommt die unveränderlichen Felder `project_id: String` und `number: u32`. `row_of` und `summarize` füllen die neuen Felder aus `SessionRow`/`SessionSummary`.
- [x] `restore`: zusätzlich `projects::load_active` lesen und je Zeile einen `ProjectState` eintragen. Hat eine geladene Session eine `project_id` ohne geladenes Vorhaben, entsteht im Speicher ein `ProjectState` mit Name und Anlagezeit der Session (keine Datenbank-Änderung). `Session` bekommt `project_id` und `number` aus der Zeile.
- [x] `create` wird zu `pub fn create_project(&self, app: &AppHandle, request: NewSession<'_>) -> Result<ProjectCreated, CommandError>`:
  - zwei neue UUIDs: `project_id` und `id` (Session); `name = name_from_task(task)` für beide; `workspace = new_session_workspace(app, &project_id)`.
  - Im selben `database.with`-Aufruf, in dieser Reihenfolge: `projects::insert` (`ProjectRow { id: project_id, name, created_at: state.created_at }`), `session_rows::upsert`, `session_repositories::insert_all`. Die Session-Zeile trägt `project_id` und `number = 1`.
  - `discard_created` bekommt die Vorhaben-ID dazu und löscht nach der Session-Zeile auch die Vorhaben-Zeile (`projects::delete`), dann den Workspace-Ordner — in beiden Fehlerpfaden von `create_project`.
  - Nach Erfolg: `ProjectState` in `projects` eintragen, Rückgabe `ProjectCreated { project: self.project_summary(&project_id)?, session }`.
  - `NewSession` behält seine Felder.
- [x] `pub fn project_summary(&self, project_id: &str) -> Result<ProjectSummary, CommandError>`: Name und Anlagezeit aus `projects`; `repository_names` = `name` der `repositories` der Session dieses Vorhabens mit der kleinsten `number` (Sessions-Map nach `project_id` filtern; `repositories` ist ohne Session-Sperre lesbar); unbekanntes Vorhaben → `CommandError::Internal(format!("Vorhaben nicht gefunden: {project_id}"))`.
- [x] `pub fn list_projects(&self) -> Vec<ProjectSummary>`: alle Vorhaben, `created_at` absteigend (Muster `list`).
- [x] `pub fn rename_project(&self, app: &AppHandle, project_id: &str, name: &str) -> Result<(), CommandError>`: Name wie in `rename` kürzen und prüfen; `projects::rename` in der Datenbank; `ProjectState.name` setzen; danach `app.emit("project://changed", self.project_summary(project_id)?)` (Konstante `PROJECT_CHANGED_EVENT` neben `SESSION_CHANGED_EVENT`); ein Sendefehler wird ignoriert wie bei den übrigen Ereignissen ohne Session-Protokoll.
- [x] `archive` wird zu `pub fn archive_project(&self, app: &AppHandle, project_id: &str) -> Result<(), CommandError>`: IDs aller Sessions des Vorhabens sammeln; für jede `self.cancel(app, &id)?`; `projects::archive(connection, project_id, now_ms())`; alle diese Sessions aus der Sessions-Map und das Vorhaben aus `projects` nehmen; `schedule_worktree_cleanup` **einmal** mit Workspace und Repositories der ersten dieser Sessions (alle teilen beides), nur wenn sie Repositories hat. Unbekanntes Vorhaben ohne Sessions → Fehler wie in `project_summary`.
- [x] `ticket_worktrees_of` wird ersetzt durch `pub fn project_ticket_worktrees(&self, session_id: &str) -> Result<Vec<(u32, String)>, CommandError>`: `project_id` der Session bestimmen; alle `Arc<Session>` mit dieser `project_id` aus der Map kopieren und die Map freigeben; dann je Session **einzeln** `lock()` und `ticket_worktrees` anhängen; Doppelte (gleiche Position, Ordnername ohne Beachtung der Groß-/Kleinschreibung) nur einmal, Reihenfolge des ersten Auftretens.

### Commands

- [x] Neue Datei `src-tauri/src/commands/projects.rs` (Kommentar „Die Commands sind `async` …“ wie in `commands/sessions.rs`): `project_list`, `project_create` (Parameter und `#[allow(clippy::too_many_arguments)]` wie bisher `session_create`), `project_rename`, `project_archive` — jeweils dünn auf die Registry-Methoden. Modul in `commands/mod.rs`.
- [x] `commands/sessions.rs`: `session_create` und `session_archive` entfernen.
- [x] `commands/changes.rs`: beide Aufrufe von `ticket_worktrees_of` durch `project_ticket_worktrees` ersetzen; die Meldung „Dieser Worktree gehört nicht zur Session.“ wird „Dieser Worktree gehört nicht zum Vorhaben.“
- [x] `lib.rs`: `session_create`, `session_archive` austragen; die vier `project_*`-Commands eintragen.

### Übergang in der Oberfläche (damit die App zwischen Phase 1 und 3 funktioniert)

- [x] Neue Datei `src/lib/projects.ts` nach dem Muster von `src/lib/sessions.ts`: `listProjects()`, `createProject(task, attachmentIds, repositoryIds, model, effort, mode): Promise<ProjectCreated>`, `renameProject(projectId, name)`, `archiveProject(projectId)`, `onProjectChanged(callback)` (`project://changed`, Nutzlast `ProjectSummary`) — JSDoc mit `@throws` wie dort (`createProject` übernimmt den Text von `createSession`).
- [x] `src/lib/sessions.ts`: `createSession` und `archiveSession` entfernen.
- [x] `NewSession.tsx`: ruft `createProject(…)` und reicht `created.session` an `onCreated` weiter (Signatur von `onCreated` bleibt `(summary: SessionSummary) => void`).
- [x] `Sidebar.tsx` `archive(sessionId)`: sucht die Session in `sessions`, ruft `archiveProject(session.projectId)` und danach `onArchived` für **jede** Session mit derselben `projectId`.

### Doku

- [x] `docs/decisions/011-vorhaben-und-sessions.md` im Format von ADR 010 (Status angenommen, Datum des Commits): Kontext (Plan mit mehreren Phasen, frischer Kontext je Phase statt `/clear`), Optionen (a) Session bleibt Einheit, Agent-Wechsel innerhalb; (b) neue äußere Ebene „Vorhaben“, Session bleibt Claude-Session; (c) äußere Ebene heißt weiter Session, innere neu — Entscheidung (b) mit den Punkten aus README „Begriffe und Namen“, „Datenmodell“, „Neue Session im Vorhaben“; Konsequenzen: gemeinsamer Workspace und Haupt-Checkout, freie Fortsetzbarkeit ohne Sperre, Archivieren nur je Vorhaben, `project` im Code / „Vorhaben“ in der Oberfläche. Abschnitt „TL;DR“ mit dem Satz „Kommt mit Phase 5 dieses Plans.“
- [x] `docs/glossary.md`: neuer Eintrag **Vorhaben** (vor „Session“): „Eine Aufgabe (z. B. „Plan XYZ umsetzen“) mit ihren Repositories, ihrem Workspace und ihren Sessions. Die zentrale Einheit der App. Im Code `project`.“ **Session** neu: „Eine Claude-Session innerhalb eines Vorhabens, mit eigenem Agenten, Chat, Kontext und Events; im Vorhaben durchnummeriert (#1, #2 …). Ihre ID ist die Session-ID der Claude-Kommandozeile.“ **Workspace**: „… Arbeitsordner eines Vorhabens; alle seine Sessions teilen ihn …“. **RepositoryWorkspace**, **Archivieren**, **Changes-Ansicht**, **Ticket-Worktree**: „Session“ durch „Vorhaben“ ersetzen, wo die Aussage jetzt für das Vorhaben gilt (Archivieren: nur ganze Vorhaben; Ticket-Worktree: gehört zum Vorhaben, sobald eine seiner Sessions ihn benutzt hat).
- [x] `docs/code-map.md`: neue Zeile „Vorhaben (Anlegen, Umbenennen, Archivieren)“ — Oberfläche `src/lib/projects.ts` (Rest folgt in Phase 3/4), Core `src-tauri/src/projects/` (`model.rs`), `src-tauri/src/commands/projects.rs`, `src-tauri/src/db/projects.rs`, `ProjectState` in `sessions/registry.rs`; Features-Liste im Namensschema um `projects` ergänzen; Zeile „Persistenz“ um die neue Migration ergänzen; Zeile „Changes“: Ticket-Worktrees aller Sessions des Vorhabens (`project_ticket_worktrees`).
- [x] `docs/conventions/commits.md`: Scope `projects` ergänzen.
- [x] README dieses Plans: Phase 1 auf `complete`.

## Report-Back

Status: complete. Migration 005 gegen eine Kopie der echten Datenbank geprüft (21 Sessions, davon 20 archiviert): 21 Vorhaben mit gleicher ID, gleichem Namen, gleicher Anlagezeit und gleichem Archiv-Stand, jede Session `project_id = id`, `number = 1`, keine verletzten Fremdschlüssel. `pnpm check` grün.

Abweichungen vom Plan:

- Das Kürzen und Prüfen des Namens steht als `trimmed_name` einmal in `registry.rs` und wird von `rename` und `rename_project` benutzt.
- `project_ticket_worktrees` und `archive_project` gehen die Sessions des Vorhabens nach `number` sortiert durch, damit die Reihenfolge der Ticket-Worktrees nicht von der Reihenfolge der HashMap abhängt.
- `session_rows::archive` ist entfallen (unbenutzt).
