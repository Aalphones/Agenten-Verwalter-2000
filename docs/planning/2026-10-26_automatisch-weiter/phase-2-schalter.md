# Phase 2 — Schalter „Automatisch weiter“ je Vorhaben

Rating: standard · Modell: Sonnet · Commit: `feat(projects): Schalter „Automatisch weiter“ je Vorhaben`

Diese Phase speichert und zeigt nur den Schalter. Gestartet wird noch nichts — das baut Phase 3.

## Kontext

Lesen: [README](README.md) (Entscheidungen, Kontrakt), [Entwurf](artifacts/entwurf-automatisch-weiter.html) Zustände 1 und 4, [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Vorhaben“, „Persistenz“, „Chat“), [docs/conventions/](../../conventions/). Fehlerklassen: keine einschlägig (README).

Bestand (gelesen 2026-10-26, per Grep neu finden):

- Migrationen: `src-tauri/src/db/migrations.rs` (Liste `include_str!`, letzte `013_name_auto.sql`, die auch `projects` erweitert — Muster).
- `src-tauri/src/db/projects.rs`: `ProjectRow`, `load_active` und `load_one` (`SELECT id, name, created_at, tldr, tldr_at, tldr_sources, name_auto FROM projects …`), `rename` (Muster für ein `UPDATE`).
- `src-tauri/src/sessions/registry.rs`: `struct ProjectState` (Felder `name`, `name_auto`, …), `project_summary` (~629, baut `ProjectSummary`), `rename_project` (~678, Muster: prüfen, Datenbank, Speicher, `PROJECT_CHANGED_EVENT`). Wo `ProjectState` aufgebaut wird (Wiederherstellung, `create_project`), meldet der Compiler.
- `src-tauri/src/projects/model.rs`: `ProjectSummary`.
- `src-tauri/src/commands/projects.rs`: `project_rename` (Muster), Registrierung in `src-tauri/src/lib.rs` neben `commands::projects::project_rename`.
- Oberfläche: `src/lib/projects.ts` (`renameProject`, Muster), `src/features/projects/ProjectOverview.tsx` (Kopf `project-overview__sessions-head` ~147, darunter Fehlerzeile und `project-overview__cards`), `src/components/Switch.tsx` (`checked`, `label`, `title`, `disabled`, `onChange`), Info-Symbol-Muster `repository-picker__info` (`src/features/repositories/RepositoryPicker.tsx` ~131, SVG dort abschreiben), `src/app/App.tsx` (`projects` aus `useProjectSummaries()`, `<ChatView … />`), `src/features/chat/ChatView.tsx` (`ChatViewProps`), `ChatTimeline.tsx`, `HandoffBar.tsx` (aus Phase 1).

## AK

1. Die Übersicht jedes Vorhabens zeigt unter dem Kopf „Sessions“ die Reihe „Einstiegszeilen automatisch senden“ mit Info-Symbol (Tooltip erklärt Countdown, Modell und Haltegründe) und Schalter; Standard aus.
2. Unter einer Antwort mit mindestens einer „Weiter:“-Zeile steht rechts „Automatisch weiter“ mit demselben Schalter und Info-Symbol; bei nur „Neues Vorhaben“-Zeilen fehlt er.
3. Umlegen an einer Stelle zeigt sich sofort an der anderen (Ereignis `PROJECT_CHANGED_EVENT`) und übersteht einen Neustart der App.
4. Ein neues Vorhaben startet mit „aus“.
5. Schlägt das Speichern fehl, steht der Satz unter dem Schalter, der Schalter zeigt den alten Stand.
6. `pnpm check` grün.

## Checkliste

### Core

- [ ] `src-tauri/src/db/migrations/014_project_auto_handoff.sql`: `ALTER TABLE projects ADD COLUMN auto_handoff INTEGER NOT NULL DEFAULT 0;` und in `migrations.rs` hinter `013` eintragen.
- [ ] `db/projects.rs`: `ProjectRow` bekommt `pub auto_handoff: bool` (Doc „„Automatisch weiter“ ist an (ADR 040)“); `load_active` und `load_one`: `, auto_handoff` ans Ende des `SELECT`, gelesen mit dem nächsten Spaltenindex. `insert` bleibt (Spalten-Default 0). Neu:

  ```rust
  pub fn set_auto_handoff(connection: &Connection, id: &str, enabled: bool) -> Result<(), CommandError>
  ```

  `UPDATE projects SET auto_handoff = ?2 WHERE id = ?1` (Muster `rename`).
- [ ] `registry.rs`: `ProjectState.auto_handoff: bool` (Doc wie oben), gefüllt aus `row.auto_handoff` bzw. `false` in `create_project`. `project_summary` liest es unter derselben Sperre wie `name` und setzt `auto_handoff` im `ProjectSummary`. Neu, Muster `rename_project`:

  ```rust
  /// Schaltet „Automatisch weiter“ für das Vorhaben (ADR 040).
  pub fn set_project_auto_handoff(&self, app: &AppHandle, project_id: &str, enabled: bool) -> Result<(), CommandError>
  ```

  unbekannt → `project_not_found`; `project_rows::set_auto_handoff`; Speicher setzen; `PROJECT_CHANGED_EVENT` mit `project_summary` senden. Dazu:

  ```rust
  /// `false` für ein unbekanntes Vorhaben.
  pub fn project_auto_handoff(&self, project_id: &str) -> bool
  ```

- [ ] `projects/model.rs` `ProjectSummary`: `/// „Automatisch weiter“ ist an (ADR 040).` `pub auto_handoff: bool,` hinter `repository_names`.
- [ ] `commands/projects.rs`: `project_set_auto_handoff(app, registry, project_id: String, enabled: bool) -> Result<(), CommandError>` (Muster `project_rename`), in `lib.rs` registrieren.
- [ ] `pnpm bindings`.

### Oberfläche

- [ ] `src/lib/projects.ts`: `setProjectAutoHandoff(projectId: string, enabled: boolean): Promise<void>` → `invoke('project_set_auto_handoff', { projectId, enabled })` (Muster `renameProject`).
- [ ] `src/features/chat/handoff.ts`: `export const AUTO_HANDOFF_TITLE = 'Startet nach jeder fertigen Antwort mit genau einer „Weiter:“-Zeile die nächste Session dieses Vorhabens selbst — nach 10 Sekunden Countdown, mit dem Modell aus der Zeile und der Zeile als erster Nachricht. Hält an, wenn die Antwort 🔴 enthält, mit einer Frage endet, „Merge“ nennt oder mehrere „Weiter:“-Zeilen hat, und nach 6 automatischen Starts in Folge ohne Nachricht von dir.';`
- [ ] Neu `src/features/chat/AutoHandoffSwitch.tsx` + `.css`: Props `{ projectId: string; enabled: boolean; label: string }`. Zustand `isSaving`, `errorMessage`. Markup `<div className="auto-handoff-switch">` mit `<span className="auto-handoff-switch__label">{label}</span>`, Info-Symbol `<span className="auto-handoff-switch__info" title={AUTO_HANDOFF_TITLE}>` (SVG aus `RepositoryPicker.tsx` übernehmen), `<Switch checked={enabled} label={label} disabled={isSaving} onChange={…} />`; darunter bei Fehler `<p className="auto-handoff-switch__error" role="alert">`. `onChange(next)`: `setIsSaving(true)`, `await setProjectAutoHandoff(projectId, next)`, Fehler → `setErrorMessage(`Nicht gespeichert: ${commandErrorText(reason)}`)`, zuletzt `setIsSaving(false)`. Der angezeigte Stand kommt nur aus `enabled` (Ereignis), nie optimistisch. CSS: Flex, `align-items: center`, `gap: var(--space-sm)`, `font-size: var(--font-size-sm)`, `color: var(--color-fg-muted)`; `__info` wie `repository-picker__info`; `__error` wie `handoff__error`.
- [ ] `ProjectOverview.tsx` + `.css`: zwischen `project-overview__sessions-head` und der Fehlerzeile `<div className="project-overview__auto"><AutoHandoffSwitch projectId={project.id} enabled={project.autoHandoff} label="Einstiegszeilen automatisch senden" /></div>`; `__auto`: Rahmen `1px solid var(--color-border-subtle)` (Token-Name wie die übrigen Rahmen in `ProjectOverview.css`), `border-radius: var(--radius-lg)`, `padding: var(--space-sm) var(--space-md)`. Aussehen nach Entwurf Zustand 4 (Schalter rechts: `AutoHandoffSwitch` bekommt dort per Modifikator `auto-handoff-switch--wide` `justify-content: space-between` und `width: 100%`; Prop `wide?: boolean`).
- [ ] Durchreichen: `App.tsx` an `<ChatView …>` `autoHandoff={projects.find((project: ProjectSummary) => project.id === session.projectId)?.autoHandoff ?? false}`; `ChatView` Prop `autoHandoff: boolean` (Doc „„Automatisch weiter“ des Vorhabens (ADR 040)“) → `ChatTimeline` → `HandoffBar`.
- [ ] `HandoffBar.tsx`: Prop `autoHandoff: boolean`; nach den Reihen, nur wenn `lines.some((line) => line.kind === 'session')`: `<div className="handoff-bar__foot"><AutoHandoffSwitch projectId={projectId} enabled={autoHandoff} label="Automatisch weiter" /></div>`; `__foot` Flex, `justify-content: flex-end`.

### Doku

- [ ] `docs/code-map.md`: Zeile „Vorhaben“ um `auto_handoff` (Spalte, `set_project_auto_handoff`, `project_set_auto_handoff`), Zeile „Chat“ um `AutoHandoffSwitch`; Migration 14 steht pauschal unter „Persistenz“ (`migrations/*.sql`) — nur ergänzen, wenn die Zeile Migrationen einzeln nennt.
- [ ] `pnpm check` grün, Commit (Bindings mit).

## Report-Back
