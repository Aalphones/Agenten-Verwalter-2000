# Phase 3 — Kern: Bericht zusammensetzen, Befehle und Probe

Rating: heikel. `report_load` liefert den ganzen Bericht einer Umsetzung als `ReportView`: je Phase Kopfzahlen aus Git, Ergebnis und Weg aus der Ordnung, Review-Abschnitt, Stopps mit Code-Blöcken aus dem Commit-Bereich der Phase (neue, unveränderte und entfernte Zeilen), Anmerkungen an ihren Zeilen.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt: Begriffe „Stopp“, „Befund“, „Rohgruppierung“, Typen, Befehle; „Von mir gesetzt“ (Anmerkungen bleiben am Stand ihrer Phase)
- Entwurf `artifacts/_review-bericht-entwurf/daten.js` (Beispiel: Kapitel, Stopps, Blöcke mit `rows`, `anchors`, `notes`, `review.items`) und `review.js` (`phaseHtml`, `stopSection`, `codeBlock`, `diffRows`, `findHtml`) — Zielbild der Daten
- `src-tauri/src/changes/parse.rs` (`unified`), `src-tauri/src/changes/sources.rs` (`sources`, `find`), `src-tauri/src/changes/mod.rs` (`file_diff`: wie Diff gegen Commit bzw. Arbeitsverzeichnis gelesen wird)
- `src-tauri/src/git/mod.rs` (`existing_commits`, `is_ancestor`, `diff_tree_patch`, `diff_index_patch`, `diff_tree_numstat`, `diff_index_numstat`, `show_file`, `subjects`)
- `src-tauri/src/db/session_commits.rs` (`load_by_session`)
- `src-tauri/src/artifacts/server.rs` (`ArtifactServer::file_url`), `src-tauri/src/session_files/handles.rs` (`ViewHandles`) — Bild-Adresse für die Oberfläche
- `src-tauri/src/commands/implementation.rs` (Muster der Befehle), `src-tauri/src/lib.rs` (Registrierung)
- Phase-1/2-Dateien `src-tauri/src/report/*`
- Fehlerklassen (Vault `werkzeuge/git`): „Ersetzungsskript findet im Windows-Arbeitsbaum seinen Anker nicht“ — Zeilenende beim Vergleich von `anchor_text` und Dateiinhalt auf `\n` vereinheitlichen; „Negativbefund aus einer nicht aktualisierten Historie“ — ein Commit, den `existing_commits` nicht findet, gilt als „nicht in diesem Repository“, nicht als „gibt es nicht“.

## AK

1. **Commit-Bereich je Phase und Repository-Eintrag** (`report/range.rs`): Commits der Sessions aller Stationen der Phase (`load_by_session`), je Eintrag gefiltert mit `existing_commits`; `to` = der Commit, von dem alle anderen Vorfahren sind (`is_ancestor`), `from` = `<ältester>^`. Läuft die Phase noch, ist `to = None` (Arbeitsverzeichnis, `diff_index_*`); `from` ohne Commits = `HEAD` beim Start der ersten Station, ersatzweise `HEAD`. Ein Eintrag ohne Commits und ohne Änderungen fällt weg.
2. Kopfzahlen der Phase (`files`, `added`, `removed`) aus `numstat` über alle Bereiche; `commits` als Kurz-Hashes (7 Zeichen) in Commit-Reihenfolge.
3. **Code-Block** je Stopp und Datei: Bereich = alle Zeilen der Notizen des Stopps in dieser Datei ± 3 Zeilen, überlappende zusammengelegt; Zeilen aus dem Patch des Bereichs (`-U3`), Arten `Add`, `Context`, `Removed` mit alten bzw. neuen Nummern; Zeilen im Bereich, die kein Hunk enthält, als `Context` aus dem Endstand (`show_file` bzw. Datei). `added`/`removed` des Blocks = Zahlen der Datei im Bereich der Phase.
4. **Anker nachführen:** stehen in den Zeilen `line_from..line_to` des Endstands nicht mehr `anchor_text`, sucht der Verwalter `anchor_text` im Endstand; genau ein Treffer → neue Zeilen; sonst `moved: true`, die Notiz steht mit `from`/`to` des Aufrufs unter dem Block.
5. **Stopps:** mit gültiger Ordnung (`tidy_json`) in deren Reihenfolge mit Titel, Art, `look`; Einträge mit Nummer > `tidy_entries` und Phasen ohne Ordnung nach der Rohgruppierung des Kontrakts. `lead` = erster Eintrag des Stopps, wenn er eine Notiz ist. Schaubilder werden `ReportBlock::Figure` an ihrer Stelle; Notizen mit Ort werden Notizen des Code-Blocks ihrer Datei; `label` je Block 1, 2, … in Zeilenfolge.
6. **Review-Abschnitt:** `open` = Befunde ohne späteres `resolves`, `resolved` = mit (`resolved_by` = Nummer der Fix-Notiz); `stop` = Index des Stopps, in dessen Code-Block der Ort liegt; `by` = `#<Nr> <Stage>` der Review-Station; `figures` = Schaubilder von Review-Stationen. Ein offener Befund mit Ort in einem Code-Block erscheint dort zusätzlich als Notiz der Art `Finding` mit `open: Some(true)`. Keine Review-Station und keine Befunde → `review: None`.
6a. **Sichtabnahme:** `screens` = alle `report_screen`-Einträge der Phase in Nummernfolge als `ReportScreen`; Bild-Adressen wie AK 8, `narrow` = Breite ≤ 600 px; `by` = `#<Nr> <Stage>`.
7. `acceptance` = erste Station mit `by_user` der letzten Phase samt Zustand; `ReportPhaseState` aus den Stationen (keine gestartet → `NotStarted`, alle fertig → `Done`).
8. Bild-Adresse über `ArtifactServer::file_url` mit einem Handle aus `ViewHandles` für die Datei im Bericht-Ordner.
9. Befehle `report_load`, `report_of_session` nach Kontrakt, registriert, Wrapper in `src/lib/report.ts` (`loadReport`, `reportOfSession`, `onReportChanged` für `report://changed`); `pnpm bindings`.
10. `report-probe <DB-Kopie> <Umsetzungs-ID> view` druckt je Phase Kopfzeile (Dateien, +/−, Commits), Sichtabnahme (Bildschirm, Ansichten, Abweichung, Schritte), Stopps mit Blöcken (Pfad, +/−, Zeilenzahl je Art, Notizen mit Label und Zeilen) und Review; gegen eine Kopie mit der archivierten Umsetzung „Session-Dateien“ stimmen die Kopfzahlen eines Blocks mit `git show --numstat <Commit>` überein (Kopfzahl ≠ Zahl der Datei im Commit ist ein Fehler).
11. Ein Aufruf von `report_load` für eine Umsetzung mit 5 Phasen und 40 Einträgen dauert unter 1 s (Dauer druckt die Probe auf stderr); `pnpm check` grün.

## Checkliste

- [ ] `src-tauri/src/report/range.rs`: `pub struct RepoRange { repository_key, folder: PathBuf, from: String, to: Option<String> }`; `pub fn phase_ranges(...) -> Vec<RepoRange>`; `pub fn file_patch(range, path) -> Result<String, CommandError>`; `pub fn end_text(range, path) -> Option<String>`; `pub fn numstat(range) -> …`.
- [ ] `src-tauri/src/report/assemble.rs`: `pub fn assemble(view: &ImplementationView, entries: &[EntryRow], phases: &[PhaseRow], ctx: &AssembleContext) -> ReportView` mit Hilfsfunktionen `stops_of_phase`, `code_block`, `relocate`, `review_of_phase`; Git-Zugriffe nur über `range.rs`.
- [ ] `src-tauri/src/commands/report.rs`: `report_load`, `report_of_session`; in `lib.rs` registrieren.
- [ ] `src/lib/report.ts`: Wrapper samt Abo.
- [ ] `report-probe`: Unterbefehl `view`; `AGENTS.md` nachziehen.
- [ ] Doc: `docs/code-map.md` Zeile „Review-Bericht“ um `range.rs`, `assemble.rs`, Befehle und Wrapper ergänzen; `docs/glossary.md`: „Commit-Bereich (Phase)“, „Anker (Bericht)“.
- [ ] `pnpm check`.

## Report-Back
