# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` — getaggt auf die Phase, die sie aufnehmen muss.

- [x] → Phase 2: `files_since` zählt jede Datei aus `session_files` der Stationen der Phase, auch außerhalb jedes Repositorys. `tidy_at` ist der Zeitpunkt vor dem Lesen der Eingabe — `fresh` kann direkt dagegen vergleichen. Die Zeilen liegen als `AssembleContext.files` (`SessionFileRow`) vor.
- [ ] → Phase 4: In `src/lib/report.ts` fehlen die Wrapper für `report_cancel_tidy` und `report_tidying`; `onReportChanged` reicht nur die Umsetzungs-ID weiter, das Ereignis trägt auch `tidyingPhaseIds`. `report_retidy` geht auch für laufende Phasen. Nach einem Abbruch auf einer fertigen Phase bleibt die Phase noch als „wird geordnet“ gemeldet, bis die Prüfwerte ermittelt sind.
- [x] → Phase 3: `fresh` hängt an den Dateien aus `session_files`; was ein Befehl erzeugt (Bindings, Lock-Dateien), ist nie frisch. `derived_stops` läuft nach allen Stopps der Ordnung: was ein Stopp von Haiku zeigt, fällt dort automatisch weg. Die Indizes der Stopps aus dem Diff beginnen frühestens bei der Zahl der Stopps in der Antwort.
- [ ] → Phase 4: `ReportCode.repository_key` kann `extern:<Pfad>` sein — dazu gibt es keinen Eintrag in den Changes; „im Code öffnen“ und Kommentare auf Zeilen für diese Blöcke prüfen. Stopps aus dem Diff haben `by` leer.
- [ ] → Phase 4: `ReportWayStep.commit` bleibt bei `git commit -q` leer (in Station #14 alle drei Commits). Der Weg darf den Commit nicht voraussetzen; die Commits stehen verlässlich in `ReportPhase.repositories`.
- [ ] → Phase 4: Haikus Notiz am Stopp aus dem Diff hat `label: "H"` und `entry: None`, steht am ersten Code-Block und kann an einem Block mit `omittedRows > 0` (ohne Zeilen) hängen. Stopps ohne Notiz: „Keine Erklärung der Station · Haiku erklären lassen“.
