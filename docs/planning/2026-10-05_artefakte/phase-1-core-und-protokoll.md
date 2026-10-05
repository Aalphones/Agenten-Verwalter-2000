# Phase 1 — Core: Ordner, Liste, Protokoll, Sicherheitsprobe

**Rating:** heikel (Sicherheitsgrenze: fremdes HTML mit Skripten im Fenster des Verwalters). Läuft auf dem großen Modell.

## Kontext

- [README des Plans](README.md), Abschnitt „Kontrakt“ — Typen, Commands, Protokoll, CSP und Sandbox stehen dort und gelten wörtlich.
- `src-tauri/src/background/scratchpad.rs` (`read`: Muster für die Pfadprüfung mit `components()`, `canonicalize`, `starts_with`).
- `src-tauri/src/commands/file_links.rs` (Muster für einen `async`-Command, der über das Opener-Plugin öffnet).
- `src-tauri/src/sessions/registry.rs` (`Session` mit `workspace`, `project_id`, `number`; `SessionState.name`; `get`; die Untermodule `mod commit_scan; mod mcp; mod tldr;`), `src-tauri/src/sessions/registry/tldr.rs` (`project_members`, `pub(super)`), `src-tauri/src/db/session_files.rs` (`load_for`), `src-tauri/src/changes/attribution.rs` (`normalize_path`).
- `src-tauri/src/lib.rs` (Builder, `invoke_handler`), `src-tauri/tauri.conf.json` (`app.security.csp`), `src-tauri/src/error.rs` (`FileNotFound`, `FileNotAllowed`, `Io`), `src-tauri/examples/gen-bindings.rs`.
- Tauri 2.12: `register_asynchronous_uri_scheme_protocol` in `%USERPROFILE%\.cargo\registry\src\index.crates.io-*\tauri-2.12.0\src\app.rs` (Kommentar ab „Windows and Android: `http://<scheme_name>.localhost/<path>`“). Die Init-Skripte für `invoke` laufen nur im Hauptframe (`manager/webview.rs`, `main_frame_script`) — die Probe unten belegt, dass das im iframe gilt.
- `docs/conventions/rust.md`, `docs/conventions/linting.md`.

## Abnahmekriterien der Phase

1. `artifacts_list` liefert für eine Session die `.html`/`.htm`-Dateien direkt in `<Workspace>\.artefakte\`, neueste zuerst, mit Titel aus `<title>` (sonst Dateiname ohne Endung) und der Session, die die Datei zuletzt mit einem schreibenden Werkzeug angefasst hat; fehlt der Ordner, ist die Liste leer und `dir` trotzdem gesetzt.
2. `http://artefakt.localhost/<session-id>/<datei>` liefert die Datei mit `Content-Type` nach Endung, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *` und der Artefakt-CSP aus dem Kontrakt; Unterordner-Pfade (`bilder/a.png`) gehen.
3. Pfade mit `..`, Laufwerk, Wurzel oder einem Ziel außerhalb des kanonischen Ordners (auch über Symlink) → 403; fehlende Datei oder unbekannte Session → 404; andere Methode als `GET` → 405. Nie 200 außerhalb von `.artefakte`.
4. Die Sicherheitsprobe (unten) zeigt im iframe der App nur grüne Zeilen.
5. `pnpm check` grün; ADR 026 liegt vor.

## Checkliste

### Feature-Modul `src-tauri/src/artifacts/`

- [ ] `model.rs`: `Artifact` und `ArtifactList` exakt wie im Kontrakt (Derives und `serde`-Attribute wie die Structs in `src-tauri/src/mcp/model.rs`; exportiert wird über `gen-bindings.rs`, unten). Dazu `pub struct ArtifactOwner { pub session_id: String, pub number: u32, pub name: String, pub touched: HashMap<String, f64> }` (nicht exportiert, nur Core).
- [ ] `mod.rs`:
  - `pub const DIR_NAME: &str = ".artefakte";`, `pub fn dir(workspace: &Path) -> PathBuf` (= `workspace.join(DIR_NAME)`).
  - `pub fn is_artifact_file(name: &str) -> bool` — kein `/` oder `\` im Namen, Endung `.html`/`.htm` ohne Rücksicht auf Groß-/Kleinschreibung.
  - `pub fn list(dir: &Path, owners: &[ArtifactOwner]) -> Vec<Artifact>` — `fs::read_dir(dir)`; Fehler (auch „nicht vorhanden“) → leere Liste. Nur Einträge mit `file_type().is_file()` und `is_artifact_file`. `modified_at` aus `metadata.modified()` in ms (`duration_since(UNIX_EPOCH)`; Fehler → 0). Besitzer: Schlüssel `attribution::normalize_path(&dir.join(&file).to_string_lossy())`; unter allen `owners` den mit dem größten `touched[schlüssel]`; keiner → alle drei Session-Felder `None`. Sortiert nach `modified_at` absteigend, bei Gleichstand nach `file`.
  - `fn title_of(path: &Path) -> Option<String>` — höchstens 64 KiB lesen (`File::open(..)?.take(65_536)`), `String::from_utf8_lossy`; in einer `to_ascii_lowercase`-Kopie (gleiche Byte-Positionen) `<title` suchen, dann das nächste `>`, dann `</title`; dazwischen aus dem Original schneiden; `&amp; &lt; &gt; &quot; &#39; &nbsp;` ersetzen; Leerraum zu einem Leerzeichen zusammenziehen, trimmen, auf 200 Zeichen kürzen; leer → `None`. `list` nimmt sonst den Dateinamen ohne Endung.
  - `pub fn resolve(dir: &Path, relative: &str) -> Result<PathBuf, CommandError>` — wie `scratchpad::read`: leer oder `Component::ParentDir | RootDir | Prefix` → `CommandError::FileNotAllowed(relative)`; `dir.join(relative)` existiert nicht → `CommandError::FileNotFound(relative)`; kanonisches Ziel nicht unter kanonischem `dir` → `FileNotAllowed`; Ordner statt Datei → `FileNotFound`.
  - `pub mod protocol;`, `pub mod model;`.
- [ ] `protocol.rs`:
  - `pub const ARTIFACT_CSP: &str` = der Wert aus dem Kontrakt, wörtlich.
  - `pub fn handle(ctx: tauri::UriSchemeContext<'_, tauri::Wry>, request: tauri::http::Request<Vec<u8>>, responder: tauri::UriSchemeResponder)` — `AppHandle` aus `ctx.app_handle().clone()`, Arbeit in `std::thread::spawn` (Dateizugriff nicht auf dem Thread des WebViews), Ergebnis mit `responder.respond(response)`.
  - Ablauf: Methode ≠ `GET` → 405. Pfad `request.uri().path()` ohne führendes `/`, an erstem `/` teilen in Session-Teil und Rest; fehlt der Rest → 404. Beide mit `percent_decode` dekodieren (ungültig → 404). Rest: `/` durch `\` ersetzen. `app.state::<SessionRegistry>().artifacts_dir(&session_id)` (Fehler → 404). `artifacts::resolve(&dir, &rest)`: `FileNotFound` → 404, sonst Fehler → 403. Datei lesen (`fs::read`; Fehler → 404).
  - Antwort 200 mit `Content-Type` = `content_type(&path)`, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *`, `Content-Security-Policy: ARTIFACT_CSP`. Fehlerantworten: `Content-Type: text/plain; charset=utf-8`, Text „Nicht gefunden“ / „Nicht erlaubt“ / „Nur GET“.
  - `fn percent_decode(text: &str) -> Option<String>` — eigene Funktion, keine neue Abhängigkeit: `%` + zwei Hex-Ziffern → Byte, sonst Byte übernehmen; unvollständiges `%` → `None`; Ergebnis `String::from_utf8(..).ok()`.
  - `fn content_type(path: &Path) -> &'static str` — nach Endung in Kleinbuchstaben: `html|htm` → `text/html; charset=utf-8`, `css` → `text/css; charset=utf-8`, `js|mjs` → `text/javascript; charset=utf-8`, `json|map` → `application/json`, `svg` → `image/svg+xml`, `png` → `image/png`, `jpg|jpeg` → `image/jpeg`, `gif` → `image/gif`, `webp` → `image/webp`, `ico` → `image/x-icon`, `woff` → `font/woff`, `woff2` → `font/woff2`, `ttf` → `font/ttf`, `otf` → `font/otf`, `txt|md|csv` → `text/plain; charset=utf-8`, `mp4` → `video/mp4`, `webm` → `video/webm`, sonst `application/octet-stream`.
- [ ] `src-tauri/src/lib.rs`: `mod artifacts;` (wie die anderen Feature-Module) und am Builder vor `.setup(…)` `.register_asynchronous_uri_scheme_protocol("artefakt", artifacts::protocol::handle)`.

### Registry

- [ ] Neue Datei `src-tauri/src/sessions/registry/artifacts.rs` mit eigenem `impl SessionRegistry` (Muster: `registry/mcp.rs`), in `registry.rs` als `mod artifacts;` neben `mod mcp;`:
  - `pub fn artifacts_dir(&self, session_id: &str) -> Result<PathBuf, CommandError>` = `artifacts::dir(&self.get(session_id)?.workspace)`.
  - `pub fn artifact_scope(&self, session_id: &str) -> Result<(PathBuf, Vec<ArtifactOwner>), CommandError>` — Workspace der Session; `self.project_members(&session.project_id)`; je Mitglied **nacheinander** (nie zwei Sperren zugleich, nie unter der Map-Sperre — wie `project_ticket_worktrees`) `name` aus `member.lock()`; danach, ohne Sperre, je Mitglied `self.database.with(|c| session_files::load_for(c, &[member.id.clone()]))` als `touched`.

### Commands

- [ ] `src-tauri/src/commands/artifacts.rs`: `artifacts_list` und `artifact_open_in_browser` wie im Kontrakt, beide `pub async fn`, Muster `commands/file_links.rs`. `artifact_open_in_browser`: `is_artifact_file(&file)` sonst `FileNotAllowed`; `artifacts::resolve(&dir, &file)?`; `app.opener().open_path(target.to_string_lossy(), None::<&str>)`, Fehler → `CommandError::Io`.
- [ ] `src-tauri/src/commands/mod.rs` um `pub mod artifacts;` ergänzen, beide Commands in `generate_handler!` in `lib.rs`.
- [ ] `src-tauri/examples/gen-bindings.rs`: `Artifact` und `ArtifactList` exportieren; `pnpm bindings`.

### Konfiguration

- [ ] `src-tauri/tauri.conf.json`: an die CSP `; frame-src http://artefakt.localhost` anhängen. Sonst nichts ändern.

### Sicherheitsprobe (Pflicht vor Phase 2)

- [ ] `pnpm tauri dev` starten. Ein Test-Vorhaben anlegen (oder ein vorhandenes nehmen), dessen Workspace-Ordner im Explorer öffnen, darin `.artefakte` anlegen und [artifacts/sicherheitsprobe.html](artifacts/sicherheitsprobe.html) sowie [artifacts/probe-bild.svg](artifacts/probe-bild.svg) hineinkopieren. Die Session-ID steht in der Datenbank (`sessions.id`) oder im Workspace-Pfad des Scratchpads (`.scratchpad\<session-id>`).
- [ ] Devtools der App öffnen (Rechtsklick → Untersuchen), Konsole:
  ```js
  const f = document.createElement('iframe');
  f.sandbox = 'allow-scripts allow-forms allow-modals';
  f.src = 'http://artefakt.localhost/<session-id>/sicherheitsprobe.html';
  f.style.cssText = 'position:fixed;inset:40px;z-index:9999;background:#fff;width:80vw;height:80vh';
  document.body.append(f);
  ```
- [ ] Erwartung: jede Zeile der Probe grün. **Ist eine Zeile rot, die den Zugriff auf den Verwalter betrifft (Zeilen 1–5): anhalten, in FINDINGS eintragen, den User fragen — Phase 2 nicht beginnen.** Rote Zeilen 6–8 (Laden aus dem Ordner bzw. dem Internet): Ursache in Protokoll oder CSP suchen und beheben.
- [ ] Zusätzlich in der Konsole des Hauptfensters: `fetch('http://artefakt.localhost/<session-id>/..%5C..%5Cverwalter.db').then(r => r.status)` → 403 oder 404.
- [ ] Ergebnis (Zeilen der Probe + Status) unter „Report-Back“ eintragen.

### Doku

- [ ] ADR `docs/decisions/026-artefakte.md` (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen, ~10–20 Zeilen): Optionen waren (a) Ablageordner + Anweisung, (b) eigenes MCP-Werkzeug „Ansicht zeigen“, (c) jede vom Agenten geschriebene `.html`-Datei; Darstellung (a) `srcdoc` — erbt die App-CSP und findet keine relativen Bilder, (b) Asset-Protokoll — Scope ist `$HOME/.verwalter/**`, Workspaces liegen woanders und es setzt keine eigene CSP, (c) eigenes Protokoll mit eigener CSP. Entscheidung: Ablageordner `.artefakte` je Vorhaben, eigenes Protokoll `artefakt`, Sandbox ohne `allow-same-origin`, Internet über https erlaubt (der Agent, der das HTML schreibt, hat ohnehin eine Shell), Abfrage alle 2 s statt Dateiwächter (keine neue Abhängigkeit, erfasst auch per Shell geschriebene Seiten). Konsequenzen: keine Links nach außen im Rahmen (App-CSP `frame-src`), Formulare schicken nichts ab, keine Popups.
- [ ] `docs/code-map.md`: neue Zeile „Artefakte (HTML-Seiten des Agenten im Reiter „Artefakte“)“ — Oberfläche: „folgt in Phase 2“; Core: `src-tauri/src/artifacts/` (`model.rs`, `mod.rs` `dir`/`list`/`resolve`, `protocol.rs` Schema `artefakt`), `src-tauri/src/commands/artifacts.rs`, `src-tauri/src/sessions/registry/artifacts.rs` (ADR 026). In der Feature-Liste unter „Namensschema“ `artifacts` (Artefakte) ergänzen.

## Report-Back
