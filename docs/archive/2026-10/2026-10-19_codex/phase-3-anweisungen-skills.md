# Phase 3 — Anweisungen, Skills, Anhänge

## Kontext

Lesen: [README.md](README.md), `~/.codex/AGENTS.md` (globale Codex-Anweisungen des Benutzers — verweist auf `~/.codex/sync/CLAUDE.md` und den Output-Style; Codex lädt sie selbst), [ADR 007](../../decisions/007-anhaenge-skills-hintergrund.md), [ADR 022](../../decisions/022-scratchpad-im-workspace.md).

Code-Stellen:

- `src-tauri/src/standalone/invocation.rs` (`render`, `expand_message`) — `/name`-Aufruf und `$ARGUMENTS`.
- `src-tauri/src/skills/` (`collect`, `find_file`, `match_invocation`, `skills_dir`), `skill_roots` in `sessions/registry.rs`.
- `src-tauri/src/attachments/` (`message_content`: Text- und Bildblöcke, Bilder als base64).
- `src/features/chat/useCommandMenu.ts`, `commandMenuRows.ts` (welche Zeilen im `/`-Menü stehen).

Fehlerklassen geprüft: keine einschlägig.

## AK der Phase

1. `thread/start` und `thread/resume` bekommen `developerInstructions` = Text aus `--append-system-prompt` (Scratchpad, Artefakte) + je `--add-dir`-Ordner dessen `AGENTS.md`, wenn vorhanden (je Datei höchstens 32 KiB, sonst nur der Hinweis „Lies <pfad>\AGENTS.md vor der Arbeit.“), getrennt durch eine Zeile `--- AGENTS.md aus <ordner> ---`.
2. `/name args` als erste Zeile einer Nachricht: ist `name` ein Skill (Ordner mit `SKILL.md`), geht an Codex `{"type":"skill","name":…,"path":<SKILL.md>}` plus der Text; ist es ein Befehl (`commands/<name>.md`), geht der von `invocation::render` erzeugte Text; sonst bleibt die Nachricht unverändert.
3. Bilder aus Anhängen gehen als `{"type":"image","url":"data:<media_type>;base64,<data>"}` an Codex.
4. Das `/`-Menü zeigt in „Codex“ Skills und Befehle, aber nicht `/mcp`, `/chrome` und keine Claude-eigenen Befehle (Liste wie in den lokalen Betriebsarten, plus `/mcp` ausgeblendet).

## Checkliste

- [x] `codex/instructions.rs`: `fn developer_instructions(append: Option<&str>, cwd: &Path, add_dirs: &[PathBuf]) -> Option<String>` gemäß AK 1 (der Arbeitsordner zählt nicht, Codex lädt dessen `AGENTS.md` selbst); in `session.rs` an `thread/start`/`thread/resume` übergeben.
- [x] `codex/input.rs`: `fn user_input(content: &Value, home: &Path, roots: &[(String, PathBuf)]) -> Vec<Value>`: erste Text-Zeile auf `/name` prüfen (gleiche Erkennung wie `invocation::expand_message`, Skill-Wurzeln wie Standalone sie aus `add_dirs` und Benutzerordner bildet); Skill → `skill`-Eintrag + verbleibender Text (nur mit Katalog-Pfad, s. Report-Back); Befehl → gerenderter Text; Bilder → Data-URL. Leere Textblöcke weglassen.
- [x] `useCommandMenu.ts`/`commandMenuRows.ts`: in „Codex“ dieselben Ausblendungen wie in den lokalen Betriebsarten und zusätzlich `/mcp`; `/chrome` ausgeblendet (stand schon seit Phase 2).
- [x] `Composer.tsx`: Browser-Schalter in „Codex“ ausgeblendet (stand schon); MCP-Hinweis (`McpProblemChip`) in „Codex“ nicht gezeigt.
- [x] Probe gegen `codex-cli` der VS-Code-Erweiterung 26.1007.21434: `AGENTS.md` aus `--add-dir` und Scratchpad-Pfad kommen an; `/plan` (Befehl) wirkt; `/mode-planning` wirkt mit Katalog-Pfad (`<skill>`-Block im Verlauf); Bild-Data-URL → „Rot“ für ein rotes Bild.
- [x] ADR 031: Abschnitte Anweisungen, Skills und Befehle, MCP ergänzt.

## Report-Back

Umgesetzt wie geplant, mit drei Abweichungen:

- **Skill-Pfad:** Codex verwirft einen `skill`-Eintrag ohne Meldung, wenn dessen Pfad nicht in seinem Katalog `~/.codex/skills` liegt (Probe: mit `~/.claude/skills/…` kam kein `<skill>`-Block im Verlauf, das Modell antwortete falsch). Der Übersetzer sendet deshalb für einen gespiegelten Skill den Katalog-Pfad; Skills aus Repositories oder ohne Spiegel gehen als gerenderter Text (`invocation::render`), wie ein Befehl.
- **PDF-Anhänge:** Codex nimmt nur Bilder an; ein PDF-Block wird durch den Hinweissatz „[PDF-Anhang nicht übertragen: Codex nimmt nur Bilder an.]“ ersetzt, statt stumm zu verschwinden.
- **Leere Nachricht:** Ergibt die Eingabe keinen Eintrag, antwortet der Übersetzer mit einem `result`-Fehler statt `turn/start` ohne Eingabe.

Offen für den Smoke: `/mode-planning` in der echten Oberfläche (Skills mit `WORK.md`/Anhängen laufen als Katalog-Eintrag, Codex liest die Nebendateien selbst).
