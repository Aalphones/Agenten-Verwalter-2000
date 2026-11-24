# Phase 1 — Aufbau der Bibliothek im Core

**Stufe:** heikel · **Wave:** 1 · **Sichtabnahme:** keine (Fundament: der eingestellte Ordner ändert sich erst in Phase 2; belegt wird mit `vault-probe`)

Der Abgleich erkennt, ob ein Ordner eine Bibliothek ist (enthält `skills`, `commands`, `output-styles` oder `CLAUDE.md`) oder ein reiner Vault. In einer Bibliothek liest er nur die Erlaubnisliste, ordnet Skills, Befehle, Ausgabestile und Grundregeln eigene Arten zu und liefert je Treffer Gruppe und Untergruppe. Ein reiner Vault verhält sich wie bisher.

Warum diese Phase vor allem anderen kommt: Phase 2 stellt den gelesenen Ordner auf den Master-Ordner um. Ohne Erlaubnisliste kämen `hooks/`, die Logs, `settings.json` und `memory/_archiv/` in den Index und über `vault_get` zu den Agenten. Aus `memory/` zählen nur die Dateien direkt darin (Gruppe Anweisungen › Gedächtnis); einzelne Dateien schließt die `.vaultignore` im Master-Ordner aus (dort steht bereits `/memory/feedback_local_login_credentials.md`).

## Kontext (vor dem Start lesen)

- Plan-README: Abschnitt „Kontrakt“ (Typen, Regeln von `apply_place` und `place`, Status, Grundgerüst) — er ist verbindlich.
- [ADR 069](../../decisions/069-bibliothek.md), [ADR 068](../../decisions/068-developer-vault.md).
- `src-tauri/src/vault/mod.rs` (`folder_status`, `is_empty_dir`, `brief_lines`), `scan.rs` (`run`, `walk`, `manifest_folders`, `folder_meta_of`, `sync_file`, `store_loaded`), `extract.rs` (`file_meta`, `folder_meta`), `meta.rs` (`split_frontmatter`, `parse_yaml`, `Meta`), `index.rs` (`SCHEMA_VERSION`, `read_meta`, `write_meta`), `search.rs` (`VaultHit`, `search_connection`), `tools.rs` (Texte), `skeleton.rs`, `model.rs`, `src-tauri/src/commands/vault.rs` (`vault_create_skeleton`), `src-tauri/src/environment/mirror.rs` (`has_mirrorable`).
- `src-tauri/examples/vault-probe.rs`, `src-tauri/examples/gen-bindings.rs`.
- `docs/conventions/rust.md`, `docs/conventions/linting.md`, `docs/code-map.md` (Zeile Developer Vault), `docs/glossary.md`.
- Fehlerklassen geprüft (Wissens-Vault: `sprachen/typescript`, `frameworks/react`, `systeme/sqlite`; für Rust und Tauri gibt es keinen Eintrag): keine einschlägig.

## Abnahmekriterien der Phase

1. `vault-probe scan "G:\Meine Ablage\U104_Agents" <Probe-Index>` liest ein; `vault-probe artifacts <Probe-Index>` listet keinen Pfad, der mit `memory/_archiv/`, `hooks/`, `codex/`, `continue/`, `references/`, `_stylePakete/`, `.claude/` beginnt, und keine der Dateien `memory/feedback_local_login_credentials.md`, `settings.json`, `improvement-log.md`, `skill-evolution-log.md`, `setup.cmd`, `SETUP.md`, `MIGRATION.md`, `merge-hooks.cjs`, `.gitignore`, `.gitattributes`.
2. Dieselbe Liste enthält `skills/mode-planning · skill · mode-planning` (ein Artefakt je Skill-Ordner, kein eigenes für `skills/mode-planning/WORK.md`), `commands/plan.md · command · /plan`, `output-styles/vera.md · style`, `CLAUDE.md · rules`, `memory/feedback_keine_zaehltests.md · memory` und `_vault/README.md · note`.
3. `vault-probe search <Probe-Index> "Planung"` druckt je Treffer Gruppe und Untergruppe; ein Treffer aus `skills/mode-planning` steht als `skills/arbeitsweise`, einer aus `_vault/inbox/…` als `wissen/inbox`; `vault-probe search <Probe-Index> "Zählprüfungen"` liefert `memory/feedback_keine_zaehltests.md` als `anweisungen/gedaechtnis`.
4. `vault-probe scan "G:\Meine Ablage\U104_Agents\_vault" <zweiter Probe-Index>` liest alles im Ordner ein wie vor dem Plan; alle Treffer tragen die Gruppe `wissen`, die Untergruppe ist der erste Ordner im Pfad.
5. Ein Probe-Index mit `schema_version` `1` wird beim nächsten `scan` verworfen und neu aufgebaut (`gelesen` = Zahl aller Dateien).
6. `skeleton::create` auf einen Ordner mit `skills\` und ohne `_vault\` legt `_vault\README.md`, `_vault\AGENTS.md`, `_vault\inbox\README.md` an und schreibt sonst nichts; existiert `_vault\` mit Inhalt, endet es mit dem Satz aus `NOT_EMPTY`. Für einen reinen Vault unverändert. (Beleg in einem Ordner unter dem Scratchpad, nie im Master.)
7. `brief_lines` sucht in einer Bibliothek nur unter `_vault` (`under`).
8. `pnpm check` grün; die Tests aus README → „Tests“ (Phase 1) laufen grün mit `cargo test --manifest-path src-tauri/Cargo.toml vault::library`.

## Checkliste

### Neues Modul `src-tauri/src/vault/library.rs`

- [x] Inhalt genau nach Kontrakt: `KNOWLEDGE_DIR`, `VaultLayout` (`#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]`, `#[serde(rename_all = "camelCase")]`, Varianten `Library`, `Plain`), `layout`, `layout_name`, `layout_from_name`, `is_included_top`, `is_included_below`, `skill_folders`, `apply_place`, `Place`, `place`.
- [x] `layout(root)` ruft `crate::environment::mirror::has_mirrorable(root)`; keine zweite Liste der Ordnernamen.
- [x] `is_included_top`: Konstanten `const MEMORY_DIR: &str = "memory";`, `LIBRARY_DIRS: [&str; 5] = ["skills", "commands", "output-styles", MEMORY_DIR, KNOWLEDGE_DIR]`, `LIBRARY_FILES: [&str; 2] = ["CLAUDE.md", "AGENTS.md"]`; Ordner nur gegen `LIBRARY_DIRS`, Dateien nur gegen `LIBRARY_FILES`, Vergleich mit `eq_ignore_ascii_case`.
- [x] `is_included_below(layout, parent_top, is_dir)`: `false` genau dann, wenn `layout == Library`, `is_dir` und `parent_top` gleich `MEMORY_DIR` (ohne Beachtung der Schreibweise); sonst `true`.
- [x] `skill_folders`: nur bei `Library`; ein Pfad der Form `skills/<x>/SKILL.md` (genau drei Teile, Vergleich von `SKILL.md` ohne Beachtung der Schreibweise) ergibt `skills/<x>`.
- [x] `apply_place` und `place` genau nach den Tabellen im Kontrakt. „direkt“ heißt: genau zwei Pfadteile (`commands/plan.md`), Endung `.md` ohne Beachtung der Schreibweise. Untergruppe bei `_vault/<ordner>/…` ist `<ordner>`, bei `_vault/<datei>` leer.
- [x] `pub mod library;` in `vault/mod.rs`.

### Abgleich (`scan.rs`)

- [x] `run`: `let layout = library::layout(root);` als Erstes; danach `index.with(|c| index::set_layout(c, layout))`.
- [x] `walk(root, layout, report)`: am `WalkBuilder` vor `.build()` ein `.filter_entry(move |entry| …)` mit `is_dir = entry.file_type().is_some_and(|kind| kind.is_dir())`: Tiefe 1 → `library::is_included_top(layout, <Name des Eintrags>, is_dir)`; Tiefe 2 → `library::is_included_below(layout, <Name des Elternordners>, is_dir)` (Elternname über `entry.path().parent()` und `file_name()`); jede andere Tiefe → `true`. Alle übrigen Einstellungen des Walkers bleiben (versteckte Dateien, `.gitignore`, `.vaultignore`).
- [x] Artefakt-Ordner: `folders` = `manifest_folders(&entries)` vereinigt mit `library::skill_folders(layout, …)` über die `rel` aller Einträge. Alle Stellen, die `folders` benutzen (`artifact_of`, `dirty_folders`), bekommen diese Vereinigung.
- [x] `folder_meta_of(root, folder, members, layout)`: gibt es keine Manifest-Datei, aber `<folder>/SKILL.md` unter den Dateien, ist der Manifest-Text der YAML-Teil von `meta::split_frontmatter` des SKILL.md-Inhalts (über `read_small_text`), und `readme` ist `None`. Danach `library::apply_place(layout, folder, &mut meta)`.
- [x] `store_loaded` (über `sync_file` mit `layout` versorgt): nach `extract::file_meta` `library::apply_place(layout, &entry.rel, &mut meta)`.

### Index (`index.rs`)

- [x] `SCHEMA_VERSION` = `"2"`.
- [x] `const META_LAYOUT: &str = "layout";` · `pub fn set_layout(connection: &Connection, layout: VaultLayout) -> Result<(), CommandError>` (schreibt `layout_name`) · `pub fn layout(connection: &Connection) -> Result<VaultLayout, CommandError>` (fehlender Wert = `Plain`). Beide über `read_meta`/`write_meta`.

### Suche und Werkzeuge

- [x] `search.rs`: `VaultHit` um `pub group: String` und `pub subgroup: String` erweitern (beide Konstruktoren setzen zunächst leere Texte). Am Ende von `search_connection` einmal `index::layout(connection)?` lesen und für jeden Treffer `place(layout, &hit.path)` eintragen — auch im Rückweg über `list_recent` und den zweiten `run_fts`-Aufruf.
- [x] `mod.rs` `brief_lines`: `under` ist `Some(library::KNOWLEDGE_DIR.to_owned())`, wenn `folder_status(app).dir` existiert und `library::layout` dafür `Library` liefert; sonst `None`.
- [x] `tools.rs` Texte: `SEARCH_DESCRIPTION` = „Durchsucht die Bibliothek des Benutzers: Wissen (Snippets, Rezepte, Ideen, Designs, Vorlagen, Skripte) und, falls vorhanden, Anweisungen, Memories, Skills, Befehle und Ausgabestile — nach Titel, Tags, Dateinamen und Text. Liefert kurze Treffer mit Pfad; Inhalte lädt vault_get.“ · `kind`-Beschreibung: „Art des Artefakts, z. B. snippet, note, skill, command, style, rules, memory.“ · `under`: „Pfad-Präfix relativ zur Bibliothek, z. B. _vault oder skills.“ · `GET_DESCRIPTION` und `path`: „Bibliothek“ statt „Developer Vault“/„Vault“ · `UNAVAILABLE` = „Die Bibliothek ist nicht eingerichtet (Einstellungen → Skills & Umgebung → Bibliothek).“ Werkzeugnamen bleiben `vault_search` und `vault_get`.

### Status und Grundgerüst

- [x] `model.rs`: `VaultStatus.layout: Option<VaultLayout>`; `is_empty_dir` → `can_create_skeleton: bool` (Doc-Kommentare nach Kontrakt).
- [x] `mod.rs` `folder_status`: bei brauchbarem Ordner `layout: Some(library::layout(&dir))` und `can_create_skeleton` nach Kontrakt (Library: `!dir.join(KNOWLEDGE_DIR).exists() || is_empty_dir(&dir.join(KNOWLEDGE_DIR))`; Plain: `is_empty_dir(&dir)`); `base` setzt `layout: None`, `can_create_skeleton: false`.
- [x] `skeleton.rs` `create(dir)`: `let target = match library::layout(dir) { Library => dir.join(KNOWLEDGE_DIR), Plain => dir.to_path_buf() };` Fehlt `target`, mit `fs::create_dir_all` anlegen; danach Prüfung `is_empty_dir(&target)` und Schreiben wie bisher nach `target`. Modul-Kommentar: „in einen leeren Vault-Ordner bzw. in `_vault` einer Bibliothek“.
- [x] `commands/vault.rs` `vault_create_skeleton`: Vorbedingung `current.can_create_skeleton` statt eines leeren Ordners, falls dort geprüft.
- [x] Oberfläche nur so weit, dass `pnpm check` grün ist: `VaultStatusRow.tsx` liest `status.canCreateSkeleton` statt `status.isEmptyDir`. Keine weitere Oberflächenänderung in dieser Phase.

### Bindings und Probe

- [x] `gen-bindings.rs`: `VaultLayout` eintragen; `pnpm bindings`.
- [x] `vault-probe.rs`: `artifacts` druckt unverändert `<pfad> · <art> · <titel> · …`; `search` hängt je Treffer ` · <group>/<subgroup>` an.

### Doku

- [x] `docs/code-map.md`, Zeile Developer Vault: `library.rs` (Aufbau der Bibliothek: Erlaubnisliste, Arten nach Ort, Gruppen) ergänzen, „Developer Vault“ → „Bibliothek (Code-Feature `vault`)“.
- [x] `docs/glossary.md`: Begriffe „Bibliothek“ (der eine Ordner; Code `vault`), „Wissen“ (Teil der Bibliothek unter `_vault/`), „reiner Vault“ (Ordner ohne Skills, Befehle, Ausgabestile, `CLAUDE.md`), „Gedächtnis“ (die Memories direkt in `memory/`, Gruppe Anweisungen); „Developer Vault“ verweist auf „Bibliothek“.
- [x] `AGENTS.md`, Zeile `vault-probe … search`: Ausgabe um ` · <group>/<subgroup>` ergänzen.

## Definition of Done

- AK 1–8 erfüllt; die Belege stehen im Report-Back.
- **Sichtbares Ergebnis:** noch keins in der App; Agenten und Probe sehen in einer Bibliothek nur die Erlaubnisliste, mit Arten und Gruppen.
- **Reviewable Artifact:** `artifacts/phase-1-probe.txt` mit den Aufrufen und Ausgaben zu AK 1–5 (bei AK 1/2 die vollständige `artifacts`-Liste der Bibliothek) und dem Beleg zu AK 6.
- Kommandos: `pnpm bindings`, `pnpm check` (Zusammenfassungszeile), Probe-Aufrufe aus AK 1–5. Probe-Index-Dateien liegen im Scratchpad, nie im Datenordner der App und nie im Master.
- Dateien: Code-Map, Glossar, `AGENTS.md` nachgezogen.
- Sieben Ziele kurz geprüft (Token-Effizienz, Code-Qualität, Umsetzungsgenauigkeit, Stabilität, Wartbarkeit, Sicherheit — Erlaubnisliste statt Ausschlussliste, `memory/_archiv/` und die ausgeschlossene Datei nicht im Index —, Einfachheit).

## Report-Back

### Report-Back (Tests)

- Test-Files: `src-tauri/src/vault/library.rs` (`#[cfg(test)] mod tests`, 27 Tests). Das Modul trägt die Signaturen aus dem Kontrakt als `unimplemented!("Phase 1 Umsetzung")`-Stubs, damit die Tests kompilieren und einzeln rot sind; `VaultLayout` steht schon mit den Derives aus der Checkliste. `pub mod library;` in `vault/mod.rs` eingehängt. Die Umsetzung ersetzt die Stub-Rümpfe, die Tests bleiben unverändert.
- Test-Commit: siehe `git log --oneline -1 -- src-tauri/src/vault/library.rs` auf `feature/bibliothek` (`test(vault): AK-Tests Bibliothek Phase 1 (rot)`).
- AK-Abdeckung (Kontrakt-Tabellen; AK 8 verlangt sie grün):
  - `layout`: `layout_is_library_for_folder_with_skills`, `layout_is_library_for_folder_with_claude_md`, `layout_is_plain_for_folder_without_skills` (Ordner unter `temp_dir()`, per Drop gelöscht); `layout_name_round_trips_and_unknown_is_plain`.
  - `is_included_top` (AK 1, Erlaubnisliste): `plain_includes_every_top_entry`, `library_includes_allowlisted_folders`, `library_includes_allowlisted_files`, `library_allowlist_ignores_case`, `library_excludes_folders_outside_allowlist` (memory, hooks, codex, continue, references, _stylePakete, .claude, knowledge), `library_excludes_files_outside_allowlist` (settings.json, Logs, setup.cmd, SETUP.md, MIGRATION.md, merge-hooks.cjs, .gitignore, .gitattributes, README.md), `library_matches_folders_only_as_folders_and_files_only_as_files`.
  - `skill_folders` (AK 2, ein Artefakt je Skill-Ordner): `library_skill_folders_are_folders_with_skill_md` (genau drei Teile, `skill.md` in beliebiger Schreibweise, nicht tiefer, nicht `_vault`), `plain_has_no_skill_folders`.
  - `apply_place` (AK 2): `apply_place_marks_root_rules`, `apply_place_marks_direct_output_styles`, `apply_place_marks_direct_commands_with_slash_title`, `apply_place_accepts_md_extension_in_any_case` (`commands/review.MD` → `/review`), `apply_place_marks_skill_folders`, `apply_place_leaves_everything_else_unchanged` (inkl. `_vault/CLAUDE.md`, nicht-direkte und nicht-`.md`), `apply_place_does_nothing_in_plain_vault`.
  - `place` (AK 3, 4): `place_puts_root_rules_under_grundregeln`, `place_puts_output_styles_under_ausgabestile`, `place_sorts_skills_by_prefix` (Ordner- und Dateipfade), `place_puts_commands_under_skills_befehle`, `place_puts_knowledge_folder_as_subgroup`, `place_puts_knowledge_root_file_in_main_folder`, `place_in_plain_vault_is_always_wissen_by_first_folder`.
  - Nicht als Unit-Test: AK 1–6 als Probe-Läufe gegen den echten Master, AK 7 (`brief_lines`), Index-Version und Grundgerüst — Belege der Umsetzung nach DoD.
- Lauf-Kommando: `cargo test --manifest-path src-tauri/Cargo.toml vault::library`
- Rot-Beleg: `test result: FAILED. 0 passed; 27 failed; 0 ignored; 0 measured; 25 filtered out` — alle 27 mit `not implemented: Phase 1 Umsetzung`, kein Fehlschlag aus anderem Grund.
- Findings (für spätere Phasen): keine
- Friktion/Lesson: Der erste `cargo test` im frischen Arbeitsbaum kompiliert alles neu (über 10 Minuten) — im Hintergrund starten.
- 🔴 / Offene Punkte: keine. Annahme aus dem Kontrakt: `place` vergleicht Präfixe (`skills/`, `mode-` …) so, wie der Pfad steht; Schreibweise dort nicht getestet.

### Report-Back (Umsetzung)

- Geänderte Files: `src-tauri/src/vault/{library,scan,index,search,mod,model,skeleton,tools}.rs`, `src-tauri/src/commands/vault.rs` (nur Kommentar), `src-tauri/examples/{vault-probe,gen-bindings}.rs`, `src/features/vault/VaultStatusRow.tsx`, `src/lib/bindings/{VaultHit,VaultStatus,VaultLayout}.ts`, `docs/code-map.md`, `docs/glossary.md`, `AGENTS.md`, `artifacts/phase-1-probe.txt`, `FINDINGS.md`.
- Entscheidungen:
  - `place` in einer Bibliothek für Pfade außerhalb der Tabelle (kommen wegen der Erlaubnisliste nicht vor): wie ein reiner Vault, Gruppe `wissen` nach erstem Ordner.
  - Skill-Ordner ohne Manifest: Frontmatter der `SKILL.md` als Manifest, `readme` = `None`; die `SKILL.md` wird in beliebiger Schreibweise gefunden.
  - `scan.rs`: die Datei-Parameter von `sync_file`/`store_loaded` als Struct `FileSync` gebündelt (mit `layout` wären es sieben Parameter geworden).
  - `vault-probe` hat einen Unterbefehl `skeleton <Ordner>` für den Beleg zu AK 6 bekommen (in `AGENTS.md` eingetragen); `search` druckt Kopfzeile und Treffer selbst, über das nun öffentliche `tools::format_hit`.
  - `commands/vault.rs`: keine Vorbedingung ergänzt — dort wurde kein leerer Ordner geprüft; `skeleton::create` prüft das Ziel und liefert den Satz aus `NOT_EMPTY`.
  - Probe-Index-Dateien im Temp-Scratchpad der Session (`%TEMP%\claude\…\scratchpad`), nicht im Verwalter-Scratchpad: die Probe lehnt jeden Pfad mit `.verwalter` ab.
- Abweichungen vom Plan: keine.
- AK-Belege: `artifacts/phase-1-probe.txt` (AK 1–6, Master `git status --short` danach leer). AK 7 am Code: `brief_lines` setzt `under` über `knowledge_under` (`vault/mod.rs`).
- Tests: `cargo test --manifest-path src-tauri/Cargo.toml vault::library` → `test result: ok. 27 passed; 0 failed; 0 ignored; 0 measured; 25 filtered out`. Volle Suite `cargo test -j 2 … --lib --bins --examples` → `test result: ok. 52 passed; 0 failed`; `cargo test -j 1 … --doc` → `test result: ok. 0 passed; 0 failed`. `pnpm check` → Exit 0.
- Findings (für spätere Phasen): zwei Einträge in `FINDINGS.md` (→ Phase 3 Inbox-Status unter `_vault/inbox/`, → Phase 2 Layout-Wechsel ohne Neueinordnung).
- Vorschlag Commits: `git add src-tauri src docs AGENTS.md` → `feat(vault): Bibliothek im Core — Erlaubnisliste, Arten nach Ort, Gruppen je Treffer, Index Version 2`.
- Friktion/Lesson: Ein voller `cargo test` mit Standard-Parallelität bricht auf diesem Rechner mit Windows-Fehler 1455 (Auslagerungsdatei zu klein) beim Bauen der Beispielprogramme ab und hinterlässt kaputte Metadaten; `-j 2` (Doctests `-j 1`) läuft durch.
- Unsicherste Stelle: `library::apply_place`, Fall `skills/<x>` — erkennt den Skill nur an zwei Pfadteilen; eine lose Datei direkt in `skills\` (heute im Master keine) würde als Skill mit falschem Einstieg eingeordnet. Check: Datei `skills\notiz.md` in einem Probe-Ordner anlegen, `vault-probe scan` + `artifacts`.
- 🔴 / Offene Punkte: keine.

## Phase-Gate (Review, Runde 1)

- Tests: `cargo test -j 2 --manifest-path src-tauri/Cargo.toml vault::library` → `test result: ok. 27 passed; 0 failed; 0 ignored; 0 measured; 25 filtered out`; volle Suite `--lib --bins --examples` → `test result: ok. 52 passed; 0 failed`; `pnpm check` → Exit 0. Testmodul seit `e99bac5` unverändert. Master `git status --short` leer.
- Urteil: **FAIL** — Branch und Umsetzung stehen auf dem Kontrakt vor `cdc3192` („Plan Bibliothek liest auch die Memories“, auf `main`, nach dem Abzweig von `feature/bibliothek` bei `fc8c1a7`). Die gültigen AK 1–3 und die Checkliste dieser Phase verlangen die Memories direkt aus `memory/`; das fehlt vollständig.
- Befunde:
  1. CRITICAL Kontrakt: `main` (`cdc3192`) ist nicht im Branch — zuerst `main` in `feature/bibliothek` einholen (Konflikte in `README.md` und dieser Phasen-Datei: Kontrakt/AK/Checkliste aus `main`, Häkchen, Status und Report-Backs aus dem Branch behalten; neue Checklisten-Zeilen offen lassen, bis umgesetzt).
  2. CRITICAL Erlaubnisliste: `src-tauri/src/vault/library.rs:28` `LIBRARY_DIRS` ohne `MEMORY_DIR` (`[&str; 5]` laut Checkliste); `is_included_below` fehlt; `src-tauri/src/vault/scan.rs` `walk` filtert nur Tiefe 1 — Tiefe 2 muss `is_included_below` prüfen, damit `memory/_archiv/` nie betreten wird.
  3. CRITICAL Arten/Gruppen: `library.rs` `apply_place` ohne Zeile `memory/<x>.md` (direkt) → Art `memory`; `place` ohne `memory/…` → `anweisungen/gedaechtnis`.
  4. CRITICAL Tests: `library.rs:318` (`library_excludes_folders_outside_allowlist`) erwartet `memory` als ausgeschlossen — widerspricht dem Kontrakt aus `cdc3192` (Entscheidung des Benutzers, keine Gate-Lockerung): `memory` dort herausnehmen und Tests ergänzen für `is_included_below` (Library: Unterordner von `memory` in beliebiger Schreibweise → `false`, Dateien → `true`, andere Eltern → `true`; Plain → immer `true`), `apply_place` (`memory/x.md` → `memory`, `memory/_archiv/x.md` unverändert) und `place` (`memory/…` → `anweisungen/gedaechtnis`). Erst rot belegen, dann umsetzen.
  5. WARNING Texte/Doku: `src-tauri/src/vault/tools.rs` `SEARCH_DESCRIPTION` ohne „Memories“, `kind`-Beschreibung ohne `memory` (Wortlaut in der Checkliste); `docs/glossary.md` ohne Begriff „Gedächtnis“; Modul-Kommentar `library.rs:5` nennt `memory/` noch als ausgeschlossen.
  6. WARNING Kontrakt „Skill-Ordner“: `library.rs:157` (`[top, name] if skills`) greift auch für eine lose Datei `skills/notiz.md` → Art `skill`, Einstieg `skills/notiz.md/SKILL.md`. Die Regel darf nur Skill-Ordner treffen; eine lose Datei in `skills/` behält ihre Art aus `extract`. Mit Test belegen.
  7. Probe-Belege neu: `artifacts/phase-1-probe.txt` gegen den echten Master nach AK 1–3 aus `cdc3192` — kein Pfad unter `memory/_archiv/`, nicht `memory/feedback_local_login_credentials.md` (per `.vaultignore` ausgeschlossen); `memory/feedback_keine_zaehltests.md · memory` in der Liste; `search "Zählprüfungen"` liefert ihn als `anweisungen/gedaechtnis`. Danach Master `git status --short` leer.
- Doc-Drift: ja — Glossar „Gedächtnis“ fehlt (Befund 5); Code-Map und `AGENTS.md` sonst nachgezogen.
- Friktion/Lesson: Der Plan wurde auf `main` geändert, nachdem der Branch abgezweigt war; Tests und Umsetzung liefen gegen die alte Fassung. Plan-Änderungen während einer laufenden Umsetzung gehören in den Feature-Branch (oder der Branch holt `main` ein), bevor die nächste Station startet.

### Report-Back (Nachbesserung, Runde 1)

- Befund 1: `origin/main` in `feature/bibliothek` eingeholt (Merge-Commit `19bef23`, bringt `cdc3192` und `c063f42`); Konflikt in dieser Datei: Kontrakt/AK/Checkliste aus `main`, Report-Backs aus dem Branch; Checkliste nach der Umsetzung vollständig abgehakt.
- Befund 2: `library.rs` `MEMORY_DIR`, `LIBRARY_DIRS: [&str; 5]`, `is_included_below`; `scan.rs` `walk` prüft Tiefe 1 mit `is_included_top`, Tiefe 2 mit `is_included_below` (Elternname über `entry.path().parent()`), tiefer immer `true`.
- Befund 3: `apply_place` `memory/<x>.md` (direkt) → Art `memory`; `place` `memory/…` → `anweisungen/gedaechtnis`.
- Befund 4: Tests ergänzt (35 statt 27): `memory` aus `library_excludes_folders_outside_allowlist` genommen und in `library_includes_allowlisted_folders` aufgenommen; neu `library_skips_folders_below_memory_in_any_case`, `library_includes_files_below_memory`, `library_includes_everything_below_other_folders`, `plain_includes_everything_below`, `apply_place_marks_direct_memories`, `apply_place_leaves_memory_archive_and_non_markdown_unchanged`, `apply_place_leaves_loose_files_in_skills_unchanged`, `place_puts_memories_under_gedaechtnis`. Rot-Beleg vor der Umsetzung: `test result: FAILED. 27 passed; 8 failed` (die 8 neuen bzw. geänderten, am Stub `unimplemented!` bzw. an den Memory-/Skill-Erwartungen).
- Befund 5: `tools.rs` `SEARCH_DESCRIPTION` mit „Memories“, `kind` mit `memory`; Glossar: Begriff „Gedächtnis“, Erlaubnisliste unter „Bibliothek“ um `memory` ergänzt; Modul-Kommentar `library.rs` nennt nur noch `memory/_archiv/` als ausgeschlossen.
- Befund 6: Skill-Regel in `apply_place` nur für Namen ohne Endung (`is_folder_name`); `skills/notiz.md` behält die Art aus `extract` (Test oben).
- Befund 7: `artifacts/phase-1-probe.txt` neu gegen den echten Master gemessen (AK 1–5; AK 6 aus #16, `skeleton.rs` unverändert): 294 Dateien, 21 Memories mit Art `memory`, kein Pfad unter `memory/_archiv/`, `memory/feedback_local_login_credentials.md` fehlt (per `.vaultignore`), `search "Zählprüfungen"` → `memory/feedback_keine_zaehltests.md · anweisungen/gedaechtnis`; Master `git status --short` danach leer.
- Entscheidungen: Skill-Ordner erkennt `apply_place` am Namen ohne Endung — die Signatur aus dem Kontrakt kennt nicht, ob der Pfad ein Ordner ist; ein Skill-Ordner mit Punkt im Namen bekäme dadurch nicht Art `skill` (heute im Master keiner).
- Abweichungen vom Plan: keine.
- Tests: `cargo test -j 2 --manifest-path src-tauri/Cargo.toml vault::library` → `test result: ok. 35 passed; 0 failed; 0 ignored; 0 measured; 25 filtered out`; volle Suite `--lib --bins --examples` → `test result: ok. 60 passed; 0 failed`; `pnpm check` → Exit 0.
- Vorschlag Commits: `git add src-tauri src docs AGENTS.md STATE.md` → `feat(vault): Bibliothek im Core — Erlaubnisliste mit Memories, Arten nach Ort, Gruppen je Treffer, Index Version 2`.
- Friktion/Lesson: keine neue (siehe Review: Plan-Änderung auf `main` während laufender Umsetzung).
- Unsicherste Stelle: `scan.rs` `walk`, Tiefe 2 — der Filter gilt für jeden Elternordner namens `memory` der ersten Ebene, also nur in der Bibliothek. Check: Probe-Ausgabe oben, keine Zeile `memory/_archiv/`.
- 🔴 / Offene Punkte: keine.

## Phase-Gate (Review, Runde 2)

- Tests: `cargo test -j 2 --manifest-path src-tauri/Cargo.toml vault::library` → `test result: ok. 35 passed; 0 failed; 0 ignored; 0 measured; 25 filtered out`; volle Suite `--lib --bins --examples` → `test result: ok. 60 passed; 0 failed`; `pnpm check` → Exit 0. Teständerungen seit `e99bac5` nur nach Befund 4 (Kontrakt `cdc3192`), keine Assertion gelockert.
- Urteil: **PASS** — AK 1–8 selbst nachgemessen. Probe gegen den echten Master: 294 Dateien, kein Pfad unter `memory/_archiv/` (dort 9 Einträge), `hooks/`, `codex/`, `continue/`, `references/`, `_stylePakete/`, keine der verbotenen Wurzeldateien, `memory/feedback_local_login_credentials.md` (vorhanden, per `.vaultignore`) fehlt; Pflichtzeilen aus AK 2 alle da, `skills/mode-planning/WORK.md` kein eigenes Artefakt; Suchen „Planung“/„Zählprüfungen“/„Inbox“ mit den Gruppen aus AK 3; reiner Vault `_vault` 22 Dateien, alles `wissen/<ordner>`; `schema_version` 1 → Neuaufbau (22 gelesen, danach 2); Grundgerüst in vier Probe-Ordnern wie AK 6; `vault_get` liest nur Index-Zeilen (`resolve.rs:46`), Ausgeschlossenes endet mit „Nicht im Vault-Index“. Randfall-Ordner (Unterordner von `memory`, `hooks/`, `settings.json`, `.vaultignore`-Memory) ebenfalls nicht im Index. Master `git status --short` danach leer.
- Befunde: 1 NIT — `library.rs:167` erkennt Skill-Ordner am Namen ohne Endung; eine lose Datei ohne Endung direkt in `skills\` (Probe: `skills/LICENSE`) wird Art `skill` mit Einstieg `skills/LICENSE/SKILL.md`. Im Master liegt keine lose Datei in `skills\`; kein AK betroffen. Als Finding notiert.
- Doc-Drift: nein — Code-Map, Glossar (inkl. „Gedächtnis“), `AGENTS.md` nachgezogen.
- Friktion/Lesson: Umlaute in Argumenten einer `.cmd`-Datei kommen in der falschen Codepage an (Suche „Zählprüfungen“ lieferte 69 statt 1 Treffer) — Probe-Suchen mit Umlauten direkt aus der Shell aufrufen.
