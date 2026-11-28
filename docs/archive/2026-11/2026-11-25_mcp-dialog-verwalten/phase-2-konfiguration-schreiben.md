# Phase 2 — Core: Konfiguration schreiben, Neustart bei Änderung

## Kontext

- [README.md](README.md) — Kontrakt, „Von mir gesetzt“, Konfidenz (Schreib-Konflikt)
- Phase 1: `src-tauri/src/mcp/config_files.rs`
- `src-tauri/src/standalone/mcp/config.rs` — `set_disabled` (Zwischendatei + `fs::rename`, um Zeile 323) als Muster für sicheres Ersetzen
- `src-tauri/src/sessions/registry/mcp.rs` — `toggle_mcp`, `start_mcp_action`
- `src-tauri/src/sessions/registry.rs` — Sende-Pfad um Zeile 1290: Neustart bei `has_new_repository || has_new_backend || has_new_chrome` und `state.is_resting()`
- `src-tauri/src/settings/model.rs`, `src-tauri/src/settings/mod.rs` — Muster `library_dir` (Schlüssel-Konstante, `load`, `update`) für die neue Einstellung
- `src-tauri/Cargo.toml`

## AK

1. `mcp_config_save` mit `original_name: None` legt den Server in der Quelle `source_id` an; mit `Some(alt)` ersetzt er den Eintrag `alt` (Umbenennen erlaubt). Ziel-Knoten: User `mcpServers`, Local `projects[<Schlüssel>].mcpServers` (erster passender Schlüssel; fehlt er, neuer Schlüssel = Workspace-Pfad mit `/`), Repository/Workspace `<Datei>.mcpServers` (Datei fehlt → anlegen als `{"mcpServers":{…}}`).
2. Geschriebenes Format je Transport: Stdio `{"type":"stdio","command":…,"args":[…],"env":{…}}`, Http `{"type":"http","url":…,"headers":{…}}`, Sse `{"type":"sse","url":…,"headers":{…}}`; leere `env`/`headers` weglassen. Unbekannte weitere Felder eines bearbeiteten Eintrags bleiben erhalten.
3. `McpPairDraft.value == None` übernimmt den bisherigen Wert desselben Schlüssels; Schlüssel ohne bisherigen Wert und `None` → Fehler „Wert für <Schlüssel> fehlt.“
4. Prüfung: Name `^[A-Za-z0-9._-]{1,64}$`, nicht doppelt in derselben Quelle, URL beginnt mit `http://` oder `https://`, Befehl nicht leer. Fehler als `CommandError::Invalid` mit genau einem Satz.
5. Jede Schreibung liest die Datei unmittelbar davor frisch, ändert nur den Zielknoten, schreibt mit 2 Leerzeichen Einzug über Zwischendatei + `rename`, Reihenfolge bleibt (`serde_json` Feature `preserve_order`).
6. `mcp_config_remove` entfernt genau den Eintrag; fehlt er, kein Fehler. Ist `mcpServers` danach in einer `.mcp.json` leer, bleibt die Datei mit leerem Objekt stehen.
7. `toggle_mcp` ohne zuhörenden Agenten schreibt `disabledMcpServers` aller passenden Workspace-Einträge (fehlt einer: neuer Schlüssel wie AK 1) und gibt `true` zurück; mit Agent wie bisher.
8. „Überall aus“: Einstellung `mcp_disabled_everywhere` (JSON-Array von Namen, Schlüssel-Konstante `KEY_MCP_DISABLED_EVERYWHERE`). `toggle_mcp(..., enabled: false, everywhere: true)` schaltet wie AK 7 bzw. per Steueranfrage aus **und** nimmt den Namen in die Liste. `enabled: true` nimmt den Namen aus der Liste und entfernt ihn aus `disabledMcpServers` aller `projects`-Einträge in `~/.claude.json`, deren Ordner unter dem Workspace-Ordner des Verwalters liegt (Elternordner von `session.workspace`, Vergleich per `folder_key`). `enabled: false, everywhere: false` bei einem Namen in der Liste (Wechsel „überall aus“ → „hier aus“): wie `enabled: true` für alle anderen Vorhaben, im eigenen Workspace bleibt er aus.
9. `start_process` trägt vor dem Start jeden Namen aus `mcp_disabled_everywhere` in `disabledMcpServers` des Workspace ein (nur fehlende; über `rewrite`), damit auch neue Vorhaben ihn aus starten. `McpConfigView.disabled_everywhere` liefert die Liste.
10. Nach jeder Schreibung `mcp://changed` für alle Sessions.
11. Sende-Pfad: zusätzliche Neustart-Bedingung `state.process_mcp_fingerprint != Some(aktueller) && state.is_resting()`; ein arbeitender Agent wird nicht unterbrochen.

## Checkliste

- [x] `Cargo.toml`: `serde_json = { version = "1", features = ["preserve_order"] }`; `cargo build` prüfen, Compilerfehler durch geänderten `Map`-Typ beheben.
- [x] In `config_files.rs`: `save(...)`, `remove(...)`, `set_disabled_for_workspace(...)` mit gemeinsamer Funktion `rewrite(path, |root: &mut Value| …)`.
- [x] Registry-Methoden + Commands `mcp_config_save`, `mcp_config_remove`; Wrapper `saveMcpServer`, `removeMcpServer` in `src/lib/mcp.ts`.
- [x] `toggle_mcp` um den Zweig ohne Agent erweitern; Doc-Kommentar in `src/lib/mcp.ts` (`toggleMcpServer`) anpassen („ohne Agent: Datei“).
- [x] Einstellung `mcp_disabled_everywhere` (nicht in `Settings`/`model.rs`, sondern eigene Funktionen in `settings/mod.rs`; ungültiges JSON = leere Liste), `toggle_mcp` um `everywhere`, Eintragen vor `start_process`; Wrapper `toggleMcpServer(sessionId, server, enabled, everywhere)` in `src/lib/mcp.ts`.
- [x] Neustart-Bedingung im Sende-Pfad ergänzen; Kommentar dort nachziehen.
- [ ] Konfidenz-Check aus der README (gleichzeitige Kommandozeile) einmal fahren — **nicht gefahren**: braucht zwei echte laufende Sessions in der App; als 🟡 offen.
- [x] `docs/knowledge/claude-stream-json.md` Abschnitt „MCP-Server steuern“: Ablage `projects[<Arbeitsordner>].disabledMcpServers` und Existenz von `mcp_set_servers` (ungemessen) mit Datum 2026-11-25 ergänzen.
- [x] `pnpm check`, `cargo clippy` grün.

## Report-Back

Status: complete (Konfidenz-Check offen).

- `config_files.rs`: `save`, `remove`, `set_disabled_for_workspace`, `clear_disabled_under`, gemeinsames `rewrite` (frisch lesen, Zwischendatei + `rename`, Prozess-Sperre, Rechte der alten Datei übernommen).
- Neuer Fehler `CommandError::Invalid` (Binding von Hand in `CommandError.ts` ergänzt, nicht per ts-rs erzeugt).
- Abweichung: Neues in die Workspace-`.mcp.json` wird abgelehnt (README „Von mir gesetzt“); Entfernen eines Local-Servers entfernt ihn aus allen gleichwertigen Schlüsseln des Ordners.
- 🟡 „Überall aus“ greift in anderen Vorhaben erst beim nächsten Prozessstart; ein bereits laufender Agent dort bleibt unberührt.
- 🟡 Ein neu angelegter `projects[…]`-Eintrag enthält nur `disabledMcpServers`; ob Claude Code das ohne weitere Felder akzeptiert, ist nicht gemessen.
- 🟡 Konfidenz-Check zum gleichzeitigen Schreiben von `~/.claude.json` nicht gefahren.
- Nicht in der echten App gelaufen; belegt per `pnpm check` (inkl. Clippy).
