# Phase 1 — Statuszeile nennt das Werkzeug, Taktung, Denken live

Rating: standard. Noch ohne Pakete: die Statuszeile („arbeitet …“ unten im Chat) sagt sachlich, was gerade läuft, wechselt ruhig und zeigt beim Denken die Sekunden.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Fächer, Platzhalter), [ADR 065](../../decisions/065-skins.md)
- `src/features/chat/WorkingIndicator.tsx` + `.css` — heutige Zeile: Symbol, `label`, „· Esc unterbricht“
- `src/features/chat/ChatTimeline.tsx` — `isWorking`, `workingLabel = findActiveTodoLabel(entries)`, `renderBlock(undefined)` rendert `<WorkingIndicator label={workingLabel} />`
- `src/lib/bindings/ChatEntry.ts` — Eintrag `{ kind: "tool", seq, toolUseId, tool, target, state }`, `ToolState = "running" | "done" | "failed" | "interrupted"`
- `src-tauri/src/agents/claude/translate.rs` — `handle_system`, Zweig `"thinking_tokens"` setzt nur `thinking_started`; `take_thinking_seconds`
- `src-tauri/src/agents/event.rs` — `AgentEvent`
- `src-tauri/src/sessions/model.rs` — `SessionSummary`, Muster `AwaitedScript.started_at` (ms seit Epoche)
- `src-tauri/src/sessions/registry.rs` — `apply_event`, `fn awaited_script`, Bau von `SessionSummary` (Feld `awaited_script: state.awaited_script()`)
- `docs/conventions/typescript.md`, `react.md`, `rust.md`
- Fehlerklassen geprüft (Vault `sprachen/typescript`, `frameworks/react`): keine einschlägig.

## AK

1. Läuft ein Werkzeug, zeigt die Zeile den Text des Fachs mit ersetztem `{ziel}`: z. B. `Read` mit Ziel `ChatTimeline.tsx` → „Liest ChatTimeline.tsx …“; `mcp__x__y` → „Arbeitet mit mcp__x__y …“ (Fach „Sonstiges“, `{ziel}` = Werkzeugname, wenn das Ziel leer ist).
2. Rechts davon `· <n> Aufrufe` (Werkzeug-Einträge seit der letzten Benutzernachricht; bei 1 „· 1 Aufruf“), danach gedämpft der Text des aktiven Todos, falls einer läuft, dann „· Esc unterbricht“.
3. Wechselt die Werkzeug-Art (anderes Fach), wechselt der Text frühestens 4 s nach dem letzten Wechsel; gleiches Fach → kein Wechsel. Die ersten 1 s nach Beginn der Arbeit steht „Arbeitet …“.
4. Denkt der Agent (Kern meldet `thinkingSince`) und läuft kein Werkzeug, zeigt die Zeile „Denkt nach …“ und `· <s> s`, sekündlich hochgezählt; Text-Index = `floor(s / 10)` (letzter Text bleibt stehen).
5. Endet das Denken (Gedankengang-Eintrag, Werkzeugstart, Antworttext oder Turn-Ende), ist `thinkingSince` wieder `null`.
6. `pnpm check` grün; `pnpm bindings` ausgeführt.

## Checkliste

### Kern: Denken beginnt

- [x] `agents/event.rs`: Variante `AgentEvent::ThinkingStarted` (ohne Felder).
- [x] `translate.rs`, Zweig `"thinking_tokens"`: war `thinking_started` `None`, setzen und `vec![AgentEvent::ThinkingStarted]` liefern, sonst `Vec::new()`.
- [x] `sessions/model.rs`: `SessionSummary.thinking_since: Option<f64>` (ms seit Epoche, Kommentar wie bei `AwaitedScript.started_at`).
- [x] `registry.rs`: Feld `thinking_since: Option<f64>` im Session-Zustand; in `apply_event` bei `ThinkingStarted` auf jetzt setzen (dieselbe Uhr wie `BackgroundItem.started_at`) und `session://changed` senden; bei `Thinking`, `ToolStarted`, jedem Text des Assistenten und beim Wechsel des Status weg von `Running` auf `None` setzen (nur wenn vorher `Some`, dann senden). In den Bau von `SessionSummary` übernehmen.
- [x] Andere Betriebsarten (Autark, Codex) senden kein `ThinkingStarted`; nichts weiter tun.

### Oberfläche

- [x] `src/features/skins/slotCatalog.ts`: `export type BuiltinSlotId = 'search' | 'read' | 'write' | 'shell' | 'web' | 'agent' | 'other' | 'wait' | 'think' | 'commit' | 'station'`; `BUILTIN_TOOL_SLOTS: Record<string, BuiltinSlotId>` = `Grep, Glob → search`, `Read → read`, `Edit, Write, NotebookEdit → write`, `Bash, PowerShell → shell`, `WebSearch, WebFetch → web`, `Agent, Task → agent`; `PLAIN_TEXTS: Record<BuiltinSlotId, string>` = search „Durchsucht {ziel} …“, read „Liest {ziel} …“, write „Bearbeitet {ziel} …“, shell „Führt {ziel} aus …“, web „Sucht im Web nach {ziel} …“, agent „Unteragent: {ziel} …“, other „Arbeitet mit {ziel} …“, wait „Wartet auf {ziel} …“, think „Denkt nach …“, commit „Commit {commit} erstellt.“, station „Station fertig.“; `SLOT_LABELS` (Suchen, Lesen, Schreiben, Befehl, Web, Unteragent, Sonstiges, Warten, Denken, Commit, Station fertig).
- [x] `src/features/skins/matchSlot.ts`: `globToRegExp(pattern)` (`*` → `.*`, `?` → `.`, übrige Sonderzeichen escapen, `^…$`, Flag `i`); `matchesAny(patterns: string, text: string)` (Komma trennt, leere Teile ignorieren); `slotFor(tool: string, target: string, custom: readonly CustomSlotMatch[]): string` — erst `custom` in Reihenfolge (`tools` muss passen, `input` falls gesetzt auch, gegen `target`), Rückgabe `custom.id`; sonst `BUILTIN_TOOL_SLOTS[tool] ?? 'other'`. `CustomSlotMatch = { id: string; tools: string; input: string | null }`. In Phase 1 wird `custom` immer `[]` übergeben.
- [x] `src/features/skins/fillText.ts`: `fillText(template, { ziel, zeit, commit })` ersetzt alle Vorkommen.
- [x] `src/features/skins/useStatusFigure.ts`: Hook `useStatusFigure({ entries, isWorking, thinkingSince })` → `{ slot: string; target: string; textIndex: number | null; calls: number; thinkingSeconds: number | null }`. Konstanten `MIN_STAND_MS = 4000`, `FIRST_AFTER_MS = 1000`, `THINK_TEXT_STEP_S = 10`. Laufendes Werkzeug = jüngster Eintrag `kind === 'tool'` mit `state === 'running'`. Gewünschtes Fach = `slotFor(...)`, beim Denken ohne laufendes Werkzeug `'think'`. Wechsel nur, wenn seit `isWorking`-Beginn ≥ `FIRST_AFTER_MS` und seit letztem Wechsel ≥ `MIN_STAND_MS`; sonst Zeitgeber auf den frühesten Zeitpunkt, dann das dann gewünschte Fach. Beim Denken sekündlicher Takt. Bei `isWorking === false` alles zurücksetzen. Zeitgeber in `useEffect` mit Aufräumen.
- [x] `WorkingIndicator.tsx`: Props `{ text: string; calls: number; todo: string | null; thinkingSeconds: number | null; figure?: ReactNode }` (`figure` bleibt in Phase 1 leer). Aufbau: `figure` · `working-indicator__label` (Text) · `working-indicator__count` („· 3 Aufrufe“ bzw. „· 12 s“ beim Denken) · `working-indicator__todo` (gedämpft, gekürzt) · `working-indicator__hint`. Text wechselt mit 200 ms Einblenden (CSS-Klasse, bei `prefers-reduced-motion` ohne).
- [x] `ChatTimeline.tsx`: `useStatusFigure` aufrufen; Text = `fillText(PLAIN_TEXTS[slot] ?? PLAIN_TEXTS.other, { ziel: target || toolName, zeit: '', commit: '' })` – vor Ablauf von `FIRST_AFTER_MS` „Arbeitet …“; `todo = findActiveTodoLabel`-Ergebnis, aber `null` statt `WORKING_FALLBACK_LABEL`.
- [x] `pnpm bindings` (neues Feld `thinkingSince`).

### Doku

- [x] `docs/code-map.md`: neue Zeile „Skins“ (vorerst `src/features/skins/` mit `slotCatalog`, `matchSlot`, `fillText`, `useStatusFigure`); Zeile Chat um `thinking_since` ergänzen.
- [x] `docs/glossary.md`: „Statuszeile“, „Fach“ (Werkzeug-Art mit Text, später Figur), „Taktung“.

## Report-Back

Status: complete. `pnpm bindings` und `pnpm check` (Lint, Typecheck, Prettier, Build, rustfmt, Clippy) grün; keine Tests (Profil private), nicht in der echten App gelaufen.

- Kern: `AgentEvent::ThinkingStarted` aus `thinking_tokens` (nur einmal je Denken), `SessionSummary.thinking_since`; zurück auf `None` bei Gedankengang, Werkzeugstart, Antworttext, Turn-Ende und jedem Status außer `Running`.
- Oberfläche: `src/features/skins/` (`slotCatalog`, `matchSlot`, `fillText`, `useStatusFigure`), `WorkingIndicator` mit Text, Aufrufzähler, Todo, Esc-Hinweis; `ChatTimeline` verdrahtet.
- Abweichung vom AK 3: Im selben Fach wechselt auch ein neues Ziel (z. B. andere Datei bei `Read`), aber nur nach der 4-s-Frist; wörtlich „gleiches Fach → kein Wechsel“ hätte ein veraltetes Ziel stehen lassen.
- Wackelstelle: `useStatusFigure.ts` (Zeitgeber-Effekt) — der Ablauf der 1-s-/4-s-Fristen und das Zurücksetzen bei Arbeitsende sind nur per Typcheck und Lint belegt, nicht live.
- Nach dem Denken, vor dem nächsten Werkzeug, bleibt „Denkt nach …“ ohne Sekunden stehen (Halten des letzten Fachs).
