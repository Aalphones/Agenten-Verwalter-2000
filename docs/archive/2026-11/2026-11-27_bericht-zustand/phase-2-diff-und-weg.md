# Phase 2 — Core: Repos außerhalb des Vorhabens, Stopps aus dem Diff, Weg aus dem Verlauf

Status: complete · Rating: heikel · Modell: opusplan

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans (Kontrakt), `phase-1-ordnen-sichtbar.md` → Report-Back, ADR 075.
- `src-tauri/src/report/mod.rs` — `load`, `context_of`, `check_phase`.
- `src-tauri/src/report/range.rs` — Moduldoku oben, `Checkout`, `checkouts`, `commit_catalog`, `PhaseSpan`, `phase_ranges`, `repository_ranges`, `open_range`, `start_commit`, `read_stats`.
- `src-tauri/src/report/assemble.rs` — `catalog_of`, `ranges_of_phase`, `span_of`, `phase_of`, `count_changes`, `Files`, `Target`, `block_rows` (ohne Stelle: alle Abschnitte des Patchs), `stops_of_phase`, `stop_of`, `code_block`, `way_of`.
- `src-tauri/src/report/tidy.rs` — `spur_stations`, `station_lines` (Muster für das Lesen des Verlaufs), `written_file`; `src-tauri/src/report/anchor.rs` — `is_write`, `written_path`.
- `src-tauri/src/git/mod.rs` — `toplevel`, `commit_before`; Git läuft nur über dieses Modul (Kritische Regel 2 in `AGENTS.md`).
- `src-tauri/src/changes/sources.rs` — `Source.group_name` (Anzeigename des Repositorys); `src-tauri/src/changes/attribution.rs` — `normalize_path`.
- `src-tauri/src/agents/event.rs` — `ChatEntry::Tool { at, tool, target, description, tool_use_id }`; `src-tauri/src/db/tool_details.rs` — `ToolSummary.output_head`.
- Entwurf: `artifacts/bericht-ohne-eintraege.html` (Zustand „Station arbeitet“ und „Geordnet“) — Weg und Stopps aus dem Diff.
- Fehlerklassen (Vault): `werkzeuge/git.md` → „Negativbefund aus einer nicht aktualisierten Historie“ (nicht einschlägig: lokale Commits), „`git add <Ordner>`…“ (Commit). Keine weiteren einschlägig.

## AK der Phase

1. Schreibt eine Station der Phase in ein Git-Repository, das nicht im Vorhaben eingetragen ist, erscheint es im Bericht: als `ReportRepository` mit `outside: true` und Label = Ordnername (`facepass`, `U104_Agents`), mit seinen Dateien, Zeilen und Commits der Phase.
2. In einem Repository außerhalb zählen nur Dateien, die eine Station der Phase geschrieben hat (`session_files`), nie fremde Änderungen desselben Arbeitsbaums.
3. Jede geänderte Datei der Phase, die in keinem Stopp aus Einträgen steht, steht in genau einem Stopp mit `derived: true` — einer je Repository, Titel = Label, Code-Block mit allen Abschnitten des Patchs. Über 300 Zeilen: `rows` leer, `omittedRows` = Zeilenzahl.
4. `ReportCode.fresh` ist `true` für Dateien, die eine Station der Phase nach `tidiedAt` geschrieben hat.
5. Ohne gültige Ordnung (`tidy_json` fehlt) ist `way` der Weg aus dem Verlauf nach den Regeln unten; mit Ordnung bleibt es der Weg von Haiku.
6. Gegen Umsetzung `73cb952b-6cdf-4e41-bae2-a3300187e377` zeigt `report-probe … view` für deren Phase 2 (Station #14) drei Repositorys (facepass außen mit `a4cdf58`; U104_Agents außen mit den automatischen Commits `9a7c2d2`, `8643350`; Agenten-Verwalter-2000 mit `ee64529`, `ece4403`), Stopps aus dem Diff für die sieben facepass-Dateien und einen Weg mit Etappen.
7. `powershell -File scripts/check.ps1` endet mit `exit 0`.

## Checkliste

### Repos außerhalb (`report/mod.rs`, `report/range.rs`, `git/mod.rs`)

- [x] `git/mod.rs`: `pub fn commits_touching(repo: &Path, since_seconds: i64, until_seconds: Option<i64>, paths: &[String]) -> Result<Vec<String>, CommandError>` = `git log --format=%H --since=@<since> [--until=@<until>] -- <paths…>` (Pfade relativ zum Repo, `/`), älteste zuletzt wie `git log` sie liefert.
- [x] `range.rs`: `Checkout` bekommt `pub outside: bool` und `pub label: String`; `checkouts(sources)` setzt `outside: false`, `label: source.group_name.clone()`.
- [x] `report/mod.rs`, neue Funktion `outside_checkouts(checkouts: &[Checkout], files: &[(String, String, f64)]) -> Vec<Checkout>`: für jeden Pfad aus `files`, der unter keinem `checkout.dir` liegt (Vergleich über `normalize_path` beider Seiten, Präfix mit Trennzeichen), `git::toplevel(<Elternordner>)`; je gefundenem Toplevel genau ein `Checkout { key: format!("extern:{}", normalize_path(toplevel)), group: <gleich key>, dir: toplevel, is_main: true, outside: true, label: <Ordnername des Toplevel> }`. Kein Git-Repository → Pfad wird übergangen.
- [x] `context_of` hängt die äußeren Checkouts an `checkouts` an.
- [x] Commits der äußeren Repos: in `context_of` je Station der Umsetzung mit Session und `started_at`, je äußerem Checkout: die von dieser Session dort geschriebenen Pfade (relativ zum Toplevel) → `git::commits_touching(dir, started_at/1000, completed_at.map(/1000), paths)`; jedes Ergebnis als Paar `(session_id, commit)` an `AssembleContext.commits` anhängen. `catalog_of` nimmt sie damit automatisch auf.
- [x] `range.rs` → `read_stats`: bei `checkout.outside` (über `RepoRange` mitgeben: neues Feld `outside: bool`, in `empty_range` gesetzt) die Dateien auf die Pfade beschränken, die eine Station der Phase geschrieben hat — dafür `touched` (Map normalisierter absoluter Pfade) gegen `folder.join(file.path)` normalisiert prüfen.

### Repositorys und Frische (`report/model.rs`, `report/assemble.rs`)

- [x] `ReportRepository` laut Kontrakt; `ReportPhase.repositories` in `phase_of` aus `ranges` je `group`: Label und `outside` vom Checkout, Dateien/Zeilen wie `count_changes` (nur dieser Gruppe), Kurz-Hashes. Reihenfolge: zuerst Gruppen mit Stopps aus Einträgen, dann die übrigen in Reihenfolge der Checkouts.
- [x] `ReportCode` um `fresh: bool` und `omitted_rows: u32` erweitern; `code_block` setzt `fresh` über eine Hilfsfunktion `is_fresh(ctx, phase, target, tidied_at)` (Pfad aus `ctx.files` der Phasen-Sessions mit `touched_at > tidied_at`), `omitted_rows: 0`.

### Stopps aus dem Diff (`report/assemble.rs`)

- [x] `ReportStop` um `derived: bool` und `outside: bool` erweitern; `stop_of` setzt beide `false` (bzw. `outside` nach dem Checkout des ersten Code-Blocks).
- [x] Neue Funktion `derived_stops(ranges, stops: &[ReportStop], files: &mut Files, first_index: u32, …) -> Vec<ReportStop>`: sammelt `(repository_key, path)` aller Code-Blöcke in `stops`; für jede Datei jedes Bereichs, die dort fehlt und nicht `untracked` ohne Inhalt ist, einen Code-Block mit `block_rows(file, &[])`; gruppiert nach `range.group`, ein Stopp je Gruppe: `title` = Label, `kind` = `"flow"`, `look: None`, `by: String::new()`, `lead: None`, `derived: true`, `outside` vom Checkout. Mehr als `DERIVED_MAX_ROWS = 300` Zeilen in einem Block → `rows` leer, `omitted_rows` = Zeilenzahl.
- [x] In `phase_of` nach `label_notes(&mut stops)` anhängen; Indizes laufen nach dem letzten vorhandenen Stopp weiter.

### Weg aus dem Verlauf (neu `report/way.rs`)

- [x] `pub fn history_way(traces: &[StationTrace], locate: &dyn Fn(&str) -> Option<String>, running: bool) -> Vec<ReportWayStep>`; `locate` bildet einen Pfad auf das Label seines Checkouts ab (aus allen Checkouts inkl. äußerer). Regeln, in Verlaufsreihenfolge über alle Stationen:
  - Nur `ChatEntry::Tool`; Aufrufe mit Werkzeugname `mcp__verwalter__*` zählen nicht.
  - Ort eines Aufrufs: für Schreib-Aufrufe (`anchor::is_write`) der Pfad aus `anchor::written_path`, für `Read`/`Grep`/`Glob` der `target`; Befehle (`Bash`, `PowerShell`) haben keinen Ort.
  - Eine neue Etappe beginnt, wenn ein Aufruf einen Ort hat, der vom bekannten Ort der laufenden Etappe abweicht.
  - Ein Befehl, dessen `output_head` eine Zeile im Muster `^\[[^\]\s]+ ([0-9a-f]{7,40})\]` enthält (Ausgabe von `git commit`), setzt `commit` der laufenden Etappe (erste 7 Zeichen) und beendet sie.
  - `text` = Beschreibung des ersten Befehls der Etappe mit Beschreibung, sonst `"Lesen und Suchen"`; `calls` = alle Befehls-Beschreibungen; `reads` = Zahl der `Read`/`Grep`/`Glob`; `writes` = Zahl der Schreib-Aufrufe; `files` = Dateinamen der geschriebenen Pfade, höchstens 8, ohne Doppel; `at` = `at` des ersten Aufrufs; `location` = Ort; `running` nur für die letzte Etappe und nur bei `running`; `detour: false`; `stop` = Index des ersten Stopps, dessen Code-Block den ersten geschriebenen Pfad der Etappe zeigt (in `phase_of` nachgetragen).
  - Höchstens 12 Etappen: darüber werden die ältesten zu einer Etappe „Frühere Schritte“ zusammengefasst.
- [x] `ReportWayStep` laut Kontrakt erweitern; `way_of` (Haiku-Weg) setzt die neuen Felder auf `None`/leer/`0`/`false`.
- [x] `report::load`: Verläufe (`registry.history_of`) nur für Phasen ohne gültige Ordnung laden und als `StationTrace` (wie in `haiku_input_of`) an `assemble` geben (neues Feld in `AssembleContext`: `traces: HashMap<String, Vec<StationTrace>>` je Phase-ID); `phase_of` setzt `way = history_way(…)`, wenn `answer` fehlt.

### Probe, Doku

- [x] `report-probe view` druckt je Phase die Repositorys (`label · außen? · Dateien +/− · Commits`), je Stopp `derived/outside`, je Code-Block `fresh`/`omitted`, je Etappe `at · location · commit · text`.
- [x] Probe gegen eine Kopie (`scripts/db-copy.ps1`) und Umsetzung `73cb952b-6cdf-4e41-bae2-a3300187e377`; Ergebnis für deren Phase 2 (Station #14) gegen AK 6 im Report-Back.
- [x] `docs/code-map.md`: `report/way.rs` eintragen. ADR 075 um die Regeln des Wegs ergänzen (zwei Zeilen).
- [x] `scripts/check.ps1` grün; Commit mit einzeln genannten Dateien.

## Report-Back

**Probe** (DB-Kopie, Umsetzung `73cb952b-…`, Phase 2 / Station #14, 1,8 s): 16 Dateien +153/−130. Repositorys: Agenten-Verwalter-2000 im Vorhaben 7 Dateien +135/−117 (`ee64529`, `ece4403`); facepass außen 7 +12/−12 (`a4cdf58`); U104_Agents außen 2 +6/−1 (`9a7c2d2`, `8643350`; `ddb72e1` aus demselben Zeitfenster fehlt zu Recht, die Station hat dessen Datei nicht geschrieben). Drei Stopps aus dem Diff, der zweite mit den sieben facepass-Dateien. Weg mit vier Etappen: Agenten-Verwalter-2000 → facepass → U104_Agents → Agenten-Verwalter-2000. Phase 1 derselben Umsetzung behält den Weg von Haiku. AK 6 erfüllt.

- AK 4 an einer zweiten Kopie mit vorverlegtem `tidy_at`: 15 von 18 Blöcken der Phase 1 frisch. Nicht frisch sind zwei erzeugte Bindings und die ADR 073; keine davon steht in `session_files` (die ADR wurde nur über Befehle angefasst).
- AK 3 über 67 der 70 Umsetzungen der Kopie geprüft (8153 Blöcke aus dem Diff, 360 gekürzt): keine Datei doppelt, kein Block über 300 Zeilen ungekürzt. Die übrigen drei setzen ihren Bericht ohne Fehler zusammen, ohne diese Prüfung.
- `scripts/check.ps1`: exit 0.

**Dauer:** Median 1,8 s je Bericht. Schreibt eine Umsetzung viel in U104_Agents (G:), sind es warm bis 15 s. Beim ersten Zugriff auf G: dauerte der schlechteste Fall mit dem neuen Aufruf 92 s, davon 60 s in `diff-tree --numstat`; ganz kalt ist er mit dem neuen Aufruf nicht gemessen.

**Abweichungen vom Plan:**

- Die Logik für äußere Repositorys liegt in `report/outside.rs` statt als `outside_checkouts` in `mod.rs`.
- Statt `git::toplevel` liefert `git::place_in_repository` Wurzel und Präfix; die Zeilen aus `session_files` werden auf den Pfad umgeschrieben, den Git meint (`written_as`), sonst fielen Dateien hinter Junctions durch (`~/.claude/sync`) und in gelöschten Unterordnern.
- `git::commits_in_window` statt `commits_touching`: ein `git log --name-only` je Repository, gefiltert in Rust. Der geplante Pfadfilter brauchte auf G: warm 3,3 s statt 0,9 s und beim ersten Zugriff 84 s je Aufruf (Pfade aus `session_files` sind klein geschrieben, der Filter musste die Schreibung ignorieren).
- Neben `outside` gibt es `written_only`: ein weiterer Arbeitsbaum eines eingetragenen Repositorys wird nur nach geschriebenen Dateien gelesen, gehört aber zu dessen Gruppe und ist nicht „außen“.
- Commits aus solchen Repositorys verschieben das Ende der Bereiche im Vorhaben nicht; ohne eigenen Commit zeigt die jüngste Phase dort die uncommitteten Dateien.
- `history_way` liefert `HistoryStep` (Etappe plus erster geschriebener Pfad), den Stopp trägt `assemble.rs` nach.

**Grenzen:**

- Die Commit-Erkennung des Wegs greift bei `git commit -q` nicht: in Station #14 trägt keine Etappe einen Commit (alle drei Aufrufe mit `-q`), über alle geprüften Berichte 23 von 839 Etappen. Die Repository-Zeilen sind davon nicht betroffen. Die Planregel ist unverändert umgesetzt.
- In äußeren Repositorys fehlt, was ein Befehl geschrieben hat (nicht in `session_files`), was in einem inzwischen gelöschten Arbeitsbaum lag (Phase 1c der Umsetzung `1ae7411e-…`), sowie in einer fertigen, nicht jüngsten Phase nie Committetes und Ignoriertes.
- Die Verläufe aller Phasen ohne Ordnung werden bei jedem Laden gelesen.
- Nicht in der laufenden App gelaufen; die neuen Felder zeigt erst die Oberfläche aus Phase 4.
