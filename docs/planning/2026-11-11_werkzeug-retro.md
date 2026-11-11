# Werkzeug-Retro: Werkzeug-Aufrufe in der Vorhaben-Retro auswerten

Die Vorhaben-Retro (ADR 028) kennt Werkzeug-Aufrufe heute nur als Zählung und als Fehlschläge. Damit lässt sich nicht beantworten, was ein Entwickler nach einer Aufgabe fragt: Was war zu tun, wie kam der Agent ans Ziel, welche Befehle und Skripte haben geholfen oder hätten geholfen, was lässt sich künftig automatisieren. Der Verwalter verdichtet die Aufrufe jeder Session künftig ohne Modell zu einer Werkzeug-Spur und einem Querschnitt über alle Sessions; ein Einmal-Aufruf mit Haiku je Session ordnet die Spur nach Ziel, Weg, festen Handgriffen, Reibung und Zweck der Inline-Skripte. Das Urteil (Skript beim Nutzer, Projekt-Skript, Werkzeug im Verwalter, Hook anpassen) fällt wie bisher im Skill des Nutzers, der den Retro-Ordner liest.

## Overview

| Phase | Inhalt | Rating | Wave | Modell | Schätzung | Status |
|---|---|---|---|---|---|---|
| 1 | Werkzeug-Spur und Querschnitt ohne Modell (`spur-<N>.md`, `werkzeuge.md` Teil A, `skripte/`), `retro-probe --werkzeuge`, ADR 062 | standard | 1 | sonnet | 4 h | complete |
| 2 | Werkzeug-Retro mit Haiku je Session (`werkzeuge.md` Teil B), `retro-probe --haiku` | standard | 2 | sonnet | 2 h | pending |

Phase 2 braucht die Spur aus Phase 1 als Eingabe, deshalb sequenziell.

## Probelauf (Stand 11.11.2026)

Von Hand mit einem Python-Skript auf den Transkripten eines Vorhabens mit 36 Sessions (80 Nutzer-Aufträge), Haiku mit denselben Optionen wie `print_command`. Die Zahlen hier sind die Quelle; Skripte und Rohdaten lagen im Scratchpad der Planungs-Session.

- Haiku je Session: 0,6 / 1,5 / 2,1 Cent bei 10 / 25 / 36 Tausend Zeichen Spur, Dauer 36 / 100 / 130 s.
- Haiku hat in drei Sessions übereinstimmend dieselben festen Handgriffe gefunden (Kontext zum Arbeitsstart einsammeln, rote Tests gegen einen Basisstand vergleichen, Windows-Ersatz für ein fehlendes Python-Modul bei jedem Testlauf, Abschluss-Ritual im Tracker) und keinen einzelnen Read-, Grep-, Edit- oder Write-Aufruf als Handgriff gemeldet.
- Ohne Fehlertext in der Spur riet Haiku eine falsche Ursache: 20 von 25 fehlgeschlagenen `git status`-Aufrufen waren Hook-Sperren, Haiku schrieb „kein Git-Repo“. Deshalb trägt die Spur Fehlertext und Sperrgrund.
- Reine Abfolgen-Zählung über Werkzeug-Familien war voller Rauschen (`Grep → Grep → …`); sie bleibt nur mit dem Filter aus dem Kontrakt (mindestens zwei Aufrufe außerhalb der Grundwerkzeuge).
- Wortgleich doppelte Inline-Skripte über Sessions hinweg: keine von 117. Wiederverwendung zeigt sich am Zweck, den Haiku je Skript benennt, nicht am Text.
- Haiku schlug ein Testlauf-Skript vor, das im Projekt schon lag. Den Abgleich mit vorhandenen Skripten macht der Skill des Nutzers, nicht der Verwalter.

## Entscheidungen (getroffen, nicht offen)

- **Eigener Haiku-Aufruf, nicht die Sonnet-Mini-Retro erweitern.** Die Mini-Retro liest den Verlauf ohne erfolgreiche Aufrufe; die Werkzeug-Retro liest nur die Spur. Haiku reicht laut Probelauf und kostet einen Bruchteil. Er läuft im selben Thread direkt nach der Mini-Retro der Session, mit `ask_haiku` (in den Betriebsarten mit LM Studio antwortet wie bei der Mini-Retro das lokale Modell, in Codex der Übersetzer).
- **Kein Schalter in den Einstellungen.** Die Werkzeug-Retro läuft bei jedem Retro-Lauf mit.
- **Ein Fehlschlag der Werkzeug-Retro bricht den Lauf nicht ab** und zählt nicht in `RetroExport.failed_count`; er steht als Zeile in `werkzeuge.md`.
- **`RetroExport` und das Frontend bleiben unverändert.** Der Skill findet `werkzeuge.md` neben `befunde.md`. Die Fortschrittsanzeige „Sammle Befunde x/y“ zählt Aufrufe; `total` verdoppelt sich, der Text passt weiter.
- **Schwellen** (vom Nutzer festgelegt): wiederkehrend heißt mindestens 3-mal in mindestens 2 Sessions; ein Inline-Skript hat mindestens 10 Zeilen.
- **Grundwerkzeuge** zählen nie für sich als Wiederholung: `Read`, `Grep`, `Glob`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Skill`, `Agent`.
- **Ausgaben nur als Länge und Kopf laden.** Eine neue Abfrage liefert je Aufruf Eingabe, `length(output)` (Zeichen, Spalte ist TEXT), `output_truncated` und die ersten 400 Zeichen der Ausgabe — nie die ganze Ausgabe (bis 128 KiB je Aufruf).
- **Keine neuen Tests.** Projektkonvention: Tests gibt es nur in `implementation/tests.rs`, `pnpm check` fährt keine. Beleg je Phase ist die Ausgabe von `retro-probe` gegen eine Kopie der Datenbank. Deshalb keine Test-Station in der Umsetzung.

## Kontrakt

### Dateien im Retro-Ordner `<Workspace>\.retro\lauf-<ms>\`

Bestehend und unverändert: `befunde.md`, `session-<N>.md`. Neu:

- `spur-<N>.md` je einbezogener Session mit lesbarem Verlauf (Format unten), immer ungekürzt.
- `werkzeuge.md`: Kopf, Teil A „Querschnitt“ (Phase 1), Teil B „Werkzeug-Retro je Session“ (Phase 2).
- `skripte\s<N>-<hash>.<ext>`: jedes erkannte Inline-Skript einmal je Session und Hash.

### Typen (`src-tauri/src/retro/tools.rs`)

```rust
/// Ein Werkzeug-Aufruf mit allem, was Spur und Querschnitt brauchen.
pub struct TraceCall {
    pub step: u32,            // Nummer der Nutzernachricht (1-basiert), 0 vor der ersten
    pub index: u32,           // laufende Nummer im Schritt, 1-basiert
    pub tool: String,
    pub display: String,      // Anzeige, normalisiert (s. u.)
    pub family: String,       // für Abfolgen und Familien-Tabelle
    pub exact_key: String,    // für gleiche Aufrufe; leer bei Grundwerkzeugen
    pub status: CallStatus,
    pub output_chars: usize,
    pub output_truncated: bool,
    pub script: Option<InlineScript>,
}
pub enum CallStatus { Ok, Failed(String), Blocked(String), Interrupted }
pub struct InlineScript { pub hash: String, pub lines: usize, pub label: String, pub extension: String, pub body: String }
pub struct TraceStep { pub step: u32, pub user_text: String, pub calls: Vec<TraceCall> }
pub struct SessionTrace { pub number: u32, pub name: String, pub steps: Vec<TraceStep> }

pub fn build_trace(number: u32, name: &str, entries: &[ChatEntry], details: &HashMap<String, ToolSummary>,
                   traces: &RuleTraces, workspace: &Path, home: Option<&Path>) -> SessionTrace;
pub fn render_spur(trace: &SessionTrace) -> String;      // Inhalt von spur-<N>.md
pub fn haiku_input(trace: &SessionTrace) -> String;      // höchstens HAIKU_INPUT_MAX_CHARS
pub fn script_files(trace: &SessionTrace) -> Vec<(String, String)>; // (Dateiname, Inhalt)
```

`ToolSummary` liegt in `src-tauri/src/db/tool_details.rs`:

```rust
pub struct ToolSummary { pub input: String, pub output_chars: usize, pub output_truncated: bool, pub output_head: String }
pub fn load_summaries(connection: &Connection, session_id: &str) -> Result<HashMap<String, ToolSummary>, CommandError>;
// SELECT tool_use_id, input, length(output), output_truncated, substr(output, 1, 400)
//   FROM tool_details WHERE session_id = ?1
```

Teil A und B rendert `src-tauri/src/retro/tools_report.rs`:

```rust
pub fn render(project_name: &str, traces: &[SessionTrace], retros: &[Option<Result<ToolFindings, String>>]) -> String;
```

`retros` steht an derselben Stelle wie die Session in `traces`; in Phase 1 übergibt der Aufrufer `None` je Session, dann fehlt Teil B.

### Normalisierung (`normalize(text, workspace, home)`)

In dieser Reihenfolge, Groß/Klein egal bei Pfaden:

1. Workspace-Pfad in drei Schreibweisen → `<WS>`: wie gespeichert (`C:\Users\x\.verwalter\workspaces\abc`), mit `/` (`C:/Users/x/...`), MSYS (`/c/Users/x/...`: Laufwerksbuchstabe klein, ohne Doppelpunkt, `/` davor).
2. Benutzerverzeichnis (`crate::standalone::home_dir()`) in denselben drei Schreibweisen → `~`.
3. Regex `\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b` → `<ID>`.
4. Regex `\b[0-9a-f]{7,40}\b` → `<HASH>`.
5. Regex `\d{3,}` → `<N>`.
6. Leerraum-Folgen → ein Leerzeichen, außen getrimmt.

Regexe einmal über `std::sync::LazyLock` bauen (Crate `regex` ist schon Abhängigkeit).

### Anzeige, Familie, Schlüssel

- **Eingabe:** `details[tool_use_id].input`; fehlt die Zeile (Sessions vor ADR 042), gilt `target` des `ChatEntry::Tool` als Eingabe, und es gibt kein Skript.
- **Bash/PowerShell:** Eingabe ist der Befehl wie geschrieben. `display` = `` <Tool> `<erste Zeile normalisiert, höchstens 180 Zeichen>` `` plus ` (+<n> Zeilen)`, wenn der Befehl mehrzeilig ist. `exact_key` = `<Tool>:<ganzer Befehl normalisiert, höchstens 300 Zeichen>`.
- **Familie Bash/PowerShell:** Befehl an `&&`, `||`, `;`, `|` und Zeilenumbruch teilen. Im ersten Teil, der nach Entfernen führender `NAME=wert`-Wörter nicht mit `cd`, `Set-Location`, `mkdir`, `pwd`, `echo`, `export`, `true` oder `:` beginnt (Groß/Klein egal), ist das erste Wort der Kopf (Dateiname ohne Pfad und Anführungszeichen). Kopf `git`: Paare `-C <arg>` und `-c <arg>` überspringen, dann `git <erstes Wort ohne führendes ->`. Kopf `cargo`, `uv`, `gh`, `docker`, `dotnet`, `go`, `npx`: `<Kopf> <erstes Wort ohne führendes ->`. Kopf `npm`, `pnpm`, `yarn`: wie eben, bei `run X` → `<Kopf> run X`. Kopf `python`, `python3`, `py`, `node`, `powershell`, `pwsh`, `bash`: `<Kopf> <Dateiname des ersten Worts ohne führendes ->`, ohne solches Wort nur der Kopf. Sonst der Kopf. Ergebnis mit Präfix: `Bash:git status`, `PowerShell:Get-Content`.
- **Read/Edit/Write/MultiEdit/NotebookEdit:** `display` = `<Tool> <target normalisiert>`, Familie `<Tool>:<Dateiname aus target>`, `exact_key` leer.
- **Grep/Glob:** `display` = `<Tool> <target normalisiert>`, Familie `<Tool>`, `exact_key` leer.
- **Skill:** Familie `Skill:<target>`, `exact_key` leer. **Agent:** Familie `Agent`, `exact_key` leer.
- **Alle übrigen** (MCP, `ToolSearch`, `WebFetch` …): `display` = `<Tool> <target normalisiert>`, Familie `<Tool>`, `exact_key` = `<Tool>:<target normalisiert>`.
- **Status:** `traces.block_reason(id)` → `Blocked(Grund)`; sonst `ToolState::Failed` → `Failed(traces.tool_errors[id] oder "")`; `Interrupted` → `Interrupted`; sonst `Ok`. Texte in der Spur auf 150 Zeichen gekürzt.

### Inline-Skripte

- Bash/PowerShell-Befehl mit mindestens `SCRIPT_MIN_LINES = 10` Zeilen: `label` `inline`, `extension` `sh` bzw. `ps1`, `body` der Befehl.
- `Write` mit Dateiendung `py`, `ps1`, `psm1`, `sh`, `js`, `mjs`, `cjs`, `ts`, dessen `file_path` (aus der JSON-Eingabe) `scratchpad`, `\temp\`, `/temp/`, `\tmp\`, `/tmp/` oder `.retro` enthält (Groß/Klein egal), und dessen `content` mindestens 10 Zeilen hat: `label` Dateiname, `extension` die Endung, `body` der Inhalt. Code im Repository ist damit kein Skript.
- `hash` = erste 10 Hex-Zeichen von SHA-256 (Crate `sha2`) über den Text ohne Leerzeilen und ohne Zeilen, die nach Trimmen mit `#` oder `//` beginnen, danach `normalize`.
- Dateiname in `skripte\`: `s<N>-<hash>.<extension>`, je Session und Hash einmal.

### Format `spur-<N>.md`

```
# Werkzeug-Spur – Session #<N> – <Name>
Aufrufe: <a> · fehlgeschlagen: <f> · Hook-Sperren: <h>

## Schritt <k> – Nutzer: „<Nutzertext, eine Zeile, höchstens 240 Zeichen>“
<i>. <display> · ok | FEHLER: <Text> | SPERRE: <Grund> | abgebrochen · <Ausgabe>k[ · Skript <hash>, <n> Zeilen]
```

`<Ausgabe>` = `output_chars / 1000` mit einer Nachkommastelle, bei `output_truncated` `≥131`. Schritte ohne Aufrufe entfallen; Aufrufe vor der ersten Nutzernachricht stehen unter `## Schritt 0 – ohne Nutzernachricht`. `haiku_input` ist dieselbe Spur; über `HAIKU_INPUT_MAX_CHARS = 60_000` Zeichen bleiben die ersten und die letzten 30 000 Zeichen an Zeilengrenzen, dazwischen die Zeile `… Mitte gekürzt …`.

### Format `werkzeuge.md`

```
# Werkzeuge – <Vorhaben>
Sessions: <n> · Aufrufe: <a> · Schwelle für Wiederholung: ≥3× in ≥2 Sessions · Spuren: spur-<N>.md

## A Querschnitt
### Wiederholte gleiche Aufrufe
- <t>× in <s> Sessions (#1, #4, …): <display>
### Wiederkehrende Abfolgen
- <s> Sessions, <t>×: <Familie> → <Familie> → <Familie>
### Hook-Sperren
- <t>× in <s> Sessions: <Grund, höchstens 80 Zeichen> — danach: <Familie> ×<n>, <Familie> ×<n>
### Werkzeug-Familien
- <Familie>: <n> Aufrufe · <f> Fehler · <b> Sperren · <k>k Ausgabe
### Dicke Ausgaben
- #<N> Schritt <k>.<i>: <k>k — <display>
### Inline-Skripte
- <n>× in Sessions #1, #3: <label> (<hash>, <Zeilen> Zeilen)[ ← Kandidat]

## B Werkzeug-Retro je Session
### Session #<N> – <Name>
Ziele und Wege:
- Schritt <k>: <goal> — <path>
Handgriffe:
- [<kind>] <calls, mit Komma>: <recipe> · ändert sich: <inputs> · Vorschlag: <proposal>
Reibung:
- <calls>: <cause>
Skripte:
- <hash>: <purpose> (wiederverwendbar | einmalig)
```

Regeln für Teil A:

- **Wiederholte gleiche Aufrufe:** `exact_key` nicht leer, gesamt ≥3, Sessions ≥2; sortiert nach Sessions, dann gesamt, absteigend; höchstens 40.
- **Abfolgen:** je Schritt alle Fenster von 3, 4 und 5 aufeinanderfolgenden Familien; ein Fenster zählt nur, wenn es mindestens 2 verschiedene Familien und mindestens 2 Familien außerhalb der Grundwerkzeuge enthält (Familie beginnt nicht mit `Read`, `Grep`, `Glob`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`); je Schritt zählt jedes Fenster einmal. Gesamt ≥3, Sessions ≥2. Ein Fenster entfällt, wenn es in einem längeren gelisteten Fenster mit mindestens gleich vielen Sessions enthalten ist. Sortiert nach Sessions, dann Länge, absteigend; höchstens 30.
- **Hook-Sperren:** gruppiert nach den ersten 80 Zeichen des Grunds; „danach“ = Familie des nächsten Aufrufs im selben Schritt, die drei häufigsten; ohne Schwelle, sortiert nach gesamt absteigend.
- **Werkzeug-Familien:** die 30 häufigsten.
- **Dicke Ausgaben:** `output_chars > 20_000` oder `output_truncated`; die 15 größten.
- **Inline-Skripte:** gruppiert nach `hash`; `← Kandidat` bei ≥3 Vorkommen in ≥2 Sessions; höchstens 40 Zeilen, danach `- … und <r> weitere`.
- Leere Rubrik: `- keine`.

### Antwort der Werkzeug-Retro (Phase 2, `prompt.rs` / `model.rs`)

Schema `TOOLS_SCHEMA` (alle Felder Pflicht, `additionalProperties: false`): `steps[] {step: integer, goal: string, path: string}`, `routines[] {calls: string[], recipe: string, inputs: string, proposal: string, kind: "skript"|"werkzeug"|"umgebung"}`, `friction[] {calls: string[], cause: string}`, `scripts[] {hash: string, purpose: string, reusable: boolean}`. Rust-Typ `ToolFindings` mit `#[serde(rename_all = "camelCase")]`, `kind` als `String`.

## Phase 1 — Werkzeug-Spur und Querschnitt ohne Modell

### Kontext (lesen vor dem Start)

- `docs/decisions/028-vorhaben-retro.md`, `docs/decisions/050-regel-spuren.md`; Muster für das neue ADR: `docs/decisions/058-auto-zusammenfassen-in-stationen.md`.
- `src-tauri/src/sessions/registry/retro.rs` (ganz): `collect_retro`, `prepare_session`, `PreparedSession`, `ask_all`.
- `src-tauri/src/retro/` (alle Dateien): `traces.rs` (`RuleTraces`, `block_reason`, `tool_errors`), `transcript.rs`, `findings.rs` (Muster für `push_rubric`, `one_line`), `mod.rs`.
- `src-tauri/src/db/tool_details.rs` und `src-tauri/src/db/migrations/015_tool_details.sql`.
- `src-tauri/src/agents/event.rs` Zeile 183–258 (`ChatEntry`), `src-tauri/src/agents/claude/translate.rs` Zeile 486–517 (`input_text`: Shell-Befehl roh, sonst JSON).
- `src-tauri/src/standalone/mod.rs` Zeile 115–120 (`home_dir`).
- `src-tauri/examples/retro-probe.rs` (ganz), `AGENTS.md` Tabelle „Befehle“ (Zeile zu `retro-probe`).
- `docs/conventions/rust.md`, `docs/conventions/commits.md`, `docs/code-map.md` Zeile „Vorhaben-Retro“, `docs/glossary.md` Einträge Retro, Regel-Spur, Mini-Retro.
- Fehlerklassen geprüft: im Wissensspeicher keine Einträge zu Rust, Tauri oder SQLite vorhanden.

### AK

1. Ein Retro-Lauf schreibt neben `befunde.md` und `session-<N>.md` je einbezogener Session mit lesbarem Verlauf `spur-<N>.md`, dazu `werkzeuge.md` mit Kopf und Teil A, und für jedes erkannte Inline-Skript eine Datei in `skripte\`.
2. `spur-<N>.md` folgt dem Format des Kontrakts; ein gesperrter Aufruf steht als `SPERRE: <Grund>`, ein fehlgeschlagener als `FEHLER: <Text>`.
3. Keine Spur- oder Querschnittszeile enthält den absoluten Workspace-Pfad oder das Benutzerverzeichnis, weder mit `\` noch mit `/` noch in MSYS-Schreibweise (Gegenprobe: `Select-String -Path <Ordner>\spur-*.md,<Ordner>\werkzeuge.md -Pattern 'Users\\|Users/'` liefert nichts).
4. Kein einzelner `Read`-, `Grep`-, `Glob`-, `Edit`- oder `Write`-Aufruf steht unter „Wiederholte gleiche Aufrufe“, und keine gelistete Abfolge besteht zu mehr als drei Fünfteln aus diesen Werkzeugen.
5. `Write` einer Datei im Repository (Pfad ohne `scratchpad`, `temp`, `tmp`, `.retro`) erzeugt kein Skript.
6. `cargo run --manifest-path src-tauri/Cargo.toml --example retro-probe -- <Kopie> <Session-ID> --werkzeuge <Ordner>` schreibt für alle aktiven Sessions mit derselben `project_id` wie die angegebene Session dieselben Dateien wie ein Retro-Lauf (ohne `befunde.md`) und ruft kein Modell auf; ohne `--werkzeuge` verhält sich das Programm wie bisher.
7. Ein Retro-Lauf lädt keine ganze Werkzeug-Ausgabe aus `tool_details` (nur über `load_summaries`; `traces::collect` bleibt unverändert).
8. `pnpm check` ist grün.

### Checkliste

- [x] `db/tool_details.rs`: `ToolSummary` und `load_summaries` nach Kontrakt, Doc-Kommentar „Je Aufruf Eingabe und nur Länge und Kopf der Ausgabe; für die Werkzeug-Retro (ADR 062).“
- [x] `retro/tools.rs` neu: Typen und Funktionen des Kontrakts, `normalize`, Familien- und Schlüssel-Regeln, Skript-Erkennung, `render_spur`, `haiku_input`, `script_files`; Konstanten `SCRIPT_MIN_LINES = 10`, `HAIKU_INPUT_MAX_CHARS = 60_000`, `SPUR_TEXT_MAX_CHARS = 150`. Modul-Kommentar: „Werkzeug-Spur einer Session für die Werkzeug-Retro (ADR 062): Aufrufe je Nutzer-Auftrag, normalisiert, ohne Modell.“
- [x] `retro/tools_report.rs` neu: `render` nach Kontrakt; Teil B nur, wenn mindestens ein Eintrag von `retros` `Some` ist. Konstanten `MIN_TOTAL = 3`, `MIN_SESSIONS = 2`, `BIG_OUTPUT_CHARS = 20_000` und die Höchstzahlen der Rubriken.
- [x] `retro/model.rs`: `ToolFindings`, `StepSummary`, `Routine`, `Friction`, `ScriptPurpose` (`Debug`, `Clone`, `Deserialize`, Felder nach Kontrakt „Antwort der Werkzeug-Retro“) — schon hier, weil `tools_report::render` sie in der Signatur trägt.
- [x] `retro/mod.rs`: `pub mod tools; pub mod tools_report;`.
- [x] `sessions/registry/retro.rs`: in `prepare_session` im selben `database.with`-Aufruf wie `traces::collect` zusätzlich `load_summaries`, dann `build_trace` mit `session.workspace` und `crate::standalone::home_dir()`; neues Feld `PreparedSession.trace: Option<SessionTrace>` (`None` in den beiden Fehlerzweigen). In `collect_retro` direkt nach den `session-<N>.md` die Dateien `spur-<N>.md` und `skripte\…` schreiben; nach `befunde.md` `werkzeuge.md` mit `tools_report::render(project_name, &traces, &retros)`, wobei `retros` je Session `None` ist (`(0..n).map(|_| None).collect()`); Sessions ohne `trace` gehen nicht in `traces` ein. Konstanten `TOOLS_FILE = "werkzeuge.md"`, `SCRIPTS_DIR = "skripte"`.
- [x] `examples/retro-probe.rs`: Option `--werkzeuge <Ordner>` nach AK 6; Benutzerverzeichnis dort aus `USERPROFILE` bzw. `HOME` (wie `is_app_database`); `USAGE` ergänzen.
- [x] `docs/decisions/062-werkzeug-retro.md` nach Muster ADR 058: Kontext (Probelauf oben), Optionen (nur zählen; Sonnet-Mini-Retro erweitern; eigener Haiku-Aufruf auf verdichteter Spur), Entscheidung (Abschnitt „Entscheidungen“ dieses Plans), Konsequenzen (zwei Einmal-Aufrufe je Session, rund 1–2 Cent mehr; Sessions vor ADR 042 ohne Eingaben, dort nur `target`; ändert Claude Code das Präfix der Hook-Ausgabe, erscheinen Sperren als Fehler).
- [x] `docs/glossary.md`: Eintrag **Werkzeug-Spur** („Die Werkzeug-Aufrufe einer Session je Nutzer-Auftrag, normalisiert und ohne Modell verdichtet; `spur-<N>.md` im Retro-Ordner (ADR 062).“) und **Werkzeug-Retro** („Einmal-Aufruf mit Haiku je Session über die Werkzeug-Spur: Ziel, Weg, feste Handgriffe, Reibung, Zweck der Inline-Skripte; steht in `werkzeuge.md`.“).
- [x] `docs/code-map.md` Zeile „Vorhaben-Retro“: `tools.rs` (Werkzeug-Spur), `tools_report.rs` (`werkzeuge.md`) und ADR 062 ergänzen.
- [x] `AGENTS.md` Zeile `retro-probe`: Aufruf und Wirkung von `--werkzeuge` ergänzen.
- [x] `pnpm check` grün.
- [x] **Artefakt:** `retro-probe --werkzeuge` gegen eine Kopie der Datenbank auf ein Vorhaben mit mindestens 10 Sessions; `werkzeuge.md` und eine `spur-<N>.md` (Ausschnitt, höchstens 60 Zeilen) plus die Gegenprobe aus AK 3 in den Report-Back.

### Definition of Done

- AK 1–8 belegt (AK 1, 2, 4, 5 am Artefakt, AK 3 per Gegenprobe, AK 6 per Aufruf, AK 7 am Code, AK 8 per Ausgabe).
- Sichtbares Ergebnis: Nach „Retro“ in der Übersicht liegt im neuen Lauf-Ordner `werkzeuge.md` mit Teil A.
- Sichtabnahme: keine.

### Report-Back

Umgesetzt am 11.11.2026, `pnpm check` grün (Lint, Typecheck, Format, Build, rustfmt, Clippy). Keine neuen Tests.

**Beleg (AK 1–6, 8)** — `retro-probe <Kopie> <Session-ID> --werkzeuge <Ordner>` gegen eine Kopie der Datenbank, Vorhaben „GYMID-2668 Update Check“ mit 14 Sessions: 14 × `spur-<N>.md`, `werkzeuge.md`, 16 Dateien in `skripte\`, 843 Aufrufe, kein Modellaufruf. Ohne `--werkzeuge` verhält sich das Programm wie bisher. Gegenprobe AK 3 (`Select-String -Path <Ordner>\spur-*.md,<Ordner>\werkzeuge.md -Pattern 'Users\\|Users/'`): 0 Treffer.

AK 4: unter „Wiederholte gleiche Aufrufe“ stehen nur MCP-Aufrufe und `ToolSearch`; die längste Abfolge besteht aus Bash/Grep-Familien mit mindestens zwei Nicht-Grundwerkzeugen. AK 5: die Skripte `live.py`, `mutate.py`, `plan_probe.py`, `suite-nach-warten.ps1` stammen aus Wegwerf-Ordnern, ein `Write` in das Repository erzeugt keines (Pfadprüfung in `detect_written_script`). AK 7: `load_summaries` ist die einzige neue Abfrage (`length`, `substr`); `traces::collect` ist unverändert.

Ausschnitt `werkzeuge.md` (je Rubrik die ersten Zeilen):

```text
# Werkzeuge – GYMID- 2668 Update Check
Sessions: 14 · Aufrufe: 843 · Schwelle für Wiederholung: ≥3× in ≥2 Sessions · Spuren: spur-<N>.md
### Wiederholte gleiche Aufrufe
- 22× in 14 Sessions (#1, #2, #3, #4, #5, #6, #7, #8, …): mcp__manager__list_comments
- 12× in 12 Sessions (#2, #3, #4, #5, #6, #7, #8, #9, …): mcp__verwalter__implementation_complete_station
### Wiederkehrende Abfolgen
- 3 Sessions, 3×: Bash:grep → Bash:sed → Bash:sed
- 3 Sessions, 3×: mcp__manager__get_work_item → mcp__manager__list_comments → mcp__manager__get_wiki_page
### Hook-Sperren
- 15× in 14 Sessions: STOP: cd vor git in einer Kette. Stattdessen git -C <absoluter-repo-pfad> <befeh — danach: Bash:git status ×7, Bash:git fetch ×3, Bash:git diff ×1
- 14× in 13 Sessions: STOP: rekursiver Shell-grep. Der laeuft hier verlaesslich in den <N>-s-Timeout u — danach: Grep ×10, Bash:ls ×1, Bash:sed ×1
### Werkzeug-Familien
- Grep: 110 Aufrufe · 0 Fehler · 0 Sperren · 181.4k Ausgabe
- Bash:sed: 39 Aufrufe · 0 Fehler · 1 Sperren · 112.0k Ausgabe
### Dicke Ausgaben
- #3 Schritt 1.10: 35.2k — Read ~\develop\easyfitness\facepass\app-wt-gymid-<N>\tests\postcheck\test_hard_checks.py
### Inline-Skripte
- 2× in Sessions #5: inline (d3821de061, 16 Zeilen)
- 1× in Sessions #13: suite-nach-warten.ps1 (6f10f05c12, 13 Zeilen)
```

Ausschnitt `spur-6.md`:

```text
# Werkzeug-Spur – Session #6 – Phase 1 · Review
Aufrufe: 31 · fehlgeschlagen: 0 · Hook-Sperren: 2

## Schritt 1 – Nutzer: „/project-implementing Station: Phase 1 „P1 Bündel mit harten Prüfungen + Standort-MCP-Werkzeug“ · Review Umsetzung: GYMID-2668 Prüfung nach dem Update, Jetson-Teil — Quelle: GYMID-2668 · Wiki pruefung-nach-dem-update-jetson-teil-gymid-2668…“
2. Read ~\develop\easyfitness\facepass\.claude\skills\project-implementing\auftraege\phasen-review.md · ok · 5.3k
4. mcp__manager__list_comments · ok · 23.3k
6. Bash `cd ~/develop/easyfitness/facepass/app-wt-gymid-<N> && git status --short && git log --oneline -4 && git diff <HASH>..HEAD --stat && git diff <HASH>..HEAD -- fitness_app/` · SPERRE: STOP: cd vor git in einer Kette. Stattdessen git -C <absoluter-repo-pfad> <befehl> -- das Arbeitsverzeichnis ist hier unzuverlaessig, und cd in Kette… · 0.2k
7. Bash `R=~/develop/easyfitness/facepass/app-wt-gymid-<N>; git -C $R status --short; git -C $R log --oneline -4; …` · ok · 5.0k
13. Bash `ls tools/testlauf.py ../tools/testlauf.py 2>&1 | head; grep -rn "offline\|pendingQueue\|messageQueue\|queueMessage" ~/develop/…` · SPERRE: STOP: rekursiver Shell-grep. Der laeuft hier verlaesslich in den <N>-s-Timeout und liefert nichts (4 Treffer 07/<N>). Stattdessen das Grep-Werkzeug n… · 0.4k
```

Abweichungen vom Kontrakt: siehe „Deviations from plan“.

### Review (11.11.2026) — FAIL

Geprüft: Diff c5cf984 gegen AK 1–8 und Kontrakt; `pnpm check` selbst gelaufen (grün); `retro-probe --werkzeuge` selbst gegen eine Kopie der Datenbank auf zwei Vorhaben: „Onboarding Inventar“ (39 Sessions, 2823 Aufrufe, 117 Skripte) und das 14-Session-Vorhaben der Umsetzung (843 Aufrufe, 16 Skripte).

| AK | Ergebnis |
|---|---|
| 1, 2 | erfüllt (Dateien und Format an beiden Probeläufen) |
| 3 | **nicht erfüllt**: Gegenprobe auf „Onboarding Inventar“ 4 Treffer (auf dem 14-Session-Vorhaben 0) |
| 4 | erfüllt, am Code gesichert (`exact_key` leer bei Grundwerkzeugen; die Fenster-Regel lässt höchstens 3 von 5 Grundwerkzeugen zu) |
| 5 | erfüllt (`tools.rs:590`, Pfadprüfung vor dem Skript) |
| 6 | erfüllt (beide Aufrufe ohne Modell; ohne `--werkzeuge` unverändert) |
| 7 | erfüllt: einzige neue Abfrage ist `load_summaries` (`length`, `substr`); `traces::collect` unverändert (lädt wie bisher die volle Ausgabe nur für die Sperr-Erkennung) |
| 8 | erfüllt |

Befunde:

- **CRITICAL — AK 3, abgeschnittene Pfade bleiben stehen** (`tools.rs:408`): Die Anzeige von Grep/Read/MCP baut auf `target`, das schon vorher mit `…` gekürzt ist. Endet die Kürzung mitten im Benutzerverzeichnis (`in C:\Users\s…`), greift das Pfad-Muster (`tools.rs:205`) nicht. Treffer: `spur-9.md:37`, `spur-17.md:11`, `spur-20.md:28`, `spur-32.md:53` (alle Grep mit langem Muster). Fix: nach den vollen Pfad-Mustern ein allgemeines Muster für `<Laufwerk>:\Users\<Name>`, `C:/Users/…`, `/c/Users/…` auch in gekürzter Form ersetzen, oder die Anzeige aus der ungekürzten Eingabe (`ToolSummary.input`) bilden und erst nach dem Normalisieren kürzen.
- **WARNING — Benutzername in kodierter Form** (`tools.rs:186`): Der Claude-Projektordner `~\.claude\projects\C--Users-<Name>--verwalter-workspaces-…` geht unverändert durch; 8 Zeilen, u. a. `werkzeuge.md` „Dicke Ausgaben“. AK 3 prüft nur `Users\`/`Users/`, die Absicht („kein Benutzerverzeichnis“) deckt das mit. Fix: kodierte Schreibweise (`:`, `\`, `/`, `.` → `-`) als weitere Variante in `path_pattern`.
- **WARNING — Familie wird nicht normalisiert, Optionen werden zu Unterbefehlen** (`tools.rs:528–544`): `git_subcommand` und `first_word_without_dash` entfernen führende `-`, statt Optionswörter zu überspringen. `cargo --manifest-path=C:/Users/<Name>/… test` ergäbe die Familie `Bash:cargo manifest-path=C:/Users/<Name>/…` — unnormalisiert in „Werkzeug-Familien“, „Abfolgen“ und „Hook-Sperren … danach“. In beiden Probeläufen nicht vorgekommen. Der Kontrakt („erstes Wort ohne führendes -“, „ohne solches Wort nur der Kopf“) meint das erste Wort, das nicht mit `-` beginnt. Fix: Optionswörter überspringen; Familie zusätzlich durch `Normalizer::full`.
- **WARNING — doppelte Session-Nummern überschreiben Spuren** (`tools.rs:765`, `tools.rs:755`, `tools_report.rs:135` u. a.): In „Onboarding Inventar“ tragen 7 und 14 je zwei, 21 drei Sessions (keine Nebenfragen, nicht archiviert). Aus 39 Spuren werden 35 Dateien, `skripte\s<N>-…` kann kollidieren, und der Querschnitt zählt Sessions über die Nummer (`BTreeSet<u32>`), also zu wenige. Dasselbe Muster gibt es schon bei `session-<N>.md` (vor dieser Phase); woher die Dubletten in der Datenbank stammen, ist ein eigener Fehler außerhalb dieses Plans. Fix hier: Dateiname und Zählung über einen eindeutigen Schlüssel (z. B. Nummer plus Kurz-ID bei Kollision).
- **MINOR — `python.exe` ist kein Interpreter-Kopf** (`tools.rs:514`): 38 Aufrufe als `Bash:python.exe` ohne Skriptnamen. Kopf vor dem Vergleich ohne `.exe`.
- **MINOR — Dateigröße** (LIFT): `tools.rs` 778 Zeilen, `tools_report.rs` 573. Vorschlag: Normalisierung und Shell-Familie in eigene Dateien.
- **INFO**: `werkzeuge.md` entsteht erst nach mindestens einer gelungenen Mini-Retro (`sessions/registry/retro.rs:156`); scheitern alle, liegen Spuren ohne Querschnitt im Ordner. Mit den AK vereinbar.

Nachbesserung: CRITICAL und die drei WARNINGs; danach Gegenprobe AK 3 auf „Onboarding Inventar“ (lange Grep-Muster, Lesezugriffe unter `~\.claude\projects`), zusätzlich mit dem Muster `C--Users-`.

Unsicherheit des Reviews: Ob die Familien-Lesart des Kontrakts (Optionswörter überspringen) gewollt ist, entscheidet der Plan-Autor — Check: Wortlaut „ohne solches Wort nur der Kopf“ im Kontrakt gegen `tools.rs:541`.

### Nachbesserung (11.11.2026)

CRITICAL und die drei WARNINGs sind behoben, MINOR `python.exe` ebenfalls; `pnpm check` grün (Lint, Typecheck, Format, Build, rustfmt, Clippy).

- AK 3 / Pfade: `replace_paths` ersetzt nach den vollen Mustern jedes `<Laufwerk>:\Users\<Name>` (auch gekürzt, `/c/Users/…`, `\\Users\\…`) durch `~`; die kodierte Schreibweise `C--Users-<Name>--verwalter-workspaces-…` ist fünfte Variante von `path_pattern` (Workspace → `<WS>`, Benutzerverzeichnis → `~`), ein Rest-Muster fängt gekürzte kodierte Namen.
- Familie: Optionswörter werden übersprungen (`git --no-pager log` → `log`, `cargo --manifest-path=… test` → `test`, Wörter mit Pfadtrenner zählen nicht als Unterbefehl); Interpreter: `python -m pytest` → `python pytest`, vor `-c`/`-e`/`-Command` nur die Option, `<<`-Heredoc ohne Dateiname; `.exe` am Kopf entfällt; die Familie läuft durch `Normalizer::full`.
- Dubletten: `SessionTrace` trägt `id` und `label` (`assign_labels`: Nummer, bei doppelter Nummer `<N>-<6 Zeichen der ID>`); Dateinamen (`spur-<label>.md`, `s<label>-<hash>`) und Querschnitt zählen über Position in `traces`, nicht über die Nummer.
- Beleg auf „Onboarding Inventar“ (Kopie der Datenbank): 40 Sessions → 40 `spur-*.md` (7 mit Kurz-ID), 117 Skripte. Gegenprobe `Users\\|Users/`: 1 Treffer, die Gegenprobe selbst als Befehlstext in `spur-36.md:21` (Muster-Literal, kein Pfad); `C--Users-`: 0 Treffer; `Bash:python.exe` entfällt.
- MINOR Dateigröße (`tools.rs`, `tools_report.rs`) nicht angefasst; Aufteilung in Normalisierung und Shell-Familie bleibt Follow-up.

## Phase 2 — Werkzeug-Retro mit Haiku je Session

### Kontext (lesen vor dem Start)

- Dieser Plan: Abschnitte „Probelauf“, „Entscheidungen“, Kontrakt „Format `werkzeuge.md`“ Teil B und „Antwort der Werkzeug-Retro“.
- `src-tauri/src/retro/prompt.rs`, `src-tauri/src/retro/model.rs`, `src-tauri/src/retro/tools.rs` und `tools_report.rs` aus Phase 1.
- `src-tauri/src/sessions/registry/retro.rs` (`ask_all`, `collect_retro`).
- `src-tauri/src/agents/claude/print.rs` Zeile 95–200 (`ask_haiku`, `ask_model`, `run_print`, `print_command`, `PrintRequest`).
- `src-tauri/src/agents/claude/locate.rs` (`find_claude`), `src-tauri/examples/retro-probe.rs`.
- `docs/decisions/062-werkzeug-retro.md` aus Phase 1.

### AK

1. Ein Retro-Lauf ruft je Session mit lesbarem Verlauf nach der Mini-Retro einmal `ask_haiku` mit `TOOLS_SYSTEM_PROMPT`, `TOOLS_SCHEMA` und `haiku_input` auf, mit `RETRO_TIMEOUT`.
2. `werkzeuge.md` enthält Teil B mit je einem Abschnitt pro Session; eine fehlgeschlagene Werkzeug-Retro steht dort als `Werkzeug-Retro fehlgeschlagen: <Fehler, eine Zeile>`, und der Lauf endet trotzdem erfolgreich, solange eine Mini-Retro gelang (`failed_count` unverändert).
3. Die Fortschrittsanzeige zählt beide Aufrufe: `total` = 2 × Sessions mit lesbarem Verlauf, `done` steigt nach jedem Aufruf.
4. `TOOLS_SYSTEM_PROMPT` enthält die Abgrenzung „ein einzelner Read/Grep/Edit/Write ist nie ein Handgriff“ und die Regel, dass `SPERRE`-Zeilen gegriffene Regeln sind und nur dann Reibung, wenn der Agent mehrmals in dieselbe Sperre lief.
5. `retro-probe <Kopie> <Session-ID> --werkzeuge <Ordner> --haiku [--sessions <Nr>,<Nr>,…]` schreibt zusätzlich Teil B, ruft dafür je Session `run_print` mit `find_claude()`, Modell Haiku und dem Ordner als Arbeitsverzeichnis auf und druckt je Session `#<N>: ok` oder `#<N>: <Fehler>`; `--sessions` begrenzt Spur, Querschnitt und Aufrufe auf diese Session-Nummern.
6. `pnpm check` ist grün.

### Checkliste

- [ ] `retro/prompt.rs`: `TOOLS_SYSTEM_PROMPT` (Wortlaut unten) und `TOOLS_SCHEMA` nach Kontrakt.
- [ ] `sessions/registry/retro.rs` `ask_all`: im Thread nach der Mini-Retro `ask_haiku::<ToolFindings>` mit der Spur der Session; Rückgabe je Session `(MiniRetro, Option<Result<ToolFindings, String>>)` (`None`, wenn `trace` fehlt); `total` verdoppeln, `emit_progress` nach jedem der beiden Aufrufe. `collect_retro` übergibt die Werkzeug-Ergebnisse an `tools_report::render`.
- [ ] `retro/tools_report.rs`: Teil B nach Kontrakt; `calls` mit `, ` verbunden; Zeilenumbrüche in Modelltexten wie `findings::one_line` entfernen.
- [ ] `examples/retro-probe.rs`: Optionen `--haiku` und `--sessions` nach AK 5; `AGENTS.md` Zeile `retro-probe` nachziehen.
- [ ] `docs/decisions/062-werkzeug-retro.md`: Konsequenz „Laufzeit je Session steigt um den Haiku-Aufruf (Probelauf 36–130 s)“ ergänzen, falls in Phase 1 noch nicht drin.
- [ ] `docs/glossary.md` Eintrag **Retro**: Satz anhängen „Dazu je Session eine Werkzeug-Retro mit Haiku (ADR 062).“
- [ ] `pnpm check` grün.
- [ ] **Artefakt:** `retro-probe --werkzeuge <Ordner> --haiku --sessions …` auf dasselbe Vorhaben wie in Phase 1 mit höchstens 5 Sessions; Teil B von `werkzeuge.md` in den Report-Back.

Wortlaut `TOOLS_SYSTEM_PROMPT`:

> Du liest die verdichtete Werkzeug-Spur einer Arbeitssitzung eines Coding-Agenten: je Schritt der Auftrag des Nutzers und die Werkzeug-Aufrufe in Reihenfolge (Werkzeug, Ziel, Status, Ausgabegröße in Tausend Zeichen). Status ist ok, FEHLER mit Fehlertext, SPERRE mit dem Grund einer Hook-Sperre oder abgebrochen. Du beantwortest je Schritt die Fragen eines Entwicklers: goal = was war zu tun (ein Satz); path = wie kam der Agent ans Ziel (höchstens zwei Sätze). routines: zusammenhängende Aufrufe, die ein festes Rezept sind — sie laufen unabhängig vom fachlichen Inhalt der Aufgabe immer gleich ab und hätten ohne Nachdenken von einem Skript oder einem einzigen Werkzeug erledigt werden können (Beispiele: Kontext zum Arbeitsstart einsammeln, Testlauf samt Filtern der Ausgabe, rote Tests gegen einen Basisstand vergleichen, wiederkehrender Umgebungs-Workaround, Ticket-Pflege nach festem Ablauf). Gewöhnliches Lesen, Suchen und Editieren, um Code zu verstehen oder zu ändern, ist Urteilsarbeit und gehört nicht dazu, auch wenn es oft vorkommt; ein einzelner Read/Grep/Edit/Write ist nie ein Handgriff. Je Handgriff: calls = Aufruf-Nummern als '<Schritt>.<Nr>'; recipe = was das Rezept tut, ein Satz, ohne projektspezifische Namen; inputs = was sich von Mal zu Mal ändert; proposal = welches Skript, welcher Befehl oder welches Werkzeug es ersetzen würde, ein Satz; kind = 'skript' (Hilfsskript mit Parametern), 'werkzeug' (eine Funktion der Agenten-Umgebung, z. B. Kontext beim Start mitliefern) oder 'umgebung' (dauerhafte Korrektur statt Workaround). friction: Fehlschläge mit anschließender Wiederholung, die bessere Vorbereitung vermieden hätte; cause = Ursache, ein Satz, nur aus Fehlertext oder Sperrgrund belegt, sonst 'Ursache aus der Spur nicht erkennbar'. Eine SPERRE ist eine Regel, die gegriffen hat; sie ist nur dann Reibung, wenn der Agent mehrmals in dieselbe Sperre lief — cause = was er vorher hätte wissen müssen. scripts: für jedes mit 'Skript <hash>' markierte Skript: hash, purpose = Zweck allgemein formuliert, ein Satz; reusable = true, wenn es mit Parametern in anderen Aufgaben wiederverwendbar wäre. Erfinde nichts; leere Listen sind erlaubt. Antworte auf Deutsch.

### Definition of Done

- AK 1–6 belegt (AK 1, 3, 4 am Code, AK 2 und 5 am Artefakt, AK 6 per Ausgabe).
- Sichtbares Ergebnis: `werkzeuge.md` eines Retro-Laufs enthält Teil B mit Zielen, Wegen, Handgriffen, Reibung und Skript-Zweck je Session.
- Sichtabnahme: keine.

### Report-Back

## Finale AK

Wie AK der Phasen 1 und 2, dazu: ADR 062 liegt vor, Glossar, Code-Map und `AGENTS.md` sind nachgezogen, Version ist nach `docs/conventions/releases.md` angehoben und getaggt.

## Risiken

- 🟡 Die Güte von Haiku ist an 3 Sessions eines einzigen Vorhabens gemessen. Ein Vorhaben mit anderer Arbeit (Frontend, Doku) kann mehr Fehlalarme bringen. Erkennbar an Teil B im Artefakt von Phase 2; Gegenmittel ist der Prompt, nicht Code.
- 🟡 Ein Retro-Lauf dauert länger (zweiter Aufruf je Session, im Probelauf bis 130 s). `RETRO_TIMEOUT` von 300 s reicht laut Probelauf.
- 🟡 Sessions vor ADR 042 haben keine Eingaben in `tool_details`: Ihre Spur zeigt nur `target`, Skripte fehlen dort.

## Summary

## Files touched

## Commits

## Deviations from plan

- Phase 1: `Normalizer` (Pfad-Muster einmal je Session) mit `paths` (nur Pfade, für Nutzertext) und `full` (alle sechs Schritte, für Anzeige, Fehlertext, Sperrgrund, Skript-Hash); `normalize(text, workspace, home)` bleibt als Hülle. Nutzertext wird nur pfad-normalisiert, damit Zahlen darin lesbar bleiben.
- Phase 1: vierte Pfad-Schreibweise (verdoppeltes `\`, wie in JSON-Eingaben); ein einzelnes `&` vor dem Programm (PowerShell-Aufrufoperator) zählt nicht als Kopf der Familie.
- Phase 1: Konstanten `TOOLS_FILE` und `SCRIPTS_DIR` liegen in `retro/tools.rs`; dort auch `write_trace_files`, das Retro-Lauf und Probe gemeinsam benutzen. `findings::push_rubric` und `one_line` sind `pub(crate)`.
- Phase 1: `tools_report::render` rendert Teil B schon jetzt (Signatur trägt `ToolFindings`); Phase 2 prüft und passt an.

- Nachbesserung: `build_trace` nimmt `SessionIdentity { number, id, name }` statt Nummer und Name einzeln (Clippy: höchstens 7 Argumente); `SessionTrace.label` ist die Kennung in Dateinamen und Querschnitt.

## Follow-ups

- `tools.rs` (~850 Zeilen) und `tools_report.rs` (~575): Normalisierung und Shell-Familie in eigene Dateien.
- Doppelte Session-Nummern innerhalb eines Vorhabens (7, 14, 21 in „Onboarding Inventar“) stammen aus der Datenbank; auch `session-<N>.md` überschreibt sich dadurch. Eigener Fehler außerhalb dieses Plans.
