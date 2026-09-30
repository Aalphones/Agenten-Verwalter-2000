# Phase 2 — Core: neue Session im Vorhaben, Status „Neu“

Rating: standard · Commit-Scope: `sessions`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Neue Session im Vorhaben“ und „Kontrakt“.
- Ergebnis von Phase 1: `Session.project_id`/`number`, `SessionRegistry.projects`, `create_project` (Muster für das Speichern von Session-Zeile + Repositories), `summarize`, `row_of`.
- Code, Core: `src-tauri/src/sessions/model.rs` (`SessionStatus`), `src-tauri/src/sessions/registry.rs` — `SessionState::new`, `SessionState::restored`, `send`, `pause`, `resume`, `cancel`, `restart`, `reap_idle`, `set_status`, `start_process` (startet mit `--session-id`, solange `has_agent_history` falsch ist), `worktrees::ticket_roots`; `src-tauri/src/sessions/mod.rs` (`name_from_task`); `src-tauri/src/db/session_repositories.rs` (`insert_all`).
- Code, Oberfläche (nur damit `pnpm check` grün bleibt): `src/features/sessions/sessionStatus.ts` (`STATUS_LABEL`, `STATUS_GROUP`, `metaLine`), `src/components/StatusIcon.tsx` + `StatusIcon.css`, `src/app/SessionHeader.tsx` (`renderControls`) + `SessionHeader.css` (`session-header__status--*`).
- Entwurf: Tafel `NewSession` in [docs/design/2026-09-30_vorhaben-und-tldr/](../../design/2026-09-30_vorhaben-und-tldr/README.md) — Symbol „Neu“ (gestrichelter Ring).
- Vault-Fehlerklassen: geprüft (TypeScript, React) — keine einschlägig.

## Abnahmekriterien

1. `SessionStatus` hat den Wert `New` (JSON `"new"`). Eine Session in diesem Status hat keinen Prozess, keinen Verlauf, nie `has_agent_history`; nach einem Neustart der App ist sie weiter „Neu“ (nicht „Pausiert“).
2. `session_create_in_project(projectId)` legt eine Session an: Nummer = höchste Nummer im Vorhaben + 1, Name „Session N“, Modell/Denkaufwand/Modus der Session mit der höchsten Nummer, Workspace und Repositories wie diese (Repositories als neue Zeilen in `session_repositories` für die neue Session-ID), Status „Neu“, kein Prozessstart, kein `find_claude`. Gibt es im Vorhaben schon eine Session im Status „Neu“, liefert der Command deren Zusammenfassung und legt nichts an.
3. Die erste Nachricht an eine Session im Status „Neu“ startet den Agenten (neue Claude-Session unter der Session-ID), zeigt die Nachricht im Chat und setzt den Status auf „Läuft“. Heißt die Session in diesem Moment noch „Session N“ (N = ihre Nummer), heißt sie danach `name_from_task(<Nachricht>)`.
4. Pause, Fortsetzen und Neustart tun bei „Neu“ nichts; Abbrechen setzt „Abgebrochen“; Modell, Modus und Denkaufwand lassen sich ändern und gelten für den ersten Start.
5. Die Oberfläche kennt den Status: Beschriftung „Neu“, Gruppe „Läuft“, Meta-Zeile „noch nicht gestartet“, Symbol gestrichelter Ring in `--color-fg-muted`, keine Knöpfe in der Kopfzeile. `pnpm check` grün.

## Checkliste

### Core

- [x] `sessions/model.rs`: Variante `New` am Ende von `SessionStatus` mit Doc-Kommentar „Angelegt, Agent nie gestartet (neue Session in einem Vorhaben).“ `pnpm bindings`.
- [x] `registry.rs`, alle `match`/`matches!` auf `SessionStatus` durchgehen (rund 30 Stellen) und `New` so behandeln wie `Completed`, außer:
  - `send`: kein Sonderfall bei den Ablehnungen; der bestehende Weg startet den Prozess, weil `state.process` leer ist. **Vor** `state.push_user(…)`: `if state.status == SessionStatus::New && state.name == format!("Session {}", session.number) { state.name = name_from_task(text); outbox.summary_dirty = true; }`.
  - `restored`: `New` bleibt `New` (gehört nicht zu `was_active`).
  - `reap_idle`/`idle_since`: `New` zählt nie als ruhend (es gibt keinen Prozess).
- [x] Neue Methode `pub fn create_in_project(&self, project_id: &str) -> Result<SessionSummary, CommandError>`:
  - Sessions des Vorhabens aus der Map kopieren (Map danach freigeben); keine → Fehler `Internal("Vorhaben nicht gefunden: …")` wie in Phase 1.
  - Gibt es eine mit Status `New` (je Session einzeln `lock()`), deren `summarize` zurückgeben.
  - `latest` = Session mit der höchsten `number`; aus `latest.lock()` Modell, Denkaufwand, Modus lesen und die Sperre freigeben.
  - `number = latest.number + 1`, `id = uuid::Uuid::new_v4().to_string()`, `name = format!("Session {number}")`; `state = SessionState::new(name, model, effort, mode)`, danach `state.status = SessionStatus::New` und `state.ticket_roots = worktrees::ticket_roots(&latest.repositories)`.
  - `Session { id, project_id, number, workspace: latest.workspace.clone(), repositories: latest.repositories.clone(), database, state }`.
  - Speichern in **einem** `database.with`: `session_rows::upsert(row_of(…))`, `session_repositories::insert_all(connection, &id, &session.repositories)`. Fehler → `session_rows::delete` (entfernt per `ON DELETE CASCADE` auch die Repository-Zeilen), Fehler zurückgeben. Der Workspace-Ordner gehört dem Vorhaben und wird **nie** gelöscht.
  - In die Sessions-Map eintragen, `summarize` zurückgeben. Kein Ereignis (die Oberfläche übernimmt die Rückgabe wie bei `project_create`).
- [x] `commands/sessions.rs`: `session_create_in_project(registry, project_id: String) -> Result<SessionSummary, CommandError>`; in `lib.rs` registrieren.

### Oberfläche (nur Status-Anbindung)

- [x] `src/lib/sessions.ts`: `createSessionInProject(projectId: string): Promise<SessionSummary>` mit JSDoc („Legt im Vorhaben eine Session im Status „Neu“ an, ohne Agent; gibt es schon eine, kommt diese zurück.“, `@throws` `internal`, `database`).
- [x] `sessionStatus.ts`: `STATUS_LABEL.new = 'Neu'`, `STATUS_GROUP.new = 'running'`, `metaLine` Fall `'new'` → `'noch nicht gestartet'`.
- [x] `StatusIcon.tsx`: Fall `'new'` → `<circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.6" />`; `StatusIcon.css`: `.status-icon--new { color: var(--color-fg-muted); }` nach dem Muster der übrigen `status-icon--*`-Regeln.
- [x] `SessionHeader.tsx` `renderControls`: `case 'new':` zu den Fällen mit `return null`; `SessionHeader.css`: `session-header__status--new` mit `color: var(--color-fg-muted)` nach dem Muster der übrigen Status-Klassen.

### Doku

- [x] `docs/glossary.md` „Session-Status“: acht Werte, `new` = „Neu (Session im Vorhaben angelegt, Agent nie gestartet; startet mit der ersten Nachricht)“; nach einem Neustart bleibt „Neu“ „Neu“.
- [x] `docs/code-map.md` Zeile „Sessions“: `create_in_project` erwähnen.
- [x] ADR 011 Abschnitt „Entscheidung“: Satz zum Status „Neu“ und zur Regel „höchstens eine nicht gestartete Session je Vorhaben“ ergänzen, falls in Phase 1 noch nicht enthalten.
- [x] README dieses Plans: Phase 2 auf `complete`.

## Report-Back
