# 017 — Autarker Agent (Betriebsart „Autark“)

**Status:** angenommen · **Datum:** 2026-10-05

## Kontext

Die Betriebsart „Claude Code + LM Studio“ (ADR 016) lässt das Modell lokal laufen, startet aber weiter die Claude-Kommandozeile — ein Programm von Anthropic, bei dem nicht garantiert ist, dass nichts an Anthropic geht. Der Benutzer will eine dritte Betriebsart, in der kein Programm und kein Server von Anthropic beteiligt ist, mit möglichst viel von dem, was die Kommandozeile heute für den Verwalter erledigt: Werkzeuge, Rechte und Rückfragen, PreToolUse-Hooks, Anweisungen aus `CLAUDE.md`, Skills, Fortsetzen nach Neustart, Verdichten, Bilder, TL;DR, Hintergrundprozesse, Subagenten, MCP-Server, Web.

## Optionen

- **Wo der Agent läuft:** (a) als Thread im Core; (b) als eigenes Binary, gebündelt als Tauri-Sidecar; (c) dasselbe Programm `verwalter.exe` mit dem Unterbefehl `agent`.
- **Wie er mit dem Verwalter spricht:** (a) eigenes Protokoll hinter einem Provider-Trait; (b) derselbe Ausschnitt des Zeilenprotokolls der Claude-Kommandozeile, den der Verwalter heute liest und schreibt.
- **Welche Modell-Schnittstelle:** (a) Anthropics `/v1/messages`; (b) die OpenAI-kompatible `/v1/chat/completions`.
- **Verlauf beim Wechsel der Betriebsart:** (a) Transkripte umrechnen; (b) getrennte Transkripte, der Verlauf beginnt neu.

## Entscheidung

- **Dasselbe Programm mit Unterbefehl (c).** `main.rs` prüft vor dem Start von Tauri das erste Argument; `agent` → `standalone::run` und Prozessende mit dessen Exit-Code. Kein Sidecar-Bündeln, keine zweite Auslieferung, der Agent nutzt Core-Code direkt. Verworfen: Thread im Core — verletzt „Sessions überleben die UI“ und die Absturz-Isolation; Sidecar — Bündel-Aufwand ohne Gewinn.
- **Protokoll-kompatibel zur Claude-Kommandozeile (b).** Registry, Übersetzung, Rückfragen, Unterbrechen, Wiederherstellung, Chat und Hintergrund-Panel bleiben unverändert; im Core ändert sich nur, welches Programm mit welchen Argumenten startet (`agents/standalone.rs`, `leading_args` in `process.rs`). Verworfen: eigenes Protokoll — hätte Registry, Übersetzung und Rückfrage-Fluss verdoppelt.
- **OpenAI-kompatible Schnittstelle (b)**, `POST {base}/v1/chat/completions` mit Streaming und Werkzeugen. Nichts hängt am Format von Anthropic; derselbe Agent läuft auch mit Ollama oder llama.cpp.
- **Werkzeug- und Parameternamen wie bei Claude Code** (`Read` mit `file_path`, `Edit` mit `old_string`/`new_string`, `mcp__<server>__<werkzeug>` …): Anweisungen, Hooks und die Übersetzung im Verwalter greifen unverändert.
- **Rechte:** Nur-Lese-Werkzeuge ohne Rückfrage; `Write`/`Edit` je nach Modus Rückfrage, erlaubt oder (Planen) abgelehnt; `Bash`/`PowerShell` nur im Modus Auto ohne Rückfrage; `AskUserQuestion` immer über die Rückfrage. Dateien außerhalb von Arbeitsordner, `--add-dir`-Ordnern, Ticket-Worktrees, Scratchpad und (nur lesend) `~/.claude/` lösen in jedem Modus eine Rückfrage aus.
- **Hooks:** nur `PreToolUse`, aus den `settings.json`/`settings.local.json` des Benutzers und der Arbeitsordner, ausgeführt mit Git Bash, Zeitlimit 60 s; Exit 2 blockiert.
- **Getrennte Transkripte (b).** Der eigene Agent schreibt je Session `<Benutzerordner>\.verwalter\agent\<session-id>.jsonl`, je Zeile eine Nachricht im OpenAI-Format; `--session-id` legt an, `--resume` liest, Verdichten schreibt über eine Hilfsdatei neu. Die Registry setzt `--resume` nur, wenn das zu startende Programm ein Transkript dieser Session hat (Claude: `<Basis>\projects\<Ordner>\<id>.jsonl`), sonst `--session-id`, und meldet dann im Chat „Verlauf nicht übernommen“. Verworfen: Umrechnen — zwei Formate, Werkzeug-Ergebnisse und Denkblöcke passen nicht 1:1.
- **Gleichzeitigkeit:** ein Lese-Thread für stdin, die Modellanfrage in einem Arbeits-Thread, Abbruch über ein `AtomicBool` je Turn; nur `Output` schreibt auf stdout. Ein `interrupt` meldet den Turn sofort als abgebrochen, ohne auf den Arbeits-Thread zu warten — der merkt den Abbruch erst beim nächsten Stück der Antwort, und während LM Studio den Prompt verarbeitet, kommt lange keins. Der nächste Turn beginnt erst, wenn der Arbeits-Thread zurück ist; nach dem Abbruch steht `[Request interrupted by user]` im Verlauf, der halb geschriebene Text nicht.
- **Grenzen gegen Endlosschleifen:** höchstens 50 Werkzeug-Runden je Turn (Subagent 30), Werkzeug-Ausgaben gekürzt auf 30 000 Zeichen.
- **Code-Ort:** Laufzeit in `src-tauri/src/standalone/`, Startseite im Core in `src-tauri/src/agents/standalone.rs`; Feature-Name `standalone`, Oberflächen-Begriff „Autark“. Die Umgebung (`VERWALTER_AGENT_BASE_URL`, `VERWALTER_AGENT_CONTEXT_WINDOW`) setzt `local::apply`, das Programm wählt `LocalBackend.program`.

## Konsequenzen

- **Auto-Modus ohne Sicherheits-Klassifizierer:** Im Modus Auto laufen Shell-Befehle ohne Rückfrage; anders als bei der Claude-Kommandozeile prüft nichts, ob ein Befehl gefährlich ist. Wer Auto wählt, verlässt sich allein auf das lokale Modell.
- **Kein Verlauf über den Wechsel der Betriebsart:** Wechselt eine Session zwischen „Autark“ und einer Claude-Betriebsart, kennt der Agent den bisherigen Verlauf nicht. Zurück in der vorigen Betriebsart setzt er dessen Transkript fort.
- **Mitziehen bei Änderungen an der Übersetzung:** Ändert sich, was `translate.rs` liest, muss der eigene Agent mitziehen; der Kontrakt im Plan „Autarker Agent“ ist die Referenz.
- **Hintergrundprozesse:** `Bash`/`PowerShell` mit `run_in_background` schreiben ihre Ausgabe nach `<Scratchpad>\tasks\<id>.output`; den Ordner nennt der Verwalter dem Agenten zusätzlich zur Vorgabe im Prompt über `VERWALTER_AGENT_SCRATCHPAD` (ohne die Variable, beim Aufruf von Hand: `<Benutzerordner>\.verwalter\agent\<id>\scratchpad`). Sie laufen bei Esc weiter, enden mit `TaskStop`, `stop_task` oder dem Agent-Prozess, und ihr Ende meldet ein Überwacher erst, wenn der Prozess wirklich beendet ist. Wird der Agent hart abgeschossen statt über das Ende der Standardeingabe, bleiben sie liegen. Den Hinweis über ein beendetes Hintergrund-Kommando bekommt das Modell erst mit der nächsten Modellanfrage — einen eigenen Turn löst das Ende nicht aus.
- **Nicht enthalten:** claude.ai-Connectoren (laufen über Server von Anthropic), Notebook-Werkzeug, Plan-Modus-Werkzeug, Hook-Ereignisse außer PreToolUse, automatisches Gedächtnis (`MEMORY.md`), OAuth-Anmeldung bei MCP-Servern.
