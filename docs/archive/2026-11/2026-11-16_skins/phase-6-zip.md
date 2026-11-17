# Phase 6 — ZIP-Export und -Import

Rating: heikel (fremde Archive sind Angriffsfläche). Pakete lassen sich als ZIP speichern und von anderen einlesen.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt „ZIP-Format“, Typen, Grenzen; Entwurf Abschnitt „Paketformat (ZIP)“
- Phase 2: `skins/validate.rs` (`validate_figures`, `validate_style`), `skins/images.rs` (`sniff`), `skins/mod.rs`
- Skill `mode-dependencies` vor `cargo add` laden
- `src/features/skins/SkinPackList.tsx` (Knöpfe ergänzen), Dialog-Plugin (`save`, `open`)

## AK

1. „Als ZIP exportieren“ je Paket öffnet „Speichern unter“ (Vorschlag `<Name>.zip`, Filter `zip`) und schreibt `skin.json` + `bilder/<Datei>` (nur Bilder, auf die `data` verweist); `skin.json` = `{ "format": 1, "kind", "name", "data" }`, UTF-8, eingerückt.
2. „ZIP importieren …“ (Knopf neben „Neues Stilpaket“) öffnet „Öffnen“ (Filter `zip`) und legt ein **neues** Paket an; Name schon vergeben → „ (2)“, „ (3)“ … anhängen. Erfolg: neues Paket in der Liste, 8 s Satz „„X“ importiert.“
3. Abgelehnt mit einem Satz, ohne Rest auf der Platte: mehr als 64 Einträge; Summe der entpackten Größen > 20 MiB oder ein Bild > 2 MiB (Größe beim Lesen zählen, nicht der Angabe im Archiv glauben); Eintragsname mit `..`, `:`, führendem `/` oder `\`, oder nicht `skin.json` bzw. `bilder/<name>`; Bildinhalt nicht GIF/PNG/WebP/ICO laut `sniff`; `skin.json` fehlt, ist kein gültiges JSON, `format != 1`, oder `validate_*` scheitert; Verweis auf ein Bild, das im Archiv fehlt.
4. Entpackt wird zuerst in `<data_dir>\skins\.import-<uuid>\`; erst nach bestandener Prüfung wird der Ordner zum Paketordner umbenannt und die Zeile geschrieben; bei Fehler Ordner löschen.
5. Bildnamen werden beim Import auf das Schema aus dem Kontrakt normalisiert (`<stem>.<ext aus sniff>`), Verweise in `data` entsprechend angepasst.

## Checkliste

- [x] `cargo add zip --no-default-features --features deflate` (aktuelle Version; `mode-dependencies` beachten), Version im Report-Back.
- [x] `src-tauri/src/skins/archive.rs`: Konstanten `MAX_ENTRIES = 64`, `MAX_TOTAL_BYTES = 20 * 1024 * 1024`; `export(pack: &SkinPack, dest: &Path) -> Result<PathBuf, String>`; `import(app, database, zip: &Path) -> Result<SkinPack, String>` nach AK 3–5; Lesen jedes Eintrags über `take(MAX_IMAGE_BYTES + 1)`.
- [x] Commands `skins_export(id, dest)`, `skins_import(path)` in `commands/skins.rs`, registrieren; Wrapper in `src/lib/skins.ts`.
- [x] Oberfläche: Knöpfe in `SkinPackList.tsx` (Paketzeile: „Als ZIP exportieren“; Kopf: „ZIP importieren …“), Fehlersatz in der Rückgängig-Leiste (ohne Knopf).
- [x] Doku: `docs/code-map.md`, Format-Beschreibung als Abschnitt in ADR 065 („ZIP-Format, Version 1“).

## Report-Back

Status: complete. `pnpm check` grün; in der echten App nicht gelaufen (Dialoge „Speichern unter“/„Öffnen“, echtes Export-Import-Round-Trip und manipulierte ZIPs ungeprüft; keine Tests im privaten Profil).

- **Abhängigkeit:** `zip 9.6.1` (`default-features = false`, Feature `deflate`).
- **Abweichungen:** `import` und `export` liefern wie der übrige Kern `Result<_, CommandError>` statt `String`. Der leere Verzeichnis-Eintrag `bilder/` wird toleriert (zählt zu den 64 Einträgen), weil Windows-Explorer es anlegt. Neu: Capability `dialog:allow-save`; `SkinUndoBar.onUndo` ist optional (Satz ohne Knopf für Erfolg und Ablehnung); Export meldet „„X“ exportiert.“; liegengebliebene `.import-*`-Ordner räumt `purge_on_start` weg; `images::check_extension` ist aus `ingest` herausgezogen und gilt auch beim Import.
- **Wackelstellen:** (1) `skins/archive.rs` `read_archive`: Entrypfade und Grenzen nur per Quelltext geprüft, kein Lauf mit einem manipulierten Archiv (Zip-Bombe, `..`, Doppel-Einträge). (2) `entry.name()` liefert in zip 9 ein `Result`; ein nicht-UTF-8-Name wird abgelehnt. (3) Verschlüsselte Einträge scheitern ohne AES-Feature mit dem Satz „beschädigt oder verschlüsselt“.
