# 058 — Automatisch zusammenfassen in Stationen

**Status:** angenommen · **Datum:** 2026-11-06

## Kontext

Stationen einer Umsetzung verbrauchen das meiste Kontingent über lange Verläufe: Jeder Aufruf liest den ganzen Verlauf neu. Messung vom 06.11.2026 an 14 Stationen zweier Umsetzungen: Ø 225k Kontext je Aufruf, 5 von 12 Stationen über 300k, Spitze 468k; eine Station läuft als ein Durchlauf mit 50–128 Aufrufen. Claude Code fasst von sich aus erst kurz vor 967k zusammen.

## Optionen

- **(a) Globale Einstellung in `~/.claude/settings.json`** — verworfen: wirkt auch in Einzel-Sessions, die der Benutzer selbst mit `/compact` steuert.
- **(b) Der Verwalter schickt `/compact`** — verworfen: Eine Station ist ein einziger Durchlauf, zwischen Durchläufen gäbe es keinen Zeitpunkt.
- **(c) Umgebungsvariable `CLAUDE_CODE_AUTO_COMPACT_WINDOW` je Stationsprozess** — gewählt.

## Entscheidung

- Der Verwalter setzt beim Start des Claude-Prozesses einer Station `CLAUDE_CODE_AUTO_COMPACT_WINDOW = Schwelle + 33 000`. Das Zusammenfassen selbst macht Claude Code mitten im Durchlauf (Probe vom 06.11.2026: `compact_boundary` mit `trigger: "auto"` vor der `result`-Zeile). Der Abstand von 33 000 ist gemessen: 283 000 → Schwelle 250 000, 280 000 → 247 000.
- Erkennungsmerkmal einer Station ist `SessionState.station_of.is_some()`. Einzel-Sessions und Nebenfragen bekommen die Variable nie.
- Nur Betriebsart Claude; bei LM Studio, Autark und Codex bleibt sie weg.
- Einstellungen `autoCompactStations` (Standard an) und `autoCompactThreshold` (Standard 250 000, Bereich 150 000–500 000, Schritt 10 000). Darunter bleibt nach dem Zusammenfassen kaum Arbeitsraum, weil eine Station schon mit 95–110k startet; darüber spart es kaum noch.
- Wirkung ab dem nächsten Prozessstart einer Station; ein laufender Prozess behält seinen Wert.

## Konsequenzen

- Keine Migration; die Werte liegen in der Tabelle der Einstellungen.
- Eine Zusammenfassung verliert Einzelheiten und macht den Prompt-Cache der Station kalt.
- Neue Komponente `Slider` (speichert erst beim Loslassen).
