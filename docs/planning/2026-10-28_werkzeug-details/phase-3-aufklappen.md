# Phase 3 — Oberfläche: Aufruf aufklappen

Rating: standard · Wave 3 · setzt Phase 2 voraus

## Kontext (lesen)

- `README.md` dieses Plans: Kontrakt `ToolDetail`.
- `src/features/chat/ToolGroup.tsx` (aktuell: Gruppen-Kopf klappt die Zeilen `⎿ Werkzeug Ziel` auf; Zeilen selbst sind reine Anzeige) und `ToolGroup.css` (BEM, `tool-group__*`).
- `src/features/chat/ChatTimeline.tsx:99` (`expandedKeys`), `:275-282` (`toggleExpanded`), `:436-441` (ToolGroup-Aufruf). `sessionId` kommt in der Datei 5-mal vor (→ in der Phase verifizieren, dass er an der Aufrufstelle verfügbar ist).
- `src/features/chat/buildBlocks.ts` (`ToolEntry`), `src/features/chat/toolSummary.ts`.
- Muster für Laden mit Zustand: `src/features/background/useItemOutput.ts`; Kopieren: `src/features/background/useCopyFeedback.ts` und `OutputPane.tsx` (scrollbare Ausgabe).
- Konventionen: `docs/conventions/react.md`, `typescript.md`, `tailwind.md`; `lang-react`, `mode-web-frontend` (Idiotensicherheit).
- Referenz-Verhalten: VS-Code-Erweiterung von Claude — jeder Aufruf klappt einzeln auf und zeigt Befehl und Ausgabe. Kein Mockup vorhanden → freihändig nach dieser Referenz mit der Struktur aus den AK (vom User im Auftrag so vorgegeben).

## AK

1. Beim Öffnen eines Verlaufs ist **kein** Aufruf aufgeklappt und es wird **kein** `tool_detail` geladen.
2. Jede Zeile in der aufgeklappten Gruppe hat rechts ein Chevron (`⌄`/`›`, 11 px wie im Gruppen-Kopf) und ist ein `button` mit `aria-expanded`; Klick klappt nur diesen Aufruf auf/zu, die Gruppe bleibt offen. Tastatur: Enter/Leertaste.
3. Aufgeklappt stehen unter der Zeile zwei Blöcke: „Eingabe" (bei Bash/PowerShell beschriftet „Befehl") und „Ausgabe", jeweils in einem `pre` in Monospace mit `max-height: 24rem` und eigenem Scrollen; Text ungekürzt bis zum Deckel; Zeilen werden umgebrochen statt horizontal zu scrollen.
4. Ist etwas gekürzt, steht über dem Block „Gekürzt — bei Befehlen nur das Ende, sonst nur der Anfang." (je nach Werkzeug).
5. `missing` → „Für diesen Aufruf wurde nichts gespeichert (älterer Verlauf)."; leere Ausgabe eines beendeten Aufrufs → „Keine Ausgabe."; laufender Aufruf → „Läuft noch — die Ausgabe erscheint, sobald der Aufruf endet." und lädt automatisch nach, wenn sich der Zustand ändert (kein Polling).
6. Jeder Block hat einen Knopf „Kopieren" (wie `useCopyFeedback`: Kopiert/Fehlgeschlagen) mit `title`-Erklärung „Kopiert den ganzen Text in die Zwischenablage."; das Chevron hat `title` „Eingabe und Ausgabe dieses Aufrufs ein-/ausblenden".
7. Ladefehler → eine Zeile „Ausgabe nicht ladbar: …" im Block (Muster `useItemOutput.ts:68`), kein Absturz.
8. Die Zusammenfassung der eingeklappten Gruppe (`groupSummary`) und der Kopf sehen unverändert aus.

## Checkliste

- [ ] `src/features/chat/useToolDetail.ts`: lädt bei `isOpen` einmal, wieder bei Änderung von `state`; Abbruch/Request-Zähler wie `useItemOutput.ts`.
- [ ] `src/features/chat/ToolDetail.tsx` (+ eigene CSS-Klassen `tool-detail__*` in `ToolGroup.css` oder neuer `ToolDetail.css`, BEM): Blöcke laut AK 3-7.
- [ ] `ToolGroup.tsx`: neue Props `sessionId`, `isToolExpanded(toolUseId)`, `onToggleTool(toolUseId)`; Zeilen zu Buttons; `ToolDetail` nur rendern, wenn der Aufruf aufgeklappt ist.
- [ ] `ChatTimeline.tsx`: dieselbe `expandedKeys`-Menge mit Schlüssel `tool:<toolUseId>` nutzen; Props durchreichen.
- [ ] Doc: `docs/code-map.md`-Zeile aus Phase 2 vervollständigen.
- [ ] DoD: `pnpm check` grün; Selbst-Verifikation in der laufenden App (`pnpm tauri dev`): Verlauf mit Bash, Grep, Read öffnen → alles zu; Zeile aufklappen → Befehl + Ausgabe; langes Ergebnis → Scrollbereich + Gekürzt-Hinweis; alten Verlauf öffnen → „älterer Verlauf"; Screenshots (zu/auf/gekürzt/alt) im Report-Back.

## Report-Back
