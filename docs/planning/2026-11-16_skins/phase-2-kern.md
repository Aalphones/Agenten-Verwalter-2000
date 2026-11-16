# Phase 2 — Speicher, Einstellungen und Bilder im Kern

Rating: heikel (Datenmodell, Herunterladen fremder Bilder). Nach dieser Phase kann die Oberfläche Pakete anlegen, füllen, löschen und Bilder aus Datei, Adresse oder Bytes ablegen; die sechs Einstellungen existieren.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Typen, Grenzen, Einstellungen, Commands), [ADR 065](../../decisions/065-skins.md)
- `src-tauri/src/settings/model.rs`, `src-tauri/src/settings/mod.rs` — Muster: `KEY_*`-Konstante, Feld in `DEFAULT_SETTINGS`, Lesen in `load`, Prüfung + Schreiben in `update`
- `src-tauri/src/db/migrations.rs` + `migrations/019_implementation_cancel.sql` (letzte Migration), `src-tauri/src/db/settings.rs` (Muster eines kleinen DB-Moduls), `src-tauri/src/db/mod.rs` (`Database::with`)
- `src-tauri/src/app_update/download.rs` — Muster `ureq::Agent::config_builder()` mit Zeitlimits, Lesen über `into_body().into_reader()`
- `src-tauri/src/filesystem/workspace.rs` — `data_dir`
- `src-tauri/src/commands/settings.rs` (Muster eines Command-Moduls), `src-tauri/src/lib.rs` (Command-Registrierung, `setup`)
- `src-tauri/tauri.conf.json` — `assetProtocol.scope` = `$HOME/.verwalter/**` deckt `skins\` ab
- `docs/conventions/rust.md`, `docs/conventions/linting.md`
- Fehlerklassen geprüft (Vault `systeme/sqlite`): Sicherung/WAL-Themen, hier nicht einschlägig.

## AK

1. Migration `020_skins.sql` legt `skin_packs` an; die App startet mit alter und neuer Datenbank.
2. `skins_create` legt ein Paket mit leeren Daten an (Figuren: keine Fächer; Stil: Farben = Standardfarben, Deckkraft Seitenleiste 20, Inhalt 10); `copy_of` kopiert Daten und Bildordner.
3. `skins_save` lehnt ab (Fehlersatz, nichts gespeichert): Art passt nicht zum Paket, Grenze überschritten, Farbe kein `#rrggbb`, Deckkraft > 60, Bildname zeigt auf keine Datei im Paketordner, doppelte Fach-ID, `c-`-ID mit unerlaubten Zeichen.
4. `skins_set_image` nimmt Pfad, `https`-Adresse oder Bytes; erkennt GIF/PNG/WebP (Symbol zusätzlich ICO) am Dateikopf; > 2 MiB → Fehlersatz; Adresse: nur `https`, Verbindungs- und Antwortzeit je 10 s, höchstens 2 MiB gelesen; schreibt `<Ziel>.<ext>`, alte Datei mit anderer Endung wird ersetzt.
5. `skins_delete` setzt `deleted_at`; `skins_undelete` hebt es auf; beim App-Start werden Pakete mit `deleted_at` älter als 24 h samt Ordner gelöscht und nicht referenzierte Dateien in Paketordnern entfernt.
6. Die sechs Einstellungen aus dem Kontrakt laden und speichern; `SkinFigures`/`SkinStyle` mit einer ID, die nicht existiert oder die falsche Art hat → Fehlersatz. Wird das aktive Paket gelöscht, liefert `load` dafür `None`.
7. Jede Änderung sendet `skins://changed`.
8. `skins_tool_usage(days)` liefert die 30 häufigsten Paare aus Werkzeugname und Eingabe-Anfang der Sessions mit `last_activity_at` in den letzten `days` Tagen.
9. `pnpm check` grün, `pnpm bindings` ausgeführt.

## Checkliste

### Datenbank

- [ ] `migrations/020_skins.sql`:
  ```sql
  CREATE TABLE skin_packs (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('figures', 'style')),
    name       TEXT NOT NULL,
    data       TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    changed_by TEXT,
    deleted_at TEXT
  );
  ```
  In `migrations.rs` als Migration 20 eintragen.
- [ ] `src-tauri/src/db/skins.rs`: `list(connection) -> Vec<Row>` (ohne gelöschte, sortiert nach `name COLLATE NOCASE`), `get(connection, id) -> Option<Row>`, `kind_of(connection, id) -> Option<String>` (nur nicht gelöschte), `insert`, `update_data(id, data_json, changed_at, changed_by)`, `rename`, `set_deleted(id, Option<&str>)`, `purge_deleted(before: &str) -> Vec<String>` (gibt gelöschte IDs zurück), `tool_usage(connection, since_ms: f64) -> Vec<(String, String, u32)>`:
  ```sql
  SELECT json_extract(c.payload, '$.tool') AS tool,
         substr(coalesce(json_extract(c.payload, '$.target'), ''), 1, 40) AS head,
         count(*) AS n
  FROM chat_entries c JOIN sessions s ON s.id = c.session_id
  WHERE json_extract(c.payload, '$.kind') = 'tool' AND s.last_activity_at >= ?1
  GROUP BY tool, head ORDER BY n DESC LIMIT 30
  ```
  Zuerst an einer Kopie der Datenbank prüfen, dass `payload` so serialisiert ist (`kind`, `tool`, `target`); weicht es ab, Pfade anpassen und in FINDINGS notieren.

### Modell und Fachlogik (`src-tauri/src/skins/`)

- [ ] `model.rs`: Typen und Grenzen exakt wie im Kontrakt; `Motion` mit `serde(rename_all = "camelCase")`; `impl StyleColors { fn standard_dark(), fn standard_light() }` mit den Werten aus `src/styles/theme.css` (dunkel: base `#1f1f1f`, sidebar `#181818`, surface `#252526`, fg `#d4d4d4`, muted `#8f8f8f`, accent `#e0825c`, border `#3c3c3c`; hell: `#ffffff`, `#f8f8f8`, `#ffffff`, `#3c3c3c`, `#6e6e6e`, `#c4572f`, `#d9d9d9`).
- [ ] `validate.rs`: `validate_figures(&FiguresData, dir: &Path) -> Result<(), String>` und `validate_style(&StyleData, dir) -> Result<(), String>` (AK 3); Texte werden getrimmt, leere entfernt.
- [ ] `images.rs`: `sniff(bytes) -> Option<&'static str>` (`gif`, `png`, `webp`, `ico`); `ingest(dir, target, source) -> Result<String, String>` (Dateiname); `file_stem(target)` = `<slot>` / `<slot>-2` / `sidebar` / `content` / `icon`; Adresse über eigenen `ureq::Agent` (Zeitlimits 10 s), Lesen in Blöcken mit Abbruch über 2 MiB; Pfad: Datei lesen, höchstens 2 MiB; Bytes: Base64 dekodieren (`base64`-Crate). Vor dem Schreiben alle Dateien `<stem>.*` im Ordner löschen.
- [ ] `mod.rs`: `SkinService`-freie Funktionen mit `&AppHandle` und `&Database`: `list`, `get`, `create`, `rename`, `save`, `set_image`, `remove_image`, `delete`, `undelete`, `purge_on_start`, `tool_usage`. `get` füllt `dir` (absoluter Pfad). `list` füllt `thumb` (Figuren: Bild des Fachs `search`, sonst erstes Bild; Stil: `icon`) als absoluter Pfad und `swatches` (Stil: dunkel base, sidebar, accent, fg). `changed_by` setzt nur Phase 7; hier immer `None`. Nach jeder Änderung `app.emit("skins://changed", ())`.
- [ ] `purge_on_start` in `setup` (`lib.rs`) nach dem Öffnen der Datenbank aufrufen; Fehler nur protokollieren.

### Einstellungen

- [ ] `settings/model.rs`: sechs Felder und sechs `SettingsChange`-Varianten laut Kontrakt.
- [ ] `settings/mod.rs`: Schlüssel `skin_figures`, `skin_style`, `skin_animations`, `skin_celebrations`, `skin_easter_eggs`, `skin_agent_tools`; Standardwerte laut Kontrakt; `skin_animations` als `Option<bool>` (fehlender Schlüssel = `None`); `SkinFigures`/`SkinStyle` prüfen über `db::skins::kind_of`; leer/`None` schreibt `""`. In `load`: verweist `skin_figures`/`skin_style` auf kein (nicht gelöschtes) Paket der passenden Art → `None`.

### Commands

- [ ] `src-tauri/src/commands/skins.rs`: alle Commands aus dem Kontrakt außer `skins_export`, `skins_import` (Phase 6) und `skins_apply_icon` (Phase 5); in `lib.rs` registrieren.
- [ ] `src/lib/skins.ts`: Wrapper je Command + `onSkinsChanged(handler)` (Abo auf `skins://changed`, Muster `src/lib/projects.ts`).
- [ ] `pnpm bindings`.

### Doku

- [ ] `docs/code-map.md`: Zeile „Skins“ um Core (`src-tauri/src/skins/`, `db/skins.rs`, Migration 20, `commands/skins.rs`) erweitern.
- [ ] `docs/glossary.md`: „Skin“, „Figurenpaket“, „Stilpaket“, „eigenes Fach“.
- [ ] ADR 065 auf „angenommen“ setzen.

## Report-Back
