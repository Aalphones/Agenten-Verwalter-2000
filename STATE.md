# STATE

**Aktiver Plan:** (kein aktiver Plan) — MCP-Dialog ist archiviert (`docs/archive/2026-10/2026-10-01_mcp-dialog/`) und als `v0.8.0` getaggt.
**Nächster Schritt:** Nächster Plan der Reihenfolge unten: Session-Changes (liegt geparkt in `docs/planning/`, `/implement`). Offen aus früheren Plänen: Smoke-Checkliste „MCP-Dialog“ (v0.8.0, ohne Abnahme getaggt), Smoke-Checkliste „Sprachdiktat“ (v0.6.0) samt Messwerten (Erkennungsdauer, Arbeitsspeicher) und die Smoke-Checkliste „Ordner ohne Git“ (v0.7.0, ohne Abnahme getaggt) — Ergebnisse in die jeweilige README unter `docs/archive/2026-10/` nachtragen.

## Reihenfolge der geparkten Pläne in `docs/planning/`

1. ~~MCP-Dialog~~ — erledigt und archiviert; Autark Phase 8 beantwortet dessen Steueranfragen, und Abnahmekriterium 13 von Autark setzt den Dialog voraus.
2. **Session-Changes** — muss vor Changes-Review kommen (ändert die Signaturen von `changes_load`/`changes_file_diff`).
3. **Changes-Review** — baut auf dem Diff auf, der nur noch die Änderungen der Session zeigt.
4. **Claude Code + LM Studio** (`claude-code-lokal`) — Voraussetzung für Autark, sonst unabhängig. Drückt das Kontingent, vorziehen auf Platz 1.
5. **Autark** (`autarker-agent`) — setzt Plan 4 voraus, größter Plan (9 Phasen, drei „heikel“).

## Offen vor dem Start

- **ADR-Nummern** sind auf die Reihenfolge abgestimmt: MCP-Dialog 013 (geschrieben), Session-Changes 014, Changes-Review 015, Claude Code lokal 016, Autark 017. Ändert sich die Reihenfolge, müssen die Nummern in den Plänen mitziehen. Ausnahme: „Ordner ohne Git“ nimmt 018, obwohl er zuerst kommt.
- 🟡 **Session-Changes nach „Ordner ohne Git“:** `SessionChanges` hat dann zusätzlich `plain_folders`, und `RepositoryCheckout::Folder` darf nie an `git` gehen. Phase 1/2 dieses Plans (Commit-Suche, `load`-Signatur, Rückgabe `SessionChanges { … }`) müssen Ordner ohne Git überspringen und `plain_folders` weiterreichen — beim Start des Plans nachschärfen.
- 🟡 **Autark Phase 7:** Ob LM Studio mehrere Anfragen gleichzeitig rechnet, ist ungeprüft; es entscheidet, ob parallele Subagenten etwas bringen. Vor Plan 5 messen.
