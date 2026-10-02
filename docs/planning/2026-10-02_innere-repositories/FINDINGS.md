# Findings — Innere Repositories

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 3: Phase 1 wurde auf der Privatmaschine gegen eine Nachbildung geprüft (Report-Back Phase 1). Der Lauf von `changes-probe` gegen die facepass-Datenbank-Kopie (Session `a6357b9c-…`, Wurzeln und Zuordnung zu `app-wt-gymid-2288`/`android-wt-gymid-2288`) fehlt noch — in die Abnahme auf dem Arbeitslaptop aufnehmen.
- [ ] → Phase 2: `inner_checkout` hält die Basis je (Ordner, Sekunde) fest, solange die App läuft — auch über einen Branch-Wechsel im inneren Repository hinweg (steht in ADR 020 unter Konsequenzen). Die Nachbildung zum Prüfen liegt unter `%TEMP%\verwalter-probe\` (`layout.sh` baut sie, `prepare.py <Kopie>` hängt sie an die jüngste Session).
