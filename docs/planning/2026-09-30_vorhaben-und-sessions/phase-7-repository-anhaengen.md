# Phase 7 — Repository nachträglich an ein Vorhaben hängen

Rating: heikel · Commit-Scope: `projects` · **Reihenfolge: direkt nach Phase 4, vor Phase 5** (die Nummer 7 bleibt, damit die Verweise auf Phase 5 und 6 in diesem Plan gültig bleiben).

Ausgangslage: Der Reiter „Changes“ und der Diff erscheinen nur, wenn beim Anlegen ein Repository gewählt wurde (`repositoryCount > 0`). Wer ohne Repository startet, aber den Agenten in einem Repository arbeiten lässt, sieht nie einen Diff. Diese Phase lässt sich ein Repository **an das ganze Vorhaben** hängen: alle seine Sessions bekommen es, die Changes zeigen es, der Agent bekommt es beim nächsten Start.

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Datenmodell“ (Sessions teilen Repositories samt Basis), „Sperren im Core“, „Kontrakt“.
- Ergebnis von Phase 1 bis 4: `ProjectState` und `lock_projects()`, `project_summary`, `useProjectSummaries`, `ProjectOverview` (Repository-Zeile), `ProjectHeader`, `create_in_project` (kopiert Repositories der neuesten Session).
- [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md) (Haupt-Checkout), [ADR 006](../../decisions/006-changes-und-diff.md) (Changes lesen nur ohne Index-Sperre).
- [docs/conventions/rust.md](../../conventions/rust.md), [typescript.md](../../conventions/typescript.md), [react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md).
- Code, Core: `src-tauri/src/sessions/registry.rs` — `Session` (Feld `repositories`), alle Stellen, die `session.repositories` lesen (`restore`, `create_project`, `create_in_project`, `archive_project`, `repositories_of`, `summarize`, `start_process`), `reap_idle` (Block, der einen ruhenden Prozess beendet), `update`, `Outbox`, `SessionState.ticket_roots`; `src-tauri/src/worktrees/mod.rs` (`main_checkouts`, `read_base`, `ticket_roots`, `SessionRepository`, `RepositoryCheckout::Main`); `src-tauri/src/db/session_repositories.rs` (`insert_all`, `load`), `src-tauri/src/db/repositories.rs` (`get_many`, `RepositoryRow`); `src-tauri/src/git/mod.rs` (`head_commit`, `head_branch`, `run`, `args`); `src-tauri/src/commands/projects.rs`, `src-tauri/src/lib.rs`, `gen-bindings.rs`.
- Code, Oberfläche: `src/features/projects/ProjectOverview.tsx` + `.css` (Repository-Zeile mit Chips), `src/features/repositories/RepositoryPicker.tsx` (Muster für Dialog und Fehlertext: `open({ directory: true … })`, `describeAddError`), `useKnownRepositories.ts`, `src/components/Popover.tsx`, `src/lib/projects.ts`, `src/features/projects/useProjectSummaries.ts`, `src/lib/errors.ts`.
- Vault-Fehlerklassen: geprüft (Rust, SQLite, React, TypeScript) — keine einschlägig.

## Festgelegte Entscheidungen

- **Ebene: Vorhaben.** Das Repository geht an **jede** Session des Vorhabens (auch archivierte sind nicht im Speicher und bleiben unberührt), als neue Zeile in `session_repositories` mit derselben `position`, `base_ref`, `base_commit`. Neue Sessions erben es über `create_in_project` ohne Zusatz.
- **Checkout-Art immer `Main`** (Haupt-Checkout, ADR 010), auch in Vorhaben mit Sessions aus der Zeit der App-Worktrees.
- **Basis = letzter Commit auf dem ersten-Eltern-Pfad von HEAD vor dem Anlegen des Vorhabens.** Grund: Der Diff soll zeigen, was seit Beginn des Vorhabens passiert ist, nicht erst seit dem Anhängen. Git-Befehl: `git rev-list -1 --first-parent --before=<Sekunden seit 1970> HEAD` (geprüft: Unix-Sekunden werden akzeptiert; liegt der Zeitpunkt vor dem ersten Commit, ist die Ausgabe leer → Rückfall auf HEAD). `base_ref` = ausgecheckter Branch, bei losgelöstem HEAD die Commit-ID (wie `read_base`). Grenze: Uncommitted Änderungen, die schon vor dem Start des Vorhabens im Arbeitsordner lagen, erscheinen als Änderungen des Vorhabens; das steht im Tooltip.
- **Laufende Agenten werden nie unterbrochen.** Ein Agent im Status Starting/Running/Waiting (oder mit laufendem Hintergrundprozess) kennt das Repository erst nach seinem nächsten Start. Ein ruhender Agent (Prozess lebt, nichts läuft) wird beendet wie in `reap_idle`; die nächste Nachricht startet ihn mit `--resume` und dem neuen `--add-dir`.
- **Kein Entfernen.** Ein einmal angehängtes Repository bleibt (Entfernen wäre eine eigene Entscheidung: Positionen der Ticket-Worktrees hängen daran). Wer sich vertan hat, archiviert das Vorhaben.
- **Design:** Für dieses Bedienelement gibt es keinen Entwurf. Freihändig nach Konzept, so klein wie möglich: ein gestrichelter „+ Repository“-Chip in der Repository-Zeile der Übersicht, darunter ein Menü (siehe AK 5). Wer einen Entwurf will, sagt es vor der Umsetzung.

## Kontrakt

```rust
// Command (src-tauri/src/commands/projects.rs), registriert in lib.rs
project_add_repository(project_id: String, repository_id: String) -> Result<ProjectSummary, CommandError>
```

```ts
// src/lib/projects.ts
export function addRepositoryToProject(projectId: string, repositoryId: string): Promise<ProjectSummary>;
```

- `repository_id` ist die ID aus `KnownRepository` (Liste der bekannten Repositories).
- Erfolg: Rückgabe ist das aktualisierte `ProjectSummary` (neues `repositoryNames`); zusätzlich `project://changed` mit demselben Wert und `session://changed` je Session des Vorhabens (neues `repositoryCount`).
- Fehler (alle `CommandError::Internal` bzw. `RepositoryMissing`): Vorhaben unbekannt → `Vorhaben nicht gefunden: <id>`; Repository-ID unbekannt → Fehler aus `repository_rows::get_many`; Haupt-Checkout ohne `.git` → `RepositoryMissing`; Repository schon im Vorhaben (Pfadvergleich ohne Beachtung von Groß-/Kleinschreibung, `/` und `\` gleich, ohne abschließenden Trenner) → `„<Name>“ gehört schon zu diesem Vorhaben.`

## Abnahmekriterien

1. `project_add_repository` hängt das Repository an alle Sessions des Vorhabens: Zeile in `session_repositories` je Session (gleiche Position und Basis), im Speicher `Session.repositories` um einen Eintrag länger, `repositoryCount` um 1 höher. Nach einem Neustart der App ist es weiter da.
2. Die Basis ist der letzte Commit vor dem Anlegen des Vorhabens (Rückfall HEAD); die Changes des Vorhabens zeigen danach alle Commits und Änderungen seit diesem Punkt.
3. Ein Vorhaben ohne Repository bekommt durch das Anhängen den Reiter „Changes“ (in `ProjectHeader` und `SessionHeader`) ohne Neustart der App; die Changes laden von selbst.
4. Ein ruhender Agent des Vorhabens hat nach dem Anhängen keinen Prozess mehr; die nächste Nachricht startet ihn und sein Arbeitsordner-Zugriff umfasst das neue Repository (`--add-dir`). Ein laufender Agent läuft ungestört weiter.
5. **Oberfläche:** In der Repository-Zeile der Übersicht steht nach den Chips ein Knopf „+ Repository“ (22 px hoch, Innenabstand `0 8px`, Radius 5 px, Rahmen `1px dashed var(--color-border-subtle)`, `--color-fg-muted`, 12 px; bei „Keine Repositories“ steht er direkt dahinter). Klick öffnet ein `Popover` (`placement="below"`, `align="start"`, Breite 320) mit: Überschrift „Repository hinzufügen“ (12 px, 600); Liste der bekannten Repositories, die noch nicht im Vorhaben sind (Name 13 px, darunter der Pfad 11.5 px `--color-fg-muted`; ein Klick hängt es an und schließt das Menü; Einträge mit `isMissing` sind deaktiviert und tragen „nicht gefunden“); leere Liste → Text „Alle bekannten Repositories gehören schon zum Vorhaben.“; darunter ein Knopf „Anderes Repository wählen …“ (öffnet den Ordnerdialog, nimmt das Repository in die Liste der bekannten auf und hängt es an). Fehler stehen als Satz in `--color-status-error` mit `role="alert"` im Menü.
6. **Erklärung:** Der Knopf trägt `title` „Hängt ein Repository an das ganze Vorhaben: Changes und Skills gelten für alle Sessions, der Agent bekommt es beim nächsten Start. Die Änderungen zählen ab dem Anlegen des Vorhabens; was vorher schon unbestätigt im Ordner lag, erscheint mit.“ Läuft in diesem Moment eine Session des Vorhabens (Status `starting`, `running`, `waiting`), steht nach dem Anhängen bis zum Schließen des Menüs der Satz „Der laufende Agent kennt das Repository erst nach seinem nächsten Start.“
7. `pnpm check` grün; ADR 011, Code-Map, Glossar beschreiben den Stand.

## Checkliste

### Git

- [ ] `src-tauri/src/git/mod.rs`: neue Funktion `pub fn commit_before(repository: &Path, before_seconds: i64) -> Result<Option<String>, CommandError>` nach dem Muster von `head_commit`: `run(repository, &args(&["rev-list", "-1", "--first-parent", &format!("--before={before_seconds}"), "HEAD"]))`, Ausgabe getrimmt, leer → `Ok(None)`. Kommentar: lesend, ohne Index-Sperre. Code-Map-Zeile „Git-Aufrufe“: `rev-list` ist dort schon aufgeführt, nichts zu ändern.

### Worktrees

- [ ] `src-tauri/src/worktrees/mod.rs`: neue Funktion `pub fn main_checkout_since(row: &RepositoryRow, since_ms: f64) -> Result<SessionRepository, CommandError>` nach dem Muster eines Elements aus `main_checkouts`: `.git`-Prüfung mit `RepositoryMissing`; `base_commit` = `git::commit_before(path, (since_ms / 1000.0) as i64)?` oder, bei `None`, `git::head_commit(path)`; `base_ref` = `git::head_branch(path)?` oder die Commit-ID wie `read_base`; `checkout: RepositoryCheckout::Main`; Fehler mit `prefixed(&row.name, …)`. Clippy-Hinweis zum `as`-Cast: `#[allow(clippy::cast_possible_truncation)]` mit einem Halbsatz Begründung (Millisekunden seit 1970 passen in `i64`), nur falls Clippy meckert.
- [ ] Neue Funktion `pub fn same_repository(first: &Path, second: &Path) -> bool` (öffentlicher Zugang zu `same_dir`; `same_dir` bleibt privat, die neue ruft sie).

### Datenbank

- [ ] `src-tauri/src/db/session_repositories.rs`: neue Funktion `pub fn append(connection: &mut Connection, session_ids: &[String], position: u32, repository: &SessionRepository) -> Result<(), CommandError>`: **eine** Transaktion, je Session-ID ein `INSERT` mit demselben SQL und derselben Spalten-Abbildung wie in `insert_all` (den `match` auf `repository.checkout` in eine kleine Hilfsfunktion `checkout_columns(&RepositoryCheckout) -> (&str, &str, &str)` ziehen, die `insert_all` und `append` beide nutzen).

### Registry (`src-tauri/src/sessions/registry.rs`)

- [ ] `Session.repositories` wird `RwLock<Vec<SessionRepository>>` (Doc-Kommentar: „Wächst nur durch `add_repository`; die Sperre ist ein Blatt — nie zusammen mit der Sessions-Map, der Vorhaben-Sperre oder der Session-Sperre über einen Aufruf hinweg halten, nur kurz lesen oder schreiben.“). Zugriff über zwei Methoden an `Session`: `fn repositories(&self) -> Vec<SessionRepository>` (Kopie; Sperre vergiftet → `into_inner` wie bei den anderen Sperren im Modul, siehe `lock_sessions`) und `fn push_repository(&self, repository: SessionRepository)`. **Alle** bisherigen Stellen auf `repositories()` umstellen (Liste im Kontext oben); `summarize` zählt `repositories().len()`.
- [ ] Hilfsfunktion `fn retire_idle_process(state: &mut SessionState, outbox: &mut Outbox)` aus dem Block in `reap_idle` herausziehen (`generation += 1; outbox.retire(state); state.process = None; state.interrupt_background(outbox); state.idle_since = None;`); `reap_idle` ruft sie auf, Verhalten unverändert.
- [ ] Neue Methode `pub fn add_repository(&self, app: &AppHandle, project_id: &str, repository_id: &str) -> Result<ProjectSummary, CommandError>`:
  1. `lock_projects()` nehmen und **bis Schritt 4 halten** (serialisiert zwei gleichzeitige Aufrufe; Schritt 1 bis 4 nehmen keine Session-Sperre). `created_at` aus `ProjectState`; unbekannt → Fehler `Vorhaben nicht gefunden: …`.
  2. Sessions des Vorhabens aus `lock_sessions()` als `Vec<Arc<Session>>` kopieren (Map danach freigeben); leer → derselbe Fehler. `RepositoryRow` per `repository_rows::get_many(connection, &[repository_id.to_owned()])` lesen. Bereits enthalten? `worktrees::same_repository` gegen `repositories()` der ersten Session → Fehler „„<Name>“ gehört schon zu diesem Vorhaben.“ `repository = worktrees::main_checkout_since(&row, created_at)?`; `position = u32::try_from(erste_session.repositories().len())`.
  3. `self.database.with(|connection| session_repositories::append(connection, &ids, position, &repository))?` — erst die Datenbank, dann der Speicher.
  4. Je Session `session.push_repository(repository.clone())`. Vorhaben-Sperre freigeben.
  5. Je Session einzeln `update(app, &session, |state, outbox| { state.ticket_roots = worktrees::ticket_roots(&session.repositories()); state.summary_dirty …; wenn Status nicht Starting/Running/Waiting und `state.process.is_some()` und `!state.has_running_background()` → `retire_idle_process(state, outbox)`; Ok(()) })`. `summary_dirty` so setzen, wie andere Stellen es tun, damit `session://changed` mit dem neuen `repositoryCount` hinausgeht (Fundstelle: `outbox.summary_dirty = true` in `send`-Nachbarschaft).
  6. `summary = self.project_summary(project_id)?`; `app.emit(PROJECT_CHANGED_EVENT, &summary)` (Sendefehler ignorieren); Rückgabe `summary`.
- [ ] `commands/projects.rs`: `project_add_repository` (dünn auf `add_repository`, `async` wie die übrigen); `lib.rs` eintragen. `pnpm bindings` ist nicht nötig (kein neuer Typ) — trotzdem laufen lassen und prüfen, dass `git status` keine Änderung an `src/lib/bindings/` zeigt.

### Oberfläche

- [ ] `src/lib/projects.ts`: `addRepositoryToProject(projectId, repositoryId)` nach dem Muster der übrigen Wrapper (JSDoc mit `@throws`).
- [ ] Neue Datei `src/features/projects/AddRepositoryMenu.tsx` + `.css` (Block `add-repository-menu`): Props `project: ProjectSummary`, `hasRunningSession: boolean`, `onAdded(summary: ProjectSummary)`. Enthält den Auslöser-Knopf (mit `position: relative`-Hülle, damit `Popover` daran hängt), das `Popover` nach AK 5 und die Hinweiszeile nach AK 6. Liste aus `useKnownRepositories()`, „schon im Vorhaben“ = Name in `project.repositoryNames` **und** gleicher Pfad ist im Frontend nicht prüfbar — deshalb nur nach **Name** ausblenden und den Core bei einem gleichnamigen, aber anderen Repository das eigentliche Urteil fällen lassen. Dialog und Fehlertext: `describeAddError` und den `open({ directory: true … })`-Aufruf aus `RepositoryPicker.tsx` **nicht kopieren**, sondern `describeAddError` dort exportieren und hier importieren.
- [ ] `ProjectOverview.tsx`: in der Repository-Zeile nach den Chips `AddRepositoryMenu` einbauen; `hasRunningSession` aus den `sessions`-Props ableiten; `onAdded` ruft `upsertProject` aus `useProjectSummaries` (kommt über ein neues Prop `onProjectChanged(summary)` von `App.tsx`; die Events `project://changed` und `session://changed` aktualisieren ohnehin die Zustände, der Rückgabewert ist nur schneller).
- [ ] Prüfen, dass `SessionHeader.tsx` und `ProjectHeader.tsx` den Reiter „Changes“ aus `repositoryCount` ableiten und ohne weiteres Zutun erscheinen; `useSessionChanges` lädt, sobald `sessionId` nicht mehr `null` ist (kein Code nötig, falls so; sonst dort beheben).

### Doku

- [ ] `docs/decisions/011-vorhaben-und-sessions.md`: Abschnitt „Repository nachträglich anhängen“ (Kontext: Session ohne Repository hat keinen Diff; Optionen: nur beim Anlegen wählen / pro Session anhängen / pro Vorhaben anhängen; Entscheidung: pro Vorhaben, Basis = Commit vor dem Anlegen, laufende Agenten nie unterbrechen, kein Entfernen; Konsequenzen: `Session.repositories` ist hinter einer `RwLock` veränderlich, uncommittete Vorarbeit erscheint als Änderung).
- [ ] `docs/glossary.md`: Eintrag **Repository anhängen**: „Nimmt ein bekanntes Repository nachträglich in ein Vorhaben auf; gilt für alle seine Sessions. Die Basis der Changes ist der letzte Commit vor dem Anlegen des Vorhabens.“
- [ ] `docs/code-map.md`: Zeile „Vorhaben“ um `AddRepositoryMenu`, `project_add_repository`, `Session.repositories` (RwLock), `worktrees::main_checkout_since`, `git::commit_before` ergänzen; Zeile „Persistenz“: `session_repositories::append`.
- [ ] README dieses Plans: Phase 7 auf `complete`.

## Report-Back
