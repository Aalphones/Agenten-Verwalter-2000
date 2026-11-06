# Stationen schneller erreichen

Weniger Klicks bis in den Chat einer Station: aktive Stationen stehen als Zeilen in der Sidebar, im Chat einer Station führt eine Leiste zurück und zur nächsten, die Zeitleiste öffnet bei der ersten aktiven Phase, `Ctrl J` springt zur nächsten Session oder Station, die auf dich wartet. Nur Oberfläche, kein Core, keine Migration. Entwürfe: [artifacts/](artifacts/README.md).

## Phasen

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | [Gemeinsame Bausteine + Stationen in der Sidebar](phase-1-sidebar-stationen.md), ADR 056 | standard | complete |
| 2 | [Rückweg-Leiste im Chat einer Station](phase-2-rueckweg-leiste.md) | standard | complete |
| 3 | [Zeitleiste öffnet bei der ersten aktiven Phase](phase-3-zeitleiste-scrollen.md) | standard | complete |
| 4 | [`Ctrl J`: nächste, die auf dich wartet](phase-4-sprung-ctrl-j.md) | standard | complete |

Reihenfolge fest: 2 und 4 bauen auf den Bausteinen aus Phase 1 auf, 3 auf `liveStations` aus Phase 1.

## Kontrakt — gemeinsame Bausteine (entstehen in Phase 1)

```ts
// src/features/implementation/implementationOrder.ts
/** Zustände einer aktiven Station: Sidebar, Rückweg-Leiste, Zeitleisten-Sprung. */
export const LIVE_STATES: readonly StationState[] = [
  'ready', 'countdown', 'starting', 'running', 'waitsForScript', 'asking', 'waitsForYou', 'error',
];
/** Bisher privat, jetzt exportiert und unverändert: ['asking', 'waitsForYou']. */
export const NEEDS_USER_STATES: readonly StationState[];
/** Aktive Stationen in Plan-Reihenfolge (Teilmenge von `flatStations`). */
export function liveStations(implementation: ImplementationView): StationRef[];

// src/features/implementation/implementationTexts.ts
/** „Review #7“; ohne Session nur die Stufe — aus Timeline.tsx hierher verschoben. */
export function stationLabel(station: StationView): string;

// src/features/implementation/useOpenStation.ts
/** Station mit Session → deren Session wählen; ohne Session → Umsetzung öffnen, Karte der Station im Fokus. */
export function useOpenStation(): (implementationId: string, station: StationView) => void;
```

„Aktiv“ heißt überall dasselbe: Zustand in `LIVE_STATES`. Draußen bleiben `pending` (noch nicht dran) und `done`. Das bestehende private `ACTIVE_STATES` in `implementationOrder.ts` (Spuren-Zählung) bleibt unberührt.

## Finale AK

- Unter einer aufgeklappten Umsetzung stehen ihre aktiven Stationen in Plan-Reihenfolge; ein Klick öffnet die Session der Station bzw. bei einer Station ohne Session die Umsetzung mit ihrer Karte vorn.
- Bei zugeklapptem Vorhaben stehen nur die Stationen in `NEEDS_USER_STATES` unter dem Vorhaben.
- Im Chat einer Station ist in der Sidebar genau eine Zeile markiert: ihre Stationszeile, sonst die Zeile ihrer Umsetzung.
- Über dem Chat einer Station steht die Rückweg-Leiste mit Rückweg zur Umsetzung und ‹ › zur vorigen bzw. nächsten aktiven Station.
- Beim Öffnen einer Umsetzung steht die erste aktive Phase oben in der Zeitleiste; danach scrollt nichts von selbst, außer der Fokus wandert per Pfeiltaste aus dem Sichtbaren.
- `Ctrl J` springt zur Session/Station, die am längsten auf dich wartet; erneut → die nächste; eine Einblendung sagt „1 von 3 warten auf dich“ bzw. „Gerade wartet niemand auf dich“.
- ADR 056 hält die Änderung an ADR 048 fest; Code-Map und Glossar sind nachgezogen; `pnpm check` grün.
- Abschluss: Minor-Version (neues Verhalten), Ablauf nach `docs/conventions/releases.md`.

## Summary

Der Weg in den Chat einer Station ist kürzer: aktive Stationen stehen als Zeilen unter ihrer Umsetzung in der Sidebar (zugeklappt nur die, die auf dich warten), im Chat einer Station führt die Rückweg-Leiste zur Umsetzung und mit ‹ › zur vorigen bzw. nächsten aktiven Station, die Zeitleiste öffnet bei der ersten aktiven Phase und die Pfeiltasten holen den Fokus ins Bild, `Ctrl J` springt über alle Vorhaben zur Session oder Station, die am längsten auf dich wartet. ADR 056 hält die Änderung an ADR 048 fest. Keine Migration, kein Core.

## Files touched

- `src/app/` (`Sidebar.tsx`, `buildSidebarRows.ts`, `SidebarStation.tsx`/`.css`, `App.tsx`, `App.css`)
- `src/features/implementation/` (`implementationOrder.ts`, `implementationTexts.ts`, `useOpenStation.ts`, `StationTrail.tsx`/`.css`, `Timeline.tsx`, `ImplementationView.tsx`)
- `src/features/waiting/` (`waitingQueue.ts`, `useWaitingJump.ts`, `WaitingJumpNotice.tsx`/`.css`, `waitingTexts.ts`)
- `docs/decisions/056-stationen-in-der-sidebar.md`, `docs/decisions/048-umsetzung.md` (Verweis), `docs/code-map.md`, `docs/glossary.md`

## Commits

- `8edef2d` refactor(implementation): stationLabel in implementationTexts verschieben
- `9f286c6` feat(sidebar): aktive Stationen als Zeilen unter der Umsetzung
- `8aa5270` feat(implementation): Rückweg-Leiste im Chat einer Station
- `864939a` feat(implementation): Zeitleiste öffnet bei der ersten aktiven Phase
- `32905d8` feat(implementation): Ctrl J springt zur nächsten wartenden Session oder Station

## Deviations from plan

- Phase 1: `.sidebar-station--nested` trägt `margin-bottom: -1px; padding-bottom: 1px`, damit die Baumlinie zwischen zwei verschachtelten Zeilen nicht in 1-px-Stücke reißt.
- Phase 2: ‹ liest die letzte Vorgängerin per `filter().pop()`, weil `findLast` in `lib: ES2020` fehlt; der Rückweg-Knopf hat `max-width: 40%` mit Ellipse.
- Phase 4: bei genau einem Eintrag steht „1 von 1 wartet auf dich“ (Singular); der Rahmen der Einblendung steht immer im DOM (`role="status"`), nur der Textkasten wechselt; gehaltenes `Ctrl J` springt nur beim ersten Druck.

## Follow-ups

- Laufzeitbelege in der echten App stehen aus: Markierung der Umsetzungs-Zeile nach „Station fertig“ (`Sidebar.tsx`, `renderImplementation`); `StationTrail.css` (`__back` gegen `__phase` bei schmalem Fenster); `useLayoutEffect` der Zeitleiste (endgültige Höhe beim Öffnen); `Ctrl J` im WebView2 (kein Download-Dialog, im Terminal weiter Zeilenumbruch).
