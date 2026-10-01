# Phase 3 — Oberfläche: Sidebar als Baum, Pfad in der Kopfzeile, „Neues Vorhaben“

Rating: standard · Commit-Scope: `ui`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Kontrakt / Oberfläche (Zustand)“, Abnahmekriterien 2–4 und 8.
- **Entwurf (verbindlich):** [docs/design/2026-09-30_vorhaben-und-tldr/](../../design/2026-09-30_vorhaben-und-tldr/README.md), Tafeln `Main` (Sidebar-Baum, Kopfzeile) und `Vorhaben` (hervorgehobene Vorhaben-Zeile); Maße unten stammen daraus.
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md) (Tokens + BEM-CSS je Komponente).
- Code: `src/app/Sidebar.tsx` + `.css`, `src/app/SidebarItem.tsx` + `.css` (Zeile, Umbenennen-Feld `RenameField`, Kontextmenü mit `Popover`), `src/app/SessionHeader.tsx` + `.css`, `src/app/App.tsx`, `src/stores/sessions.ts`, `src/features/sessions/useSessionSummaries.ts` (Muster Abo + Laden), `src/features/sessions/sessionStatus.ts`, `src/features/sessions/NewSession.tsx`, `src/features/sessions/EmptyState.tsx`, `src/features/chat/Composer.tsx` (`startRename`), `src/components/StatusIcon.tsx`, `src/lib/projects.ts` (aus Phase 1).
- Vault-Fehlerklassen: geprüft (React, TypeScript) — keine einschlägig.

## Abnahmekriterien

1. **Sidebar-Knopf** heißt „Neues Vorhaben“ (Strg+N unverändert); Leerliste „Noch keine Vorhaben.“; `aria-label` der Navigation „Vorhaben“.
2. **Gruppen** „Braucht dich“, „Läuft“, „Abgeschlossen“ enthalten Vorhaben. Gruppe und Symbol eines Vorhabens kommen von seiner **dringendsten** Session in der Reihenfolge `waiting`, `error`, `running`, `starting`, `paused`, `new`, `completed`, `cancelled` (Gruppe über `STATUS_GROUP`). Innerhalb einer Gruppe neueste Vorhaben zuerst.
3. **Vorhaben-Zeile:** links ein Chevron-Knopf 20 × 31 px (Symbol 11 px, `--color-fg-muted`, rechts-zeigend eingeklappt, unten-zeigend aufgeklappt, `aria-expanded`, `aria-label` „Sessions von <Name> aufklappen“/„… einklappen“), daneben der Zeilen-Knopf wie `sidebar-item__button` mit Innenabstand `6px 8px 6px 2px`: Statussymbol 12 px, Name (500), Meta-Zeile 12 px. Meta: bei genau einer Session `metaLine(session)` wie bisher; bei mehreren `„<n> Sessions · #<k> <Wort>“` mit der dringendsten Session `#k` und Wort `startet`/`läuft`/`wartet auf dich`/`pausiert`/`neu`/`Fehler`; sind alle Sessions `completed`/`cancelled`, keine Meta-Zeile. Meta in Statusfarbe wie bisher (`isMetaHighlighted` des dringendsten Status).
4. **Aufgeklappt** folgt unter der Zeile die Liste der Sessions (aufsteigend nach Nummer): Einzug `margin-left: 26px`, `padding-left: 6px`, linke Linie `1px solid var(--color-border-subtle)`, Abstand unten 4 px. Session-Zeile 26 px hoch, Innenabstand `0 8px`, Abstand 8 px, Radius 5 px, Schrift 12.5 px: Statussymbol 10 px, `#N` in `--font-mono` 11 px `--color-fg-muted`, Name mit Auslassung. Aktive Session: Hintergrund `--color-bg-selected`, Text `--color-fg-primary`; sonst Text `--color-fg-secondary`.
5. **Aufklapp-Standard:** Ein Vorhaben ist aufgeklappt, wenn es die aktive Session enthält oder seine Übersicht offen ist; ein Klick auf den Chevron überschreibt das (`expanded`).
6. **Klick auf die Vorhaben-Zeile:** genau eine Session → deren Chat (`selectSession`); mehrere → Übersicht (`selectProject`; die Übersicht selbst baut Phase 4, bis dahin zeigt `App` dort die Session mit der höchsten Nummer — siehe Checkliste). Die Zeile ist hervorgehoben (`--color-bg-selected`), solange die Übersicht dieses Vorhabens offen ist.
7. **Umbenennen:** Doppelklick oder Rechtsklick → „Umbenennen“ auf einer Vorhaben- bzw. Session-Zeile öffnet das Namensfeld an dieser Zeile; F2 benennt das Vorhaben um, wenn dessen Übersicht offen ist, sonst die aktive Session. Enter speichert (`renameProject` bzw. `renameSession`), Esc bricht ab.
8. **Kontextmenü:** Vorhaben-Zeile „Umbenennen“ (F2) und „Archivieren“ (Tooltip „Blendet das Vorhaben mit allen Sessions aus der Liste aus und beendet ihre Agenten. Die Verläufe bleiben erhalten. Repositories und Worktrees bleiben, wie sie sind.“); Session-Zeile nur „Umbenennen“.
9. **Kopfzeile einer Session**, linke Spalte: Knopf mit dem Vorhaben-Namen (26 px hoch, Innenabstand `0 6px`, Radius 6 px, Schrift 13 px, `--color-fg-muted`, Auslassung, Hover `--color-bg-hover`, `title` „Übersicht des Vorhabens öffnen“) → `selectProject`; Chevron 11 px `--color-fg-muted`; `#N` in `--font-mono` 11.5 px `--color-fg-muted`; dann Name und Status-Pille wie bisher.
10. **„Neues Vorhaben“-Seite:** Überschrift „Neues Vorhaben“, Erklärsatz „Der erste Satz wird zum Namen des Vorhabens und seiner ersten Session (später per Rechtsklick änderbar), der ganze Text samt Anhängen zur ersten Nachricht an den Agenten.“, Hauptknopf „Vorhaben starten“; alles andere unverändert.
11. **Leerzustand:** Überschrift „Noch kein Vorhaben“, Text „Ein Vorhaben ist eine Aufgabe über ein oder mehrere Repositories. Darin arbeiten nacheinander eine oder mehrere Sessions, jede mit frischem Kontext. Ob ein Agent direkt im Repository arbeitet oder einen Worktree für sein Ticket anlegt, bestimmen seine Anweisungen.“, Knopf „Erstes Vorhaben anlegen“.
12. `pnpm check` grün; bestehende Bedienung (Auswahl, Umbenennen, Tastatur) funktioniert wie vorher.

## Checkliste

### Daten und Zustand

- [x] `src/features/projects/useProjectSummaries.ts`: `useProjectSummaries(): { projects: ProjectSummary[]; upsertProject(summary); removeProject(projectId) }` — Kopie des Musters von `useSessionSummaries` (erst `onProjectChanged` abonnieren, dann `listProjects`, sortiert nach `createdAt` absteigend).
- [x] `src/features/projects/projectStatus.ts`:
  - `URGENCY: readonly SessionStatus[] = ['waiting', 'error', 'running', 'starting', 'paused', 'new', 'completed', 'cancelled']`.
  - `sessionsOf(projectId, sessions): SessionSummary[]` (aufsteigend nach `number`).
  - `mostUrgent(sessions: readonly SessionSummary[]): SessionSummary | null` (kleinster Index in `URGENCY`, bei Gleichstand die höhere Nummer).
  - `projectGroup(sessions): SessionGroup` (über `STATUS_GROUP` des dringendsten; ohne Sessions `'done'`).
  - `projectMetaLine(sessions): string | null` nach AK 3, Wörter in einer Tabelle `SHORT_STATUS: Record<SessionStatus, string>`.
- [x] `src/stores/sessions.ts` nach README „Kontrakt / Oberfläche (Zustand)“: `renamingId` ersetzt durch `renaming`; neu `activeProjectId`, `showProjectOverview`, `projectView`, `expanded`, `selectProject`, `showProjectView`, `setExpanded`; `selectSession` setzt zusätzlich `showProjectOverview: false`; `openNewSession` setzt `showProjectOverview: false`. `startRename(kind, id)`, `stopRename()`.
- [x] Alle Nutzer von `renamingId`/`startRename(sessionId)` nachziehen: `Composer.tsx` (`startRename('session', session.id)`), `Sidebar.tsx`.

### Sidebar

- [x] `SidebarItem.tsx`: `RenameField` exportieren und auf Props `name: string`, `label: string` (für `aria-label`), `onCommit`, `onCancel` umstellen. `SidebarItem` wird zur **Session-Zeile im Baum**: Props `session`, `isActive`, `isRenaming`, `onSelect`, `onStartRename`, `onCommitRename`, `onCancelRename` (kein `onArchive`); Darstellung nach AK 4 (neue BEM-Modifikatoren in `SidebarItem.css`, keine Meta-Zeile, `#N` vor dem Namen); Kontextmenü nur „Umbenennen“.
- [x] Neue Datei `src/app/SidebarProject.tsx` + `SidebarProject.css` (Block `sidebar-project`): Props `project: ProjectSummary`, `sessions: readonly SessionSummary[]` (dieses Vorhabens, nach Nummer), `activeSessionId`, `isOverviewActive: boolean`, `isExpanded: boolean`, `renaming`, Callbacks `onToggle`, `onOpen`, `onSelectSession(id)`, `onStartRename(kind, id)`, `onCommitRename(kind, id, name)`, `onCancelRename`, `onArchive`. Rendert Zeile nach AK 3 (bzw. `RenameField` mit `label` „Neuer Name des Vorhabens“, wenn `renaming` dieses Vorhaben meint), Kontextmenü nach AK 8 (Muster `SidebarItem`), und aufgeklappt die `SidebarItem`s nach AK 4.
- [x] `Sidebar.tsx`: Props `projects`, `sessions`, `activeSessionId`, `activeProjectId`, `showProjectOverview`, `onSelectSession`, `onSelectProject`, `onNew`, `onArchived(projectId)`. Gruppen über `projectGroup`; je Vorhaben `SidebarProject`. `isExpanded = expanded[id] ?? (enthält aktive Session || Übersicht offen)`. `onOpen`: eine Session → `onSelectSession`, sonst `onSelectProject`. F2 nach AK 7. `archive(projectId)` → `archiveProject`, dann `onArchived(projectId)`. Texte nach AK 1.

### Kopfzeile und Rahmen

- [x] `SessionHeader.tsx`: neue Props `projectName: string`, `onOpenProject: () => void`; linke Spalte nach AK 9 (neue Klassen `session-header__project`, `session-header__crumb`, `session-header__number` in `SessionHeader.css`).
- [x] `App.tsx`: `useProjectSummaries()` einbinden; `Sidebar` mit den neuen Props; `onArchived(projectId)`: `removeProject(projectId)` und `removeSession` für jede Session mit dieser `projectId`. `handleCreated` bleibt für die Session; zusätzlich `upsertProject` mit dem Vorhaben — dafür bekommt `NewSession` `onCreated: (created: ProjectCreated) => void` und reicht das ganze `ProjectCreated` weiter. `SessionHeader` bekommt `projectName` (Name des Vorhabens der Session, Fallback Session-Name) und `onOpenProject` (`selectProject(session.projectId)`).
- [x] `App.tsx`, Übergang bis Phase 4: Ist `showProjectOverview` gesetzt, rendert `renderMain` vorerst die Session mit der höchsten Nummer dieses Vorhabens (so bleibt die App bedienbar); Phase 4 ersetzt das durch die Übersicht.
- [x] `NewSession.tsx` und `EmptyState.tsx`: Texte nach AK 10 und 11.

### Doku

- [x] `docs/code-map.md`: Zeile „Vorhaben“ Oberfläche ergänzen (`src/features/projects/` `useProjectSummaries`, `projectStatus`; `src/app/SidebarProject.tsx`); Zeilen „Sessions“, „App-Rahmen“, „Sidebar-Zeile“ auf den Baum und den Pfad in der Kopfzeile bringen; `src/stores/sessions.ts` mit den neuen Feldern.
- [x] `docs/glossary.md`: „Chat-Ansicht“ unverändert; neuer Eintrag **Übersicht (Vorhaben)**: „Hauptansicht eines Vorhabens: TL;DR, Repositories, Sessions, ‚Neue Session‘; Reiter ‚Übersicht · Changes‘.“
- [x] README dieses Plans: Phase 3 auf `complete`.

## Report-Back

Sidebar ist ein Baum aus Vorhaben (Chevron, eingerückte Sessions, dringendste Session bestimmt Gruppe/Symbol/Meta), Kopfzeile zeigt „Vorhaben › #N Name“, „Neues Vorhaben“-Texte und Leerzustand umgestellt. Die Übersicht selbst folgt in Phase 4; bis dahin zeigt `App.tsx` dort die Session mit der höchsten Nummer. `pnpm check` grün.
