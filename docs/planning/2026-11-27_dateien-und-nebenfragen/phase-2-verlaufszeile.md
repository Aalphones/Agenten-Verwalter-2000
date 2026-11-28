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
- Kern: `src-tauri/src/background/model.rs` (`SubagentStep`, `BackgroundItem.steps`), `src-tauri/src/sessions/registry.rs` Z. ~3441–3466 (`AgentEvent::SubagentStep` hängt Schritte an, `MAX_SUBAGENT_STEPS = 200` in Z. 114; `AgentEvent::SubagentText` überschreibt heute `result`), `src-tauri/src/agents/claude/translate.rs` `subagent_events` (Z. ~620), `src-tauri/src/db/background.rs` (Eintrag als JSON-Nutzlast gespeichert)
- Entwurf (verbindlich): [artifacts/entwurf-verlaufszeile.html](artifacts/entwurf-verlaufszeile.html)
- Vault-Fehlerklassen React/TypeScript/Rust geprüft: keine einschlägig.

`BackgroundItem.kind`: `command` | `process` | `subagent`. Die Zeile wird für Werkzeugaufrufe gebaut, zu denen es einen Eintrag gibt (`buildBlocks.ts:44–54`).

Heute schneidet der Kern vom Subagenten nur Werkzeug + Ziel je Schritt mit; jeder Zwischentext überschreibt `result`, sodass nur der letzte bleibt. Neu: Texte stehen als eigene Schritte in Reihenfolge zwischen den Werkzeugaufrufen. `result` behält sein heutiges Verhalten (letzter Text).

## AK

- Klick auf die Zeile klappt auf/zu (Pfeil rechts → unten), öffnet die Seitenleiste nicht mehr; `title` „Details zeigen“ bzw. „Details verbergen“, `aria-expanded`.
- Aufgeklappt, `command`/`process`: Ausgabe in `OutputPane`; läuft der Eintrag, lädt sie alle 2 s nach und folgt dem Ende; beim Zuklappen endet das Nachladen (Komponente wird ausgehängt).
- Kern: `SubagentStep` bekommt `#[serde(default)] pub text: Option<String>`. Ein Textschritt hat `tool: ""`, `target: ""`, `text: Some(…)`; Werkzeugschritte `text: None`. Beim `AgentEvent::SubagentText` wird zusätzlich zum bisherigen `result = Some(text)` ein Textschritt angehängt, Text auf höchstens 2000 Zeichen gekürzt (an Zeichengrenze, `…` angehängt). Beide Schrittarten zählen gemeinsam gegen `MAX_SUBAGENT_STEPS`. Alte gespeicherte Einträge ohne `text` laden weiter (`serde(default)`).
- Aufgeklappt, `subagent`: Zustandszeile mit Modell; darunter die Schritte in Reihenfolge — Textschritt als Fließtext (Sans, `--color-fg-primary`), Werkzeugschritt als `⎿ tool  target` (Mono). Darunter: mit `result` „Ergebnis“ + Ergebnis (nur wenn `state !== 'running'`); läuft er, der Hinweis „Ergebnis folgt, sobald der Subagent fertig ist.“; bei `stopped` „Beendet auf Wunsch.“. Läuft er, folgt die Ansicht dem Ende (wie beim Prozess). Aussehen nach Entwurf.
- Knopfleiste unter der Ausgabe: „Beenden“ (Gefahr-Stil) nur bei `kind !== 'command' && state === 'running'`, ruft `stopBackgroundItem(sessionId, item.id)`; „Im Browser öffnen“ nur bei `item.url !== null`; „Ausgabe kopieren“ mit Rückmeldung über `useCopyFeedback`. Jeder Knopf hat einen `title` mit dem Hinweistext aus `ProcessesTab`. Fehler einer Aktion → Fehlerleiste der Session (wie `run` in `ProcessesTab`).
- Die Zeile sieht zugeklappt aus wie heute.

## Checkliste

- [x] Kern: Feld `text` in `SubagentStep` (`model.rs`), Werkzeugschritt in `registry.rs` mit `text: None`, Textschritt beim `SubagentText` laut AK (Kürzen als kleine Funktion `clip_step_text` neben dem Handler); `pnpm bindings`. `stepLines` in `SubagentsTab.tsx` überspringt Textschritte (`step.text !== null` → auslassen), damit der alte Reiter bis Phase 3 weiter läuft.
- [x] Neu `src/features/chat/BackgroundDetail.tsx` (+ `.css`, BEM `background-detail__…`): Props `sessionId: string`, `item: BackgroundItem`. Prozess/Befehl: `useItemOutput` → `OutputPane`. Subagent: eigene Liste der Schritte laut AK in einem scrollbaren Rahmen wie `OutputPane` (höchstens 240 px hoch). Knöpfe laut AK; Verdrahtung und `run`-Helfer aus `ProcessesTab.tsx` übernehmen.
- [x] `BackgroundLine.tsx`: Props `isExpanded: boolean`, `onToggle: () => void`; `openItem`-Nutzung entfernen; äußerer Wrapper `div.background-line-block`, darin der bestehende `button.background-line` (Klick → `onToggle`, `aria-expanded`), darunter bei `isExpanded` `<BackgroundDetail …/>`. Pfeil wie `Chevron` in `ToolGroup.tsx` (offen = `M3.5 5.5 7 9l3.5-3.5`). Doc-Kommentar der Komponente anpassen.
- [x] `ChatTimeline.tsx` Block `background` (Z. ~500): `isExpanded={expandedKeys.has(block.key)}` und `onToggle` mit derselben Umschalt-Funktion, die der Block `tool-group` (Z. ~488) für `block.key` nutzt.
- [x] Docs: `docs/code-map.md` Chat-/Hintergrund-Zeile: `BackgroundLine` klappt auf, `BackgroundDetail` zeigt Ausgabe und Aktionen.
- [x] `powershell -File scripts/check.ps1` grün.

## Report-Back

Status: complete. Prüfkette grün (Schritte von `scripts/check.ps1` einzeln, weil die Ausführungsrichtlinie das Skript sperrte). Nicht in der laufenden App geprüft.

- Der letzte Textschritt wird ausgeblendet, wenn er dem darunter stehenden „Ergebnis“ entspricht (sonst doppelt).
- Zustandszeile auch bei Befehl und Prozess (Entwurf); Zustandswörter wie in der zugeklappten Zeile („fertig“, „angehalten“).
- Zugeklappte Zeile unverändert, auch schmal (der Umbruch des Entwurfs unter 560 px ist nicht übernommen); neu nur die Hover-Farbe.
- Aktionsfehler stehen in der Fehlerleiste der Session; „Beenden“ ist bis zur Meldung des Agenten gesperrt („Wird beendet …“).
- Gemeinsam ausgelagert: `useStickToBottom`, `outputNotice`.
