# Phase 3 — Core: Verbindung testen, Werkzeuge und Anweisungen lesen

## Kontext

- [README.md](README.md) — Kontrakt (`McpProbeResult`, `mcp_probe`, `mcp_inspect`)
- `src-tauri/src/standalone/mcp/client.rs` — `McpClient::connect`, `handshake` (Antwort auf `initialize`), `list_tools`, `McpTool`, `close`, `OAUTH_UNSUPPORTED`
- `src-tauri/src/standalone/mcp/config.rs` — `server_config` (Rohobjekt → `ServerConfig` inkl. `${VAR}`-Auflösung)
- Phase 1/2: `src-tauri/src/mcp/config_files.rs` (Rohdaten je Quelle, Übernahme verborgener Werte)

## AK

1. `McpClient` merkt sich `instructions` aus der `initialize`-Antwort (`result.instructions`, String) und gibt sie über `pub fn instructions(&self) -> Option<&str>` heraus; der autarke Agent verhält sich sonst unverändert.
2. `mcp_probe(draft)` baut aus dem Entwurf (verborgene Werte aus der gespeicherten Quelle ergänzt wie in Phase 2 AK 3) ein `ServerConfig`, verbindet, liest Werkzeuge und Anweisungen, schließt die Verbindung (auch bei Fehler, kein zurückbleibender Prozess) und liefert `McpProbeResult`.
3. `mcp_inspect(sourceId, name)` macht dasselbe mit dem gespeicherten Eintrag.
4. Beide laufen in `tauri::async_runtime::spawn_blocking`, brechen nach 20 s über das `AtomicBool` ab und liefern dann `error: "Keine Antwort nach 20 Sekunden."`.
5. Fehlertexte: HTTP 401/403 oder `OAUTH_UNSUPPORTED` → „Der Server verlangt eine Anmeldung. Testen geht nur über den Agenten.“; sonst der Fehlersatz des Clients — nie Header- oder Umgebungswerte.
6. Stdio-Server starten im Workspace der Session als Arbeitsordner.

## Checkliste

- [ ] `client.rs`: Feld `instructions: Option<String>` + Getter; `handshake` liest es aus der Antwort.
- [ ] `server_config` auf `pub(crate)`.
- [ ] `config_files.rs`: `pub fn probe_config(...) -> Result<ServerConfig, String>` für Entwurf und gespeicherten Eintrag.
- [ ] Registry/Commands `mcp_probe`, `mcp_inspect`; Wrapper `probeMcpServer`, `inspectMcpServer` in `src/lib/mcp.ts`.
- [ ] Konfidenz-Check aus der README (`dispatch` mit Anweisungen, ein Server ohne) fahren.
- [ ] `pnpm check`, `cargo clippy` grün; Code-Map-Zeile ergänzen.

## Report-Back
