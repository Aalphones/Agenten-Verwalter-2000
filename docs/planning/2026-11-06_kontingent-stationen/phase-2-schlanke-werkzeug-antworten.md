# Phase 2 — Schlanke Antworten der Umsetzungs-Werkzeuge

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Abschnitte „Entscheidungen“ und „Kontrakt“ — [README.md](README.md)
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/linting.md`
- Code:
  - `src-tauri/src/implementation/tools.rs`: Werkzeugliste `tools()` Zeile 31–107, darin GET Zeile 54–64 und SET_PHASES Zeile 65–76; `set_phases` Zeile 176–189; `create` Zeile 201–214; `get` Zeile 216–221; `answer` Zeile 285–290.
  - `src-tauri/src/mcp_access/rpc.rs` Zeile 121–131: Aus `ToolResult::Ok { text, structured }` wird `content[0].text` plus `structuredContent`.
- Chesterton's Fence, verstanden: `structured` gibt Agenten alle Felder der Umsetzung (IDs, Stationen, Modell, Aufwand, Auftrag), damit eine Planungs-Session `implementation_set_phases` mit der vollständigen Liste füllen kann. Diese Möglichkeit bleibt über `details: true` erhalten. Die Oberfläche liest die Umsetzung über Tauri-Befehle und Ereignisse, nicht über MCP — sie ist nicht betroffen.
- Beleg für das Problem: In einer Station kamen beim Aufruf von `implementation_get` 37 900 Zeichen JSON beim Modell an, nicht der Lagebericht. Claude Code reicht `structuredContent` an das Modell weiter, wenn es vorhanden ist.
- Vault-Fehlerklassen: keine Entity für Rust im Vault vorhanden.

## AK dieser Phase

1. `implementation_get` nimmt optional `details` (boolean, Standard `false`) an. Ohne `details` bzw. mit `false` enthält die Antwort nur den Lagebericht-Text, kein `structuredContent`. Mit `true` kommt sie wie bisher (Text plus View).
2. `implementation_create` und `implementation_set_phases` antworten nur mit Text, ohne `structuredContent`.
3. Die Werkzeugbeschreibung von `implementation_get` nennt `details` und wofür es da ist.
4. Rust-Test für die Hilfsfunktion `structured_if` (AK 1) ist grün; `pnpm check` ist grün.
5. Messung im Report-Back: Zeichenzahl des Lageberichts einer echten Umsetzung, gegenüber den 37 900 Zeichen vorher.

## Checkliste

- [ ] `tools.rs`: neue Hilfsfunktion
  ```rust
  /// Der ganze View nur auf ausdrücklichen Wunsch: Claude reicht `structuredContent` statt des
  /// Texts an das Modell weiter (ADR 058, gemessen 37 900 Zeichen je Aufruf).
  fn structured_if<T: Serialize>(details: bool, value: &T) -> Option<Value> {
      if details { serde_json::to_value(value).ok() } else { None }
  }
  ```
  `answer` bekommt den Parameter `details: bool` und setzt `structured: structured_if(details, view)`.
- [ ] `get`: Eingabe `#[derive(Deserialize)] struct GetArguments { #[serde(default)] details: bool }`, gelesen per `parse(call.arguments)?`, dann `answer(registry, &view, arguments.details)`.
- [ ] `create`: `answer(registry, &view, false)`.
- [ ] `set_phases`: den Block, der `structured` lädt (Zeile 179–187), entfernen; `Ok(ToolResult::Ok { text, structured: None })`.
- [ ] GET-`ToolSpec`:
  - `input_schema` mit `"properties": { "details": { "type": "boolean", "description": "true liefert zusätzlich alle Felder der Umsetzung als JSON (Phasen, Stationen mit IDs, Modell, Aufwand, Auftrag) — nur für Planänderungen nötig." } }`.
  - Beschreibung ergänzen: „Ohne details nur der Lagebericht als Text.“
- [ ] Test im `#[cfg(test)] mod tests` von `tools.rs` (anlegen, falls nicht vorhanden): `structured_if(false, &json!({"a": 1}))` ist `None`, `structured_if(true, &json!({"a": 1}))` ist `Some(json!({"a": 1}))`.
- [ ] `pnpm check`.
- [ ] Messung für AK 5:
  - `%USERPROFILE%\.verwalter\verwalter.db` nach `%TEMP%\verwalter-copy.db` kopieren. Nie gegen das Original arbeiten.
  - Die ID der neuesten Umsetzung holen: `python -c "import sqlite3;print(sqlite3.connect(r'%TEMP%\verwalter-copy.db').execute('select id from implementations order by created_at desc limit 1').fetchone()[0])"`.
  - Dann `cargo run --manifest-path src-tauri/Cargo.toml --example implementation-probe -- %TEMP%\verwalter-copy.db report <ID>` und die Zeichenzahl der Ausgabe festhalten, in PowerShell per `(… | Out-String).Length`.
  - Heißen Tabelle oder Spalte anders, den Namen in `src-tauri/src/db/implementations.rs` nachsehen.
- [ ] `docs/glossary.md` nur anpassen, falls dort `implementation_get` beschrieben ist (Grep).

## Definition of Done

- AK 1–5 erfüllt. AK 1 ist durch Test und Code belegt, AK 5 steht als Zahl im Report-Back.
- Für den Benutzer sichtbar: Stationen lesen beim Aufruf von `implementation_get` den kurzen Lagebericht statt eines JSON-Blocks; im Werkzeug-Detail des Chats ist das prüfbar.
- Ausgeführt und mit Summary-Zeile im Report-Back festgehalten: `cargo test --manifest-path src-tauri/Cargo.toml tools` und `pnpm check`.
- Seven-Goals-Check im Report-Back.

## Report-Back
