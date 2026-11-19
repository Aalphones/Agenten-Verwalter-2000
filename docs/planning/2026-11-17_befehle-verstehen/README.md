# Plan: Befehle verstehen – Beschreibung, Restdauer, Live-Fortschritt, lesbarer Verlauf

Ziel: Statt des rohen Shell-Befehls zeigt der Verwalter, was der Befehl bewirkt; lange Läufe zeigen Dauer, Fortschritt, Restdauer und die letzte Ausgabezeile – in der Statuszeile, an der Befehlszeile im Chat, im Hintergrund-Panel und in der Seitenleiste. Figurenpakete bekommen ein Fach „Langer Lauf“ und drei Bewegungen, die den Fortschritt zeigen. Im Verlauf sagt jeder Werkzeug-Block, was getan wurde und wozu. Grundsatz: [ADR 066](../../decisions/066-befehle-verstehen.md). Entwürfe (verbindlich): [artifacts/entwurf-befehle-verstehen.html](artifacts/entwurf-befehle-verstehen.html), [artifacts/entwurf-verlauf-lesbar.html](artifacts/entwurf-verlauf-lesbar.html).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Befehle nur einmal führen, Ausgabedatei kennen | [phase-1-vorgang.md](phase-1-vorgang.md) | heikel | complete |
| 2 | Beschreibung statt Befehl | [phase-2-beschreibung.md](phase-2-beschreibung.md) | standard | complete |
| 3 | Laufzeit-Gedächtnis und Schätzung | [phase-3-gedaechtnis.md](phase-3-gedaechtnis.md) | standard | complete |
| 4 | Live-Fortschritt aus der Ausgabe | [phase-4-fortschritt.md](phase-4-fortschritt.md) | heikel | complete |
| 5 | Anzeige: Statuszeile, Seitenleiste, Befehlszeile | [phase-5-anzeige.md](phase-5-anzeige.md) | standard | complete |
| 6 | Figuren: Fach „Langer Lauf“ und drei Bewegungen | [phase-6-figuren.md](phase-6-figuren.md) | standard | complete |
| 7 | Verlauf lesbar: Zweckzeile und Was-Zeile | [phase-7-verlauf.md](phase-7-verlauf.md) | standard | pending |

Reihenfolge fest 1 → 7: jede Phase baut auf den Daten der vorigen. Umfang: Betriebsart Claude für den Live-Fortschritt; Beschreibung und Schätzung wirken überall, wo die Daten ankommen. Nicht im Umfang: Live-Fortschritt in Autark und Codex, Befehle von Subagenten, eigene Erkennung je Test-Läufer, bestehende Figurenpakete ergänzen, Linux/macOS (Ort der Ausgabedatei dort nicht gemessen).

## Gemessene Grundlage (Claude Code 2.1.322, 2026-11-17)

- Jeder Bash- und PowerShell-Aufruf trägt in `input` neben `command` ein `description` (z. B. `"Run 12-step loop with 2s sleeps in foreground"`).
- Rund 2 s nach dem Start eines **Vordergrund**-Befehls kommt `system/task_started` mit `task_type: "local_bash"`, `is_backgrounded: false`, `task_id`, `tool_use_id`. Ab da schreibt die Kommandozeile die Ausgabe laufend nach `<Elternordner von init.scratchpad_path>\tasks\<task_id>.output` und löscht die Datei nach dem Ende. Über den Protokoll-Strom kommt während des Laufs keine Ausgabe.
- Ende eines Vordergrund-Befehls: `system/task_notification` (`status: "completed"`, `output_file: ""`) und danach das `tool_result`.
- Überschreitet ein Vordergrund-Befehl sein Zeitlimit: `system/task_updated` mit `patch.is_backgrounded: true`, dann das `tool_result` mit „… was moved to the background (ID: <task_id>). Output is being written to: <Datei>“, später `task_updated` (`patch.status`) und `task_notification` mit `output_file`. Einmal gemessen.
- Aufzeichnungen (bereinigt): [artifacts/vordergrund.jsonl](artifacts/vordergrund.jsonl), [artifacts/zeitlimit.jsonl](artifacts/zeitlimit.jsonl).
- Bestand: der Verwalter legt heute zu jedem Vordergrund-Befehl über 2 s zusätzlich einen Eintrag der Art `Process` an (3607 Fälle in 14 Tagen in einer Kopie der Datenbank).

## Kontrakt

### Namensschema

Phase 7 legt kein Feature an: sie baut `src/features/chat/` (`buildBlocks.ts`, `toolSummary.ts`, `ToolGroup.tsx`) um und ergänzt `src/features/skins/SlotThumb.tsx`. Feature `runs` (Läufe): `src-tauri/src/runs/` (`model.rs`, `normalize.rs`, `progress.rs`, `backfill.rs`, `mod.rs`), `src-tauri/src/db/runs.rs`, `src-tauri/src/sessions/registry/run_watch.rs`, `src/features/runs/`. Keine Tauri-Commands, kein Store. Tabelle `command_runs` (Migration 021). Einstellung-Schlüssel `runs_backfilled`. Prüfprogramme `src-tauri/examples/translate-probe.rs` und `runs-probe.rs`.

### Typen (Rust, alle über die Tauri-Grenze mit `ts-rs`, `serde(rename_all = "camelCase")`)

```rust
// src-tauri/src/runs/model.rs
pub enum ProgressUnit { Count, Percent }
pub struct RunProgress { pub done: u32, pub total: u32, pub unit: ProgressUnit }   // Percent: total = 100
pub struct RunStatus { pub tool_use_id: String, pub description: Option<String>, pub command: String,
                       pub started_at: f64, pub expected_ms: Option<f64>,
                       pub progress: Option<RunProgress>, pub last_line: Option<String> }

// src-tauri/src/background/model.rs — BackgroundItem, neue Felder, alle #[serde(default)]
pub task_id: Option<String>,        // Vorgang der Kommandozeile zu einem Befehl
pub description: Option<String>,    // Befehlsbeschreibung
pub expected_ms: Option<f64>,       // Schätzung beim Start
pub progress: Option<RunProgress>,  // live
pub last_line: Option<String>,      // live, höchstens 160 Zeichen

// src-tauri/src/agents/event.rs
ChatEntry::Tool { …, #[serde(default)] description: Option<String> }
AgentEvent::ToolStarted { …, description: Option<String> }
AgentEvent::CommandStarted { tool_use_id, command, description: Option<String> }
AgentEvent::TaskStarted { …, description: Option<String> }
AgentEvent::CommandTask { tool_use_id: String, task_id: String }          // Vorgang zu einem Vordergrund-Befehl
AgentEvent::CommandBackgrounded { tool_use_id: String, task_id: String }  // Vordergrund-Befehl wandert in den Hintergrund

// src-tauri/src/sessions/model.rs
SessionSummary.running_command: Option<RunStatus>   // ältester laufender Vordergrund-Befehl des Hauptagenten; nur im Speicher
AwaitedScript { title, started_at, count, description: Option<String>, expected_ms: Option<f64>,
                progress: Option<RunProgress>, last_line: Option<String> }   // neue Felder vom ältesten laufenden Eintrag
```

`BackgroundItem.id` bleibt, was es ist (`tool_use_id` beim Befehl, `task_id` bei Prozess und Subagent). Ein Vordergrund-Befehl, der in den Hintergrund wandert, behält seine `id` und wechselt nur `kind` auf `Process`; sein Vorgang steht in `task_id`. Wer einen Eintrag über einen Vorgang sucht, nutzt `BackgroundItem::matches_task(task_id)` (`id == task_id || self.task_id == Some(task_id)`); wer den Vorgang an die Kommandozeile schickt (`stop_task`), nutzt `BackgroundItem::task_ref()` (`task_id` falls gesetzt, sonst `id`).

### Konstanten

| Name | Wert | Ort |
|---|---|---|
| `MIN_RECORDED_MS` | 3000 | `runs/mod.rs` |
| `ESTIMATE_RUNS` | 5 | `runs/mod.rs` |
| `KEPT_RUNS` | 10 | `runs/mod.rs` |
| `WATCH_INTERVAL` | 1 s | `sessions/registry/run_watch.rs` |
| `TAIL_BYTES` | 4096 | `runs/progress.rs` |
| `MAX_LAST_LINE_CHARS` | 160 | `runs/progress.rs` |
| `LONGRUN_AFTER_MS` | 5000 | `src/features/runs/runTexts.ts` |
| `MAX_PURPOSE_CHARS` | 80 | `src/features/chat/buildBlocks.ts` |

### Tabelle (Migration `021_command_runs.sql`)

```sql
CREATE TABLE command_runs (
    id INTEGER PRIMARY KEY,
    project_id TEXT NOT NULL,
    command_key TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    finished_at REAL NOT NULL
);
CREATE INDEX command_runs_key ON command_runs (command_key, project_id, finished_at);
```

`command_key` = SHA-256 (hex, Crate `sha2`) des vereinheitlichten Befehls. Der Befehlstext selbst wird nicht gespeichert.

### Befehl vereinheitlichen (`runs::normalize::command_key(command) -> String`)

1. Zeilenumbrüche und Folgen von Leerraum zu einem Leerzeichen, außen trimmen.
2. Am Ende wiederholt entfernen, bis nichts mehr passt: ein angehängtes ` 2>&1`; eine letzte Pipeline-Stufe (alles ab dem letzten ` | `), deren erstes Wort eines von `tail`, `head`, `grep`, `rg`, `tee`, `findstr`, `Select-Object`, `Select-String`, `Out-String` ist (Groß/klein egal).
3. Ein führendes `cd <Ordner> &&` bleibt stehen (sonst mischen sich zwei Repositories).
4. SHA-256 über das Ergebnis, kleingeschriebenes Hex.

### Schätzung (`runs::estimate`)

Median der `duration_ms` der letzten `ESTIMATE_RUNS` Läufe mit gleichem `command_key` und gleichem `project_id` (nach `finished_at` absteigend); gibt es dort keinen, dieselbe Abfrage ohne `project_id`; sonst `None`. Gemerkt werden nur Läufe mit Exit-Code 0 und Dauer ≥ `MIN_RECORDED_MS`; nach dem Einfügen bleiben je (`project_id`, `command_key`) die jüngsten `KEPT_RUNS`.

### Fortschritt erkennen (`runs::progress::read(tail: &str) -> (Option<RunProgress>, Option<String>)`)

Farbcodes entfernen (`background::output::strip_ansi`), an `\n` und `\r` trennen, leere Zeilen weglassen. Letzte Zeile, getrimmt und auf `MAX_LAST_LINE_CHARS` Zeichen gekürzt = `last_line`. Fortschritt: Zeilen von hinten durchgehen, erste Zeile mit Treffer gewinnt; in der Zeile gilt der letzte Treffer; Reihenfolge der Muster je Zeile:

1. Zählung `(?:^|[\s\[(])(\d{1,7})\s?/\s?(\d{1,7})(?:$|[\s\]),.:;])` mit `total ≥ 2` und `done ≤ total` → `Count`.
2. Prozent `(?:^|[\s\[(])(\d{1,3})(?:[.,]\d+)?\s?%` mit Wert ≤ 100 → `Percent` (`done` = ganzer Wert, `total` = 100).

### Systemprompt-Absatz (`commands_prompt()` in `agents/claude/process.rs`, immer Teil des gemeinsamen `--append-system-prompt`)

```text
Shell-Befehle: Gib bei jedem Bash- und PowerShell-Aufruf `description` an — auf Deutsch, höchstens acht Wörter, was der Befehl bewirkt, nicht wie (z. B. „Prüfkette laufen lassen“, „Git-Status prüfen“). Der Benutzer sieht diese Zeile statt des Befehls. Skripte und Schleifen, die du selbst schreibst und die länger als ein paar Sekunden laufen, geben je Schritt eine Zeile `[<erledigt>/<gesamt>] <was gerade läuft>` auf der Standardausgabe aus, sofort geschrieben und nicht gepuffert; der Verwalter zeigt daraus den Fortschritt.
```

### Verlauf lesbar (Phase 7)

Nichts davon wird gespeichert; alles entsteht beim Anzeigen aus den Einträgen.

- **Zweckzeile:** der Text-Eintrag direkt vor einer Werkzeug-Gruppe wird ihr Kopf (`ChatBlock` der Art `tools`, Feld `purpose: TextEntry | null`), wenn er getrimmt höchstens `MAX_PURPOSE_CHARS` Zeichen hat, keinen Zeilenumbruch enthält, keine Markierung „ohne Fundstelle“ trägt (`unsourced` leer) und nicht der Text mit der „Weiter“-Leiste ist. Der Schlüssel des Blocks ist dann die `seq` des Textes.
- **Was-Zeile** (`groupParts`): je Art (`BUILTIN_TOOL_SLOTS`, sonst `other`) ein Teil in der Reihenfolge des ersten Auftretens. Gezählt werden bei `read` und `write` verschiedene Ziele, sonst Aufrufe.

| Art | 1 | n |
|---|---|---|
| `search` | 1 Suche | n Suchen |
| `read` | 1 Datei gelesen | n Dateien gelesen |
| `write` | 1 Datei bearbeitet | n Dateien bearbeitet |
| `shell` | 1 Befehl | n Befehle |
| `web` | 1 Web-Abruf | n Web-Abrufe |
| `agent` | 1 Unteragent | n Unteragenten |
| `other` | 1 weiterer Aufruf | n weitere Aufrufe |

Besteht die Gruppe nur aus `other`: `n Aufrufe`. Fehlschläge hängen als `n fehlgeschlagen` an.

- **Tätigkeit je Werkzeug** (`toolVerb`): `Grep`, `Glob` → Gesucht · `Read` → Gelesen · `Edit`, `NotebookEdit` → Bearbeitet · `Write` → Geschrieben · `Bash`, `PowerShell` → Befehl · `WebSearch` → Websuche · `WebFetch` → Abgerufen · `Agent`, `Task` → Unteragent · alles andere → Werkzeug.
- **Ziel an der Aufruf-Zeile:** bei Dateien nur der Dateiname; der ganze Pfad steht im `title` und im Detail.
- **Figur:** an der Was-Zeile das Bild des mitgelieferten Fachs der Art, an der Aufruf-Zeile das Bild von `slotFor(tool, target, eigene Fächer)`; immer aus dem heute aktiven Paket, unbewegt, 26 × 20 px. Die Texte des Pakets erscheinen im Verlauf nicht.

### Systemprompt-Absatz „Zweck“ (`purpose_prompt()` in `agents/claude/process.rs`, immer Teil des gemeinsamen `--append-system-prompt`, nach `commands_prompt()`)

```text
Zweck: Bevor du eine Folge von Werkzeug-Aufrufen beginnst, schreib eine einzelne kurze Zeile, wozu — auf Deutsch, höchstens sechs Wörter, wie eine Überschrift, ohne Punkt am Ende (z. B. „Plan-Dateien schreiben“). Der Benutzer liest diese Zeilen im Verlauf als Überschrift deiner Schritte. Keine neue Zeile, solange die vorige noch gilt.
```

### Platzhalter in Texten (ergänzt ADR 065)

`{ziel}` = bei Bash/PowerShell die Befehlsbeschreibung, ohne sie der Befehl; sonst wie bisher · `{befehl}` = der Befehl (bei anderen Werkzeugen leer) · `{zeit}` = laufende Dauer `m:ss`, jetzt auch bei Befehlen · `{fortschritt}` = `12/40` bzw. `45 %`, sonst leer · `{rest}` = `~1:25` bzw. `~41 min`, sonst leer. Eigene Fächer prüfen ihr Muster `input` weiter gegen den Befehl, nie gegen die Beschreibung.

### Restdauer und Balken (Oberfläche, `src/features/runs/runTexts.ts`)

- Fortschritt bekannt und `0 < done < total`: Rest = `vergangen × (total − done) / done`. Balken voll gefüllt bis `done / total`, daneben `12/40` bzw. `45 %`.
- Sonst Schätzung bekannt und `vergangen ≤ expected`: Rest = `expected − vergangen`. Balken schraffiert bis `min(0,95, vergangen / expected)`, daneben `üblich ~m:ss`.
- Sonst Schätzung bekannt und überzogen: Balken schraffiert voll in der Farbe `--color-status-waiting`, daneben die Worte `länger als üblich (~m:ss)`; kein Rest.
- Sonst: kein Balken, `läuft m:ss`; ohne letzte Zeile zusätzlich `· noch keine Ausgabe`.
- Rest-Format: ab 600 s `~<n> min` (gerundet), darunter `~m:ss` auf 5 s gerundet, mindestens `~0:05`.

### Figuren (Phase 6)

`BuiltinSlot::Longrun` (serde `"longrun"`, Name „Langer Lauf“), `Motion::Trek` („Läuft die Strecke ab“), `Motion::Charge` („Lädt auf“), `Motion::Reveal` („Wird sichtbar“). Das Fach gilt statt `shell`, sobald der laufende Shell-Befehl `LONGRUN_AFTER_MS` alt ist; ein passendes eigenes Fach gewinnt weiter.

## Finale AK

1. Kein Vordergrund-Befehl erscheint mehr zusätzlich als Eintrag der Art `Process`; ein Befehl, der sein Zeitlimit überschreitet, ist danach genau ein Eintrag der Art `Process`.
2. Befehlszeile im Chat, Gruppenzeile, Statuszeile, Hintergrund-Panel und Tooltips zeigen die Beschreibung, wenn es eine gibt; der Befehl steht beim Aufklappen. Ohne Beschreibung sieht alles aus wie vorher.
3. Der zweite erfolgreiche Lauf desselben Befehls im selben Vorhaben trägt `expected_ms`; nach dem ersten Start der neuen Version tragen auch Befehle aus dem Bestand eine Schätzung.
4. Während ein Vordergrund-Befehl Zeilen `[n/m] …` ausgibt, zeigt die Statuszeile Balken, `n/m`, Restdauer und die letzte Zeile; das gilt ebenso beim Warten auf ein Skript.
5. Die acht Zustände des Entwurfs sehen aus wie dort (Statuszeile), Seitenleiste und Kopfzeile nennen ab 5 s Restdauer, sonst Fortschritt, sonst Laufzeit.
6. Ein Figurenpaket kann das Fach „Langer Lauf“ belegen; `Trek`, `Charge` und `Reveal` folgen dem Fortschritt und stehen mit abgeschalteten Animationen still an ihrer Position. Ab Werk bleibt alles aus.
7. Im Verlauf trägt ein Werkzeug-Block die kurze Zeile des Agenten davor als Kopf und nennt in der Zeile darunter je Art, was getan wurde; alte Sessions zeigen dasselbe aus ihren vorhandenen Einträgen. Die Fälle des Entwurfs „Verlauf lesbar“ sehen aus wie dort.
8. `pnpm check` grün.

## Wackelstellen

- Reihenfolge von `task_updated` und `tool_result` beim Wechsel in den Hintergrund ist einmal gemessen → Phase 1 baut beide Reihenfolgen und prüft mit `translate-probe` plus einem zweiten Live-Lauf.
- Der Ort der Ausgabedatei ist nicht dokumentiert → fehlt die Datei, bleibt es bei Beschreibung und Schätzung; kein Fehler.
- Stand-Meldungen je Sekunde → Phase 4 sendet nur bei geändertem Stand und schreibt dabei nichts in die Datenbank.
- Ob der Agent die Zweckzeile schreibt und sich an sechs Wörter hält, ist nicht gemessen; Anweisungen des Nutzers, die Zwischentexte verbieten, können sie unterdrücken → ohne Zeile oder mit einer längeren steht die Was-Zeile allein, nichts wird erfunden. Check nach Phase 7: eine Session mit drei Werkzeug-Folgen starten und zählen, wie viele Blöcke einen Kopf tragen.
- Eine Zweckzeile kann vom Abgleich der Antwort (ADR 036) als „ohne Fundstelle“ markiert werden und bleibt dann ein eigener Text. Check nach Phase 7: dieselbe Session auf markierte Zweckzeilen ansehen.
- Gedankengänge erklären das Wozu nicht: von 39 894 gespeicherten tragen 955 einen Text (gezählt am 2026-11-17 in einer Kopie der Datenbank).

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
