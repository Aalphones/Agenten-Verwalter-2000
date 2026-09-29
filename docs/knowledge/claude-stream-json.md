# Claude-Kommandozeile im Stream-Modus

Belegt am 2026-09-28 mit Claude Code 2.1.220 unter Windows 11, per Probe-Skript gegen die installierte `claude.exe`. Grundlage für [ADR 003](../decisions/003-claude-anbindung.md). Was hier nicht steht, ist nicht geprüft.

## Programm

- Die npm-Installation liefert eine **native** `claude.exe` (rund 265 MB) unter `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe`. Das `claude`, das die Shell findet, ist nur ein `.ps1`/`.cmd`-Starter davor — der Core startet die `.exe` direkt, ohne Shell und ohne Node.
- Arbeitsspeicher eines ruhenden Prozesses nach dem Start: rund 390 MB (ein Messwert, `WorkingSet64`). Fünf offene Sessions kosten damit rund 2 GB.
- Schließt der Aufrufer die Standardeingabe, beendet sich der Prozess nach der laufenden Antwort von selbst.

## Aufruf

```text
claude.exe -p --input-format stream-json --output-format stream-json --verbose
           --permission-prompt-tool stdio
           --model <id> --effort <low|medium|high|xhigh|max>
           --permission-mode <default|acceptEdits|plan|auto>
           --add-dir <worktree> …       (je Repository der Session einmal)
           --session-id <uuid>          (neue Session)   bzw.   --resume <uuid>   (fortsetzen)
Umgebung:  CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1
```

- Jede Zeile auf stdin und stdout ist ein JSON-Objekt.
- `--verbose` ist mit `stream-json` als Ausgabe nötig.
- Die Einstellungen des Benutzers (`~/.claude/settings.json`: Rechte-Regeln, Hooks, Skills, Ausgabestil) gelten auch für so gestartete Prozesse. Eine Probe im Modus `default` legte eine Datei ohne Rechte-Abfrage an — vermutlich greift eine Freigabe-Regel des Benutzers. Welche Werkzeuge in „Manuell“ tatsächlich nachfragen, hängt also von diesen Einstellungen ab. `--setting-sources` schränkt die Quellen ein (nicht geprüft).
- `--session-id` legt die Session-ID fest; geprüft am 2026-09-28: eine mit `--session-id` gestartete Session lässt sich nach hartem Beenden des Prozesses mit `--resume <dieselbe-id>` fortsetzen, der Agent zitiert die erste Nachricht. `--resume <id>` setzt eine Session mit vollem Verlauf fort: geprüft, der Agent kannte eine vorher per Rückfrage gewählte Antwort.

## Mehrere Repositories

Belegt am 2026-09-28 mit Claude Code 2.1.220. Der Agent startet im Session-Workspace, die Repositories liegen als Worktrees in Unterordnern darunter.

- **Skills** aus `<repo>\.claude\skills` findet Claude nur mit `--add-dir <worktree>`: ohne ist `skills` in `system/init` leer, mit stehen sie dort.
- **`CLAUDE.md`** eines mit `--add-dir` hinzugefügten Ordners lädt Claude nur, wenn die Umgebungsvariable `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` gesetzt ist.
- Geprüft ist nur ein frischer Start (`--session-id`); ob `--add-dir` auf dem `--resume`-Weg genauso wirkt, prüft die Smoke-Abnahme von Meilenstein 3.

## Nachrichten an den Agenten (stdin)

```json
{"type":"user","message":{"role":"user","content":"Text der Nachricht"}}
{"type":"control_request","request_id":"app-1","request":{"subtype":"interrupt"}}
{"type":"control_request","request_id":"app-2","request":{"subtype":"set_model","model":"claude-sonnet-5-5"}}
{"type":"control_request","request_id":"app-3","request":{"subtype":"set_permission_mode","mode":"acceptEdits"}}
```

- `interrupt`, `set_model`, `set_permission_mode` wirken mitten in der Session ohne Neustart; jede Anfrage wird mit `{"type":"control_response","response":{"subtype":"success","request_id":…}}` bestätigt.
- `set_max_thinking_tokens` wird angenommen. **`set_effort` gibt es nicht** (`"Unsupported control request subtype: set_effort"`) — der Denkaufwand lässt sich nur beim Start setzen; ein Wechsel heißt Prozess beenden und mit `--resume <id> --effort <neu>` neu starten, der Verlauf bleibt.
- Nach `set_model` erscheint eine `user`-Zeile mit Text-Inhalt `<local-command-stdout>Set model to …</local-command-stdout>` — keine Nutzernachricht.

## Ereignisse vom Agenten (stdout)

| `type` / `subtype` | Bedeutung |
|---|---|
| `system` / `init` | Nach jedem Start und vor jeder Antwort. Felder u.a. `session_id`, `cwd`, `model`, `permissionMode`, `tools`, `slash_commands`, `skills`, `agents`, `claude_code_version`, `scratchpad_path` (siehe „Scratchpad“). |
| `system` / `thinking_tokens` | Laufender Zähler, solange das Modell nachdenkt. Viele Zeilen, kein Inhalt. |
| `system` / `status` | Z.B. nach Moduswechsel, Feld `permissionMode`. |
| `system` / `background_tasks_changed`, `task_started`, `task_progress`, `task_updated`, `task_notification` | Hintergrundprozesse (`task_type: "local_bash"`) und Subagenten (`task_type: "local_agent"`), Felder siehe „Hintergrundprozesse und Subagenten“. |
| `rate_limit_event` | Kontingent-Information. |
| `assistant` | Eine Zeile pro Inhaltsblock: `message.content` ist ein Array mit genau einem Block `thinking` (Feld `thinking`), `text` (Feld `text`) oder `tool_use` (`id`, `name`, `input`). `message.usage` trägt `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`. `parent_tool_use_id` ist bei Nachrichten eines Subagenten gesetzt, sonst `null`. |
| `user` | Werkzeug-Ergebnisse: `message.content` = Array mit `tool_result` (`tool_use_id`, `content`, `is_error`). Oder Text-Inhalt als String (lokale Befehlsausgabe) bzw. `[{"type":"text","text":"[Request interrupted by user]"}]` nach einer Unterbrechung. |
| `control_request` / `can_use_tool` | Der Agent will ein Werkzeug benutzen und fragt nach: `request.tool_name`, `request.input`, `request.tool_use_id`, `request_id`. Kommt auch für `AskUserQuestion`. |
| `control_response` | Antwort auf eine eigene Steueranfrage. |
| `result` | Ende einer Antwort. `subtype` `success` bzw. `error_during_execution`, `is_error`, `stop_reason`, `terminal_reason` (`completed`, nach Unterbrechung `aborted_streaming`), `result` (Text), `modelUsage.<modell>.contextWindow` (z.B. 200000), `usage`, `total_cost_usd`, `permission_denials`. |

## Rückfragen und Rechte-Abfragen beantworten

Auf `can_use_tool` antwortet der Aufrufer mit derselben `request_id`:

```json
{"type":"control_response","response":{"subtype":"success","request_id":"<id>","response":{"behavior":"allow","updatedInput":{ …input… }}}}
{"type":"control_response","response":{"subtype":"success","request_id":"<id>","response":{"behavior":"deny","message":"Grund für den Agenten"}}}
```

- **`AskUserQuestion`:** `input.questions[]` mit `question`, `header`, `options[]` (`label`, `description`), `multiSelect`. Antwort: `allow` mit `updatedInput` = Eingabe plus `answers: { "<question>": "<gewähltes label>" }`. Geprüft: der Agent erhielt „Rot oder Blau?"="Blau" und antwortete „Blau.“
- `deny` ist aus dem SDK-Protokoll übernommen, nicht einzeln geprüft.

## Unterbrechen

`interrupt` wird mit `{"still_queued":[]}` bestätigt, danach kommen `user` mit `[Request interrupted by user]` und `result` mit `subtype: "error_during_execution"`, `is_error: true`, `terminal_reason: "aborted_streaming"`. Der Prozess bleibt offen und nimmt die nächste Nachricht an.

## Anhänge

Belegt am 2026-09-29 mit Claude Code 2.1.284 (Modell Haiku 4.5), per Probe-Skript.

- Eine Nachricht darf statt eines Strings ein Array von Inhaltsblöcken tragen: `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"…"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"…"}}]}}`. Geprüft: der Agent erkannte die Farbe eines 16×16-PNG.
- PDFs gehen als `{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"…"}}`. Geprüft: der Agent las das Wort aus einem einseitigen PDF.
- Nicht geprüft: Größengrenzen der Kommandozeile, sehr lange stdin-Zeilen (ein PDF mit mehreren MB), und ob Bilder im Verlauf nach `--resume` erhalten bleiben. Die API-Grenze für ein Bild liegt bei 5 MB.

## Skills per Nachricht

- Eine Nachricht, deren Text mit `/<skill-name>` beginnt, führt den Skill aus — als String-Inhalt und ebenso als erster Textblock eines Block-Arrays. Geprüft mit einem Skill aus `<repo>\.claude\skills` (per `--add-dir`): `/probe-skill APFEL` → Antwort nach Skill-Anweisung.
- Die Kommandozeile meldet das Laden eines Skills nicht als eigenes Ereignis; es folgen nur Gedankengang und Antwort.
- `system/init` → `skills` ist eine Liste von **Namen** ohne Herkunft und Beschreibung, gemischt aus Benutzer-, Repository-, Plugin- und eingebauten Skills (Plugin-Skills mit Präfix, z.B. `anthropic-skills:pdf`). `slash_commands` enthält zusätzlich die Befehle aus `~\.claude\commands` und eingebaute Befehle der Kommandozeile.

## Befehle im Vordergrund (Bash)

- Erfolgreicher Aufruf: `tool_result` mit der Ausgabe, `tool_use_result` = `{"stdout":…,"stderr":…,"interrupted":false,…}` an der `user`-Zeile.
- Exit-Code ungleich 0: `tool_result.is_error` ist gesetzt, der Inhalt beginnt mit `Exit code <n>`, danach stdout und stderr (geprüft: `"Exit code 3\neins\nzwei"`); `tool_use_result` ist dann ein String `"Error: Exit code 3…"`.

## Hintergrundprozesse und Subagenten

- Bash mit `run_in_background: true`: nach der Freigabe kommen `background_tasks_changed` (Liste der laufenden: `task_id`, `task_type`, `description`) und `task_started` (`task_id`, `tool_use_id`, `description`, `is_backgrounded: true`, `task_type: "local_bash"`). Das `tool_result` kommt sofort („Command running in background with ID: … Output is being written to: <Datei>“).
- Die Ausgabe schreibt die Kommandozeile laufend in `%TEMP%\claude\<cwd-slug>\<session-id>\tasks\<task_id>.output`; die Datei ist während des Laufs lesbar und endet nach dem Ende mit `[exited with code <n>]`. Geprüft: eine Zeile `Local: http://localhost:5173/` stand dort, während der Prozess lief.
- Ende: `task_updated` (`patch.status`: `completed`, `failed`, `killed`) und `task_notification` (`task_id`, `tool_use_id`, `status`: `completed`, `failed`, `stopped`; `output_file`; `summary`, bei Bash mit Fehler z.B. `Background command "…" failed with exit code 4`).
- Subagent (Werkzeug `Agent`): `task_started` mit `task_type: "local_agent"`, `subagent_type`, `prompt`, `is_backgrounded` (`true` bei asynchronem, `false` bei wartendem Aufruf). Das `tool_result` eines asynchronen Aufrufs kommt sofort; `tool_use_result` trägt `resolvedModel` (Modell-ID des Subagenten) und `agentId`. Laufend: `task_progress` mit `usage.tool_uses`, `usage.total_tokens`, `usage.duration_ms`, `last_tool_name`. Ende: `task_notification` wie oben, `summary` = Ergebnistext, dazu `usage`.
- Nachrichten des Subagenten erscheinen auch **ohne** `--forward-subagent-text` als `assistant`- und `user`-Zeilen mit `parent_tool_use_id` = `tool_use_id` des `Agent`-Aufrufs: Gedankengang, Text, `tool_use` und `tool_result` seiner eigenen Werkzeuge. Die erste `user`-Zeile ist der Auftrag als Text.
- **Selbstständiges Aufwachen:** Endet ein Hintergrundprozess oder ein asynchroner Subagent, nachdem die Antwort schon mit `result` abgeschlossen war, startet der Agent ohne neue Nachricht eine weitere Runde (`system/init`, Gedankengang, Text, `result`). Geprüft für beide Fälle.

## Steueranfragen

- `{"subtype":"stop_task","task_id":"<id>"}` beendet einen Hintergrundprozess **und** einen laufenden Subagenten (geprüft für beide, auch für einen wartenden Subagenten). Bestätigung `control_response` mit `subtype: "success"`, danach `task_updated` (`killed`) und `task_notification` (`stopped`). Ein wartender `Agent`-Aufruf endet mit dem `tool_result` `[Request interrupted by user for tool use]` (`is_error`).
- Ein unbekannter Subtyp wird mit `{"subtype":"error","error":"Unsupported control request subtype: …"}` beantwortet; der Prozess läuft weiter.

## Scratchpad

- `system/init` meldet `scratchpad_path`, einen eigenen Ordner der Kommandozeile je Session: `%TEMP%\claude\<cwd-slug>\<session-id>\scratchpad`. Nach `--resume` derselben Session ist der Pfad unverändert (geprüft). Die Kommandozeile legt den Ordner selbst an: nach jedem Probe-Lauf existierte er, auch wenn der Agent dort nichts abgelegt hatte. Daneben liegen `tasks\` (Ausgabedateien) und bei Bild-Anhängen `images\`.

## Kontext und Kontingent abfragen

Geprüft am 2026-09-29 mit Claude Code 2.1.284; beide Anfragen stammen aus dem Agent SDK (`getContextUsage`, `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET`), die VS-Code-Erweiterung benutzt sie für ihre Fenster „Context usage“ und „Account & Usage“.

- Beide funktionieren sofort nach dem Start, **ohne** vorher eine Nachricht zu senden und ohne `initialize`. Sie lösen keine Modellantwort aus; ob sie Kontingent kosten, ist nicht isoliert gemessen (während der Proben lief parallel eine andere Session).
- `{"subtype":"get_context_usage"}` → `response` mit `categories` (je `name`, `tokens`, `color` (Themenname der Kommandozeile, für uns wertlos), `kind`: `used`, `free` oder `deferred`; `deferred` = nachladbare Werkzeuge, die **nicht** im Kontext liegen), `totalTokens`, `maxTokens`, `rawMaxTokens`, `percentage`, `model`, `memoryFiles` (je `path`, `type`, `tokens`), `mcpTools`, `agents`, `skills` (`totalSkills`, `tokens`, …), `slashCommands`, `autoCompactThreshold` (z.B. 167000 bei 200000), `isAutoCompactEnabled`, `messageBreakdown`, `gridRows` (fertiges Kästchenraster der Kommandozeile, für uns wertlos), `apiUsage`. Beobachtete Kategorien: `System prompt`, `System tools`, `MCP tools`, `MCP server instructions`, `Memory files`, `Skills`, `Messages`, `Free space` (`free`), dazu `MCP tools (deferred)`, `System tools (deferred)` (`deferred`). Eine Kategorie „Autocompact buffer“ kam in der Probe nicht vor; `Free space` war genau `maxTokens − totalTokens`.
- `{"subtype":"get_usage"}` → `response` mit `session` (Kosten und Dauer **dieses** Prozesses), `subscription_type` (z.B. `pro`), `rate_limits_available`, `rate_limits` und `behaviors`.
  - `rate_limits.limits`: Liste mit je `kind` (beobachtet `session` = 5-Stunden-Fenster, `weekly_all` = Woche), `group`, `percent` (0–100), `severity` (beobachtet nur `normal`), `resets_at` (ISO-8601 mit Zeitzone), `scope`, `is_active`. Daneben dieselben Werte noch einmal als `five_hour`/`seven_day` (`utilization`, `resets_at`) und viele Felder mit Codenamen, die `null` sind.
  - `behaviors.day` und `behaviors.week`: `request_count`, `session_count`, `behaviors` (je `key`, `pct`, `count`; beobachtet `long_context`, `cron`, `high_parallel`), `skills` (je `name`, `pct`), `agents`, `plugins`, `mcp_servers`. Die VS-Code-Erweiterung zeigt `long_context` als „usage at >150k context“, `cron` als „sessions active for 8+ hours“, `high_parallel` als „while 4+ sessions ran in parallel“ und nennt das Ganze eine Näherung aus den lokalen Sessions dieses Rechners.
  - Der Name im SDK sagt ausdrücklich, dass sich das Format ändern kann — jedes Feld ist optional zu lesen.
- **Hilfsprozess nur für das Kontingent:** `claude.exe -p --input-format stream-json --output-format stream-json --verbose --strict-mcp-config --no-session-persistence` mit Arbeitsverzeichnis `<Benutzerordner>\.verwalter`, dann sofort `get_usage` senden: Antwort nach rund 1,4 s, danach Prozess beenden. `--strict-mcp-config` ohne `--mcp-config` startet keine MCP-Server. Es entsteht kein Transkript; die Kommandozeile legt nur einmalig einen leeren Ordner `~\.claude\projects\C--Users-<name>--verwalter\memory` an. `--bare` ist ungeeignet (meldet sich nur mit API-Schlüssel an, nicht mit dem Abo).
