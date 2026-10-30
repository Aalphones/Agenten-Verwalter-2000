# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` (oder `→ Plan Umsetzung`, `→ Follow-up`). Erledigt: `- [x]` plus Verweis auf Commit.

- [ ] → Phase 2: `artifact_list` setzt `kind` noch über die Konstante `KIND_HTML` in `src-tauri/src/artifacts/tools.rs` (Text und `structuredContent`); mit `ArtifactKind` dort ersetzen.
- [ ] → Phase 6: `artifacts_prompt` (`agents/claude/process.rs`) erwähnt die Werkzeuge `mcp__verwalter__artifact_list`/`artifact_show` noch nicht.
- [ ] → Plan Umsetzung: Codex hat keinen MCP-Zugang (ADR 046, bekannte Lücke) — auf dem Entwicklungsrechner keine `codex.exe`, Protokoll von `codex app-server` (`thread/start` → `config`) ungeprüft. Werkzeuge des Plans „Umsetzung“ fehlen in Codex, bis das geprüft ist.
- [ ] → Plan Umsetzung: Der autarke Agent kennt `--allowedTools mcp__verwalter` nicht als Freigabe (er wertet die Regeln nur als Pfade, `standalone/paths.rs`); ob er MCP-Werkzeuge ohne Rückfrage ausführt, entscheidet seine eigene Rechte-Logik — bei Werkzeugen, die schreiben, dort prüfen.
- [x] → Kontrakt (README nachgezogen): Nebenfragen bekommen dieselbe `--mcp-config` wie der Hauptprozess statt keiner — sonst weicht ihre Werkzeugliste ab und jede Nebenfrage zahlt den ganzen Verlauf ohne Cache (ADR 044).
