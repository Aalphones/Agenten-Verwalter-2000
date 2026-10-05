# STATE

**Aktiver Plan:** (kein aktiver Plan) — Claude-Konto ist umgesetzt und archiviert, wartet auf Smoke-Abnahme und Release
**Phase:** —
**Nächster Schritt:** Smoke-Checkliste „Claude-Konto“ abnehmen lassen (Wackelstellen 1–3 zuerst; `v0.14.0` ist schon getaggt und gepusht); danach Plan 5 „Autark“.

## Reihenfolge der geparkten Pläne in `docs/planning/`

1. ~~MCP-Dialog~~ — erledigt und archiviert (`v0.8.0`).
1a. ~~Sidebar nach letzter Aktivität~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-02_sidebar-aktivitaet.md`), Migration 8 und ADR 019.
1b. ~~Innere Repositories~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-02_innere-repositories/`, `v0.11.0`, ADR 020). Changes-Review: dessen FINDINGS trägt den Hinweis auf `changes/sources.rs`.
2. ~~Session-Changes~~ — erledigt und archiviert (`v0.9.0`).
3. ~~Changes-Review~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-01_changes-review/`, `v0.12.0`, ADR 015).
4. ~~Claude Code + LM Studio~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-01_claude-code-lokal/`, `v0.13.0`, ADR 016).
4a. ~~Claude-Konto~~ — umgesetzt und archiviert (`docs/archive/2026-10/2026-10-05_claude-konto.md`, ADR 021); `v0.14.0`.
5. **Autark** (`autarker-agent`) — Plan 4 steht, größter Plan (9 Phasen, drei „heikel“).

## Offen

- Smoke-Checklisten ohne Abnahme: „Claude-Konto“ (im Plan unter `docs/archive/2026-10/2026-10-05_claude-konto.md`, Wackelstellen 1–3 zuerst; Release `v0.14.0` auf Zuruf schon gesetzt), „Claude Code + LM Studio“ (README unter `docs/archive/2026-10/2026-10-01_claude-code-lokal/`, Wackelstellen 1–3 zuerst; zum Release freigegeben), „Changes-Review“ (README unter `docs/archive/2026-10/2026-10-01_changes-review/`, Wackelstellen 1–3 zuerst; zum Release freigegeben, Einzelergebnisse nicht protokolliert), „Innere Repositories“ (README unter `docs/archive/2026-10/2026-10-02_innere-repositories/`, Neuer-Commit-Fall zuerst; dazu die zwei facepass-Probe-Läufe auf dem Arbeitslaptop), „Sidebar nach letzter Aktivität“ (im Plan unter `docs/archive/2026-10/2026-10-02_sidebar-aktivitaet.md`, Neustart-Fall zuerst), „Session-Changes“ (README unter `docs/archive/2026-10/2026-10-01_session-changes/`), „MCP-Dialog“ (v0.8.0), „Sprachdiktat“ (v0.6.0, samt Messwerten), „Ordner ohne Git“ (v0.7.0) — Ergebnisse in die jeweilige Datei unter `docs/archive/2026-10/` nachtragen.
- **ADR-Nummern:** Changes-Review 015, Claude Code lokal 016 (vergeben), Autark 017, „Ordner ohne Git“ 018 (Sidebar hat 019 bekommen), Innere Repositories 020, Claude-Konto 021.
- **Autark Phase 7:** Gleichzeitige Anfragen an LM Studio sind dort einstellbar (Obergrenze 2, bevorzugt 1) — nicht messen; die Zeitgrenze einer Anfrage muss die Wartezeit in LM Studios Schlange mittragen (README des Plans).
