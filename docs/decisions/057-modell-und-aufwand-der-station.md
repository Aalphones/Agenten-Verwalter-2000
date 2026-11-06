# 057 — Modell und Denkaufwand der Station auf der Karte

**Status:** angenommen · **Datum:** 2026-11-06

## Kontext

Die Karte einer Station zeigt weder das Modell noch den Denkaufwand. Der Plan trägt zwar `model` je Station ([ADR 048](048-umsetzung.md)), aber keinen Aufwand, und wer vor dem Start etwas ändern will, muss die Station erst starten und dann in der Session umstellen.

## Optionen

- **(a) Nur die Ist-Werte der Session anzeigen** — verworfen: vor dem Start gibt es keine Session, und der Aufwand ließe sich nicht planen.
- **(b) Plan-Aufwand als Feld der Station (`effort`), Ist-Werte aus der Session** — gewählt.
- **(c) Live-Werte im Kern zusätzlich an der Station führen** — verworfen: `SessionSummary` hält Modell und Aufwand schon, eine zweite Wahrheit liefe auseinander.

## Entscheidung

- Jede Station bekommt ein optionales Feld `effort` (`low` … `max`) neben `model`; `NULL` heißt Standard der Session. Der Agent kann es in `implementation_create` und `implementation_set_phases` setzen, ein unbekannter Wert wird mit Feldnamen gemeldet.
- Der Start setzt nach dem Modell auch den Aufwand, wenn er vom Aufwand der frischen Session abweicht. Fix-Runden-Stationen erben `effort` wie `model`.
- Neuer Befehl `implementation_set_station_plan` ändert `model` und `effort` einer Station ohne Session, die nicht fertig ist; bei begonnenen Stationen und Stationen des Benutzers gibt er einen Fehlertext zurück.
- Die Ist-Werte kommen aus der Session (`SessionSummary`), nicht aus der Station.

## Konsequenzen

- Migration 018 (`implementation_stations.effort`); bestehende Stationen haben `NULL`.
- Die Oberfläche (Phase 2) kann Plan und Ist nebeneinander zeigen und vor dem Start ändern.
