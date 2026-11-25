# Phase 3 — Kern: Betrachter-Adresse für einzelne Dateien

Rating: heikel (Sicherheitsgrenze des Artefakt-Servers). Der Artefakt-Server liefert neben dem Ordner `.artefakte` einzelne geprüfte Dateien unter einer zufälligen Adresse aus, roh oder in der Betrachter-Seite der Artefakte. `file_view_url` gibt diese Adresse für Repository- und Session-Dateien aus.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt („Betrachter-Adresse“, Befehle), Risiken (Video spulen)
- [ADR 071](../../decisions/071-session-dateien.md), [ADR 047](../../decisions/047-artefakte-alle-dateitypen.md) (Betrachter, CSP), [ADR 026](../../decisions/026-artefakte.md)
- `src-tauri/src/artifacts/server.rs` — ganz: `ArtifactServer` (`token`, `origin`, `host`, `base_url`), `answer`, `artifact_csp`, `with_bridge`, `content_type`, `percent_encode`, `percent_decode`, `not_found`, `text_reply`, `Reply`
- `src-tauri/src/artifacts/viewers/mod.rs` — `render`, `page`; `src-tauri/src/artifacts/viewers/common.js` und die Betrachter, die die Rohdatei per `fetch` holen (`image.js`, `video.js`, `audio.js`, `pdf.js`, `markdown.js`, `csv.js`, `json.js`, `yaml.js`, `xml.js`, `text.js`, `mermaid.js`)
- `src-tauri/src/lib.rs` — Start des Artefakt-Servers und `app.manage(...)`
- `src-tauri/src/session_files/access.rs` — `resolve_ref` (Phase 2)
- Fehlerklassen (Vault `sprachen/typescript`): „`fetch` wirft nicht bei HTTP-Fehlerstatus“ — ein Betrachter, der nach `fetch` nur `catch` prüft, zeigt bei 404 eine leere oder kaputte Ansicht statt eines Fehlersatzes.

## AK

1. `file_view_url(session_id, file)` liefert für eine erlaubte Datei `http://127.0.0.1:<port>/<token>/~datei/<handle>/<Dateiname, prozentkodiert>?view=1`; dieselbe Datei bekommt bei wiederholtem Aufruf denselben Handle; nach 512 verschiedenen Dateien fällt der älteste Handle weg.
2. `GET /<token>/~datei/<handle>/<name>` liefert die Datei mit passendem `Content-Type`, mit `?view=1` die Betrachter-Seite des Typs (`viewers::render(kind_of(path), name)` + Brücke); ein Typ ohne Betrachter liefert mit `?view=1` 404.
3. Unbekannter Handle, abweichender Dateiname, Unterpfade (`<handle>/a/b`) oder eine inzwischen gelöschte Datei → 404; falscher Host → 403, andere Methode → 405 (wie bisher).
4. Die CSP dieser Antworten nennt als Bereich `<origin>/<token>/~datei/<handle>/`; eine Artefakt-Seite kann eine `~datei`-Adresse nicht per `fetch` lesen (CSP `connect-src` ihres eigenen Bereichs).
5. Jeder Betrachter, der die Rohdatei per `fetch` holt, prüft `response.ok` und zeigt sonst den Satz „Datei nicht lesbar (<Status>)“.
6. Rohdateien (nicht HTML) beantwortet der Server mit `Accept-Ranges: bytes`; eine Anfrage mit genau einer Spanne `Range: bytes=<von>-[<bis>]` bekommt `206 Partial Content` mit `Content-Range: bytes <von>-<bis>/<Größe>` und nur diesen Bytes; eine ungültige Spanne `416` mit `Content-Range: bytes */<Größe>`; ohne `Range` wie bisher `200`. Gilt für `~datei` und für Artefakte (Videos spulen sonst nicht, README Risiko 3).
7. `pnpm check` grün.

## Checkliste

- [ ] `src-tauri/src/session_files/handles.rs`: `#[derive(Default)] pub struct ViewHandles(Mutex<VecDeque<(String, PathBuf)>>)` mit `pub fn issue(&self, path: PathBuf) -> String` (vorhandenen Eintrag gleichen Pfads zurückgeben, sonst `uuid::Uuid::new_v4().simple().to_string()` anhängen und bei mehr als 512 vorn entfernen) und `pub fn get(&self, handle: &str) -> Option<PathBuf>`. In `lib.rs` `app.manage(ViewHandles::default())` neben dem Start des Artefakt-Servers.
- [ ] `ArtifactServer`: `pub fn file_url(&self, handle: &str, name: &str) -> String` = `format!("{origin}/{token}/~datei/{handle}/{}?view=1", percent_encode(name))`.
- [ ] `server.rs` `answer`: direkt nach dem Abtrennen des Tokens (`rest`) — vor dem Aufteilen in Session und Pfad — `if let Some(file_part) = rest.strip_prefix("~datei/") { return self.answer_file(file_part, wants_viewer); }`. `fn answer_file(&self, rest: &str, wants_viewer: bool) -> Reply`: `rest` genau `<handle>/<name>` (kein weiteres `/`), `percent_decode(name)`; Handle über `self.app.try_state::<ViewHandles>()`; `path.file_name()` muss gleich `name` sein; `path.is_file()`; Bereich `format!("{}/{}/~datei/{}/", self.origin, self.token, handle)` (Handle aus der Tabelle, nicht aus dem Anfragetext); Antwort wie im bestehenden Zweig (Betrachter: `viewers::render(kind_of(&path), &name)` + `with_bridge`; roh: `fs::read`, `content_type`, HTML + `with_bridge`), CSP `artifact_csp(&scope)`.
- [ ] `src-tauri/src/commands/session_files.rs`: `file_view_url(registry, server: tauri::State<'_, ArtifactServer>, handles: tauri::State<'_, ViewHandles>, session_id, file: FileRef) -> Result<String, CommandError>`: `resolve_ref`, `is_file` prüfen (sonst `FileNotFound`), `handles.issue(path)`, `server.file_url(&handle, name)`. Im `invoke_handler` eintragen. (Wie der Server heute als State heißt: `grep -n "manage(" src-tauri/src/lib.rs`.)
- [ ] Betrachter-Skripte: jede `fetch`-Stelle in `artifacts/viewers/*.js` prüfen; wo `response.ok` fehlt, ergänzen und über die gemeinsame Fehleranzeige in `common.js` „Datei nicht lesbar (<Status>)“ zeigen.
- [ ] `Range` nach AK 6: `answer` gibt die Kopfzeile `Range` (aus `head`, wie `Host`) an beide Rohdatei-Zweige weiter; `fn byte_range(header: &str, size: u64) -> Result<Option<(u64, u64)>, ()>` (nur `bytes=`, genau eine Spanne, `<von>-` bis Dateiende, `-<n>` = letzte n Bytes); `Reply` um `status`-Varianten 206/416 und die Kopfzeilen `Accept-Ranges`/`Content-Range` erweitern (`write_reply` schreibt sie, wenn gesetzt). Die Datei bleibt ganz gelesen (`fs::read`) und wird geschnitten — Dateien sind lokal.
- [ ] Prüfen mit `curl -s -D - -H "Range: bytes=0-99" "<Adresse ohne ?view=1>" -o NUL` gegen eine Datei aus `file_view_url` (Adresse aus dem Prüfprogramm oder nach Phase 5 aus der Ansicht): Status 206, `Content-Range: bytes 0-99/<Größe>`; Ergebnis im Report-Back.
- [ ] `mcp-probe`/`artifacts-probe` unverändert lauffähig (Server-Zweig für Sessions nicht angefasst): `cargo build --examples`.
- [ ] Doku: `docs/code-map.md` Zeile „Artefakte“ um `~datei`-Adressen und `ViewHandles` ergänzen; Zeile „Session-Dateien“ um `handles.rs` und `file_view_url`.

## Report-Back
