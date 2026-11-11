# Phase 4 — Oberfläche

**Rating:** standard · **Wave:** 3 (parallel zu Phase 3) · **Modell:** sonnet

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans, Abschnitt **Kontrakt** (Einstellung, `waitsForLimit`, `resumesAt`).
- Kein Entwurf vorhanden; die Struktur folgt den bestehenden Zeilen und Zuständen (keine neuen Bauteile).
- Einstellung: `src/features/settings/settingsCatalog.ts` Eintrag `autoCompactStations` (um Zeile 110, Abschnitt „Umsetzungen“, `isShown: isClaudeMode`) und `src/features/settings/SettingsView.tsx` `case 'autoCompactStations'` (um Zeile 456) — 1:1-Muster.
- Stationszustand: `src/features/implementation/implementationTexts.ts` (Fälle `'countdown'` um Zeile 210/234, Gruppen um Zeile 255, Countdown-Text um Zeile 274), `implementationOrder.ts` (Zeile 27), `ImplementationView.tsx` (Zeile 115), `StationCard.tsx` (Zeile 117–132), `src/app/SidebarStation.tsx` (Zeile 16).
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`.
- Fehlerklassen geprüft (Wissensbasis TypeScript, React): keine einschlägig.

## AK

1. Einstellungen → Agent → Abschnitt „Umsetzungen“: Zeile **„Nach Kontingent-Limit automatisch weiter“** mit Schalter, nur in der Betriebsart Claude sichtbar, direkt unter „Zusammenfassen ab“. Info-Text (i-Symbol wie bei den Nachbarn): „Stoppt das Kontingent-Limit eine Station, wartet der Verwalter, bis es sich zurücksetzt, und schickt die Station dann selbst weiter — so läuft eine Umsetzung über Nacht durch. Solange eine Station läuft oder wartet, geht der Rechner nicht in den Ruhezustand; der Bildschirm darf ausgehen. Zuklappen schickt ihn trotzdem schlafen, das regelt Windows unter ‚Beim Zuklappen‘. Einzelne Sessions schickt der Verwalter nie selbst weiter.“
2. Die Suche der Einstellungen findet die Zeile mit „kontingent“ und „nacht“ (Suchbegriffe wie bei den Nachbarn hinterlegt, falls der Katalog solche führt).
3. Station im Zustand `waitsForLimit`: Karte, Zeitleiste und Sidebar zeigen „wartet aufs Kontingent · weiter um HH:MM“ (lokale Uhrzeit aus `resumesAt`, `HH:MM` 24-Stunden); Gruppe wie `'countdown'` unter „läuft“; Reihenfolge in `implementationOrder.ts` direkt nach `'countdown'`.
4. Die vorläufigen Texte aus Phase 2 sind ersetzt.
5. `pnpm check` grün.

## Checkliste

- [x] `settingsCatalog.ts`: Eintrag `autoContinueAtLimit` (Kategorie `agent`, Abschnitt „Umsetzungen“, Label und Info nach AK 1, `isShown: isClaudeMode`).
- [x] `SettingsView.tsx`: `case 'autoContinueAtLimit'` nach Muster `autoCompactStations`.
- [x] `implementationTexts.ts`, `implementationOrder.ts`, `ImplementationView.tsx`, `StationCard.tsx`, `SidebarStation.tsx`: `'waitsForLimit'` nach AK 3.
- [x] `docs/code-map.md` Zeile „Umsetzung“ (Oberfläche): Zustand „wartet aufs Kontingent“ ergänzen.

## Report-Back

Umgesetzt nach AK 1–5; `pnpm check` grün. Keine Such-Schlüsselwörter, da der Katalog keine führt (Label und Info enthalten „Kontingent“ und „Nacht“). `waitsForLimit` bewusst nicht in `BLOCKING_STATES`: eine wartende Station lässt sich abbrechen und löschen. Aufgenommen in `ACTIVE_STATES`, `LIVE_STATES`, `TICKING_STATES`, Phasen-Zusatz „läuft“.
