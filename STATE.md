# STATE

**Aktiver Plan:** `docs/planning/2026-10-01_changes-review/`
**Phase:** 2/4 — Core: Typ `ReviewComment`, `chat_send` mit Kommentaren (pending)
**Nächster Schritt:** Phase 2 umsetzen (`phase-2-core.md`; FINDINGS → Phase 2 zuerst lesen), committen, dann Pflicht-Clear.

## Reihenfolge der geparkten Pläne in `docs/planning/`

1. ~~MCP-Dialog~~ — erledigt und archiviert (`v0.8.0`).
1a. ~~Sidebar nach letzter Aktivität~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-02_sidebar-aktivitaet.md`), Migration 8 und ADR 019.
1b. ~~Innere Repositories~~ — erledigt und archiviert (`docs/archive/2026-10/2026-10-02_innere-repositories/`, `v0.11.0`, ADR 020). Changes-Review: dessen FINDINGS trägt den Hinweis auf `changes/sources.rs`.
2. ~~Session-Changes~~ — erledigt und archiviert (`v0.9.0`).
3. **Changes-Review** — läuft (siehe oben).
4. **Claude Code + LM Studio** (`claude-code-lokal`) — Voraussetzung für Autark, sonst unabhängig. Drückt das Kontingent, vorziehen.
5. **Autark** (`autarker-agent`) — setzt Plan 4 voraus, größter Plan (9 Phasen, drei „heikel“).

## Offen

- Smoke-Checklisten ohne Abnahme: „Innere Repositories“ (README unter `docs/archive/2026-10/2026-10-02_innere-repositories/`, Neuer-Commit-Fall zuerst; dazu die zwei facepass-Probe-Läufe auf dem Arbeitslaptop), „Sidebar nach letzter Aktivität“ (im Plan unter `docs/archive/2026-10/2026-10-02_sidebar-aktivitaet.md`, Neustart-Fall zuerst), „Session-Changes“ (README unter `docs/archive/2026-10/2026-10-01_session-changes/`), „MCP-Dialog“ (v0.8.0), „Sprachdiktat“ (v0.6.0, samt Messwerten), „Ordner ohne Git“ (v0.7.0) — Ergebnisse in die jeweilige Datei unter `docs/archive/2026-10/` nachtragen.
- **ADR-Nummern:** Changes-Review 015, Claude Code lokal 016, Autark 017, „Ordner ohne Git“ 018 (Sidebar hat 019 bekommen), Innere Repositories 020.
- 🟡 **Autark Phase 7:** Ob LM Studio mehrere Anfragen gleichzeitig rechnet, ist ungeprüft. Vor Plan 5 messen.
