# Aufbewahrung archivierter Vorhaben

Archivierte Vorhaben bleiben heute für immer liegen: Archivieren setzt nur eine Markierung, kein Ordner und keine Zeile wird je gelöscht. Stand 27.11.2026: 22,4 GB Scratchpads (99 % archiviert), Datenbank 696 MB (93 % archiviert), Laufwerk C mit rund 15 GB frei. Dieser Plan baut zwei abschaltbare Mechanismen: eine Sofort-Stufe beim Archivieren und das vollständige Löschen nach einer Frist.

## Overview

| Phase | Thema | Rating | Status |
|---|---|---|---|
| 1 | Einstellungen, Migration, ADR ([phase-1-einstellungen.md](phase-1-einstellungen.md)) | mechanisch | pending |
| 2 | Sofort-Stufe: Scratchpad beim Archivieren ausdünnen ([phase-2-sofort-stufe.md](phase-2-sofort-stufe.md)) | standard | pending |
| 3 | Vollständiges Löschen nach der Frist, Verdichten der Datenbank ([phase-3-frist.md](phase-3-frist.md)) | heikel | pending |
| 4 | Oberfläche: Einstellungen und Hinweis im Archiv ([phase-4-oberflaeche.md](phase-4-oberflaeche.md)) | standard | pending |

## Entscheidungen des Benutzers (27.11.2026)

- Nach Ablauf der Frist wird das archivierte Vorhaben **vollständig** gelöscht: Scratchpad, Chat, Werkzeug-Ausgaben, Artefakte, Anhänge, Archiv-Eintrag.
- Das Löschen nach Frist ist über einen Schalter an- und abschaltbar; die Frist ist ein Regler von 7 bis 365 Tagen.
- Die Sofort-Stufe (Bau-Ordner und schwere Binärdateien beim Archivieren löschen) bekommt einen **eigenen** Schalter, unabhängig von der Frist.
- Mit einem gelöschten Vorhaben werden auch seine Transkripte der Claude-Kommandozeile und seine Temp-Scratchpads gelöscht.

## Von mir gesetzt

- **Beide Schalter stehen im Auslieferungszustand auf aus, Frist 30 Tage.** Grund: Löschen ist unumkehrbar; niemand soll durch ein Update Daten verlieren.
- **Die Frist zählt ab dem Archivieren** (`projects.archived_at`). Aktive Vorhaben werden nie angefasst; Wiederherstellen und erneutes Archivieren startet die Frist neu.
- **Der Lauf startet 10 Minuten nach App-Start und danach alle 24 Stunden**, nie sofort beim Umlegen des Schalters. Grund: wer den Regler versehentlich zu niedrig stellt, hat Zeit zum Korrigieren; die Oberfläche zeigt vorher, wie viele Vorhaben der nächste Lauf trifft.
- **Die Sofort-Stufe holt den Altbestand nach:** der tägliche Lauf dünnt jedes archivierte Vorhaben aus, das noch nicht ausgedünnt ist (Spalte `projects.trimmed_at`).
- **Dateien zuerst, Datenbank danach.** Lässt sich der Workspace-Ordner nicht löschen (Datei gesperrt), bleiben die Zeilen stehen und der nächste Lauf versucht es erneut. Umgekehrt bliebe ein Ordner zurück, den niemand mehr findet.
- **Ein Workspace, der noch einen alten App-Worktree mit offenen Änderungen enthält, wird übersprungen** (Unterordner ohne führenden Punkt mit `.git` darin). Grund: dort läge nicht gesicherter Code. Gemessen 27.11.2026: 0 solche Ordner.
- **Die Datenbankdatei wird beim App-Start verdichtet (`VACUUM`), wenn der Schalter „Löschen nach Frist“ an ist und mindestens 20 % der Datei und mindestens 50 MB frei sind.** Gemessen an einer Kopie (696 MB): 10,5 s. Alternative verworfen: nie verdichten — die Datei bliebe für immer so groß wie ihr Höchststand.
- **Kein Papierkorb, kein Rückgängig.** Die Frist ist die Sicherung.
- **Feature-Name `retention`** in allen Schichten (Namensschema der Code-Map), ADR-Nummer 076 (074 ist die höchste auf Platte, 075 ist in einem geparkten Plan reserviert).

## Kontrakt

### Einstellungen (`src-tauri/src/settings/`)

| Feld in `Settings` | Schlüssel in `settings` | Typ | Standard | Grenzen |
|---|---|---|---|---|
| `archive_trim` | `archive_trim` | `bool` | `false` | — |
| `archive_purge` | `archive_purge` | `bool` | `false` | — |
| `archive_purge_days` | `archive_purge_days` | `u32` | `30` | `7..=365` (Konstante `ARCHIVE_PURGE_DAYS_RANGE`) |

`SettingsChange` bekommt `ArchiveTrim { value: bool }`, `ArchivePurge { value: bool }`, `ArchivePurgeDays { value: u32 }`. Ein Wert außerhalb der Grenzen wird in `update` mit `CommandError::Internal("Frist außerhalb 7–365 Tage")` abgelehnt; `load` ersetzt einen gespeicherten Wert außerhalb der Grenzen durch den Standard.

### Datenbank

Migration `024_retention.sql`: `ALTER TABLE projects ADD COLUMN trimmed_at REAL;` — Zeitpunkt (ms seit 1970) des letzten Ausdünnens, `NULL` = noch nie. `project_rows::restore` setzt `trimmed_at = NULL`.

### Core-Modul `src-tauri/src/retention/`

| Datei | Inhalt |
|---|---|
| `model.rs` | `TrimStats { files: u64, bytes: u64 }`, `RetentionPreview { projects: u32, sessions: u32 }` (TS-Binding) |
| `trim.rs` | `pub fn trim_scratchpad(workspace: &Path) -> TrimStats` |
| `purge.rs` | `pub fn purge_due(app: &AppHandle, database: &Database, days: u32) -> u32` (Zahl gelöschter Vorhaben), `pub fn preview(database: &Database, days: u32) -> Result<RetentionPreview, CommandError>` |
| `mod.rs` | `pub fn start(app: AppHandle)` (Thread `retention`), `pub fn run_once(app: &AppHandle)`, `pub fn trim_after_archive(app: AppHandle, project_id: String, workspace: PathBuf)`, `pub fn compact_if_worthwhile(database: &Database)` |

### Command

`retention_preview(days: u32) -> RetentionPreview` in `src-tauri/src/commands/retention.rs`, Wrapper `src/lib/retention.ts` (`loadRetentionPreview(days)`).

### Sperre gegen gleichzeitiges Wiederherstellen

`SessionRegistry` bekommt `archive_gate: Mutex<()>` mit `pub fn lock_archive_gate(&self) -> MutexGuard<'_, ()>`. `restore_project` hält sie für seine ganze Dauer; `purge_due` nimmt sie je Vorhaben und prüft danach erneut, dass das Vorhaben archiviert und fällig ist. Reihenfolge: `archive_gate` immer als erste Sperre, vor Vorhaben-, Session- und Datenbank-Sperre.

## Finale Akzeptanzkriterien

1. Beide Schalter aus (Auslieferungszustand): kein Ordner und keine Zeile wird gelöscht, kein `VACUUM` läuft.
2. Schalter „Beim Archivieren ausdünnen“ an: nach dem Archivieren eines Vorhabens sind im Scratchpad seines Workspace die Bau-Ordner und schweren Dateien nach Phase 2 weg; Bilder, HTML, Markdown, PDF, Logs und Skripte unter 50 MB sind da; `.artefakte`, `.anhaenge`, `.retro` sind unberührt.
3. Schalter „Löschen nach Frist“ an, Frist N Tage: ein Vorhaben, das länger als N Tage archiviert ist, ist nach dem nächsten Lauf aus Archiv, Datenbank und Dateisystem verschwunden — samt Notiz, Berichtsbildern, MCP-Konfigurationen, Codex-Thread-Dateien, Transkripten der Kommandozeile und Temp-Scratchpads. Ein jüngeres und jedes aktive Vorhaben ist vollständig da.
4. Ein Vorhaben, das während eines Laufs wiederhergestellt wird, wird nicht gelöscht. Wer die letzte Session eines Vorhabens von Hand löscht, hinterlässt keinen Workspace-Ordner mehr (unabhängig von den Schaltern).
5. Die Einstellungsseite zeigt unter „App → Aufräumen“ beide Schalter und, wenn „Löschen nach Frist“ an ist, den Regler 7–365 Tage mit der Zeile, wie viele Vorhaben der nächste Lauf trifft; jede Zeile hat ihren ⓘ-Text.
6. Die Archiv-Karte eines Vorhabens zeigt bei eingeschaltetem Löschen das Löschdatum.
7. `pnpm check` ist grün; Code-Map, Glossar und ADR 076 sind nachgezogen.

## Konfidenz

- 🟡 **Lange Pfade und Verknüpfungen beim Löschen unter Windows** (`node_modules` über 260 Zeichen, Junctions). Check in Phase 2: Probe-Ordner mit einem Pfad über 300 Zeichen und einer Junction auf einen Ordner außerhalb anlegen, `trim_scratchpad` laufen lassen, prüfen, dass der lange Pfad weg ist und das Ziel der Junction unberührt.
- 🟡 **Ordnername der Kommandozeilen-Transkripte.** Der Plan sucht deshalb nicht nach dem Namen, sondern nach der Datei `<Session-ID>.jsonl` in allen Ordnern unter `projects` (wie `agents::claude::locate::has_transcript`). Check in Phase 3: nach dem Lauf an einer Probe-Session `has_transcript` = `false`.
- Belegt am 27.11.2026 an einer Kopie: Löschen von 44 Vorhaben samt aller abhängigen Zeilen dauert 1,0 s und hinterlässt keine verwaisten Zeilen in `chat_entries`, `implementations`, `report_entries`; `VACUUM` dauert 10,5 s.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
