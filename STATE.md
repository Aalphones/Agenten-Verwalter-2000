# STATE

**Aktiver Plan:** (kein aktiver Plan)
**Phase:** —
**Nächster Schritt:** Plan „Sprachdiktat“ ist archiviert (`docs/archive/2026-10/`) und als v0.6.0 getaggt. Offen: Smoke-Checkliste des Plans samt Messwerten (Erkennungsdauer, Arbeitsspeicher) — Ergebnisse in die README des archivierten Plans nachtragen. Danach den ersten Plan der Reihenfolge unten starten.

## Reihenfolge der geparkten Pläne in `docs/planning/`

1. **MCP-Dialog** — klein und unabhängig; Autark Phase 8 beantwortet dessen Steueranfragen, und Abnahmekriterium 13 von Autark setzt den Dialog voraus.
2. **Session-Changes** — muss vor Changes-Review kommen (ändert die Signaturen von `changes_load`/`changes_file_diff`).
3. **Changes-Review** — baut auf dem Diff auf, der nur noch die Änderungen der Session zeigt.
4. **Claude Code + LM Studio** (`claude-code-lokal`) — Voraussetzung für Autark, sonst unabhängig. Drückt das Kontingent, vorziehen auf Platz 1.
5. **Autark** (`autarker-agent`) — setzt Plan 4 voraus, größter Plan (9 Phasen, drei „heikel“).

## Offen vor dem Start

- 🔴 **ADR-Nummern kollidieren:** Session-Changes und Claude Code lokal beanspruchen beide ADR 015. Nach obiger Reihenfolge müssten es sein: MCP 013, Session-Changes 014, Changes-Review 015, lokal 016, Autark 017. README, FINDINGS und Phasen-Dateien der betroffenen Pläne sind noch nicht angepasst — Freigabe von Sascha steht aus.
- 🟡 **Autark Phase 7:** Ob LM Studio mehrere Anfragen gleichzeitig rechnet, ist ungeprüft; es entscheidet, ob parallele Subagenten etwas bringen. Vor Plan 5 messen.
