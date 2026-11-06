# Phase 1 — Gemeinsame Bausteine + Stationen in der Sidebar

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Kontrakt-Sektion (die Bausteine dieser Phase) — [README.md](README.md)
- Entwurf A im Artefakt: [artifacts/stationen-schneller-erreichen.html](artifacts/stationen-schneller-erreichen.html)
- `docs/decisions/048-umsetzung.md` (Punkt „Sidebar“ wird durch ADR 056 geändert)
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`
- Code: `src/app/buildSidebarRows.ts`, `src/app/Sidebar.tsx`, `src/app/SidebarImplementation.tsx` + `.css` (Muster für die neue Zeile), `src/app/Sidebar.css` (Baumlinie `&__session`), `src/features/implementation/implementationOrder.ts`, `implementationTexts.ts`, `stationState.ts`, `Timeline.tsx` (Funktion `stationLabel`), `ImplementationView.tsx` (Funktion `openChat`), `src/stores/sessions.ts`, `src/stores/implementation.ts`, `src/features/background/useNow.ts`
- Vault-Fehlerklassen gelesen (`sprachen/typescript`, `frameworks/react`): keine einschlägig.

## AK dieser Phase

1. `LIVE_STATES`, exportiertes `NEEDS_USER_STATES`, `liveStations`, `stationLabel`, `useOpenStation` existieren mit den Signaturen aus dem README-Kontrakt; `Timeline.tsx` nutzt `stationLabel` aus `implementationTexts.ts` (keine eigene Kopie mehr).
2. Aufgeklapptes Vorhaben: direkt nach jeder Umsetzungs-Zeile folgen ihre `liveStations` als Zeilen, eingerückt unter der Umsetzung, mit eigener Baumlinie.
3. Zugeklapptes Vorhaben: unter der Vorhaben-Zeile stehen die Stationen aller seiner Umsetzungen, deren Zustand in `NEEDS_USER_STATES` liegt — auf Höhe der Umsetzungs-Zeilen (nicht eingerückt), Plan-Reihenfolge.
4. Eine Stationszeile zeigt: Status-Symbol (`StatusIcon` mit `stateIcon`), `stationLabel`, Phasenschlüssel als kleine Marke, rechts den Zustand (Regel unten), Ungelesen-Punkt, wenn die Session der Station `unread` ist.
5. Klick → `useOpenStation`. Station mit Session: Session ist gewählt, Chat bzw. der zuletzt gewählte Reiter ist offen. Station ohne Session (Stationen „durch dich“): Umsetzung offen, Karte dieser Station vorn.
6. Ist die gezeigte Session eine Station: ihre Stationszeile ist markiert (`aria-current="page"`); hat sie keine Zeile (Station fertig o. ä.), ist die Zeile ihrer Umsetzung markiert. Nie zwei Markierungen.
7. Jede Stationszeile hat einen Tooltip (Text unten).
8. ADR 056 liegt vor; `docs/code-map.md` und `docs/glossary.md` sind nachgezogen; `pnpm check` grün.

## Checkliste

### Bausteine

- [x] `implementationOrder.ts`: `const NEEDS_USER_STATES` → `export const NEEDS_USER_STATES` (Inhalt unverändert). Neu darunter `export const LIVE_STATES` (Liste aus dem README-Kontrakt, in dieser Reihenfolge) und
  ```ts
  /** Aktive Stationen (ADR 056) in Plan-Reihenfolge. */
  export function liveStations(implementation: ImplementationView): StationRef[] {
    return flatStations(implementation).filter((ref: StationRef) => LIVE_STATES.includes(ref.station.state));
  }
  ```
- [x] `implementationTexts.ts`: neue exportierte Funktion `stationLabel(station: StationView): string` mit dem Körper der privaten `stationLabel` aus `Timeline.tsx`, aber auf `station` statt `ref.station`. In `Timeline.tsx` die private Funktion löschen, importieren und den Aufruf `stationLabel(ref)` → `stationLabel(ref.station)` ändern.
- [x] Neu `src/features/implementation/useOpenStation.ts`:
  ```ts
  export function useOpenStation(): (implementationId: string, station: StationView) => void
  ```
  Holt `selectSession` und `selectImplementation` aus `useSessionsStore`, `setFocused` aus `useImplementationStore`. Rückgabe mit `useCallback`: `station.sessionId !== null` → `selectSession(station.sessionId)`; sonst `setFocused(implementationId, station.id)`, dann `selectImplementation(implementationId)`. Kein `showView` — der Reiter bleibt beim Session-Wechsel stehen wie überall in der App.
- [x] `ImplementationView.tsx` bleibt bei seinem `openChat` (nicht umbauen).

### Zeilen

- [x] `buildSidebarRows.ts`: neue Zeilenart
  ```ts
  | { kind: 'station'; key: string; implementationId: string; entry: StationRef; isNested: boolean; isLast: boolean }
  ```
  `key` = `station:${entry.station.id}`. Umbau von `buildSidebarRows`: je Vorhaben die Kindzeilen zuerst in ein lokales Array `children: SidebarRow[]` sammeln, danach `rows.push(projectRow, ...children)`.
  - Aufgeklappt: je Umsetzung ihre Zeile, direkt danach je `liveStations(implementation)` eine `station`-Zeile mit `isNested: true`; danach wie bisher Sessions und ggf. `more`.
  - Zugeklappt: je Umsetzung je `liveStations(implementation)`, gefiltert auf `NEEDS_USER_STATES.includes(ref.station.state)`, eine `station`-Zeile mit `isNested: false`. Keine Umsetzungs-, Session- oder `more`-Zeilen.
  - `isLast`: alle Kindzeilen bekommen `isLast: false`; ist die letzte Kindzeile vom Typ `implementation`, `session` oder `station`, wird sie durch eine Kopie mit `isLast: true` ersetzt. (`more` steht wie bisher als letzte und hat kein `isLast`.) Die bisherige Rechnung `ownSessions.length === 0 && index === …` und `!hasMoreRow && index === …` entfällt dadurch.
  - Kommentar an `SidebarProjectEntry.sessions` („Stationen bekommen keine Zeile“) anpassen: Stationen bekommen keine **Session**-Zeile, aktive erscheinen als Stationszeile (ADR 056).
- [x] `Sidebar.tsx`:
  - `ESTIMATED_HEIGHT` um `station: 26` ergänzen; in `estimateHeight` die Bedingung auf `row.kind === 'station'` erweitern.
  - `renderRow`: Fall `'station'` → `renderStation(row)`.
  - `renderStation(row)`: Hülle `<div className={`sidebar__session${row.isLast ? ' sidebar__session--last' : ''}`}>` wie bei Sessions, darin `<SidebarStation …/>` mit `entry`, `isNested`, `isActive = row.entry.station.sessionId !== null && row.entry.station.sessionId === activeSessionId`, `isUnread = sessions.find((s) => s.id === row.entry.station.sessionId)?.unread ?? false`, `onSelect = () => openStation(row.implementationId, row.entry.station)` (`openStation` aus `useOpenStation()` am Kopf der Komponente).
  - Markierung der Umsetzungs-Zeile: vor dem `return` ein `Set` `stationSessionIds` aller `sessionId` der `station`-Zeilen in `rows` bilden. `isActive` der Umsetzungs-Zeile = `implementation.id === activeImplementationId || (activeSession?.stationOf === implementation.id && !stationSessionIds.has(activeSessionId))`, wobei `activeSession = sessions.find((s) => s.id === activeSessionId)`.
- [x] Neu `src/app/SidebarStation.tsx` + `SidebarStation.css`, Muster `SidebarImplementation.tsx` (Knopf 26 px, gleiche Hover-/Active-/Fokus-Regeln, gleiche Token). BEM-Block `sidebar-station`.
  - Wurzel `.sidebar-station`; mit `isNested` zusätzlich `.sidebar-station--nested`: `margin-left: 14px; padding-left: var(--space-sm); border-left: 1px solid var(--color-border-subtle);` (zweite Baumebene unter der Umsetzung).
  - Knopf `.sidebar-station__button` (+ `--active`), `aria-current={isActive ? 'page' : undefined}`, `onClick={onSelect}`. Kein Kontextmenü, kein Umbenennen.
  - Inhalt: `.sidebar-station__status` mit `<StatusIcon status={stateIcon(state)} size={10} />`; `.sidebar-station__name` = `stationLabel(station)` (Ellipse); `.sidebar-station__phase` = `entry.phase.key` (Mono, `--font-size-2xs`, gedämpft, `flex-shrink: 0`); `.sidebar-station__meta` (`margin-left: auto`, `flex-shrink: 0`, `--font-size-2xs`); Ungelesen-Punkt `.sidebar-station__unread` wie `sidebar-implementation__unread` (gleiches CSS, gleiches `aria-label`).
  - Zustandstext: `stationMeta(station, now)`; ist er leer, `stateLabel(station.state)`. `now` aus `useNow(isTicking)` mit `isTicking = ['running', 'starting', 'waitsForScript', 'countdown'].includes(state)`.
  - Farbe des Zustandstexts: `asking`/`waitsForYou` → `var(--color-status-waiting)`, `error` → `var(--color-status-error)`, sonst `var(--color-fg-muted)` (wie `sidebar-implementation__progress`).
  - Tooltip (`title`): `${stationLabel} · Phase ${phase.key} ${phase.title} · ${stateLabel(state)}`; ohne Session angehängt ` · öffnet die Karte in der Umsetzung`, mit Session ` · öffnet den Chat`.

### Doku

- [x] `docs/decisions/056-stationen-in-der-sidebar.md` (10 Zeilen, Format wie ADR 055): Kontext = Klickweg 2–4 Klicks, im Station-Chat keine Markierung; Optionen = Sidebar-Zeilen (gewählt) / Chat in der Umsetzung einbetten / nur Statuszeile am Vorhaben klickbar; Entscheidung = aktive Stationen (`LIVE_STATES`) als Zeilen unter der Umsetzung in Plan-Reihenfolge, zugeklappt nur `NEEDS_USER_STATES`; ändert ADR 048 Punkt „Sidebar“; Konsequenzen = längerer Baum bei Wellen, Stationen bleiben ohne Session-Zeile. In ADR 048 am Punkt „Sidebar“ einen Verweis „geändert durch ADR 056“ ergänzen.
- [x] `docs/code-map.md`: Zeile „Sidebar-Zeilen …“ um `src/app/SidebarStation.tsx` (Stationszeile) ergänzen; in der Zeile der Umsetzung `useOpenStation.ts` nennen.
- [x] `docs/glossary.md`: neuer Eintrag **Aktive Station** — Station in einem Zustand aus `LIVE_STATES` (bereit, startet gleich, startet, läuft, wartet auf Skript, fragt dich, wartet auf dich, Fehler); steht als Zeile in der Sidebar (ADR 056). Eintrag **Station** um „aktive erscheinen in der Sidebar“ ergänzen.

## Report-Back

Status: complete. Bausteine, Stationszeilen, ADR 056, Code-Map und Glossar stehen; Abweichung: `.sidebar-station--nested` trägt `margin-bottom: -1px; padding-bottom: 1px`, damit die Baumlinie zwischen zwei verschachtelten Zeilen nicht in 1-px-Stücke reißt. Unsicherste Stelle: die Markierung der Umsetzungs-Zeile (`Sidebar.tsx`, `renderImplementation`) — Beleg erst in der echten App (Station fertig → Zeile der Umsetzung markiert).
