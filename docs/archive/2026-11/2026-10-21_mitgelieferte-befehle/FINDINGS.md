# Findings

Erkenntnisse während der Umsetzung, getaggt mit der Phase, die sie betreffen. Format:

- [ ] → Phase N: <Erkenntnis> (Fundstelle)

- [x] → Phase 1 Review (Commit f165e50): AK 1–8 am Diff abgeglichen, keine Abweichung, kein Scope-Drift, Doc-Updates (code-map, ADR 017) vorhanden. Keine CRITICAL/WARNING.
- [ ] → Phase 1 (MINOR): `compact_boundary` mit `trigger: "manual"` geht aus dem Thread raus, bevor das Hauptprogramm das Transkript umschreibt (`session.rs` `start_compact` vs. `replace_history`). Scheitert das Umschreiben, steht die Trennzeile schon im Strom, und danach kommt ein Fehler. Selten; beim Plan Warnhinweise (Trennlinie im Verlauf) im Auge behalten.
- [ ] → Phase 1 (Konfidenz): `pnpm check` nicht selbst neu gelaufen, Grün stammt aus dem Bericht der Umsetzung. Smoke-Punkt 3 (kurze Session, `/compact`) ist offen.

- [x] → Phase 2 Review (Commit a397694): AK 1–8 am Diff abgeglichen, keine Abweichung, kein Scope-Drift; Doc-Updates (codex-app-server, code-map, ADR 031) vorhanden. Keine CRITICAL/WARNING. Turn-IDs beim Review gegen `artifacts/codex-probe.log` geprüft: `turn/started` (B) überschreibt die ID aus der Antwort (A) – richtig für `turn/interrupt`; `turn_completed` prüft keine ID, daher schadet das `turn/completed` mit A nicht. Reihenfolge beim Zusammenfassen (`tokenUsage/updated` vor `item/completed`) passt zu `pre`/`post`.
- [ ] → Phase 2 (MINOR): Esc bei `/codex-review` vor dem `turn/started` schickt `turn/interrupt` mit der Antwort-ID A (äußerer Turn), nicht B; Codex könnte das ignorieren, dann läuft der Review weiter, obwohl `result_aborted` raus ist (`session.rs` `start_review`/`interrupt`). Beim Review die ID erst mit `turn/started` setzen oder in diesem Fenster nicht unterbrechen. Von der Probe nicht abgedeckt.
- [ ] → Phase 2 (INFO): `review/start` trägt weder Sandbox-/Freigaberichtlinie (`policy::turn_policy`) noch Modell/Aufwand; „Ändere nichts“ steht nur im Text der Anweisung. Plan-konform, aber der Review läuft mit den Thread-Vorgaben. Beim Smoke prüfen.
- [ ] → Phase 2 (Konfidenz): `pnpm check` nicht selbst gelaufen (Grün aus dem Bericht). Offen: Smoke gegen echtes Codex (Esc im Review-Fenster vor `turn/started`; `/compact` auf kurzer Session → `post_tokens` ≠ 0).

- [x] → Phase 3 Review (Commit b687064): AK 1–7 am Diff abgeglichen, keine Abweichung, kein Scope-Drift; ADR 034, ADR-007-Zusatz, code-map und claude-stream-json vorhanden. `apply_event` hat nur den Aufrufer in `update`, Speichern liegt nach der Sperre. Keine CRITICAL/WARNING.
- [ ] → Phase 3 (INFO): `names_for` verschluckt Lesefehler der Datenbank still (`unwrap_or_default`), wie die AK es für „unlesbar“ verlangt; ein defekter Wert fällt nirgends auf. Kein Handlungsbedarf.
- [ ] → Phase 3 (Konfidenz): `pnpm check` nicht selbst gelaufen (Grün aus dem Bericht); Menü gegen echte `system/init`-Liste nicht gesehen (Smoke 4/5 gehören zu Phase 4).

- [x] → Phase 4 Review (Commit 22fbc34, Tag v0.52.0 auf 47ca5c0): AK 1–6 am Diff abgeglichen, keine Abweichung, kein Scope-Drift; glossary und code-map nachgezogen. `pnpm check` selbst gelaufen: grün auf HEAD 9e469b6 (der Tag liegt einen Lint-Fix davor, der Fix betrifft nur `eslint.config.js`). Keine CRITICAL/WARNING.
- [x] → Gesamtplan gegen finale AK 1–6 (README): Menü-Aufbau (Abschnitte, Marke, Filter, Neue Session, Session-Befehl oben) im Code belegt; AK 1–3 in der Menülogik, AK 4–6 laut Phasen-Reviews 1–3 erfüllt.
- [ ] → Gesamtplan (Konfidenz): Smoke-Liste 1–9 ohne Oberfläche nicht durchführbar, alle offen. Zuerst Punkte 1 und 2 (Esc im Codex-Review, Sandbox-Zugriff des Reviews) und 3 (`/compact` in kurzer Autark-Session); sie entscheiden, ob die zwei MINOR/INFO aus Phase 2 echte Fehler sind.
