# Phase 4 — Modelle, Modellwechsel, Denkaufwand, Kontext

## Kontext

Lesen: [README.md](README.md) (Entscheidungen „Modell je Session“, „Denkaufwand“, „Kontext“; Kontrakt „Typen über die Tauri-Grenze“), [ADR 002](../../decisions/002-typgenerierung-und-listen.md), [ADR 008](../../decisions/008-kontext-und-kontingent.md), [ADR 016](../../decisions/016-betriebsarten-und-lokales-modell.md).

Code-Stellen:

- `src-tauri/src/agents/event.rs` (`ModelId`, `Effort`), `sessions/registry.rs` (`set_model`, `set_effort`, `SessionState.model`, `context_window`), `src-tauri/src/sessions/model.rs` (`SessionSummary`), `db/sessions.rs`, `db/migrations.rs` + `db/migrations/` (letzte ist Migration 10), `settings/model.rs` (`Settings`, `SettingsChange`), `settings/mod.rs`.
- `src-tauri/src/agents/claude/stats.rs` — Form der Antwort auf `get_context_usage`, die der Verwalter liest.
- `src-tauri/src/lmstudio/` und `src/features/settings/useLocalModels.ts` — Muster für eine Modellliste aus dem Core.
- Oberfläche: `src/components/ModelMenu.tsx`, `src/components/ModeMenu.tsx` (`showEffort`), `src/features/chat/Composer.tsx`, `src/features/sessions/NewSession.tsx`, `src/features/settings/SettingsView.tsx`, `src/app/SessionHeader.tsx`, `src/lib/labels.ts`, `src/lib/sessions.ts`.

Fehlerklassen geprüft: keine einschlägig.

## AK der Phase

1. Command `codex_models` liefert die Modelle aus `model/list` (ohne `hidden`), zwischengespeichert 10 Minuten; Fehler → Satz, den die Menüs anzeigen.
2. In „Codex“ zeigt die Eingabeleiste das Codex-Modell der Session (leer → Standardmodell mit Zusatz „Standard“); das Menü listet die Codex-Modelle; Auswahl speichert `sessions.codex_model` und schickt `set_model` an einen laufenden Übersetzer — ohne Neustart.
3. „Neues Vorhaben“ und Einstellungen → „Standardmodell“ zeigen in „Codex“ die Codex-Modelle und speichern `default_codex_model`; eine neue Session übernimmt ihn.
4. Das Denkaufwand-Menü zeigt in „Codex“ nur die Werte des gewählten Modells, die es im Verwalter gibt; Wechsel schickt `set_effort` an einen laufenden Übersetzer.
5. Der Kontext-Donut zeigt in „Codex“ belegte Token und Fenster aus `thread/tokenUsage/updated`; das Kontext-Fenster öffnet ohne Fehler mit der Kategorie „Verlauf“.
6. Das Claude-Modell einer Session bleibt in „Codex“ gespeichert und gilt nach dem Zurückschalten.

## Checkliste

**Core**

- [ ] Migration 11: `ALTER TABLE sessions ADD COLUMN codex_model TEXT` (NULL erlaubt). Laden/Speichern in `db/sessions.rs`; `SessionState.codex_model: Option<String>`; `SessionSummary.codex_model`.
- [ ] `settings`: `default_codex_model: Option<String>` mit Standard `None`, `SettingsChange::DefaultCodexModel(Option<String>)`; `create_project`/`create_in_project` übernehmen ihn in die neue Session.
- [ ] `codex/models.rs` + `src-tauri/src/commands/codex.rs`: `codex_models()` startet `codex app-server` über den Hilfsweg aus Phase 5 (bis dahin: eigener kurzer Start mit `rpc.rs`: `initialize`, `model/list`, beenden); Ergebnis `Vec<CodexModel>`; Zwischenspeicher in einem `CodexService` (State im Tauri-Setup, Muster `UsageService`). `efforts` = `supportedReasoningEfforts` geschnitten mit den `Effort`-Werten, `default_effort` aus `defaultReasoningEffort` (unbekannt → `Medium`).
- [ ] `session_set_codex_model(session_id, model)` in `commands/sessions.rs` → Registry: speichern, `summary_dirty`, `send_control(set_model {model: <id oder leer>})`.
- [ ] `set_effort` in der Registry: in „Codex“ zusätzlich `send_control({"subtype":"set_effort","effort":<cli_value>})` (Betriebsart über `settings::load` vor der Sperre lesen; in den anderen Betriebsarten unverändert kein Steuerbefehl).
- [ ] `build_command`: in „Codex“ `--model <codex_model>` (leer → Option weglassen) statt `cli_id()`; `--effort` wie bisher. `SpawnOptions` dafür um `codex_model: Option<String>` ergänzen.
- [ ] Übersetzer: `set_model`/`set_effort` merken, beim nächsten `turn/start` als `model`/`effort` senden; nicht angebotener Effort → `defaultReasoningEffort` des Modells (Liste beim Start einmal mit `model/list` holen). Die `init`-Zeile meldet das tatsächliche Modell.
- [ ] Übersetzer: `thread/tokenUsage/updated` merken; `assistant`-Zeile bekommt `usage.input_tokens` = `last.inputTokens`, `output_tokens` = `last.outputTokens`; `result` bekommt `modelUsage {<model>: {contextWindow: modelContextWindow}}`; `get_context_usage` beantworten in der Form, die `agents/claude/stats.rs` liest (Felder dort nachsehen, eine Kategorie „Verlauf“ mit der belegten Zahl).
- [ ] `pnpm bindings`.

**Oberfläche**

- [ ] `src/features/codex/useCodexModels.ts` (Muster `useLocalModels`) und Wrapper `src/lib/codex.ts`.
- [ ] `ModelMenu` bekommt einen zweiten Datenweg: Prop `options: readonly {id: string; label: string; hint?: string}[]` + `value: string` (generisch) — bestehende Claude-Aufrufer übergeben die Claude-Liste aus `labels.ts`; in „Codex“ übergeben Composer, NewSession und SettingsView die Codex-Liste. Kein zweites Menü-Bauteil.
- [ ] `ModeMenu` bekommt `efforts?: readonly Effort[]` (fehlt → alle); in „Codex“ die `efforts` des gewählten Modells.
- [ ] `SessionHeader`: Modell-Anzeige (falls dort gezeigt) in „Codex“ = Codex-Modell.
- [ ] `docs/code-map.md`: Zeile „Codex“ um Modelle/Kontext; Persistenz-Zeile um Migration 11.
- [ ] ADR 031: Abschnitt Modelle/Kontext.

## Report-Back
