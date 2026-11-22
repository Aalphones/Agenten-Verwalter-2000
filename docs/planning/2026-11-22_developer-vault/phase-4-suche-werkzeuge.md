# Phase 4 — Suche und Werkzeuge für Agenten

**Stufe:** heikel (Pfadgrenze, Erweiterung des MCP-Antwortformats) · **Ziel:** Eine Suchfunktion im Core für alle Verbraucher und der Werkzeugsatz `vault_` mit `vault_search` und `vault_get`.

## Kontext — lesen vor dem Start

- `README.md` dieses Plans (Kontrakt: `VaultQuery`, `VaultHit`, `VaultSearchResult`, Werkzeug-Eingaben) und [ADR 068](../../decisions/068-developer-vault.md).
- Ergebnis von Phase 2 und 3: `src-tauri/src/vault/`.
- MCP-Zugang: `src-tauri/src/mcp_access/tools.rs` (Trait `ToolSet`, `ToolResult`), `rpc.rs` (Antwort von `tools/call`), `mod.rs` (`tool_sets()`), ADR 046.
- Muster eines Satzes mit Schalter: `src-tauri/src/skins/tools.rs` (`offered`, `unavailable_message`); Muster eines einfachen Satzes: `src-tauri/src/artifacts/tools.rs`.
- Pfadgrenze: `checked_path` in `src-tauri/src/files/mod.rs`.
- Prüfprogramm des MCP-Zugangs: `mcp-probe` (Befehlstabelle in `AGENTS.md`).
- Fehlerklassen (Vault `werkzeuge/claude-code` → „Fehlerklassen“): **Ein MCP-Werkzeug deckelt die Seitengröße stiller als das angeforderte Limit** — daraus AK 3: jede Antwort nennt die Gesamtzahl.
- Konventionen: `docs/conventions/rust.md`.

## Abnahmekriterien der Phase

1. **Anfrage an FTS5:** Suchtext in Begriffe zerlegen (Folgen von `char::is_alphanumeric`, klein); jeder Begriff wird zu `"begriff"*`; verbunden mit ` AND `, bei `any_term` mit ` OR `. Liefert `AND` mit mindestens zwei Begriffen nichts, wird einmal mit ` OR ` wiederholt. Rangfolge über `bm25(sections_fts, 2.0, 5.0, 4.0, 3.0, 1.0)` (Pfad, Titel, Tags, Überschrift, Text).
2. **Filter** über die Tabelle `artifacts`: `kind` gleich; jeder Tag muss in `tags` als ganzes Wort vorkommen; `under` = Artefaktpfad gleich oder beginnt mit `under/` (`%` und `_` in `LIKE` maskiert).
3. **Ergebnis:** je Artefakt nur der beste Abschnitt; höchstens `limit` Treffer (1–20 beim Werkzeug, Standard 8; 1–50 im Suchdialog); `total` = Zahl der verschiedenen passenden Artefakte, eigene `COUNT(DISTINCT …)`-Abfrage; `snippet` aus `snippet(sections_fts, 4, char(57344), char(57345), '…', 16)`.
4. **Leerer Suchtext:** keine FTS-Abfrage; Artefakte nach Filtern, neueste (`modified_ms`) zuerst; `file` = `entrypoint` oder Artefaktpfad, `line` = 1, `snippet` leer.
5. Jede Suche ruft vorher `ensure_fresh` (wartet nie) und meldet `is_scanning` und `scanned_at`. Vault aus, Ordner fehlt oder Fehler → Fehlersatz „Der Developer Vault ist nicht eingerichtet.“ bzw. der Satz aus dem Status.
6. **`vault_search`** liefert als Text eine Kopfzeile `Treffer: <n> von <total>` (bei laufendem Abgleich angehängt „ · Index wird gerade aktualisiert“), dann je Treffer `- <path> · <kind> · <title> — <description>`; mit Überschrift oder Zeile > 1 angehängt ` (Abschnitt „<heading>“, Zeile <line>: vault_get path="<file>" line=<line>)`; ein nicht leerer Ausschnitt eingerückt in der nächsten Zeile, Markierungen als `**`. `structured` = das Ergebnis als JSON.
7. **`vault_get`** — erlaubt sind nur Pfade, die als Datei in `files` stehen, oder Ordner, unter denen mindestens eine solche Datei liegt (der leere Pfad = Wurzel); `..`, absolute Pfade und alles, was nach `checked_path` außerhalb liegt, → „Der Pfad liegt außerhalb des Vault.“; Unbekanntes → „Nicht im Vault-Index: <path>. Pfade liefert vault_search.“ Datei mit `error` → „Diese Datei konnte nicht eingelesen werden: <error>“.
   - Bild (png, jpg, jpeg, gif, webp) bis 5 MiB → Bildinhalt (Base64, MIME-Typ) plus Textzeile `<path> (<Größe>)`.
   - Mit `line`: der Abschnitt der Datei mit genau dieser Startzeile, sonst der mit der größten Startzeile ≤ `line`; Kopf `<path> · <heading> · ab Zeile <line>`.
   - Ohne `line`, Textdatei: höchstens 20 000 Zeichen; mehr → Hinweis „… gekürzt (<n> Zeichen). Abschnitte mit line laden:“ und bis zu 30 Zeilen `Zeile <line>: <heading>`.
   - Binärdatei → „Binärdatei (<Größe>) — nicht als Text lesbar.“
   - Ordner: bis zu 200 eingelesene Dateien darunter (`<rel> · <kind> · <Größe>`), dazu Inhalt von `manifest.yaml`/`manifest.yml` und `README.md` dieses Ordners, zusammen höchstens 8000 Zeichen.
8. **`ToolResult`** bekommt die Variante `Image { text: String, data: String, mime_type: String }`; `rpc.rs` schreibt dafür `content: [{type:"text",text}, {type:"image",data,mimeType}]`. Alle übrigen Antworten bleiben byte-gleich.
9. **Angebot:** der Satz `VaultTools` steht in `tool_sets()`; `offered` = `vault_enabled` und `vault_dir` gesetzt (wie `skins/tools.rs` über `settings::load`); `unavailable_message` = „Der Developer Vault ist nicht eingerichtet (Einstellungen → Skills & Umgebung → Developer Vault).“
10. Beschreibungen exakt: `vault_search` — „Durchsucht den Developer Vault des Benutzers (Snippets, Wissen, Ideen, Designs, Vorlagen, Skripte) nach Titel, Tags, Dateinamen und Text. Liefert kurze Treffer mit Pfad; Inhalte lädt vault_get.“ · `vault_get` — „Lädt aus dem Developer Vault einen Abschnitt (path und line aus vault_search), eine Datei, die Dateiliste eines Ordners oder ein Bild.“ Schemas nach Kontrakt, `additionalProperties: false`.
11. `vault-probe search <Index-Datei> "<Begriff>"` druckt die Textausgabe von AK 6; `mcp-probe` mit `list` zeigt bei eingeschaltetem Vault `vault_search` und `vault_get`, bei ausgeschaltetem nicht.
12. `pnpm check` grün.

## Checkliste

- [ ] `src-tauri/src/vault/search.rs`: Typen und `search` nach Kontrakt und AK 1–5; Kern als `pub fn search_index(index: &VaultIndex, query: &VaultQuery) -> Result<(Vec<VaultHit>, u32), CommandError>` ohne `AppHandle` (für das Prüfprogramm), `search(app, query)` legt Status und Frische darum.
- [ ] `src-tauri/src/vault/tools.rs`: `pub struct VaultTools` mit `ToolSet` nach AK 6–10; Base64 über die Abhängigkeit `base64` (`engine::general_purpose::STANDARD`).
- [ ] `src-tauri/src/mcp_access/tools.rs` und `rpc.rs`: Variante `Image` nach AK 8; jedes `match` auf `ToolResult` anpassen.
- [ ] `src-tauri/src/mcp_access/mod.rs`: `Box::new(VaultTools)` in `tool_sets()`.
- [ ] `vault-probe`: Unterbefehl `search` nach AK 11; Zeile in `AGENTS.md`.
- [ ] Wackelstelle aus der README prüfen: in einer echten Session `vault_get` auf eine PNG-Datei; Ergebnis (zeigt Claude das Bild?) in `FINDINGS.md` festhalten.
- [ ] Doku: ADR 046 → Abschnitt Konsequenzen um einen Satz zur Bild-Antwort ergänzen; `docs/code-map.md` (`search.rs`, `tools.rs`, Eintrag `vault_*` in der Zeile „MCP-Zugang“); `docs/glossary.md` („Vault-Werkzeuge“).

## Report-Back
