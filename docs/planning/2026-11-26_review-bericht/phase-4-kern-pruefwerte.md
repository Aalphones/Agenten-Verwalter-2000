# Phase 4 — Kern: Prüfwerte aus Läufen und Berichtsdateien

Rating: standard. Am Phasenende ermittelt der Verwalter ohne Werkzeug-Aufruf Prüfkette, Tests, Abdeckung der neuen Zeilen und Mutation einer Phase und hängt sie an den Bericht: als Zahlen je Phase, als gelber Rand an Zeilen ohne Test und als Notizen „M…“ für überlebte Mutanten.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt: Typen `PhaseChecks`, `CheckRun`, `TestCounts`, `CoverageCounts`, `MutationCounts`, `CheckGap`; „Von mir gesetzt“ (Ort der Berichtsdateien, keine Schwellen)
- Entwurf `artifacts/_review-bericht-entwurf/review.js` (`withChecks`, `phaseGaps`, `checksHtml`) und `daten.js` (Felder `checks`, `mutants`, `cov`)
- `src-tauri/src/agents/event.rs` (`ChatEntry::Tool`, `ToolState`), `src-tauri/src/retro/tools.rs` (`describe_shell`, `command_words`: wie Befehle zerlegt werden)
- Phase-2/3-Dateien `src-tauri/src/report/mod.rs` (`run_phase_end`), `range.rs`, `assemble.rs`
- Fehlerklassen geprüft: keine einschlägig.

## AK

1. **Prüfkette:** letzter `ChatEntry::Tool` der Sessions der Phase mit `tool` `Bash` oder `PowerShell`, dessen ganzer Befehl (`tool_details.input`, ohne gespeicherte Eingabe das `target`) nach Entfernen von Heredocs, Here-Strings und Texten in Anführungszeichen und nach Vereinheitlichung (Leerraum zusammengezogen, klein) einen der Befehle `pnpm check`, `pnpm run check`, `npm run check`, `yarn check`, `cargo clippy`, `cargo test`, `ruff check`, `pytest`, `go vet`, `go test`, `gradlew check`, `make check`, `check.ps1` enthält; `ok = state == Done`, `command` = der gefundene Befehl. Kein Treffer → `chain: None`.
2. **Berichtsdateien:** Suche in den Ordnern der Commit-Bereiche der Phase bis Tiefe 6, ohne `.git`, `node_modules`, `.venv`, `venv`, `__pycache__`; nur Dateien, deren Änderungszeit zwischen Start der ersten Station und 5 Minuten nach dem Ende der letzten liegt. Muster: JUnit `junit*.xml`, `*junit*.xml`, `TEST-*.xml`, `test-results*.xml`; LCOV `lcov.info`; Mutation `mutants.out/outcomes.json` (cargo-mutants) und `mutation.json` bzw. `mutation-report.json` (Stryker). `sources` = Dateinamen in Fundreihenfolge.
3. **JUnit:** je Datei die Attribute `tests`, `failures`, `errors`, `skipped` des Elements `<testsuites>` bzw. ohne dieses die Summe aller `<testsuite>`-Elemente (per `regex`, keine neue Abhängigkeit); `passed = tests − failures − errors − skipped`, `failed = failures + errors`.
4. **Abdeckung:** aus LCOV (`SF:`-Abschnitte, `DA:<zeile>,<treffer>`) nur die in der Phase **neu hinzugefügten** Zeilen (`Add`-Zeilen der Patches aus `range.rs`), die LCOV als ausführbar führt; `covered`/`total`; je Datei die nicht ausgeführten neuen Zeilen als `CheckGap::Uncovered` (zusammenhängende Zeilen zu einem Bereich).
5. **Mutation:** überlebte Mutanten in Dateien der Phase als `CheckGap::Mutant` mit Zeile und Text `„<ursprünglich>“ → „<Ersatz>“` (Stryker: `status == "Survived"`, `location.start.line`, `mutatorName`/`replacement`); `killed`/`survived` über alle Mutanten dieser Dateien. Format von cargo-mutants vorher an einem Beispiel der Doku prüfen; passt es nicht zu `outcomes[].summary` (`CaughtMutant`/`MissedMutant`) samt Datei und Zeile, wird nur Stryker ausgewertet und das in FINDINGS.md vermerkt.
6. `by` = `#<Nr> <Stage>` der Station, aus deren Session der Prüfketten-Lauf stammt, sonst der letzten Station mit Session.
7. `run_phase_end` (Phase 2) ermittelt nach der Ordnung die Prüfwerte, speichert sie als JSON in `report_phases.checks` samt `checks_at` und sendet `report://changed`; `report_retidy` tut beides.
8. `assemble` (Phase 3) setzt `PhaseChecks` an die Phase, `uncovered` an jeden Code-Block (Zeilen der Gaps dieser Datei im Block) und Mutanten als `ReportNote` mit `kind: Mutant`, `label: "M1"`, `entry: None` an den Block, der die Zeile zeigt.
9. `report-probe … checks <Phasen-Key>` druckt gefundene Dateien, Zahlen und Gaps, ohne zu speichern; `pnpm check` grün.

## Checkliste

- [x] `src-tauri/src/report/checks.rs`: `pub const CHECK_COMMANDS: &[&str]`; `pub fn chain(entries_by_session) -> Option<(CheckRun, String)>`; `pub fn find_files(folders, since, until) -> Vec<PathBuf>`; `pub fn parse_junit(text) -> Option<TestCounts>`; `pub fn parse_lcov(text) -> HashMap<String, HashMap<u32, u32>>`; `pub fn parse_stryker(text) -> Vec<Mutant>`; `pub fn parse_cargo_mutants(text) -> Vec<Mutant>`; `pub fn phase_checks(...) -> PhaseChecks`.
- [x] Pfade aus LCOV und Mutationsberichten relativ zum Repository-Ordner vereinheitlichen (absolute Pfade abschneiden, `\` → `/`).
- [x] `src-tauri/src/db/report.rs`: `pub fn store_checks(connection, phase_id, implementation_id, checks_json)`.
- [x] `run_phase_end` und `assemble` erweitern; `report-probe` Unterbefehl `checks`; `AGENTS.md` nachziehen.
- [x] Doc: `docs/code-map.md` Zeile „Review-Bericht“ um `checks.rs`; `docs/glossary.md`: „Prüfwerte“.
- [x] `pnpm check`.

## Report-Back

Status: complete.

**Abweichungen von AK und Checkliste:**

- AK 1 (Entscheidung des Benutzers): Die Prüfkette wird am ganzen Befehl erkannt statt am gekürzten `target` (erste Zeile, höchstens 120 Zeichen) — an der Kopie der Datenbank 2826 statt 684 Läufe. Heredocs, Here-Strings und Texte in Anführungszeichen zählen nicht mit. Ohne gespeicherte Eingabe gilt das `target`. Die Befehlsliste enthält zusätzlich `check.ps1`, die Prüfkette dieses Projekts.
- `chain` und `PhaseEvidence.sessions` nehmen statt `(Session-ID, Verlauf)` ein `SessionLog` (Session-ID, Verlauf, Werkzeug-Details); `registry.history_of` lieferte die Details schon.
- AK 5: cargo-mutants passt zu `outcomes[].summary` samt `scenario.Mutant` (Datei, Zeile, Ersatz) — am Quelltext von cargo-mutants geprüft, nicht an einer echten Ausgabe. Gezählt werden nur `CaughtMutant`/`MissedMutant` und Stryker `Killed`/`Survived`; Zeitüberschreitung, nicht ausführbar und ohne Abdeckung zählen nicht.
- AK 7: Scheitern Ordnung und Prüfwerte beide, wird der zweite Fehler nur protokolliert; zurückgegeben wird der erste. `report://changed` kommt nach der Ordnung und nach den Prüfwerten.
- `report-probe … view` zeigt zusätzlich die Prüfwerte und je Block „ohne Test“.

**Belegt** (nachgestellte Berichtsdateien in einem Klon, Kopie der Datenbank): JUnit in pytest- und Vitest-Form (10 bestanden, 2 fehlgeschlagen, 3 übersprungen; CDATA, ältere Datei und `node_modules` ausgeschlossen); LCOV mit absolutem Pfad mit `\` und relativem Pfad (5 von 12 neuen Zeilen, nicht neue Zeile nicht gezählt); Stryker (Spalte mit Nicht-ASCII) und cargo-mutants (1 erkannt, 2 überlebt, Original aus der Datei); `view` mit `ohne Test: [6, 7, 8]` und `M1`; neue Erkennung an der Kopie: Phase 1 `check.ps1`, Phase 2 `pnpm check`; `pnpm check` grün.

**Nicht gelaufen:** echte Ausgabe von cargo-mutants und Stryker; der Weg in der laufenden App (`run_phase_end`, `report_retidy`).
