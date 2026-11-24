# Phase 2 — Ein Ordner in den Einstellungen

**Stufe:** standard · **Wave:** 2 · **Sichtabnahme:** Einstellungen › Skills & Umgebung, Abschnitt „Bibliothek“

Die Einstellungen `master_dir` und `vault_dir` werden eine: `library_dir`. Abgleich (ADR 038) und Suche (ADR 068) lesen denselben Ordner. Die Abschnitte „Umgebung“ und „Developer Vault“ werden ein Abschnitt „Bibliothek“ nach dem abgenommenen Entwurf.

## Kontext (vor dem Start lesen)

- Plan-README: „Kontrakt“ (Abschnitte Einstellung, Status, Grundgerüst).
- [ADR 069](../../decisions/069-bibliothek.md), [ADR 038](../../decisions/038-umgebung.md).
- Entwurf: [artifacts/README.md](artifacts/README.md) → Einstellungen; Quelle `docs/archive/2026-11/2026-11-22_developer-vault/artifacts/vault-suchdialog.html`, Entwurfsleiste „Ausbau: Bibliothek“, Ansicht Einstellungen (Funktion, die `settings__section` „Bibliothek“ rendert).
- Core: `src-tauri/src/settings/model.rs` (`Settings`, `SettingsChange`), `settings/mod.rs` (`KEY_*`, `DEFAULT_SETTINGS`, `load`, `update`), `src-tauri/src/commands/settings.rs` (`settings_update`, `changes_vault`), `src-tauri/src/environment/mod.rs` (`status`, `run_mirror`), `environment/model.rs` (`EnvironmentStatus`), `src-tauri/src/vault/mod.rs` (`folder_status`).
- Oberfläche: `src/features/settings/settingsCatalog.ts` (Einträge `environmentLinks`, `masterDir`, `environmentMirror`, `vaultDir`, `vaultEnabled`, `vaultStatus`; Kategorie `skills`; `hasMasterDir`, `hasVaultDir`, `isVaultOn`), `src/features/settings/SettingsView.tsx` (`renderRow`, Fälle dieser Ids), `src/features/environment/MasterDirRow.tsx`, `EnvironmentMirrorRow.tsx`, `EnvironmentLinksRow.tsx`, `useEnvironment.ts`, `src/features/vault/VaultDirRow.tsx`, `VaultStatusRow.tsx`, `vaultTexts.ts`, `src/lib/settings.ts`.
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`, `docs/code-map.md`, `docs/glossary.md`.
- Fehlerklassen geprüft (`sprachen/typescript`, `frameworks/react`): keine einschlägig.

## Abnahmekriterien der Phase

1. Kategorie „Skills & Umgebung“ zeigt die Abschnitte „Skills“ und „Bibliothek“; die Kurzbeschreibung der Kategorie in der Leiste lautet „Skills · Bibliothek“. Abschnitte „Umgebung“ und „Developer Vault“ gibt es nicht mehr.
2. Abschnitt „Bibliothek“, Zeilen in dieser Reihenfolge: „Ordner“ (immer) · „Abgleich der Skills“ (nur mit Ordner) · „Verknüpfungen“ (immer) · „Suche“ (nur mit Ordner) · „Suchindex“ (nur mit Ordner und eingeschalteter Suche) · „Durchsucht“ (nur mit Ordner und eingeschalteter Suche). Jede Zeile hat ihr ⓘ mit dem Text aus der Checkliste.
3. „Ordner“ ohne Wert: „Kein Ordner“ + Knopf „Wählen …“; mit Wert: Pfad in Festbreitenschrift + „Ändern …“ + „Entfernen“. Nach dem Speichern laufen Prüfung der Umgebung und Abgleich der Suche ohne weiteren Klick.
4. Nach dem Update zeigt „Ordner“ auf diesem Rechner `G:\Meine Ablage\U104_Agents` (Übernahme aus `master_dir`), ohne dass gespeichert wurde.
5. Mit einem Ordner ohne `skills`, `commands`, `output-styles` und `CLAUDE.md` zeigt „Abgleich der Skills“: „Kein Abgleich. Im Ordner liegen weder skills, commands, output-styles noch CLAUDE.md.“; die Suche funktioniert.
6. „Durchsucht“ zeigt bei einer Bibliothek `CLAUDE.md · AGENTS.md · skills/ · commands/ · output-styles/ · memory/ · _vault/`, bei einem reinen Vault „der ganze Ordner“.
7. „Grundgerüst anlegen“ erscheint im „Suchindex“, wenn `canCreateSkeleton` gilt; Klick schreibt bei einer Bibliothek nach `_vault\`.
8. Nach „Entfernen“ bleibt der Ordner auch nach einem Neustart leer (keine Rückkehr über `master_dir`/`vault_dir`).
9. Der Index der eingestellten Bibliothek enthält nichts unter `memory/_archiv/` und nicht `memory/feedback_local_login_credentials.md` (Beleg: `vault_search` mit `under: "memory/_archiv"` liefert 0 Treffer; `vault_get` auf `memory/feedback_local_login_credentials.md` und auf `hooks/post-edit.sh` liefert je den Fehlersatz; `vault_get` auf `memory/MEMORY.md` liefert die Datei).
10. `pnpm check` grün; der Test aus README → „Tests“ (Phase 2) läuft grün; `git -C "G:\Meine Ablage\U104_Agents" status --short` leer.

## Checkliste

### Core

- [ ] `settings/model.rs`: Felder `master_dir`, `vault_dir` entfernen; `pub library_dir: Option<String>` mit Doc-Kommentar „Ordner der Bibliothek: Anweisungen, Skills, Befehle, Ausgabestile und Wissen (ADR 069); `None`, solange keiner gewählt ist.“; `SettingsChange::MasterDir`, `SettingsChange::VaultDir` entfernen, `LibraryDir { value: Option<String> }` mit Doc-Kommentar „`None` oder ein leerer Text entfernt den Ordner der Bibliothek.“
- [ ] `settings/mod.rs`: `const KEY_LIBRARY_DIR: &str = "library_dir";` `KEY_MASTER_DIR` und `KEY_VAULT_DIR` bleiben (nur noch für die Übernahme). `DEFAULT_SETTINGS.library_dir: None`. Die Übernahme ist eine reine Funktion `fn library_dir_from(stored: &HashMap<String, String>) -> Option<String>`, die `load` aufruft (Test: README → „Tests“): `library_dir` = wenn `stored.contains_key(KEY_LIBRARY_DIR)`, dessen getrimmter Wert (leer → `None`); sonst getrimmter `master_dir`, sonst getrimmter `vault_dir` (leer → `None`). In `update` für `LibraryDir`: `library_dir` schreiben (getrimmt oder `""`), dazu `master_dir` und `vault_dir` mit `""` — in derselben Transaktion.
- [ ] `commands/settings.rs`: `changes_vault` trifft `LibraryDir { .. } | VaultEnabled { .. }`.
- [ ] `environment/mod.rs` `status` und `run_mirror`: `settings::load(database)?.library_dir`. `EnvironmentStatus.master_dir` und `master_error` behalten Namen und Bedeutung (der Ordner, mit dem abgeglichen wird); Doc-Kommentar in `environment/model.rs` auf „Ordner der Bibliothek“.
- [ ] `vault/mod.rs` `folder_status`: `loaded.library_dir` statt `loaded.vault_dir`.
- [ ] `pnpm bindings`.

### Oberfläche

- [ ] Neue Datei `src/features/vault/LibraryDirRow.tsx` aus `VaultDirRow.tsx` (Aufbau, Ordnerwahl, Entfernen) und `MasterDirRow.tsx` (nach dem Speichern `check()` aus `useEnvironment`); Props `libraryDir: string | null`, `onSave`; `SettingRow id="libraryDir"`; Titel des Auswahldialogs „Ordner der Bibliothek wählen“; leerer Wert „Kein Ordner“. Zeigt **keinen** `masterError` (ein reiner Vault ist gültig). `MasterDirRow.tsx` und `VaultDirRow.tsx` löschen.
- [ ] `settingsCatalog.ts`: Einträge `masterDir` und `vaultDir` entfernen; neuer Eintrag `libraryDir` vor `environmentMirror`; Reihenfolge der Schlüssel im Objekt = Reihenfolge der Zeilen aus AK 2. Alle sechs mit `section: 'Bibliothek'`. Kategorie-`summary` `'Skills · Bibliothek'`. Hilfsfunktionen: `hasLibraryDir` (`settings.libraryDir !== null`), `isSearchOn` (`libraryDir !== null && vaultEnabled`); `hasMasterDir`, `hasVaultDir`, `isVaultOn` entfernen. Labels und ⓘ-Texte:
  - `libraryDir` · „Ordner“ · „Ein Ordner für Anweisungen, Skills und Wissen, z. B. auf einem synchronisierten Laufwerk. Enthält er skills, commands, output-styles oder CLAUDE.md, gleicht der Verwalter diese mit ~\.claude ab und sucht im Wissen unter _vault. Sonst ist der ganze Ordner Wissen. Der Verwalter liest ihn nur; der Suchindex liegt lokal in seinem Datenordner.“
  - `environmentMirror` · „Abgleich der Skills“ · bisheriger Text, „Master-Ordner“ → „Ordner der Bibliothek“ · `isShown: hasLibraryDir`
  - `environmentLinks` · „Verknüpfungen“ · bisheriger Text · immer sichtbar
  - `vaultEnabled` · „Suche“ · „Schaltet Einlesen, Suche und die Werkzeuge der Agenten ein. Aus: der Verwalter liest den Ordner nicht für die Suche, die Agenten sehen keine Werkzeuge der Bibliothek. Der Abgleich der Skills läuft unabhängig davon.“ · `isShown: hasLibraryDir`
  - `vaultStatus` · „Suchindex“ · bisheriger Text, letzter Satz: „„Grundgerüst anlegen“ schreibt README.md, AGENTS.md und inbox/ nach _vault (bzw. in einen leeren Ordner ohne Skills).“ · `isShown: isSearchOn`
  - `libraryScope` (neu) · „Durchsucht“ · „Nur diese Teile liest der Verwalter für die Suche; aus memory/ nur die Dateien direkt darin. hooks/, Logs, settings.json und alles Übrige im Ordner bleiben draußen, ebenso Dateien mit führendem Punkt und Einträge aus .gitignore oder .vaultignore.“ · `isShown: isSearchOn`
- [ ] `SettingsView.tsx` `renderRow`: Fälle `masterDir`/`vaultDir` entfernen; `libraryDir` → `<LibraryDirRow libraryDir={current.libraryDir} onSave={(value) => save({ kind: 'libraryDir', value })} />`; `vaultEnabled` behält den `Switch`, `label="Suche"`; `libraryScope` → neue Komponente `src/features/vault/LibraryScopeRow.tsx` (`SettingRow id="libraryScope"`, liest `useVaultStatus`, zeigt bei `status.layout === 'library'` den Text aus AK 6, bei `'plain'` „der ganze Ordner“, ohne Layout nichts).
- [ ] `EnvironmentMirrorRow.tsx`: bei `status.masterError !== null` den Text `Kein Abgleich. ${status.masterError}` statt „Kein Abgleich, solange der Master-Ordner ungültig ist.“
- [ ] Schalter „Suche“: rechts neben dem `Switch` (der keinen eigenen Begleittext kennt) ein `<span className="vault-row__muted">` mit dem Text aus dem Entwurf — an: „an · Suche in der Seitenleiste und Ctrl K“, aus: „aus · kein Einstieg, Ctrl K ohne Wirkung“; `SettingsView.tsx` importiert dafür `@/features/vault/VaultRows.css`, falls noch nicht geschehen. `LibraryScopeRow` nutzt `vault-row__mono` für die Liste und `vault-row__text` für „der ganze Ordner“.
- [ ] Texte mit „Master-Ordner“ oder „Developer Vault“ in `src/features/environment/`, `src/features/vault/vaultTexts.ts` und `src/features/settings/` auf „Ordner der Bibliothek“ bzw. „Bibliothek“ (Grep nach beiden Begriffen, jeder Treffer entschieden; Treffer im Suchdialog und in `Sidebar.tsx` gehören zu Phase 3 und bleiben).

### Doku

- [ ] `docs/code-map.md`: Zeilen „Umgebung“ und „Developer Vault“ zu einer Zeile „Bibliothek“ zusammenführen (Abgleich `environment/`, Suche `vault/`, Einstellung `library_dir`, neue Komponenten `LibraryDirRow`, `LibraryScopeRow`); Zeile „Einstellungen“: `master_dir` → `library_dir`.
- [ ] `docs/glossary.md`: „Master-Ordner“ → verweist auf „Bibliothek“.
- [ ] `docs/decisions/038-umgebung.md`: Statuszeile „angenommen · teilweise abgelöst durch ADR 069 (Ordner = Bibliothek)“.

## Definition of Done

- AK 1–10 erfüllt; Belege im Report-Back.
- **Sichtbares Ergebnis:** Der Benutzer öffnet Einstellungen › Skills & Umgebung und sieht einen Abschnitt „Bibliothek“ mit seinem Master-Ordner, Abgleich, Verknüpfungen, Suche, Suchindex und „Durchsucht“.
- **Reviewable Artifact:** `artifacts/phase-2-bibliothek-hell.png` und `artifacts/phase-2-bibliothek-dunkel.png` (Abschnitt mit Ordner und eingeschalteter Suche), `artifacts/phase-2-ohne-ordner.png`; dazu im Report-Back die Antworten der Aufrufe aus AK 9 aus einer echten Session oder per `mcp-probe call`.
- Kommandos: `pnpm bindings`, `pnpm check` (Zusammenfassungszeile), `pnpm tauri dev` für die Bilder.
- Dateien: Code-Map, Glossar, ADR 038 nachgezogen.
- Sieben Ziele kurz geprüft.

## Report-Back

### Tests

## Report-Back (Tests)
- Test-Files: `src-tauri/src/settings/mod.rs` (Modul `library_dir_tests`, 11 Tests; dazu Stub `library_dir_from` mit `unimplemented!` und `KEY_LIBRARY_DIR`, beide `#[allow(dead_code)]` — die Umsetzung ersetzt den Stub und entfernt die Attribute)
- Test-Commit: siehe `git log` (Betreff „test(settings): Übernahme library_dir_from Phase 2 (rot)")
- AK-Abdeckung (Übernahme, AK 4 und 8): nur `master_dir` · nur `vault_dir` · beide (master gewinnt) · leerer `master_dir` fällt auf `vault_dir` · leerer `library_dir` neben `master_dir` → `None` · leerer `library_dir` neben beiden → `None` · gesetzter `library_dir` geht vor · Trimmen von `library_dir` und übernommenem `master_dir` · nichts gesetzt → `None` · nach „Entfernen“ (alle drei leer) → `None`
- Lauf-Kommando: `cargo test --manifest-path src-tauri/Cargo.toml library_dir_tests`
- Rot-Beleg: „test result: FAILED. 0 passed; 11 failed" — alle am `unimplemented!`
- Nicht per Test abgedeckt (Kontrakt: nur die reine Funktion): das Schreiben in `update` (master/vault leer in derselben Transaktion) und die Oberfläche — Belege per Probe und Bild in der Umsetzung.
- Findings (für spätere Phasen): keine
- Friktion/Lesson: Backslashes in Bash-Heredocs für Rust-Strings gehen verloren — Datei per Edit prüfen.
- 🔴 / Offene Punkte: keine
