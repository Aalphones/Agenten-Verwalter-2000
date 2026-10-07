# STATE

**Aktiver Plan:** `docs/planning/2026-10-01_autarker-agent/` (Autark)
**Phase:** 9/9 — Web und Abschluss (pending; Phase 8 complete)
**Nächster Schritt:** Autark Phase 9 in frischer Session (`phase-9-web-abschluss.md`, zuerst FINDINGS → Phase 9). Phasen 1–8 fertig. Phase-8-Smoke (MCP: `comfy` verbinden und aufrufen, Rückfrage in „Manuell“, Hook `mcp__comfy__.*`, kaputter Server, Dialog — Wackelstellen im FINDINGS-Eintrag „Smoke (Phase 8)“) und Phase-7-Smoke (Subagent vorne und im Hintergrund, Stoppen, Rückfrage aus dem Subagenten, eigene Definition `pruefer.md`, Umlaute aus `ping`) sowie Phase-5- und Phase-6-Smokes (Verdichten, Bild, TL;DR, Hintergrundprozess samt Hinweis/TaskStop/Stoppen im Panel) mit echtem Modell stehen noch aus; Smokes „Git-Werkzeuge“, „Session-Übergabe“, „Dateiverweise im Chat“ und „Claude-Konto“ weiter offen.

## Reihenfolge der geparkten Pläne in `docs/planning/`

1. ~~MCP-Dialog~~ — erledigt und archiviert (`v0.8.0`).
1a. ~~Sidebar nach letzter Aktivität~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-02_sidebar-aktivitaet.md`), Migration 8 und ADR 019.
1b. ~~Innere Repositories~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-02_innere-repositories/`, `v0.11.0`, ADR 020). Changes-Review: dessen FINDINGS trägt den Hinweis auf `changes/sources.rs`.
2. ~~Session-Changes~~ — erledigt und archiviert (`v0.9.0`).
3. ~~Changes-Review~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-01_changes-review/`, `v0.12.0`, ADR 015).
4. ~~Claude Code + LM Studio~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-01_claude-code-lokal/`, `v0.13.0`, ADR 016).
4a. ~~Claude-Konto~~ — umgesetzt und archiviert (`docs/archive/2026-10/2026-10-05_claude-konto.md`, ADR 021); `v0.14.0`.
5. **Autark** (`autarker-agent`) — Phasen 1–8 fertig, größter Plan (9 Phasen, drei „heikel“).
6. ~~Dateiverweise im Chat~~ — auf Zuruf archiviert (`docs/archive/2026-10/2026-10-05_dateiverweise-im-chat.md`, ADR 023), Smoke offen; `v0.15.0` auf Zuruf gesetzt. Prüfprogramm einmal gegen das echte facepass auf dem Arbeitslaptop.
7. ~~MCP-Anmeldung~~ — auf Zuruf archiviert (`docs/archive/2026-10/2026-10-05_mcp-anmeldung.md`, ADR 024), Smoke offen; `v0.16.0` auf Zuruf gesetzt.
8. ~~Git-Werkzeuge~~ — umgesetzt und archiviert (`docs/archive/2026-10/2026-10-05_git-werkzeuge/`, ADR 025), Smoke offen, Release auf Zuruf (Minor-Version).
9. ~~Artefakte~~ — umgesetzt und archiviert (`docs/archive/2026-10/2026-10-05_artefakte/`, `v0.17.0`, ADR 026), Smoke offen.
10. ~~Session-Übergabe~~ — umgesetzt und archiviert (`docs/archive/2026-10/2026-10-05_session-uebergabe.md`, ADR 027, Migration 9), Smoke offen.

## Offen

- Smoke-Checklisten ohne Abnahme: „Git-Werkzeuge“ (README unter `docs/archive/2026-10/2026-10-05_git-werkzeuge/`, Wackelstellen 1–3 zuerst; Oberfläche bisher nur per Lint/Typecheck/Build geprüft, nie im Browser gesehen; noch ohne Release), „MCP-Anmeldung“ (im Plan unter `docs/archive/2026-10/2026-10-05_mcp-anmeldung.md`, Smoke 1 zuerst; Release `v0.16.0` auf Zuruf schon gesetzt), „Artefakte“ (README unter `docs/archive/2026-10/2026-10-05_artefakte/`, Wackelstelle 1 Sicherheitsprobe zuerst; Release `v0.17.0` auf Zuruf schon gesetzt), „Session-Übergabe“ (im Plan unter `docs/archive/2026-10/2026-10-05_session-uebergabe.md`, Smoke 1 und 2 zuerst; mit `v0.16.0` ausgeliefert), „Dateiverweise im Chat“ (im Plan unter `docs/archive/2026-10/2026-10-05_dateiverweise-im-chat.md`, Wackelstellen 1–3 zuerst; Release `v0.15.0` auf Zuruf schon gesetzt), „Claude-Konto“ (im Plan unter `docs/archive/2026-10/2026-10-05_claude-konto.md`, Wackelstellen 1–3 zuerst; Release `v0.14.0` auf Zuruf schon gesetzt), „Claude Code + LM Studio“ (README unter `docs/archive/2026-10/2026-10-01_claude-code-lokal/`, Wackelstellen 1–3 zuerst; zum Release freigegeben), „Changes-Review“ (README unter `docs/archive/2026-10/2026-10-01_changes-review/`, Wackelstellen 1–3 zuerst; zum Release freigegeben, Einzelergebnisse nicht protokolliert), „Innere Repositories“ (README unter `docs/archive/2026-10/2026-10-02_innere-repositories/`, Neuer-Commit-Fall zuerst; dazu die zwei facepass-Probe-Läufe auf dem Arbeitslaptop), „Sidebar nach letzter Aktivität“ (im Plan unter `docs/archive/2026-10/2026-10-02_sidebar-aktivitaet.md`, Neustart-Fall zuerst), „Session-Changes“ (README unter `docs/archive/2026-10/2026-10-01_session-changes/`), „MCP-Dialog“ (v0.8.0), „Sprachdiktat“ (v0.6.0, samt Messwerten), „Ordner ohne Git“ (v0.7.0) — Ergebnisse in die jeweilige Datei unter `docs/archive/2026-10/` nachtragen.
- **ADR-Nummern:** Changes-Review 015, Claude Code lokal 016 (vergeben), Autark 017, „Ordner ohne Git“ 018 (Sidebar hat 019 bekommen), Innere Repositories 020, Claude-Konto 021, Scratchpad im Workspace 022, Dateiverweise im Chat 023, MCP-Anmeldung 024, Git-Werkzeuge 025, Artefakte 026, Session-Übergabe 027.
