# Phase 1 — Core: Konfiguration lesen

## Kontext

- [README.md](README.md) — Kontrakt, Typen, Commands
- [ADR 070](../../decisions/070-mcp-server-verwalten.md), [ADR 013](../../decisions/013-mcp-server-im-dialog.md)
- `src-tauri/src/standalone/mcp/config.rs` — liest dieselben Orte für den autarken Agenten: `load`, `project_entries`, `folder_key`, `server_config`, `read_json`, `expanded`, Rangfolge lokal > `--mcp-config` > Projekt > Benutzer
- `src-tauri/src/agents/claude/process.rs` — `project_mcp_configs` (welche `.mcp.json` der Agent bekommt)
- `src-tauri/src/worktrees/` — `SessionRepository::working_dir(workspace)` liefert den Arbeitsordner eines Repositories **ohne** etwas anzulegen; `ensure` legt an und ist hier verboten
- `src-tauri/src/sessions/registry.rs` — `start_process` (um Zeile 4310: `add_dirs` aus `worktrees::ensure`), `SessionState`
- `src-tauri/src/mcp/model.rs`, `src-tauri/src/commands/mcp.rs`, `src-tauri/src/lib.rs` (Command-Liste)
- `docs/conventions/rust.md`, `docs/code-map.md` Zeile „MCP-Server“

## AK

1. `mcp_config_load` liefert für eine Session alle Quellen in der Reihenfolge User, Repository (Reihenfolge der Session-Repositories), Workspace (nur wenn die Datei existiert), Local — ohne einen Ordner oder Worktree anzulegen.
2. Repository-Quellen nutzen den Pfad `working_dir(workspace).join(".mcp.json")`; fehlt die Datei, erscheint die Quelle mit leerer `servers`-Liste (Ziel für Neues).
3. Local liest alle Einträge in `projects`, deren `folder_key` gleich dem Workspace ist (Claude schreibt mehrere Schreibweisen).
4. `enabled` ist `false` für Namen in `disabledMcpServers` (alle passenden `projects`-Einträge des Workspace) und für Workspace-Server zusätzlich in `disabledMcpjsonServers`.
5. `shadowed_by` folgt der Rangfolge Local > Repository (in Reihenfolge) > Workspace > User.
6. `McpPair.value` ist nur gesetzt, wenn der Wert vollständig ein `${NAME}`- oder `${NAME:-…}`-Verweis ist; sonst `None`. Kein Wert landet in Logs oder Fehlertexten; ein JSON-Fehler wird zu `error: "Datei ist kein gültiges JSON."`.
7. `SessionState` trägt `process_mcp_fingerprint: Option<u64>`; `start_process` setzt ihn aus `mcp_fingerprint(...)` (Hash über die rohen Server-Objekte aller Quellen inkl. Werte, ohne Aus-Listen). `config_changed` = Prozess vorhanden und Fingerabdruck ≠ aktueller.

## Checkliste

- [ ] `src-tauri/src/mcp/config_files.rs` anlegen (in `mcp/mod.rs` einhängen): `pub fn load_sources(home: &Path, workspace: &Path, repositories: &[(String, PathBuf)]) -> Vec<McpSource>` und `pub fn fingerprint(sources_raw) -> u64`. `folder_key` und `read_json` aus `standalone/mcp/config.rs` auf `pub(crate)` stellen und wiederverwenden, nicht kopieren.
- [ ] Rohdaten intern als `serde_json::Map` halten (Phase 2 schreibt darauf); die Umwandlung in `McpConfigEntry` maskiert.
- [ ] Typen aus dem Kontrakt in `mcp/model.rs` mit `#[derive(TS)]` wie die bestehenden.
- [ ] `SessionRegistry::mcp_config(&self, session_id) -> Result<McpConfigView, CommandError>` in `src-tauri/src/sessions/registry/mcp.rs`; Repositories über `session.repositories()` + `working_dir(&session.workspace)`, Name = Repository-Name.
- [ ] Fingerabdruck in `start_process` setzen (neben `process_repository_count`).
- [ ] Command `mcp_config_load` in `commands/mcp.rs`, in `lib.rs` registrieren; Wrapper `loadMcpConfig` in `src/lib/mcp.ts`.
- [ ] `pnpm check` und `cargo clippy` grün; Bindings neu erzeugt und mit committet.
- [ ] Doc: Code-Map-Zeile „MCP-Server“ um `mcp/config_files.rs` und den Command ergänzen.

## Report-Back
