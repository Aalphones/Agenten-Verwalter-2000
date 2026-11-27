# Plan: Review-Bericht – ein Bericht je Umsetzung im Reiter „Review“

Ziel: Jede Umsetzung bekommt einen Review-Bericht, der mit den Stationen wächst und das HTML-Abnahme-Artefakt sowie den Blick in die rohen Diffs ersetzt. Stationen hängen mit drei schlanken Werkzeugen (`report_note`, `report_figure`, `report_screen`) Erklärungen, Befunde, Schaubilder und Bildschirmfotos für die Sichtabnahme an; am Ende jeder Phase ordnet ein abgekapselter Haiku-Aufruf ohne Werkzeuge die Rohfassung zu Ergebnis, Weg und Stopps. Code, Vorher-Zeilen, Testergebnisse, Abdeckung und Mutation liest der Verwalter mechanisch aus Git und den Berichtsdateien der Läufe. Der Benutzer liest je Phase eine Seite, vergleicht Bildschirme mit dem Entwurf, kommentiert Zeilen, Stopps, Schaubilder und Bildbereiche und nimmt ab. Entwurf (verbindlich): [artifacts/review-bericht-entwurf.html](artifacts/review-bericht-entwurf.html), Erläuterung in [artifacts/README.md](artifacts/README.md). Entscheidungen: ADR 073 (entsteht in Phase 1).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Kern: Ablage, Werkzeuge `report_note`/`report_figure`/`report_screen`, Anweisung an Stationen | [phase-1-kern-ablage-werkzeuge.md](phase-1-kern-ablage-werkzeuge.md) | heikel | complete |
| 2 | Kern: Spur und Haiku-Ordnung am Phasenende | [phase-2-kern-haiku-ordnung.md](phase-2-kern-haiku-ordnung.md) | standard | complete |
| 3 | Kern: Bericht zusammensetzen (Commit-Bereich, Code aus Git, Vorher-Zeilen, Anker), Befehle und Probe | [phase-3-kern-bericht-laden.md](phase-3-kern-bericht-laden.md) | heikel | complete |
| 4 | Kern: Prüfwerte aus Läufen und Berichtsdateien | [phase-4-kern-pruefwerte.md](phase-4-kern-pruefwerte.md) | standard | complete |
| 5 | Oberfläche: Reiter „Review“, Inhalt, Überblick, Phasen-Seite, Code mit Randnotizen | [phase-5-oberflaeche-seiten.md](phase-5-oberflaeche-seiten.md) | standard | pending |
| 6 | Oberfläche: Schaubilder mit Unterschied/Vorher/Nachher, Bilder mit Marken, Sichtabnahme | [phase-6-oberflaeche-schaubilder.md](phase-6-oberflaeche-schaubilder.md) | standard | pending |
| 7 | Kommentare und Abnahme | [phase-7-kommentare-abnahme.md](phase-7-kommentare-abnahme.md) | standard | pending |
| 8 | Skills umstellen (User-Skills, facepass-Projekt-Skills), Plan fertig | [phase-8-skills-umstellen.md](phase-8-skills-umstellen.md) | standard | pending |

Reihenfolge fest 1 → 8; nach jeder Phase läuft die App. Profil: privat – keine automatisierten Tests, keine Review-Stationen, keine Abnahmeliste. Nicht im Umfang: Bericht für Sessions ohne Umsetzung, Ampel-Schwellen für Abdeckung oder Mutation, Zweckzeilen automatisch an Hunks heften, Betriebsarten Codex/LM Studio/Autark (dort fehlen die Werkzeuge, der Bericht zeigt dann nur Code und Prüfwerte).

## Gemessene Grundlage (2026-11-26)

- Werkzeugsätze im MCP-Zugang haben einen gemeinsamen Präfix; `rpc.rs` wählt den Satz per `name.starts_with(set.prefix())` (`src-tauri/src/mcp_access/rpc.rs:109`). Ein Satz ohne Präfix ist nicht vorgesehen.
- Stationen der Betriebsart Claude starten mit `lean_tools = station_of.is_some() && backend.is_none() && codex_exe.is_none()` (`src-tauri/src/sessions/registry.rs:4380`); der gemeinsame Text für `--append-system-prompt` entsteht in `src-tauri/src/agents/claude/process.rs` (Liste `prompts`, darin `artifacts_prompt`).
- Eine Station hat `stage` (z. B. „Umsetzung“, „Review“, „Test“), `skill`, `session_id`, `started_at`, `completed_at` (`src-tauri/src/implementation/model.rs` `StationView`). Fertig meldet sie sich über `implementation_complete_station` (Werkzeug in `implementation/tools.rs`, Befehl in `commands/implementation.rs`); geschrieben wird in `SessionRegistry::store_station_completion` (`sessions/registry/implementation.rs`).
- `ChatEntry::Tool` trägt `tool`, `target`, `state` (`Running|Done|Failed|Interrupted`) und `description` (die Kurzbeschreibung des Agenten zum Aufruf); `ChatEntry::Text` trägt die Antworttexte samt Zweckzeilen (`src-tauri/src/agents/event.rs`). Eingaben der Aufrufe liegen in `tool_details` (`db/tool_details.rs`, `ToolSummary.input`).
- Commits je Session stehen in `session_commits` ohne Repository (`db/session_commits.rs` `load_by_session`, `load_for`); `git::existing_commits`, `git::is_ancestor`, `git::diff_tree_patch` (`-U3`), `git::diff_index_patch`, `git::show_file` gibt es; Diffs liest `changes::parse::unified`.
- Einmal-Aufrufe an Haiku laufen über `ask_haiku` mit leerem `--tools` und `--json-schema` (`src-tauri/src/agents/claude/print.rs`); die Retro baut daraus Spuren (`retro/tools.rs` `build_trace`, `haiku_input`, `lines_within`).
- Mermaid ist keine Abhängigkeit der Oberfläche (`package.json`); die Artefakt-Betrachter laden `mermaid@10.9.1` per CDN (`src-tauri/src/artifacts/viewers/common.js`).
- Im Core gibt es `regex`, aber keine XML-Bibliothek (`src-tauri/Cargo.toml`).
- Der Name `review` ist im Namensschema schon vergeben (Review-Kommentare, `src-tauri/src/review/`, `src/features/review/`, `src/stores/review.ts`).
- Letzte Migration: 022 (`src-tauri/src/db/migrations.rs`). ADR 072 ist im geparkten Plan `2026-11-25_bibliothek-bearbeiten` reserviert; dieser Plan nimmt 073.
- Der Verwalter selbst hat keine Abdeckungs- oder Mutationswerkzeuge; Tests gehören dort nicht zur Prüfkette (`docs/conventions/linting.md`). Die Prüfwerte greifen in Projekten, die die Berichtsdateien erzeugen.

## Kontrakt

### Namensschema

Neues Feature `report` (Review-Bericht): `src-tauri/src/report/` (`mod.rs`, `model.rs`, `tools.rs`, `anchor.rs`, `raw.rs`, `images.rs`, `tidy.rs`, `range.rs`, `assemble.rs`, `checks.rs`), `src-tauri/src/db/report.rs`, `src-tauri/src/commands/report.rs`, `src/lib/report.ts`, `src/stores/report.ts`, `src/features/report/`. Prüfprogramm `src-tauri/examples/report-probe.rs`.

### Begriffe

- **Eintrag:** ein Aufruf von `report_note` oder `report_figure`; Nummer `n<k>` je Phase ab 1, vergeben beim Schreiben.
- **Rohfassung:** alle Einträge einer Phase als Markdown in Nummernfolge (Format unten), erzeugt aus den Zeilen von `report_entries`.
- **Geordnete Fassung:** die Antwort von Haiku (JSON nach Schema unten) als Markdown in `report_phases.tidy`; enthält Ergebnis, Weg und Stopps, die Einträge nur als IDs.
- **Stopp:** ein Abschnitt der Phasen-Seite: Titel, Art (`data|sec|flow|ui`), „Worauf achten“, Warum-Text, Code-Blöcke mit Randnotizen, Schaubilder. Der erste Eintrag eines Stopps ist sein Warum-Text (Prosa über dem Code), alle weiteren Notizen mit Zeilen stehen am Rand.
- **Sichtabnahme:** je Bildschirm ein Eintrag `report_screen`: Fotos je Ansicht (Beschriftung wie „1440 · hell“), optional je Foto das Entwurfsbild derselben Ansicht, eine Zeile Abweichung vom Entwurf, Klickpfad „öffnen → tun → erwartet“ mit Vorher-/Nachher-Bild, freier Kommentar. Die Fotos liefert die Station (Headless-Browser, Gerät); der Verwalter fotografiert nicht selbst.
- **Befund:** `report_note` mit `kind: "finding"`. **Behoben:** ein späterer `report_note` mit `resolves: <Nummer des Befunds>`.
- **Spur:** Zweckzeilen, Werkzeug-Beschreibungen und geschriebene Dateien der Stationen einer Phase außer Test- und Review-Stationen (Stage enthält „Test“ oder „Review“, ohne Groß-/Kleinschreibung).
- **Prüfwerte:** Prüfkette, Tests, Abdeckung der neuen Zeilen, Mutation einer Phase; ohne Werkzeug-Aufruf ermittelt.

### Migration 023 (`src-tauri/src/db/migrations/023_report.sql`)

```sql
CREATE TABLE report_entries (
  id                INTEGER PRIMARY KEY,
  implementation_id TEXT NOT NULL REFERENCES implementations(id) ON DELETE CASCADE,
  phase_id          TEXT NOT NULL REFERENCES implementation_phases(id) ON DELETE CASCADE,
  station_id        TEXT NOT NULL,
  session_id        TEXT NOT NULL,
  number            INTEGER NOT NULL,
  tool              TEXT NOT NULL,          -- 'note' | 'figure' | 'screen'
  note_kind         TEXT,                   -- 'why' | 'risk' | 'finding' (nur note)
  resolves          INTEGER,                -- Nummer des behobenen Befunds derselben Phase
  text              TEXT NOT NULL DEFAULT '',
  caption           TEXT,
  mermaid           TEXT,
  image_file        TEXT,                   -- Dateiname im Bericht-Ordner
  image_width       INTEGER,
  image_height      INTEGER,
  marks             TEXT,                   -- JSON [{"n":1,"x":10,"y":20,"w":120,"h":30,"text":"…"}], Rechtecke in Bildpixeln
  screen            TEXT,                   -- JSON ScreenRow (nur screen): name, deviation, shots, steps
  repository_key    TEXT,
  path              TEXT,                   -- relativ zum Repository, mit /
  line_from         INTEGER,
  line_to           INTEGER,
  anchor_text       TEXT,                   -- die Zeilen line_from..line_to beim Aufruf
  created_at        REAL NOT NULL,
  UNIQUE (phase_id, number)
);
CREATE INDEX report_entries_impl ON report_entries (implementation_id, phase_id, number);
CREATE TABLE report_phases (
  phase_id          TEXT PRIMARY KEY REFERENCES implementation_phases(id) ON DELETE CASCADE,
  implementation_id TEXT NOT NULL REFERENCES implementations(id) ON DELETE CASCADE,
  tidy              TEXT,                   -- geordnete Fassung (Markdown)
  tidy_json         TEXT,                   -- Antwort von Haiku, geprüft
  tidy_at           REAL,
  tidy_entries      INTEGER,                -- höchste Nummer, die die Ordnung kennt
  tidy_error        TEXT,
  checks            TEXT,                   -- JSON PhaseChecks
  checks_at         REAL
);
```

Bilder liegen unter `<data_dir>\reports\<implementation_id>\<phase_id>\` (`report::phase_dir`; je Phase ein Ordner, weil `number` je Phase bei 1 beginnt): `report_figure` als `<number>.<ext>`, `report_screen` als `<number>-<k>.<ext>` (Foto k ab 1), `<number>-<k>-entwurf.<ext>`, `<number>-s<k>-vorher.<ext>`, `<number>-s<k>-nachher.<ext>`; `delete_implementation` löscht den Ordner mit. `ScreenRow` (JSON in `screen`): `{ name, deviation?, shots: [{ label, file, width, height, design?: { file, width, height }, marks: [...] }], steps: [{ open, act, expect, before?: { file, width, height }, after?: {…} }] }`; der freie Kommentar steht in `text`.

### Werkzeuge (Satz `ReportTools`, Präfix `report_`)

Gemeinsam für alle Bilder: absoluter Pfad zu `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, höchstens 5 MB je Datei, wird kopiert. Marken (`marks`) sind Rechtecke `{n: 1–9, x, y, w, h, text?}` in Bildpixeln, `text` höchstens 300 Zeichen, höchstens 9 je Bild.

`report_note` — Eingabe (JSON-Schema mit `additionalProperties: false`):

| Feld | Typ | Regel |
|---|---|---|
| `text` | string | Pflicht, 1–1500 Zeichen, Markdown |
| `at` | string | optional, `"<pfad>:<zeile>"` oder `"<pfad>:<von>-<bis>"`; Pfad relativ zur Wurzel eines Repositorys der Session (mit `/`) oder absolut; höchstens 80 Zeilen |
| `kind` | `"why"` \| `"risk"` \| `"finding"` | optional, Vorgabe `"why"` |
| `resolves` | string | optional, `"n<k>"` eines Befunds derselben Phase |

`report_figure` — Eingabe:

| Feld | Typ | Regel |
|---|---|---|
| `caption` | string | Pflicht, 1–120 Zeichen |
| `mermaid` | string | genau eines von `mermaid` und `image`; höchstens 6000 Zeichen; Zeilen dürfen mit `+ `, `- `, `~ ` beginnen (neu, entfällt, geändert) |
| `image` | string | Bild nach den gemeinsamen Regeln |
| `marks` | array | optional, nur mit `image`, Marken nach den gemeinsamen Regeln |
| `text` | string | optional, höchstens 1500 Zeichen, Kommentar unter dem Bild bzw. Schaubild |
| `at` | string | optional, wie bei `report_note` |

`report_screen` — Eingabe (ein Aufruf je Bildschirm):

| Feld | Typ | Regel |
|---|---|---|
| `screen` | string | Pflicht, 1–80 Zeichen, Name des Bildschirms |
| `shots` | array | Pflicht, 1–8 × `{ image, label, design?, marks? }`; `label` 1–40 Zeichen (z. B. „1440 · hell“, „PDF“), `design` = Entwurfsbild derselben Ansicht |
| `deviation` | string | optional, höchstens 300 Zeichen; Abweichung vom Entwurf in einer Zeile |
| `steps` | array | optional, höchstens 8 × `{ open, act, expect, before?, after? }`; Texte je 1–160 Zeichen, `before`/`after` Bilder |
| `text` | string | optional, höchstens 1500 Zeichen, Kommentar zum Bildschirm |
| `at` | string | optional, wie bei `report_note` |

Antwort aller Werkzeuge bei Erfolg: Text `n<k> angehängt.`; Fehler als Satz (`ToolResult::Err`), u. a. „Diese Session ist keine Station.“, „Stelle nicht eindeutig: gib at an.“, „Datei liegt in keinem Repository dieser Session.“, „Befund n<k> gibt es in dieser Phase nicht.“

**Ohne `at` (nur `report_note`):** Ort ist der letzte Schreib-Aufruf der Session (`ChatEntry::Tool` mit `tool` in `Edit|MultiEdit|Write`, Pfad aus `target`). Zeilen: bei `Edit`/`MultiEdit` die Fundstelle von `new_string` (letzte Ersetzung) im aktuellen Dateiinhalt, nur wenn genau einmal vorhanden; bei `Write` die Zeilen 1 bis min(Zeilenzahl, 40). Kein Schreib-Aufruf oder keine eindeutige Fundstelle → Fehler „Stelle nicht eindeutig: gib at an.“ `report_figure` ohne `at` hat keinen Ort.

### Rohfassung (Markdown, erzeugt in `report/raw.rs`)

```
<!-- Phase <key> · Rohfassung -->
## n<k> · note · #<Session-Nr> <Stage>
at: <pfad>:<von>-<bis>
kind: why|risk|finding
resolves: n<j>

<text>

## n<k> · figure · #<Session-Nr> <Stage>
caption: <caption>
at: …
image: <datei> · marks: 1@<x%>,<y%> 2@…

```mermaid
<mermaid>
```
- 1: <mark-text>
```

## n<k> · screen · #<Session-Nr> <Stage>
screen: <name>
shots: <label> (<datei>, Entwurf <datei>, marks 1@x,y,w,h …) · …
abweichung: <deviation>
schritte:
1. <open> → <act> → <expect> · vorher <datei> · nachher <datei>

<text>

- 1: <mark-text>
```

Zeilen `at:`, `kind:`, `resolves:`, `image:`, `abweichung:`, `schritte:` nur, wenn belegt; `kind: why` entfällt. Code steht nie in der Rohfassung.

### Haiku-Ordnung (`report/tidy.rs`)

Zu ordnen sind alle Einträge der Phase außer Befunden, Einträgen mit `resolves`, Schaubildern von Review-Stationen (diese zeigt der Abschnitt „Review“) und `report_screen` (diese zeigt der Abschnitt „Sichtabnahme“ in Aufruf-Reihenfolge). Eingabe an `ask_haiku`: Rohfassung, dann `## Zu ordnen` mit den IDs durch Leerzeichen getrennt, dann `## Spur` (höchstens 40 000 Zeichen, Mitte gekürzt wie `retro::tools::haiku_input`). Systemtext wörtlich:

> Du ordnest den Review-Bericht einer Phase. Eingabe: die Rohfassung (Einträge n1, n2 … mit Text, Ort und Schaubild) und die Spur der Umsetzung. Antworte nur nach Schema. result: was die Phase bewirkt, höchstens zwei Sätze, Klartext. way: höchstens acht Etappen in der Reihenfolge der Spur, je ein Satz; detour für einen Umweg, der wieder verworfen wurde; stop: Index des Stopps, zu dem die Etappe gehört. stops: fasse zusammengehörige Einträge zu Stopps; title höchstens sechs Wörter; kind data, sec, flow oder ui; look ein Satz, worauf der Prüfer achten soll. Jede ID aus „Zu ordnen“ steht in genau einem Stopp, keine andere. Schreibe keine Eintragstexte um.

Schema (als String an `HaikuRequest.json_schema`):

```json
{"type":"object","additionalProperties":false,"required":["result","way","stops"],
 "properties":{
  "result":{"type":"string","maxLength":400},
  "way":{"type":"array","maxItems":8,"items":{"type":"object","additionalProperties":false,"required":["text","files"],
    "properties":{"text":{"type":"string","maxLength":200},"files":{"type":"array","maxItems":4,"items":{"type":"string"}},"detour":{"type":"boolean"},"stop":{"type":"integer","minimum":0}}}},
  "stops":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["title","kind","ids"],
    "properties":{"title":{"type":"string","maxLength":80},"kind":{"enum":["data","sec","flow","ui"]},"look":{"type":"string","maxLength":160},"ids":{"type":"array","items":{"type":"string","pattern":"^n[0-9]+$"}}}}}}}
```

**ID-Prüfung:** Die Menge aller `ids` muss gleich der Menge „Zu ordnen“ sein und jede ID genau einmal vorkommen; `way[].stop` < Zahl der Stopps. Sonst wird nichts gespeichert außer `tidy_error = "Ordnung verworfen: <Grund>"`, und es gilt die Rohgruppierung.

**Rohgruppierung** (laufende Phase, Haiku-Fehler, neue Einträge nach der Ordnung): Einträge in Nummernfolge; ein neuer Stopp beginnt, wenn sich `path` gegenüber dem laufenden Stopp ändert oder die Session wechselt; Einträge ohne `path` schließen sich dem laufenden Stopp an, gibt es keinen, beginnen sie einen. Titel = Dateiname des ersten Eintrags mit Pfad, sonst `caption`; Art `flow`; kein „Worauf achten“. Einträge mit Nummer > `tidy_entries` hängen als Rohgruppen hinter die geordneten Stopps.

**Gespeicherte geordnete Fassung** (Markdown in `tidy`):

```
# Phase <key> · <Titel>
Ergebnis: <result>
## Weg
1. <text>            (Umweg: „**Umweg:** <text>“)
## <Stopp-Titel> {<kind>}
look: <look>
n1 n4 n5
## Sichtabnahme
n7 n8
```

Auslöser: Wird die letzte offene Agenten-Station einer Phase fertig (alle Stationen der Phase ohne `by: "you"` haben `completed_at`), startet ein Thread `report-tidy` die Ordnung und danach die Prüfwerte. Stationen des Benutzers zählen nicht und lösen nichts aus: er liest den Bericht, bevor er abnimmt. Befehl `report_retidy(phase_id)` startet beides erneut.

### Anweisung an Stationen (`report_prompt()` in `process.rs`, nur bei `opts.lean_tools && opts.verwalter_mcp.is_some()`)

Wörtlich:

> Review-Bericht dieser Umsetzung: Erkläre, was du änderst, dort, wo es steht. Nach einer Folge von Edits, die zusammen etwas bewirken, rufe mcp__verwalter__report_note mit dem Warum in zwei, drei Sätzen auf; ohne at gilt dein letzter Edit. Für den größeren Zusammenhang mcp__verwalter__report_figure mit Mermaid; „+ “, „- “ oder „~ “ vor einer Zeile markieren neu, entfällt, geändert. Bei Oberflächen je Bildschirm ein Aufruf mcp__verwalter__report_screen mit deinen Fotos je Breite und Thema, dem Entwurfsbild daneben, der Abweichung in einer Zeile und dem Klickpfad öffnen → tun → erwartet mit Vorher- und Nachher-Bild; einzelne Bilder mit Kommentar als report_figure mit image, marks und text. Im Review jeden Befund als report_note mit kind finding und at, Architektur-Zusammenhänge als report_figure. Im Fix report_note mit resolves auf den Befund. Schreibe keinen HTML-Bericht und kein Abnahme-Artefakt; Tests, Abdeckung und Mutation liest der Verwalter selbst.

### Typen über die Tauri-Grenze (`report/model.rs`, `derive(TS)`, `camelCase`)

```rust
pub struct ReportView { implementation_id: String, phases: Vec<ReportPhase>, acceptance: Option<ReportAcceptance> }
pub struct ReportAcceptance { station_id: String, state: StationState }          // erste by_user-Station der letzten Phase
pub enum ReportPhaseState { NotStarted, Running, Done }
pub struct ReportPhase {
  phase_id: String, key: String, title: String, state: ReportPhaseState,
  station_label: String,                 // "#11 Umsetzung" der ersten Umsetzungs-Station
  finished_at: Option<f64>, files: u32, added: u32, removed: u32, commits: Vec<String>, // Kurz-Hashes
  result: Option<String>, way: Vec<ReportWayStep>, ordered: bool, tidy_error: Option<String>,
  review: Option<ReportReview>, screens: Vec<ReportScreen>, stops: Vec<ReportStop>, checks: Option<PhaseChecks>, entries: u32,
}
pub struct ReportScreen { entry: u32, name: String, by: String, text: Option<String>, deviation: Option<String>, shots: Vec<ReportShot>, steps: Vec<ReportStep> }
pub struct ReportImage { url: String, width: u32, height: u32 }
pub struct ReportShot { label: String, image: ReportImage, narrow: bool, design: Option<ReportImage>, marks: Vec<ReportMark> }  // narrow = Breite ≤ 600 px
pub struct ReportStep { open: String, act: String, expect: String, before: Option<ReportImage>, after: Option<ReportImage> }
pub struct ReportWayStep { text: String, files: Vec<String>, detour: bool, stop: Option<u32> }
pub struct ReportReview { by: String, open: Vec<ReportFinding>, resolved: Vec<ReportFinding>, figures: Vec<ReportFigure> }
pub struct ReportFinding { entry: u32, text: String, location: Option<ReportLocation>, stop: Option<u32>, resolved_by: Option<u32> }
pub struct ReportLocation { repository_key: String, path: String, line: u32 }
pub struct ReportStop { index: u32, title: String, kind: String, look: Option<String>, by: String, lead: Option<ReportLead>, blocks: Vec<ReportBlock> }
pub struct ReportLead { entry: u32, text: String }
#[serde(tag = "type", rename_all = "camelCase")] pub enum ReportBlock { Code(ReportCode), Figure(ReportFigure) }
pub struct ReportCode {
  repository_key: String, path: String, added: u32, removed: u32, rows: Vec<ReportRow>,
  notes: Vec<ReportNote>, uncovered: Vec<u32>,
}
pub enum ReportRowKind { Add, Context, Removed }
pub struct ReportRow { kind: ReportRowKind, old: Option<u32>, new: Option<u32>, text: String }
pub enum ReportNoteKind { Why, Risk, Finding, Mutant }
pub struct ReportNote { entry: Option<u32>, label: String, kind: ReportNoteKind, from: u32, to: u32, text: String, by: String, open: Option<bool>, moved: bool }
pub struct ReportFigure { entry: u32, caption: String, by: String, text: Option<String>, mermaid: Option<String>, image: Option<ReportImage>, marks: Vec<ReportMark> }
pub struct ReportMark { n: u32, x: u32, y: u32, w: u32, h: u32, text: Option<String> }
pub struct PhaseChecks { by: String, sources: Vec<String>, chain: Option<CheckRun>, tests: Option<TestCounts>, coverage: Option<CoverageCounts>, mutation: Option<MutationCounts>, gaps: Vec<CheckGap> }
pub struct CheckRun { command: String, ok: bool }
pub struct TestCounts { passed: u32, failed: u32, skipped: u32 }
pub struct CoverageCounts { covered: u32, total: u32 }          // nur neue Zeilen der Phase
pub struct MutationCounts { killed: u32, survived: u32 }
pub enum CheckGapKind { Mutant, Uncovered }
pub struct CheckGap { kind: CheckGapKind, repository_key: String, path: String, from: u32, to: u32, text: String }
```

Alle Felder sind `pub`; `label` einer Notiz ist `"1"`, `"2"` … je Code-Block in Zeilenfolge, für Mutanten `"M1"`, `"M2"` …

### Befehle und Ereignis

| Befehl | Wirkung |
|---|---|
| `report_load(implementation_id) -> ReportView` | setzt den Bericht zusammen (Phase 3) |
| `report_of_session(session_id) -> Option<String>` | ID der Umsetzung, zu der die Session als Station gehört, wenn sie mindestens einen Eintrag oder eine fertige Phase hat |
| `report_retidy(phase_id)` | Haiku-Ordnung und Prüfwerte der Phase neu |

Ereignis `report://changed` mit `{ implementationId }` nach jedem Eintrag, jeder Ordnung und jeder Prüfwert-Ermittlung.

### Kommentarziel (`review/model.rs`)

Neue Variante `CommentTarget::Report { implementation_id: String, phase_key: String, entry: Option<u32>, label: String }` (`label` = Stopp-Titel, Bildunterschrift bzw. Bildschirm-Name, höchstens 80 Zeichen). Kommentare an Codezeilen des Berichts nutzen die bestehende Variante `Diff` mit Repository, Pfad und Zeile. Text an den Agenten (`review::agent_text`): `Review-Bericht, Phase <key>, <label> (n<entry>): <Kommentar>`.

**Empfänger:** Kommentare aus dem Bericht gehen nie an eine Station, sondern an die Rückfrage der Umsetzung (ADR 048: frische Session mit Lagebericht, darf umplanen): die neueste nicht archivierte Session mit `inquiry_of` = Umsetzung, sonst eine neu angelegte. Sie bespricht die Kommentare und ergänzt nach Okay des Benutzers Stationen per `implementation_set_phases`. Bis zum Senden liegen die Kommentare im Store unter `report:<implementationId>`. Einzelheiten Phase 7.

## Finale AK

1. Eine Station der Betriebsart Claude sieht `report_note`, `report_figure` und `report_screen` und die Anweisung oben; jeder Aufruf erscheint ohne Neuladen im Reiter „Review“.
2. Die Umsetzungs-Ansicht und jede Station-Session mit Bericht zeigen den Reiter „Review“; Inhaltsverzeichnis mit Überblick und genau einer Zeile je Phase, keine Unterkapitel.
3. Je Phase eine Seite ohne weitere Navigation: Ergebnis, Prüfzeile, Weg (eingeklappt), Sichtabnahme (falls vorhanden), Review mit offenen Befunden und Schaubild, „N behoben“ (eingeklappt), dann alle Stopps.
3a. Sichtabnahme je Bildschirm: Umschalter der Ansichten, „Entwurf daneben“, Marken mit Legende, Zeile „Abweichung vom Entwurf“ bzw. „wie im Entwurf“, Klickpfad mit Vorher-/Nachher-Bildern.
4. Code eines Stopps zeigt neue, unveränderte und entfernte Zeilen aus Git mit alten bzw. neuen Nummern, Läufe entfernter Zeilen über sechs Zeilen eingeklappt, Anmerkungen am Rand (ab 940 px Breite) bzw. zwischen den Zeilen.
5. Schaubilder mit Markern zeigen Unterschied, Vorher und Nachher; ohne Marker nur das Schaubild.
6. Am Ende jeder Phase ordnet Haiku die Phase; eine verworfene Ordnung fällt auf die Rohgruppierung zurück und nennt den Grund.
7. Prüfwerte erscheinen je Phase und im Überblick, sobald Berichtsdateien existieren; rot nur bei fehlgeschlagenen Tests oder roter Prüfkette.
8. Kommentare an Zeilen, Stopps, Schaubildern, Bildschirmen und Bildbereichen gehen mit „Kommentare senden“ samt Lagebericht an die Rückfrage der Umsetzung (bestehende oder neu angelegte), die Stationen ergänzen kann; „Abnehmen“ ist gesperrt, solange Kommentare ungesendet sind, und schließt sonst die Station `by: "you"`.
9. User-Skills und facepass-Projekt-Skills verlangen in Stationen keinen HTML-Bericht und keine Abnahme-Seite mehr, sondern die Werkzeuge des Berichts; das Abnahme-Paket der Sichtabnahme geht per `report_screen`.
10. `pnpm check` grün.

## Von mir gesetzt

- **Werkzeugnamen `report_note`/`report_figure` statt `note`/`figure`:** der MCP-Zugang verlangt einen gemeinsamen Präfix je Satz (ADR 046); für den Agenten heißen sie `mcp__verwalter__report_note` usw.
- **Feature-Name `report`:** `review` ist von den Review-Kommentaren belegt.
- **Ablage in SQLite, Markdown an der Haiku-Grenze:** jeder Eintrag ist eine Zeile mit Markdown-Text; Rohfassung und geordnete Fassung entstehen als Markdown. Critical Rule 3 (Persistentes in SQLite) bleibt gewahrt, Haiku sieht nur Markdown.
- **Haiku antwortet als JSON nach Schema**, der Verwalter schreibt daraus die geordnete Markdown-Fassung — so ist die ID-Prüfung mechanisch.
- **Oberfläche in React statt Betrachter-Seite im iframe:** Kommentare, Abnahme und Sprünge in „Dateien“ brauchen die Stores der App; der Entwurf wird portiert, nicht eingebettet (ADR 073).
- **Mermaid als Abhängigkeit `mermaid@10.9.1`**, dieselbe Version wie in den Betrachtern, per `import()` erst beim ersten Schaubild geladen, `securityLevel: 'strict'`.
- **Anmerkungen bleiben am Stand ihrer Phase:** Code einer Phase kommt aus ihrem Commit-Bereich; eine Anmerkung wird über `anchor_text` im Endstand der Phase wiedergefunden, sonst steht sie als „Stelle geändert“ unter dem Block.
- **Zweckzeilen gehen in die Spur für Haiku**, nicht automatisch an Hunks (offener Punkt des Entwurfs).
- **Sichtabnahme mit eigenem Werkzeug `report_screen`** (Entscheidung des Benutzers): ein Aufruf je Bildschirm statt eines `report_figure` je Foto, damit Ansichten, Entwurf, Abweichung und Klickpfad zusammenbleiben; die Fotos liefert die Station.
- **Sichtabnahme nicht von Haiku geordnet:** Bildschirme stehen in Aufruf-Reihenfolge im eigenen Abschnitt nach dem Weg.
- **Marken sind Rechtecke** (`x, y, w, h`), wie im Entwurf.
- **Bericht nur für Umsetzungen**, nicht für einzelne Sessions (offener Punkt des Entwurfs).
- **Kommentare an die Rückfrage statt an eine Station** (Entscheidung des Benutzers): Stationen haben beim Lesen oft einen kalten Cache oder sind fertig; die Rückfrage startet frisch mit Lagebericht und kann Stationen ergänzen. Zweite Runde geht an dieselbe Rückfrage, „Kommentare senden“ schickt sofort, „Abnehmen“ ist bei ungesendeten Kommentaren gesperrt (nach der Abnahme lehnt `implementation_set_phases` ab).
- **„Dieselbe Rückfrage“ ohne eigene Spalte:** die neueste nicht archivierte Session mit `inquiry_of` = Umsetzung; eine von Hand angelegte Rückfrage zählt mit, weil dort dasselbe Gespräch läuft.
- **Rückfrage ergänzt Stationen erst nach Okay im Chat** (Satz in der Sende-Nachricht): ADR 064 übernimmt Plan-Änderungen sofort, der Benutzer will die Kommentare aber erst besprechen.
- **Ort der Berichtsdateien:** der Verwalter sucht sie selbst in den Repository-Ordnern der Phase (Muster in Phase 4), ohne Einstellung.
- **Keine Schwellen, keine Ampel:** Zahlen ohne Wertung; rot nur bei fehlgeschlagenen Tests oder roter Prüfkette.
- **„Werkzeuge zeigen“ und Roh-/Geordnet-Ansicht des Entwurfs entfallen in der App**; beide Fassungen druckt `report-probe`.
- **Plan-Vorlage als HTML bleibt** (`mode-planning`); umgestellt werden nur Abnahme-, Review- und Merge-Berichte als HTML-Artefakt.
- **Review-Datei bzw. Wiki-Kapitel der Reviews bleiben** (`mode-reviewing` `docs/reviews/`, facepass Wiki „Merge-Review“); nur ihre Kopie als HTML-Artefakt entfällt.

## Risiken und Konfidenz

- 🟡 **Anker ohne `at`:** `new_string` kann mehrfach in der Datei stehen; dann bekommt der Agent einen Fehler und muss `at` nachreichen. Check in Phase 1: `report-probe … anchor <Session-ID>` gegen eine echte Session mit Edits.
- 🟡 **Commit-Bereich einer Phase:** `session_commits` kennt kein Repository; Bereich und Reihenfolge entstehen aus `git::existing_commits` und `git::is_ancestor`. Check in Phase 3: `report-probe <DB-Kopie> <Umsetzungs-ID> view` gegen die archivierte Umsetzung „Session-Dateien“ (Kopfzahlen gegen `git show --numstat 35ab05f`).
- ✅ **Format von cargo-mutants (`mutants.out/outcomes.json`):** in Phase 4 am Quelltext von cargo-mutants geprüft, passt; keine echte Ausgabe gesehen. Alt: nicht im Repo belegt. Check in Phase 4: Beispiel aus der Doku von cargo-mutants lesen; passt es nicht, nur Stryker auswerten und das in FINDINGS vermerken.
- 🟡 **Rückfrage findet ihre Umsetzung über das Vorhaben:** `implementation_of_session` nimmt für Sessions ohne Station bisher die neueste Umsetzung des Vorhabens, nicht `inquiry_of` (`sessions/registry/implementation.rs:81`). Phase 7 dreht die Reihenfolge; Check: `implementation-probe` bzw. ein `implementation_get` aus einer Rückfrage in einem Vorhaben mit zwei Umsetzungen.
- 🟡 **Skills außerhalb des Repos (Phase 8):** die Station schreibt in `~/.claude` und in `C:\Users\smick\develop\easyfitness\facepass`; fehlen Schreibrechte, fragt sie nach. facepass ist ein Team-Repo mit eigener Commit-Regel (`project-committing`).
- Fehlerklassen geprüft (Vault `frameworks/react`, `frameworks/css-architecture`, `sprachen/typescript`, `systeme/sqlite`, `werkzeuge/git`, `werkzeuge/claude-code`): einschlägig sind Zeilenende CRLF bei Ersetzungsskripten (`werkzeuge/git`), Listen, die aus ihrem Feld quellen (`frameworks/css-architecture`), und Textsuche in Punkt-Ordnern (`werkzeuge/claude-code`); sie stehen in den Phasen 3, 5 und 8.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
