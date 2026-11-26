# Phase 2 — Kern: Liste der Session-Dateien, Lesen, Grenze, Dateilink-Ziele, Sperre

Rating: heikel (Sicherheitsgrenze). Der Kern liefert die Liste „Session-Dateien“ eines Vorhabens, liest einzelne Session-Dateien, zeigt und öffnet Dateien über eine gemeinsame Adressierung (`FileRef`) und sperrt das Standardprogramm für ausführbare Typen — auch für Artefakte. Dateilinks führen neu zu `SessionFile` und `Artifact`. Die Oberfläche nutzt das erst ab Phase 4; bis dahin fällt ein Klick auf eine Session-Datei in den bisherigen Zweig (siehe Checkliste, letzte Zeile Kern).

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Typen, Befehle, Dateilink-Reihenfolge), „Von mir gesetzt“, Risiken
- [ADR 071](../../../decisions/071-session-dateien.md), [ADR 023](../../../decisions/023-dateiverweise-im-chat.md), [ADR 067](../../../decisions/067-dateien-ansicht.md), [ADR 047](../../../decisions/047-artefakte-alle-dateitypen.md)
- `src-tauri/src/sessions/registry/artifacts.rs` — `artifact_scope` (Muster: Mitglieder des Vorhabens, je Session ohne gleichzeitige Sperren, danach Datenbank)
- `src-tauri/src/sessions/registry.rs` — `changes_input`, `project_members`, `scratchpad_dir`
- `src-tauri/src/changes/sources.rs` — `sources` (Ordner aller Repository-Einträge)
- `src-tauri/src/background/scratchpad.rs` — `prepare`, `list`, `MAX_DEPTH`, `MAX_ENTRIES`; `src-tauri/src/background/model.rs` — `ScratchpadEntry` (`path` mit `/`, `is_dir`, `size_bytes`, `modified_ms`), `ScratchpadListing` (`truncated`)
- `src-tauri/src/db/session_files.rs` — `load_with_first`; `src-tauri/src/db/session_links.rs` (Phase 1); `src-tauri/src/changes/attribution.rs` — `normalize_path`
- `src-tauri/src/file_links/mod.rs` — ganz; `src-tauri/src/commands/file_links.rs`; `src-tauri/examples/file-link-probe.rs`
- `src-tauri/src/files/mod.rs` — `checked_path`; `src-tauri/src/files/read.rs` — `read`; `src-tauri/src/commands/files.rs` — `entry_dir`, `files_open_in_editor`
- `src-tauri/src/artifacts/mod.rs` — `kind_of`, `artifact_file_of`, `dir`; `src-tauri/src/artifacts/viewers/mod.rs` — `page`; `src-tauri/src/artifacts/model.rs` — `Artifact`; `src-tauri/src/commands/artifacts.rs` — `artifact_open_default`, `artifact_reveal`
- Chat-Einträge in der Datenbank: `src-tauri/src/db/chat_entries.rs` (Nutzlast ist `ChatEntry` als JSON), `src-tauri/src/agents/event.rs` — `ChatEntry::Text`
- Fehlerklassen geprüft (Vault `systeme/sqlite`): keine einschlägig.

## AK

1. `session_files_list` liefert für jede Session des Vorhabens (auch beendete, auch Stationen) eine Gruppe nach dem Kontrakt: Dateien ihres Scratchpads (`scratchpad`), ihres Kommandozeilen-Scratchpads (`cliScratchpad`, nur wenn `cli_scratchpad_dir` gesetzt) und jede geschriebene oder verlinkte Datei außerhalb dieser beiden, außerhalb aller Repository-Einträge und außerhalb `.artefakte` (`elsewhere`). Ordner zählen nicht als Datei.
2. Eine Datei, die in einem Scratchpad liegt und geschrieben oder verlinkt wurde, erscheint einmal (im Scratchpad-Ort) mit `written`/`linked` gesetzt. Dieselbe Datei in zwei Sessions erscheint in beiden Gruppen.
3. Vorhandene Dateien tragen ihre echte Schreibweise in `path` und `name` (Prüfprogramm, Risiko-Check der README), fehlende `exists: false` und den gespeicherten Pfad.
4. Beim ersten Aufruf für ein Vorhaben werden Sessions mit `links_scanned = 0` aus ihren gespeicherten Agenten-Antworten nachgelesen und markiert; ein zweiter Aufruf liest keine Chat-Einträge.
5. `session_file_read` liest nur Session-Dateien (Grenze unten), sonst `fileNotAllowed`; Ergebnis wie `files_read`.
6. Grenze für `FileRef::Absolute`: erlaubt ist ein Pfad, dessen kanonische Form in einem der beiden Scratchpads einer Session des Vorhabens oder in einem Repository-Eintrag liegt, oder dessen `normalize_path` in `session_files` oder `session_links` einer Session des Vorhabens steht. `FileRef::Entry` wie `files_read` (`entry_dir` + `checked_path`).
7. `file_open_default` lehnt ausführbare Dateien mit `fileNotAllowed` „Ausführbare Datei wird nicht geöffnet“ ab; `artifact_open_default` ebenso (bei einer Website zählt `index.html`, ein Ordner geht in den Explorer). `Artifact` trägt `executable: bool`.
8. `file_link_resolve` folgt der Reihenfolge der README; für `SessionFile` trägt es den Pfad in `session_links` der Session ein. `file-link-probe` zeigt die neuen Ziele.
9. Prüfprogramm `session-files-probe` druckt die Liste einer Session aus einer Kopie der Datenbank.
10. `pnpm bindings`, `pnpm check` grün.

## Checkliste

- [x] `src-tauri/src/file_links/mod.rs`: `EXTERNAL_EXTENSIONS = ["html", "htm"]` (Spiegel in `src/lib/fileLinks.ts` anpassen). `pub const EXECUTABLE_EXTENSIONS: &[&str] = &["exe", "com", "bat", "cmd", "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "msi", "msp", "msc", "scr", "lnk", "url", "hta", "cpl", "jar", "sh", "bash", "zsh", "py", "pyw", "pyz", "reg", "chm", "inf", "scf", "pif", "application", "gadget", "appref-ms", "settingcontent-ms"];` und `pub fn is_executable(path: &Path) -> bool` (Endung klein in der Liste; unter `cfg(unix)` zusätzlich `metadata.permissions().mode() & 0o111 != 0` bei einer Datei).
- [x] `FileLinkTarget` um `SessionFile { path: String, line: Option<u32> }` und `Artifact { file: String }` (beide `#[serde(rename_all = "camelCase")]`). `target` bekommt den Parameter `artifacts_dir: &Path` und folgt der Reihenfolge der README: Schritt 2 sucht wie `locate` (Kandidaten, erste vorhandene Datei, Doppelpunkt-Prüfung), prüft die Grenze aber **nicht**; Schritt 4 prüft `html`/`htm` gegen `roots.allowed` (kanonisch, wie bisher in `locate`); Schritt 6 liefert den gefundenen (nicht kanonischen) Pfad. `resolve` (für `file_link_open`) bleibt unverändert.
- [x] `src-tauri/src/session_files/model.rs`: Typen der README mit `#[derive(Debug, Clone, Serialize, Deserialize, TS)]`, `#[ts(export)]` wie die übrigen Modelle.
- [x] `src-tauri/src/background/scratchpad.rs`: `pub fn dir_of(workspace: &Path, session_id: &str) -> PathBuf` (ohne Anlegen); `prepare` nutzt sie.
- [x] `src-tauri/src/sessions/registry/session_files.rs` (neu, als Untermodul wie `registry/artifacts.rs`): `pub fn session_files_input(&self, session_id: &str) -> Result<SessionFilesInput, CommandError>` nach dem Muster von `artifact_scope`: je Mitglied `id`, `number`, `name`, `workspace`, `is_own` (= die anfragende Session); danach ohne Session-Sperre aus der Datenbank je Mitglied `cli_scratchpad_dir`, geschriebene Pfade (`session_files::load_with_first`, Schlüssel), verlinkte Pfade (`session_links::load`); dazu die Ordner aller Repository-Einträge (`changes_input(session_id, ChangesReach::Project)` → `sources::sources` → `dir`) und `artifacts::dir(workspace)`. Vorher die Nachlese: für jedes Mitglied mit `is_scanned == false` die Chat-Einträge der Session laden, jede Nutzlast als `ChatEntry` parsen, für `ChatEntry::Text { text, at, .. }` `link_candidates(&text)` mit `at.unwrap_or(0.0)` sammeln, `session_links::upsert_all`, dann `mark_scanned`. `SessionFilesInput` liegt in `session_files/model.rs` (nicht über die Tauri-Grenze, ohne `TS`).
- [x] `src-tauri/src/session_files/scan.rs`: `pub fn listing(input: &SessionFilesInput) -> SessionFilesListing`. Je Mitglied: (1) `scratchpad::list(Some(&dir_of(workspace, id)))`, nur Einträge mit `!is_dir` → `Scratchpad`, `folder` = Teil von `path` vor dem letzten `/` (sonst `""`), `bytes`/`modified_at` aus dem Eintrag, `exists: true`; (2) dasselbe für `cli_scratchpad_dir` → `CliScratchpad`; scheitert das Lesen eines vorhandenen Ordners (`fs::read_dir` liefert einen Fehler), kommt „<Ort> nicht lesbar: <Fehlertext>“ in `errors` (dafür `scratchpad::list` um eine Fehlerrückgabe erweitern oder vorher `fs::read_dir(dir)` prüfen); (3) für jeden geschriebenen und verlinkten Pfad: `fs::canonicalize` → liegt er in einem der beiden Scratchpads, nur `written`/`linked` am vorhandenen Eintrag setzen (Abgleich über `normalize_path`); liegt er in einem Repository-Ordner oder in `.artefakte`, weglassen; sonst `Elsewhere` mit `path` = kanonischer Pfad ohne `\\?\`-Vorsatz (vorhandene Datei) bzw. gespeicherter Pfad (fehlende), `folder` = Elternordner, `bytes`/`modified_at` aus `fs::metadata`. Dubletten über `normalize_path`. Je Datei `kind = artifacts::kind_of`, `viewer = viewers::page(kind).is_some()`, `executable = file_links::is_executable`. `truncated` = eines der beiden `ScratchpadListing.truncated`. Sortierung und Gruppenreihenfolge nach README; Gruppen ohne Dateien und ohne Fehler entfallen.
- [x] `src-tauri/src/session_files/access.rs`: `pub fn allowed_absolute(input: &SessionFilesInput, path: &str) -> Result<PathBuf, CommandError>` nach AK 6 (kanonisch prüfen; nicht vorhanden → `FileNotFound`; sonst `FileNotAllowed("Keine Datei einer Session dieses Vorhabens")`). `entry_dir` aus `commands/files.rs` nach `src-tauri/src/files/mod.rs` als `pub(crate) fn entry_dir(registry: &SessionRegistry, session_id: &str, key: &str)` verschieben (Aufrufer in `commands/files.rs` anpassen). `pub fn resolve_ref(registry: &SessionRegistry, session_id: &str, file: &FileRef) -> Result<PathBuf, CommandError>`: `Entry` → `entry_dir` + `files::checked_path`; `Absolute` → `session_files_input` + `allowed_absolute`.
- [x] `src-tauri/src/commands/session_files.rs` mit `session_files_list`, `session_file_read` (nach `allowed_absolute`: `files::read::read(parent, name)`), `file_reveal` (`app.opener().reveal_item_in_dir`), `file_open_default` (Sperre, dann `app.opener().open_path`), `file_open_in_editor` (`git::actions::open_file_in_vs_code(&file, line)`); alle `async` wie `commands/files.rs`; im `invoke_handler` in `lib.rs` eintragen. `file_view_url` folgt in Phase 3.
- [x] `commands/file_links.rs` `file_link_resolve`: `registry.artifacts_dir(&session_id)?` an `target` übergeben; bei `SessionFile { path, .. }` vor der Rückgabe `session_links::upsert_all(connection, &session_id, &[(path.clone(), now_ms())])` über `registry.database`-Zugriff wie in `artifact_scope`.
- [x] Bis Phase 4: `src/components/FileLink.tsx` behandelt `sessionFile` und `artifact` vorläufig mit `openFileLink(sessionId, path)` (Verhalten wie heute, inklusive Fehlersatz) — damit `pnpm check` (erschöpfende `switch`) grün bleibt.
- [x] Artefakte: `Artifact` (`artifacts/model.rs`) bekommt `pub executable: bool` (`#[serde(default)]`), gesetzt in `artifacts::list` mit `file_links::is_executable` (Website: `index.html`, Ordner: `false`). `artifact_open_default`: nach `checked_target` bei einer Datei `is_executable` → `FileNotAllowed("Ausführbare Datei wird nicht geöffnet")`.
- [x] `src-tauri/examples/session-files-probe.rs -- <Datenbank-Kopie> <Session-ID>`: öffnet die Kopie wie `artifacts-probe`, baut `SessionFilesInput` ohne laufende App (Hilfsfunktion in `session_files/mod.rs`, die nur Datenbank und Dateisystem braucht; `changes_input` wie im `changes-probe`), druckt je Gruppe `#<Nr> <Name>` und je Datei `  <ort> <folder> <name> [w][l][x][fehlt] <bytes>`, danach `errors` und `gekürzt`, wenn gesetzt. Nie gegen `%USERPROFILE%\.verwalter\verwalter.db`. Zeile in `AGENTS.md` → Befehle.
- [x] `src-tauri/examples/file-link-probe.rs`: Option `--artifacts <Ordner>`; neue Ausgaben `ZIEL session <Pfad> <Zeile|->` und `ZIEL artifact <Datei>`; Zeile in `AGENTS.md` anpassen.
- [x] Prüfen per Prüfprogramm: geschriebene Datei mit Großbuchstaben außerhalb des Vorhabens erscheint in echter Schreibweise (README, Risiko 2); falls nicht, Schreibweise über `fs::read_dir` des Elternordners holen und das im Report-Back festhalten.
- [x] `pnpm bindings` (neu: `SessionFile.ts`, `SessionFileGroup.ts`, `SessionFilesListing.ts`, `SessionFileOrigin.ts`, `FileRef.ts`; geändert: `FileLinkTarget.ts`, `Artifact.ts`), `pnpm check`.
- [x] Doku: `docs/code-map.md` Zeile „Session-Dateien“ (Kern vollständig: `session_files/{model,links,scan,access}.rs`, `registry/session_files.rs`, `commands/session_files.rs`, Prüfprogramm); Zeile „Dateiverweise im Chat“: neue Ziele, `EXECUTABLE_EXTENSIONS`, `is_executable`; Zeile „Artefakte“: `executable`.

## Report-Back

Status: complete (2026-11-25). `pnpm bindings` gelaufen, `pnpm check` grün.

**Abweichungen von der Checkliste**

- `#[ts(export)]` nicht gesetzt: kein Modell des Repos trägt es, `examples/gen-bindings.rs` zählt die Typen auf; die neuen stehen dort.
- Die Hilfsfunktion für Registry und Prüfprogramm heißt `session_files::collect_input`.
- `file_links::target` weist Netzwerkpfade vor jedem Dateisystemzugriff ab (README nachgezogen); ein gefundener, aber nicht absoluter Pfad wird abgewiesen statt als `SessionFile` geliefert.
- Grenze: außer über `normalize_path` ist eine Datei auch erlaubt, wenn sie kanonisch dieselbe ist wie ein gespeicherter Pfad — die Liste zeigt den echten Pfad, gespeichert sein kann einer mit `..` oder über eine Verknüpfung. Netzwerk- und Datenstrom-Pfade zählen dabei nicht.
- Ein Scratchpad-Ordner, der selbst eine Verknüpfung ist, gilt nicht als Scratchpad (weder für die Grenze noch für die Liste; die Gruppe trägt einen Fehlersatz). Sonst machte ein Agent mit einer Verknüpfung jeden Ordner zur Session-Datei.
- `allowed_absolute` liefert den echten Pfad ohne `\\?\`-Vorsatz (`filesystem::plain_path`, mit Gegenprobe, dass er dieselbe Datei meint); die Sperre (`file_links::program_target`) prüft den genannten und den echten Namen, unter Windows ohne Punkte und Leerzeichen am Ende. `artifact_open_default` öffnet damit den echten Pfad.

**Mitbehoben: Befehlsausführung über Dateinamen (Bestand)**

„In VS Code öffnen“ startete `cmd /C code <Datei>`; `cmd` führte aus, was im Dateinamen hinter `&` stand (mit einem Ersatz-`code.cmd` nachgestellt, auch `%VAR%` wurde ersetzt). Mit dem neuen Knopf an jeder Session-Datei wählt ein Agent den Namen. `git/actions.rs` startet jetzt `code.cmd` direkt (Rust maskiert die Argumente dafür selbst); fünf Namen mit Sonderzeichen kamen unverändert an.

**Geprüft** (Kopie der Datenbank, ein Wegwerf-Programm außerhalb des Repos)

- Risiko 2: aus dem klein gespeicherten Pfad wird `Ördner Ähnlich` / `Groß.TXT`; `fs::read_dir` als Ersatz ist nicht nötig. Eine fehlende Datei erscheint mit `[fehlt]` und dem gespeicherten Pfad.
- AK 2 und 4: eine geschriebene und verlinkte Scratchpad-Datei steht einmal mit beiden Merkmalen; dieselbe Datei bei zwei Sessions steht in beiden Gruppen; nach dem ersten Lauf sind alle Sessions markiert (15 und 59), der zweite Lauf liefert dieselbe Liste. Dass er keine Chat-Einträge liest, folgt aus `is_scanned` im Code, gemessen ist es nicht. Eine Gegenprobe über die gespeicherten Antworten findet dieselben Dateipfade wie die Nachlese (je Vorhaben einer — Agenten nennen absolute Pfade selten).
- Kommandozeilen-Scratchpad (echt und als Verknüpfung), Klickziele aller Arten samt Netzwerk- und Datenstrom-Pfaden (`file-link-probe`).
- Grenze und Sperre: 13 Fälle `allowed_absolute` (nie genannt, Ausbruch über `..` und über Verknüpfungen) und 10 Fälle `program_target` wie verlangt.
- Windows startet über `ShellExecute` für `ohne_endung` neben `ohne_endung.cmd`, für `.cmd` und für `boese.cmd.` nichts; eine eigene Sperre für Nachbardateien gibt es deshalb nicht.

**Nicht geprüft:** die Tauri-Befehle in der laufenden App, die Unix-Regel mit dem Ausführungsbit, `artifact_open_default` mit einem echten Artefakt.

**Zwischenstand bis Phase 4/5:** Ein Klick auf eine PDF in einem Repository öffnet „Dateien“ und zeigt „Binärdatei – keine Vorschau“ statt des Standardprogramms (der Betrachter folgt in Phase 5). Das Öffnen ausführbarer Artefakte (auch `.py`, `.js`, `.sh`) meldet jetzt „Ausführbare Datei wird nicht geöffnet“.

**Bekannte Grenze:** `EXECUTABLE_EXTENSIONS` ist eine Ausschlussliste (ADR 071); es fehlen z. B. `msix`, `appx`, `diagcab`.
