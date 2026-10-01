# Phase 3 — Oberfläche und Doku: Reichweite durchreichen, Hinweise, Glossar

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“, „Kontrakt“, „Finale Abnahmekriterien“, „Smoke-Checkliste“.
- [phase-2-zuordnung.md](phase-2-zuordnung.md), Abschnitt „Report-Back“.
- `src/app/App.tsx` (Abschnitt `overviewProject` bis `renderMain`: `isOverview`, `currentSession`, `useSessionChanges`, beide `<ChangesView>`).
- `src/features/changes/`: `useSessionChanges.ts`, `useFileDiff.ts`, `ChangesView.tsx`, `ChangesOverview.tsx` + `.css`, `DiffView.tsx` + `.css`, `changesScope.ts`.
- `src/lib/changes.ts`, `src/lib/bindings/ChangesReach.ts`, `LineStat.ts`, `SessionChanges.ts`.
- `src/styles/theme.css` (Tokens `--space-*`, `--font-size-*`, `--color-fg-*`, `--color-border-subtle`).
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md) (BEM-CSS pro Komponente), [linting.md](../../conventions/linting.md).
- [docs/glossary.md](../../glossary.md) (Zeilen „Ticket-Worktree“, „Committed / Uncommitted“, „Blickwinkel“, „Changes-Ansicht“).
- Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): keine einschlägig (die React-Einträge betreffen Tests, das Projekt hat keine).

**Design:** Für die drei neuen Textzeilen gibt es keinen Entwurf. Sie werden freihändig im Stil der bestehenden Hinweiszeile `.changes-overview__hint` gebaut (Text, keine neuen Bedienelemente), genau wie unten beschrieben.

**Chesterton:** Die Übersicht eines Vorhabens lädt ihre Changes über die Session mit der höchsten Nummer (`App.tsx`, Kommentar über `overviewProject`). Das bleibt so; neu ist nur die Reichweite `project`. `useSessionChanges` verwirft Antworten einer vorherigen Session über `requestRef`/`inFlightRef`. Wechselt die Ansicht zwischen Übersicht und Session derselben Session-ID, muss das genauso greifen, deshalb wird der Schlüssel um die Reichweite erweitert.

## Abnahmekriterien

- `pnpm check` grün.
- Changes-Reiter einer Session lädt mit `reach = 'session'`, Changes-Reiter und Änderungssumme der Vorhaben-Übersicht mit `reach = 'project'`. Der Diff einer Datei lädt mit derselben Reichweite wie die Liste, aus der sie geöffnet wurde.
- Wechsel Übersicht → Session (#höchste Nummer) → Übersicht zeigt jeweils die passenden Daten, ohne kurz die der anderen Reichweite zu zeigen.
- Unter der Überschrift „Übersicht“ der Changes steht in einer Session „Nur, was diese Session geändert hat.“, in der Vorhaben-Übersicht „Was die Sessions dieses Vorhabens geändert haben.“
- Ist `untrackedBefore` gesetzt, folgt darunter „Erfasst seit <TT.MM., HH:MM> — Änderungen davor fehlen hier.“
- Hat die geöffnete Datei im gewählten Blickwinkel `foreign = true`, steht zwischen Kopfzeile und Diff „Dieser Diff enthält auch Änderungen von außerhalb dieser Session.“ bzw. „… außerhalb dieses Vorhabens.“
- Glossar, Code-Map und ADR-Verweise sind nachgezogen.

## Checkliste

### Laden

- [ ] `useSessionChanges(session: SessionSummary | null, reach: ChangesReach, isVisible: boolean)`. `LoadedState.sessionId` wird zu `requestKey: string` = `` `${reach}:${sessionId}` `` (bzw. `null` ohne Session). `inFlightRef` vergleicht und speichert `requestKey`. Das Effect-Zurücksetzen hängt an `requestKey` statt `sessionId`. `loadChanges(sessionId, reach)`. Die Rückgabe-Prüfung `state.sessionId !== sessionId` wird `state.requestKey !== requestKey`. JSDoc um „\`reach\`: wessen Änderungen (ADR 014)“ ergänzen.
- [ ] `App.tsx`: `const changesReach: ChangesReach = isOverview ? 'project' : 'session';` direkt vor `useSessionChanges`. Aufruf `useSessionChanges(…, changesReach, isChangesView || isOverview)`. `renderOverview`: `<ChangesView … reach="project" />`; `renderMain`: `<ChangesView … reach="session" />`.
- [ ] `useFileDiff(sessionId: string, reach: ChangesReach, file: OpenFile, scope: ChangeScope, stamp: string)`: `loadFileDiff(sessionId, reach, key, path, scope)`, `reach` in die Effect-Abhängigkeiten.

### Durchreichen

- [ ] `ChangesView`: Prop `reach: ChangesReach`. An `ChangesOverview` gehen `reach` und `untrackedBefore={changes.untrackedBefore}`, an `DiffView` geht `reach`.
- [ ] `DiffView`: Prop `reach: ChangesReach`, an `useFileDiff(sessionId, reach, …)`.

### Texte (`changesScope.ts`)

- [ ] `export const REACH_TEXT: Record<ChangesReach, string> = { session: 'Nur, was diese Session geändert hat.', project: 'Was die Sessions dieses Vorhabens geändert haben.' };`
- [ ] `export const FOREIGN_TEXT: Record<ChangesReach, string> = { session: 'Dieser Diff enthält auch Änderungen von außerhalb dieser Session.', project: 'Dieser Diff enthält auch Änderungen von außerhalb dieses Vorhabens.' };`
- [ ] `export function trackedSinceText(milliseconds: number): string` → `` `Erfasst seit ${…} — Änderungen davor fehlen hier.` `` mit `new Date(milliseconds).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })`. JSDoc: „Sessions aus der Zeit vor der Aufzeichnung (ADR 014).“

### Übersicht

- [ ] `ChangesOverview`: Props `reach: ChangesReach`, `untrackedBefore: number | null`. Die Überschrift `<h2 className="changes-overview__title">` kommt zusammen mit den neuen Zeilen in `<div className="changes-overview__head">`. Darunter folgen `<p className="changes-overview__reach">{REACH_TEXT[reach]}</p>` und, wenn `untrackedBefore !== null`, `<p className="changes-overview__reach">{trackedSinceText(untrackedBefore)}</p>`.
- [ ] `ChangesOverview.css`: `&__head { display: flex; flex-direction: column; gap: var(--space-2xs); }` und `&__reach { margin: 0; font-size: var(--font-size-xs); color: var(--color-fg-muted); }`.

### Diff

- [ ] `DiffView`: zwischen `diff-view__header` und `diff-view__body` `{stat !== null && stat.foreign && <p className="diff-view__foreign">{FOREIGN_TEXT[reach]}</p>}`.
- [ ] `DiffView.css`: `&__foreign { flex-shrink: 0; margin: 0; padding: var(--space-sm) 10px var(--space-sm) 16px; font-size: var(--font-size-xs); color: var(--color-fg-muted); border-bottom: 1px solid var(--color-border-subtle); }` (Innenabstand links/rechts wie `&__header`).

### Doku

- [ ] `docs/glossary.md`:
  - Neue Zeile hinter „Blickwinkel“: **Eigene Changes** (`ChangesReach`) — „Was die Changes-Ansicht zeigt: in einer Session nur ihre eigenen Commits und die Dateien, die ihr Agent geschrieben und seitdem nicht committet hat; in der Vorhaben-Übersicht die Summe aller Sessions. Eigene Commits erkennt die App am Zeitfenster der Git-Befehle des Agenten (ADR 014).“
  - „Ticket-Worktree“: „…erscheint in den Changes jeder Session des Vorhabens…“ ersetzen durch „…erscheint in den Changes der Session, die ihn benutzt hat, und in der Vorhaben-Übersicht; gemessen gegen den Standard-Branch mit den eigenen Commits (ADR 010, ADR 014).“
  - „Committed / Uncommitted“: am Ende „Gezählt wird nur, was der Session bzw. dem Vorhaben gehört (ADR 014).“
  - „Changes-Ansicht“: „…geänderte Repositories, Dateien und Diffs gegen die Basis…“ ersetzen durch „…die eigenen Änderungen (Session) bzw. die aller Sessions (Vorhaben-Übersicht): Repositories, Dateien und Diffs gegen die Basis…“.
- [ ] `docs/code-map.md`, Zeile „Changes“ (Oberfläche): hinter `useSessionChanges Nachladen` „(Reichweite Session/Vorhaben)“, hinter `changesScope` „(inkl. Texte zu Reichweite und fremden Anteilen)“.
- [ ] `docs/PROJECT.md`, Scope-Punkt „**Changes:**“: hinter „…gegen eine konfigurierbare Basis“ anhängen: „; je Session nur ihre eigenen Änderungen, in der Übersicht des Vorhabens die Summe ([ADR 014](decisions/014-changes-je-session.md))“.
- [ ] Plan-README: Status aller Phasen `complete`, Bottom-Sektionen füllen. Archivieren und Versions-Tag laufen nach [releases.md](../../conventions/releases.md) beim Abschluss, nicht in diesem Commit.
- [ ] Commit `feat(changes): show session or project changes in the views`.

## Report-Back
