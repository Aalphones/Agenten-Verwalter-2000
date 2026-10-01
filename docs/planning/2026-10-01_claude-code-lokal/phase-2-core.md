# Phase 2 — Core: Betriebsart, LM-Studio-Abfrage, Umgebung am Agenten, TL;DR, Kontingent, ADR 015

Ziel: Der Core kennt die Betriebsart „Claude Code + LM Studio“, fragt LM Studio nach Modellen und startet Agent und TL;DR-Aufruf in dieser Betriebsart mit der LM-Studio-Umgebung. Die Oberfläche ändert sich in dieser Phase nur so weit, wie die neuen Bindings es erzwingen.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ und „Kontrakt“ — verbindlich, hier nicht wiederholt.
- Ergebnisse aus Phase 1 in der README unter „Messungen“ und die Einträge in [FINDINGS.md](FINDINGS.md) mit `→ Phase 2`.
- `src-tauri/src/settings/model.rs`, `src-tauri/src/settings/mod.rs` (Muster: `stored_or`, `update` mit Transaktion), `src-tauri/src/db/mod.rs` (`enum_to_text`, `enum_from_text`).
- `src-tauri/src/agents/claude/process.rs` (`SpawnOptions`, `build_command`), `src-tauri/src/agents/claude/print.rs` (`PrintRequest`, `print_command`).
- `src-tauri/src/sessions/registry.rs`: `create_project`, `send`, `restart`, `start_process`, `SessionState` (`process_effort`, `new`, `restored`, `is_resting`).
- `src-tauri/src/sessions/registry/tldr.rs` (`ask_haiku`), `src-tauri/src/commands/usage.rs`, `src-tauri/src/commands/settings.rs`, `src-tauri/src/error.rs`, `src-tauri/src/lib.rs` (Module, `invoke_handler`), `src-tauri/examples/gen-bindings.rs`.
- `src-tauri/src/voice/model_file.rs` — Vorbild für `ureq`-Aufrufe.
- Konventionen: [rust.md](../../conventions/rust.md), [linting.md](../../conventions/linting.md), [commits.md](../../conventions/commits.md).
- Fehlerklassen: `ureq` macht aus jedem HTTP-Status ab 400 einen Fehler (Kommentar in `model_file.rs`) — ein unbekanntes Modell (404) landet also im `Err`-Zweig, nicht in einer leeren Antwort; die Fehlertexte unten unterscheiden deshalb nicht nach Status. Aus dem Vault (`werkzeuge/claude-code.md`): keine weitere einschlägig.

## AK der Phase

- `pnpm check` grün; `pnpm bindings` erzeugt `OperatingMode.ts`, `LocalModel.ts`, `LocalModelKind.ts`, `LocalModels.ts` und die geänderten `Settings.ts`, `SettingsChange.ts`, `CommandError.ts`.
- Mit `operating_mode = claudeCodeLocal` und `local_model = google/gemma-4-12b-qat` in der Tabelle `settings` (für den Test per `settings_update` aus den DevTools: `window.__TAURI__.core.invoke('settings_update', { change: { kind: 'operatingMode', value: 'claudeCodeLocal' } })`, analog `localModel`) startet eine ruhende Session bei der nächsten Nachricht `claude.exe` mit `--model google/gemma-4-12b-qat`, ohne `--effort`, mit der Umgebung aus dem Kontrakt — prüfbar im Server-Log von LM Studio (Anfrage kommt an) und im Session-Protokoll.
- LM Studio aus → `send` liefert `localModelUnavailable` mit dem Satz „LM Studio nicht erreichbar unter http://localhost:1234: …“.
- Betriebsart Claude: Start-Argumente unverändert gegenüber vorher (`--model claude-…`, `--effort …`), keine LM-Studio-Abfrage.
- `usage_refresh` startet in der lokalen Betriebsart keinen Hilfsprozess.

## Checkliste

### Einstellungen

- [ ] `settings/model.rs`: `OperatingMode` (derive wie `ColorScheme`), `Settings` um `operating_mode` und `local_model: Option<String>`, `SettingsChange` um `OperatingMode { value }` und `LocalModel { value: String }` — exakt wie im Kontrakt, mit den Doc-Kommentaren.
- [ ] `settings/mod.rs`: Schlüssel `KEY_OPERATING_MODE = "operating_mode"`, `KEY_LOCAL_MODEL = "local_model"`. `DEFAULT_SETTINGS` bekommt `operating_mode: OperatingMode::Claude`, `local_model: None`. In `load`: `operating_mode` per `stored_or`; `local_model` **nicht** per `stored_or`, sondern `stored.get(KEY_LOCAL_MODEL).map(|text| text.trim()).filter(|text| !text.is_empty()).map(str::to_owned)` (Klartext, kein serde). In `update`: `OperatingMode` per `enum_to_text`; `LocalModel` schreibt `value.trim()`; ist der getrimmte Wert leer → `Err(CommandError::Internal("Modellname leer".to_owned()))` vor der Transaktion.

### LM Studio

- [ ] Neues Modul `src-tauri/src/lmstudio/` mit `mod.rs` und `model.rs` (Typen exakt wie im Kontrakt), in `lib.rs` deklariert wie die übrigen Querschnitts-Module. Kopfkommentar `mod.rs`: „Fragt den lokalen Server von LM Studio nach Modellen (ADR 015). Nur lesend; geladen und entladen wird in LM Studio.“
- [ ] `mod.rs`: `pub const URL_VARIABLE: &str = "VERWALTER_LMSTUDIO_URL"`, `const DEFAULT_URL: &str = "http://localhost:1234"`, `const TIMEOUT: Duration = Duration::from_secs(3)`.
- [ ] `pub fn base_url() -> String`: Umgebungsvariable, getrimmt, `trim_end_matches('/')`, leer → `DEFAULT_URL`.
- [ ] Private `fn get(path: &str) -> Result<String, String>`: `ureq`-Agent mit Gesamt-Zeitlimit `TIMEOUT` (ureq 3: `ureq::Agent::config_builder().timeout_global(Some(TIMEOUT)).build().into()` — Signatur gegen docs.rs/ureq/3 prüfen), `GET {base_url}{path}`, Körper als String. Fehler → `error.to_string()`.
- [ ] Private `#[derive(Deserialize)] struct RawModel { id: String, #[serde(rename = "type")] kind: String, state: Option<String>, max_context_length: Option<u32>, loaded_context_length: Option<u32> }` und `struct RawList { data: Vec<RawModel> }`. `fn convert(raw: RawModel) -> Option<LocalModel>`: `kind` `"llm"` → `Llm`, `"vlm"` → `Vlm`, alles andere → `None`; `is_loaded = state == Some("loaded")`; `max_context_length` fehlt → `0`.
- [ ] `pub fn list() -> LocalModels`: `get("/api/v0/models")`, parsen, konvertieren, sortieren (geladene zuerst, dann `id` alphabetisch). Fehler (Verbindung oder unlesbar) → `LocalModels { base_url, models: vec![], error: Some(<Text>) }`.
- [ ] `pub fn find(id: &str) -> Result<LocalModel, String>`: `get(&format!("/api/v0/models/{id}"))` (die `/` in der Kennung bleiben, LM Studio erwartet sie so — belegt in der Probe), parsen, `convert`; `None` → `Err("kein Sprachmodell")`.

### Modell-Backend am Agenten

- [ ] `src-tauri/src/agents/claude/local.rs` (in `agents/claude/mod.rs` als `pub mod local;`), Kopfkommentar: „Betriebsart Claude Code + LM Studio: dieselbe Kommandozeile, Modellanfragen an LM Studio (ADR 015).“ `LocalBackend`, `resolve`, `apply` exakt wie im Kontrakt.
- [ ] `resolve`, Betriebsart `ClaudeCodeLocal`, Fehlertexte wörtlich:
  - kein `local_model` → `LocalModelUnavailable("Kein lokales Modell gewählt — wähle eins in den Einstellungen unter „Lokales Modell“.")`
  - `lmstudio::find` scheitert → `LocalModelUnavailable(format!("LM Studio nicht erreichbar unter {base_url}: {fehler}"))`
  - nicht geladen → `LocalModelUnavailable(format!("Das Modell „{model}“ ist in LM Studio nicht geladen — lade es dort und sende erneut."))`
  - sonst `Ok(Some(LocalBackend { base_url, model, context_window: loaded_context_length.unwrap_or(max_context_length) }))`.
- [ ] `error.rs`: Variante `LocalModelUnavailable(String)` mit `#[error("{0}")]`, hinter `VoiceDownload`.
- [ ] `process.rs`: `SpawnOptions` um `pub local: Option<LocalBackend>` (Doc: „`Some` in der Betriebsart Claude Code + LM Studio“). In `build_command`: `--model` bekommt `local.model` statt `model.cli_id()`; `--effort` samt Wert nur ohne `local`; nach der Zeile mit `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` `if let Some(backend) = &opts.local { local::apply(&mut command, backend); }`.
- [ ] `print.rs`: `PrintRequest` um `pub local: Option<&'a LocalBackend>`; `print_command` wählt `--model` wie oben und ruft `local::apply`.

### Registry

- [ ] `SessionState` um `process_backend: Option<LocalBackend>` direkt hinter `process_effort` (Doc: „Modell-Backend, mit dem der laufende Prozess gestartet wurde; `None` = Claude.“), in `new` und `restored` mit `None`.
- [ ] `SessionRegistry` um `fn agent_backend(&self) -> Result<Option<LocalBackend>, CommandError>`: `local::resolve(&settings::load(&self.database)?)`. Doc: „Fragt in der lokalen Betriebsart LM Studio — nie unter einer Session- oder Vorhaben-Sperre aufrufen.“
- [ ] `start_process` bekommt den Parameter `backend: Option<&LocalBackend>` (letzter Parameter). `SpawnOptions.local = backend.cloned()`. Nach erfolgreichem `spawn`: `state.process_backend = backend.cloned();` und `state.context_window = backend.map_or(state.model.initial_context_window(), |b| b.context_window); outbox.summary_dirty = true;`.
- [ ] `create_project`: direkt nach der Zeile mit `find_claude()` `let backend = self.agent_backend()?;` — vor dem Anlegen des Workspace, damit ein Fehler nichts zurücklässt; an `start_process(…, backend.as_ref())`.
- [ ] `send`: direkt nach `let session = self.get(session_id)?;` `let backend_result: Result<Option<LocalBackend>, String> = self.agent_backend().map_err(|error| error.to_string());`. In `update` erst **nach** dem Zweig für offene Rückfragen auswerten: `let backend = backend_result.clone().map_err(CommandError::LocalModelUnavailable)?;` — so lässt sich eine offene Rückfrage auch beantworten, wenn LM Studio gerade aus ist. Bedingung für `start_process` um `|| (state.process_backend != backend && state.is_resting())` erweitern (ein arbeitender Agent wird nie unterbrochen — Kommentar im Code an der Stelle ergänzen: „Ein Wechsel der Betriebsart wirkt wie ein neues Repository erst, wenn der Agent ruht.“). Aufruf mit `backend.as_ref()`.
- [ ] `restart`: vor `update` `let backend = self.agent_backend()?;`, Aufruf mit `backend.as_ref()`.

### TL;DR

- [ ] `sessions/registry/tldr.rs`, `ask_haiku`: vor dem Bau des `PrintRequest` `let database = app.state::<Arc<Database>>(); let settings = settings::load(&database).map_err(|e| e.to_string())?; let backend = local::resolve(&settings).map_err(|e| e.to_string())?;`.
  - **Variante A** (M4 hat `structured_output` geliefert): `PrintRequest { local: backend.as_ref(), … }`.
  - **Variante B** (M4 gescheitert): `if backend.is_some() { return Err("TL;DR ist in der Betriebsart „Claude Code + LM Studio“ nicht verfügbar.".to_owned()); }` und `local: None`.
  - Welche Variante: der FINDINGS-Eintrag aus Phase 1.

### Kontingent

- [ ] `commands/usage.rs`, `usage_refresh`: Parameter `database: tauri::State<'_, Arc<Database>>`; vor `service.refresh` `if settings::load(&database)?.operating_mode != OperatingMode::Claude { return Ok(()); }`. Doc-Kommentar ergänzen: „In einer lokalen Betriebsart fragt der Verwalter Anthropic nicht (ADR 015).“

### Command und Bindings

- [ ] `commands/settings.rs`: `#[tauri::command] pub async fn settings_local_models() -> Result<LocalModels, CommandError> { Ok(lmstudio::list()) }`; in `lib.rs` registrieren.
- [ ] `src/lib/settings.ts`: `loadLocalModels(): Promise<LocalModels>` mit Doc „Modelle aus LM Studio; ein nicht erreichbarer Server steht in `error`, kein Throw.“
- [ ] `gen-bindings.rs`: `OperatingMode`, `LocalModel`, `LocalModelKind`, `LocalModels` eintragen; `pnpm bindings`. Bricht TypeScript an Stellen, die `Settings`-Objekte bauen, dort die zwei Felder mit `operatingMode: 'claude'`, `localModel: null` ergänzen — keine weiteren Oberflächen-Änderungen in dieser Phase.

### Doku

- [ ] `docs/decisions/015-betriebsarten-und-lokales-modell.md` aus „Festgelegte Entscheidungen“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). Konsequenzen enthalten: die Messwerte aus Phase 1 in je einem Satz (verbleibende Verbindungen aus M1b mit Adresse/Name, `contextWindow` aus M2, Tempo aus M3, TL;DR-Variante, Ergebnis M5); „Keine Garantie, dass nichts an Anthropic geht“; „Sidebar und Session-Karten zeigen im lokalen Betrieb das gespeicherte Claude-Modell“.
- [ ] ADR 003, „Konsequenzen“: Zeile „Betriebsart Claude Code + LM Studio: dieselbe Kommandozeile mit anderer Umgebung — [ADR 015](015-betriebsarten-und-lokales-modell.md).“ ADR 008, „Konsequenzen“: „In einer lokalen Betriebsart keine Kontingent-Abfrage ([ADR 015](015-betriebsarten-und-lokales-modell.md)).“
- [ ] `docs/code-map.md`: neue Zeile „Betriebsart und lokales Modell (LM Studio)“ — Oberfläche „folgt in Phase 3“, Core: `src-tauri/src/lmstudio/` (`model.rs`, `mod.rs` `list`/`find`/`base_url`), `src-tauri/src/agents/claude/local.rs` (`LocalBackend`, `resolve`, `apply`), `process_backend` und `agent_backend` in `src-tauri/src/sessions/registry.rs`, `settings_local_models` in `src-tauri/src/commands/settings.rs` ([ADR 015](decisions/015-betriebsarten-und-lokales-modell.md)). In der Querschnitts-Aufzählung unter „Features:“ `lmstudio` ergänzen. Stand-Satz oben aktualisieren.
- [ ] `AGENTS.md`, Tabelle „Befehle“: Zeile `VERWALTER_LMSTUDIO_URL` (Umgebungsvariable) — „Adresse des lokalen Servers von LM Studio für die Betriebsart „Claude Code + LM Studio“ (Standard `http://localhost:1234`)“.
- [ ] Commit `feat(agents): Betriebsart Claude Code mit lokalem Modell über LM Studio`.

## Report-Back
