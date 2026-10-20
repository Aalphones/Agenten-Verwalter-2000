# Phase 6 — Druckmodus und Abschluss

**Status:** complete

## Kontext

Lesen: [README.md](README.md) (Entscheidung „Druckmodus“, Kontrakt „Start“ im Druckmodus), `src-tauri/src/agents/claude/print.rs` (`print_program`, `PrintProgram`, `print_command`, `run_print`, `structured_output`), `src-tauri/src/standalone/print.rs` (Muster des Druckmodus im eigenen Agenten), `src-tauri/src/tldr/`, `src-tauri/src/retro/`, `git_suggest_message` in `commands/git.rs`.

Fehlerklassen geprüft: keine einschlägig.

## AK der Phase

1. In „Codex“ wählt `print_program` den Übersetzer; TL;DR, Mini-Retro und Commit-Vorschlag liefern ihr Ergebnis ohne Claude-Kommandozeile.
2. Der Übersetzer im Druckmodus (`--json-schema` gesetzt): `thread/start {ephemeral: true, baseInstructions: <--system-prompt>, sandbox: "read-only", approvalPolicy: "never"}`, `turn/start` mit `outputSchema` = geparstes Schema, Modell = `--model` (leer → Standard), `effort: "low"`; genau eine Zeile `output::print_success(roher Text, geparstes JSON)` bzw. `print_error(Satz)`; keine Thread-Datei.
3. Doku vollständig: ADR 031, Code-Map, Glossar, AGENTS.md, `docs/knowledge/codex-app-server.md` (die benutzten Methoden, Benachrichtigungen und Antwortformen mit Version `codex-cli 0.162.0-alpha.2` als Stand, Weg zum Schema).

## Checkliste

- [x] `print.rs`: `print_program` liest die Betriebsart; „Codex“ → `PrintProgram` mit `codex::program()`, `codex::leading_args()`, Umgebung `VERWALTER_CODEX_EXE`; Modell = `default_codex_model` (leer → `--model ""`, weil der Übersetzer die Option verlangt).
- [x] `codex/print.rs` gemäß AK 2; in `codex::run` verzweigen, wenn `args.print`.
- [x] Probe: Einmal-Aufruf des Übersetzers gegen das echte Codex mit einem Schema `{summary}` — Zeile `success` mit `structured_output`, Exit 0. TL;DR und Commit-Vorschlag in der App: Smoke 8.
- [x] `docs/knowledge/codex-app-server.md` anlegen und in `docs/knowledge/INDEX.md` eintragen.
- [x] ADR 031 abschließen; Code-Map-Kopfsatz „Stand:“ um Codex ergänzen; Glossar prüfen (Einträge „Codex“, „Übersetzer“ standen schon).
- [x] Plan archivieren nach `docs/archive/2026-10/`, STATE.md nachziehen. Release nach [releases.md](../../conventions/releases.md) (Minor-Version) — auf Zuruf des Benutzers.

## Report-Back

Druckmodus steht: `print_program` wählt in „Codex“ den Übersetzer, `codex/print.rs` beantwortet über einen kurzlebigen Thread mit `outputSchema`. Live gegen Codex geprüft (Einmal-Aufruf). Nicht umgesetzt, als Follow-up in der README: Rückfrage-Text „Claude möchte …“, Claude-Modell in Nebenanzeigen, Hilfetexte zu Skills-Spiegel, Anmeldung und Modus Auto.
