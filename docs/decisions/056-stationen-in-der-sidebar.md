# 056 — Aktive Stationen als Zeilen in der Sidebar

**Status:** angenommen · **Datum:** 2026-11-06

## Kontext

Der Weg in den Chat einer Station führte über zwei bis vier Klicks: Vorhaben aufklappen, Umsetzung öffnen, Station auf der Zeitleiste anwählen, „Chat öffnen“. Im Chat einer Station war in der Sidebar nichts markiert. [ADR 048](048-umsetzung.md) hatte der Station bewusst keine Zeile gegeben.

## Optionen

- **(a) Aktive Stationen als Zeilen unter ihrer Umsetzung** — gewählt: ein Klick bis in den Chat, die Markierung der Sidebar folgt der Station.
- **(b) Den Chat der Station in die Umsetzung einbetten** — verworfen: zwei Chat-Oberflächen mit eigenem Verlauf, Eingabe und Rückfrage-Kasten.
- **(c) Nur die Statuszeile am Vorhaben klickbar machen** — verworfen: trifft bei mehreren Stationen gleichzeitig nur eine, und der Weg zurück bleibt unmarkiert.

## Entscheidung

- **Aufgeklappt:** unter jeder Umsetzung stehen ihre aktiven Stationen (Zustand in `LIVE_STATES`) in Plan-Reihenfolge, eine Ebene tiefer. **Zugeklappt:** nur die in `NEEDS_USER_STATES` (fragt dich, wartet auf dich), auf Höhe der Umsetzungen.
- **Ein Klick** wählt die Session der Station; eine Station ohne Session („durch dich“) öffnet die Umsetzung mit ihrer Karte vorn (`useOpenStation`).
- **Genau eine Markierung:** im Chat einer Station ihre Stationszeile, sonst — fertig oder ohne Zeile — die Zeile ihrer Umsetzung.
- **Rückweg-Leiste:** über dem Chat einer Station führt eine schmale Leiste zurück zur Umsetzung und mit ‹ › zur vorigen bzw. nächsten aktiven Station (`StationTrail`).
- Ändert den Punkt „Sidebar“ aus ADR 048: Stationen bekommen weiterhin keine **Session**-Zeile, aktive aber eine Stationszeile.

## Konsequenzen

- Der Baum wird bei Wellen länger: je aktiver Station eine Zeile.
- `pending` und `done` bleiben draußen; fertige Stationen erreicht man weiter über die Zeitleiste.
- Keine Migration: die Zeilen werden aus der Ansicht der Umsetzung abgeleitet.
