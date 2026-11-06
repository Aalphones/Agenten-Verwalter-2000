# Phase 4 — `Ctrl J`: nächste, die auf dich wartet

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Kontrakt-Sektion — [README.md](README.md)
- Entwurf F im Artefakt: [artifacts/stationen-schneller-erreichen.html](artifacts/stationen-schneller-erreichen.html)
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`
- Code: `src/app/App.tsx` (Kürzel-Effekt für `Ctrl N` als Muster; `implementations`, `sessions`, `currentSession`, `isMainReplaced`, `isOverview`, `shownImplementation`), `src/features/terminal/terminalInstances.ts` (Terminal fängt Tasten im `.xterm`-Element), `src/features/implementation/implementationOrder.ts` (`flatStations`), `useOpenStation.ts`, `src/stores/implementation.ts` (`focused`), `src/lib/bindings/SessionSummary.ts` (`status`, `lastActivityAt`, `stationOf`), `src/app/Sidebar.tsx` (`<kbd className="sidebar__new-key">Ctrl N</kbd>` — Schreibweise der Kürzel)
- Vault-Fehlerklassen: keine einschlägig (siehe Phase 1).

## AK dieser Phase

1. `Ctrl J` (ohne Shift/Alt) überall in der App, außer der Fokus liegt im Terminal (`.xterm`): springt zum ersten Eintrag der Warteliste nach dem gerade gezeigten; ist der gezeigte nicht in der Liste, zum ersten. Am Ende wieder von vorn.
2. Warteliste: (a) jede Session mit `status === 'waiting'` (auch Stations-Sessions), (b) jede Station mit Zustand `waitsForYou` oder `asking`, deren Session nicht schon unter (a) steht — auch Stationen ohne Session. Ordnung: zuerst alle mit Zustand „fragt“ (Session `waiting` bzw. Station `asking`), dann `waitsForYou`; innerhalb gleichen Rangs die am längsten wartende zuerst (`lastActivityAt` der Session, bei Stationen ohne Session `lastActivityAt` der Umsetzung, aufsteigend).
3. Sprung: Eintrag mit Session → `selectSession`; Station ohne Session → `useOpenStation`.
4. Nach jedem Druck erscheint 2,5 s lang unten mittig über dem Hauptbereich eine Einblendung „{n} von {m} warten auf dich“; bei leerer Liste „Gerade wartet niemand auf dich“ und kein Sprung. `role="status"`, `aria-live="polite"`.
5. Das Kürzel steht im Tooltip der Stationszeilen (Phase 1) und der ‹ ›-Knöpfe (Phase 2): angehängt „ · Ctrl J: nächste, die auf dich wartet“.
6. `Ctrl J` öffnet nicht den Download-Dialog des Webviews (`preventDefault`, wie `Ctrl N`). `pnpm check` grün.

## Checkliste

- [x] Neu `src/features/waiting/waitingQueue.ts` (reine Funktionen, kein React):
  ```ts
  export interface WaitingEntry {
    key: string;                       // `session:<id>` bzw. `station:<id>`
    sessionId: string | null;
    implementationId: string | null;   // nur bei Stationen
    station: StationView | null;       // nur bei Stationen
    rank: 0 | 1;                       // 0 = fragt, 1 = wartet auf dich
    since: number;                     // lastActivityAt
  }
  export function waitingQueue(sessions: readonly SessionSummary[], implementations: readonly ImplementationView[]): WaitingEntry[];
  /** Index des nächsten Eintrags nach dem gezeigten; `null` bei leerer Liste. */
  export function nextWaitingIndex(queue: readonly WaitingEntry[], shownSessionId: string | null, shownStationId: string | null): number | null;
  ```
  Sortierung `rank` aufsteigend, dann `since` aufsteigend. `nextWaitingIndex`: Position des Eintrags mit `sessionId === shownSessionId` (falls nicht `null`) oder `station?.id === shownStationId`; gefunden → `(pos + 1) % length`, sonst `0`.
- [x] Neu `src/features/waiting/useWaitingJump.ts`: `useWaitingJump(sessions, implementations, shown: { sessionId: string | null; stationId: string | null }): string | null` — registriert den `keydown`-Handler am `window` (Muster `Ctrl N` in `App.tsx`; Abbruch, wenn `event.target` in `.xterm` liegt), berechnet Liste und Ziel, springt (`selectSession` bzw. `useOpenStation`) und gibt den Text der Einblendung zurück; setzt ihn nach 2500 ms per `setTimeout` auf `null` (Timer beim nächsten Druck und beim Unmount löschen).
- [x] Neu `src/features/waiting/WaitingJumpNotice.tsx` + `.css`: rendert den Text in `.waiting-jump-notice` (`position: absolute; bottom: var(--space-3xl); left: 50%; transform: translateX(-50%)`, Hintergrund `var(--color-bg-popover)`; Rand `var(--color-border-subtle)`, Radius `var(--radius-md)`, `font-size: var(--font-size-xs)`, `pointer-events: none`). Texte in `src/features/waiting/waitingTexts.ts`.
- [x] `App.tsx`: `useWaitingJump(sessions, implementations, shown)` mit `shown.sessionId` = gezeigte Session (wie die an die Sidebar übergebene `activeSessionId`) und `shown.stationId` = bei offener Umsetzung die Station im Fokus (`useImplementationStore((s) => s.focused[shownImplementation.id])`, sonst `null`). `<WaitingJumpNotice text={…} />` innerhalb von `<main className="app__main">`; In `App.css` an `&__main` `position: relative;` ergänzen (fehlt heute).
- [x] Tooltips: `SidebarStation.tsx` und `StationTrail.tsx` hängen `WAITING_JUMP_HINT` (` · Ctrl J: nächste, die auf dich wartet`, aus `waitingTexts.ts`) an ihren `title`.
- [x] `docs/code-map.md`: neue Zeile „Sprung zur nächsten wartenden (`Ctrl J`)“ → `src/features/waiting/`. `docs/glossary.md`: Eintrag **Warteliste** — Sessions und Stationen, die auf dich warten, in der Reihenfolge von `Ctrl J`.

## Report-Back

Status: complete. `src/features/waiting/` (`waitingQueue.ts`, `useWaitingJump.ts`, `WaitingJumpNotice.tsx`/`.css`, `waitingTexts.ts`); `App.tsx` hängt Hook und Einblendung ein, `.app__main` ist `position: relative`; Tooltips an Stationszeile und ‹ ›; Code-Map, Glossar (Warteliste) und ADR 056 nachgezogen; `pnpm check` grün. Abweichungen: bei genau einem Eintrag steht „1 von 1 wartet auf dich“ (Singular); der Rahmen der Einblendung (`role="status"`) steht immer im DOM und nur der Textkasten darin wechselt, damit Vorlesen die Änderung meldet; gehaltenes `Ctrl J` (`event.repeat`) springt nur beim ersten Druck. Unsicherste Stelle: `useWaitingJump.ts`, `preventDefault` auf `Ctrl J` — ob WebView2 den Download-Dialog tatsächlich unterdrückt und ob das Kürzel im Terminal-Fokus (`.xterm`) als Zeilenumbruch ankommt, ist erst in der echten App belegt.
