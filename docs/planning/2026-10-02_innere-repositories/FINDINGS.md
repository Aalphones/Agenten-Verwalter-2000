# Findings — Innere Repositories

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 3: Phase 1 wurde auf der Privatmaschine gegen eine Nachbildung geprüft (Report-Back Phase 1). Der Lauf von `changes-probe` gegen die facepass-Datenbank-Kopie (Session `a6357b9c-…`, Wurzeln und Zuordnung zu `app-wt-gymid-2288`/`android-wt-gymid-2288`) fehlt noch — in die Abnahme auf dem Arbeitslaptop aufnehmen.
- [ ] → Phase 3: Auch die Abnahme von Phase 2 gegen facepass fehlt: `changes-probe <Kopie> a6357b9c-… session` (Eintrag `0:app-wt-gymid-2288` mit den Python-Dateien, kein `facepass/admin-app` o. ä.), dasselbe für `dd292f1c-…` (`0:android-wt-gymid-799` mit `TimedSessionActivity.kt`), Diff über `0:app-wt-gymid-2288` und die abgewiesenen Schlüssel — der Aufruf ist in `phase-2-changes.md` unter „Abnahmekriterien“.
- [ ] → Phase 3: Für `session_dirs` liegen die Bausteine bereit: `sources::scope_ticket_folders` (gemerkte plus aus geschriebenen Dateien) und `sources::sources` (alle Einträge samt inneren Ticket-Worktrees). `changes::folders_of` wird nur noch von `scan.rs` benutzt und kann mit dem Umbau entfallen.
- [x] → Phase 2: `inner_checkout` hält die Basis je (Ordner, Sekunde) fest, solange die App läuft — auch über einen Branch-Wechsel im inneren Repository hinweg (steht in ADR 020 unter Konsequenzen). Die Nachbildung zum Prüfen liegt unter `%TEMP%\verwalter-probe\` (`layout.sh` baut sie, `prepare.py <Kopie>` hängt sie an die jüngste Session).
