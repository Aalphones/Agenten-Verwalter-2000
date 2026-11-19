# Phase 2 — Beschreibung statt Befehl

Status: complete. Rating: standard. Die Befehlsbeschreibung (`description` aus der Eingabe von Bash und PowerShell) wandert vom Übersetzer bis in jede Anzeige. Der Befehl bleibt gespeichert, bleibt Grundlage für eigene Fächer und steht beim Aufklappen. Aussehen der Zeilen: [artifacts/entwurf-befehle-verstehen.html](artifacts/entwurf-befehle-verstehen.html), Kästen „Befehlszeile im Chat“ und „Hintergrund-Panel“.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Typen, Systemprompt-Absatz, Platzhalter)
- `src-tauri/src/agents/claude/translate.rs` — `translate_tool_use`, `target_of`, `TARGET_FIELDS`, `remember_bash`, `task_started`, `process_title`, `is_shell_tool`
- `src-tauri/src/agents/claude/process.rs` — Sammeln der `prompts` vor `--append-system-prompt`, `scratchpad_prompt` als Muster
- `src-tauri/src/agents/event.rs` — `ChatEntry::Tool`, `AgentEvent`
- `src-tauri/src/sessions/registry.rs` — `apply_event` (Zweige `ToolStarted`, `CommandStarted`, `TaskStarted`), `start_background`, `awaited_script`
- `src-tauri/src/sessions/model.rs` — `AwaitedScript`
- `src-tauri/src/codex/items.rs` und `src-tauri/src/standalone/` — bauen eigene Zeilen im selben Format; nur prüfen, dass sie nach der Änderung weiter übersetzen (kein `description` → `None`)
- `src/features/chat/buildBlocks.ts` (`ToolEntry`), `ToolGroup.tsx`, `toolSummary.ts`, `BackgroundLine.tsx`
- `src/features/background/` — `ProcessesTab.tsx`, `BackgroundRow.tsx` (`title`, `subtitle`, `isMono`), `DetailHead.tsx`, `backgroundLabels.ts`
- `src/features/skins/useStatusFigure.ts`, `statusText.ts`, `fillText.ts`, `slotCatalog.ts`; `src/features/chat/ChatTimeline.tsx` (Aufruf von `statusText`), `AwaitedScriptLine.tsx`
- `src/app/SidebarItem.tsx`, `src/app/SessionHeader.tsx`, `src/app/ProjectHeader.tsx`, `src/features/sessions/sessionStatus.ts` (`scriptLabel`) — Stellen, die `awaitedScript.title` zeigen
- `docs/conventions/rust.md`, `typescript.md`, `react.md`
- Fehlerklassen geprüft (Vault `sprachen/typescript`, `frameworks/react`): keine einschlägig.

## AK

1. `translate-probe` über `artifacts/vordergrund.jsonl` zeigt an `ToolStarted` und `CommandStarted` `description: Some("Run 12-step loop with 2s sleeps in foreground")`; `target` ist weiter der Befehl.
2. Die Zeile eines Bash- oder PowerShell-Aufrufs in `ToolGroup` zeigt die Beschreibung; die Gruppenzeile mit genau einem Aufruf ebenso. Aufgeklappt zeigt `ToolDetail` wie bisher den Befehl. Ein Eintrag ohne `description` (alte Einträge, Codex) sieht aus wie vorher.
3. Die Statuszeile zeigt bei einem laufenden Shell-Befehl mit Beschreibung den sachlichen Text `<Beschreibung> …`, ohne Beschreibung `<Befehl> …`. Ein eigenes Fach mit `input`-Muster `pnpm *` greift bei `pnpm check` weiter, egal wie die Beschreibung lautet.
4. Hintergrund-Panel (Reiter Prozesse, Kopf der Detailansicht) und die Hintergrund-Zeile im Chat zeigen die Beschreibung als Titel und den Befehl darunter bzw. daneben in Monospace; ohne Beschreibung wie vorher.
5. Tooltips, die heute `awaitedScript.title` zeigen, zeigen `description ?? title`.
6. Ein neu gestarteter Agent bekommt den Absatz aus dem Kontrakt im `--append-system-prompt` (sichtbar in den Argumenten, die `build_command` baut), in allen Betriebsarten.
7. `pnpm bindings` ausgeführt, `pnpm check` grün.

## Checkliste

### Kern

- [x] `translate.rs`: Helfer `description_of(name, input) -> Option<String>`: nur bei `is_shell_tool(name)`, Feld `description` als String, getrimmt, leer → `None`, auf 120 Zeichen gekürzt (`shorten_to_line`). `translate_tool_use` und `remember_bash` geben ihn in `ToolStarted.description` bzw. `CommandStarted.description`.
- [x] `translate.rs`, `task_started`: `AgentEvent::TaskStarted.description` = bei `TaskKind::Process` die `system.description`, wenn sie nicht leer ist und vom Titel (dem Befehl) abweicht, sonst `None`; bei `Subagent` `None`.
- [x] `event.rs`: Felder laut Kontrakt (`ChatEntry::Tool.description` mit `#[serde(default)]`).
- [x] `registry.rs`: `ToolStarted` schreibt `description` in den Eintrag; `start_background` bekommt einen Parameter `description: Option<String>` und setzt `BackgroundItem.description` (Aufrufer: `CommandStarted`, `TaskStarted`). `awaited_script` füllt `AwaitedScript.description` vom ältesten laufenden Eintrag.
- [x] `background/model.rs`, `sessions/model.rs`: Felder `description` laut Kontrakt (`#[serde(default)]` am `BackgroundItem`).
- [x] `process.rs`: `fn commands_prompt() -> String` mit dem Text aus dem Kontrakt (wortgleich) und einem Kommentar, warum es ihn gibt; immer in `prompts` aufnehmen (vor `scratchpad_prompt`), sodass `--append-system-prompt` jetzt immer gesetzt ist.
- [x] `pnpm bindings`.

### Oberfläche

- [x] `buildBlocks.ts`: `ToolEntry` trägt `description: string | null` aus dem Eintrag.
- [x] `toolSummary.ts`: neue Funktion `toolLabel(tool: ToolEntry): string` = `tool.description ?? tool.target`; `groupSummary` nutzt sie im Fall „genau ein Aufruf“. `COMMAND_TOOL`-Vergleich um `PowerShell` erweitern („n Befehle“ auch dort).
- [x] `ToolGroup.tsx`: Zeile zeigt `toolLabel(tool)`; `title`-Attribut der Zeile bleibt `TOOL_TOGGLE_HINT`.
- [x] `useStatusFigure.ts`: `Wanted`/`Shown`/`StatusFigure` bekommen neben `target` (weiter der Befehl, für `slotFor`) ein Feld `label` (`entry.description ?? (entry.target || entry.tool)`) und `command` (`entry.target` bei Bash/PowerShell, sonst `''`). Der Wechsel-Vergleich nimmt `label` dazu.
- [x] `fillText.ts`: Werte `{ ziel, befehl, zeit, commit, fortschritt, rest }`; `statusText.ts`: `StatusTextInput` um `command`, `progress`, `rest` (Strings, vorerst `''`) erweitert, `ziel` = `label`. `slotCatalog.ts`: `PLAIN_TEXTS.shell = '{ziel} …'`.
- [x] `ChatTimeline.tsx`: `statusText` mit `target: statusFigure.label`, `command: statusFigure.command`; der `key` der `FigureStage` nutzt weiter `statusFigure.target`.
- [x] `ProcessesTab.tsx`, `DetailHead`-Aufrufer, `BackgroundLine.tsx`: `title = item.description ?? item.title`; gibt es eine Beschreibung, der Befehl als `subtitle` bzw. zweite Zeile in Monospace, `isMono` nur noch ohne Beschreibung.
- [x] `SidebarItem.tsx`, `SessionHeader.tsx`, `ProjectHeader.tsx`, `sessionStatus.ts`: überall `awaitedScript.description ?? awaitedScript.title`.

### Doku

- [x] `docs/glossary.md`: „Befehlsbeschreibung“.
- [x] `docs/code-map.md`: Zeilen „Chat“ und „Hintergrund“ (Beschreibung, `toolLabel`), Zeile „Skins“ (`{befehl}`, `label`).
- [x] `docs/decisions/065-skins.md` bleibt unverändert; die neuen Platzhalter stehen in ADR 066.

## Report-Back

Ergebnis: Beschreibung läuft von `translate.rs` (`description_of`) über `ToolStarted`/`CommandStarted`/`TaskStarted` in Eintrag, Hintergrund-Eintrag und `AwaitedScript`; Anzeige in Gruppenzeile, Statuszeile, Hintergrund-Panel, Chat-Zeile und Tooltips. `translate-probe` über `vordergrund.jsonl` zeigt die Beschreibung (AK 1). `pnpm bindings` und `pnpm check` grün. Abweichungen: `start_background` nimmt eine Struktur `NewBackground` (Clippy: höchstens 7 Argumente); der Befehl steht in Panel-Zeilen als Festbreiten-Abschnitt vor der Unterzeile statt als dritte Zeile (die Liste rechnet mit fester Zeilenhöhe). `remember_bash` merkt weiter nur `Bash`; ein PowerShell-Vordergrund-Befehl behält Beschreibung am Werkzeug-Eintrag, entsteht im Panel aber weiter nur über `task_started`.
