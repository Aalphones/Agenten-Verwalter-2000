# Ohne Fundstelle

Ziel: Nach jeder Antwort des Agenten gleicht der Verwalter Pfade, Datei:Zeile-Angaben und Zahlen ab zwei Ziffern im Antworttext mit den Werkzeug-Ausgaben derselben Antwort und der Nachricht des Nutzers ab. Was nirgends vorkommt, bekommt eine gepunktete Unterstreichung mit Erklärung; die Abschlusszeile der Antwort zählt die Stellen. Rein mechanisch, kein Modell-Urteil. Entwurf: [artifacts/entwurf-ohne-fundstelle.html](artifacts/entwurf-ohne-fundstelle.html), vom User am 2026-10-22 freigegeben.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Chat“, „Hinweise im Verlauf“, „Einstellungen“), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md) (Form von `tool_result`), [ADR 033](../../decisions/033-warnhinweise.md) (Abschlusszeile). Fehlerklassen geprüft (Vault: TypeScript, React, Claude Code): keine einschlägig; für Rust und Tauri gibt es keine Einträge.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Werkzeug-Ausgaben je Antwort sammeln, Angaben ohne Fundstelle ermitteln, an Text und Abschlusszeile hängen; ADR 036 | [phase-1-core.md](phase-1-core.md) | heikel | complete |
| 2 | Oberfläche: Markierung im Antworttext mit Erklärung | [phase-2-markierung.md](phase-2-markierung.md) | standard | complete |
| 3 | Abschlusszeile mit Sprung, Schalter in den Einstellungen; Doku-Abschluss | [phase-3-zeile-und-schalter.md](phase-3-zeile-und-schalter.md) | standard | pending |

**Reihenfolge:** strikt 1 → 3. Direkt auf `main`, ein Commit pro Phase; Scope `chat` (Phase 3 `settings`). Vor jedem Commit `pnpm check` grün; `cargo` im PATH. Keine neuen Abhängigkeiten (`regex` ist vorhanden). Bindings neu erzeugen und mitcommitten. Keine automatisierten Tests, keine Smoke-Checkliste. Erkenntnisse nach [FINDINGS.md](FINDINGS.md). Planabschluss mit Versions-Tag (Minor-Version).

## Festgelegte Entscheidungen

- **Geprüfte Angaben** (Auswahl des Users): Pfade, Datei:Zeile, Zahlen ab zwei Ziffern. Nicht geprüft: einstellige Zahlen, Datumsangaben (`22.10.`, `22.10.2026`), Uhrzeiten (`14:02`), Versionsnummern mit zwei Punkten (`2.1.293`), alles in Code-Blöcken mit Zaun.
- **Quellen einer Antwort:** der Text aller `tool_result` des Hauptagenten dieser Antwort, die Pfade aus den Werkzeug-Aufrufen (die heutigen `used_paths`) und der Text der Nachricht des Nutzers, mit der die Antwort begann. Nicht: Eingaben der Werkzeuge (sonst belegt sich der Agent mit dem, was er selbst in ein Edit schreibt), Ausgaben von Subagenten (sie erreichen den Übersetzer nicht).
- **Großzügig vergleichen:** Zahlen ohne Tausender- und Dezimaltrenner und ohne `%`; Pfade klein, mit `/`, belegt schon dann, wenn der Dateiname in den Quellen vorkommt; Datei:Zeile zusätzlich nur, wenn die Zeilennummer als Zahl in den Quellen vorkommt. Lieber eine Marke zu wenig als eine zu Unrecht.
- **Zu viele Quellen = keine Marken.** Übersteigen die gesammelten Quellen einer Antwort 4 MB, wird nichts markiert (Abschlusszeile ohne Zahl), statt halb zu prüfen.
- **Marke als Zeichenkette, nicht als Position:** der Core liefert die unbelegten Angaben als Liste von Zeichenketten; die Oberfläche markiert jedes Vorkommen im gerenderten Text außer in Code-Blöcken. Positionen würden das Markdown-Rendern nicht überleben.
- **Immer rechnen, wahlweise zeigen:** der Core rechnet unabhängig vom Schalter; der Schalter „Angaben ohne Fundstelle markieren“ (Standard an) blendet nur aus. Alte Einträge ohne Feld zeigen nichts.
- **Gilt in allen Betriebsarten**, weil Autark und Codex dieselben Zeilen durch `translate.rs` schicken (`content` ist dort eine Zeichenkette).

## Kontrakt

- `ChatEntry::Text { seq, text, #[serde(default)] unsourced: Vec<String> }` (`agents/event.rs`).
- `Notice::TurnSummary { denials, cost_usd, #[serde(default)] unsourced: Vec<u32> }` (`notices/model.rs`) — die `seq` der Text-Einträge dieser Antwort mit mindestens einer Marke, in Reihenfolge; Anzahl der Angaben = Summe ihrer `unsourced.len()` (die Oberfläche zählt aus den Einträgen, die sie geladen hat, oder zeigt die Zahl der Einträge, solange einer fehlt — siehe Phase 3).
- Neues `AgentEvent::ToolOutput { text: String }` (`agents/event.rs`).
- Neues Core-Modul `src-tauri/src/sourcing/` mit `pub fn unsourced(text: &str, sources: &Sources) -> Vec<String>` und `pub struct Sources` (`push_text`, `push_path`, `is_overflowing`).
- Einstellung `mark_unsourced: bool` in `Settings`, Schlüssel `mark_unsourced`, Änderung `SettingsChange::MarkUnsourced { value: bool }`.

## Finale AK

1. Eine Antwort, die eine Zahl oder einen Pfad nennt, der in keiner Werkzeug-Ausgabe und nicht in der Nachricht des Nutzers steht, zeigt diese Stelle gepunktet unterstrichen; beim Überfahren erklärt ein Hinweis die Marke.
2. Die Abschlusszeile der Antwort zeigt „N Angaben ohne Fundstelle“; Klick springt der Reihe nach zu den markierten Texten.
3. Ist der Schalter aus, erscheint weder Marke noch Zählung; eingeschaltet erscheinen sie auch an älteren Antworten seit Einführung.
4. Datumsangaben, Uhrzeiten, Versionsnummern, einstellige Zahlen und Code-Blöcke bleiben unmarkiert.
5. Alte Chat-Einträge laden unverändert.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
