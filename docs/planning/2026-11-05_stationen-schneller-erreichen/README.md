# Stationen schneller erreichen

Weniger Klicks bis in den Chat einer Station: aktive Stationen stehen als Zeilen in der Sidebar, im Chat einer Station führt eine Leiste zurück und zur nächsten, die Zeitleiste öffnet bei der ersten aktiven Phase, `Ctrl J` springt zur nächsten Session oder Station, die auf dich wartet. Nur Oberfläche, kein Core, keine Migration. Entwürfe: [artifacts/](artifacts/README.md).

## Phasen

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | [Gemeinsame Bausteine + Stationen in der Sidebar](phase-1-sidebar-stationen.md), ADR 056 | standard | complete |
| 2 | [Rückweg-Leiste im Chat einer Station](phase-2-rueckweg-leiste.md) | standard | complete |
| 3 | [Zeitleiste öffnet bei der ersten aktiven Phase](phase-3-zeitleiste-scrollen.md) | standard | complete |
| 4 | [`Ctrl J`: nächste, die auf dich wartet](phase-4-sprung-ctrl-j.md) | standard | pending |

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

## Files touched

## Commits

## Deviations from plan

## Follow-ups
