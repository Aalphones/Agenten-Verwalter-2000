# Phase 2 — Core: Aufnahme, Pegel, satzweise Erkennung während der Aufnahme

Rating: heikel (Audio-Thread mit nicht verschiebbarem Stream, Erkennung parallel zur laufenden Aufnahme, nebenläufiges Laden des Modells, Abbruch mitten in der Erkennung) · Commit-Scope: `voice`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Festgelegte Entscheidungen“ (besonders „Text erscheint satzweise“) und „Kontrakt“ — verbindlich. Phase 1 muss abgeschlossen sein (Report-Back in [phase-1-modell-core.md](phase-1-modell-core.md) lesen).
- [ADR 009](../../decisions/009-sprachdiktat-lokal.md), [docs/conventions/rust.md](../../conventions/rust.md).
- Code: `src-tauri/src/voice/` (Stand nach Phase 1: `mod.rs` mit `VoiceService`/`VoiceInner` und den Ereignis-Konstanten, `model.rs`, `model_file.rs` mit `model_path`/`is_model_ready`), `src-tauri/src/commands/voice.rs`, `src-tauri/src/error.rs`, `src-tauri/src/sessions/registry.rs` (`SessionRegistry::repositories_of` → `(PathBuf, Vec<SessionRepository>)`, `SessionRepository.name` in `src-tauri/src/worktrees/mod.rs`), `src-tauri/src/commands/attachments.rs` (Muster `async` Command), `src/lib/voice.ts`.
- Crate-Dokumentation der gepinnten Versionen auf docs.rs — **die Aufrufe unten sind nach Sinn beschrieben, die genauen Namen stehen dort**: `cpal` 0.18 (`default_host`, `default_input_device`, `default_input_config`, `build_input_stream`, `SampleFormat`, `StreamTrait::play`; `Stream` ist nicht `Send`), `whisper-rs` 0.16 (`WhisperContext::new_with_params`, `WhisperContextParameters`, `create_state`, `FullParams::new(SamplingStrategy::Greedy { best_of: 1 })`, `set_language`, `set_initial_prompt`, `set_n_threads`, `set_translate`, `set_no_context`, `set_suppress_blank`, `set_suppress_nst`, `set_no_speech_thold`, `set_print_special`/`set_print_progress`/`set_print_realtime`/`set_print_timestamps`, Abbruch-Callback, `full`, Segmente lesen). **Auf docs.rs prüfen, ob `WhisperContext` `Send + Sync` ist** — davon hängt ab, ob `Transcriber` ihn direkt oder in einem `Mutex` hält (Checkliste Erkennung).
- Vault-Fehlerklassen: geprüft (React, TypeScript) — keine einschlägig.

## Ablauf in einem Bild

```text
Mikrofon ──cpal-Callback──▶ Shared (Samples, Pegel, Spitzenwert)
                                │ alle 50 ms
                                ▼
                     Aufnahme-Thread: Pegel senden, Segmenter füttern
                                │ fertiger Abschnitt (an Sprechpause, nach 25 s, oder beim Stopp)
                                ▼  mpsc-Kanal
                     Erkennungs-Thread: Modell holen, Abschnitt erkennen,
                     Gesamttext wachsen lassen, voice://partial senden
                                │ Kanal zu (Aufnahme vorbei)
                                ▼
                     voice_stop wartet darauf und gibt den Gesamttext zurück
```

## Abnahmekriterien

1. `voice_start(sessionId)` kehrt in unter 500 ms zurück. Ohne fertiges Modell → `voiceModelMissing`; läuft schon ein Diktat (Aufnahme **oder** laufendes `voice_stop`) → `voiceBusy`; kein Eingabegerät oder Gerät lässt sich nicht öffnen (auch: Windows-Mikrofonzugriff aus) → `microphone` mit dem Text des Geräte-Fehlers. In allen Fehlerfällen ist danach kein Diktat aktiv und kein Erkennungs-Thread gestartet.
2. Während der Aufnahme kommt `voice://level` alle ~50 ms mit `level = min(1.0, rms * 6.0)` (RMS der seit dem letzten Ereignis eingegangenen Samples, 0.0 wenn keine kamen).
3. Nach Sprache (mindestens 200 ms laut) und einer anschließenden Pause von 600 ms geht der Abschnitt in die Erkennung, während die Aufnahme weiterläuft; danach kommt `voice://partial` mit dem **gesamten** bisher erkannten Text. Ein Abschnitt, der 25 s lang wird, wird auch ohne Pause abgeschnitten. Kurze Geräusche unter 200 ms Lautstärke werden verworfen, nicht erkannt. Stille vor dem ersten Wort wird bis auf 300 ms verworfen.
4. Liegen beim Erkennungs-Thread mehrere Abschnitte an, erkennt er sie **zusammen in einem Durchlauf**, nicht einzeln nacheinander.
5. `voice_stop` beendet die Aufnahme sofort (keine weiteren `voice://level`), schickt den Rest als letzten Abschnitt, wartet, bis alles erkannt ist, und liefert den gesamten Text (alle Abschnitte mit je einem Leerzeichen verbunden, getrimmt). Es blockiert keinen Tauri-Hauptthread (Arbeit in `tauri::async_runtime::spawn_blocking`).
6. Ergibt das ganze Diktat keinen Text: Spitzenwert aller Samples < 0.001 → `noAudio`, sonst → `noSpeech`. Abschnitte, in denen weniger als 5 % der 30-ms-Fenster einen RMS über 0.01 haben, gehen nicht an Whisper. Ein einzelner Abschnitt ohne Text (nach dem Filter, Checkliste Erkennung) ist kein Fehler, er wird übersprungen.
7. `voice_cancel` während der Aufnahme: Aufnahme endet, der Erkennungs-Thread bricht ab (auch mitten in einem Abschnitt über den Abbruch-Callback), es kommt kein weiteres `voice://partial`, ein späteres `voice_stop` liefert `voiceCancelled`. `voice_cancel` während eines laufenden `voice_stop`: das `voice_stop` liefert `voiceCancelled`. Danach ist **sofort** ein neues Diktat möglich, auch wenn der alte Erkennungs-Thread noch ausläuft.
8. Die Aufnahme nimmt höchstens 120 s Audio an, danach werden weitere Samples verworfen (die Oberfläche stoppt nach 120 s selbst, Phase 3; der Core schützt nur vor unbegrenztem Wachstum).
9. Das Modell wird beim ersten Diktat vom Erkennungs-Thread geladen, während die Aufnahme schon läuft, und für alle weiteren Diktate wiederverwendet; zwei Ladevorgänge gleichzeitig gibt es nie. Ein Ladefehler kommt als `internal` beim `voice_stop` und wird beim nächsten Diktat neu versucht.
10. Im Entwicklungsmodus (`cfg!(debug_assertions)`) stehen auf der Konsole: beim Laden `voice: Sprachmodell geladen in <ms> ms`; je Erkennungs-Durchlauf `voice: Abschnitt <s, eine Nachkommastelle> s Audio (<n> zusammengefasst), erkannt in <ms> ms`; am Ende von `voice_stop` `voice: Stopp bis Text <ms> ms` — Messgrundlage für Smoke-Punkt 1 und 2.
11. `pnpm check` grün; `pnpm bindings` ohne Änderung an `src/lib/bindings` außer `CommandError.ts`, falls die Phase-1-Varianten dort noch fehlten.

## Checkliste

### Stille-Schwellen (`voice/silence.rs`)

- [x] Konstanten mit Doc-Kommentar „gesetzt im Plan, per Smoke-Test bestätigt“: `SILENT_PEAK: f32 = 0.001`, `SPEECH_RMS: f32 = 0.01`, `SPEECH_SHARE: f32 = 0.05`, `WINDOW: usize = 480` (30 ms bei 16 kHz).
- [x] `pub enum Silence { NoAudio, NoSpeech, Speech }`, `pub fn is_silent(audio: &[f32]) -> Silence` (16 kHz mono): Spitzenwert < `SILENT_PEAK` → `NoAudio`; Anteil der `WINDOW`-Fenster mit RMS > `SPEECH_RMS` unter `SPEECH_SHARE` → `NoSpeech`; sonst `Speech`. Leere Eingabe → `NoAudio`.

### Umrechnung (`voice/resample.rs`)

- [x] `pub const TARGET_RATE: u32 = 16_000;`
- [x] `pub fn to_mono_16k(interleaved: &[f32], channels: u16, rate: u32) -> Vec<f32>`: zuerst je Frame den Mittelwert der Kanäle; dann, wenn `rate != TARGET_RATE`, lineare Interpolation: Ausgabelänge `n_out = (n_in as u64 * 16_000 / rate as u64) as usize`, für Ausgabeindex `i` Quellposition `p = i * rate / 16_000` (als `f64`), Wert `a + (b - a) * frac` mit `a = x[floor]`, `b = x[min(floor + 1, n_in - 1)]`. Leere Eingabe → leerer Vektor. Doc-Kommentar: warum ohne Tiefpass (Spracherkennung, nicht Wiedergabe). Wird je Abschnitt aufgerufen, nicht je 50-ms-Stück.

### Abschnitte schneiden (`voice/segmenter.rs`, reine Logik ohne Gerät)

- [x] Konstanten: `PAUSE_TICKS: u32 = 12` (600 ms), `MIN_SPEECH_TICKS: u32 = 4` (200 ms), `LEAD_IN_MS: u32 = 300`, `MAX_SEGMENT_SECS: u32 = 25`. Doc-Kommentar: ein Tick = ein 50-ms-Durchlauf des Aufnahme-Threads; ein Tick zählt als Sprache, wenn sein RMS ≥ `silence::SPEECH_RMS` ist.
- [x] `pub struct Segmenter { segment: Vec<f32>, speech_ticks: u32, silent_run: u32, lead_in_len: usize, max_len: usize }`. `pub fn new(channels: u16, rate: u32) -> Self` mit `lead_in_len = (rate * LEAD_IN_MS / 1000) as usize * channels as usize` und `max_len = (rate * MAX_SEGMENT_SECS) as usize * channels as usize` (beides ganze Frames, damit nie ein Frame zerschnitten wird — die Samples kommen von cpal immer in ganzen Frames).
- [x] `pub fn push_tick(&mut self, samples: Vec<f32>, is_speech: bool) -> Option<Vec<f32>>`, genau in dieser Reihenfolge:
  1. `segment.extend(samples)`.
  2. `is_speech` → `speech_ticks += 1`, `silent_run = 0`; sonst `silent_run += 1`.
  3. `speech_ticks == 0` → nur die letzten `lead_in_len` Samples behalten (vorne abschneiden), `None`.
  4. sonst, wenn `silent_run >= PAUSE_TICKS` **oder** `segment.len() >= max_len`: Abschnitt abschließen (unten), Ergebnis zurückgeben.
  5. sonst `None`.
- [x] Abschnitt abschließen (private Funktion): `speech_ticks >= MIN_SPEECH_TICKS` → `Some(std::mem::take(&mut segment))`, sonst `segment.clear()` und `None`; in beiden Fällen `speech_ticks = 0`, `silent_run = 0`.
- [x] `pub fn finish(mut self) -> Option<Vec<f32>>`: Abschnitt abschließen nach derselben Regel (für den Stopp).

### Aufnahme (`voice/recorder.rs`)

- [x] `struct Shared { samples: Vec<f32>, total: usize, sum_sq: f64, count: usize, peak: f32, stream_error: Option<String> }` hinter **einem** `Arc<Mutex<Shared>>`.
- [x] `pub struct Recorded { pub peak: f32 }`.
- [x] `enum RecorderCommand { Stop, Cancel }`.
- [x] `pub struct Recorder { pub channels: u16, pub rate: u32, commands: mpsc::Sender<RecorderCommand>, finished: mpsc::Receiver<Option<Result<Recorded, CommandError>>> }` — `None` = abgebrochen.
- [x] `pub fn start(app: AppHandle, segments: mpsc::Sender<Vec<f32>>) -> Result<Recorder, CommandError>`: startet **einen eigenen Thread**, der Gerät öffnet, Stream baut und startet — der `cpal::Stream` wird in diesem Thread erzeugt und dort auch wieder fallen gelassen (nicht `Send`, Kommentar dazu). Der Thread meldet über einen `mpsc::sync_channel(1)` entweder `Ok((channels, rate))` oder den Fehler zurück; `start` wartet darauf und gibt den Fehler als `Microphone(..)` weiter (AK 1).
  - Gerät: `default_host().default_input_device()`, fehlt → `Microphone("kein Eingabegerät gefunden")`. Format: `default_input_config()`.
  - Callback je `SampleFormat`: `F32` direkt, `I16` → `/ 32768.0`, `U16` → `(v as f32 - 32768.0) / 32768.0`; jedes andere Format → `Microphone("Format <fmt> nicht unterstützt")`. Der Callback sperrt `Shared` einmal und: ist `total` bereits bei `120 * rate * channels` → nichts tun; sonst die Samples anhängen (höchstens bis zur Grenze), `total`, `sum_sq`, `count` fortschreiben, `peak` = Maximum der Beträge. Keine Ereignisse aus dem Callback senden, nichts Blockierendes.
  - Fehler-Callback des Streams (Gerät abgezogen): Text in `Shared.stream_error` legen.
  - Schleife im Thread mit einem eigenen `Segmenter::new(channels, rate)`: `commands.recv_timeout(50 ms)`.
    - Zeitablauf → **Tick**: `Shared` sperren, `samples` mit `std::mem::take` herausnehmen, `rms = sqrt(sum_sq / count)` (0.0 bei `count == 0`), `sum_sq`/`count` zurücksetzen, entsperren. `voice://level` senden (Sendefehler nur loggen). `segmenter.push_tick(samples, count > 0 && rms >= SPEECH_RMS)` — liefert es einen Abschnitt, über `segments.send` schicken (Sendefehler ignorieren: dann ist der Erkennungs-Thread schon mit einem Fehler beendet, `voice_stop` meldet ihn).
    - `Stop` → einen letzten Tick ohne Pegel-Ereignis (restliche Samples holen und in den Segmenter geben), Stream fallen lassen, `segmenter.finish()` und ggf. senden, `segments` fallen lassen (schließt den Kanal, der Erkennungs-Thread merkt so das Ende). `stream_error` vorhanden → `Some(Err(Microphone(text)))`, sonst `Some(Ok(Recorded { peak }))`.
    - `Cancel` oder getrennter Sender → Stream fallen lassen, **nichts** mehr senden, `segments` fallen lassen, `None`.
- [x] `impl Recorder { pub fn stop(self) -> Result<Recorded, CommandError>; pub fn cancel(self) }` — `stop` schickt `Stop` und wartet auf `finished`; ein getrennter Kanal → `Internal("Aufnahme-Thread beendet")`. `cancel` schickt `Cancel` und wartet nicht.

### Erkennung (`voice/transcribe.rs`)

- [x] `pub struct Transcriber { context: WhisperContext }` — ist `WhisperContext` laut docs.rs nicht `Sync`, stattdessen `context: Mutex<WhisperContext>` und in `transcribe` sperren (Kommentar dazu: ein auslaufender abgebrochener Erkennungs-Thread kann kurz neben einem neuen laufen). `pub fn load(path: &Path) -> Result<Transcriber, CommandError>` (Standard-Parameter, Fehler → `Internal("Sprachmodell: <text>")`).
- [x] `pub fn transcribe(&self, audio: &[f32], prompt: &str, cancel: &Arc<AtomicBool>) -> Result<String, CommandError>`: neuer State je Aufruf; Parameter Greedy `best_of: 1`, Sprache `"de"`, `translate false`, `no_context true`, `suppress_blank true`, `suppress_nst true`, `no_speech_thold 0.6`, `n_threads = min(available_parallelism, 8)`, alle `print_*` aus, `initial_prompt = prompt`, Abbruch-Callback liest `cancel`. Nach `full`: war `cancel` gesetzt → `VoiceCancelled`. Segmente einsammeln; **Segmente verwerfen**, deren Text `"Untertitel im Auftrag des ZDF"` oder `"Amara.org"` enthält (bekannte Whisper-Erfindungen bei Stille im Deutschen, Kommentar dazu); Rest mit Leerzeichen verbinden, doppelte Leerzeichen zusammenziehen, trimmen. Leer → `NoSpeech`.

### Erkennungs-Thread (`voice/dictation.rs`)

- [x] `pub const BASE_PROMPT: &str = "Verwalter, Claude, Session, Worktree, Branch, Commit, Repository, Diff, Changes, Skill, Agent, Commit-Nachricht, Pull Request";` und `pub fn base_prompt(repository_names: &[String]) -> String` = `BASE_PROMPT` plus `", "` und die Namen, wenn vorhanden. Deutsch, Komma-getrennt — Whisper nutzt ihn als Wortschatz-Hinweis.
- [x] `fn prompt_tail(text: &str) -> &str`: die letzten 200 **Zeichen** (nicht Bytes, Umlaute! über `char_indices`), dann bis einschließlich zum ersten Leerzeichen vorne abschneiden, damit der Ausschnitt mit einem ganzen Wort beginnt; ist `text` kürzer als 200 Zeichen → ganzer Text.
- [x] `pub fn run(app: AppHandle, segments: mpsc::Receiver<Vec<f32>>, channels: u16, rate: u32, base_prompt: String, cancel: Arc<AtomicBool>) -> Result<String, CommandError>`:
  1. `let transcriber = app.state::<VoiceService>().transcriber(&app)?;` (lädt beim ersten Mal, AK 9 — die Abschnitte stauen sich derweil im Kanal).
  2. `let mut text = String::new();` Schleife: `segments.recv()` — `Err` (Kanal zu) → Schleife beenden. Danach mit `try_recv` alle bereits anliegenden Abschnitte an den ersten anhängen und die Anzahl zählen (AK 4).
  3. `cancel` gesetzt → `Err(VoiceCancelled)`.
  4. `to_mono_16k`, dann `is_silent` ≠ `Speech` → nächster Durchlauf.
  5. Prompt: `text` leer → `base_prompt`; sonst `format!("{base_prompt}. {}", prompt_tail(&text))`.
  6. `transcriber.transcribe(..)`: `Ok(part)` → an `text` anhängen (mit einem Leerzeichen, wenn `text` nicht leer); `Err(NoSpeech)` → nächster Durchlauf; anderer Fehler → zurückgeben.
  7. Konsolenzeile je Durchlauf (AK 10).
  8. `cancel` **nicht** gesetzt → `voice://partial` mit `VoicePartialEvent { text: text.clone() }` senden (Sendefehler nur loggen). Die Prüfung direkt vor dem Senden verhindert Text eines abgebrochenen Diktats in einem neuen.
  9. Nach der Schleife: `cancel` gesetzt → `Err(VoiceCancelled)`, sonst `Ok(text)`.

### Dienst (`voice/mod.rs`)

- [x] `VoiceService` bekommt neben `inner` ein zweites Feld `load_lock: Mutex<()>` (nur zum Hintereinanderschalten des Modell-Ladens, Kommentar dazu).
- [x] Neue Felder in `VoiceInner`: `recorder: Option<Recorder>`, `worker: Option<JoinHandle<Result<String, CommandError>>>`, `is_transcribing: bool`, `cancel: Arc<AtomicBool>`, `transcriber: Option<Arc<Transcriber>>`.
- [x] `pub fn transcriber(&self, app: &AppHandle) -> Result<Arc<Transcriber>, CommandError>`: `load_lock` sperren und bis zum Ende halten; unter `inner` nachsehen, ob `transcriber` da ist → Klon zurück; sonst **ohne** `inner` zu halten `Transcriber::load(&model_path(app)?)` (Zeit messen, Konsolenzeile AK 10), Ergebnis unter `inner` ablegen, Klon zurück. Ladefehler → zurückgeben, `transcriber` bleibt `None` (AK 9).
- [x] `pub fn start(&self, app: AppHandle, repository_names: Vec<String>) -> Result<(), CommandError>` in dieser Reihenfolge unter `inner`: `recorder.is_some() || is_transcribing` → `VoiceBusy`; `!is_model_ready(&model_path(&app)?)` → `VoiceModelMissing`; ein noch gespeicherter `worker` stammt von einem abgebrochenen Diktat → `worker = None` (Thread läuft selbst aus und sendet nichts mehr, weil sein `cancel` gesetzt ist — nicht joinen, sonst wartet `voice_start` und `transcriber()` könnte auf `inner` warten); `cancel` durch ein **neues** `Arc<AtomicBool>` ersetzen; `let (tx, rx) = mpsc::channel()`; `let recorder = Recorder::start(app.clone(), tx)?`; Erkennungs-Thread `thread::spawn` mit `dictation::run(app, rx, recorder.channels, recorder.rate, base_prompt(&repository_names), cancel.clone())`; `recorder` und `worker` ablegen.
- [x] `pub fn stop(&self) -> Result<String, CommandError>` (läuft im blockierenden Thread): unter `inner`: `recorder.take()` — `None` → `VoiceCancelled`; `worker.take()` — `None` → `Internal("kein Erkennungs-Thread")`; `is_transcribing = true`; `cancel` klonen; **`inner` freigeben**. Dann `let recorded = recorder.stop()` — Fehler → `cancel.store(true)` (Erkennungs-Thread bricht ab), Fehler zurückgeben. `worker.join()` — `JoinError` → `Internal("Erkennungs-Thread abgestürzt")`; `cancel` gesetzt → `VoiceCancelled`; Ergebnis mit `?` auspacken; Text leer → `recorded.peak < SILENT_PEAK` ? `NoAudio` : `NoSpeech` (AK 6). Konsolenzeile (AK 10). **In jedem Ausgang** `is_transcribing = false` setzen — über eine kleine Guard-Struktur mit `Drop`, nicht über verstreute Zuweisungen.
- [x] `pub fn cancel(&self)`: unter `inner`: `cancel.store(true)`; `recorder.take()` → `cancel()`. `worker` bleibt liegen (siehe `start`), `is_transcribing` bleibt, bis ein laufendes `stop` selbst endet.
- [x] Mutex-Vergiftung wie in Phase 1: `map_err(|_| CommandError::Internal("voice lock".into()))`, kein `unwrap`.

### Commands

- [x] `voice_start(app, voice, registry, session_id: Option<String>)`: Repository-Namen über `registry.repositories_of(id)` holen — schlägt das fehl (Session unbekannt), mit leerer Liste weitermachen, das Diktat ist wichtiger als der Hinweis. Dann `voice.start(..)`.
- [x] `voice_stop(app)`: `tauri::async_runtime::spawn_blocking(move || app.state::<VoiceService>().stop())`, `JoinError` → `Internal`.
- [x] `voice_cancel(voice)`.
- [x] In `generate_handler!` eintragen; Wrapper `startDictation(sessionId: string | null)`, `stopDictation(): Promise<string>`, `cancelDictation()`, `onVoiceLevel(handler)`, `onVoicePartial(handler)` in `src/lib/voice.ts`.

### Prüfen vor dem Commit

- [x] Ein Probelauf mit echtem Mikrofon kommt erst mit der Oberfläche in Phase 3. Hier: `pnpm check` grün, und in einem Wegwerf-Programm außerhalb des Repos (Scratch-Ordner, Module per `#[path]` einbinden) gegen Hand-Werte prüfen:
  - `to_mono_16k`: 48-kHz-Stereo mit 4800 Frames → 1600 Samples.
  - `is_silent`: nur Nullen → `NoAudio`.
  - `Segmenter` (mono, 16 kHz, 800 Samples je Tick): 20 Sprach-Ticks, dann 12 stille Ticks → genau beim 12. stillen Tick ein Abschnitt; 2 Sprach-Ticks, dann 12 stille → kein Abschnitt; 40 stille Ticks vor der Sprache → der Abschnitt beginnt mit höchstens 4800 Samples Stille; 501 Sprach-Ticks am Stück → Abschnitt beim Erreichen von 400 000 Samples (25 s); `finish` nach 5 Sprach-Ticks → Abschnitt.
  - `prompt_tail` mit einem 300-Zeichen-Text voller Umlaute → beginnt mit einem ganzen Wort, kein Absturz.
  - Kein Test-Code ins Repo (Projekt ohne automatisierte Tests).

### Doku

- [x] `docs/code-map.md`: Zeile „Diktieren“ um `recorder.rs` (eigener Thread, Pegel), `segmenter.rs` (Schnitt an Sprechpausen), `silence.rs`, `resample.rs`, `transcribe.rs`, `dictation.rs` (Erkennungs-Thread, `voice://partial`) ergänzen.
- [x] `docs/glossary.md`: bei „Diktieren“ ergänzen: „Abschnitt — ein Stück der Aufnahme zwischen zwei Sprechpausen, das einzeln erkannt wird.“
- [x] Commit `feat(voice): Sprache aufnehmen und satzweise lokal erkennen`.

## Report-Back

Status: complete. `pnpm check` lokal grün; `pnpm bindings` ohne Änderung an `src/lib/bindings` (die Phase-1-Varianten standen schon in `CommandError.ts`). Die Hand-Werte aus „Prüfen vor dem Commit“ liefen in einem Wegwerf-Programm außerhalb des Repos und stimmen alle: 48 kHz Stereo mit 4800 Frames → 1600 Samples; nur Nullen → `NoAudio`; 20 Sprach- und 12 stille Ticks → Abschnitt genau beim 12. stillen Tick; 2 und 12 → keiner; 40 stille Ticks vorweg → 4800 Samples Stille vorne; 501 Sprach-Ticks → Schnitt bei 400 000; `finish` nach 5 → Abschnitt; `prompt_tail` mit 323 Umlaut-Zeichen → beginnt mit ganzem Wort. `prompt_tail` wurde dafür wortgleich kopiert, weil die Funktion in `dictation.rs` privat ist und an Tauri hängt.

- **Abweichung Abbruch-Callback:** In whisper-rs 0.16 ist `set_abort_callback_safe` für normale Closures fehlerhaft (`whisper_params.rs:639–646`): die Funktion speichert ein `Box<dyn FnMut>`, ruft es aber als Typ der Closure auf. Deshalb übergibt `transcribe.rs` selbst ein `Box<dyn FnMut() -> bool>`, dann passen beide Typen zusammen. Die Box wird nie freigegeben, das sind wenige Bytes je Durchlauf. Abgeleitet aus dem Quelltext, ein Absturz wurde nicht beobachtet.
- **Abweichung Stream-Fehler:** Der Fehler-Callback übergeht `Xrun`, `RealtimeDenied` und `DeviceChanged`. Die Aufnahme läuft dabei weiter, sonst würde ein einzelner Aussetzer das ganze Diktat als Mikrofonfehler beenden.
- **Abweichung Stopp-Reihenfolge:** Erst wird der Stream fallen gelassen, dann der letzte Tick geholt. So geht zwischen beiden Schritten kein Sample verloren.
- **Abweichung Sperre:** `lock` holt bei einem vergifteten Mutex den Inhalt zurück (`into_inner`), wie schon in Phase 1, statt `Internal` zu liefern.
- **Ergänzungen:** `Transcriber` hält `WhisperContext` ohne `Mutex`, weil der Typ `Send + Sync` ist (`whisper_ctx.rs:455–456`, darüber ein `Arc`). Nullbytes werden aus dem Prompt entfernt, sonst bricht `set_initial_prompt` mit einem Panic ab. `voice://partial` kommt nur bei nicht leerem Text, wie der Kontrakt verlangt. `prompt_tail` kürzt nicht, wenn der Ausschnitt schon an einer Wortgrenze beginnt.
- **Nicht umgesetzt:** `VoiceBusy` für „Download während einer laufenden Aufnahme“ (Kontrakt-Tabelle). Ein Diktat setzt ein fertiges Modell voraus, und dann tut der Download ohnehin nichts. Der Fall ist also nicht erreichbar.
- **Nicht ausgeführt:** Ein Lauf mit echtem Mikrofon und Modell fehlt, auf diesem Rechner liegt noch kein Sprachmodell. Die AK 1–10 sind nur übersetzt und durch Clippy geprüft. Gemessen werden sie im Smoke am Plan-Ende, ebenso der Arbeitsspeicher des geladenen Modells (FINDINGS).
