# Phase 2 — Chip und Menü auf der Karte

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Entscheidungen, Kontrakt — [README.md](README.md)
- Entwurf zum Anklicken (verbindlich für Aufbau, Zustände und Texte): [artifacts/station-modell-chip.html](artifacts/station-modell-chip.html)
- `docs/conventions/react.md`, `docs/conventions/tailwind.md`
- Code: `src/features/implementation/StationCard.tsx` + `.css` (Kopfzeile `station-card__head`), `CardStack.tsx` (reicht Props an die Karte), `ImplementationView.tsx` (`focusedSession`, `run(...)`, Muster der Rückrufe um Zeile 233), `src/components/ModelMenu.tsx` + `.css`, `EffortDots.tsx` + `.css`, `Popover.tsx`, `src/features/promptcache/CacheAwareModelMenu.tsx`, `src/lib/labels.ts` (`MODEL_OPTIONS`, `EFFORT_OPTIONS`, `modelName`, `effortLabel`), `src/lib/sessions.ts` (`setSessionModel`, `setSessionEffort`), `src/features/chat/Composer.tsx` (Chip-Knopf Zeile ~424 als Muster für `aria-haspopup`/`aria-expanded`)
- Vault-Fehlerklassen: keine einschlägig (React-Komponente im Muster des Bestands).

## AK dieser Phase

1. Kopfzeile der Karte: links der Titel, rechts der Chip, dahinter die Sessionnummer. Statuszeile: Text links, bei Abweichung rechts „geplant: {Modell} · {Aufwand}“ in Warnfarbe.
2. Chip-Text: `{Modellname aus MODEL_OPTIONS} · {Aufwand klein geschrieben}` (z. B. „Sonnet 5.5 · hoch“). Fehlt Modell oder Aufwand im Plan: „Standard“ an dieser Stelle. Vor dem Start gestrichelter Rand, Grau, Zusatz „(Plan)“. Läuft die Station: Werte der Session, grün; weichen sie vom Plan ab, gelb.
3. Klick auf den Chip öffnet das Menü unter dem Chip, rechtsbündig, Breite 340 px: oben Zeile „Denkaufwand (Mittel)“ mit den fünf Punkten (`EffortDots`), darunter „Modell für diese Session“ und die fünf Modelle (Name fett, Hinweis, Haken, Hover) — dieselben Komponenten wie im Chat. Auswahl wirkt sofort, das Menü bleibt offen; Esc, Klick daneben und erneuter Klick auf den Chip schließen.
4. Vor dem Start (kein `sessionId`, nicht fertig, nicht `byUser`): Auswahl ruft `setStationPlan(implementationId, stationId, model, effort)`; Fußnote „Ändert den Plan dieser Station. Der Start nutzt diese Werte.“
5. Läuft die Station (`sessionId` gesetzt, Zustand nicht `done`): Auswahl ruft `setSessionModel` bzw. `setSessionEffort`; das Menü trägt den Cache-Warnkasten wie im Chat (`CacheAwareModelMenu`-Logik) und die Fußnote „Wirkt sofort auf die laufende Session.“; bei Abweichung zusätzlich die Zeile „Auf Plan zurücksetzen (…)“, die beide Werte der Session auf den Plan setzt (Plan ohne Wert für ein Feld: dieses Feld unverändert lassen).
6. Fertige Stationen und `byUser`-Stationen: Chip ist ein `span` ohne Menü (bei `byUser` ohne Chip, wenn beide Plan-Werte fehlen). Fehler der Aufrufe erscheinen über das vorhandene `run(...)` der Ansicht als Aktionsfehler.
7. Der Chip hat `aria-label` „Modell: {…}, Denkaufwand {…}“, `aria-haspopup="dialog"`, `aria-expanded`; Tooltip (`title`): vor dem Start „Modell und Denkaufwand dieser Station (Plan)“, laufend „Modell und Denkaufwand dieser Session“. `pnpm check` grün.

## Checkliste

- [x] `ModelMenu.tsx`: neue optionale Prop `leading?: ReactNode`; wenn gesetzt, steht sie als erstes Kind im `Popover` und danach ein Trenner `<div className="model-menu__sep" />` (CSS: `margin: 3px 0; border-top: 1px solid var(--color-border-subtle)`). `CacheAwareModelMenu.tsx` reicht `leading` durch (neue optionale Prop). Bestehende Aufrufer bleiben unverändert.
- [x] `ModelMenu` kann die Lage selbst bestimmen: `placement` ist Pflicht-Prop — die Karte übergibt `'below'`; `align` bleibt im Popover fest `start`, deshalb neue optionale Prop `align?: 'start' | 'end'` (Standard `'start'`), die an `Popover` geht. Die Karte übergibt `'end'`.
- [x] Neu `src/features/implementation/StationModelChip.tsx` + `StationModelChip.css`, BEM-Block `station-chip`.
  ```ts
  interface StationModelChipProps {
    station: StationView;
    /** Session der Station; `null` vor dem Start. */
    session: SessionSummary | null;
    onPickPlan: (model: ModelId | null, effort: Effort | null) => void;
    onPickModel: (model: ModelId) => void;
    onPickEffort: (effort: Effort) => void;
  }
  ```
  - Eigener Zustand `isOpen`; der Chip-Knopf liegt in einem `position: relative`-Container (Vorgabe von `Popover`), das Menü steht daneben.
  - Modus: `done` → statisch; `session !== null` → laufend; sonst Plan. Werte laufend = `session.model` / `session.effort`, Plan = `station.model` / `station.effort`.
  - Abweichung: laufend und (`station.model !== null && station.model !== session.model` oder `station.effort !== null && station.effort !== session.effort`).
  - Menü Plan: `ModelMenu<ModelId | ''>` mit `options={MODEL_OPTIONS}`, `value={station.model ?? ''}` (ohne Plan-Modell steht kein Haken) und `leading={<EffortDots …/>}`. Der Handler `onChange` bekommt `ModelId | ''`; Auswahl → `onPickPlan(model === '' ? null : model, station.effort)`. Der Aufwand-Handler ruft `onPickPlan(station.model, effort)`. `EffortDots` zeigt bei fehlendem Plan-Aufwand `'medium'`, ohne zu speichern, bis der Nutzer klickt.
  - Menü laufend: `CacheAwareModelMenu` mit `session`, `leading`, `note`, `onChange={onPickModel}`; `EffortDots` mit `session.effort` und `onChange={onPickEffort}`.
  - Texte als Konstanten in `implementationTexts.ts`: `CHIP_PLAN_TITLE`, `CHIP_LIVE_TITLE`, `CHIP_NOTE_PLAN`, `CHIP_NOTE_LIVE`, `CHIP_PLAN_SUFFIX = '(Plan)'`, `CHIP_DEFAULT = 'Standard'`, `CHIP_RESET_LABEL` (Funktion mit Plan-Text), `plannedHint(station)`.
  - CSS: Chip wie `composer__model` (Pille, `var(--color-bg-hover)`), Zustände `--plan` (gestrichelt `var(--color-border)`, `var(--color-fg-muted)`), `--ok` (`color-mix` aus `var(--color-status-completed)`), `--warn` (aus `var(--color-status-waiting)`); Fokus-Ring wie `station-card__button:focus-visible`.
- [x] `StationCard.tsx`: neue Props `session: SessionSummary | null`, `onPickPlan`, `onPickModel`, `onPickEffort`; Kopfzeile wie in AK 1 (rechter Container mit Chip und `station-card__number`), Statuszeile als Flex-Zeile mit `plannedHint`. Die `title`-Texte aus AK 7 hier und im Chip konsistent halten.
- [x] `CardStack.tsx`: Props durchreichen (`session`, `onPickPlan`, `onPickModel`, `onPickEffort`).
- [x] `ImplementationView.tsx`: `focusedSession` an `CardStack` geben; Rückrufe nach dem Muster von `onStart`:
  - `onPickPlan` → `run(() => setStationPlan(implementationId, stationId, model, effort), 'Plan nicht geändert')`,
  - `onPickModel` / `onPickEffort` → `run(() => setSessionModel(sessionId, model))` bzw. `setSessionEffort`.
  Die Rückrufe bekommen `stationId` als erstes Argument wie `onStart`.
- [x] Idiotensicherheits-Gate: Chip trägt Tooltip (AK 7); das Menü erklärt sich durch Fußnote und Warnkasten; keine weitere Doku.
- [x] Doc-Updates: `docs/code-map.md` — Zeile der Umsetzung um `StationModelChip.tsx` (Modell-Chip der Karte) ergänzen; `docs/glossary.md` — Eintrag **Modell-Chip** (Chip auf der Stationskarte: Modell und Denkaufwand, Plan vor dem Start, Session danach).
- [x] Selbstabgleich am Plan-Ende: AK 1–7 und die finalen AK der README am Code und im laufenden Verwalter durchgehen; die Wackelstellen stehen unten in „Follow-ups“ der README, nicht als Abnahmeliste.

## Report-Back
nChip, Menü (`leading`, `align`) und Verdrahtung stehen; `pnpm check` grün. Laufzeitbeleg in der echten App steht aus.
