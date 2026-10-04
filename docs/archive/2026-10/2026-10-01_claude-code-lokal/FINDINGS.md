# Findings — Claude Code mit lokalem Modell

Erkenntnisse während der Umsetzung, je eine Zeile, getaggt mit der Phase, die sie aufgreift: `- [ ] → Phase N: <Erkenntnis>`. Erledigt → `[x]`.

- [x] → Phase 2: TL;DR-Variante A (`structured_output` kam im lokalen Betrieb, M4).
- [x] → Phase 2: Mit den beiden Schaltern ging in fünf Läufen nichts außer Loopback; ohne sie gehen GitHub und `2607:6bc0::10` an. ADR 016 „Konsequenzen“: Messung mit 200-ms-Abtastung, keine Garantie.
- [x] → Phase 2: Fortsetzen einer Claude-Session mit dem lokalen Modell geht (M5), ist aber langsam (erstes Token nach 224 s) und löst eine `compact`-Anfrage aus. ADR 016 „Konsequenzen“; Smoke 1 erwartet Erfolg.
- [x] → Phase 2: Eingabegröße je Anfrage 31 000 bis 38 000 Token bei Kontext 64 000, erstes Token nach 45 bis 73 s. Risiko „Kontext läuft voll / lange Wartezeit“ in ADR 016 aufnehmen.
- [x] → Phase 3: M2 scheiterte einmal an `error_max_turns` (13,6 min, Modell rief endlos Werkzeuge auf), derselbe Aufruf gelang danach in 127 s. Das Modell ist nicht zuverlässig genug für lange Werkzeug-Ketten; in der Smoke-Checkliste Smoke 2 mit mehr als einer Wiederholung ansehen.
- [x] → Phase 3: Läuft das lokale Modell mit den Anweisungen des Benutzers, spottet es unaufgefordert in der Antwort (Persona). Kein Fehler, aber im Chat sichtbar.
