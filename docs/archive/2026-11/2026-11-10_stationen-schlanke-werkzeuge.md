# Stationen ohne selten genutzte Werkzeuge

Jede Anfrage einer Station schickt die Beschreibungen aller eingebauten Werkzeuge von Claude Code mit. Sechs davon braucht eine Station nie, sie kosten zusammen rund 17 000 Tokens pro Anfrage, allein das Artefakt-Werkzeug gut 11 000. Der Verwalter startet Stationen künftig mit `--disallowedTools` für diese sechs; die Werkzeuge verschwinden damit aus dem Kontext, nicht nur aus den Rechten.

## Overview

| Phase | Inhalt | Rating | Modell | Schätzung | Status |
|---|---|---|---|---|---|
| 1 | Sperrliste für Stationen und ihre Nebenfragen, ADR 061 | standard | sonnet | 1 h | done |

## Messung (Stand 10.11.2026, Claude Code 2.1.322)

Gemessen mit `claude -p` im stream-json-Modus, leerem Arbeitsordner, `--strict-mcp-config`, `CLAUDE_CODE_ARTIFACT=1`, Modell Sonnet. Skripte und Rohdaten lagen im Scratchpad der Planungs-Session; die Zahlen hier sind die Quelle.

- `get_context_usage` mit den Startargumenten des Verwalters (`--permission-prompt-tool stdio`): Kategorie „System tools“ **21 110** Tokens. Mit `--disallowedTools Artifact,Workflow,ScheduleWakeup,ReportFindings,ShareOnboardingGuide,ListAgents`: **4 357**. Mit `--tools` und der Liste aller übrigen Werkzeuge: ebenfalls **4 357**. Nur `--disallowedTools Artifact`: **9 700**. Der Systemprompt sinkt jeweils um rund 200 Tokens, „System tools (deferred)“ von 23 509 auf 16 943 (mit Artifact fallen `ArtifactComments` und `ArtifactData` weg).
- Echte Anfrage („Nenne die Namen aller Werkzeuge …“, `--output-format json`): Eingabe gesamt **55 790** Tokens ohne Sperre, **38 154** mit Sperre der sechs. Das Modell sah mit Sperre weiter `Agent, Bash, Edit, Glob, Grep, PowerShell, Read, Skill, ToolSearch, Write`.
- Einzelkosten (je ein Werkzeug weniger als alle): Artifact 11 410, PowerShell 3 746, Workflow 1 979, Agent 1 721, ScheduleWakeup 1 695, Bash 1 480, Grep 1 276, ReportFindings 821, Read 712, ShareOnboardingGuide 491, ListAgents 357. Die Werte addieren sich nicht, weil Beschreibungen aufeinander verweisen; maßgeblich ist die Messung der ganzen Sperrliste oben.
- Fortsetzen: Eine Session rief `ListAgents` auf und wurde danach mit `--resume … --disallowedTools ListAgents` fortgesetzt — Antwort ohne Fehler. Alte Aufrufe eines gesperrten Werkzeugs im Verlauf stören also nicht.

## Entscheidungen (getroffen, nicht offen)

- **Nur Stationen der Betriebsart Claude** (`SessionState.station_of.is_some()`, kein lokales Backend, kein Codex) und deren Nebenfragen. Einzel-Sessions behalten alle Werkzeuge, dort entscheidet der Benutzer. LM Studio, Autark und Codex bleiben unverändert: Der autarke Agent und der Codex-Übersetzer lesen die Argumente selbst (`standalone/args.rs`), eine unbekannte Option dort ist nicht geprüft.
- **Nebenfragen bekommen dieselbe Sperre wie ihre Station**, sonst verfehlen sie deren Prompt-Cache (ADR 044). Bedingung in `side.rs` wie bei `station_style` dort: `state.station_of.is_some() && backend.is_none()`.
- **Sperrliste (`--disallowedTools`), nicht Erlaubnisliste (`--tools`).** Beide sparen gemessen gleich viel. Bei der Sperrliste bleibt ein Werkzeug, das ein Update von Claude Code neu bringt, nutzbar; im schlimmsten Fall kostet es Tokens. Eine Erlaubnisliste würde ein neues, nötiges Werkzeug still wegnehmen. Fehlerrichtung „kostet mehr“ ist besser als „Station kann etwas nicht mehr“.
- **Gesperrt werden genau diese sechs, mit Grund:**
  - `Artifact` — veröffentlicht Seiten bei claude.ai. Stationen legen Artefakte als Dateien in `.artefakte` ab (Anweisung des Verwalters); veröffentlichen entscheidet der Benutzer in einer Einzel-Session. `CLAUDE_CODE_ARTIFACT=1` bleibt gesetzt: Die Variable schaltet das Werkzeug unter `-p` für Einzel-Sessions überhaupt erst ein (Kommentar in `common_args`), die Sperre wirkt danach.
  - `Workflow` — startet Schwärme von Unteragenten; in Stationen ist das nicht vorgesehen, die Rollen laufen als eigene Stationen.
  - `ScheduleWakeup` — nur für `/loop` im dynamischen Modus; eine Station ist ein einziger Durchlauf.
  - `ReportFindings` — gehört zum eingebauten Befehl `/code-review`. Die Skills, mit denen Stationen starten (`implement`, `review`), nennen das Werkzeug nicht (geprüft am 10.11.2026).
  - `ShareOnboardingGuide` — lädt eine `ONBOARDING.md` hoch; keine Stationsaufgabe.
  - `ListAgents` — listet andere Sessions zum Anschreiben; Stationen sprechen nur über die Werkzeuge des Verwalters.
- **Bash und PowerShell bleiben beide**, obwohl PowerShell allein rund 3 700 Tokens kostet: Die Windows-Regeln des Benutzers verlangen je nach Aufgabe die eine oder die andere Shell (`.sh` nur über Bash, Windows-native Arbeit über PowerShell).
- **Kein Schalter in den Einstellungen.** Die Liste ist eine Konstante in `process.rs`; rückgängig machen heißt die Konstante leeren. Vorbild: der Stationsstil hat auch keine eigene Einstellung.
- **Satz zum Veröffentlichen entfällt in Stationen.** `artifacts_prompt` hängt „Soll eine Seite zusätzlich veröffentlicht werden, veröffentliche die Datei aus diesem Ordner.“ an, wenn `can_publish` wahr ist. Mit Sperre gibt es kein Werkzeug dafür, der Satz würde ins Leere zeigen. `can_publish` wird zu `opts.local.is_none() && opts.codex_exe.is_none() && !opts.lean_tools`.
- **Argument als ein Wert mit Kommas.** `--disallowedTools` nimmt wie `--allowedTools` mehrere Werte, bis die nächste Option kommt. Ein einzelner Wert `Artifact,Workflow,…` ist gemessen wirksam (siehe oben). Es steht direkt hinter dem `--settings`-Block für den Stationsstil, also vor `--permission-mode`, das die Liste beendet.

## Kontrakt

```rust
// src-tauri/src/agents/claude/process.rs
/// Werkzeuge, die eine Station nie braucht; sie fehlen dann auch im Kontext (ADR 061).
pub(crate) const STATION_DISALLOWED_TOOLS: &[&str] = &[
    "Artifact", "Workflow", "ScheduleWakeup", "ReportFindings", "ShareOnboardingGuide", "ListAgents",
];
pub struct SpawnOptions { /* … */ pub lean_tools: bool }
// common_args: if opts.lean_tools { command.arg("--disallowedTools").arg(STATION_DISALLOWED_TOOLS.join(",")); }
```

## Phase 1 — Sperrliste für Stationen und ihre Nebenfragen

### Kontext (lesen vor dem Start)

- `src-tauri/src/agents/claude/process.rs`: `SpawnOptions` (Zeile 18–54), `common_args` (Zeile 151–236, besonders der Block `if opts.local.is_none()` mit `station_style` Zeile 154–172 und der Aufruf von `artifacts_prompt` Zeile 203–209), `artifacts_prompt` (Zeile 266–295), Tests am Dateiende (`options`, `args`, `station_style_adds_settings_argument`).
- `src-tauri/src/sessions/registry.rs` Zeile 3873–3911: wie `auto_compact_window` und `station_style` für den Start einer Session berechnet und übergeben werden.
- `src-tauri/src/sessions/registry/side.rs` Zeile 84–135: dieselbe Berechnung für Nebenfragen, mit dem Hinweis auf ADR 044.
- `src-tauri/examples/side-probe.rs` Zeile 96: baut `SpawnOptions` von Hand.
- `docs/decisions/058-auto-zusammenfassen-in-stationen.md` als Muster für das neue ADR.
- `docs/conventions/rust.md`, `docs/conventions/commits.md`.

### AK

1. Eine Station der Betriebsart Claude startet mit `--disallowedTools Artifact,Workflow,ScheduleWakeup,ReportFindings,ShareOnboardingGuide,ListAgents`; eine Einzel-Session startet ohne `--disallowedTools`.
2. Eine Nebenfrage an eine Station der Betriebsart Claude bekommt dasselbe Argument; eine Nebenfrage an eine Einzel-Session nicht (`side.rs` setzt `lean_tools` mit derselben Bedingung wie `station_style` dort).
3. Stationen mit lokalem Backend (LM Studio, Autark) oder Codex starten ohne `--disallowedTools` (Bedingung in `registry.rs` enthält `backend.is_none() && codex_exe.is_none()`).
4. Der Artefakt-Prompt einer Station enthält den Satz „Soll eine Seite zusätzlich veröffentlicht werden“ nicht; der einer Einzel-Session der Betriebsart Claude enthält ihn weiter.
5. Im Kontext-Panel einer neu gestarteten Station zeigt „Systemwerkzeuge“ mindestens 15 000 Tokens weniger als eine Einzel-Session im selben Vorhaben.
6. `pnpm check` ist grün.

### Checkliste

- [x] `process.rs`: Konstante `STATION_DISALLOWED_TOOLS` und Feld `SpawnOptions.lean_tools` mit Doc-Kommentar („Nur Stationen in der Betriebsart Claude (ADR 061): selten genutzte Werkzeuge sperren, damit ihre Beschreibungen nicht in jeder Anfrage mitgehen.“).
- [x] `process.rs` `common_args`: im Block `if opts.local.is_none()` direkt nach dem `station_style`-Block `if opts.lean_tools { command.arg("--disallowedTools").arg(STATION_DISALLOWED_TOOLS.join(",")); }` mit Kommentar, dass `--permission-mode` die Werteliste beendet.
- [x] `process.rs` `common_args`: zweites Argument von `artifacts_prompt` wird `opts.local.is_none() && opts.codex_exe.is_none() && !opts.lean_tools`.
- [x] `registry.rs` bei Zeile 3882: `let lean_tools = state.station_of.is_some() && backend.is_none() && codex_exe.is_none();` mit Kommentar „Nur Stationen sperren selten genutzte Werkzeuge (ADR 061).“, an `SpawnOptions` übergeben.
- [x] `side.rs` bei Zeile 89: `let lean_tools = state.station_of.is_some() && backend.is_none();`, an `SpawnOptions` übergeben mit Kommentar „Gleiche Werkzeuge wie die Station, sonst verfehlt die Frage deren Cache (ADR 044).“
- [x] `examples/side-probe.rs` Zeile 96 und die Test-Hilfsfunktion `options` am Ende von `process.rs`: `lean_tools: false` ergänzen, damit beide weiter kompilieren. Keine neuen Tests.
- [x] `docs/decisions/061-schlanke-werkzeuge-in-stationen.md` nach Muster von ADR 058: Kontext (Messung oben), Optionen (Erlaubnisliste, Sperrliste, nichts tun), Entscheidung, Konsequenzen (Liste pflegen, wenn Claude Code Werkzeuge umbenennt; Stationen können nicht mehr veröffentlichen).
- [x] `docs/knowledge/claude-stream-json.md`: unter „Kontext und Kontingent abfragen“ einen Absatz „Werkzeugkosten“ mit den Messwerten dieses Plans und dem Befund, dass `--disallowedTools` Werkzeuge aus dem Kontext nimmt und eine Fortsetzung mit gesperrtem, früher benutztem Werkzeug funktioniert.
- [x] `docs/glossary.md` Eintrag **Station**: Satz anhängen „Stationen der Betriebsart Claude starten ohne selten genutzte Werkzeuge ([ADR 061](decisions/061-schlanke-werkzeuge-in-stationen.md)).“
- [x] `docs/code-map.md` Zeile „Umsetzung“ (Zeile 45): Verweis auf ADR 061 neben ADR 058 ergänzen.
- [x] `pnpm check` grün.

### Report-Back

Umgesetzt wie geplant; `pnpm check` Exit 0. AK 1–4 und 6 am Code geprüft (Argumentliste, Bedingungen), AK 5 (Kontext-Panel einer neu gestarteten Station) nicht live geprüft. Keine neuen Tests. Die Code-Map-Zeile „Umsetzung“ nannte ADR 058 nicht, ADR 061 steht dort neben ADR 048.

## Finale AK

Wie AK 1–6 von Phase 1, dazu: ADR 061 liegt vor, Glossar, Code-Map und `claude-stream-json.md` sind nachgezogen, Version ist nach `docs/conventions/releases.md` angehoben und getaggt.

## Risiken

- 🟡 Ein Update von Claude Code benennt ein Werkzeug um: Die Sperre greift dann still nicht mehr, es kostet nur wieder Tokens, es geht nichts kaputt. Erkennbar am Balken „Systemwerkzeuge“ im Kontext-Panel einer Station.
- 🟡 Ein künftiger Skill einer Station braucht eines der sechs Werkzeuge: Er bekommt dann „Werkzeug nicht vorhanden“. Gegenmittel: Werkzeug aus der Konstante nehmen.
- 🟡 Eine Station, die vor dem Update gestartet wurde und noch läuft, behält ihre Argumente; erst der nächste Prozessstart sperrt. Eine Nebenfrage an so eine Station sperrt sofort und verfehlt einmal den Cache.

## Summary

Stationen der Betriebsart Claude und ihre Nebenfragen starten mit `--disallowedTools` für sechs selten genutzte Werkzeuge (ADR 061). Review ohne Befund.

## Files touched

`process.rs`, `registry.rs`, `registry/side.rs`, `examples/side-probe.rs`, ADR 061, `claude-stream-json.md`, Glossar, Code-Map.

## Commits

`888875d`

## Deviations from plan

Keine.

## Follow-ups

AK 5 (Systemwerkzeuge im Kontext-Panel einer neuen Station mindestens 15 000 Tokens kleiner als bei einer Einzel-Session) nicht live geprüft.
