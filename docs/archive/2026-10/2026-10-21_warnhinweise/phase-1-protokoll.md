# Phase 1 — Protokoll

## Kontext

Lesen: [README.md](README.md) (Abschnitt „Belegt“, Kontrakt „Neue `AgentEvent`s“), [docs/knowledge/claude-stream-json.md](../../../knowledge/claude-stream-json.md), [artifacts/beispielzeilen.jsonl](artifacts/beispielzeilen.jsonl) (echte Zeilen vom 2026-10-21).

Code-Stellen:

- `src-tauri/src/agents/claude/protocol.rs` — eingehende Zeilen (`Incoming`, `SystemLine` mit `lenient`, `AssistantMessage`, `Usage`, `MessageLine`, `ResultLine`).
- `src-tauri/src/agents/claude/translate.rs` — `Translator::handle_line`, `handle_system`, `handle_assistant` (Zweig Hauptagent mit `ContextUsed`), `handle_user`, `turn_ended`, `target_of`.
- `src-tauri/src/agents/event.rs` — `AgentEvent`, `ModelId`.
- `src-tauri/src/sessions/registry.rs` — `apply_event` (muss jeden neuen Zweig abdecken), `end_turn`.
- `src-tauri/src/standalone/output.rs` — `compact_boundary()` des Agenten „Autark“ schickt die Zeile **ohne** `compact_metadata`; die Übersetzung muss das tragen.
- Lies die Fehlerklassen-Abschnitte: keine einschlägig (geprüft: `sprachen/typescript`, `frameworks/react`, `werkzeuge/claude-code`, `systeme/sqlite`; für Rust und Tauri gibt es keine Einträge).

## AK der Phase

1. `protocol.rs` liest ohne Fehler jede Zeile aus `artifacts/beispielzeilen.jsonl`; eine Zeile mit unerwartetem Typ in einem der neuen Felder macht nur dieses Feld leer, nie die ganze Zeile (alle neuen Felder `#[serde(default, deserialize_with = "lenient")]` bzw. `#[serde(default)]` für `bool`).
2. Die Übersetzung liefert für die Beispielzeilen: `CacheUsed` je `assistant`-Zeile des Hauptagenten mit Cache-Angaben, `RateLimit` je `rate_limit_event`, `Compacted` für `compact_boundary` (mit `trigger`, `pre_tokens`, `post_tokens`), danach `CompactSummary` für die eine synthetische `user`-Zeile, `TurnEnded` mit `total_cost_usd` und `denials`.
3. `system`/`compact_boundary` ohne `compact_metadata` ergibt `Compacted` mit drei `None`.
4. Die Messung „abgelehnte Aufrufe“ (Checkliste) ist gelaufen, ihr Ergebnis steht in `docs/knowledge/claude-stream-json.md`, und `PermissionDenialLine` passt dazu.
5. Die Registry kompiliert mit den neuen Ereignissen und verhält sich unverändert (neue Zweige tun noch nichts).

## Checkliste

- [x] **Messung abgelehnte Aufrufe** (vor dem Code): in einem leeren Ordner unter dem Scratchpad `claude.exe -p --input-format stream-json --output-format stream-json --verbose --model claude-haiku-5-5 --strict-mcp-config --permission-mode default` starten (ohne `--permission-prompt-tool`, dann lehnt die Kommandozeile jede Rechte-Abfrage selbst ab), Nachricht `{"type":"user","message":{"role":"user","content":"Lege mit dem Werkzeug Write die Datei probe.txt mit dem Inhalt hallo an."}}` schicken, die `result`-Zeile lesen. Erwartung: `permission_denials` mit einem Eintrag `{tool_name, tool_use_id, tool_input}`. Weicht die Form ab, `PermissionDenialLine` danach richten und die Abweichung nach [FINDINGS.md](FINDINGS.md). Die Zeile (ohne E-Mail-Adressen und ohne Inhalte aus dem Benutzerprofil) in `artifacts/beispielzeilen.jsonl` anhängen.
- [x] `protocol.rs`:
  - `Incoming`: neuer Zweig `#[serde(rename = "rate_limit_event")] RateLimitEvent(RateLimitLine)`.
  - `RateLimitLine { #[serde(default, deserialize_with = "lenient")] rate_limit_info: Option<RateLimitInfoLine> }`; `RateLimitInfoLine` mit `status: Option<String>`, `#[serde(rename = "rateLimitType")] rate_limit_type: Option<String>`, `#[serde(rename = "resetsAt")] resets_at: Option<i64>`, `#[serde(rename = "unifiedWindows")] unified_windows: Option<UnifiedWindows>` (alle `default` + `lenient`); `UnifiedWindows { five_hour: Option<WindowLine>, seven_day: Option<WindowLine> }`, `WindowLine { utilization: Option<f64> }`.
  - `SystemLine`: zusätzlich `compact_metadata: Option<CompactMetadata>`, `#[serde(rename = "permissionMode")] permission_mode: Option<String>`, `content: Option<String>`, `original_model: Option<String>`, `fallback_model: Option<String>`, `direction: Option<String>` — alle `#[serde(default, deserialize_with = "lenient")]`. `CompactMetadata { trigger: Option<String>, pre_tokens: Option<u32>, post_tokens: Option<u32> }` (Felder `#[serde(default)]`).
  - `AssistantMessage`: `#[serde(default)] id: Option<String>`.
  - `Usage`: `#[serde(default, deserialize_with = "lenient")] cache_creation: Option<CacheCreation>`; `CacheCreation { ephemeral_5m_input_tokens: Option<u64>, ephemeral_1h_input_tokens: Option<u64> }`.
  - `MessageLine`: `#[serde(rename = "isSynthetic", default)] is_synthetic: bool`.
  - `ResultLine`: `total_cost_usd: Option<f64>` und `#[serde(default, deserialize_with = "lenient")] permission_denials: Option<Vec<PermissionDenialLine>>`; `PermissionDenialLine { tool_name: Option<String>, tool_input: Option<Value> }` (Felder `default`).
- [x] `agents/event.rs`: die neuen Varianten aus dem Kontrakt (`CacheUsed`, `Compacted`, `CompactSummary`, `RateLimit`, `ModelFallback`, `Info`, `PermissionMode`), `RateLimitInfo` (Kontrakt), `TurnEnded` um `denials: Vec<Denial>` und `total_cost_usd: Option<f64>` erweitert.
- [x] Neues Modul `src-tauri/src/notices/` (`mod.rs` mit `pub mod model;`, in `lib.rs` eintragen) mit `model.rs`: `#[derive(Debug, Clone, Serialize, Deserialize, TS)] #[serde(rename_all = "camelCase")] pub struct Denial { pub tool: String, pub target: String }`. `Notice` kommt in Phase 4.
- [x] `translate.rs`:
  - `Translator` bekommt `awaiting_compact_summary: bool`.
  - `handle_line`: `Incoming::RateLimitEvent(line)` → `rate_limit(line)`: ohne `rate_limit_info` oder ohne `status` nichts; sonst `AgentEvent::RateLimit(RateLimitInfo { status, rate_limit_type, resets_at, five_hour: unified.five_hour?.utilization, seven_day: unified.seven_day?.utilization })`.
  - `handle_system`: `"compact_boundary"` → `self.awaiting_compact_summary = true;` und `Compacted` aus `compact_metadata` (fehlend → alles `None`). `"status"` → bei `permission_mode: Some(mode)` `PermissionMode(mode)`, sonst nichts. `"informational"` → bei nicht leerem, getrimmtem `content` `Info(content)`. `"model_refusal_fallback"` → nur wenn `original_model` und `fallback_model` gesetzt: `ModelFallback { original_model, fallback_model, direction: direction.unwrap_or_default(), text: content }`.
  - `handle_assistant`, Zweig Hauptagent: nach `ContextUsed` — wenn `cache_creation_input_tokens + cache_read_input_tokens > 0`: `CacheUsed { message_id: line.message.id.clone(), tokens: context_used(&usage), written_5m, written_1h }` (aus `usage.cache_creation`, fehlend 0, `u32::try_from(...).unwrap_or(u32::MAX)`). `line.message.id` vor dem Verbrauch von `line.message.content` sichern.
  - `handle_user`: ganz vorn — ist `self.awaiting_compact_summary`, `line.is_synthetic`, `parent_tool_use_id` leer und `content` ein `UserContent::Text(text)`: Flag zurücksetzen, `vec![AgentEvent::CompactSummary(text)]` zurückgeben. Sonst wie bisher.
  - `turn_ended`: `denials` aus `permission_denials` (fehlend = leer): je Eintrag `Denial { tool: tool_name.unwrap_or_default(), target: target_of(&tool, &tool_input.unwrap_or(Value::Object(Map::new()))) }`; `total_cost_usd` durchreichen.
- [x] `registry.rs` `apply_event`: neue Zweige ohne Wirkung (`AgentEvent::CacheUsed { .. } | AgentEvent::Compacted { .. } | … => {}` mit Kommentar „Warnhinweise, Phasen 2–6“); `TurnEnded` mit `..` destrukturieren, `end_turn` unverändert.
- [x] `docs/knowledge/claude-stream-json.md`: neuer Abschnitt „Cache, Kontingent, Zusammenfassung, Kosten“ mit den Messungen aus README „Belegt“ und der Messung oben; die Zeile `rate_limit_event` in der Tabelle „Ereignisse vom Agenten“ um die Felder ergänzen; `system`/`compact_boundary`, `informational`, `model_refusal_fallback` in die Tabelle (die beiden letzten mit „nur aus dem Code der VS-Code-Erweiterung“).
- [x] `docs/conventions/commits.md`: Scope `notices` in die Liste.
- [x] `pnpm check` grün; Commit `feat(notices): Cache-, Kontingent- und Hinweiszeilen der Kommandozeile lesen`.

## Report-Back

Status: complete (2026-10-21).

- Messung abgelehnte Aufrufe: Form wie erwartet (`tool_name`, `tool_use_id`, `tool_input`), Zeile in `artifacts/beispielzeilen.jsonl` angehängt (Pfad gekürzt, Antworttext entfernt). Zusätzlich gibt es `system`/`permission_denied` → FINDINGS Phase 6.
- AK 1–3 belegt mit einem Wegwerf-Beispielprogramm (nicht committet) über alle Beispielzeilen plus künstliche Zeilen mit falschen Feldtypen: jede Zeile lesbar, Ereignisse wie im AK; `compact_boundary` ohne bzw. mit kaputtem `compact_metadata` → `Compacted` mit drei `None`.
- Abweichungen vom Plan: `AssistantMessage.id` ist zusätzlich `lenient` (sonst machte eine `id` mit falschem Typ die ganze Zeile unlesbar — AK 1); `Incoming::System` trägt jetzt `Box<SystemLine>` (Clippy `large_enum_variant` nach den neuen Feldern).
- `Denial` steht noch nicht in `gen-bindings.rs` — erst `Notice` (Phase 4) bringt ihn über die Tauri-Grenze.
- `pnpm check` scheitert an `docs/planning/2026-10-21_mitgelieferte-befehle/artifacts/codex-probe.cjs` aus einem anderen, ungetrackten Plan (ESLint findet die Datei nicht im Projekt); alle Schritte der Kette einzeln mit Ausschluss dieses Ordners grün.
