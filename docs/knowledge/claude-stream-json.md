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
{"type":"control_request","request_id":"app-2","request":{"subtype":"set_model","model":"claude-sonnet-5"}}
{"type":"control_request","request_id":"app-3","request":{"subtype":"set_permission_mode","mode":"acceptEdits"}}
```

- `interrupt`, `set_model`, `set_permission_mode` wirken mitten in der Session ohne Neustart; jede Anfrage wird mit `{"type":"control_response","response":{"subtype":"success","request_id":…}}` bestätigt.
- `set_max_thinking_tokens` wird angenommen. **`set_effort` gibt es nicht** (`"Unsupported control request subtype: set_effort"`) — der Denkaufwand lässt sich nur beim Start setzen; ein Wechsel heißt Prozess beenden und mit `--resume <id> --effort <neu>` neu starten, der Verlauf bleibt.
- Nach `set_model` erscheint eine `user`-Zeile mit Text-Inhalt `<local-command-stdout>Set model to …</local-command-stdout>` — keine Nutzernachricht.

## Ereignisse vom Agenten (stdout)

| `type` / `subtype` | Bedeutung |
|---|---|
| `system` / `init` | Nach jedem Start und vor jeder Antwort. Felder u.a. `session_id`, `cwd`, `model`, `permissionMode`, `tools`, `slash_commands`, `skills`, `agents`, `claude_code_version`. |
| `system` / `thinking_tokens` | Laufender Zähler, solange das Modell nachdenkt. Viele Zeilen, kein Inhalt. |
| `system` / `status` | Z.B. nach Moduswechsel, Feld `permissionMode`. |
| `system` / `background_tasks_changed`, `task_started`, `task_notification` | Hintergrundprozesse (`task_type: "local_bash"`, `task_id`, `description`, `tool_use_id`). |
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
