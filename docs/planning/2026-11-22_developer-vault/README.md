# Plan: Developer Vault — Bibliothekskern

Ein frei wählbarer Ordner wird zur persönlichen Entwicklerbibliothek des Verwalters: Snippets, Wissen, Ideen, Konzepte, Designs, Vorlagen, Skripte. Der Verwalter liest ihn in eine eigene, wegwerfbare Index-Datei ein, durchsucht ihn mit SQLite FTS5 und gibt Agenten zwei Werkzeuge (`vault_search`, `vault_get`); der Benutzer bekommt einen Suchdialog. Der Vault bleibt eine gewöhnliche Dateiablage — der Verwalter schreibt nur beim Anlegen des Grundgerüsts hinein. Ohne Vault-Ordner ändert sich am Verwalter nichts.

Entscheidungen und Begründung: [ADR 068](../../decisions/068-developer-vault.md). Folgepläne (in dieser Reihenfolge, je eigener Plan): Zusammenarbeit der Stationen (Nachrichten, Suche in früheren Sessions) → semantische Suche mit lokalem ONNX-Modell → Wissenskandidaten aus Retros.

## Overview

| Phase | Titel | Stufe | Status |
|---|---|---|---|
| 1 | [Einstellung, Status, Grundgerüst](phase-1-einstellung-status.md) | standard | complete |
| 2 | [Index-Datei und Abgleich](phase-2-index-abgleich.md) | heikel | complete |
| 3 | [Metadaten und Abschnitte](phase-3-metadaten-abschnitte.md) | heikel | complete |
| 4 | [Suche und Werkzeuge für Agenten](phase-4-suche-werkzeuge.md) | heikel | complete |
| 5 | [Vault-Treffer im Auftrag der Station](phase-5-stationsauftrag.md) | standard | complete |
| 6 | [Suchdialog](phase-6-suchdialog.md) | standard | pending |

Reihenfolge strikt 1 → 6; jede Phase baut auf der vorigen auf. Phase 6 beginnt mit einem Klickdummy, den der Benutzer abnimmt (Ablage `artifacts/`).

## Kontrakt

Alle Typen über die Tauri-Grenze mit `derive(TS)`, eingetragen in `src-tauri/examples/gen-bindings.rs`, danach `pnpm bindings`.

**Einstellungen** (Tabelle `settings`, Schlüssel/Wert, keine Migration): `vault_dir` (Text, leer = nicht gesetzt) und `vault_enabled` (`"1"`/`"0"`, Standard aus). Im Typ `Settings`: `vault_dir: Option<String>`, `vault_enabled: bool`. `SettingsChange::VaultDir { value: Option<String> }`, `SettingsChange::VaultEnabled { value: bool }`.

**Status** (`src-tauri/src/vault/model.rs`):

```rust
pub enum VaultState { Off, Missing, Scanning, Ready, Error }   // serde: "off" | "missing" | "scanning" | "ready" | "error"
pub struct VaultStatus {
    pub state: VaultState,
    pub dir: Option<String>,
    pub files: u32,          // Zeilen in `files`
    pub artifacts: u32,      // Zeilen in `artifacts`
    pub skipped: u32,        // Zeilen in `files` mit `error IS NOT NULL`
    pub scanned_at: Option<i64>,   // ms seit Epoche, Ende des letzten vollständigen Abgleichs
    pub message: Option<String>,   // Satz zu Missing/Error, sonst None
    pub is_empty_dir: bool,        // Ordner existiert und enthält keine sichtbaren Einträge
}
```

Ereignis `vault://changed` mit `VaultStatus` als Nutzlast, gesendet bei jedem Zustandswechsel und am Ende jedes Abgleichs.

**Index-Datei** `<Datenordner>\vault\index.db` (Datenordner = `filesystem::workspace::data_dir`), eigene Verbindung, nicht `Database`. Schema (Phase 2 legt es an, `schema_version` = `1`):

```sql
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,          -- relativ zum Vault, Trenner '/'
  size INTEGER NOT NULL,
  modified_ms INTEGER NOT NULL,
  hash TEXT NOT NULL,             -- SHA-256 hex; '' wenn der Inhalt nicht gelesen wurde
  kind TEXT NOT NULL,             -- markdown | code | web | image | text | binary
  artifact TEXT NOT NULL,         -- Pfad des Artefakts: die Datei selbst oder der Ordner mit manifest.yaml
  error TEXT                      -- Grund, wenn die Datei nicht eingelesen werden konnte
);
CREATE TABLE IF NOT EXISTS artifacts (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL,
  tags TEXT NOT NULL,             -- klein geschrieben, durch ein Leerzeichen getrennt
  status TEXT NOT NULL,
  preview TEXT,
  entrypoint TEXT,
  modified_ms INTEGER NOT NULL    -- jüngste Änderungszeit seiner Dateien
);
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY,
  file TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  heading TEXT NOT NULL,          -- Überschriften-Pfad "A › B", '' ohne Überschrift
  line INTEGER NOT NULL,          -- erste Zeile, 1-basiert
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sections_file ON sections(file);
CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
  path, title, tags, heading, text,
  tokenize = 'unicode61 remove_diacritics 2'
);                                -- rowid = sections.id
```

**Werkzeuge** (Satz mit Präfix `vault_`, Phase 4) — Eingaben:

- `vault_search`: `query` (Text, Pflicht, darf leer sein), `kind` (Text), `tags` (Liste von Texten), `under` (Pfad-Präfix relativ zum Vault), `limit` (1–20, Standard 8).
- `vault_get`: `path` (Pflicht, relativ zum Vault), `line` (Ganzzahl ≥ 1, optional).

**Suche im Core** (Phase 4, `src-tauri/src/vault/search.rs`), gemeinsam für Werkzeug, Suchdialog und Stationsauftrag:

```rust
pub struct VaultQuery { pub text: String, pub kind: Option<String>, pub tags: Vec<String>, pub under: Option<String>, pub limit: u32, pub any_term: bool }
pub struct VaultHit { pub path: String, pub file: String, pub kind: String, pub title: String, pub description: String, pub heading: String, pub line: u32, pub snippet: String, pub status: String, pub preview: Option<String> }
pub struct VaultSearchResult { pub hits: Vec<VaultHit>, pub total: u32, pub is_scanning: bool, pub scanned_at: Option<i64> }
pub fn search(app: &AppHandle, query: &VaultQuery) -> Result<VaultSearchResult, CommandError>
```

`snippet` enthält die Fundstellen zwischen den Zeichen `\u{E000}` (Anfang) und `\u{E001}` (Ende); die Oberfläche macht daraus Markierungen, das Werkzeug ersetzt sie durch `**`.

**Tauri-Commands** (`src-tauri/src/commands/vault.rs`, Wrapper `src/lib/vault.ts`): `vault_status() -> VaultStatus` · `vault_rescan() -> ()` · `vault_create_skeleton() -> VaultStatus` · `vault_find(query: VaultQuery) -> VaultSearchResult` · `vault_open(path: String, reveal: bool) -> ()`.

## Finale Abnahmekriterien

1. Ohne Vault-Ordner oder bei ausgeschaltetem Schalter: kein Knopf „Vault“ in der Sidebar, `Strg+K` tut nichts, `tools/list` des MCP-Zugangs enthält kein `vault_*`, kein Thread liest Dateien, der App-Start ist unverändert.
2. Ordner wählen und einschalten: die Statuszeile zeigt erst „wird eingelesen …“, dann „bereit · N Dateien · M Artefakte · Stand HH:MM“; der App-Start wartet nie auf den Abgleich.
3. Eine unveränderte Datei (gleiche Größe und Änderungszeit) wird bei einem erneuten Abgleich nicht gelesen; eine geänderte, neue oder gelöschte Datei ist nach „Neu einlesen“ oder spätestens nach einer Suche, die mehr als 30 s nach dem letzten Abgleich kommt, im Index nachgezogen.
4. Eine Datei, die nicht gelesen werden kann, bricht den Abgleich nicht ab; sie zählt in „übersprungen“.
5. Dateien, die `.gitignore`, `.vaultignore` oder ein führender Punkt ausschließen, kommen weder in den Index noch über `vault_get` heraus.
6. `vault_search` findet über Titel, Tags, Dateinamen, Überschriften und Text, zeigt jedes Artefakt höchstens einmal und nennt immer die Gesamtzahl der Treffer.
7. `vault_get` liefert einen Abschnitt, eine Textdatei (gedeckelt), eine Ordnerliste oder ein Bild als Bild; Pfade außerhalb des Vault oder nicht eingelesene Dateien enden mit einem Fehlersatz.
8. Die erste Nachricht einer Station nennt bei aktivem Vault bis zu drei passende Vault-Treffer, ohne Vault keine Zeile dazu.
9. Der Suchdialog öffnet sich über den Knopf „Vault“ und `Strg+K`, sucht beim Tippen und öffnet einen Treffer mit dem Standardprogramm oder zeigt ihn im Ordner.
10. Wird `index.db` gelöscht oder der Vault-Ordner gewechselt, baut der nächste Abgleich den Index vollständig neu auf.

## Wackelstellen (nur hier, keine Abnahmeliste)

- **FTS5 und deutsche Wörter:** der Zerleger `unicode61` trennt keine zusammengesetzten Wörter — „Ladebalken“ findet „Balken“ nicht, nur Wortanfänge („Lade“). Bleibt in Version 1 so; zeigt die Nutzung den Mangel, folgt ein zweiter Index mit Zerleger `trigram`.
- **Bild als Werkzeug-Ergebnis:** dass die Claude-Kommandozeile ein Bild aus einem MCP-Werkzeug dem Modell zeigt, ist nicht am Verwalter geprüft. Prüfen in Phase 4: in einer Session `vault_get` auf eine PNG-Datei rufen und den Agenten das Bild beschreiben lassen.
- **Vault auf einem Cloud-Laufwerk:** liegen Dateien nur online (Streaming), lädt der erste Abgleich jede Datei herunter. Größe und Änderungszeit kommen ohne Download; erst das Lesen geänderter Dateien lädt.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
