# 061 — Schlanke Werkzeuge in Stationen

**Status:** angenommen · **Datum:** 2026-11-12

## Kontext

Jede Anfrage einer Station schickt die Beschreibungen aller eingebauten Werkzeuge von Claude Code mit. Messung vom 10.11.2026 (Claude Code 2.1.322, `claude -p` im stream-json-Modus, Modell Sonnet): „System tools“ **21 110** Tokens mit den Startargumenten des Verwalters, **4 357** mit `--disallowedTools Artifact,Workflow,ScheduleWakeup,ReportFindings,ShareOnboardingGuide,ListAgents`. Allein `Artifact` kostet 11 410. Eine echte Anfrage: Eingabe gesamt 55 790 Tokens ohne, 38 154 mit Sperre.

## Optionen

- **(a) Erlaubnisliste (`--tools`)** — verworfen: spart gemessen gleich viel (4 357), nimmt aber ein neues, nötiges Werkzeug nach einem Update von Claude Code still weg.
- **(b) Sperrliste (`--disallowedTools`)** — gewählt: ein neues Werkzeug bleibt nutzbar, im schlimmsten Fall kostet es Tokens.
- **(c) Nichts tun** — verworfen: rund 17 000 Tokens je Anfrage ohne Nutzen.

## Entscheidung

- Stationen der Betriebsart Claude (`SessionState.station_of.is_some()`, kein lokales Backend, kein Codex) starten mit `--disallowedTools Artifact,Workflow,ScheduleWakeup,ReportFindings,ShareOnboardingGuide,ListAgents`. Die Liste ist die Konstante `STATION_DISALLOWED_TOOLS` in `process.rs`, ohne Einstellung.
- Nebenfragen an eine solche Station bekommen dieselbe Sperre, sonst verfehlen sie deren Prompt-Cache (ADR 044).
- Einzel-Sessions, LM Studio, Autark und Codex bleiben unverändert.
- `CLAUDE_CODE_ARTIFACT=1` bleibt gesetzt; die Sperre wirkt danach.
- Bash und PowerShell bleiben beide, weil die Windows-Regeln des Benutzers je nach Aufgabe die eine oder die andere verlangen.
- Der Satz zum Veröffentlichen im Artefakt-Prompt entfällt in Stationen.

## Konsequenzen

- Die Liste ist zu pflegen, wenn Claude Code ein Werkzeug umbenennt: Die Sperre greift dann still nicht mehr, es kostet nur Tokens (erkennbar am Balken „Systemwerkzeuge“ im Kontext-Panel).
- Stationen können keine Artefakte veröffentlichen; das bleibt Einzel-Sessions vorbehalten.
- Eine laufende Station behält ihre Argumente bis zum nächsten Prozessstart; eine Nebenfrage an sie sperrt sofort und verfehlt einmal den Cache.
- Eine Fortsetzung (`--resume`) mit gesperrtem, früher benutztem Werkzeug funktioniert (gemessen).
