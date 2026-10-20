# Codex als Betriebsart

Ziel: Eine vierte Betriebsart „Codex“, in der die Sessions mit OpenAI Codex (ChatGPT-Konto) arbeiten statt mit Claude — bedient wie heute: Chat, Werkzeug-Aktivität, Rückfragen, Changes, Kontext-Donut und Kontingent oben in der Session-Kopfzeile, Anmeldung in den Einstellungen, Modellwechsel direkt in der Eingabeleiste. Die Anweisungen und Skills des Benutzers gelten mit: Codex liest seine globale `~/.codex/AGENTS.md` (verweist auf die gemeinsame `CLAUDE.md` und den Output-Style) und die nach `~/.codex/skills/` gespiegelten Skills selbst; der Verwalter ergänzt die `AGENTS.md` der Repositories, seine Vorgaben (Scratchpad, Artefakte) und den `/name`-Aufruf von Skills und Befehlen.

**Der Kniff (wie bei „Autark“, ADR 017):** Ein Übersetzer im Verwalter — `verwalter.exe codex …` — spricht nach außen genau den Ausschnitt des Zeilenprotokolls der Claude-Kommandozeile, den der Verwalter liest und schreibt (Kontrakt im Plan [Autarker Agent](../../archive/2026-10/2026-10-01_autarker-agent/README.md#kontrakt)), und nach innen das JSON-RPC-Protokoll von `codex app-server` (die Schnittstelle, über die auch die VS-Code-Erweiterung von Codex arbeitet). Registry, Übersetzung, Rückfragen, Unterbrechen, Wiederherstellung, Chat und Changes bleiben unverändert; im Core ändert sich, welches Programm startet, und Konto, Kontingent und Modellliste bekommen einen Codex-Zweig.

**Belegt am 2026-10-19** (Probe gegen `codex-cli 0.162.0-alpha.2` aus der VS-Code-Erweiterung `openai.chatgpt-26.1002.51308`): `initialize` 1,2 s; `account/read` → `type: chatgpt`, `planType: go`, E-Mail vorhanden; `account/rateLimits/read` → **nur `primary`**, `windowDurationMins: 43200` (30 Tage), `secondary: null`; `model/list` → `gpt-6-luna` (Standard), `gpt-5.6-terra`, `gpt-5.6-luna` mit Denkaufwand `low/medium/high/xhigh/max` (terra zusätzlich `ultra`). Das vollständige Protokoll-Schema erzeugt `codex app-server generate-json-schema --out <Ordner>`.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 008](../../decisions/008-kontext-und-kontingent.md), [ADR 016](../../decisions/016-betriebsarten-und-lokales-modell.md), [ADR 017](../../decisions/017-autarker-agent.md), [ADR 021](../../decisions/021-claude-konto.md), [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md). ADR 031 entsteht in Phase 1.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Gerüst: Betriebsart „Codex“, `codex.exe` finden, Unterbefehl `codex`, Thread anlegen/fortsetzen, Text-Chat, Unterbrechen | [phase-1-geruest.md](phase-1-geruest.md) | heikel | complete |
| 2 | Werkzeuge, Rechte, Rückfragen: Befehle, Dateiänderungen, MCP, Web, Plan als Aufgabenliste; Freigaben und Sandbox je Modus | [phase-2-werkzeuge-rechte.md](phase-2-werkzeuge-rechte.md) | heikel | complete |
| 3 | Anweisungen, Skills, Anhänge: Repository-`AGENTS.md`, Verwalter-Vorgaben, `/name`, Bilder; `/`-Menü in „Codex“ | [phase-3-anweisungen-skills.md](phase-3-anweisungen-skills.md) | standard | pending |
| 4 | Modelle und Kontext: Codex-Modell je Session, Modellwechsel in der Eingabeleiste, Denkaufwand, Kontext-Donut | [phase-4-modelle-kontext.md](phase-4-modelle-kontext.md) | heikel | pending |
| 5 | Konto und Kontingent: Zeile „Codex-Konto“ mit Anmelden, Kontingent oben aus Codex | [phase-5-konto-kontingent.md](phase-5-konto-kontingent.md) | standard | pending |
| 6 | Druckmodus (TL;DR, Retro, Commit-Vorschlag) und Abschluss: Doku, ADR, Wissen | [phase-6-druck-abschluss.md](phase-6-druck-abschluss.md) | standard | pending |

**Reihenfolge:** strikt 1 → 6; nach jeder Phase ist „Codex“ benutzbar, nur mit weniger Fähigkeiten. Umsetzung direkt auf `main`, ein Commit pro Phase, Scope `codex` (Phase 1 trägt ihn in [commits.md](../../conventions/commits.md) nach). Vor jedem Commit `pnpm check` grün; `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine neuen Rust-Abhängigkeiten (JSON über `serde_json`, Prozesse über `std::process`). Bindings nach Änderungen an Typen über die Tauri-Grenze neu erzeugen (`pnpm bindings`) und mitcommitten. Erkenntnisse nach [FINDINGS.md](FINDINGS.md).

**Testen ohne Oberfläche:** `src-tauri\target\debug\verwalter.exe codex -p --input-format stream-json --output-format stream-json --verbose --model gpt-6-luna --permission-mode default --session-id <uuid>` im Workspace-Ordner starten, Zeilen aus dem Kontrakt auf die Standardeingabe schreiben, Ausgabe lesen. Phase 1 legt Beispielzeilen unter `artifacts/beispielzeilen.jsonl` ab.

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 031](../../decisions/031-codex.md) „Codex als Betriebsart“ (Kontext / Optionen / Entscheidung / Konsequenzen); Phasen 2–6 ergänzen ihre Punkte.

- **Anbindung über `codex app-server` (JSON-RPC über stdio), nicht `codex exec --json`.** Nur `app-server` kennt Anmeldung, Kontingent, Modellliste, Modellwechsel je Turn, Freigabe-Rückfragen und Fortsetzen eines Threads. Verworfen: `codex exec` (kein Konto, kein Kontingent, keine Rückfragen); eigener OpenAI-Client im Agenten „Autark“ (kein ChatGPT-Abo-Login, Kontingent unsichtbar).
- **Übersetzer als Unterbefehl `codex` derselben `verwalter.exe`**, Protokoll-kompatibel zum Kontrakt aus ADR 017. `main.rs` prüft das erste Argument: `agent` → `standalone::run`, `codex` → `codex::run`. Verworfen: Provider-Trait mit zweitem Anbieter in der Registry — verdoppelt Registry, Übersetzung und Rückfrage-Fluss; ADR 017 hat denselben Schnitt schon begründet.
- **Betriebsart global in den Einstellungen** (wie ADR 016): `OperatingMode::Codex`, Oberflächen-Begriff „Codex“. Wirkt ab dem nächsten Agent-Start; ein ruhender Agent wird beim nächsten Senden mit dem neuen Programm gestartet (bestehender Mechanismus in `send`). Verworfen: Betriebsart je Session — mischt Konten und Kontingente in einer Liste und ist ein eigener Umbau der Registry.
- **`codex.exe` finden:** (1) Umgebungsvariable `VERWALTER_CODEX_PATH`; (2) `codex.exe` im `PATH`; (3) die jüngste VS-Code-Erweiterung `%USERPROFILE%\.vscode\extensions\openai.chatgpt-*-win32-x64\bin\windows-x86_64\codex.exe` (höchste Versionsnummer im Ordnernamen). Nichts gefunden → `CommandError::CodexNotFound` mit „Codex nicht gefunden — installiere die Codex-Erweiterung für VS Code oder setze VERWALTER_CODEX_PATH.“ Ein npm-`codex.cmd` wird nicht gestartet (Batch-Datei, Quoting-Falle).
- **Getrennte Verläufe (wie ADR 017):** Codex führt eigene Threads unter `~/.codex/sessions/`. Der Übersetzer merkt sich je Session die Thread-ID in `%USERPROFILE%\.verwalter\codex\<session-id>.json` (`{"threadId":"…"}`). `--session-id` → `thread/start` und Datei schreiben (Fehler, wenn sie existiert); `--resume` → `thread/resume` mit der gemerkten ID (Fehler, wenn die Datei fehlt). Die Registry setzt `--resume` nur, wenn diese Datei existiert; sonst „Verlauf nicht übernommen“ wie heute.
- **Modi → Codex-Freigaben** (Phase 2): Manuell → `approvalPolicy: "untrusted"`, Sandbox `workspaceWrite`; Automatisch bearbeiten → `"on-request"`, `workspaceWrite`; Planen → `"on-request"`, Sandbox `readOnly`; Auto → `"on-request"` mit `approvalsReviewer: "auto_review"` (Codex' eigener Prüfer entscheidet statt des Benutzers — das Gegenstück zum Sicherheits-Klassifizierer von Claude), `workspaceWrite`. `workspaceWrite` immer mit `networkAccess: true` (Paketinstallation, `git push`) und `writableRoots` = Arbeitsordner, alle `--add-dir`-Ordner, Scratchpad und jeder vorhandene Ticket-Worktree, den die `--allowedTools`-Muster treffen — neu berechnet vor jedem `turn/start`.
- **Rückfragen von Codex werden Rückfragen des Verwalters:** `item/commandExecution/requestApproval` → `can_use_tool` mit `Bash`; `item/fileChange/requestApproval` → `can_use_tool` mit `Edit` (je Datei ein `file_path`, bei mehreren Dateien die erste, die übrigen im Feld `description`); `item/tool/requestUserInput` → `can_use_tool` mit `AskUserQuestion`. Erlauben → `accept`, Ablehnen → `decline`.
- **Werkzeugnamen nach außen wie bei Claude Code** (Kontrakt-Tabelle unten), damit `translate.rs` (`target_of`, `used_paths`, Exit-Code, `TodoWrite`, `AskUserQuestion`) und die Changes-Zuordnung unverändert greifen.
- **Modell je Session als Text** (Phase 4): neue Spalte `sessions.codex_model TEXT NULL` (Migration 11) und Einstellung `default_codex_model: Option<String>`. Das Claude-Modell der Session (`ModelId`) bleibt unangetastet und gilt nach dem Zurückschalten wieder (wie ADR 016). Leer → Codex-Standardmodell (`isDefault` aus `model/list`). Der Modellwechsel in der Eingabeleiste schickt `set_model` mit der Codex-ID; der Übersetzer setzt sie beim nächsten `turn/start` (`model`-Feld) — kein Neustart.
- **Denkaufwand:** `Effort` des Verwalters 1:1 auf Codex-Werte (`low`, `medium`, `high`, `xhigh`, `max`); bietet das Modell den Wert nicht an, nimmt der Übersetzer dessen `defaultReasoningEffort`. `ultra` bietet der Verwalter nicht an. Wirkt beim nächsten `turn/start` (`effort`); dazu neue Steueranfrage `set_effort`, die die Claude-Kommandozeile nie bekommt.
- **Kontext:** aus `thread/tokenUsage/updated` — belegt = `last.inputTokens + last.outputTokens`, Fenster = `modelContextWindow`. Antwort auf `get_context_usage` mit genau einer Kategorie „Verlauf“; eine Aufschlüsselung wie bei Claude gibt es nicht.
- **Kontingent:** `account/rateLimits/read` über einen kurz gestarteten `codex app-server` (wie der Hilfsprozess aus ADR 008). Jedes vorhandene Fenster (`primary`, `secondary`) wird ein `UsageLimit` mit `window_minutes`; die Oberfläche benennt es nach der Dauer.
- **Konto:** `account/read` liest, `account/login/start` mit `type: "chatgpt"` liefert eine Anmelde-Adresse, die der Verwalter im Browser öffnet; `account/login/completed` beendet. Kein Abmelde-Knopf (wie ADR 021).
- **MCP:** Codex nutzt seine eigenen MCP-Server aus `~/.codex/config.toml`; die Server aus `~/.claude.json` und den `.mcp.json` gelten in „Codex“ nicht. Der MCP-Dialog (`/mcp`) ist in „Codex“ ausgeblendet; `mcp_status` beantwortet der Übersetzer mit `error`.
- **Druckmodus** (Phase 6): TL;DR, Retro und Commit-Vorschlag laufen in „Codex“ über den Übersetzer: kurzlebiger Thread (`ephemeral: true`), `turn/start` mit `outputSchema`, Standardmodell, Denkaufwand `low`.
- **Code-Ort:** Laufzeit in `src-tauri/src/codex/`, Startseite im Core in `src-tauri/src/agents/codex.rs`. Feature-Name `codex`.

## Kontrakt

### Start (vom Verwalter, `process.rs` und `print.rs`)

`<verwalter.exe> codex` gefolgt von den Argumenten aus `build_command` bzw. `print_command` — dieselben wie im Kontrakt von ADR 017. Der Übersetzer **wertet aus**: `-p`, `--model <id>` (Codex-Modell-ID; leer = Standard), `--effort <low|medium|high|xhigh|max>`, `--permission-mode <default|acceptEdits|plan|auto>`, `--session-id <id>`, `--resume <id>`, `--add-dir <pfad>` (mehrfach), `--allowedTools <regel>…`, `--append-system-prompt <text>`, im Druckmodus `--system-prompt <text>`, `--json-schema <json>`. Er **akzeptiert und ignoriert** alle übrigen Optionen aus dem ADR-017-Kontrakt sowie `--chrome`/`--no-chrome` und `--mcp-config <datei>…`.

Umgebung: `VERWALTER_CODEX_EXE` (Pfad zu `codex.exe`, gesetzt vom Verwalter; fehlt sie → Zeile auf stderr, Exit-Code 2), `VERWALTER_AGENT_SCRATCHPAD` (wie Autark).

### Eingehende Zeilen (stdin)

| Zeile | Wirkung beim Übersetzer |
|---|---|
| `user` mit Text/Blöcken | `turn/start` (läuft einer: in die Schlange, danach) |
| `control_request` `interrupt` | `turn/interrupt`; Antwort `success`; der Turn endet mit `result` `aborted_streaming` |
| `set_permission_mode` | Modus für den nächsten `turn/start`; `success` |
| `set_model` | Modell für den nächsten `turn/start`; `success` |
| `set_effort` (neu, nur Codex) `{"subtype":"set_effort","effort":E}` | Denkaufwand für den nächsten `turn/start`; `success` |
| `get_context_usage` | `success` mit `{"totalTokens":T,"maxTokens":W,"categories":[{"name":"Verlauf","tokens":T}]}` (Feldnamen nach `agents/claude/stats.rs` angleichen, Phase 4) |
| `stop_task`, `mcp_status`, `mcp_reconnect`, `mcp_toggle`, jede andere | `error` „nicht unterstützt: <subtype>“ |
| `control_response` auf `can_use_tool` | Antwort an Codex auf die gemerkte JSON-RPC-Anfrage (`accept`/`decline`) |

### Ausgehende Zeilen (stdout) — Zuordnung Codex → Claude-Zeile

| Codex (Benachrichtigung / Element) | Zeile an den Verwalter |
|---|---|
| nach `thread/start` bzw. `thread/resume` | `system`/`init` mit `session_id` = Verwalter-Session-ID, `model`, `cwd`, `tools: []` |
| `item/completed` `agentMessage` | `assistant` mit Block `text` |
| `item/completed` `reasoning` (Zusammenfassung) | `assistant` mit Block `thinking` |
| `item/started` `commandExecution` | `assistant` mit `tool_use` `Bash` (`command`, `description` leer) |
| `item/completed` `commandExecution` | `user` mit `tool_result` (Ausgabe, `Exit code <n>\n` vorn bei ≠ 0, `is_error`) |
| `item/started` `fileChange` | je geänderter Datei ein `tool_use`: `Write` (`add`, `file_path`, `content` leer) bzw. `Edit` (`update`/`delete`, `file_path`, `old_string`/`new_string` leer) |
| `item/completed` `fileChange` | `tool_result` je `tool_use` („Datei geändert: <pfad>“ bzw. Fehlertext) |
| `item/started`/`completed` `mcpToolCall` | `tool_use` `mcp__<server>__<tool>` mit den Argumenten / `tool_result` mit dem Textinhalt |
| `item/completed` `webSearch` | `tool_use` `WebSearch` (`query`) + `tool_result` (leer → „Suche ausgeführt.“) |
| `turn/plan/updated` | `tool_use` `TodoWrite` (`todos` aus den Schritten: `pending`/`inProgress`/`completed` → `pending`/`in_progress`/`completed`) + `tool_result` „Aufgabenliste aktualisiert.“ |
| `thread/tokenUsage/updated` | gemerkt; geht als `usage.input_tokens` an die nächste `assistant`-Zeile und als `contextWindow` an `result` |
| `turn/completed` (`completed`) | `result` `success` mit letztem Text, `modelUsage: {<model>: {contextWindow: W}}` |
| `turn/completed` (`failed`) / `error` | `result` `error_during_execution` mit dem Fehlersatz von Codex |
| `turn/completed` (`interrupted`) | `result` mit `terminal_reason: aborted_streaming` |
| Freigabe-Anfragen (s. oben) | `control_request` `can_use_tool` mit `request_id` `codex-<n>` |
| alle übrigen Elemente/Benachrichtigungen | ignoriert, eine Zeile auf stderr bei unbekanntem Typ |

Werkzeug-IDs: `item.id` von Codex (bei `fileChange` `<item.id>-<n>`).

### Typen über die Tauri-Grenze

- `OperatingMode` bekommt `Codex` (TS `'codex'`).
- `Settings.default_codex_model: Option<String>`, `SettingsChange::DefaultCodexModel(Option<String>)`.
- `SessionSummary.codex_model: Option<String>` (bzw. wo `model` heute steht).
- `CodexModel { id: String, display_name: String, efforts: Vec<Effort>, default_effort: Effort, is_default: bool }`; Command `codex_models() -> Vec<CodexModel>`; `session_set_codex_model(session_id, model: Option<String>)`.
- `UsageLimit.window_minutes: Option<u32>`.
- Codex-Konto: dieselben Typen `AccountStatus`/`AccountInfo`; Commands `codex_account_load`, `codex_account_login`; Ereignis `codex-account://changed`.

## Finale Abnahmekriterien

1. Einstellungen → „Betriebsart“ hat einen vierten Knopf „Codex“; das i-Symbol erklärt ihn in einem Satz („Sessions arbeiten mit OpenAI Codex und deinem ChatGPT-Konto“). In „Codex“ sind die Zeilen „Lokales Modell“ ausgeblendet; „Standardmodell neuer Vorhaben“ zeigt die Codex-Modelle.
2. Einstellungen zeigen unter „Claude-Konto“ eine Zeile „Codex-Konto“ mit E-Mail und Abo bzw. „Nicht angemeldet“ und einem Knopf „Anmelden“, der den Browser mit der Anmeldeseite öffnet; nach der Anmeldung zeigt die Zeile das Konto ohne Neustart.
3. In „Codex“ antwortet eine neue Session im Chat; Befehle und Dateiänderungen erscheinen als Werkzeug-Aktivität, geänderte Dateien in den Changes der Session.
4. Freigaben laufen über die gewohnten Rückfragen; Manuell fragt vor jedem Befehl, Planen ändert keine Datei, Esc unterbricht.
5. Die Eingabeleiste zeigt in „Codex“ das Codex-Modell der Session; Wechseln wirkt ab der nächsten Nachricht ohne Neustart; der Denkaufwand bietet nur Werte des Modells an.
6. Die Session-Kopfzeile zeigt in „Codex“ den Kontext-Donut (Fenster des Codex-Modells) und das Kontingent aus Codex mit verständlicher Fenster-Bezeichnung (z. B. „30-Tage-Fenster“).
7. `/mode-planning` (Benutzer-Skill) und `/plan` (Befehl) wirken in „Codex“; die Antworten folgen den Benutzer-Anweisungen (Vera-Stimme, TL;DR-Zeile).
8. Nach App-Neustart setzt eine Codex-Session ihren Verlauf fort; nach Wechsel zu Claude und zurück ebenfalls.
9. TL;DR und Commit-Vorschlag funktionieren in „Codex“ ohne Claude-Kommandozeile.
10. In „Claude“, „Claude Code + LM Studio“ und „Autark“ verhält sich alles wie vorher.

## Smoke-Checkliste

Wackelstellen zuerst:

1. **Sandbox und Ordner außerhalb des Arbeitsordners** — Session mit einem Repository unter `C:\Users\sasch\develop\…`, Modus Automatisch bearbeiten: „Lege im Repository die Datei `codex-probe.txt` an“. Erwartung: Datei entsteht ohne Rückfrage, erscheint in den Changes. Danach dasselbe in einem Ticket-Worktree `<repo>-wt-x`, den der Agent vorher anlegt.
2. **Rückfrage-Rundlauf** — Modus Manuell: „Führe `git status` aus“. Erwartung: Rückfrage im Chat, Erlauben → Ausgabe erscheint; Ablehnen → Agent meldet die Ablehnung, kein Hängen.
3. **Fortsetzen** — Codex-Session mit zwei Nachrichten, App beenden, neu starten, „Was war meine erste Frage?“. Erwartung: richtige Antwort, kein „Verlauf nicht übernommen“.
4. Modellwechsel in der Eingabeleiste von `gpt-6-luna` auf `gpt-5.6-terra`, dann fragen „Welches Modell bist du?“ — Antwort passt; Denkaufwand-Menü zeigt die Werte des neuen Modells.
5. Kontingent-Fenster öffnen: Fenster und Rücksetzzeit stimmen mit chatgpt.com/codex überein.
6. Abgemeldeter Zustand: `~/.codex/auth.json` vorher sichern, in der Zeile anmelden, Konto erscheint, Kontingent wird neu geladen.
7. `/mode-planning` und `/plan` in „Codex“.
8. TL;DR einer Codex-Session erzeugen.
9. Gegenprobe: eine Nachricht in „Claude“ — unverändert.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
