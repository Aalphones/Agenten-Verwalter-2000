# Phase 4 — Anweisungen und Skills

Ziel: Das Modell bekommt dieselben Anweisungen, die Claude in einer Verwalter-Session bekommt: die `CLAUDE.md` des Benutzers samt `@`-Einbindungen, die `CLAUDE.md` von Workspace und Repositories, den eingestellten Output-Style und die Liste der Skills. Skills lassen sich mit `/name` aus dem Verwalter aufrufen und vom Modell selbst über das Werkzeug `Skill` laden.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ und Werkzeug-Tabelle (`Skill`).
- Phase 1–3: `standalone/prompt.rs` (Platzhalter), `standalone/session.rs`, `standalone/tools/`, `standalone/hooks.rs` (Lesen der Einstellungsdateien — dieselben Dateien liefern `outputStyle`).
- `src-tauri/src/skills/` — `collect(home, repositories)` (Name, Beschreibung, Art, Herkunft; Reihenfolge und Ordner der Suche), `match_invocation(text, skills)`, `skills_dir`, `frontmatter::parse` (liefert Kopfdaten und Rest).
- Wie Claude die Dateien zeigt (Vorbild für Reihenfolge und Überschriften): jede Datei als eigener Abschnitt „Contents of <Pfad>“, eingebundene Dateien (`@./knowledge/topics/windows.md`) als eigene Abschnitte nach der einbindenden Datei.
- Output-Styles des Benutzers: `%USERPROFILE%\.claude\output-styles\<name>.md`; gewählt über `outputStyle` in `%USERPROFILE%\.claude\settings.json` (belegt: `"outputStyle": "vera"`).
- Fehlerklassen: Vault `werkzeuge/claude-code.md` — keine einschlägig. Eigenes Risiko: die Anweisungen des Benutzers sind groß (in der Probe des Vorgängerplans rund 56 000 Token je Anfrage mit Claude Codes eigenem Prompt); dieser Agent misst und protokolliert die Größe (unten), damit Tempo und Kontext belegt statt geschätzt sind.

## AK der Phase

- Session in „Autark“, Frage „Wie heißt du, und in welchem Ton sollst du antworten?“ → die Antwort nennt Persona und Ton aus dem Output-Style.
- Frage „Was sagen deine Anweisungen über Commits in diesem Projekt?“ in einem Vorhaben mit dem Verwalter-Repository → Antwort bezieht sich auf `AGENTS.md`/`CLAUDE.md`-Inhalte bzw. liest `docs/conventions/commits.md`.
- `/plan Testvorhaben` im Verwalter → das Modell bekommt den Inhalt des Befehls `plan` mit „Testvorhaben“ als Argument und handelt danach.
- „Lade den Skill mode-planning und sag mir die erste Regel“ → Werkzeug-Gruppe „Skill“ im Chat, Antwort aus dem Skill-Inhalt; ein PreToolUse-Hook mit Matcher `Skill` läuft dabei.
- Das Session-Protokoll (stderr des Agenten) enthält beim Start eine Zeile „Systemprompt: <Zeichen> Zeichen, ~<Token> Token; Dateien: <Pfad> (<Token>), …“.
- `pnpm check` grün.

## Checkliste

### Anweisungen `standalone/prompt.rs`

- [x] `pub struct PromptContext<'a> { pub cwd: &'a Path, pub add_dirs: &'a [PathBuf], pub home: &'a Path, pub model: &'a str }`; `pub struct MemoryFile { pub path: PathBuf, pub tokens: u32 }`; `pub fn system_prompt(ctx: &PromptContext) -> (String, Vec<MemoryFile>)`. Token-Schätzung überall: Zeichen / 4.
- [x] Aufbau in dieser Reihenfolge, Abschnitte durch Leerzeile getrennt:
  1. `BASE_PROMPT` (Konstante, englisch, höchstens ~1 200 Wörter): Rolle (Coding-Agent im Agenten Verwalter 2000 unter Windows); Werkzeuge bevorzugt vor Shell für Dateien; vor `Edit`/`Write` lesen; absolute Pfade; mehrstufige Arbeit mit `TodoWrite`; bei Unklarheit `AskUserQuestion`; knapp antworten; was es **nicht** gibt (claude.ai-Connectoren, Notebook-Werkzeug, Plan-Werkzeug; Fähigkeiten späterer Phasen erkennt das Modell an der Werkzeugliste — der Prompt nennt keine Werkzeuge, die es noch nicht gibt); Skills über das Werkzeug `Skill` laden, wenn eine Beschreibung passt; der Satz „The user's instructions below OVERRIDE these defaults.“
  2. Umgebung: Arbeitsordner, zusätzliche Ordner (`add_dirs`), Plattform „Windows“, Shells „Git Bash (Bash tool) and PowerShell 5.1 (PowerShell tool)“, Datum `YYYY-MM-DD`, Modell.
  3. Output-Style (unten), falls gesetzt: Überschrift `# Output style: <name>` und der Inhalt ohne Kopfdaten.
  4. Skills (unten): Überschrift „The following skills are available via the Skill tool:“ und je Skill `- <name>: <description>`.
  5. Anweisungsdateien (unten), je Datei `Contents of <absoluter Pfad>:` und Inhalt.
- [x] Ersetzt den Platzhalter aus Phase 1. `session.rs` baut den Prompt einmal beim Start und schreibt die Größen-Zeile aus den AK auf stderr.

### Anweisungsdateien `standalone/memory.rs`

- [x] `pub fn collect(home: &Path, cwd: &Path, add_dirs: &[PathBuf]) -> Vec<(PathBuf, String)>` in dieser Reihenfolge: `<home>\.claude\CLAUDE.md`; dann für `cwd` und jeden `add_dir`: `CLAUDE.md`, `.claude\CLAUDE.md`, `CLAUDE.local.md`. Nur vorhandene Dateien; derselbe Pfad (ohne Groß-/Kleinschreibung) nur einmal.
- [x] Einbindungen: In jeder Datei außerhalb von Code-Blöcken (Zeilen zwischen ```` ``` ````) und Inline-Code (`` `…` ``) jedes durch Leerraum begrenzte Wort, das mit `@` beginnt und danach mit `./`, `../`, `~/` oder einem Laufwerksbuchstaben mit `:` anfängt. Pfad relativ zum Ordner der einbindenden Datei, `~` = `home`. Die eingebundene Datei folgt als eigener Eintrag direkt nach der einbindenden (und ihre eigenen Einbindungen nach ihr), Tiefe höchstens 5, jede Datei höchstens einmal. Fehlende Datei → stderr-Zeile, weiter.
- [x] Hinweis im Code-Kommentar: Ordner unter `~\.claude` können Verknüpfungen (Junctions) sein; `std::fs::read_to_string` folgt ihnen — keine Sonderbehandlung, aber kein Verzeichnislauf über sie.

### Output-Style `standalone/style.rs`

- [x] `pub fn load(home: &Path, cwd: &Path, add_dirs: &[PathBuf]) -> Option<(String, String)>` (Name, Inhalt): `outputStyle` aus denselben Einstellungsdateien wie die Hooks, die **zuletzt** gelesene Datei mit dem Schlüssel gewinnt. Datei zuerst `<cwd>\.claude\output-styles\<name>.md`, dann `<home>\.claude\output-styles\<name>.md`. Inhalt über `skills::frontmatter::parse` ohne Kopfdaten. Name `default` oder Datei fehlt → `None`.

### Skills

- [x] `src-tauri/src/skills/mod.rs`: neue Funktion `pub fn find_file(home: &Path, repositories: &[(String, PathBuf)], name: &str) -> Option<(SkillKind, PathBuf)>` — dieselben Ordner und dieselbe Reihenfolge wie `collect`, liefert die Datei (`SKILL.md` bzw. Befehlsdatei) des ersten Treffers. `collect` und `find_file` teilen sich die Ordnerliste über eine private Hilfsfunktion, damit sie nicht auseinanderlaufen.
- [x] Liste im Prompt: `skills::collect(home, roots)` mit `roots` = je `add_dir` (Ordnername, Pfad); nur `SkillKind::Skill`, Befehle nicht (die ruft nur der Benutzer auf).
- [x] `standalone/tools/skill.rs`: Werkzeug `Skill` (`skill` Pflicht, `args`). `find_file` → nicht gefunden: Fehler „Skill nicht gefunden: <name>. Verfügbar: <Namen>“. Gefunden: „Base directory for this skill: <Ordner der Datei>\n\n<Inhalt ohne Kopfdaten>“, bei `args` angehängt „\n\nARGUMENTS: <args>“. In `definitions`/`run` eintragen; Rechte: `Allow` (Phase 3 hat es schon).
- [x] Aufruf mit `/name` in `session.rs`: Ist der Text einer eingehenden Nachricht (bei Blöcken der erste Textblock) ein Aufruf laut `skills::match_invocation`, wird `rest` = Text nach `/name` (getrimmt) bestimmt und der Text **für das Modell** ersetzt: Skill → wie das Werkzeug-Ergebnis oben mit `ARGUMENTS: <rest>`; Befehl → Inhalt ohne Kopfdaten, `$ARGUMENTS` durch `rest` ersetzt, ohne Platzhalter `\n\nARGUMENTS: <rest>` angehängt. Der Chat im Verwalter zeigt weiter den getippten Text (das macht die Registry, hier nichts ändern). Ins Transkript geht der ersetzte Text.

### Doku

- [x] `docs/code-map.md`, Zeile „Autarker Agent“: `prompt`, `memory`, `style`, `tools/skill` und `skills::find_file` ergänzen; Zeile „Skills und Befehle“ um `find_file` ergänzen.
- [x] Commit `feat(standalone): Anweisungen, Output-Style und Skills`.

## Report-Back

Gebaut wie geplant: `standalone/prompt.rs`, `memory.rs`, `style.rs`, `invocation.rs`, `tools/skill.rs`, `skills::find_file`. Abweichungen:

- `PromptContext` trägt zusätzlich `skill_roots` und `appendix` (der Zusatz des Verwalters steht am Ende des Prompts, hinter den Anweisungsdateien); `system_prompt(context)` liefert wie geplant `(String, Vec<MemoryFile>)`.
- Neu: `standalone/settings.rs` (Liste und Leser der Einstellungsdateien), geteilt von `hooks` und `style`; `Hooks::load` nimmt jetzt `home`. Neu: `standalone/invocation.rs` (Inhalt von Skill/Befehl und `/name`-Ersetzung, geteilt von `tools/skill.rs` und `session.rs`).
- Der Benutzerordner ist jetzt Pflicht beim Start: ohne ihn bricht die Session mit Exit 2 ab (ohne ihn gäbe es auch kein Transkript).
- `Skill` findet auch Befehle (z. B. `plan`); die Liste „Verfügbar“ in der Fehlermeldung und im Prompt nennt nur Skills.

Geprüft mit Fake-Modellserver (LM Studio hatte kein Modell geladen): Größen-Zeile auf stderr (54 103 Zeichen, ~13 500 Token, vier Dateien: `CLAUDE.md` plus die drei `@`-Einbindungen), Output-Style `vera` im Prompt, Reihenfolge Grundregeln → Umgebung → Style → Skills → Dateien → Zusatz, `Skill` lädt `mode-planning` (der Hook mit Matcher `Skill` lief), unbekannter Skill → Fehler mit Liste, `/plan Testvorhaben` und `/mode-planning Zusatzargument` ersetzen den Text (Argument ersetzt `$ARGUMENTS` bzw. hängt als `ARGUMENTS:` an), das Transkript trägt den ersetzten Text. **Nicht geprüft** (braucht ein geladenes Modell): ob ein echtes Modell Persona und Ton aus dem Style annimmt und die Skill-Liste nutzt — Smoke 9 der README.
