# Phase 2 — Verlaufszeile im Chat: aufklappbar mit Ausgabe, Beenden, Kopieren

## Kontext

Lesen vor dem Start:

- `AGENTS.md`, `docs/code-map.md` (Zeilen „Hintergrund“, „Chat“), `docs/conventions/react.md`
- `src/features/chat/BackgroundLine.tsx` + `.css` (heute: Klick öffnet die Seitenleiste über `openItem`)
- `src/features/chat/ChatTimeline.tsx` Z. 60–130 (`expandedKeys`, `toolKey`) und Z. 480–505 (Block `tool-group` mit `isExpanded`/`onToggle`, Block `background`)
- `src/features/chat/ToolGroup.tsx` Z. 40–60 (`Chevron`) als Muster für den Pfeil
- `src/features/background/ProcessesTab.tsx` Z. 60–170 (Knöpfe „Im Browser öffnen“, „Beenden“, „Ausgabe kopieren“, Helfer `run`, Verdrahtung `useItemOutput` → `OutputPane`)
- `src/features/background/SubagentsTab.tsx` Z. 40–90 und `stepLines` Z. 155
- `src/features/background/useItemOutput.ts`, `OutputPane.tsx`, `src/lib/background.ts` (`stopBackgroundItem`, `loadBackgroundOutput`), `src/lib/useCopyFeedback.ts` (Pfad per Glob prüfen)
- Vault-Fehlerklassen React/TypeScript geprüft: keine einschlägig.

`BackgroundItem.kind`: `command` | `process` | `subagent`. Die Zeile wird für Werkzeugaufrufe gebaut, zu denen es einen Eintrag gibt (`buildBlocks.ts:44–54`).

## AK

- Klick auf die Zeile klappt auf/zu (Pfeil rechts → unten), öffnet die Seitenleiste nicht mehr; `title` „Details zeigen“ bzw. „Details verbergen“, `aria-expanded`.
- Aufgeklappt, `command`/`process`: Ausgabe in `OutputPane`; läuft der Eintrag, lädt sie alle 2 s nach und folgt dem Ende; beim Zuklappen endet das Nachladen (Komponente wird ausgehängt).
- Aufgeklappt, `subagent`: Schritte (`⎿ tool  target` je Zeile), darunter, falls `item.result !== null`, eine Leerzeile, `Ergebnis:` und das Ergebnis.
- Knopfleiste unter der Ausgabe: „Beenden“ (Gefahr-Stil) nur bei `kind !== 'command' && state === 'running'`, ruft `stopBackgroundItem(sessionId, item.id)`; „Im Browser öffnen“ nur bei `item.url !== null`; „Ausgabe kopieren“ mit Rückmeldung über `useCopyFeedback`. Jeder Knopf hat einen `title` mit dem Hinweistext aus `ProcessesTab`. Fehler einer Aktion → Fehlerleiste der Session (wie `run` in `ProcessesTab`).
- Die Zeile sieht zugeklappt aus wie heute.

## Checkliste

- [ ] `stepLines` aus `SubagentsTab.tsx` als `export function stepLines(steps: readonly SubagentStep[]): string` nach `src/features/background/backgroundItems.ts` verschieben; `SubagentsTab` importiert sie von dort (Datei fällt erst in Phase 3 weg).
- [ ] Neu `src/features/chat/BackgroundDetail.tsx` (+ `.css`, BEM `background-detail__…`): Props `sessionId: string`, `item: BackgroundItem`. Inhalt und Knöpfe laut AK; Verdrahtung und `run`-Helfer aus `ProcessesTab.tsx` übernehmen.
- [ ] `BackgroundLine.tsx`: Props `isExpanded: boolean`, `onToggle: () => void`; `openItem`-Nutzung entfernen; äußerer Wrapper `div.background-line-block`, darin der bestehende `button.background-line` (Klick → `onToggle`, `aria-expanded`), darunter bei `isExpanded` `<BackgroundDetail …/>`. Pfeil wie `Chevron` in `ToolGroup.tsx` (offen = `M3.5 5.5 7 9l3.5-3.5`). Doc-Kommentar der Komponente anpassen.
- [ ] `ChatTimeline.tsx` Block `background` (Z. ~500): `isExpanded={expandedKeys.has(block.key)}` und `onToggle` mit derselben Umschalt-Funktion, die der Block `tool-group` (Z. ~488) für `block.key` nutzt.
- [ ] Docs: `docs/code-map.md` Chat-/Hintergrund-Zeile: `BackgroundLine` klappt auf, `BackgroundDetail` zeigt Ausgabe und Aktionen.
- [ ] `powershell -File scripts/check.ps1` grün.

## Report-Back
