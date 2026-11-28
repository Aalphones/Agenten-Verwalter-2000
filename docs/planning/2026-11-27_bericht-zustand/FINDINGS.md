# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` — getaggt auf die Phase, die sie aufnehmen muss.

- [ ] → Phase 2: `files_since` zählt jede Datei aus `session_files` der Stationen der Phase, auch außerhalb jedes Repositorys. `tidy_at` ist der Zeitpunkt vor dem Lesen der Eingabe — `fresh` kann direkt dagegen vergleichen. Die Zeilen liegen als `AssembleContext.files` (`SessionFileRow`) vor.
- [ ] → Phase 4: In `src/lib/report.ts` fehlen die Wrapper für `report_cancel_tidy` und `report_tidying`; `onReportChanged` reicht nur die Umsetzungs-ID weiter, das Ereignis trägt auch `tidyingPhaseIds`. `report_retidy` geht auch für laufende Phasen. Nach einem Abbruch auf einer fertigen Phase bleibt die Phase noch als „wird geordnet“ gemeldet, bis die Prüfwerte ermittelt sind.
