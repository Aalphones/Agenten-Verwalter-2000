# Phase 2 — Core: Konfiguration schreiben, Neustart bei Änderung

## Kontext

- [README.md](README.md) — Kontrakt, „Von mir gesetzt“, Konfidenz (Schreib-Konflikt)
- Phase 1: `src-tauri/src/mcp/config_files.rs`
- `src-tauri/src/standalone/mcp/config.rs` — `set_disabled` (Zwischendatei + `fs::rename`, um Zeile 323) als Muster für sicheres Ersetzen
- `src-tauri/src/sessions/registry/mcp.rs` — `toggle_mcp`, `start_mcp_action`
- `src-tauri/src/sessions/registry.rs` — Sende-Pfad um Zeile 1290: Neustart bei `has_new_repository || has_new_backend || has_new_chrome` und `state.is_resting()`
- `src-tauri/Cargo.toml`

## AK

1. `mcp_config_save` mit `original_name: None` legt den Server in der Quelle `source_id` an; mit `Some(alt)` ersetzt er den Eintrag `alt` (Umbenennen erlaubt). Ziel-Knoten: User `mcpServers`, Local `projects[<Schlüssel>].mcpServers` (erster passender Schlüssel; fehlt er, neuer Schlüssel = Workspace-Pfad mit `/`), Repository/Workspace `<Datei>.mcpServers` (Datei fehlt → anlegen als `{"mcpServers":{…}}`).
2. Geschriebenes Format je Transport: Stdio `{"type":"stdio","command":…,"args":[…],"env":{…}}`, Http `{"type":"http","url":…,"headers":{…}}`, Sse `{"type":"sse","url":…,"headers":{…}}`; leere `env`/`headers` weglassen. Unbekannte weitere Felder eines bearbeiteten Eintrags bleiben erhalten.
3. `McpPairDraft.value == None` übernimmt den bisherigen Wert desselben Schlüssels; Schlüssel ohne bisherigen Wert und `None` → Fehler „Wert für <Schlüssel> fehlt.“
4. Prüfung: Name `^[A-Za-z0-9._-]{1,64}$`, nicht doppelt in derselben Quelle, URL beginnt mit `http://` oder `https://`, Befehl nicht leer. Fehler als `CommandError::Invalid` mit genau einem Satz.
5. Jede Schreibung liest die Datei unmittelbar davor frisch, ändert nur den Zielknoten, schreibt mit 2 Leerzeichen Einzug über Zwischendatei + `rename`, Reihenfolge bleibt (`serde_json` Feature `preserve_order`).
6. `mcp_config_remove` entfernt genau den Eintrag; fehlt er, kein Fehler. Ist `mcpServers` danach in einer `.mcp.json` leer, bleibt die Datei mit leerem Objekt stehen.
7. `toggle_mcp` ohne zuhörenden Agenten schreibt `disabledMcpServers` aller passenden Workspace-Einträge (fehlt einer: neuer Schlüssel wie AK 1) und gibt `true` zurück; mit Agent wie bisher.
8. Nach jeder Schreibung `mcp://changed` für alle Sessions.
9. Sende-Pfad: zusätzliche Neustart-Bedingung `state.process_mcp_fingerprint != Some(aktueller) && state.is_resting()`; ein arbeitender Agent wird nicht unterbrochen.

## Checkliste

- [ ] `Cargo.toml`: `serde_json = { version = "1", features = ["preserve_order"] }`; `cargo build` prüfen, Compilerfehler durch geänderten `Map`-Typ beheben.
- [ ] In `config_files.rs`: `save(...)`, `remove(...)`, `set_disabled_for_workspace(...)` mit gemeinsamer Funktion `rewrite(path, |root: &mut Value| …)`.
- [ ] Registry-Methoden + Commands `mcp_config_save`, `mcp_config_remove`; Wrapper `saveMcpServer`, `removeMcpServer` in `src/lib/mcp.ts`.
- [ ] `toggle_mcp` um den Zweig ohne Agent erweitern; Doc-Kommentar in `src/lib/mcp.ts` (`toggleMcpServer`) anpassen („ohne Agent: Datei“).
- [ ] Neustart-Bedingung im Sende-Pfad ergänzen; Kommentar dort nachziehen.
- [ ] Konfidenz-Check aus der README (gleichzeitige Kommandozeile) einmal fahren; Ergebnis in Report-Back und, falls Verlust, als 🟡-Follow-up.
- [ ] `docs/knowledge/claude-stream-json.md` Abschnitt „MCP-Server steuern“: Ablage `projects[<Arbeitsordner>].disabledMcpServers` und Existenz von `mcp_set_servers` (ungemessen) mit Datum 2026-11-25 ergänzen.
- [ ] `pnpm check`, `cargo clippy` grün.

## Report-Back
