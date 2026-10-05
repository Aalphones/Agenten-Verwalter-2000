# Autarker Agent (Betriebsart „Autark“)

Ziel: Eine dritte Betriebsart „Autark“, in der kein Programm und kein Server von Anthropic beteiligt ist. Der Verwalter bringt dafür seinen eigenen Agenten mit: dieselbe `verwalter.exe`, gestartet als `verwalter.exe agent …`, spricht mit dem in LM Studio geladenen Modell über dessen OpenAI-kompatible Schnittstelle und übernimmt, was heute die Claude-Kommandozeile für uns erledigt: Werkzeuge (Lesen, Schreiben, Ändern, Suchen, Shell, Aufgabenliste, Rückfragen), Rechte und Rückfragen, PreToolUse-Hooks, die Anweisungen aus `CLAUDE.md` samt Einbindungen und Output-Style, Skills, Fortsetzen nach Neustart, Verdichten bei vollem Kontext, Bilder, die strukturierte Einmal-Antwort für TL;DR, Hintergrundprozesse, Subagenten, MCP-Server und Web (Abruf und Suche).

**Der Kniff:** Der eigene Agent spricht nach außen genau den Ausschnitt des Zeilenprotokolls der Claude-Kommandozeile, den der Verwalter heute liest und schreibt ([docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md), `src-tauri/src/agents/claude/protocol.rs` und `translate.rs`). Registry, Übersetzung, Rückfragen, Unterbrechen, Wiederherstellung, Chat und Hintergrund-Panel bleiben dadurch unverändert — im Core ändert sich nur, **welches Programm** mit welchen Argumenten startet.

**Voraussetzung:** Plan [2026-10-01_claude-code-lokal](../../archive/2026-10/2026-10-01_claude-code-lokal/README.md) ist umgesetzt (Betriebsart, `lmstudio`-Modul, `LocalBackend`, Einstellungszeilen, Ausblenden von Kontingent und Denkaufwand). Dieser Plan ergänzt die Betriebsart `Standalone`.

**Grundsätzlich nicht möglich in „Autark“:** die claude.ai-Connectoren (Google Drive, Claude Docs, Alpha Vantage …) — sie laufen über Server von Anthropic. **Nicht enthalten** (Folgepläne, falls gebraucht): Notebook-Werkzeug, Plan-Modus-Werkzeug, Hook-Ereignisse außer PreToolUse, automatisches Gedächtnis (`MEMORY.md`), OAuth-Anmeldung bei MCP-Servern. Der Agent sagt dem Modell im Systemprompt, was es nicht gibt.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 003](../../decisions/003-claude-anbindung.md), [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md), [ADR 007](../../decisions/007-anhaenge-skills-hintergrund.md), [ADR 016](../../decisions/016-betriebsarten-und-lokales-modell.md) (aus dem Vorgängerplan), [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md). ADR 017 entsteht in Phase 1.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Gerüst: Einstieg `agent`, Zeilenprotokoll, LM-Studio-Client, Transkript, Unterbrechen, Betriebsart „Autark“ — Chat ohne Werkzeuge | [phase-1-geruest.md](phase-1-geruest.md) | heikel | complete |
| 2 | Werkzeug-Schleife und Datei-Werkzeuge: Read, Write, Edit, Glob, Grep, TodoWrite, Pfadgrenzen; Konto-Zeile ohne `claude.exe` in „Autark“ | [phase-2-dateiwerkzeuge.md](phase-2-dateiwerkzeuge.md) | heikel | complete |
| 3 | Shell, Rechte, Rückfragen, Hooks: Bash, PowerShell, Modi, `can_use_tool`, AskUserQuestion, PreToolUse | [phase-3-shell-rechte-hooks.md](phase-3-shell-rechte-hooks.md) | heikel | pending |
| 4 | Anweisungen und Skills: Systemprompt, CLAUDE.md mit Einbindungen, Output-Style, Skill-Liste, Skill-Werkzeug, `/name` | [phase-4-anweisungen-skills.md](phase-4-anweisungen-skills.md) | standard | pending |
| 5 | Kontext, Verdichten, Bilder, Druckmodus für TL;DR, Kontext-Aufschlüsselung | [phase-5-kontext-bilder-druck.md](phase-5-kontext-bilder-druck.md) | standard | pending |
| 6 | Hintergrundprozesse und Scratchpad: `run_in_background`, `TaskStop`, `stop_task`, Aufgaben-Zeilen | [phase-6-hintergrund.md](phase-6-hintergrund.md) | standard | pending |
| 7 | Subagenten: Werkzeug `Agent`, Agent-Definitionen, Vorder- und Hintergrund, Schritte im Verwalter | [phase-7-subagenten.md](phase-7-subagenten.md) | heikel | pending |
| 8 | MCP-Server: stdio und HTTP, Konfiguration wie Claude Code, `mcp__…`-Werkzeuge, Steueranfragen des MCP-Dialogs | [phase-8-mcp.md](phase-8-mcp.md) | heikel | pending |
| 9 | Web: WebFetch und WebSearch (Brave); Doku, Abschluss | [phase-9-web-abschluss.md](phase-9-web-abschluss.md) | standard | pending |

**Reihenfolge:** nach Plan „Claude Code mit lokalem Modell“. Phasen strikt 1 → 9; nach jeder Phase ist die Betriebsart „Autark“ benutzbar, nur mit weniger Fähigkeiten. Phase 8 ist unabhängig vom geparkten Plan „MCP-Dialog“: sie beantwortet dessen Steueranfragen, egal ob der Dialog schon gebaut ist. Umsetzung direkt auf `main`, ein Commit pro Phase, Scope `standalone` (Phase 1 trägt ihn in [commits.md](../../conventions/commits.md) nach). Vor jedem Commit `pnpm check` grün; `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Neue Rust-Abhängigkeiten nur die unter „Festgelegte Entscheidungen“ genannten, hinzugefügt nach `mode-dependencies`. Bindings nach Änderungen an Typen über die Tauri-Grenze neu erzeugen und mitcommitten. Erkenntnisse nach [FINDINGS.md](FINDINGS.md).

**Testen ohne Oberfläche:** Der Agent ist ein Kommandozeilenprogramm. Jede Phase lässt sich direkt prüfen: `src-tauri\target\debug\verwalter.exe agent -p --input-format stream-json --output-format stream-json --verbose --model google/gemma-4-12b-qat --permission-mode default --session-id <uuid>` starten (Umgebung siehe Kontrakt), Zeilen aus dem Kontrakt auf die Standardeingabe schreiben, die Ausgabe lesen. Eine Hilfsdatei mit Beispielzeilen legt Phase 1 unter `artifacts/` an.

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 017](../../decisions/017-autarker-agent.md) „Autarker Agent“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen); die Phasen 6–9 ergänzen ihn um ihre Punkte. 016 vergibt der Vorgängerplan.

- **Dasselbe Programm mit Unterbefehl, kein zweites Binary.** `src-tauri/src/main.rs` prüft vor dem Start von Tauri das erste Argument; `agent` → `verwalter_lib::standalone::run(args)` und Prozessende mit dessen Exit-Code. Begründung: kein Sidecar-Bündeln, keine zweite Auslieferung, der Agent nutzt Core-Code direkt (`skills`, `attachments`-Format, `processes::hide_console`). Verworfen: (a) Agent als Thread im Core — verletzt „Sessions überleben die UI“ und Absturz-Isolation; (b) eigenes Binary als Tauri-Sidecar — Bündel-Aufwand ohne Gewinn.
- **Protokoll-kompatibel zur Claude-Kommandozeile** (Ausschnitt im Kontrakt). Verworfen: eigenes Protokoll mit eigenem Provider-Trait — hätte Registry, Übersetzung und Rückfrage-Fluss verdoppelt. Folge: Ändert sich die Übersetzung (`translate.rs`), muss der eigene Agent mitziehen; der Kontrakt hier ist die Referenz.
- **Modell-Schnittstelle: OpenAI-kompatibel**, `POST {base}/v1/chat/completions` mit `stream: true` und Werkzeugen. Nicht Anthropics `/v1/messages`, damit nichts am Format von Anthropic hängt und derselbe Agent auch mit Ollama oder llama.cpp läuft.
- **Werkzeugnamen und Parameternamen wie bei Claude Code** (`Read` mit `file_path`, `Edit` mit `old_string`/`new_string`, `Agent`, `WebFetch`, `mcp__<server>__<werkzeug>` …). Grund: die Anweisungen des Benutzers, seine Hooks (Matcher `Edit|Write|MultiEdit`, `Bash`, `Skill`, `mcp__atlassian__.*`) und die Übersetzung im Verwalter (`target_of`, `used_paths`, `TodoWrite`, `AskUserQuestion`, `Bash`-Exit-Code, Aufgaben-Zeilen) greifen damit unverändert.
- **Rechte:** Nur-Lese-Werkzeuge (`Read`, `Glob`, `Grep`, `TodoWrite`, `Skill`, `TaskStop`) laufen ohne Rückfrage. `Write`/`Edit`: Manuell → Rückfrage; Automatisch bearbeiten und Auto → erlaubt; Planen → abgelehnt mit „Im Modus Planen sind keine Änderungen erlaubt.“ `Bash`/`PowerShell`: Manuell, Automatisch bearbeiten und Planen → Rückfrage; Auto → erlaubt (es gibt keinen Sicherheits-Klassifizierer; ADR 017 benennt das als Risiko). `Agent` → erlaubt (die Werkzeuge des Subagenten fragen selbst). `WebFetch`/`WebSearch` und MCP-Werkzeuge: Manuell → Rückfrage, sonst erlaubt. `AskUserQuestion` → immer über die Rückfrage.
- **Pfadgrenze** für Datei-Werkzeuge: Arbeitsordner, jeder `--add-dir`-Ordner, die Ticket-Worktree-Muster aus `--allowedTools` (`Edit(//c/…/repo-wt-*/**)` → Lesen und Schreiben), der Scratchpad der Session (ab Phase 6) und `~/.claude/` (nur Lesen, für Skills und Anweisungen). Außerhalb → Rückfrage wie bei einem schreibenden Werkzeug, in jedem Modus.
- **Hooks:** nur `PreToolUse`, aus `~/.claude/settings.json`, `~/.claude/settings.local.json` und je Arbeitsordner und `--add-dir` aus `.claude/settings.json` und `.claude/settings.local.json`. Ausgeführt mit Git Bash, Zeitlimit 60 s. Exit 2 → blockiert, `stderr` geht als Fehler an das Modell; Exit 0 mit JSON `hookSpecificOutput.permissionDecision` `deny`/`allow`/`ask` wird beachtet; jeder andere Exit-Code → Hook ignoriert, `stderr` ins Protokoll. Gilt auch für Werkzeuge von Subagenten und für MCP-Werkzeuge.
- **Transkript:** eine JSONL-Datei je Session unter `%USERPROFILE%\.verwalter\agent\<session-id>.jsonl`, je Zeile eine Nachricht im OpenAI-Format. `--session-id` legt sie an (Fehler, wenn sie existiert), `--resume` liest sie (Fehler, wenn sie fehlt). Verdichten schreibt die Datei neu (erst in `<id>.jsonl.tmp`, dann umbenennen). Subagenten haben kein eigenes Transkript (nicht fortsetzbar).
- **Wechsel zwischen „Autark“ und den Claude-Betriebsarten nimmt den Verlauf nicht mit.** Die beiden Programme führen getrennte Transkripte (Claude: `%USERPROFILE%\.claude\projects\<Ordner>\<session-id>.jsonl`, belegt am 2026-10-01; eigener Agent: siehe oben). Die Registry setzt `--resume` deshalb nur, wenn das zu startende Programm ein Transkript dieser Session hat, sonst `--session-id`, und schreibt dann einen Fehler-Eintrag „Verlauf nicht übernommen“ in den Chat. Verworfen: Transkripte umrechnen — zwei Formate, Werkzeug-Ergebnisse und Denkblöcke passen nicht 1:1.
- **Gleichzeitigkeit:** ein Lese-Thread für stdin legt jede Zeile in einen Kanal; die Hauptschleife verarbeitet Kanal-Nachrichten. Modellanfrage, Werkzeuge, Subagenten und Hintergrundprozesse laufen in Arbeits-Threads; Abbruch über `Arc<AtomicBool>`. Ausgabezeilen schreibt nur `Output` (Sperre um stdout), damit sich Zeilen verschiedener Threads nie mischen. Nachrichten, die während einer Antwort ankommen, warten in einer Schlange und werden danach als nächster Turn verarbeitet.
- **Hintergrund (Phase 6):** Den Scratchpad-Ordner gibt seit ADR 022 der Verwalter vor: `<Workspace>\.scratchpad\<session-id>`, angelegt beim Start, dem Agenten genannt per `--append-system-prompt`; ein in `init` gemeldeter `scratchpad_path` wird ignoriert. Der eigene Agent legt deshalb keinen eigenen an; wie er den Pfad maschinenlesbar bekommt, legt Phase 6 fest (FINDINGS). Der Ordner liegt im Workspace und damit schon in der Pfadgrenze. Ausgaben von Hintergrundprozessen nach `<scratchpad>\tasks\<task-id>.output`. Hintergrundprozesse und -subagenten laufen bei Esc weiter, `stop_task` beendet sie; endet der Agent-Prozess, beendet er sie mit.
- **Subagenten (Phase 7):** im selben Prozess, eigener Thread und eigener Verlauf, dasselbe lokale Modell. Typ `general-purpose` ist eingebaut; weitere aus `~/.claude/agents/*.md` und `<Arbeitsordner bzw. add-dir>\.claude\agents\*.md` (Kopfdaten `name`, `description`, `tools`; `model` wird ignoriert). Subagenten können keine Subagenten starten. **Gleichzeitige Anfragen an LM Studio** sind dort einstellbar (Obergrenze beim Nutzer: 2, bevorzugt 1, weil parallele Berechnung jede einzelne stark verlangsamt) — nicht messen, sondern vom Regelfall „nacheinander“ ausgehen: Die Threads bleiben parallel, LM Studio reiht die Anfragen ein. Die Zeitgrenze einer Modellanfrage muss deshalb die Wartezeit in dieser Schlange mittragen (Hintergrund-Subagent neben dem Hauptagenten).
- **MCP (Phase 8):** eigener, schmaler Client für JSON-RPC 2.0 — stdio (Zeilen-JSON) und Streamable HTTP (POST mit `Accept: application/json, text/event-stream`), nur `initialize`, `notifications/initialized`, `tools/list`, `tools/call`. Verworfen: das Rust-SDK `rmcp` — größere Abhängigkeit für vier Methoden, API nicht geprüft. Konfiguration wie Claude Code: Benutzer- und lokaler Bereich in `%USERPROFILE%\.claude.json`, Projektbereich in `.mcp.json` im Arbeitsordner bzw. Repository. claude.ai-Connectoren fehlen; Server mit OAuth melden `failed` mit „Anmeldung (OAuth) wird im autarken Agenten nicht unterstützt.“ Werte aus Konfigurationen (Umgebung, Header) kommen nie ins Protokoll.
- **Web (Phase 9):** `WebFetch` holt die Seite selbst und lässt sie vom lokalen Modell zur Frage zusammenfassen. `WebSearch` über die **Brave Search API** (Entscheidung des Benutzers 2026-10-01), Schlüssel aus der Umgebungsvariable `VERWALTER_BRAVE_API_KEY`; ohne Schlüssel wird `WebSearch` dem Modell gar nicht angeboten. Suchanfragen gehen an Brave, Seitenabrufe an die jeweilige Seite — nichts an Anthropic.
- **Neue Abhängigkeiten:** `regex = "1"` (Hook-Matcher, Grep), `globset = "0.4"` (Glob, Pfadmuster), `ignore = "0.4"` (Verzeichnislauf mit `.gitignore`), in Phase 9 `html2text` (aktuelle Version nach `mode-dependencies`). HTTP weiter über das vorhandene `ureq`.
- **Grenzen gegen Endlosschleifen:** höchstens 50 Werkzeug-Runden je Turn (Subagent: 30), danach Abbruch mit Satz; Werkzeug-Ausgaben werden auf 30 000 Zeichen gekürzt.
- **Code-Ort:** Laufzeit des Agenten in `src-tauri/src/standalone/`; Startseite im Core (Programm und Unterbefehl) in `src-tauri/src/agents/standalone.rs`. Feature-Name `standalone`, Oberflächen-Begriff „Autark“.

## Kontrakt

### Start (vom Verwalter, `process.rs` und `print.rs`)

`<verwalter.exe> agent` gefolgt von den heutigen Argumenten aus `build_command` bzw. `print_command`. Der Agent **wertet aus**: `-p`, `--model <id>`, `--permission-mode <default|acceptEdits|plan|auto>`, `--session-id <id>`, `--resume <id>`, `--add-dir <pfad>` (mehrfach), `--allowedTools <regel>…` (mehrere Werte bis zur nächsten `--`-Option), `--append-system-prompt <text>` (hängt an den Systemprompt an; der Verwalter schreibt darüber den Scratchpad-Ordner vor, ADR 022), im Druckmodus `--system-prompt <text>`, `--json-schema <json>`, `--tools` (ein Wert, leer = keine Werkzeuge). Er **akzeptiert und ignoriert**: `--input-format`, `--output-format` (je mit Wert), `--verbose`, `--permission-prompt-tool` (mit Wert), `--effort` (mit Wert), `--safe-mode`, `--strict-mcp-config`, `--no-session-persistence`. Unbekannte Option → Zeile auf stderr, weiter.

Umgebung (setzt `LocalBackend::apply` für `Standalone`): `VERWALTER_AGENT_BASE_URL` (z. B. `http://localhost:1234`), `VERWALTER_AGENT_CONTEXT_WINDOW` (Ganzzahl), ab Phase 5 `VERWALTER_AGENT_VISION` (`1`/`0`). Fehlt eine der ersten beiden → Zeile auf stderr, Exit-Code 2. Optional, vom Benutzer gesetzt und vom Verwalter vererbt: `VERWALTER_BASH_PATH`, `VERWALTER_BRAVE_API_KEY`.

### Eingehende Zeilen (stdin, je Zeile ein JSON-Objekt)

| Zeile | Wirkung |
|---|---|
| `{"type":"user","message":{"role":"user","content": <Text oder Blöcke>}}` | Neuer Turn (oder in die Schlange). Blöcke wie aus `attachments::message_content`: `{"type":"text","text":…}`, `{"type":"image","source":{"type":"base64","media_type":…,"data":…}}`. |
| `{"type":"control_request","request_id":R,"request":{"subtype":"interrupt"}}` | Laufenden Turn und Vordergrund-Subagenten abbrechen; Hintergrund läuft weiter; Antwort `success`. |
| `… "request":{"subtype":"set_permission_mode","mode":M}` | Modus ab sofort; Antwort `success`. |
| `… "request":{"subtype":"set_model","model":X}` | Modell ab der nächsten Anfrage; Antwort `success`. |
| `… "request":{"subtype":"get_context_usage"}` | Antwort `success` mit Aufschlüsselung (ab Phase 5; vorher `error`). |
| `… "request":{"subtype":"stop_task","task_id":T}` | Ab Phase 6: Hintergrundprozess bzw. -subagent `T` beenden; Antwort `success` (unbekannte ID: `error`). Vorher immer `success`. |
| `… "request":{"subtype":"mcp_status"}` | Ab Phase 8: Antwort `success` mit `{"mcpServers":[…]}` (Format in Phase 8); vorher `error`. |
| `… "request":{"subtype":"mcp_reconnect","serverName":N}` / `{"subtype":"mcp_toggle","serverName":N,"enabled":B}` | Ab Phase 8: Antwort `success` mit `"response":{}` nach Abschluss, Fehler als `error`; vorher `error`. |
| jede andere `subtype` | Antwort `{"subtype":"error","request_id":R,"error":"nicht unterstützt: <subtype>"}`. |
| `{"type":"control_response","response":{"subtype":"success","request_id":A,"response":{"behavior":"allow","updatedInput":{…}}}}` bzw. `"behavior":"deny","message":…` | Antwort auf eine eigene `can_use_tool`-Anfrage `A`. |

Antworten auf Steueranfragen: `{"type":"control_response","response":{"subtype":"success","request_id":R,"response":{…}}}` (ohne Inhalt: `"response":{}`), Fehler `{"type":"control_response","response":{"subtype":"error","request_id":R,"error":<Text>}}`.

### Ausgehende Zeilen (stdout, je Zeile ein JSON-Objekt, UTF-8, `\n`)

- Nach dem Start, vor allem anderen: `{"type":"system","subtype":"init","session_id":S,"model":M,"cwd":C,"tools":[Namen]}`, ab Phase 6 zusätzlich `"scratchpad_path":<Pfad>`.
- Je Modellantwort **eine** Zeile `{"type":"assistant","session_id":S,"parent_tool_use_id":null,"message":{"role":"assistant","content":[Blöcke],"usage":{"input_tokens":P,"output_tokens":O}}}`. Blöcke in dieser Reihenfolge: `{"type":"thinking","thinking":…}` (nur wenn das Modell `reasoning_content` liefert), `{"type":"text","text":…}` (nur wenn nicht leer), je Werkzeug-Aufruf `{"type":"tool_use","id":I,"name":N,"input":{…}}`. `P` = `prompt_tokens` der Antwort (fehlt die Angabe: Zeichen aller gesendeten Nachrichten / 4, abgerundet). Bei einem Subagenten ist `parent_tool_use_id` die ID seines `Agent`-Aufrufs, `usage` entfällt.
- Nach jeder Werkzeug-Runde **eine** Zeile `{"type":"user","session_id":S,"parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":I,"is_error":E,"content":T}, …]}}`. Bei `Bash`/`PowerShell` mit Exit-Code ≠ 0: `is_error: true`, `T` beginnt mit `Exit code <n>\n` (so liest `translate.rs` den Exit-Code). Enthält die Runde ein `Agent`-Ergebnis, trägt die Zeile zusätzlich `"tool_use_result":{"resolvedModel":M}`. Ergebnisse eines Subagenten tragen seine `parent_tool_use_id`.
- Aufgaben (ab Phase 6/7): `{"type":"system","subtype":"task_started","task_id":T,"tool_use_id":I,"task_type":"local_bash"|"local_agent","description":D,"subagent_type":<Typ oder null>}`; `{"type":"system","subtype":"task_progress","task_id":T,"usage":{"tool_uses":N}}`; `{"type":"system","subtype":"task_notification","task_id":T,"status":"completed"|"failed"|"stopped","summary":<Text>,"output_file":<Pfad oder null>}`.
- Rückfrage: `{"type":"control_request","request_id":"agent-<n>","request":{"subtype":"can_use_tool","tool_name":N,"input":{…}}}`.
- Turn-Ende: `{"type":"result","subtype":"success","is_error":false,"result":<letzter Text>,"session_id":S,"terminal_reason":"completed","modelUsage":{M:{"contextWindow":W}}}`. Fehler: `"subtype":"error_during_execution","is_error":true,"result":<Satz>`. Abbruch: `"terminal_reason":"aborted_streaming"`, `is_error: false`.
- Druckmodus (`-p` mit `--json-schema`): genau eine Zeile `{"type":"result","subtype":"success","is_error":false,"result":<Rohtext>,"structured_output":{…}}`, im Fehlerfall `is_error: true` mit `result` = Satz.

### Werkzeuge (Name · Parameter · Ergebnis)

| Werkzeug | Parameter (JSON-Schema-Typen) | Ergebnis | Phase |
|---|---|---|---|
| `Read` | `file_path` string (Pflicht), `offset` integer, `limit` integer | Zeilen mit Nummer `{n:>6}\t{zeile}`, Standard 2000 Zeilen, Zeilen über 2000 Zeichen gekürzt; Bilder siehe Phase 5 | 2 |
| `Write` | `file_path`, `content` (Pflicht) | „Datei geschrieben: <pfad>“ | 2 |
| `Edit` | `file_path`, `old_string`, `new_string` (Pflicht), `replace_all` boolean | „Datei geändert: <pfad> (<n> Stelle(n))“ | 2 |
| `Glob` | `pattern` (Pflicht), `path` | Pfade, neueste zuerst, höchstens 200 | 2 |
| `Grep` | `pattern` (Pflicht), `path`, `glob`, `output_mode` (`content`, `files_with_matches`, `count`; Standard `files_with_matches`), `-i` boolean, `head_limit` integer (Standard 250) | wie `output_mode` | 2 |
| `TodoWrite` | `todos` array von `{content, status: pending/in_progress/completed, activeForm}` | „Aufgabenliste aktualisiert.“ | 2 |
| `Bash` | `command` (Pflicht), `timeout` integer (ms, Standard 120 000, höchstens 600 000), `description`, ab Phase 6 `run_in_background` boolean | stdout und stderr zusammen; im Hintergrund „Command running in background with ID: <T>. Output is being written to: <Datei>“ | 3/6 |
| `PowerShell` | wie `Bash` | wie `Bash` | 3/6 |
| `AskUserQuestion` | `questions` array von `{question, header, options: [{label, description}], multiSelect}` | die Antworten als „<Frage>: <Antwort>“ je Zeile | 3 |
| `Skill` | `skill` (Pflicht), `args` | Inhalt des Skills | 4 |
| `TaskStop` | `task_id` (Pflicht) | „Aufgabe <T> beendet.“ | 6 |
| `Agent` | `description`, `prompt` (Pflicht), `subagent_type` (Standard `general-purpose`), `run_in_background` boolean | letzter Text des Subagenten; im Hintergrund eine Startmeldung | 7 |
| `mcp__<server>__<werkzeug>` | Schema des Servers (`inputSchema`) | Textinhalte des Ergebnisses | 8 |
| `WebFetch` | `url`, `prompt` (Pflicht) | Antwort des Modells auf `prompt` anhand der Seite, mit „Quelle: <url>“ | 9 |
| `WebSearch` | `query` (Pflicht) | Treffer als „Titel — URL — Beschreibung“ je Zeile | 9 |

## Finale Abnahmekriterien

1. Einstellungen → „Betriebsart“ hat einen dritten Knopf „Autark“; das i-Symbol erklärt ihn in einem Satz („ohne Claude-Kommandozeile und ohne Anthropic: eigener Agent des Verwalters mit dem lokalen Modell“). „Lokales Modell“ gilt auch hier.
2. In „Autark“ startet keine `claude.exe` — weder für Sessions noch für TL;DR noch für das Kontingent (Task-Manager: nur `verwalter.exe`-Prozesse), und keine Verbindung geht an Anthropic.
3. Eine Session in „Autark“ beantwortet Nachrichten, liest, sucht und ändert Dateien in ihren Repositories, führt Befehle in Bash und PowerShell aus; der Chat zeigt Werkzeug-Gruppen, Befehle mit Exit-Code und die Aufgabenliste wie bei Claude.
4. Im Modus „Manuell“ fragt jede Änderung und jeder Befehl im Chat nach; „Ablehnen“ lässt das Modell einen anderen Weg suchen. Eine Datei außerhalb von Workspace und Repositories löst immer eine Rückfrage aus.
5. Ein PreToolUse-Hook des Benutzers, der mit Exit 2 blockiert, verhindert den Aufruf; das Modell bekommt den Text des Hooks.
6. Das Modell kennt die Anweisungen aus `~/.claude/CLAUDE.md` samt `@`-Einbindungen, die `CLAUDE.md` der Repositories und den eingestellten Output-Style. `/name` ruft einen Skill auf; das Modell kann Skills auch selbst über `Skill` laden.
7. Esc unterbricht eine laufende Antwort und einen laufenden Vordergrund-Befehl; die Session steht danach auf „Pausiert“ und nimmt die nächste Nachricht an. Hintergrundprozesse laufen weiter.
8. Nach einem Neustart der App setzt die Session den Verlauf fort.
9. Läuft der Kontext voll, verdichtet der Agent selbst und arbeitet weiter; der Kontext-Donut sinkt danach.
10. Ein angehängtes Bild wird bei einem Bildmodell beschrieben. TL;DR funktioniert in „Autark“.
11. Ein Dev-Server, den der Agent im Hintergrund startet, erscheint im Hintergrund-Panel unter „Prozesse“ mit Ausgabe; „Stoppen“ beendet ihn. Der Scratchpad-Reiter zeigt den Ordner der Session.
12. Ein Subagent erscheint im Hintergrund-Panel unter „Subagenten“ mit seinen Schritten; sein Ergebnis kommt beim Hauptagenten an. Ein Subagent im Hintergrund meldet sich nach Abschluss beim Hauptagenten.
13. Ein lokaler MCP-Server des Benutzers (z. B. `comfy`) steht dem Modell mit seinen Werkzeugen zur Verfügung; ein Hook mit Matcher `mcp__<server>__.*` greift. Ist der Plan „MCP-Dialog“ gebaut, zeigt der Dialog in „Autark“ die Server dieses Agenten.
14. „Hol die Seite <url> und fasse sie zusammen“ und — mit gesetztem Brave-Schlüssel — „Such im Web nach <Thema>“ funktionieren; ohne Schlüssel sagt das Modell, dass es nicht suchen kann.
15. `pnpm check` grün, lokal und in der GitHub-Prüfung; Bindings unverändert nach `pnpm bindings`.

## Smoke-Checkliste

Vorbereitung: LM Studio mit `google/gemma-4-12b-qat` (Kontext ≥ 64 000) geladen, Server an, Betriebsart „Autark“; für 14 `VERWALTER_BRAVE_API_KEY` gesetzt (vor dem Start des Verwalters).

Wackelstellen zuerst:

1. **Unterbrechen (AK 7):** Aufgabe „Führe in Bash `sleep 30` aus und sag dann fertig“ → Esc während des Befehls → „Pausiert“ binnen 2 s, kein `bash.exe` bleibt im Task-Manager; neue Nachricht wird beantwortet.
2. **Subagent (AK 12):** „Lass einen Subagenten alle TODO-Kommentare in `src/` zählen“ → Subagent im Panel mit Schritten, Ergebnis im Chat. Danach dasselbe mit „im Hintergrund“ → Hauptagent antwortet sofort, meldet später das Ergebnis.
3. **MCP (AK 13):** „Welche Werkzeuge hat der MCP-Server comfy?“ → Antwort nennt Werkzeuge; ein Aufruf (z. B. `server_info`) läuft.
4. **Fortsetzen nach Neustart (AK 8):** Satz „Merke dir das Wort Bisasam“, App beenden, neu starten, „Welches Wort solltest du dir merken?“.
5. **Hook (AK 5):** Testhook in `~/.claude/settings.local.json` mit Matcher `Write` und Befehl `bash -c "echo verboten >&2; exit 2"`; Agent eine Datei schreiben lassen → Chat zeigt den abgelehnten Aufruf, das Modell nennt „verboten“. Hook danach entfernen.
6. **Pfadgrenze (AK 4):** im Modus „Auto“ eine Datei unter `C:\Users\<name>\Desktop` lesen lassen → Rückfrage.
7. **Verdichten (AK 9):** in einer Session mit 32 000 geladenem Kontext mehrere große Dateien lesen lassen, bis der Donut über 80 % steht → nächste Antwort kommt, Donut sinkt, das Modell weiß noch die Aufgabe.
8. **Kein Anthropic (AK 2):** Netzwerk-Mitschnitt wie in Phase 1 des Vorgängerplans (`artifacts/messung.ps1` dort, Aufruf auf `verwalter.exe agent` angepasst) bei einer Aufgabe ohne Web — keine Verbindung außer Loopback und den MCP-Servern.
9. Hintergrund-Prozess (AK 11), Anweisungen (AK 6), Bild und TL;DR (AK 10), Web (AK 14), Rückfrage mit Auswahl (`AskUserQuestion`), Aufgabenliste.
10. Zurück auf „Claude“ und auf „Claude Code + LM Studio“: Sessions laufen dort weiter wie vorher (der autarke Verlauf geht dabei **nicht** mit — Eintrag „Verlauf nicht übernommen“).

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
