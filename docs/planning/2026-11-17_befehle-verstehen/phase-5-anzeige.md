# Phase 5 — Anzeige: Statuszeile, Seitenleiste, Befehlszeile

Rating: standard. Die Oberfläche zeigt, was Phase 2 bis 4 liefern, genau nach dem Entwurf: [artifacts/entwurf-befehle-verstehen.html](artifacts/entwurf-befehle-verstehen.html) (Schalter „Figurenpaket“ aus; die acht Zustände über die Knöpfe „Zustand“). Der Entwurf ist verbindlich für Aufbau, Reihenfolge, Texte und Farben; Maße unten.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt („Restdauer und Balken“, Konstanten, Typen `RunStatus`, `AwaitedScript`)
- [artifacts/README.md](artifacts/README.md) — Zustände des Entwurfs und ihre Anker
- `src/features/chat/ChatTimeline.tsx` — `renderStatusLine`, `isWorking`, Bedingung für `AwaitedScriptLine`, Schätzhöhe der Blöcke des Virtualisierers
- `src/features/chat/WorkingIndicator.tsx` + `.css`, `AwaitedScriptLine.tsx`, `ToolGroup.tsx` + `.css`
- `src/features/skins/useStatusFigure.ts`, `statusText.ts` (`formatElapsed`), `useSecondTick.ts`, `fillText.ts`
- `src/app/SidebarItem.tsx` (`sidebar-item__clock`), `src/app/SessionHeader.tsx`, `src/features/sessions/sessionStatus.ts` (`scriptLabel`), `src/features/projects/projectStatus.ts`
- `src/lib/bindings/RunStatus.ts`, `RunProgress.ts`, `AwaitedScript.ts`, `SessionSummary.ts`, `BackgroundItem.ts`
- `src/styles/theme.css` — Tokens (`--color-accent`, `--color-accent-text`, `--color-status-waiting`, `--color-fg-muted`, `--color-border-subtle`, `--font-mono`, `--font-size-2xs`, `--radius-full`, `--duration-base`, `--ease-out`)
- `docs/conventions/react.md`, `typescript.md`, `tailwind.md`
- Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): keine einschlägig.

## Struktur (aus dem Entwurf, prüfbar)

- Statuszeile, Zeile 1, von links: Symbol bzw. Figur · Text (`working-indicator__label`, einzeilig mit Auslassung) · Dauer `· m:ss` (ohne Balken und ohne Schätzung `· läuft m:ss`) · Balken 132 × 6 px mit Wert rechts daneben (`12/40`, `45 %` oder `üblich ~m:ss`) · bei Überziehen die Worte `länger als üblich (~m:ss)` · `· noch <Rest>` · ohne Ausgabe `· noch keine Ausgabe` · `· Esc unterbricht` (nicht beim Warten auf ein Skript). Der Zähler `· n Aufrufe` und das aktive Todo stehen nur, solange kein Lauf gezeigt wird.
- Statuszeile, Zeile 2 (nur mit letzter Ausgabezeile): `⎿` und die Zeile, Monospace 11.5 px, gedämpft, einzeilig mit Auslassung, eingerückt unter den Text (21 px ohne Figur).
- Balken: gemessen = volle Füllung in `--color-accent`; geschätzt = Schraffur 135° in `--color-accent` mit Rand; überzogen = Schraffur in `--color-status-waiting` mit Rand, volle Breite. Spur `--color-border-subtle` (hell) bzw. `--color-border` (dunkel) — den Kontrast Füllung/Spur ≥ 3:1 wie im Entwurf halten. `role="progressbar"` mit `aria-valuenow`, `aria-label` „Fortschritt“ bzw. „Geschätzter Fortschritt“. Füllung wechselt in `--duration-base`, bei `prefers-reduced-motion` ohne Übergang.
- Ein Lauf gilt ab dem Zeitpunkt, zu dem `session.runningCommand` gesetzt und älter als 2 s ist; vorher sieht die Zeile aus wie heute (Zustand „Kurzer Befehl“).

## AK

1. Die acht Zustände des Entwurfs lassen sich im Entwicklungsmodus herstellen und sehen aus wie dort: kurzer Befehl; Fortschritt erkannt; nur Erfahrungswert; erster Lauf; länger als üblich; keine Ausgabe; wartet auf Skript; ohne Beschreibung.
2. Rest und Balken folgen den Regeln „Restdauer und Balken“ des Kontrakts, Format inklusive (`~1:25`, `~41 min`).
3. Die Zeile „Wartet auf: <Beschreibung oder Befehl> …“ erscheint auch **ohne** Figurenpaket, mit denselben Angaben und ohne „Esc unterbricht“.
4. Die Zeile der Session in der Seitenleiste und die Kopfzeile zeigen bei einem Lauf ab 5 s `noch <Rest>`, sonst `12/40` bzw. `45 %`, sonst die Laufzeit; der Tooltip nennt Beschreibung bzw. Befehl. Ohne Lauf wie heute.
5. Die Befehlszeile in `ToolGroup` zeigt nach dem Ende rechts die Dauer (unter 10 s `0,4 s` mit einer Nachkommastelle, sonst `m:ss`), wenn es zum Aufruf einen Hintergrund-Eintrag mit Ende gibt.
6. Beim Wechsel zwischen ein- und zweizeiliger Statuszeile bleibt ein ans Ende gescrollter Verlauf am Ende.
7. Hell und dunkel: Text der Zeile ≥ 4,5:1, Balken gegen Spur ≥ 3:1; keine Information nur über Farbe (jeder Zustand trägt Zahl oder Wort).
8. `pnpm check` grün.

## Checkliste

- [x] `src/features/runs/runTexts.ts`: `LONGRUN_AFTER_MS`, `RUN_VISIBLE_AFTER_MS = 2000`; `formatRest(seconds)`, `formatProgress(progress)` (`12/40` bzw. `45 %`), `runView(run, now)` → `{ elapsedSeconds, fraction: number | null, kind: 'measured' | 'estimated' | 'overdue' | 'none', valueLabel, restLabel, expectedLabel }` nach dem Kontrakt; `formatDuration` für AK 5. Reine Funktionen, keine Uhr darin.
- [x] `src/features/runs/RunMeter.tsx` + `.css` (Block `run-meter`): Balken und Wert; Props `{ kind, fraction, valueLabel, rider?: ReactNode }` (`rider` bleibt bis Phase 6 leer).
- [x] `src/features/runs/useRunView.ts`: nimmt `RunStatus | AwaitedScript | null`, tickt mit `useSecondTick`, liefert `runView` oder `null` (jünger als `RUN_VISIBLE_AFTER_MS`).
- [x] `WorkingIndicator.tsx` + `.css`: neue Props `run: RunView | null`, `lastLine: string | null`; Aufbau nach „Struktur“; die Zeile wird ein Block mit zwei Zeilen (`working-indicator__main`, `working-indicator__last`). Zähler und Todo nur bei `run === null`.
- [x] `ChatTimeline.tsx`: `useRunView(session.runningCommand)` an `WorkingIndicator` geben; `renderStatusLine`: bei `!isWorking && session.awaitedScript !== null` immer die Warte-Zeile (ohne Paket mit dem sachlichen Text des Fachs `wait`), Bedingung in Zeile ~133 (`activeFigures !== null`) entsprechend lockern. Schätzhöhe bzw. Nachmessen des Statusblocks so, dass AK 6 hält.
- [x] `AwaitedScriptLine.tsx`: `pack` wird optional; nutzt `useRunView(script)` und `script.description ?? script.title` als Ziel.
- [x] `statusText.ts`/Aufrufer: `{zeit}`, `{fortschritt}`, `{rest}` aus dem `RunView` füllen (leer ohne Lauf).
- [x] `SidebarItem.tsx`, `SessionHeader.tsx`: Anzeige nach AK 4 über eine gemeinsame Funktion `runClockLabel(view)` in `runTexts.ts`; gilt für `runningCommand` (Status „läuft“) und `awaitedScript`.
- [x] `ToolGroup.tsx` + `.css`: Dauer rechts (`tool-group__duration`, `tabular-nums`, gedämpft); die Dauer kommt aus dem Hintergrund-Eintrag zum `toolUseId` (`buildBlocks.ts` kennt `backgroundByToolUseId` bereits — dort an `ToolEntry` als `durationMs: number | null` hängen).
- [x] `docs/code-map.md`: Zeile „Läufe“ um `src/features/runs/`; Zeile „Chat“ (`WorkingIndicator` zweizeilig, Warte-Zeile ohne Paket).
- [x] `docs/glossary.md`: „Restdauer“, „länger als üblich“.

## Report-Back
