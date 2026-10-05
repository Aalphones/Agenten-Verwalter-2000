# Phase 2 — Werkzeug-Schleife und Datei-Werkzeuge

Ziel: Der Agent bietet dem Modell `Read`, `Write`, `Edit`, `Glob`, `Grep` und `TodoWrite` an, führt die Aufrufe aus, schickt die Ergebnisse zurück und wiederholt das, bis das Modell ohne Werkzeug antwortet. Dateizugriffe sind auf die Pfadgrenze beschränkt; außerhalb gibt es in dieser Phase einen Fehler an das Modell (die Rückfrage kommt in Phase 3).

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ (Pfadgrenze, Grenzen gegen Endlosschleifen, Abhängigkeiten) und „Kontrakt“ (Werkzeug-Tabelle, Zeilen `assistant`/`user` mit `tool_use`/`tool_result`).
- Phase 1: `src-tauri/src/standalone/session.rs` (Turn-Ablauf), `output.rs`, `llm.rs` (`Completion.tool_calls`), `transcript.rs`, `args.rs` (`add_dirs`, `allowed_rules`).
- `src-tauri/src/worktrees/mod.rs`, `permission_rules` — Schreibweise der Regeln (`Edit(//c/…/<repo>-wt-*/**)`, `Read(…)`: absoluter Pfad mit `//`, Laufwerk klein und ohne Doppelpunkt).
- `src-tauri/src/agents/claude/translate.rs` — was der Verwalter aus `tool_use` macht (`target_of`, `used_paths`, `TODO_TOOL`).
- Abhängigkeiten nach `mode-dependencies` hinzufügen: `regex = "1"`, `globset = "0.4"`, `ignore = "0.4"`.
- Fehlerklassen: Vault `werkzeuge/claude-code.md` — „Textsuche in einem Punkt-Ordner liefert stumm null“: der eigene `Grep`/`Glob` darf Punkt-Ordner nicht überspringen (`WalkBuilder::hidden(false)`), nur `.git` selbst; AK unten prüft das. „Eine Zeichenklasse im Suchmuster schließt das Gesuchte stumm aus“ betrifft das Modell, nicht den Code. Vault-Topic Windows (`windows.md`): CRLF-Dateien — `Edit` muss Zeilenenden der Datei erhalten (siehe unten).

## AK der Phase

- In einer Autark-Session im Verwalter: „Lies `src-tauri/src/main.rs` und sag, was es tut“ → Werkzeug-Gruppe „Read“ im Chat, sinnvolle Antwort.
- „Ersetze in `README.md` das Wort X durch Y“ (Testdatei in einem Test-Repository) → `Read`, dann `Edit`; die Datei ist geändert, ihre Zeilenenden (CRLF oder LF) sind unverändert (`git diff` zeigt nur die eine Zeile).
- `Edit` ohne vorheriges `Read` derselben Datei → Fehler an das Modell „Datei erst mit Read lesen“, das Modell liest und versucht es erneut.
- `Grep` mit `path` = `<repo>\.claude` findet Treffer in `.claude\skills\…` (Punkt-Ordner als Startpfad); `Glob` `**/*.md` findet Dateien in `.claude`.
- Eine Aufgabe mit `TodoWrite` zeigt die Aufgabenliste im Chat.
- `Read` auf `C:\Windows\win.ini` → Fehler „Pfad außerhalb von Workspace und Repositories“ an das Modell (Rückfrage erst ab Phase 3).
- Bricht das Modell nicht ab, endet der Turn nach 50 Runden mit dem Satz aus der README.
- Einstellungen öffnen in „Autark“: keine Zeile „Claude-Konto“, und der Task-Manager zeigt keine `claude.exe` (vorher startete die Zeile `claude auth status --json`). In „Claude“ und „Claude Code + LM Studio“ ist die Zeile unverändert da.
- `pnpm check` grün.

## Checkliste

### Pfadgrenze `standalone/paths.rs`

- [x] `pub struct Roots { writable: Vec<PathBuf>, readonly: Vec<PathBuf>, ticket_patterns: globset::GlobSet }`. `pub fn from_args(cwd: &Path, add_dirs: &[PathBuf], allowed_rules: &[String]) -> Roots`: `writable` = `cwd` + `add_dirs`; `readonly` = `%USERPROFILE%\.claude`; `ticket_patterns` aus jeder Regel der Form `Edit(<muster>)` oder `Read(<muster>)`: führendes `//` entfernen, erstes Segment `c` → `C:`, also `//c/Users/x/repo-wt-*/**` → `C:/Users/x/repo-wt-*/**`; `GlobBuilder` mit `case_insensitive(true)` und `literal_separator(true)`. Unlesbare Regel → überspringen, Zeile auf stderr.
- [x] `pub fn resolve(cwd: &Path, raw: &str) -> PathBuf`: relative Pfade gegen `cwd`; `/` und `\` gleich behandeln; `.` und `..` rein lexikalisch auflösen (kein `canonicalize`, das scheitert an noch nicht existierenden Dateien und liefert `\\?\`-Pfade).
- [x] `pub enum Access { Write, ReadOnly, Outside }` und `pub fn access(&self, path: &Path) -> Access`: Vergleich ohne Groß-/Kleinschreibung (Windows), Ordnergrenze beachten (`C:\repo2` liegt **nicht** in `C:\repo`). Treffer in `writable` oder `ticket_patterns` (Pfad mit `/` als Trenner gegen das Muster) → `Write`; in `readonly` → `ReadOnly`; sonst `Outside`.

### Werkzeuge `standalone/tools/`

- [x] `mod.rs`: `pub struct ToolContext { pub cwd: PathBuf, pub roots: Roots, pub read_files: HashSet<PathBuf>, pub cancel: Arc<AtomicBool> }` (`read_files` mit klein geschriebenen Pfad-Strings als Schlüssel). `pub struct ToolOutput { pub text: String, pub is_error: bool }`. `pub fn definitions() -> Vec<Value>` — je Werkzeug `{"type":"function","function":{"name":…,"description":…,"parameters":<JSON-Schema>}}`, Parameter exakt wie in der Kontrakt-Tabelle, `required` wie dort „Pflicht“. Beschreibungen englisch, je zwei, drei Sätze, mit den Regeln, die das Modell kennen muss (z. B. Edit: „Read the file first. old_string must match exactly once unless replace_all is true.“). `pub fn run(name: &str, input: &Value, ctx: &mut ToolContext) -> ToolOutput` verteilt; unbekannter Name → Fehler „Unbekanntes Werkzeug: <name>“. Ausgaben über 30 000 Zeichen: erste 15 000 + `\n… (<n> Zeichen gekürzt) …\n` + letzte 15 000.
- [x] Gemeinsam für Datei-Werkzeuge: `file_path`/`path` über `paths::resolve`; `Outside` → Fehler „Pfad außerhalb von Workspace und Repositories: <pfad>“; schreibend auf `ReadOnly` → Fehler „Nur lesbar: <pfad>“.
- [x] `read.rs`: Ordner → Fehler „Ist ein Ordner — nimm Glob“. Erste 8 KB mit Null-Byte → Fehler „Binärdatei“. Inhalt als UTF-8 (verlustbehaftet), `offset` 1-basiert (Standard 1), `limit` Standard 2000; Zeilen ohne `\r`, über 2000 Zeichen gekürzt mit `…`; Ausgabe `format!("{:>6}\t{}", nummer, zeile)` je Zeile; leere Datei → „(Datei ist leer)“; gibt es nach `limit` weitere Zeilen, letzte Zeile „… (<n> weitere Zeilen, mit offset weiterlesen)“. Pfad in `read_files` aufnehmen.
- [x] `write.rs`: existiert die Datei und steht sie nicht in `read_files` → Fehler „Bestehende Datei erst mit Read lesen.“; Elternordner anlegen; `content` unverändert schreiben; Pfad in `read_files`.
- [x] `edit.rs`: Datei muss existieren und in `read_files` stehen (sonst Fehler wie bei `write`); `old_string` leer oder gleich `new_string` → Fehler. Enthält die Datei `\r\n`, werden in `old_string` und `new_string` alle `\n`, vor denen kein `\r` steht, zu `\r\n`. Vorkommen zählen: 0 → Fehler „old_string nicht gefunden — Datei neu lesen und exakt kopieren.“; mehr als 1 ohne `replace_all` → Fehler „old_string kommt <n>-mal vor — mehr umgebenden Text angeben oder replace_all setzen.“; sonst ersetzen und schreiben, Ergebnis nach Kontrakt.
- [x] `walk.rs` (gemeinsam für Glob und Grep): `pub fn files(base: &Path) -> impl Iterator<Item = PathBuf>` über `ignore::WalkBuilder::new(base).hidden(false).git_ignore(true).git_global(false).parents(true)` und ein `filter_entry`, das Ordner mit dem Namen `.git` auslässt; nur Dateien.
- [x] `glob.rs`: Basis `path` oder `cwd` (Lesezugriff prüfen); Muster mit `GlobBuilder` (`case_insensitive(true)`, `literal_separator(true)`) gegen den Pfad relativ zur Basis mit `/`; Treffer nach Änderungszeit, neueste zuerst; höchstens 200, dann Zeile „… (<n> weitere)“; keine → „Keine Treffer.“
- [x] `grep.rs`: `regex::RegexBuilder` mit `case_insensitive(-i)`; ungültiges Muster → Fehler mit Text des Regex-Fehlers. Basis `path` (Datei oder Ordner) oder `cwd`; optional `glob` als Dateifilter wie in `glob.rs`; Dateien über 10 MB und Binärdateien (Null-Byte in den ersten 8 KB) überspringen. `files_with_matches`: Pfade; `content`: `pfad:zeile:text`; `count`: `pfad:anzahl`. `head_limit` begrenzt Zeilen bzw. Einträge, danach „… (gekürzt bei <head_limit>)“; keine → „Keine Treffer.“
- [x] `todo.rs`: `todos` muss ein Array sein, jeder Eintrag mit `content` und `status` aus `pending`/`in_progress`/`completed`, sonst Fehler mit dem Grund; Ergebnis „Aufgabenliste aktualisiert.“

### Werkzeug-Schleife in `session.rs`

- [x] Anfrage mit `tools::definitions()` (im Druckmodus und bei `tools_disabled` leer). `init` meldet die Werkzeugnamen.
- [x] Antwort mit `tool_calls`: `arguments` als JSON parsen (Fehler → `input` = `{}` und Ergebnis „Ungültige Argumente (kein JSON): <Anfang der Argumente>“ mit `is_error`). `assistant`-Zeile mit Text- und `tool_use`-Blöcken ausgeben; ans Transkript `{"role":"assistant","content":<text oder null>,"tool_calls":[{"id","type":"function","function":{"name","arguments"}}]}`.
- [x] Werkzeuge nacheinander ausführen; vor jedem `cancel` prüfen — gesetzt → für diesen und alle folgenden Aufrufe Ergebnis „Vom Benutzer unterbrochen.“ mit `is_error`. Eine `user`-Zeile mit allen `tool_result`-Blöcken ausgeben; je Aufruf ans Transkript `{"role":"tool","tool_call_id":<id>,"content":<text>}` (immer, auch bei Abbruch — sonst passt das Transkript beim nächsten Start nicht zum Format). Bei Abbruch danach `result_aborted`.
- [x] Sonst nächste Anfrage mit dem erweiterten Verlauf; Runden zählen, bei 50 `result_error` mit „Abgebrochen nach 50 Werkzeug-Schritten.“. Antwort ohne `tool_calls` → wie Phase 1.
- [x] Die Werkzeuge laufen auf dem Arbeits-Thread des Turns (nicht auf der Hauptschleife), damit `interrupt` weiter ankommt; `ToolContext` lebt in der Session und wird dem Thread für die Dauer des Turns übergeben (z. B. per `Arc<Mutex<ToolContext>>`).

### Konto-Zeile in „Autark“ (Nebenbefund aus Phase 1, Ziel AK 2 der README)

- [x] `src/features/settings/SettingsView.tsx`: `<AccountRow />` nur rendern, wenn `current.operatingMode !== 'standalone'` — der Hook `useAccount` lädt dann gar nicht erst.
- [x] `src-tauri/src/commands/account.rs`: `account_load` und `account_login` prüfen wie `usage_refresh` (`commands/usage.rs`) die Betriebsart; bei `OperatingMode::Standalone` kein Aufruf der Kommandozeile — `account_load` liefert `AccountStatus` mit `info: None`, `error: Some("In der Betriebsart Autark gibt es kein Claude-Konto.")`, `is_logging_in: false`; `account_login` kehrt mit `Ok(())` zurück. Schutz für den Fall, dass die Oberfläche doch fragt.

### Doku

- [x] `docs/code-map.md`, Zeile „Autarker Agent“: `paths`, `tools/` (`read`, `write`, `edit`, `glob`, `grep`, `walk`, `todo`) ergänzen.
- [x] Commit `feat(standalone): Werkzeug-Schleife mit Datei- und Suchwerkzeugen`.

## Report-Back

Status: complete.

- **Abweichung Ort:** Die Werkzeug-Schleife steht in `standalone/turn.rs` (Arbeits-Thread), nicht in `session.rs`; `session.rs` bleibt Hauptschleife und einziger Schreiber des Transkripts. Der Thread schickt jede Runde (Antwort samt Werkzeug-Ergebnissen) als `TurnEvent::Messages`, am Ende `TurnEvent::Done`. Der Abbruch-Marker kommt erst nach `Done` ins Transkript — damit ist der erste Phase-2-Eintrag in FINDINGS erledigt; `result` mit `aborted_streaming` geht weiter sofort bei Esc raus.
- **Abweichung Typ:** `read_files` ist `HashSet<String>` (klein geschriebene Pfade), nicht `HashSet<PathBuf>`.
- **Zusätzlich:** Fehlt einem Werkzeug-Aufruf die Kennung, erzeugt `llm.rs` eine eindeutige (`call_<uuid>`) statt `call_<index>` — sonst wiederholt sie sich über Runden, und der Verwalter ordnet Ergebnisse über sie zu. Ungültige Argumente landen im Transkript als `{}` (die Chat-Vorlage könnte kaputtes JSON beim nächsten Start ablehnen). Antwortet das Modell erst nach Esc fertig, verwirft der Thread die Antwort. `Grep` mit `glob` ohne `/` filtert nach Dateinamen (wie ripgrep), damit `*.ts` auch in Unterordnern trifft; `Glob` selbst bleibt beim Pfad relativ zur Basis. `head_limit` 0 = ohne Grenze. Read und Grep kürzen Zeilen über 2000 Zeichen. Zahlen und Wahrheitswerte als Text werden angenommen. Die Konto-Zeile blendet die ganze Sektion „Konto“ aus, nicht nur die Zeile (sonst bliebe eine leere Überschrift).
- **Geprüft mit dem Treiber gegen `google/gemma-4-12b-qat`:** Read (main.rs), Pfadgrenze (`C:\Windows\win.ini` → Fehler), Glob mit `path`, Edit ohne Read → „Bestehende Datei erst mit Read lesen.“, Grep mit `path` = `.claude` findet `.claude\skills\…\SKILL.md`, Glob `**/*.md` findet sie auch, mehrzeiliges Edit auf einer CRLF-Datei erhält `0d 0a`, TodoWrite, mehrere Werkzeug-Runden in einem Turn, Transkript-Reihenfolge `assistant` → `tool` → `assistant`. **Nicht geprüft:** Esc mitten in einer Werkzeug-Runde (zweimal traf das Unterbrechen noch die Modellanfrage), die 50-Runden-Grenze, alles in der Oberfläche (Werkzeug-Gruppen, Aufgabenliste, Konto-Zeile) — gehört in den Smoke.
