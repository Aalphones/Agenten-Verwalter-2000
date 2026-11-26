# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` (offen) bzw. `- [x] → Phase N: <Erkenntnis>` (eingearbeitet).

- [x] → Phase 2: Für die Rohfassung gibt es `raw::raw_markdown(phase_key, Einträge einer Phase, labels)` und `raw::session_labels(view, numbers)`. `StationView.session_number` ist nur für geladene Sessions gesetzt; `numbers` (Session-ID → Nummer) füllt die übrigen. `report-probe` verteilt die Unterbefehle per Muster über die Argumentliste.
- [ ] → Phase 3: Bilder liegen je Phase unter `report::phase_dir(app, implementation_id, phase_id)`, nicht direkt im Ordner der Umsetzung. `db::report::load_entries` liefert `EntryRow` sortiert nach Phasen-Position und Nummer; `screen` ist schon als `ScreenRow` gelesen.
- [ ] → Phase 3: `repository_key` eines Eintrags stammt aus `changes::sources` der Reichweite „Vorhaben“ der Stations-Session; `anchor_text` hat `\n` als Zeilenende und keines am Schluss — beim Wiederfinden im Endstand genauso vereinheitlichen.
- [ ] → Phase 3: `db::report::load_phases` liefert die Zeilen von `report_phases`. Eine Zeile kann bis auf die IDs leer sein (nichts zu ordnen). Ein Fehlschlag setzt nur `tidy_error`, eine frühere Ordnung bleibt stehen und gilt weiter. Die ID-Prüfung lässt einen Stopp ohne IDs durch; beim Zusammensetzen damit umgehen, ohne die Indizes von `way[].stop` zu verschieben. `tidy_json` liest sich als `report::tidy::TidyAnswer` (`StopKind::as_str`).
- [ ] → Phase 4: Die Prüfwerte hängen in `report::run_phase_end` hinter `tidy_phase`; ein Fehler der Ordnung darf sie nicht überspringen (heute bricht `?` ab). Die Sperre gegen Doppellauf (`TidyRuns`) liegt schon dort; `report://changed` kommt nach der Ordnung, nach den Prüfwerten braucht es ein zweites.
- [ ] → Phase 7: Die Abnahme-Station (`by: "you"`) löst keine Ordnung aus; die Phase ist beim Abnehmen schon geordnet.
- [ ] → Phase 8: Liegt dieselbe Datei im Hauptbaum und in einem Ticket-Worktree, ist ein relatives `at` nicht eindeutig; die Werkzeuge melden die Kandidaten und verlangen den absoluten Pfad. Skills für Arbeitsbaum-Projekte sollten gleich absolute Pfade nennen.
