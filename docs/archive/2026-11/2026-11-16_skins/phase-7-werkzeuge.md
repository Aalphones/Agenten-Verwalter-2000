# Phase 7 — Agenten-Werkzeuge `skin_*` hinter dem Schalter

Rating: heikel (Rechtegrenze, Dateipfade). Mit „Agent darf Skins bearbeiten“ = an bekommt ein neu gestarteter Agent 13 Werkzeuge, mit denen er alles kann, was die Seite „Skins“ kann – und nichts darüber hinaus.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt; [ADR 046](../../decisions/046-mcp-zugang.md) (MCP-Zugang)
- `src-tauri/src/mcp_access/tools.rs` (`ToolSet`, `ToolSpec`, `ToolCall`, `ToolResult`), `mcp_access/mod.rs` (`tool_sets()`), `mcp_access/rpc.rs` (`tools/list` → `list(tool_sets)`, `tools/call` → `call(...)`)
- `src-tauri/src/artifacts/tools.rs` (Muster eines Werkzeugsatzes: Schema, Fehlersätze, `structured`), `src-tauri/src/implementation/tools.rs`
- `src-tauri/src/sessions/registry/artifacts.rs` (`self.get(session_id)?.workspace`)
- Phase 2/6: `skins/mod.rs`, `skins/archive.rs`, `settings/mod.rs`
- Fehlerklassen geprüft (Vault `protokolle/mcp`): „Server nach altem Schema“ – betrifft den Zugang als Ganzes, nicht neue Werkzeuge; nicht einschlägig.

## AK

1. `ToolSet` bekommt `fn offered(&self, app: &AppHandle) -> bool { true }`; `tools/list` listet nur Sätze mit `offered == true`; `tools/call` auf ein Werkzeug eines nicht angebotenen Satzes → `isError` mit „Skin-Werkzeuge sind ausgeschaltet (Einstellungen → Skins → Agent).“
2. `SkinTools::offered` liest `skin_agent_tools` aus der Datenbank (`app.state::<Arc<Database>>()`, `settings::load`).
3. Werkzeuge und Eingaben (JSON-Schema, alle Felder camelCase):
   - `skin_list {}` → Pakete (`id`, `kind`, `name`, `changedBy`) + `activeFigures`, `activeStyle`.
   - `skin_get { pack }` → `SkinPack` ohne `dir`.
   - `skin_create { kind, name, copyOf? }`.
   - `skin_rename { pack, name }`.
   - `skin_slot_set { pack, slot, name?, tools?, input?, position?, motion?, texts? }` — `slot` = vorgegebene ID oder `c-…`; unbekanntes `c-…` legt ein eigenes Fach an (dann `name` und `tools` Pflicht); `position` (0-basiert) nur für eigene Fächer; `name`/`tools`/`input`/`position` auf vorgegebene Fächer → Fehlersatz; `texts` ersetzt die Liste.
   - `skin_slot_remove { pack, slot }` (nur `c-…`).
   - `skin_style_set { pack, scheme: "dark"|"light", colors?: {base?, sidebar?, surface?, fg?, muted?, accent?, border?}, sidebarOpacity?, contentOpacity? }`.
   - `skin_image_set { pack, target: "slot:<id>" | "slot:<id>:2" | "sidebar" | "content" | "icon", source }` — `source` = `https://…` oder ein Pfad; leer = Bild entfernen. Pfade nur innerhalb des Arbeitsordners der Session (`workspace` aus der Registry), nach `canonicalize` geprüft.
   - `skin_delete { pack }`.
   - `skin_export { pack, file }` — `file` relativ zum Arbeitsordner, Endung `.zip`, darf nicht existieren.
   - `skin_import { file }` — relativ zum Arbeitsordner.
   - `skin_activate { figures?: string|null, style?: string|null, animations?: bool, celebrations?: bool, easterEggs?: bool }` — schreibt über `settings::update`; `skin_agent_tools` ist nicht erreichbar.
   - `skin_tool_usage { days?: number (1–90, Standard 30) }` → `ToolUsage` je Zeile inkl. `slot` = Fach, das den Aufruf im aktiven Figurenpaket heute fängt (Rust-Gegenstück zu `slotFor` in `skins/matching.rs`, gleiche Regeln).
4. Jede schreibende Aktion setzt `changed_by` = „Session #<Nr> · <Name>“ der aufrufenden Session und sendet `skins://changed`; die Oberfläche zeigt den violetten Punkt.
5. Fehler kommen als ein Satz zurück (Muster der Artefakt-Werkzeuge), nie als Panik.
6. Beschreibungen der Werkzeuge nennen Zweck, Muster-Regeln (`*`, `?`, Komma, Reihenfolge), Grenzen und Platzhalter `{ziel}`, `{zeit}`, `{commit}` – damit ein Agent nach einem Session-Review aus `skin_tool_usage` sinnvolle Fächer anlegen kann.

## Checkliste

- [x] `mcp_access/tools.rs`: Methode `offered` (AK 1); `rpc.rs`: `list` und `call` filtern.
- [x] `src-tauri/src/skins/matching.rs`: `glob_to_regex`, `matches_any`, `slot_for(tool, target, &FiguresData) -> String` (gleiche Regeln wie `matchSlot.ts`), Tabelle der vorgegebenen Werkzeuge wie `BUILTIN_TOOL_SLOTS`.
- [x] `src-tauri/src/skins/tools.rs`: `pub struct SkinTools;` mit `prefix() = "skin_"`, 13 `ToolSpec`s, `call` als Weiche; Aufrufe gehen auf dieselben Funktionen wie die Commands (`skins/mod.rs`, `archive.rs`), nie eigene Logik.
- [x] `src-tauri/src/sessions/registry/skins.rs`: `pub fn skin_context(&self, session_id: &str) -> Result<(PathBuf, String), CommandError>` (Arbeitsordner, Beschriftung „Session #<Nr> · <Name>“; Feldnamen aus `self.get(...)` übernehmen).
- [x] `mcp_access/mod.rs`: `tool_sets()` um `Box::new(SkinTools)` ergänzen.
- [ ] Prüfung mit `cargo run --example mcp-probe -- <Konfigurationsdatei> list` (aus einer laufenden Dev-App): Schalter aus → keine `skin_*`; an + Agent neu gestartet → 13. Ergebnis im Report-Back. **Nicht gelaufen** (keine laufende Dev-App in dieser Station).
- [x] Doku: `docs/code-map.md` (MCP-Zugang: `SkinTools`, `offered`), ADR 046 Abschnitt „Konsequenzen“ um „Sätze können sich per `offered` abschalten“ ergänzen.

## Report-Back

Status: complete. `pnpm check` grün; in der echten App nicht gelaufen (`mcp-probe`, Schalter an/aus, ein echter Agent-Aufruf, Violetter Punkt nach Agenten-Änderung ungeprüft; keine Tests im privaten Profil).

- **Abweichungen:** (1) `ToolSet` hat neben `offered` ein zweites Feld `unavailable_message()` (Voreinstellung „Diese Werkzeuge sind ausgeschaltet.“), damit `rpc.rs` den Satz aus AK 1 nicht für alle Sätze festschreibt. (2) Alle schreibenden Funktionen in `skins/mod.rs` und `archive::import` nehmen jetzt `changed_by: Option<&str>` (Commands geben `None`), sonst gäbe es keinen Weg zu AK 4. (3) `glob_to_regex` baut mit `regex::escape` und `RegexBuilder::case_insensitive`; `slot_for` nimmt `Option<&FiguresData>` (ohne aktives Figurenpaket gilt nur die Tabelle der vorgegebenen Werkzeuge) und liefert den Namen. (4) Hilfsdateien `tool_args.rs`, `tool_edit.rs`, `tool_paths.rs`, damit `tools.rs` lesbar bleibt. (5) `Motion::ALL` und `BuiltinSlot::ALL` in `model.rs` für Schema und Fehlersätze. (6) Oberfläche: `useActiveSkins` liest bei jedem `skins://changed` die Einstellungen neu, weil `skin_activate` sie am Store vorbei ändert; ohne das hätte die Auswahl erst nach einem Neustart gewirkt. Kosten: jede Paketänderung ruft `settings_load` (inkl. Skill-Scan).
- **Wackelstellen:** (1) `skins/tools.rs` `offered` liest die Datenbank bei jedem `tools/list` und `tools/call`; ein Agent, der vor dem Einschalten startete, bekommt die Werkzeuge erst nach Neustart (Liste wird vom Client einmal gelesen). (2) `skin_tool_usage` ordnet nach den 40 Zeichen `input_prefix`; ein Eingabe-Muster, das mehr Zeichen braucht, trifft in der Auswertung nicht, in der Statuszeile schon. (3) `tool_paths.rs`: Pfadgrenze nur per Quelltext geprüft (Windows-Verknüpfungen, `\\?\`-Präfix nach `canonicalize`). (4) `skin_image_set` mit einer Adresse lädt über das Netz wie die Seite (Grenzen aus Phase 2). (5) `skin_delete` kann der Agent nicht rückgängig machen; kein Werkzeug für `skins_undelete`.
