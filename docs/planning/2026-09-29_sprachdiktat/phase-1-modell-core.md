# Phase 1 — Core: Bau-Grundlage für whisper.cpp, Sprachmodell laden und prüfen

Rating: standard · Commit-Scope: `voice`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Festgelegte Entscheidungen“ und „Kontrakt“ (Typen, Fehler, Commands, Ereignisse) — verbindlich.
- [docs/conventions/rust.md](../../conventions/rust.md), [docs/conventions/linting.md](../../conventions/linting.md), [docs/conventions/commits.md](../../conventions/commits.md), [docs/decisions/](../../decisions/) (Format der ADRs, z.B. 007).
- Code: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` (Module, `app.manage`, `generate_handler!`), `src-tauri/src/error.rs` (`CommandError`, Serialisierung `tag = "kind", content = "message"`), `src-tauri/src/filesystem/workspace.rs` (`data_dir`), `src-tauri/src/background/model.rs` (Muster für Typen mit `derive(TS)` und Ereignis-Typen), `src-tauri/src/commands/background.rs` (Muster Commands mit `tauri::State`), `src-tauri/src/sessions/registry.rs` (Muster `app.emit(...)` samt Fehlerbehandlung), `src-tauri/src/bin/gen-bindings.rs`, `package.json` (Skripte `rust:clippy`, `bindings` laufen vom Repo-Wurzelordner mit `--manifest-path`), `.github/workflows/check.yml`.
- Crate-Dokumentation der gepinnten Versionen auf docs.rs: `ureq` 3 (`get`, `call`, `Body::as_reader`/`into_reader`, Verhalten bei HTTP-Fehlerstatus), `sha2` 0.11.
- Vault-Fehlerklassen: geprüft (React, TypeScript) — übertragbar ist nur „HTTP-Fehlerstatus ist kein Netzfehler“, siehe Checkliste Download; sonst keine einschlägig.

## Abnahmekriterien

1. `pnpm check` ist lokal und in der GitHub-Prüfung grün **mit** den neuen Abhängigkeiten `whisper-rs`, `cpal`, `ureq`, `sha2` — die C++-Übersetzung von whisper.cpp läuft durch. Dieser Punkt wird als Erstes erreicht und separat geprüft, bevor der Rest der Phase gebaut wird.
2. `voice_model_status` liefert `missing`, wenn die Modelldatei fehlt oder ihre Größe nicht 574 041 195 Bytes ist; `ready`, wenn Größe stimmt; `downloading` mit aktuellen Bytes, solange ein Download läuft. (Die Prüfsumme wird beim Download geprüft, nicht bei jedem Status-Aufruf — 574 MB hashen dauert.)
3. `voice_model_download` lädt nach `models\ggml-large-v3-turbo-q5_0.bin.part`, berechnet dabei SHA-256, vergleicht mit der Prüfsumme aus dem README und benennt erst dann in `ggml-large-v3-turbo-q5_0.bin` um. Falsche Prüfsumme, Netzfehler oder HTTP-Status ≥ 400 → `.part` gelöscht, Ereignis `voice://model` mit `state: missing` und dem Fehlertext in `error`.
4. `voice_model_cancel_download` beendet einen laufenden Download innerhalb von 1 s, löscht `.part`, sendet `missing`.
5. Ein zweiter `voice_model_download` während eines laufenden Downloads startet keinen zweiten.
6. `voice://model` kommt während des Downloads höchstens alle 250 ms und einmal bei jedem Zustandswechsel.
7. ADR 009 liegt unter `docs/decisions/009-sprachdiktat-lokal.md`.

## Checkliste

### Bau-Grundlage (zuerst, AK 1)

- [ ] Prüfen, ob `cmake --version` im Terminal läuft. Nicht vorhanden → CMake aus den Visual-Studio-Build-Tools nehmen: `$env:PATH = "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin;$env:PATH"` (vorhanden, geprüft am 2026-09-29). Nur für die Sitzung setzen; eine dauerhafte Benutzervariable setzt nur Sascha selbst.
- [ ] `src-tauri/Cargo.toml` `[dependencies]`: `whisper-rs = "0.16"`, `cpal = "0.18"`, `ureq = "3"`, `sha2 = "0.11"` — jeweils ohne zusätzliche Features.
- [ ] Neue Datei `.cargo/config.toml` **im Repo-Wurzelordner** (nicht in `src-tauri/`, weil `pnpm rust:clippy` vom Wurzelordner aus läuft und Cargo die Konfiguration vom Arbeitsverzeichnis aus sucht):
  ```toml
  [env]
  # whisper-rs-sys: mitgelieferte Bindings statt bindgen — spart libclang auf jedem Rechner und in der CI.
  WHISPER_DONT_GENERATE_BINDINGS = "1"
  ```
- [ ] `pnpm rust:clippy` lokal grün. Scheitert die C++-Übersetzung → Fehler in FINDINGS, **nicht** weiterbauen, Sascha fragen.
- [ ] `.github/workflows/check.yml`: vor `pnpm rust:clippy` einen Schritt `- run: cmake --version` einfügen (belegt im Log, dass die CI CMake hat; `windows-latest` bringt es mit).
- [ ] `docs/conventions/linting.md`: Abschnitt „Voraussetzungen“ um CMake ergänzen (wofür: whisper.cpp; woher: VS-Build-Tools-Pfad oben oder `winget install Kitware.CMake`). `AGENTS.md` Zeile zu `pnpm check` bleibt, der Hinweis steht nur in `linting.md`.

### Typen und Fehler

- [ ] Neues Modul `src-tauri/src/voice/` mit `mod.rs`, `model.rs`, `model_file.rs`. `pub mod voice;` in `src-tauri/src/lib.rs` (alphabetisch).
- [ ] `voice/model.rs`: `VoiceModelState`, `VoiceModelEvent`, `VoiceLevelEvent`, `VoicePartialEvent` wie im README-Kontrakt; Derives wie `background/model.rs`. `VoiceModelState` zusätzlich `PartialEq`.
- [ ] Alle vier Typen in `src-tauri/src/bin/gen-bindings.rs` eintragen, `pnpm bindings`.
- [ ] `src-tauri/src/error.rs`: die sieben Varianten aus der README-Tabelle, Texte wörtlich.

### Modelldatei und Download (`voice/model_file.rs`)

- [ ] Konstanten: `MODEL_FILE_NAME = "ggml-large-v3-turbo-q5_0.bin"`, `MODEL_URL` (gepinnte Adresse aus dem README), `MODEL_BYTES: u64 = 574_041_195`, `MODEL_SHA256 = "3942…a7e2"` (voller Wert aus dem README), `MODELS_DIR = "models"`.
- [ ] `pub fn model_path(app) -> Result<PathBuf, CommandError>` = `data_dir(app)?.join(MODELS_DIR).join(MODEL_FILE_NAME)`; legt nichts an.
- [ ] `pub fn is_model_ready(path: &Path) -> bool` — existiert und `metadata().len() == MODEL_BYTES`.
- [ ] `fn download(path: &Path, cancel: &AtomicBool, on_progress: impl FnMut(u64, u64)) -> Result<(), CommandError>`:
  - Ordner anlegen (`create_dir_all`), `.part` mit `File::create` (überschreibt Reste).
  - `ureq::get(MODEL_URL).call()`; **HTTP-Fehlerstatus muss ein Fehler sein** — ureq 3 wandelt Status ≥ 400 standardmäßig in `Err` um; diese Voreinstellung nicht abschalten und im Code-Kommentar festhalten, warum (sonst landet eine Fehlerseite als „Modell“ auf der Platte und fällt erst an der Prüfsumme auf).
  - Gesamtgröße aus `Content-Length`, fehlt sie → `MODEL_BYTES`.
  - In Blöcken zu 1 MiB lesen (`Read::read` über den Body-Reader **ohne** Größenlimit — in ureq 3 hat `read_to_vec` ein Limit, der Reader nicht; auf docs.rs verifizieren), in `.part` schreiben, `Sha256` fortschreiben, nach jedem Block `cancel` prüfen und `on_progress(received, total)` rufen.
  - Abbruch → `.part` löschen, `Err(VoiceDownload("abgebrochen"))` (der Aufrufer unterscheidet Abbruch über `cancel`, nicht über den Text).
  - Ende: Hex-Prüfsumme vergleichen; falsch → `.part` löschen, `VoiceDownload("Prüfsumme stimmt nicht")`; richtig → `rename` auf den endgültigen Namen.
  - Jeder `io`/`ureq`-Fehler → `.part` löschen (Fehler beim Löschen ignorieren), `VoiceDownload(<Text des Fehlers>)`.

### Dienst und Zustand (`voice/mod.rs`)

- [ ] Konstanten `VOICE_MODEL_EVENT = "voice://model"`, `VOICE_LEVEL_EVENT = "voice://level"`, `VOICE_PARTIAL_EVENT = "voice://partial"` (die letzten beiden erst Phase 2 genutzt; bis dahin `#[allow(dead_code)]` mit Kommentar „genutzt ab Phase 2“, falls Clippy anschlägt).
- [ ] `pub struct VoiceService { inner: Mutex<VoiceInner> }` mit `VoiceInner { download: Option<DownloadHandle> }`, `DownloadHandle { cancel: Arc<AtomicBool>, received: u64, total: u64 }`. `VoiceService::new()`. In `lib.rs` `app.manage(VoiceService::new())` neben den anderen `manage`-Aufrufen. Phase 2 erweitert `VoiceInner` — Struktur so anlegen, dass Felder dazukommen können.
- [ ] `pub fn model_state(&self, app) -> Result<VoiceModelState, CommandError>`: läuft ein Download → `Downloading` mit den Werten aus dem Handle; sonst `is_model_ready` → `Ready`/`Missing`.
- [ ] `pub fn start_download(&self, app: AppHandle) -> Result<(), CommandError>`: läuft schon einer → `Ok(())`. Sonst Handle eintragen, `downloading 0/MODEL_BYTES` senden, Thread starten (`std::thread::spawn`, Muster wie in `changes/mod.rs`), der `download` ruft; Fortschritt aktualisiert das Handle unter dem Mutex und sendet `voice://model` höchstens alle 250 ms (`Instant`). Ende: Handle entfernen, dann `ready` bzw. `missing` senden — `error` nur setzen, wenn **nicht** abgebrochen wurde. Sendefehler wie in `registry.rs` nur loggen (`eprintln!`).
- [ ] `pub fn cancel_download(&self)`: setzt `cancel` im Handle, sonst nichts.
- [ ] Mutex-Vergiftung: `lock()` → `map_err(|_| CommandError::Internal("voice lock".into()))`, kein `unwrap` (Clippy verbietet es).

### Commands

- [ ] `src-tauri/src/commands/voice.rs` mit `voice_model_status`, `voice_model_download`, `voice_model_cancel_download` (Signaturen laut README, `app: tauri::AppHandle`, `voice: tauri::State<'_, VoiceService>`), `pub mod voice;` in `commands/mod.rs`, in `generate_handler!` eintragen.
- [ ] `src/lib/voice.ts`: Wrapper `loadVoiceModelState`, `downloadVoiceModel`, `cancelVoiceModelDownload` und `onVoiceModel(handler): Promise<UnlistenFn>` — Muster `src/lib/background.ts`.

### Doku

- [ ] `docs/decisions/009-sprachdiktat-lokal.md` aus „Festgelegte Entscheidungen“ (Kontext / betrachtete Optionen a–c + gewählt / Entscheidung / Konsequenzen: CMake als Bau-Voraussetzung, 574 MB Download, ~0,8 GB RAM, nur CPU). Eigener Absatz „Text während des Sprechens“ mit dem Schnitt an Sprechpausen und den beiden verworfenen Wegen (gleitendes Fenster, erst nach dem Stopp) samt Begründung aus dem README.
- [ ] `docs/conventions/commits.md`: Scope `voice` ergänzen.
- [ ] `docs/code-map.md`: Zeile „Diktieren (Sprachmodell, Aufnahme, Erkennung)“ mit Core `src-tauri/src/voice/` (`model_file.rs`), `commands/voice.rs`, Wrapper `src/lib/voice.ts`; `voice` in die Feature-Liste unter „Namensschema“.
- [ ] `docs/glossary.md`: „Diktieren“ (Sprache per Mikrofon aufnehmen und lokal in Text für den Entwurf umwandeln; sendet nie selbst) und „Sprachmodell“ (die lokal gespeicherte Whisper-Datei unter `<Benutzerordner>\.verwalter\models\`, einmal auf Klick geladen).
- [ ] Commit `feat(voice): Sprachmodell laden und prüfen, Bau mit whisper.cpp`.

## Report-Back
