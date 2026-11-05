# Phase 3 — Zeitleiste öffnet bei der ersten aktiven Phase

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Kontrakt-Sektion — [README.md](README.md)
- Entwurf G im Artefakt: [artifacts/stationen-schneller-erreichen.html](artifacts/stationen-schneller-erreichen.html)
- `docs/conventions/react.md`
- Code: `src/features/implementation/ImplementationView.tsx` (`renderBody`, Div `.implementation-view__timeline`, `handleKeyDown` der Pfeiltasten), `ImplementationView.css` (die Zeitleiste rollt nur im breiten Layout selbst; unter 900 px rollt die ganze Fläche), `Timeline.tsx` (`renderPhase`, `renderWaveHeader`, `renderStation`, `renderMarker`), `implementationOrder.ts` (`liveStations`, `phaseGroups`), `src/app/Sidebar.tsx` (Muster für ein Effekt mit absichtlich verkürzten Abhängigkeiten samt `eslint-disable`-Begründung)
- Vault-Fehlerklassen: keine einschlägig (siehe Phase 1).

## AK dieser Phase

1. Öffnen einer Umsetzung (bzw. Rückkehr aus „Changes“ in „Ablauf“) im breiten Layout: Der Kopf der ersten Phase, die eine aktive Station hat, steht oben im sichtbaren Bereich der Zeitleiste. Ist diese Phase die erste ihrer Welle, steht stattdessen die Wellen-Überschrift oben.
2. Keine aktive Station, aber nicht alles fertig: Ziel ist die Phase `phases[currentPhase - 1]`. Alles fertig (`stationsDone === stationsTotal`): kein Scrollen.
3. Danach scrollt die Zeitleiste nicht mehr von selbst, auch nicht, wenn Stationen den Zustand wechseln (gleiche Umsetzungs-ID = kein neues Öffnen).
4. Wandert der Fokus per Pfeiltaste auf eine Zeile außerhalb des sichtbaren Bereichs, rückt sie gerade so ins Bild (`block: 'nearest'`). Klick und automatischer Fokuswechsel scrollen nicht.
5. Im schmalen Layout (unter 900 px) scrollt beim Öffnen nichts. `pnpm check` grün.

## Checkliste

- [ ] `Timeline.tsx`:
  - Phasenkopf-Zeile (`timeline__phase`) und die Zeile einer Phase mit nur einer Station (Zweig `only !== undefined && phaseRefs.length === 1`) bekommen `data-scroll-anchor={phase.id}` — **außer** die Phase ist die erste ihrer Welle (`context.isWave` und Index 0 in `group.phases`); dann trägt die Wellen-Überschrift aus `renderWaveHeader` `data-scroll-anchor={group.phases[0].id}`. Dafür `renderPhase` einen Parameter `isAnchor: boolean` geben: `renderGroup` übergibt `true` für Phasen ohne Welle und für Wellen-Phasen mit Index > 0, `false` für Index 0 einer Welle. Ergebnis: je Phase genau ein Element mit ihrem Anker.
  - `renderStation` setzt am Zeilen-Div `data-focus-id={ref.station.id}`, `renderMarker` `data-focus-id={focusId}`.
- [ ] `implementationOrder.ts`: neue Funktion
  ```ts
  /** Phase, bei der die Zeitleiste öffnet: die der ersten aktiven Station, sonst die erste nicht fertige; `null`, wenn alles fertig ist. */
  export function openingPhase(implementation: ImplementationView): PhaseView | null
  ```
  Körper: `liveStations(implementation)[0]?.phase` → sonst `implementation.stationsDone === implementation.stationsTotal ? null : (implementation.phases[implementation.currentPhase - 1] ?? null)`.
- [ ] `ImplementationView.tsx`:
  - `const timelineRef = useRef<HTMLDivElement>(null)` an `<div className="implementation-view__timeline">`.
  - `useLayoutEffect`, Abhängigkeiten `[implementationId, isFlow]` (verkürzt, mit Kommentar „Nur das Öffnen scrollt, nicht jede neue Fassung der Umsetzung“ und `// eslint-disable-next-line react-hooks/exhaustive-deps` wie in `Sidebar.tsx`): wenn `!isFlow` → nichts. `const phase = openingPhase(implementation)`; `null` → nichts. `const container = timelineRef.current`; `const anchor = container?.querySelector<HTMLElement>(`[data-scroll-anchor="${CSS.escape(phase.id)}"]`)`; fehlt einer → nichts. Sonst `container.scrollTop += anchor.getBoundingClientRect().top - container.getBoundingClientRect().top`. (Im schmalen Layout hat das Div `overflow-y: visible`; `scrollTop` bleibt dort wirkungslos — gewollt, AK 5.)
  - In `handleKeyDown` nach `setFocused(implementationId, target)`: `requestAnimationFrame(() => { timelineRef.current?.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(target)}"]`)?.scrollIntoView({ block: 'nearest' }); })`.
- [ ] Keine Doku-Änderung außer dem Kommentar an `openingPhase`; die Code-Map nennt die Dateien schon.

## Report-Back
