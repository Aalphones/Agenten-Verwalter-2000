# Phase 4 — Anweisung an den Agenten, Karte im Chat, Abschluss

**Rating:** standard.

## Kontext

- [README des Plans](README.md) (Kontrakt: Ordner, `ChatEntry::Artifact`).
- `src-tauri/src/agents/claude/process.rs` (`SpawnOptions.scratchpad`, `scratchpad_prompt`, das eine `--append-system-prompt`; Kommentar zu `CLAUDE_CODE_ARTIFACT`), `src-tauri/src/standalone/args.rs` (liest **ein** `--append-system-prompt`, ein zweites überschreibt das erste — deshalb ein gemeinsamer Text), `src-tauri/src/standalone/prompt.rs` (`appendix`).
- `src-tauri/src/sessions/registry.rs`: `SessionState` (Feld `scratchpad_dir`), `use_scratchpad` und der Aufruf von `spawn(SpawnOptions { … })`, `apply_event` → Zweig `AgentEvent::ToolStarted` (`note_touched_files`, dann `push_entry` mit `ChatEntry::Tool`).
- `src-tauri/src/agents/event.rs` (`ChatEntry`, `seq()`), `src-tauri/src/tldr/transcript.rs` (Match über `ChatEntry`), `src-tauri/src/changes/attribution.rs` (`normalize_path`), `src-tauri/src/artifacts/mod.rs` aus Phase 1.
- Oberfläche: `src/features/chat/ChatTimeline.tsx` (`renderEntry`), `src/features/chat/ChatView.tsx`, `src/features/chat/buildBlocks.ts`, `src/app/App.tsx` (`artifacts` aus Phase 2), `src/stores/artifacts.ts`, `src/stores/sessions.ts`.
- Design: Zeile „Chat“ in [docs/design/2026-10-05_artefakte/README.md](../../design/2026-10-05_artefakte/README.md); Karte `.card` in [artefakte.html](../../design/2026-10-05_artefakte/artefakte.html) (entspricht der Karte aus `Main.dc.html` des Entwurfs Hauptansichten).

## Abnahmekriterien der Phase

1. Jeder Agent-Start (Claude, Claude Code + LM Studio, Autark) legt `<Workspace>\.artefakte\` an und hängt die Artefakt-Anweisung (Text unten) an denselben `--append-system-prompt` wie die Scratchpad-Vorgabe, getrennt durch eine Leerzeile. Ohne Scratchpad steht die Artefakt-Anweisung allein.
2. Nach einem `Write`-Aufruf des Hauptagenten auf `<Workspace>\.artefakte\<name>.html` (absolut oder relativ zum Workspace) steht direkt hinter dem Werkzeug-Eintrag ein Eintrag `artifact`; `Edit`, Subagenten und Dateien in Unterordnern erzeugen keinen.
3. Die Karte nach Design: 34-px-Symbol auf `--color-accent-subtle`, Titel (600) aus der Artefakt-Liste, sonst der Dateiname; darunter „Artefakt · Dateiname · HH:MM“ (12 px, muted; ohne Uhrzeit, solange die Datei nicht in der Liste ist); rechts „In der Session ansehen“ (28 px hoch). Rahmen 1 px `--color-border`, Radius 8 px, Grund `--color-bg-surface`, Innenabstand 10 px 12 px.
4. „In der Session ansehen“ wählt das Artefakt aus und wechselt in den Reiter „Artefakte“; steht die Datei nicht (mehr) in der Liste, ist der Knopf deaktiviert mit `title` „Artefakt nicht vorhanden“.
5. Der TL;DR-Text übergeht den neuen Eintrag wie Werkzeug-Einträge.

## Checkliste

### Anweisung

- [x] `src-tauri/src/artifacts/mod.rs`: `pub fn prepare(workspace: &Path) -> io::Result<PathBuf>` = `fs::create_dir_all(dir(workspace))`, gibt den Ordner zurück.
- [x] `src-tauri/src/agents/claude/process.rs`: `SpawnOptions` um `pub artifacts: Option<PathBuf>` ergänzen. Die Stelle `if let Some(dir) = &opts.scratchpad { … }` ersetzen durch: Teile sammeln (`scratchpad_prompt(dir)` falls gesetzt, `artifacts_prompt(dir, opts.local.is_none())` falls gesetzt), mit `"\n\n"` verbinden, nur wenn nicht leer einmal `--append-system-prompt` mit dem Ergebnis.
- [x] `fn artifacts_prompt(dir: &Path, can_publish: bool) -> String` mit Doc-Kommentar („Ohne die Vorgabe schreibt der Agent Berichte und Entwürfe irgendwohin, und der Reiter „Artefakte“ bleibt leer.“), Text wörtlich:

  ```text
  Artefakte dieses Vorhabens: {dir}
  Möchte der Benutzer etwas zum Ansehen — einen Bericht, eine Präsentation, ein Diagramm, einen Design-Entwurf oder eine andere Seite —, schreibe es als eigenständige HTML-Datei direkt in diesen Ordner: Dateiname in Kleinbuchstaben mit Bindestrichen und der Endung .html, ein sprechender <title>. Bilder, Skripte und Stylesheets dazu gehören in einen Unterordner daneben und werden relativ eingebunden. Der Verwalter zeigt jede HTML-Datei dieses Ordners im Reiter „Artefakte“ an und lädt sie nach jedem Speichern neu; zum Überarbeiten dieselbe Datei ändern statt eine neue anzulegen. Die Seite darf Skripte, Schriften und Bibliotheken über https aus dem Internet laden, hat aber keinen Zugriff auf Dateien außerhalb dieses Ordners. Lege in diesem Ordner nichts anderes ab als Artefakte und ihre Dateien.
  ```

  Bei `can_publish == true` hängt dahinter (neue Zeile): `Soll eine Seite zusätzlich veröffentlicht werden, veröffentliche die Datei aus diesem Ordner.`
- [x] `src-tauri/src/sessions/registry.rs`: `SessionState` um `artifacts_dir: Option<PathBuf>` ergänzen (Doc-Kommentar: „Ordner `.artefakte` des Vorhabens, gesetzt bei jedem Agent-Start; daran erkennt `apply_event` Artefakte.“), in `SessionState::new` `None`. Neben `use_scratchpad` eine Funktion `use_artifacts(session: &Session, state: &mut SessionState) -> Option<PathBuf>`: `artifacts::prepare(&session.workspace)`; Fehler → `state.push_log(format!("Artefakt-Ordner nicht angelegt: {error}"))` und `None`; sonst `state.artifacts_dir = Some(dir.clone())`, `Some(dir)`. Im Spawn-Pfad direkt nach `use_scratchpad(…)` aufrufen und als `artifacts:` an `SpawnOptions` geben. Alle anderen Stellen, die `SpawnOptions { … }` bauen, mit `artifacts: None` ergänzen (der Compiler zeigt sie).

### Eintrag im Verlauf

- [x] `src-tauri/src/agents/event.rs`: `ChatEntry::Artifact { seq: u32, path: String, file: String }` (Doc-Kommentar: „Der Hauptagent hat mit `Write` ein Artefakt geschrieben (ADR 026).“); in `seq()` aufnehmen.
- [x] `src-tauri/src/artifacts/mod.rs`: `pub fn artifact_file_of(dir: &Path, used_path: &str) -> Option<String>` — relativer `used_path` wird an `dir.parent()` (den Workspace) gehängt; beide Seiten mit `attribution::normalize_path`; der normalisierte Pfad muss mit `normalize_path(dir) + "\\"` beginnen, der Rest darf kein `\` enthalten und muss `is_artifact_file` erfüllen; Ergebnis ist der letzte Pfadteil in Original-Schreibweise.
- [x] `apply_event`, Zweig `AgentEvent::ToolStarted`: vor dem Verschieben von `tool` `let is_write: bool = tool == "Write";` merken; nach `self.tool_seqs.insert(…)`: wenn `is_write` und `self.artifacts_dir` gesetzt, für jeden `used_paths`-Eintrag mit `artifact_file_of(...)` → `self.push_entry(outbox, |seq| ChatEntry::Artifact { seq, path: path.clone(), file })`. `SubagentStep` bleibt unverändert.
- [x] `src-tauri/src/tldr/transcript.rs`: `ChatEntry::Artifact { .. }` in den Arm mit `Thinking | Tool | Todos` (→ `None`).
- [x] `pnpm bindings` (der Typ `ChatEntry` ist schon exportiert).

### Karte

- [x] `src/features/artifacts/ArtifactCard.tsx` + `ArtifactCard.css` (BEM-Block `artifact-card`): Props `file: string`, `item: Artifact | undefined` (Eintrag der Liste mit gleichem `file`, Vergleich ohne Groß-/Kleinschreibung), `onOpen: () => void`. Seiten-Symbol wie in der Liste, 16 px im 34-px-Kasten.
- [x] `src/app/App.tsx` → `ChatView` → `ChatTimeline`: neue Prop `artifacts: ArtifactList | null`.
- [x] `ChatTimeline.tsx`, `renderEntry`: `case 'artifact'` → `<ArtifactCard file={entry.file} item={…} onOpen={…} />`; `onOpen` = `useArtifactsStore.getState().select(session.projectId, item.file)` und `useSessionsStore.getState().showView('artifacts')`.
- [x] `buildBlocks.ts` prüfen: der neue Eintrag ist kein Werkzeug-Eintrag und muss als eigener Block erscheinen (wie `todos`); falls `buildBlocks` Einträge nach Art filtert, `artifact` dort zulassen.

### Doku und Abschluss

- [x] ADR 026: Abschnitt „Konsequenzen“ um „Karte im Chat nur für `Write` des Hauptagenten; per Shell oder von Subagenten geschriebene Artefakte erscheinen nur im Reiter“ und „die Anweisung steht im selben `--append-system-prompt` wie die Scratchpad-Vorgabe“ ergänzen.
- [x] `docs/code-map.md`, Zeile „Artefakte“: `ArtifactCard`, `artifact_file_of`, `prepare`, `use_artifacts` und `artifacts_prompt` in `agents/claude/process.rs`, Eintrag `ChatEntry::Artifact`. Zeile „Chat“: Block-Komponente für `artifact`.
- [x] `docs/PROJECT.md`, Zeile „Artefakte“: „von einem Agenten als HTML-Seite im Ordner `.artefakte` des Vorhabens abgelegte Artefakte als Karte im Chat und im Reiter „Artefakte“ von Session und Übersicht (ADR 026)“.
- [x] `docs/knowledge/GAPS.md`: Eintrag „Artefakte“ als beantwortet markieren — „Statt der Veröffentlichung bei claude.ai zeigt der Verwalter lokale HTML-Dateien aus `.artefakte` an (ADR 026); das Artefakt-Werkzeug von Claude bleibt zusätzlich nutzbar.“
- [x] `docs/design/2026-09-28_hauptansichten/README.md`: Zeile `Artifacts.dc.html` in der Tafel-Tabelle, Spalte „Gebaut in“: „fortgeführt in [2026-10-05_artefakte](../2026-10-05_artefakte/README.md), Plan Artefakte“.
- [x] `docs/design/2026-10-05_artefakte/README.md`: Status „umgesetzt in Plan Artefakte“ (Version beim Archivieren nachtragen).
- [x] `docs/glossary.md`: prüfen, dass „Artefakt“ und „Artefakte-Ansicht“ aus Phase 2 zum Endstand passen.
- [x] Plan-Abschluss nach `mode-implementing`: Smoke-Checkliste der README durch den User, danach archivieren, Minor-Version, `chore(release)`-Commit und Tag nach [docs/conventions/releases.md](../../conventions/releases.md).

## Report-Back
