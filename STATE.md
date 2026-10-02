# STATE

**Aktiver Plan:** (kein aktiver Plan)
**Phase:** —
**Nächster Schritt:** Nächsten Plan wählen: laut Reihenfolge unten „Sidebar nach letzter Aktivität“ (`docs/planning/2026-10-02_sidebar-aktivitaet.md`), danach „Changes-Review“.

## Reihenfolge der geparkten Pläne in `docs/planning/`

1. ~~MCP-Dialog~~ — erledigt und archiviert (`v0.8.0`).
1a. **Sidebar nach letzter Aktivität** (`2026-10-02_sidebar-aktivitaet.md`) — klein, zwei Phasen; nimmt Migration 8 (`008_session_activity.sql`) und ADR 019.
2. ~~Session-Changes~~ — erledigt und archiviert (`v0.9.0`).
3. **Changes-Review** — baut auf dem Diff auf, der nur noch die Änderungen der Session zeigt.
4. **Claude Code + LM Studio** (`claude-code-lokal`) — Voraussetzung für Autark, sonst unabhängig. Drückt das Kontingent, vorziehen.
5. **Autark** (`autarker-agent`) — setzt Plan 4 voraus, größter Plan (9 Phasen, drei „heikel“).

## Offen

- Smoke-Checklisten ohne Abnahme: „Session-Changes“ (README unter `docs/archive/2026-10/2026-10-01_session-changes/`), „MCP-Dialog“ (v0.8.0), „Sprachdiktat“ (v0.6.0, samt Messwerten), „Ordner ohne Git“ (v0.7.0) — Ergebnisse in die jeweilige README unter `docs/archive/2026-10/` nachtragen.
- **ADR-Nummern:** Changes-Review 015, Claude Code lokal 016, Autark 017, „Ordner ohne Git“ 018, Sidebar 019.
- 🟡 **Autark Phase 7:** Ob LM Studio mehrere Anfragen gleichzeitig rechnet, ist ungeprüft. Vor Plan 5 messen.
