# Phase 8 — MCP-Server

Ziel: Der Agent verbindet sich mit den MCP-Servern des Benutzers, die ohne Anthropic erreichbar sind (lokale stdio-Server wie `comfy`, direkt eingetragene HTTP-Server), bietet ihre Werkzeuge dem Modell als `mcp__<server>__<werkzeug>` an und beantwortet die Steueranfragen, mit denen der Plan „MCP-Dialog“ Server anzeigt, neu verbindet und ausschaltet.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ (MCP, Rechte, Hooks), „Kontrakt“ (`mcp_status`, `mcp_reconnect`, `mcp_toggle`).
- Format, das der Verwalter von `mcp_status` erwartet, und das gemessene Verhalten der Claude-Kommandozeile: [docs/planning/2026-10-01_mcp-dialog/README.md](../2026-10-01_mcp-dialog/README.md), Abschnitt „Messungen“ (Felder `name`, `status` mit `connected`/`pending`/`failed`/`disabled`, `scope`, `config` mit `type`/`command`/`args` bzw. `url`, `tools[].name`, `error`; Ausschalten gilt pro Arbeitsordner und bleibt gespeichert).
- Wo Claude Code die Server-Konfiguration ablegt — **beim Umsetzen gegen https://code.claude.com/docs/en/mcp prüfen**, die Annahme hier: Benutzerbereich `mcpServers` oben in `%USERPROFILE%\.claude.json`; lokaler Bereich `projects["<Projektpfad>"].mcpServers` in derselben Datei; Projektbereich `mcpServers` in `.mcp.json` im Projektordner, nur wirksam, wenn in den Einstellungen `enableAllProjectMcpServers: true` steht oder der Name in `enabledMcpjsonServers` vorkommt. Server-Eintrag stdio: `command`, `args`, `env`, optional `type: "stdio"`; HTTP: `type: "http"`, `url`, `headers`; `type: "sse"` ist der alte Transport. `${VAR}` und `${VAR:-vorgabe}` in Werten werden aus der Umgebung ersetzt.
- MCP-Protokoll (JSON-RPC 2.0, `initialize` → `notifications/initialized` → `tools/list` → `tools/call`, Streamable HTTP mit `Mcp-Session-Id`): https://modelcontextprotocol.io/specification — Protokollversion beim Umsetzen dort ablesen und als Konstante setzen.
- Phase 3/6/7: `permissions.rs`, `hooks.rs`, `tools/mod.rs` (`definitions`, `run`), `turn.rs`, `processes::hide_console`.
- 🔴 `%USERPROFILE%\.claude.json` enthält Zugangsdaten (Umgebungswerte und Header der Server). Der Code liest sie, **gibt sie aber nie aus** — weder auf stderr noch in `mcp_status` (`config` dort nur mit `type`, `command`, `args`, `url`). Beim Testen die Datei nicht ausgeben, nur gezielt Schlüssel-Namen prüfen.
- Fehlerklassen: Vault `werkzeuge/claude-code.md` — „Ein MCP-Werkzeug deckelt die Seitengröße stiller als das angeforderte Limit“: `tools/list` über `nextCursor` bis zum Ende lesen, nicht nach der ersten Seite aufhören.

## AK der Phase

- Mit dem eingetragenen Server `comfy`: „Welche Werkzeuge hat der MCP-Server comfy?“ → Antwort nennt Werkzeuge; „Ruf server_info von comfy auf“ → Werkzeug-Gruppe `mcp__comfy__server_info` im Chat mit Ergebnis.
- Modus „Manuell“: ein MCP-Werkzeug fragt nach; ein Hook mit Matcher `mcp__comfy__.*` und Exit 2 blockiert es.
- Ein absichtlich kaputter Server (`claude mcp add kaputt -s user -- gibt-es-nicht-xyz`, nach dem Test wieder entfernen) stört die anderen nicht; `mcp_status` meldet ihn `failed` mit Fehlertext.
- Ist der Plan „MCP-Dialog“ gebaut: der Dialog zeigt in „Autark“ die Server dieses Agenten, „Neu verbinden“ und der Schalter wirken; ausgeschaltet bleibt ein Server für neue Sessions desselben Vorhabens. Ist er nicht gebaut: dieselben drei Steueranfragen von Hand (Zeilen aus dem Kontrakt) liefern die erwarteten Antworten.
- Die claude.ai-Connectoren tauchen nirgends auf.
- Weder stderr noch `mcp_status` enthalten Werte aus `env` oder `headers`.
- `pnpm check` grün.

## Checkliste

### Konfiguration `standalone/mcp/config.rs`

- [ ] `pub enum Transport { Stdio { command: String, args: Vec<String>, env: Vec<(String, String)> }, Http { url: String, headers: Vec<(String, String)> }, Unsupported(String) }`, `pub struct ServerConfig { pub name: String, pub scope: &'static str /* "user" | "local" | "project" */, pub transport: Transport }`.
- [ ] `pub fn load(home: &Path, cwd: &Path, add_dirs: &[PathBuf], settings_files: &[PathBuf]) -> Vec<ServerConfig>` nach der Annahme im Kontext: Benutzerbereich, Projektbereich (je `cwd`/`add_dir` `.mcp.json`, Freigabe aus den Einstellungsdateien), lokaler Bereich (Schlüssel in `projects`, der `cwd` entspricht — Vergleich ohne Groß-/Kleinschreibung, `/` und `\` gleich). Gleicher Name: lokal vor Projekt vor Benutzer. `type: "sse"` → `Unsupported("SSE-Transport wird nicht unterstützt.")`. Ersetzung `${VAR}`/`${VAR:-vorgabe}` in `command`, `args`, `env`, `url`, `headers`. Unlesbare Datei → stderr-Zeile **ohne Inhalt**.
- [ ] Ausgeschaltete Server: `%USERPROFILE%\.verwalter\agent\mcp-disabled.json`, Objekt Arbeitsordner (klein geschrieben) → Liste von Namen. `pub fn disabled(cwd) -> HashSet<String>`, `pub fn set_disabled(cwd, name, disabled: bool)` (Datei neu schreiben über `.tmp` + `rename`).

### Client `standalone/mcp/client.rs`

- [ ] `pub struct McpClient` mit `fn connect(config: &ServerConfig, cancel: &AtomicBool) -> Result<McpClient, String>`, `fn tools(&self) -> &[McpTool]` (`McpTool { name: String, description: String, input_schema: Value }`), `fn call(&self, tool: &str, arguments: &Value, cancel: &AtomicBool) -> Result<(String, bool), String>` (Text, `isError`), `fn close(self)`.
- [ ] stdio: Prozess mit `command`/`args`/`env`, `hide_console`, stdin/stdout als Zeilen-JSON, stderr in einen Thread, der nur die letzten 20 Zeilen für Fehlermeldungen behält. Scheitert der Start mit „nicht gefunden“ und hat `command` keine Endung, einmal über `cmd /c <command> <args…>` versuchen (Windows-Starter wie `npx`). Ein Lese-Thread verteilt Antworten nach `id` an wartende Aufrufer; Benachrichtigungen des Servers werden ignoriert.
- [ ] HTTP: `POST url` mit `Content-Type: application/json`, `Accept: application/json, text/event-stream`, den `headers` und nach `initialize` dem `Mcp-Session-Id` aus der Antwort. Antwort `application/json` → direkt; `text/event-stream` → `data:`-Zeilen lesen, bis die Nachricht mit passender `id` kommt. Status 401/403 → Fehler „Anmeldung (OAuth) wird im autarken Agenten nicht unterstützt.“
- [ ] Ablauf: `initialize` (`protocolVersion` = Konstante aus der Spezifikation, `capabilities: {}`, `clientInfo: {name: "verwalter", version: <App-Version>}`), dann `notifications/initialized`, dann `tools/list` mit `nextCursor` bis zum Ende. Zeitlimits: Verbindung und `initialize` 30 s, `tools/call` 300 s; `cancel` wird während `call` alle 50 ms geprüft (Abbruch → Fehler „Vom Benutzer unterbrochen.“).
- [ ] Ergebnis von `tools/call`: alle `content[]` mit `type: "text"` zusammengefügt; Bilder (`type: "image"`) als Satz „[Bild vom MCP-Server, <mimeType>]“ (Weitergabe ans Modell als Bild ist nicht Teil dieses Plans); `isError` übernehmen.

### Verwaltung `standalone/mcp/mod.rs`

- [ ] `pub struct McpServers` hält je Server Zustand (`Pending`, `Connected(McpClient)`, `Failed(String)`, `Disabled`) hinter einer Sperre. Beim Start des Agenten je nicht ausgeschaltetem Server ein Thread, der verbindet; die Verbindung blockiert den Start nicht.
- [ ] `pub fn tool_definitions(&self) -> Vec<Value>`: für jeden verbundenen Server je Werkzeug `{"type":"function","function":{"name":"mcp__<server>__<werkzeug>","description":…,"parameters":<input_schema>}}`. Zeichen außer `A–Z a–z 0–9 _ -` in Server- und Werkzeugnamen werden zu `_`; über 64 Zeichen → auf 64 kürzen und in FINDINGS notieren, falls es vorkommt. Wird bei jeder Modellanfrage neu gebaut (spät verbundene Server zählen ab der nächsten Anfrage).
- [ ] `pub fn call(&self, full_name: &str, input: &Value, cancel) -> ToolOutput` über die Zuordnung Name → (Server, Werkzeug).
- [ ] `pub fn status(&self) -> Value` im Format aus dem Kontext (`config` nur mit `type`, `command`, `args` bzw. `url`).
- [ ] `pub fn reconnect(&self, name) -> Result<(), String>` (schließen, neu verbinden, Ergebnis abwarten) und `pub fn toggle(&self, name, enabled: bool) -> Result<(), String>` (aus: schließen, `Disabled`, `set_disabled`; an: `set_disabled(false)`, `Pending`, verbinden im Thread). Unbekannter Name → `Err("Server not found: <name>")` (Wortlaut wie die Claude-Kommandozeile).

### Einbindung

- [ ] `tools/mod.rs`: `definitions` hängt `McpServers::tool_definitions()` an (Hauptagent und Subagenten, sofern deren `tools` nicht einschränkt; eine Definition mit `tools` bekommt MCP-Werkzeuge nur, wenn ihr voller Name dort steht). `run` leitet Namen mit Präfix `mcp__` an `McpServers::call`.
- [ ] `permissions::decide`: Präfix `mcp__` → `Manual` → `Ask`, sonst `Allow`. Hooks laufen mit dem vollen Namen.
- [ ] `session.rs`: `mcp_status` → `control_success` mit `{"mcpServers": status}`; `mcp_reconnect`/`mcp_toggle` in einem eigenen Thread ausführen und danach `control_success` mit `{}` bzw. `control_error` mit dem Fehlertext. Beim Prozessende alle Clients schließen (stdio-Prozesse beenden).

### Doku

- [ ] ADR 017, „Konsequenzen“: claude.ai-Connectoren fehlen; OAuth und SSE nicht unterstützt; viele MCP-Werkzeuge vergrößern den Prompt jeder Anfrage (Tempo); ausgeschaltete Server speichert der eigene Agent in eigener Datei, nicht in der Konfiguration von Claude Code.
- [ ] `docs/code-map.md`, Zeile „Autarker Agent“: `mcp/` (`config`, `client`, `mod`).
- [ ] Commit `feat(standalone): MCP-Server über stdio und HTTP`.

## Report-Back
