# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` (offen) bzw. `- [x] → Phase N: <Erkenntnis>` (eingearbeitet).

- [ ] → Phase 2: Für die Rohfassung gibt es `raw::raw_markdown(phase_key, Einträge einer Phase, labels)` und `raw::session_labels(view, numbers)`. `StationView.session_number` ist nur für geladene Sessions gesetzt; `numbers` (Session-ID → Nummer) füllt die übrigen. `report-probe` verteilt die Unterbefehle per Muster über die Argumentliste.
- [ ] → Phase 3: Bilder liegen je Phase unter `report::phase_dir(app, implementation_id, phase_id)`, nicht direkt im Ordner der Umsetzung. `db::report::load_entries` liefert `EntryRow` sortiert nach Phasen-Position und Nummer; `screen` ist schon als `ScreenRow` gelesen.
- [ ] → Phase 3: `repository_key` eines Eintrags stammt aus `changes::sources` der Reichweite „Vorhaben“ der Stations-Session; `anchor_text` hat `\n` als Zeilenende und keines am Schluss — beim Wiederfinden im Endstand genauso vereinheitlichen.
- [ ] → Phase 8: Liegt dieselbe Datei im Hauptbaum und in einem Ticket-Worktree, ist ein relatives `at` nicht eindeutig; die Werkzeuge melden die Kandidaten und verlangen den absoluten Pfad. Skills für Arbeitsbaum-Projekte sollten gleich absolute Pfade nennen.
