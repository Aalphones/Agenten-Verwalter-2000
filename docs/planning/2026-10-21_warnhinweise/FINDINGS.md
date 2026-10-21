# Findings

Erkenntnisse während der Umsetzung, getaggt mit der Phase, die sie betreffen. Format:

- [ ] → Phase N: <Erkenntnis> (Fundstelle)

- [ ] → Phase 6: Die Messung „abgelehnte Aufrufe“ zeigt die Form wie erwartet (`tool_name`, `tool_use_id`, `tool_input`), belegt aber nur die Ablehnung durch die Kommandozeile selbst (kein `--permission-prompt-tool`). Ob ein über `can_use_tool` mit `deny` beantworteter Aufruf auch in `permission_denials` landet, ist offen — Smoke 8 prüft genau diesen Weg; fehlt die Zeile dort, kommt die Ablehnung aus dem eigenen `deny` des Verwalters und müsste dort mitgezählt werden. (`docs/knowledge/claude-stream-json.md`, „Abgelehnte Aufrufe“)
- [ ] → Phase 6: Zusätzlich zu `permission_denials` schickt die Kommandozeile sofort eine Zeile `system`/`permission_denied` (`tool_name`, `tool_use_id`, `message`). Phase 1 liest sie nicht; sie wäre eine Alternative, falls die Liste in `result` sich als lückenhaft erweist.
- [ ] → Phase 3: `SessionSummary.prompt_cache` bleibt nach einem Wechsel der Betriebsart (Claude → Codex/LM Studio/Autark) in der Session stehen — der Core löscht ihn nicht. Die Oberfläche muss Pille, Hinweis und Modell-Menü-Warnung zusätzlich an die Betriebsart binden (AK 8), nicht nur an `prompt_cache != null`. (`src-tauri/src/sessions/registry.rs`, `restored`/`note_prompt_cache`)
- [x] → Phase 2: `AgentEvent::Compacted` kommt auch vom Agenten „Autark“ (ohne Metadaten; Codex kennt die Zeile nicht, `src-tauri/src/codex/` ohne Treffer für „compact“) — `prompt_cache.compacted_at` nur setzen, wenn ein `prompt_cache` existiert (den gibt es nur bei `is_claude_process()`).
- [ ] → Phase 4: Der ungetrackte Plan `docs/planning/2026-10-21_mitgelieferte-befehle/` (anderer Plan, nicht committet) hat eine Phase „autark-compact“ — wer den Eintrag `Compacted` baut, prüft vorher, ob jener Plan schon umgesetzt ist und `compact_boundary` des Agenten „Autark“ inzwischen Metadaten trägt.
