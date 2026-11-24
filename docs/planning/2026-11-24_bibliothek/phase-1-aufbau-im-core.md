# Phase 1 — Aufbau der Bibliothek im Core

**Stufe:** heikel · **Wave:** 1 · **Sichtabnahme:** keine (Fundament: der eingestellte Ordner ändert sich erst in Phase 2; belegt wird mit `vault-probe`)

Der Abgleich erkennt, ob ein Ordner eine Bibliothek ist (enthält `skills`, `commands`, `output-styles` oder `CLAUDE.md`) oder ein reiner Vault. In einer Bibliothek liest er nur die Erlaubnisliste, ordnet Skills, Befehle, Ausgabestile und Grundregeln eigene Arten zu und liefert je Treffer Gruppe und Untergruppe. Ein reiner Vault verhält sich wie bisher.

Warum diese Phase vor allem anderen kommt: Phase 2 stellt den gelesenen Ordner auf den Master-Ordner um. Ohne Erlaubnisliste kämen `memory/`, `hooks/`, die Logs und `settings.json` in den Index und über `vault_get` zu den Agenten.

## Kontext (vor dem Start lesen)

- Plan-README: Abschnitt „Kontrakt“ (Typen, Regeln von `apply_place` und `place`, Status, Grundgerüst) — er ist verbindlich.
- [ADR 069](../../decisions/069-bibliothek.md), [ADR 068](../../decisions/068-developer-vault.md).
- `src-tauri/src/vault/mod.rs` (`folder_status`, `is_empty_dir`, `brief_lines`), `scan.rs` (`run`, `walk`, `manifest_folders`, `folder_meta_of`, `sync_file`, `store_loaded`), `extract.rs` (`file_meta`, `folder_meta`), `meta.rs` (`split_frontmatter`, `parse_yaml`, `Meta`), `index.rs` (`SCHEMA_VERSION`, `read_meta`, `write_meta`), `search.rs` (`VaultHit`, `search_connection`), `tools.rs` (Texte), `skeleton.rs`, `model.rs`, `src-tauri/src/commands/vault.rs` (`vault_create_skeleton`), `src-tauri/src/environment/mirror.rs` (`has_mirrorable`).
- `src-tauri/examples/vault-probe.rs`, `src-tauri/examples/gen-bindings.rs`.
- `docs/conventions/rust.md`, `docs/conventions/linting.md`, `docs/code-map.md` (Zeile Developer Vault), `docs/glossary.md`.
- Fehlerklassen geprüft (Wissens-Vault: `sprachen/typescript`, `frameworks/react`, `systeme/sqlite`; für Rust und Tauri gibt es keinen Eintrag): keine einschlägig.

## Abnahmekriterien der Phase

1. `vault-probe scan "G:\Meine Ablage\U104_Agents" <Probe-Index>` liest ein; `vault-probe artifacts <Probe-Index>` listet keinen Pfad, der mit `memory/`, `hooks/`, `codex/`, `continue/`, `references/`, `_stylePakete/`, `.claude/` beginnt, und keine der Dateien `settings.json`, `improvement-log.md`, `skill-evolution-log.md`, `setup.cmd`, `SETUP.md`, `MIGRATION.md`, `merge-hooks.cjs`, `.gitignore`, `.gitattributes`.
2. Dieselbe Liste enthält `skills/mode-planning · skill · mode-planning` (ein Artefakt je Skill-Ordner, kein eigenes für `skills/mode-planning/WORK.md`), `commands/plan.md · command · /plan`, `output-styles/vera.md · style`, `CLAUDE.md · rules` und `_vault/README.md · note`.
3. `vault-probe search <Probe-Index> "Planung"` druckt je Treffer Gruppe und Untergruppe; ein Treffer aus `skills/mode-planning` steht als `skills/arbeitsweise`, einer aus `_vault/inbox/…` als `wissen/inbox`.
4. `vault-probe scan "G:\Meine Ablage\U104_Agents\_vault" <zweiter Probe-Index>` liest alles im Ordner ein wie vor dem Plan; alle Treffer tragen die Gruppe `wissen`, die Untergruppe ist der erste Ordner im Pfad.
5. Ein Probe-Index mit `schema_version` `1` wird beim nächsten `scan` verworfen und neu aufgebaut (`gelesen` = Zahl aller Dateien).
6. `skeleton::create` auf einen Ordner mit `skills\` und ohne `_vault\` legt `_vault\README.md`, `_vault\AGENTS.md`, `_vault\inbox\README.md` an und schreibt sonst nichts; existiert `_vault\` mit Inhalt, endet es mit dem Satz aus `NOT_EMPTY`. Für einen reinen Vault unverändert. (Beleg in einem Ordner unter dem Scratchpad, nie im Master.)
7. `brief_lines` sucht in einer Bibliothek nur unter `_vault` (`under`).
8. `pnpm check` grün; die Tests aus README → „Tests“ (Phase 1) laufen grün mit `cargo test --manifest-path src-tauri/Cargo.toml vault::library`.

## Checkliste

### Neues Modul `src-tauri/src/vault/library.rs`

- [ ] Inhalt genau nach Kontrakt: `KNOWLEDGE_DIR`, `VaultLayout` (`#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]`, `#[serde(rename_all = "camelCase")]`, Varianten `Library`, `Plain`), `layout`, `layout_name`, `layout_from_name`, `is_included_top`, `skill_folders`, `apply_place`, `Place`, `place`.
- [ ] `layout(root)` ruft `crate::environment::mirror::has_mirrorable(root)`; keine zweite Liste der Ordnernamen.
- [ ] `is_included_top`: Konstanten `LIBRARY_DIRS: [&str; 4] = ["skills", "commands", "output-styles", KNOWLEDGE_DIR]`, `LIBRARY_FILES: [&str; 2] = ["CLAUDE.md", "AGENTS.md"]`; Ordner nur gegen `LIBRARY_DIRS`, Dateien nur gegen `LIBRARY_FILES`, Vergleich mit `eq_ignore_ascii_case`.
- [ ] `skill_folders`: nur bei `Library`; ein Pfad der Form `skills/<x>/SKILL.md` (genau drei Teile, Vergleich von `SKILL.md` ohne Beachtung der Schreibweise) ergibt `skills/<x>`.
- [ ] `apply_place` und `place` genau nach den Tabellen im Kontrakt. „direkt“ heißt: genau zwei Pfadteile (`commands/plan.md`), Endung `.md` ohne Beachtung der Schreibweise. Untergruppe bei `_vault/<ordner>/…` ist `<ordner>`, bei `_vault/<datei>` leer.
- [ ] `pub mod library;` in `vault/mod.rs`.

### Abgleich (`scan.rs`)

- [ ] `run`: `let layout = library::layout(root);` als Erstes; danach `index.with(|c| index::set_layout(c, layout))`.
- [ ] `walk(root, layout, report)`: am `WalkBuilder` vor `.build()` `.filter_entry(move |entry| entry.depth() != 1 || library::is_included_top(layout, &entry.file_name().to_string_lossy(), entry.file_type().is_some_and(|kind| kind.is_dir())))`. Alle übrigen Einstellungen des Walkers bleiben (versteckte Dateien, `.gitignore`, `.vaultignore`).
- [ ] Artefakt-Ordner: `folders` = `manifest_folders(&entries)` vereinigt mit `library::skill_folders(layout, …)` über die `rel` aller Einträge. Alle Stellen, die `folders` benutzen (`artifact_of`, `dirty_folders`), bekommen diese Vereinigung.
- [ ] `folder_meta_of(root, folder, members, layout)`: gibt es keine Manifest-Datei, aber `<folder>/SKILL.md` unter den Dateien, ist der Manifest-Text der YAML-Teil von `meta::split_frontmatter` des SKILL.md-Inhalts (über `read_small_text`), und `readme` ist `None`. Danach `library::apply_place(layout, folder, &mut meta)`.
- [ ] `store_loaded` (über `sync_file` mit `layout` versorgt): nach `extract::file_meta` `library::apply_place(layout, &entry.rel, &mut meta)`.

### Index (`index.rs`)

- [ ] `SCHEMA_VERSION` = `"2"`.
- [ ] `const META_LAYOUT: &str = "layout";` · `pub fn set_layout(connection: &Connection, layout: VaultLayout) -> Result<(), CommandError>` (schreibt `layout_name`) · `pub fn layout(connection: &Connection) -> Result<VaultLayout, CommandError>` (fehlender Wert = `Plain`). Beide über `read_meta`/`write_meta`.

### Suche und Werkzeuge

- [ ] `search.rs`: `VaultHit` um `pub group: String` und `pub subgroup: String` erweitern (beide Konstruktoren setzen zunächst leere Texte). Am Ende von `search_connection` einmal `index::layout(connection)?` lesen und für jeden Treffer `place(layout, &hit.path)` eintragen — auch im Rückweg über `list_recent` und den zweiten `run_fts`-Aufruf.
- [ ] `mod.rs` `brief_lines`: `under` ist `Some(library::KNOWLEDGE_DIR.to_owned())`, wenn `folder_status(app).dir` existiert und `library::layout` dafür `Library` liefert; sonst `None`.
- [ ] `tools.rs` Texte: `SEARCH_DESCRIPTION` = „Durchsucht die Bibliothek des Benutzers: Wissen (Snippets, Rezepte, Ideen, Designs, Vorlagen, Skripte) und, falls vorhanden, Anweisungen, Skills, Befehle und Ausgabestile — nach Titel, Tags, Dateinamen und Text. Liefert kurze Treffer mit Pfad; Inhalte lädt vault_get.“ · `kind`-Beschreibung: „Art des Artefakts, z. B. snippet, note, skill, command, style, rules.“ · `under`: „Pfad-Präfix relativ zur Bibliothek, z. B. _vault oder skills.“ · `GET_DESCRIPTION` und `path`: „Bibliothek“ statt „Developer Vault“/„Vault“ · `UNAVAILABLE` = „Die Bibliothek ist nicht eingerichtet (Einstellungen → Skills & Umgebung → Bibliothek).“ Werkzeugnamen bleiben `vault_search` und `vault_get`.

### Status und Grundgerüst

- [ ] `model.rs`: `VaultStatus.layout: Option<VaultLayout>`; `is_empty_dir` → `can_create_skeleton: bool` (Doc-Kommentare nach Kontrakt).
- [ ] `mod.rs` `folder_status`: bei brauchbarem Ordner `layout: Some(library::layout(&dir))` und `can_create_skeleton` nach Kontrakt (Library: `!dir.join(KNOWLEDGE_DIR).exists() || is_empty_dir(&dir.join(KNOWLEDGE_DIR))`; Plain: `is_empty_dir(&dir)`); `base` setzt `layout: None`, `can_create_skeleton: false`.
- [ ] `skeleton.rs` `create(dir)`: `let target = match library::layout(dir) { Library => dir.join(KNOWLEDGE_DIR), Plain => dir.to_path_buf() };` Fehlt `target`, mit `fs::create_dir_all` anlegen; danach Prüfung `is_empty_dir(&target)` und Schreiben wie bisher nach `target`. Modul-Kommentar: „in einen leeren Vault-Ordner bzw. in `_vault` einer Bibliothek“.
- [ ] `commands/vault.rs` `vault_create_skeleton`: Vorbedingung `current.can_create_skeleton` statt eines leeren Ordners, falls dort geprüft.
- [ ] Oberfläche nur so weit, dass `pnpm check` grün ist: `VaultStatusRow.tsx` liest `status.canCreateSkeleton` statt `status.isEmptyDir`. Keine weitere Oberflächenänderung in dieser Phase.

### Bindings und Probe

- [ ] `gen-bindings.rs`: `VaultLayout` eintragen; `pnpm bindings`.
- [ ] `vault-probe.rs`: `artifacts` druckt unverändert `<pfad> · <art> · <titel> · …`; `search` hängt je Treffer ` · <group>/<subgroup>` an.

### Doku

- [ ] `docs/code-map.md`, Zeile Developer Vault: `library.rs` (Aufbau der Bibliothek: Erlaubnisliste, Arten nach Ort, Gruppen) ergänzen, „Developer Vault“ → „Bibliothek (Code-Feature `vault`)“.
- [ ] `docs/glossary.md`: Begriffe „Bibliothek“ (der eine Ordner; Code `vault`), „Wissen“ (Teil der Bibliothek unter `_vault/`), „reiner Vault“ (Ordner ohne Skills, Befehle, Ausgabestile, `CLAUDE.md`); „Developer Vault“ verweist auf „Bibliothek“.
- [ ] `AGENTS.md`, Zeile `vault-probe … search`: Ausgabe um ` · <group>/<subgroup>` ergänzen.

## Definition of Done

- AK 1–8 erfüllt; die Belege stehen im Report-Back.
- **Sichtbares Ergebnis:** noch keins in der App; Agenten und Probe sehen in einer Bibliothek nur die Erlaubnisliste, mit Arten und Gruppen.
- **Reviewable Artifact:** `artifacts/phase-1-probe.txt` mit den Aufrufen und Ausgaben zu AK 1–5 (bei AK 1/2 die vollständige `artifacts`-Liste der Bibliothek) und dem Beleg zu AK 6.
- Kommandos: `pnpm bindings`, `pnpm check` (Zusammenfassungszeile), Probe-Aufrufe aus AK 1–5. Probe-Index-Dateien liegen im Scratchpad, nie im Datenordner der App und nie im Master.
- Dateien: Code-Map, Glossar, `AGENTS.md` nachgezogen.
- Sieben Ziele kurz geprüft (Token-Effizienz, Code-Qualität, Umsetzungsgenauigkeit, Stabilität, Wartbarkeit, Sicherheit — Erlaubnisliste statt Ausschlussliste —, Einfachheit).

## Report-Back
