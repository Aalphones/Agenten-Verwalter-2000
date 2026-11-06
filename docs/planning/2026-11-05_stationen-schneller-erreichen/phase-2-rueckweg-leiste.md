# Phase 2 — Rückweg-Leiste im Chat einer Station

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Kontrakt-Sektion — [README.md](README.md)
- Entwurf C im Artefakt: [artifacts/stationen-schneller-erreichen.html](artifacts/stationen-schneller-erreichen.html)
- `docs/conventions/react.md`, `docs/conventions/tailwind.md`
- Code: `src/app/App.tsx` (Zweig `if (currentSession !== undefined)` in `renderMain`, dort `<SessionHeader …/>` und `<SessionActionError …/>`), `src/app/SessionActionError.tsx` + `.css` (Muster einer schmalen Leiste unter der Kopfzeile), `src/features/implementation/implementationOrder.ts` (`liveStations`, `flatStations`), `implementationTexts.ts` (`stationLabel`, `stateLabel` aus `stationState.ts`), `useOpenStation.ts`, `src/lib/bindings/SessionSummary.ts` (`stationOf` = ID der Umsetzung)
- Vault-Fehlerklassen: keine einschlägig (siehe Phase 1).

## AK dieser Phase

1. Ist die gezeigte Session eine Station (`stationOf !== null`) und ist ihre Umsetzung in `implementations`, steht direkt unter der Session-Kopfzeile eine Leiste, Höhe 28 px, eine Zeile, Rand unten `1px solid var(--color-border-subtle)`.
2. Links: Knopf „← {Name der Umsetzung}“ → öffnet die Umsetzung (`selectImplementation`). Daneben gedämpft „Phase {key} · {title}“ (Ellipse, schrumpft zuerst).
3. Rechts: zwei Knöpfe ‹ und › → vorige bzw. nächste **aktive** Station in Plan-Reihenfolge, relativ zur Station dieser Session (die Station selbst zählt nicht). Öffnen per `useOpenStation`. Gibt es keine, ist der Knopf `disabled`.
4. ‹ und › haben `aria-label` und `title`: „Vorige aktive Station: {stationLabel} · {stateLabel}“ bzw. „Nächste aktive Station: …“; ohne Ziel „Keine vorige aktive Station“ / „Keine nächste aktive Station“. Der Rückweg-Knopf hat `title` „Zurück zur Umsetzung“.
5. Sessions, die keine Station sind, zeigen keine Leiste. `pnpm check` grün.

## Checkliste

- [x] Neu `src/features/implementation/StationTrail.tsx` + `StationTrail.css`, BEM-Block `station-trail`.
  ```ts
  interface StationTrailProps {
    implementation: ImplementationView;
    /** Session, deren Chat gezeigt wird. */
    sessionId: string;
    onOpenImplementation: (implementationId: string) => void;
  }
  ```
  - Eigene Station: `flatStations(implementation).find((ref) => ref.station.sessionId === sessionId)`. Nicht gefunden → `return null`.
  - Ziele: `const live = liveStations(implementation)`; `previous` = letzte aus `live` mit `index < own.index`; `next` = erste mit `index > own.index`.
  - Öffnen: `const openStation = useOpenStation()`; ‹/› rufen `openStation(implementation.id, target.station)`.
  - Rückweg-Knopf: `onOpenImplementation(implementation.id)`.
  - Texte als Konstanten in `implementationTexts.ts` (`TRAIL_BACK_TITLE = 'Zurück zur Umsetzung'`, Funktion `trailTargetTitle(direction: 'previous' | 'next', target: StationRef | undefined): string` mit den Sätzen aus AK 4).
  - CSS: `display: flex; align-items: center; gap: var(--space-md); height: 28px; padding: 0 var(--space-3xl); font-size: var(--font-size-xs); color: var(--color-fg-muted)`; Rückweg-Knopf in `var(--color-accent)`, ohne Rahmen; ‹ › als kleine Knöpfe 22×22 px mit Rahmen `var(--color-border-subtle)`, `:disabled` mit `opacity: 0.4; cursor: default`; Fokus-Ring wie `sidebar-implementation__button:focus-visible`. Die Phasen-Zeile `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1`.
- [x] `App.tsx`, Zweig `if (currentSession !== undefined)`: zwischen `<SessionHeader …/>` und `<SessionActionError …/>`
  ```tsx
  {trailImplementation !== undefined && (
    <StationTrail implementation={trailImplementation} sessionId={currentSession.id} onOpenImplementation={selectImplementation} />
  )}
  ```
  mit `const trailImplementation = currentSession.stationOf === null ? undefined : implementations.find((i) => i.id === currentSession.stationOf);` direkt vor dem `return` dieses Zweigs. `selectImplementation` ist in `App.tsx` schon vorhanden (an die Sidebar übergeben).
- [x] `docs/code-map.md`: Zeile der Umsetzung um `StationTrail.tsx` (Rückweg-Leiste) ergänzen.
- [x] `docs/glossary.md`: Eintrag **Rückweg-Leiste** — Leiste über dem Chat einer Station: zurück zur Umsetzung, ‹ › zur vorigen/nächsten aktiven Station.

## Report-Back

Status: complete. `StationTrail` (Rückweg, Phasenzeile, ‹ ›) steht zwischen Kopfzeile und Fehlerleiste in `App.tsx`; Texte in `implementationTexts.ts`; Code-Map, Glossar und ADR 056 nachgezogen; `pnpm check` grün. Abweichung: ‹ liest die letzte Vorgängerin per `filter().pop()`, weil `findLast` in `lib: ES2020` fehlt; der Rückweg-Knopf hat `max-width: 40%` mit Ellipse, damit ein langer Vorhabenname die Pfeile nicht verdrängt. Unsicherste Stelle: `StationTrail.css` (`__back` gegen `__phase` bei schmalem Fenster) — Beleg erst in der echten App.
