# Phase 3 — Seitenleiste nur Nebenfragen, Fragezeichen, Aufräumen

## Kontext

Lesen vor dem Start:

- `AGENTS.md`, `docs/code-map.md` Z. 17, 47, 49, 79, 83; `docs/glossary.md` Z. 113–116, 122, 133; `docs/decisions/007-anhaenge-skills-hintergrund.md`, `docs/decisions/044-nebenfragen.md` (Dateinamen per Glob prüfen)
- `docs/conventions/rust.md`, `docs/conventions/linting.md`
- `src/features/background/BackgroundPanel.tsx`, `src/stores/background.ts`, `src/features/side/SideTab.tsx`, `src/features/side/useSideQuestions.ts`
- `src/app/SessionHeader.tsx` Z. 25–31 (Label/Titel) und Z. 338–380 (Knopf mit Punkt und Terminal-Symbol), `src/app/App.tsx` (Nutzer von `countRunning`, `runningBackgroundCount`, Panel Z. ~500–515)
- `src-tauri/src/commands/background.rs`, `src-tauri/src/lib.rs` Z. 205–220
- Vault-Fehlerklassen React/TypeScript/Rust geprüft: keine einschlägig.

Verstanden (Chesterton): Die Reiter Prozesse/Subagenten/Scratchpad waren die Oberfläche für Hintergrundprozesse (ADR 007) und der einzige Ort zum Beenden; Beenden und Ausgabe leben seit Phase 2 in der Chat-Zeile, der Scratchpad unter „Session-Dateien“ (ADR 071). Die Erfassung der Prozesse im Kern (`background_load`, Ereignis `background://changed`, Ruhe-Logik) bleibt unangetastet — Chat-Zeilen und Dauer-Anzeige brauchen sie.

## AK

- Die Seitenleiste zeigt ohne Reiterleiste nur `SideTab`, mit Kopf „Nebenfragen“ und Schließen-Knopf wie bisher.
- Kopfzeilen-Knopf: Fragezeichen-Symbol (SVG 14×14: Kreis `cx=7 cy=7 r=5.5`, Pfad `M5.3 5.4a1.8 1.8 0 1 1 2.5 1.6c-.5.3-.8.6-.8 1.2v.3`, Punkt `cx=7 cy=10.3 r=.7` gefüllt; Strich `currentColor`, 1.3), Text „Nebenfragen“, dahinter die Zahl der Nebenfragen (`useSideQuestions(session.id)`, Länge der Liste, nur > 0), `title` „Nebenfragen dieser Session — Strg+; stellt eine neue“. Kein Lauf-Punkt mehr.
- Gelöscht (Frontend): `ProcessesTab.tsx`, `SubagentsTab.tsx`, `ScratchpadTab.tsx/.css`, `buildPanelRows.ts`, `buildScratchpadRows.ts`, `VirtualPanelList.tsx/.css`, `PanelLayout.tsx/.css`, `DetailHead.tsx/.css`, `useScratchpad.ts`, `useScratchpadFile.ts`; in `backgroundItems.ts` `splitProcesses`, `selectSubagents`, `pickSelected`, `countRunning`; in `src/lib/background.ts` `listScratchpad`, `readScratchpadFile`.
- Bleiben: `OutputPane`, `useItemOutput`, `BackgroundRow`, `backgroundLabels`, `useSessionBackground`, `indexByToolUseId`, `commandDurations`, `loadBackground`, `onBackgroundChanged`, `loadBackgroundOutput`, `stopBackgroundItem`, `mention.ts`, `useNow`, `useCopyFeedback`, `BackgroundPanel.css`, Panelbreite `background`.
- `stores/background.ts`: nur noch `isOpen`, `toggle`, `close`, `selections` für Nebenfragen (`select(sessionId, id)` ohne Reiter-Argument; `SideTab` angepasst). `BACKGROUND_TABS`, `tab`, `showTab`, `openItem` entfernt.
- Kern: Befehle `scratchpad_list` und `scratchpad_read` samt Registrierung in `lib.rs` entfernt; darunterliegende Funktionen nur löschen, wenn danach ohne Aufrufer (Clippy/`dead_code`); `pnpm bindings`; verwaiste Bindings `ScratchpadListing.ts`/`ScratchpadEntry.ts` löschen, falls nicht neu erzeugt.
- `rg` über `src/` und `src-tauri/src/` nach jedem gelöschten Namen: kein Treffer. `pnpm check` grün.

## Checkliste

- [ ] `BackgroundPanel.tsx` auf `SideTab` reduzieren (Reiterleiste, `countFor`, `renderTab`, Imports der Reiter weg).
- [ ] `stores/background.ts` verschlanken laut AK; `SideTab.tsx` auf neue `select`-Signatur.
- [ ] `SessionHeader.tsx`: `BACKGROUND_LABEL` → `'Nebenfragen'`, `BACKGROUND_TITLE` laut AK, Knopf-SVG tauschen, Punkt-SVG und `runningBackgroundCount`-Prop entfernen, Zähler aus `useSideQuestions`. `App.tsx`: `countRunning`-Aufruf und Prop-Weitergabe entfernen.
- [ ] Dateien und Funktionen laut AK löschen; Imports nachziehen.
- [ ] Kern: Befehle entfernen, `pnpm bindings`, Bindings prüfen.
- [ ] Docs: Code-Map (Z. 17, 47, 49, 79, 83), Glossar (Hintergrund-Panel → „Nebenfragen-Leiste“, Z. 113–116, 122, 133), `docs/PROJECT.md` Stellen zum Hintergrund-Panel prüfen; neue `docs/decisions/076-nebenfragen-leiste.md` (Kontext / Optionen: Leiste behalten · Prozesse behalten · nur Nebenfragen + Chat-Zeile / Entscheidung / Konsequenzen; verweist auf ADR 007, 044, 071).
- [ ] `powershell -File scripts/check.ps1` grün.

## Report-Back
