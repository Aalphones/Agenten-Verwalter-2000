# Phase 2 — Core: Aufnahme, Pegel, Erkennung

Rating: heikel (Audio-Thread mit nicht verschiebbarem Stream, nebenläufiges Laden des Modells, Abbruch mitten in der Erkennung) · Commit-Scope: `voice`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Festgelegte Entscheidungen“ und „Kontrakt“ — verbindlich. Phase 1 muss abgeschlossen sein (Report-Back in [phase-1-modell-core.md](phase-1-modell-core.md) lesen).
- [ADR 009](../../decisions/009-sprachdiktat-lokal.md), [docs/conventions/rust.md](../../conventions/rust.md).
- Code: `src-tauri/src/voice/` (Stand nach Phase 1: `mod.rs` mit `VoiceService`/`VoiceInner`, `model.rs`, `model_file.rs` mit `model_path`/`is_model_ready`), `src-tauri/src/commands/voice.rs`, `src-tauri/src/error.rs`, `src-tauri/src/sessions/registry.rs` (`SessionRegistry::repositories_of` → `(PathBuf, Vec<SessionRepository>)`, `SessionRepository.name` in `src-tauri/src/worktrees/mod.rs`), `src-tauri/src/commands/attachments.rs` (Muster `async` Command), `src/lib/voice.ts`.
- Crate-Dokumentation der gepinnten Versionen auf docs.rs — **die Aufrufe unten sind nach Sinn beschrieben, die genauen Namen stehen dort**: `cpal` 0.18 (`default_host`, `default_input_device`, `default_input_config`, `build_input_stream`, `SampleFormat`, `StreamTrait::play`; `Stream` ist nicht `Send`), `whisper-rs` 0.16 (`WhisperContext::new_with_params`, `WhisperContextParameters`, `create_state`, `FullParams::new(SamplingStrategy::Greedy { best_of: 1 })`, `set_language`, `set_initial_prompt`, `set_n_threads`, `set_translate`, `set_no_context`, `set_suppress_blank`, `set_suppress_nst`, `set_no_speech_thold`, `set_print_special`/`set_print_progress`/`set_print_realtime`/`set_print_timestamps`, Abbruch-Callback, `full`, Segmente lesen).
- Vault-Fehlerklassen: geprüft (React, TypeScript) — keine einschlägig.

## Abnahmekriterien

1. `voice_start(sessionId)` kehrt in unter 500 ms zurück. Ohne fertiges Modell → `voiceModelMissing`; läuft schon ein Diktat (Aufnahme **oder** Erkennung) → `voiceBusy`; kein Eingabegerät oder Gerät lässt sich nicht öffnen (auch: Windows-Mikrofonzugriff aus) → `microphone` mit dem Text des Geräte-Fehlers. In allen Fehlerfällen ist danach kein Diktat aktiv.
2. Während der Aufnahme kommt `voice://level` alle ~50 ms mit `level = min(1.0, rms * 6.0)` (RMS der seit dem letzten Ereignis eingegangenen Samples, 0.0 wenn keine kamen).
3. `voice_stop` beendet die Aufnahme sofort (keine weiteren `voice://level`) und liefert den erkannten Text getrimmt. Es blockiert keinen Tauri-Hauptthread (Arbeit in `tauri::async_runtime::spawn_blocking`).
4. Ganz stille Aufnahme (Spitzenwert aller Samples < 0.001) → `noAudio`, ohne Whisper aufzurufen. Aufnahme, in der weniger als 5 % der 30-ms-Fenster einen RMS über 0.01 haben → `noSpeech`, ohne Whisper aufzurufen. Leeres Ergebnis nach dem Filter (Checkliste Erkennung) → `noSpeech`.
5. `voice_cancel` während der Aufnahme: Aufnahme endet, nichts wird erkannt, ein späteres `voice_stop` liefert `voiceCancelled`. `voice_cancel` während der Erkennung: Whisper bricht über den Abbruch-Callback ab, das laufende `voice_stop` liefert `voiceCancelled`. Danach ist sofort ein neues Diktat möglich.
6. Aufnahmen über 120 s werden auf die ersten 120 s gekürzt (die Oberfläche stoppt nach 120 s selbst, Phase 3; der Core schützt nur vor unbegrenztem Wachstum).
7. Das Modell wird beim ersten `voice_start` im Hintergrund geladen und für alle weiteren Diktate wiederverwendet; ein Ladefehler kommt als `internal` beim `voice_stop` und wird beim nächsten `voice_start` neu versucht.
8. Im Entwicklungsmodus steht nach jeder Erkennung eine Zeile auf der Konsole: `voice: <Sekunden Audio> s Audio, Modell <ms> ms geladen/0, erkannt in <ms> ms` — Messgrundlage für Smoke-Punkt 1.
9. `pnpm check` grün; `pnpm bindings` ohne Änderung an `src/lib/bindings` außer `CommandError.ts`, falls die Phase-1-Varianten dort noch fehlten.

## Checkliste

### Umrechnung (`voice/resample.rs`)

- [ ] `pub const TARGET_RATE: u32 = 16_000;`
- [ ] `pub fn to_mono_16k(interleaved: &[f32], channels: u16, rate: u32) -> Vec<f32>`: zuerst je Frame den Mittelwert der Kanäle; dann, wenn `rate != TARGET_RATE`, lineare Interpolation: Ausgabelänge `n_out = (n_in as u64 * 16_000 / rate as u64) as usize`, für Ausgabeindex `i` Quellposition `p = i * rate / 16_000` (als `f64`), Wert `a + (b - a) * frac` mit `a = x[floor]`, `b = x[min(floor + 1, n_in - 1)]`. Leere Eingabe → leerer Vektor. Doc-Kommentar: warum ohne Tiefpass (Spracherkennung, nicht Wiedergabe).

### Aufnahme (`voice/recorder.rs`)

- [ ] `pub struct Captured { pub samples: Vec<f32>, pub channels: u16, pub rate: u32 }` (interleaved, f32 in −1…1).
- [ ] `enum RecorderCommand { Stop, Cancel }`.
- [ ] `pub struct Recorder { commands: mpsc::Sender<RecorderCommand>, finished: mpsc::Receiver<Option<Result<Captured, CommandError>>> }` — `None` = abgebrochen.
- [ ] `pub fn start(app: AppHandle) -> Result<Recorder, CommandError>`: startet **einen eigenen Thread**, der Gerät öffnet, Stream baut und startet — der `cpal::Stream` wird in diesem Thread erzeugt und dort auch wieder fallen gelassen (nicht `Send`, Kommentar dazu). Der Thread meldet über einen `mpsc::sync_channel(0)`/`(1)` „gestartet“ oder den Fehler zurück; `start` wartet darauf und gibt den Fehler als `Microphone(..)` weiter (AK 1).
  - Gerät: `default_host().default_input_device()`, fehlt → `Microphone("kein Eingabegerät gefunden")`. Format: `default_input_config()`.
  - Callback je `SampleFormat`: `F32` direkt, `I16` → `/ 32768.0`, `U16` → `(v as f32 - 32768.0) / 32768.0`; jedes andere Format → `Microphone("Format <fmt> nicht unterstützt")`. Der Callback hängt nur an einen `Arc<Mutex<Vec<f32>>>` an (höchstens `120 * rate * channels` Samples, danach verwerfen) und addiert Quadratsumme und Anzahl für den Pegel in einen zweiten kleinen `Mutex` — keine Ereignisse aus dem Callback senden.
  - Fehler-Callback des Streams (Gerät abgezogen): Text in einen `Arc<Mutex<Option<String>>>` legen.
  - Schleife im Thread: `commands.recv_timeout(50 ms)`; bei Zeitablauf Pegel berechnen (AK 2), zurücksetzen, `voice://level` senden (Sendefehler nur loggen). `Stop` → Stream fallen lassen, Fehler aus dem Fehler-Callback vorhanden → `Some(Err(Microphone(text)))`, sonst `Some(Ok(Captured))`. `Cancel` oder getrennter Sender → Stream fallen lassen, `None`.
- [ ] `impl Recorder { pub fn stop(self) -> Result<Captured, CommandError>; pub fn cancel(self) }` — `stop` schickt `Stop` und wartet auf `finished`; ein getrennter Kanal → `Internal("Aufnahme-Thread beendet")`.

### Erkennung (`voice/transcribe.rs`)

- [ ] `pub struct Transcriber { context: WhisperContext }`, `pub fn load(path: &Path) -> Result<Transcriber, CommandError>` (Standard-Parameter, Fehler → `Internal("Sprachmodell: <text>")`).
- [ ] `pub fn transcribe(&self, audio: &[f32], prompt: &str, cancel: Arc<AtomicBool>) -> Result<String, CommandError>`: neuer State je Aufruf; Parameter Greedy `best_of: 1`, Sprache `"de"`, `translate false`, `no_context true`, `suppress_blank true`, `suppress_nst true`, `no_speech_thold 0.6`, `n_threads = min(available_parallelism, 8)`, alle `print_*` aus, `initial_prompt = prompt`, Abbruch-Callback liest `cancel`. Nach `full`: war `cancel` gesetzt → `VoiceCancelled`. Segmente einsammeln; **Segmente verwerfen**, deren Text `"Untertitel im Auftrag des ZDF"` oder `"Amara.org"` enthält (bekannte Whisper-Erfindungen bei Stille im Deutschen, Kommentar dazu); Rest mit Leerzeichen verbinden, doppelte Leerzeichen zusammenziehen, trimmen. Leer → `NoSpeech`.
- [ ] `pub fn is_silent(audio: &[f32]) -> Silence` mit `enum Silence { NoAudio, NoSpeech, Speech }` nach AK 4 (Fenster 480 Samples = 30 ms bei 16 kHz). Die Schwellen als benannte Konstanten mit Kommentar „gesetzt im Plan, per Smoke-Test bestätigt“.

### Dienst (`voice/mod.rs`, Erweiterung von `VoiceInner`)

- [ ] Neue Felder: `recorder: Option<Recorder>`, `is_transcribing: bool`, `cancel: Arc<AtomicBool>`, `prompt: String`, `transcriber: Option<Arc<Transcriber>>`, `loader: Option<JoinHandle<Result<Transcriber, CommandError>>>`.
- [ ] `pub fn start(&self, app: AppHandle, repository_names: Vec<String>) -> Result<(), CommandError>` in dieser Reihenfolge unter dem Mutex: `recorder.is_some() || is_transcribing` → `VoiceBusy`; `!is_model_ready(model_path)` → `VoiceModelMissing`; `cancel` durch ein **neues** `Arc<AtomicBool>` ersetzen (ein alter Abbruch darf das neue Diktat nicht treffen); `prompt` bauen (unten); `Recorder::start(app)?` → `recorder = Some(..)`; wenn `transcriber` und `loader` beide `None` → `loader = Some(thread::spawn(Transcriber::load(path)))`.
- [ ] Prompt: `"Verwalter, Claude, Session, Worktree, Branch, Commit, Repository, Diff, Changes, Skill, Agent, Commit-Nachricht, Pull Request"` plus `", "` und die Repository-Namen, wenn vorhanden. Deutsch, Komma-getrennt — Whisper nutzt ihn als Wortschatz-Hinweis.
- [ ] `pub fn stop(&self) -> Result<String, CommandError>` (läuft im blockierenden Thread): unter dem Mutex `recorder.take()` — `None` → `VoiceCancelled`; `is_transcribing = true`, `cancel` klonen, `loader.take()` merken; **Mutex freigeben**. Dann `recorder.stop()?`, `to_mono_16k`, auf 120 s kürzen, `is_silent` → Fehler; Transcriber holen: vorhandenen nehmen oder `loader.join()` (Ergebnis unter dem Mutex in `transcriber` ablegen; Fehler → zurückgeben, `loader` bleibt `None`, damit der nächste Start neu lädt; kein `loader` und kein `transcriber` → synchron laden); `cancel` gesetzt → `VoiceCancelled`; `transcribe(..)`; Zeitmessung und Konsolenzeile (AK 8). **In jedem Ausgang** `is_transcribing = false` setzen — über eine kleine Guard-Struktur mit `Drop`, nicht über verstreute Zuweisungen.
- [ ] `pub fn cancel(&self)`: `cancel.store(true)`; `recorder.take()` → `cancel()`; `is_transcribing` bleibt, bis `stop` selbst endet.

### Commands

- [ ] `voice_start(app, voice, registry, session_id: Option<String>)`: Repository-Namen über `registry.repositories_of(id)` holen — schlägt das fehl (Session unbekannt), mit leerer Liste weitermachen, das Diktat ist wichtiger als der Hinweis. Dann `voice.start(..)`.
- [ ] `voice_stop(app)`: `tauri::async_runtime::spawn_blocking(move || app.state::<VoiceService>().stop())`, `JoinError` → `Internal`.
- [ ] `voice_cancel(voice)`.
- [ ] In `generate_handler!` eintragen; Wrapper `startDictation(sessionId: string | null)`, `stopDictation(): Promise<string>`, `cancelDictation()`, `onVoiceLevel(handler)` in `src/lib/voice.ts`.

### Prüfen vor dem Commit

- [ ] Ein Probelauf mit echtem Mikrofon kommt erst mit der Oberfläche in Phase 3. Hier: `pnpm check` grün, und `to_mono_16k` sowie `is_silent` einmal in einem Wegwerf-Programm außerhalb des Repos gegen Hand-Werte prüfen (48-kHz-Stereo-Eingabe mit 4800 Frames → 1600 Samples; nur Nullen → `NoAudio`). Kein Test-Code ins Repo (Projekt ohne automatisierte Tests).

### Doku

- [ ] `docs/code-map.md`: Zeile „Diktieren“ um `recorder.rs` (eigener Thread, Pegel), `resample.rs`, `transcribe.rs` ergänzen.
- [ ] Commit `feat(voice): Sprache aufnehmen und lokal erkennen`.

## Report-Back
