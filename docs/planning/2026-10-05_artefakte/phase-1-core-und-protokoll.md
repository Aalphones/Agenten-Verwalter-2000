# Phase 1 — Core: Ordner, Liste, Artefakt-Server, Sicherheitsprobe

**Rating:** heikel (Sicherheitsgrenze: fremdes HTML mit Skripten im Fenster des Verwalters). Läuft auf dem großen Modell.

## Kontext

- [README des Plans](README.md), Abschnitt „Kontrakt“ — Typen, Commands, Artefakt-Server, CSP und Sandbox stehen dort und gelten wörtlich.
- `src-tauri/src/background/scratchpad.rs` (`read`: Muster für die Pfadprüfung mit `components()`, `canonicalize`, `starts_with`).
- `src-tauri/src/commands/file_links.rs` (Muster für einen `async`-Command, der über das Opener-Plugin öffnet).
- `src-tauri/src/sessions/registry.rs` (`Session` mit `workspace`, `project_id`, `number`; `SessionState.name`; `get`; die Untermodule `mod commit_scan; mod mcp; mod tldr;`), `src-tauri/src/sessions/registry/tldr.rs` (`project_members`, `pub(super)`), `src-tauri/src/db/session_files.rs` (`load_for`), `src-tauri/src/changes/attribution.rs` (`normalize_path`).
- `src-tauri/src/lib.rs` (Builder, `setup`, `invoke_handler`), `src-tauri/tauri.conf.json` (`app.security.csp`), `src-tauri/src/error.rs` (`FileNotFound`, `FileNotAllowed`, `Io`), `src-tauri/examples/gen-bindings.rs`.
- Tauri 2.12 (`%USERPROFILE%\.cargo\registry\src\index.crates.io-*\tauri-2.12.0\src\`): `webview/mod.rs` `is_local_url` (Seiten eines von der App registrierten Protokolls gelten als lokal) und `on_message` (entfernte Herkunft ohne Remote-Capability wird abgewiesen); `manager/webview.rs` `main_frame_script` — unter Windows laufen diese Skripte trotzdem auch im iframe (Sicherheitsprobe, FINDINGS).
- `docs/conventions/rust.md`, `docs/conventions/linting.md`.

## Abnahmekriterien der Phase

1. `artifacts_list` liefert für eine Session die `.html`/`.htm`-Dateien direkt in `<Workspace>\.artefakte\`, neueste zuerst, mit Titel aus `<title>` (sonst Dateiname ohne Endung) und der Session, die die Datei zuletzt mit einem schreibenden Werkzeug angefasst hat; fehlt der Ordner, ist die Liste leer und `dir` trotzdem gesetzt; `baseUrl` zeigt auf den Ordner der Session auf dem Artefakt-Server.
2. `<baseUrl><datei>` liefert die Datei mit `Content-Type` nach Endung, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *` und der Artefakt-CSP aus dem Kontrakt; Unterordner-Pfade (`bilder/a.png`) gehen.
3. Pfade mit `..`, Laufwerk, Wurzel oder einem Ziel außerhalb des kanonischen Ordners (auch über Symlink) → 403; falscher `Host` → 403; falscher Token, fehlende Datei oder unbekannte Session → 404; andere Methode als `GET` → 405. Nie 200 außerhalb von `.artefakte`.
4. Die Sicherheitsprobe (unten) zeigt im iframe der App nur grüne Zeilen; die Probe der Befehle bekommt keine Antwort.
5. `pnpm check` grün; ADR 026 liegt vor.

## Checkliste

### Feature-Modul `src-tauri/src/artifacts/`

- [x] `model.rs`: `Artifact` und `ArtifactList` exakt wie im Kontrakt (Derives und `serde`-Attribute wie die Structs in `src-tauri/src/mcp/model.rs`). Dazu `ArtifactOwner` (nicht exportiert, nur Core).
- [x] `mod.rs`: `DIR_NAME`, `dir`, `is_artifact_file`, `list` (Besitzer über `normalize_path` und `touched`, neueste zuerst), `title_of` (höchstens 64 KiB, Entities, Leerraum, 200 Zeichen), `resolve` (wie `scratchpad::read`; `FileNotAllowed` bei Ausbruch, `FileNotFound` bei fehlender Datei oder Ordner); `pub mod model; pub mod server;`.
- [x] `server.rs`: `start(app) -> io::Result<ArtifactServer>` bindet `127.0.0.1:0`, Token UUID v4, ein Thread nimmt an, je Verbindung ein Thread; Kopfzeilen höchstens 16 KiB, Lese-Timeout 5 s; Prüfreihenfolge `Host` → Methode → Token → Session/Pfad (`percent_decode`) → `artifacts_dir` → `resolve` → `fs::read`; Antwort mit `Content-Length`, `Connection: close`, `X-Content-Type-Options: nosniff`, bei 200 zusätzlich `Access-Control-Allow-Origin: *` und die Artefakt-CSP mit dem Ordner der Session als einziger eigener Quelle. `ArtifactServer::base_url(session_id)`. `content_type` nach Endung wie bisher.
- [x] `src-tauri/src/lib.rs`: `pub mod artifacts;`; in `setup` nach der Registry `artifacts::server::start(...)`, Erfolg → `app.manage(server)`, Fehler → `eprintln!`, die App startet trotzdem.

### Registry

- [x] `src-tauri/src/sessions/registry/artifacts.rs`: `artifacts_dir`, `artifact_scope` (Sperren nacheinander, Datenbank erst ohne Session-Sperre).

### Commands

- [x] `src-tauri/src/commands/artifacts.rs`: `artifacts_list` (holt `ArtifactServer` mit `try_state`, fehlt er → `CommandError::Io`), `artifact_open_in_browser` (`is_artifact_file`, `resolve`, Opener-Plugin).
- [x] `src-tauri/src/commands/mod.rs`, `generate_handler!` in `lib.rs`, `gen-bindings.rs` (`Artifact`, `ArtifactList`), `pnpm bindings`.

### Konfiguration

- [x] `src-tauri/tauri.conf.json`: an die CSP `; frame-src http://127.0.0.1:*` anhängen. Sonst nichts ändern.

### Sicherheitsprobe (Pflicht vor Phase 2)

- [x] `pnpm tauri dev` starten (nicht die installierte App — die kennt den Server nicht). [artifacts/sicherheitsprobe.html](artifacts/sicherheitsprobe.html), [artifacts/probe-bild.svg](artifacts/probe-bild.svg) und [artifacts/probe-ipc.html](artifacts/probe-ipc.html) in `<Workspace>\.artefakte\` eines Vorhabens kopieren. Die Session-ID steht im Workspace-Pfad des Scratchpads (`.scratchpad\<session-id>`).
- [x] Devtools der App öffnen (Rechtsklick → Untersuchen), Konsole:
  ```js
  const l = await window.__TAURI_INTERNALS__.invoke('artifacts_list', { sessionId: '<session-id>' });
  for (const [i, page] of ['sicherheitsprobe.html', 'probe-ipc.html'].entries()) {
    const f = document.createElement('iframe');
    f.sandbox = 'allow-scripts allow-forms allow-modals';
    f.src = l.baseUrl + page;
    f.style.cssText = `position:fixed;top:40px;left:${20 + i * 50}vw;z-index:9999;background:#fff;width:45vw;height:80vh`;
    document.body.append(f);
  }
  console.log((await fetch(l.baseUrl + '..%5C..%5Cverwalter.db')).status);
  ```
- [x] Erwartung: jede Zeile beider Proben grün, der Status 403 oder 404. **Ist eine Zeile rot, die den Zugriff auf den Verwalter betrifft (Sicherheitsprobe 1–5, Befehls-Probe 3–4): anhalten, in FINDINGS eintragen, den User fragen — Phase 2 nicht beginnen.** Zeile 1 der Sicherheitsprobe darf rot bleiben, solange die Befehls-Probe grün ist: das Objekt kommt von Tauri, Befehle von `127.0.0.1` weist Tauri ab. Rote Zeilen 6–8 (Laden aus dem Ordner bzw. dem Internet): Ursache in Server oder CSP suchen und beheben.
- [x] Ergebnis (Zeilen der Proben + Status) unter „Report-Back“ eintragen.

### Doku

- [x] ADR `docs/decisions/026-artefakte.md`.
- [x] `docs/code-map.md`: Zeile „Artefakte“ (Core), Feature `artifacts` im Namensschema.

## Report-Back

- Erste Fassung mit eigenem Tauri-Protokoll `artefakt` (Commit `ecebabe`): Sicherheitsprobe Zeile 1 rot, `invoke` samt Invoke-Key im iframe vorhanden, und Tauri stuft das Protokoll als lokal ein (FINDINGS). Auf Entscheidung des Users durch den Artefakt-Server auf `127.0.0.1` ersetzt.
- Weitere Abweichungen: `pub mod artifacts;` statt `mod` (wie alle Feature-Module, `gen-bindings` braucht den Zugriff); in `title_of` wird `&amp;` zuletzt ersetzt, sonst würde aus `&amp;lt;` ein `<`; der Server holt die Registry mit `try_state`; die CSP erlaubt nur den Ordner der eigenen Session statt des ganzen Servers; Glossar „Artefakt“ und Commit-Scope `artifacts` nachgezogen.
- Sicherheitsprobe mit dem Server (2026-10-06, `pnpm tauri dev`): Sicherheitsprobe Zeile 1 rot (erlaubt, s. o.), Zeilen 2–8 grün, Herkunft `null`; Befehls-Probe `app_info` und `project_list` ohne Antwort (Timeout). Direkt gegen den Server (curl): Datei 200 mit Artefakt-CSP auf den Session-Ordner; `..%5C..%5Cverwalter.db`, `..%2F..%2Fverwalter.db`, `C:%5CWindows%5Cwin.ini` → 403; fehlende Datei, falscher Token → 404; fremder `Host` → 403; `POST` → 405.
