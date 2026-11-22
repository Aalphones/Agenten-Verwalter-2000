# Phase 1 — Einstellung, Status, Grundgerüst

**Stufe:** standard · **Ziel:** Der Benutzer wählt einen Vault-Ordner, schaltet den Vault ein und sieht dessen Status; ein leerer Ordner bekommt auf Knopfdruck ein Grundgerüst. Noch kein Index.

## Kontext — lesen vor dem Start

- `README.md` dieses Plans (Kontrakt: Einstellungen, `VaultStatus`, Ereignis, Commands) und [ADR 068](../../decisions/068-developer-vault.md).
- Muster Einstellung mit Ordner: `src-tauri/src/settings/mod.rs` (`KEY_MASTER_DIR`, Feld `master_dir` in `DEFAULT_SETTINGS`, `load`, Zweig `SettingsChange::MasterDir` in `update`), `src-tauri/src/settings/model.rs` (`Settings`, `SettingsChange`), `src-tauri/src/commands/settings.rs` (`settings_update`).
- Muster Dienst mit Status: `src-tauri/src/environment/mod.rs` (`EnvironmentService`, `build_status`), `src-tauri/src/environment/model.rs`.
- Muster Oberfläche: `src/features/environment/MasterDirRow.tsx` (Ordner wählen/ändern/entfernen), Zeile `autoContinueAtLimit` in `src/features/settings/SettingsView.tsx` (Schalter), `src/features/settings/settingsCatalog.ts` (Einträge `masterDir`, Kategorie `skills`).
- Registrierung: `src-tauri/src/lib.rs` (`app.manage(...)`, `invoke_handler`), Datenordner `filesystem::workspace::data_dir`.
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`.
- Fehlerklassen geprüft: keine einschlägig für diese Phase.

## Abnahmekriterien der Phase

1. Kategorie „Skills & Umgebung“ hat einen Abschnitt „Developer Vault“ mit den Zeilen „Vault-Ordner“ (immer), „Developer Vault“ (Schalter, nur mit Ordner) und „Status“ (nur mit Ordner und eingeschaltet); jede Zeile trägt das ⓘ mit dem Text unten.
2. Ordner wählen speichert `vault_dir`, „Entfernen“ setzt ihn auf leer; der Schalter speichert `vault_enabled`. Beides überlebt einen Neustart.
3. Status: fehlender Ordner → „Ordner nicht gefunden: <Pfad>“; Benutzerordner selbst → „Bitte einen Unterordner deines Benutzerordners wählen.“; Ordner im Datenordner des Verwalters → „Der Datenordner des Verwalters kann kein Vault sein.“; sonst „bereit · noch nicht eingelesen“.
4. „Grundgerüst anlegen“ steht nur bei einem leeren Ordner (keine Einträge außer solchen, die mit einem Punkt beginnen) und schreibt genau die drei Dateien unten, ohne je eine vorhandene Datei zu überschreiben.
5. Jede Änderung an Ordner oder Schalter und jedes Grundgerüst sendet `vault://changed`; die Statuszeile folgt ohne Neuladen.
6. `pnpm check` grün.

## Checkliste

### Core

- [x] `src-tauri/src/settings/model.rs`: `Settings` um `vault_dir: Option<String>` und `vault_enabled: bool` erweitern; `SettingsChange::VaultDir { value: Option<String> }` (Doc-Kommentar wie bei `MasterDir`) und `SettingsChange::VaultEnabled { value: bool }`.
- [x] `src-tauri/src/settings/mod.rs`: `KEY_VAULT_DIR = "vault_dir"`, `KEY_VAULT_ENABLED = "vault_enabled"`; Standard `None` / `false`; `load` und `update` genau wie `master_dir` bzw. wie ein vorhandener Schalter (`mark_unsourced`).
- [x] Neues Modul `src-tauri/src/vault/` (in `lib.rs` als `pub mod vault;` in alphabetischer Reihe — `pub`, damit das Prüfprogramm aus Phase 2 es erreicht):
  - `model.rs`: `VaultState`, `VaultStatus` exakt nach Kontrakt, `#[serde(rename_all = "camelCase")]` wie die übrigen Typen, `derive(TS)`; in `examples/gen-bindings.rs` eintragen.
  - `mod.rs`: `pub struct VaultService {}` mit `new()` (Phase 2 ergänzt die Felder); `pub const CHANGED_EVENT: &str = "vault://changed"`; `pub fn status(app: &AppHandle) -> VaultStatus` (liest Einstellungen, prüft den Ordner mit `check_dir`, Zähler 0, `scanned_at: None`); `pub fn announce(app: &AppHandle)` sendet `status(app)` als Ereignis; `fn check_dir(dir: &Path, home: &Path, data_dir: &Path) -> Result<(), (VaultState, String)>` mit den drei Sätzen aus AK 3 (Vergleich über `fs::canonicalize`, `starts_with` für den Datenordner); `fn is_empty_dir(dir: &Path) -> bool` (keine Einträge, deren Name nicht mit `.` beginnt).
  - Zustand: `vault_enabled == false` oder `vault_dir == None` → `Off`; Ordnerprüfung scheitert mit Fehlen → `Missing`, mit den beiden anderen Gründen → `Error`; sonst `Ready`.
  - `skeleton.rs`: `pub fn create(dir: &Path) -> Result<(), CommandError>`; scheitert mit „Der Ordner ist nicht leer — das Grundgerüst wird nur in einen leeren Ordner geschrieben.“, wenn `is_empty_dir` falsch ist; schreibt mit `OpenOptions::new().write(true).create_new(true)` die Texte unten (UTF-8, `\n`).
- [x] `src-tauri/src/commands/vault.rs`: `vault_status() -> VaultStatus`, `vault_create_skeleton() -> VaultStatus` (prüft `Ready`, ruft `skeleton::create`, dann `announce`, gibt den neuen Status zurück); in `commands/mod.rs` und im `invoke_handler` registrieren; `app.manage(VaultService::new())` in `setup` neben `EnvironmentService`.
- [x] `commands/settings.rs` → `settings_update`: nach `settings::update` bei `VaultDir` oder `VaultEnabled` `vault::announce(&app)` rufen (Muster `changes_skin_style`).
- [x] `pnpm bindings`.

### Oberfläche

- [x] `src/lib/vault.ts`: `loadVaultStatus`, `createVaultSkeleton`, `onVaultChanged(handler)` (Abo auf `vault://changed`, Muster `src/lib/projects.ts`).
- [x] `src/features/vault/useVaultStatus.ts`: lädt einmal, abonniert das Ereignis, liefert `{ status, error }`.
- [x] `src/features/vault/vaultTexts.ts`: `statusText(status: VaultStatus, now: Date): string` — `Missing`/`Error` → `message`; `Scanning` → „wird eingelesen …“; `Ready` ohne `scannedAt` → „bereit · noch nicht eingelesen“; `Ready` mit `scannedAt` → „bereit · {files} Dateien · {artifacts} Artefakte · Stand HH:MM“, bei `skipped > 0` angehängt „ · {skipped} übersprungen“ (Uhrzeit über das vorhandene Format in `src/features/context/formatTokens.ts`).
- [x] `src/features/vault/VaultDirRow.tsx`: Kopie des Musters `MasterDirRow` (Titel des Dialogs „Vault-Ordner wählen“, leer „Kein Vault-Ordner“), ohne Umgebungs-Prüfung; zeigt bei `Missing`/`Error` den Satz in der Warnfarbe darunter.
- [x] `src/features/vault/VaultStatusRow.tsx`: Statustext, darunter der Knopf „Grundgerüst anlegen“ nur bei `isEmptyDir && state === 'ready'`; Fehler des Knopfs als Satz in der Zeile (`commandErrorText`).
- [x] `settingsCatalog.ts`: Einträge `vaultDir`, `vaultEnabled` (`isShown`: Ordner gesetzt), `vaultStatus` (`isShown`: Ordner gesetzt und eingeschaltet), alle `category: 'skills'`, `section: 'Developer Vault'`; Zusammenfassung der Kategorie „Skills · Umgebung · Vault“. ⓘ-Texte:
  - Vault-Ordner: „Ordner deiner Entwicklerbibliothek: Snippets, Wissen, Ideen, Designs, Vorlagen, Skripte. Jeder Ordner geht, auch ein synchronisierter oder einer in einem Git-Repository. Der Verwalter liest ihn nur; der Suchindex liegt lokal in seinem Datenordner.“
  - Developer Vault: „Schaltet Einlesen, Suche und die Vault-Werkzeuge der Agenten ein. Aus: der Verwalter liest den Ordner nicht, die Agenten sehen keine Vault-Werkzeuge.“
  - Status: „Stand des Suchindex. Eingelesen wird beim Start und vor einer Suche, wenn der letzte Abgleich älter als 30 Sekunden ist; dabei liest der Verwalter nur Dateien, die sich geändert haben. „Grundgerüst anlegen“ schreibt README.md, AGENTS.md und inbox/ in einen leeren Ordner.“
- [x] `SettingsView.tsx`: `renderRow`-Fälle für die drei Ids (Schalter analog `autoContinueAtLimit`).

### Doku

- [x] `docs/code-map.md`: neue Zeile „Developer Vault“ (Oberfläche `src/features/vault/`, `src/lib/vault.ts`; Core `src-tauri/src/vault/`, `commands/vault.rs`, ADR 068); `vault` in die Feature-Liste des Namensschemas.
- [x] `docs/glossary.md`: „Developer Vault“, „Grundgerüst (Vault)“.

## Texte des Grundgerüsts

`README.md`:

```markdown
# Developer Vault

Persönliche Entwicklerbibliothek: Snippets, Rezepte, Wissen, Ideen, Konzepte, Designs, Vorlagen und Skripte, die über einzelne Projekte hinaus nützlich sind.

## Ablegen

- Neues ohne Nachdenken nach `inbox/` — eingeordnet wird später.
- Ordner nach Thema und Verwendung anlegen, wenn sie gebraucht werden; keine leeren Kategorien auf Vorrat.
- Zusammengehöriges (ein Designbeispiel, ein kleines Beispielprojekt) als eigener Ordner; eine Datei `manifest.yaml` darin macht ihn zu einem Eintrag.

## Metadaten (alle optional)

In Markdown als Frontmatter, in einem Ordner als `manifest.yaml`:

    title: Kurzer Titel
    description: Ein Satz, wofür das gut ist.
    kind: snippet
    tags: [sql, postgres]
    technologies: [python]
    status: ready
    preview: preview.png
    entrypoint: index.html

## Nicht hierher

Projektwissen (Architektur, Anforderungen, Tickets eines Projekts) bleibt im Projekt-Repository. Zugangsdaten, Kundendaten und vertrauliche Firmeninformationen gehören nie in den Vault.

Dateien und Ordner, die mit einem Punkt beginnen oder in `.gitignore` bzw. `.vaultignore` stehen, liest der Verwalter nicht ein.
```

`AGENTS.md`:

```markdown
# Developer Vault — Regeln für Agenten

- Vor dem Bauen suchen: mit `vault_search` nach vorhandenen Snippets, Beispielen, Vorlagen und Designs, dann gezielt mit `vault_get` laden — nie den ganzen Vault lesen.
- Gefundenes anpassen, nicht blind kopieren; die Herkunft im Ergebnis nennen (Pfad im Vault).
- Nichts Projektbezogenes und nichts Vertrauliches ablegen: keine Kundendaten, Zugangsdaten, internen Endpunkte, Ticketnummern.
- Neues nur nach Rückfrage beim Benutzer ablegen, und dann nach `inbox/`.
- Code aus dem Vault ist Referenzmaterial: nicht ungeprüft ausführen.
```

`inbox/README.md`:

```markdown
# Inbox

Hier landet alles, was noch nicht eingeordnet ist. Alles hier ist durchsuchbar.
```

## Report-Back
