//! Aufnahme vom Standard-Mikrofon in einem eigenen Thread: Pegel senden, Abschnitte schneiden und an
//! den Erkennungs-Thread weiterreichen.
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, ErrorKind, SampleFormat, SizedSample, Stream, StreamConfig};
use tauri::{AppHandle, Emitter};

use super::VOICE_LEVEL_EVENT;
use super::model::VoiceLevelEvent;
use super::segmenter::Segmenter;
use super::silence::SPEECH_RMS;
use crate::error::CommandError;

const TICK: Duration = Duration::from_millis(50);
/// Schutz vor unbegrenztem Wachstum; die Oberfläche stoppt nach 120 s selbst.
const MAX_RECORDING_SECS: usize = 120;
/// Sprache liegt meist bei RMS 0,02–0,15; verstärkt füllt sie die Pegelbalken sichtbar.
const LEVEL_GAIN: f32 = 6.0;

/// Gemeinsam zwischen dem cpal-Callback und dem Aufnahme-Thread.
#[derive(Default)]
struct Shared {
    /// Seit dem letzten Tick eingegangen.
    samples: Vec<f32>,
    /// Seit Beginn angenommen, für die 120-s-Grenze.
    total: usize,
    sum_sq: f64,
    count: usize,
    peak: f32,
    stream_error: Option<String>,
}

pub struct Recorded {
    pub peak: f32,
}

enum RecorderCommand {
    Stop,
    Cancel,
}

/// `None` = abgebrochen.
type Finished = Option<Result<Recorded, CommandError>>;

pub struct Recorder {
    pub channels: u16,
    pub rate: u32,
    commands: mpsc::Sender<RecorderCommand>,
    finished: mpsc::Receiver<Finished>,
}

impl Recorder {
    /// Kehrt zurück, sobald das Gerät läuft oder sich nicht öffnen ließ.
    pub fn start(
        app: AppHandle,
        segments: mpsc::Sender<Vec<f32>>,
    ) -> Result<Recorder, CommandError> {
        let (command_sender, command_receiver) = mpsc::channel();
        let (finished_sender, finished_receiver) = mpsc::channel();
        let (opened_sender, opened_receiver) = mpsc::sync_channel(1);
        // Der `cpal::Stream` ist nicht `Send`: er wird im Aufnahme-Thread erzeugt und dort auch wieder
        // fallen gelassen, nie verschoben.
        thread::Builder::new()
            .name("voice-recorder".to_owned())
            .spawn(move || {
                let shared = Arc::new(Mutex::new(Shared::default()));
                let (stream, channels, rate) = match open_stream(&shared) {
                    Ok(opened) => opened,
                    Err(error) => {
                        let _ = opened_sender.send(Err(error));
                        return;
                    }
                };
                let _ = opened_sender.send(Ok((channels, rate)));
                let recording = Recording {
                    app: &app,
                    shared: &shared,
                    segmenter: Segmenter::new(channels, rate),
                    segments,
                };
                let finished = recording.run(stream, &command_receiver);
                let _ = finished_sender.send(finished);
            })
            .map_err(|error: std::io::Error| {
                CommandError::Internal(format!("Aufnahme-Thread startet nicht: {error}"))
            })?;
        let (channels, rate) = opened_receiver
            .recv()
            .map_err(|_| CommandError::Internal("Aufnahme-Thread beendet".to_owned()))??;
        Ok(Recorder {
            channels,
            rate,
            commands: command_sender,
            finished: finished_receiver,
        })
    }

    /// Beendet die Aufnahme, schickt den Rest als letzten Abschnitt und schließt den Kanal zum
    /// Erkennungs-Thread.
    pub fn stop(self) -> Result<Recorded, CommandError> {
        let thread_gone = || CommandError::Internal("Aufnahme-Thread beendet".to_owned());
        self.commands
            .send(RecorderCommand::Stop)
            .map_err(|_| thread_gone())?;
        match self.finished.recv() {
            Ok(Some(result)) => result,
            Ok(None) => Err(CommandError::VoiceCancelled),
            Err(_) => Err(thread_gone()),
        }
    }

    /// Wartet nicht: der Thread lässt den Stream fallen und sendet nichts mehr.
    pub fn cancel(self) {
        let _ = self.commands.send(RecorderCommand::Cancel);
    }
}

fn open_stream(shared: &Arc<Mutex<Shared>>) -> Result<(Stream, u16, u32), CommandError> {
    let device = cpal::default_host()
        .default_input_device()
        .ok_or_else(|| CommandError::Microphone("kein Eingabegerät gefunden".to_owned()))?;
    let supported = device.default_input_config().map_err(microphone_error)?;
    let channels = supported.channels();
    let rate = supported.sample_rate();
    let config = supported.config();
    let limit = MAX_RECORDING_SECS * rate as usize * usize::from(channels);
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build_stream(&device, config, shared, limit, |sample: f32| sample),
        SampleFormat::I16 => build_stream(&device, config, shared, limit, |sample: i16| {
            f32::from(sample) / 32768.0
        }),
        SampleFormat::U16 => build_stream(&device, config, shared, limit, |sample: u16| {
            (f32::from(sample) - 32768.0) / 32768.0
        }),
        other => {
            return Err(CommandError::Microphone(format!(
                "Format {other} nicht unterstützt"
            )));
        }
    }?;
    stream.play().map_err(microphone_error)?;
    Ok((stream, channels, rate))
}

fn build_stream<T: SizedSample + 'static>(
    device: &Device,
    config: StreamConfig,
    shared: &Arc<Mutex<Shared>>,
    limit: usize,
    convert: fn(T) -> f32,
) -> Result<Stream, CommandError> {
    let data_shared = Arc::clone(shared);
    let error_shared = Arc::clone(shared);
    device
        .build_input_stream(
            config,
            move |data: &[T], _info: &cpal::InputCallbackInfo| {
                append_samples(&data_shared, data, limit, convert);
            },
            move |error: cpal::Error| record_stream_error(&error_shared, &error),
            None,
        )
        .map_err(microphone_error)
}

/// Läuft im Audio-Thread des Systems: nur anhängen und zählen, keine Ereignisse, nichts Blockierendes
/// außer der kurzen Sperre.
fn append_samples<T: Copy>(
    shared: &Mutex<Shared>,
    data: &[T],
    limit: usize,
    convert: fn(T) -> f32,
) {
    let mut shared = lock(shared);
    let room = limit.saturating_sub(shared.total);
    let accepted = &data[..data.len().min(room)];
    for &sample in accepted {
        let value = convert(sample);
        shared.samples.push(value);
        shared.sum_sq += f64::from(value * value);
        shared.peak = shared.peak.max(value.abs());
    }
    shared.total += accepted.len();
    shared.count += accepted.len();
}

fn record_stream_error(shared: &Mutex<Shared>, error: &cpal::Error) {
    // Aussetzer, verweigerte Echtzeit-Priorität und ein umgeleitetes Gerät lassen die Aufnahme
    // weiterlaufen; nur was den Stream beendet, macht das Diktat zum Fehler.
    if matches!(
        error.kind(),
        ErrorKind::Xrun | ErrorKind::RealtimeDenied | ErrorKind::DeviceChanged
    ) {
        return;
    }
    let mut shared = lock(shared);
    if shared.stream_error.is_none() {
        shared.stream_error = Some(error.to_string());
    }
}

struct Recording<'a> {
    app: &'a AppHandle,
    shared: &'a Mutex<Shared>,
    segmenter: Segmenter,
    segments: mpsc::Sender<Vec<f32>>,
}

struct Tick {
    samples: Vec<f32>,
    rms: f32,
    is_speech: bool,
}

impl Recording<'_> {
    fn run(mut self, stream: Stream, commands: &mpsc::Receiver<RecorderCommand>) -> Finished {
        loop {
            match commands.recv_timeout(TICK) {
                Err(RecvTimeoutError::Timeout) => {
                    let tick = self.take_tick();
                    self.emit_level(tick.rms);
                    self.push(tick);
                }
                Ok(RecorderCommand::Stop) => {
                    // Erst den Stream beenden, dann den Rest holen: danach kommt kein Sample mehr nach.
                    drop(stream);
                    return Some(self.finish());
                }
                Ok(RecorderCommand::Cancel) | Err(RecvTimeoutError::Disconnected) => {
                    // `self` mit dem Sender geht hier unter und schließt den Kanal, ohne noch etwas zu
                    // schicken.
                    return None;
                }
            }
        }
    }

    fn finish(mut self) -> Result<Recorded, CommandError> {
        let tick = self.take_tick();
        self.push(tick);
        if let Some(segment) = self.segmenter.finish() {
            let _ = self.segments.send(segment);
        }
        let mut shared = lock(self.shared);
        match shared.stream_error.take() {
            Some(text) => Err(CommandError::Microphone(text)),
            None => Ok(Recorded { peak: shared.peak }),
        }
    }

    fn take_tick(&self) -> Tick {
        let mut shared = lock(self.shared);
        let samples = std::mem::take(&mut shared.samples);
        let count = shared.count;
        let rms = if count == 0 {
            0.0
        } else {
            (shared.sum_sq / count as f64).sqrt() as f32
        };
        shared.sum_sq = 0.0;
        shared.count = 0;
        Tick {
            samples,
            rms,
            is_speech: count > 0 && rms >= SPEECH_RMS,
        }
    }

    fn push(&mut self, tick: Tick) {
        if let Some(segment) = self.segmenter.push_tick(tick.samples, tick.is_speech) {
            // Schlägt nur fehl, wenn der Erkennungs-Thread schon mit einem Fehler beendet ist; den
            // meldet `voice_stop`.
            let _ = self.segments.send(segment);
        }
    }

    fn emit_level(&self, rms: f32) {
        let level = (rms * LEVEL_GAIN).min(1.0);
        if let Err(error) = self.app.emit(VOICE_LEVEL_EVENT, VoiceLevelEvent { level }) {
            eprintln!("Pegel-Ereignis nicht gesendet: {error}");
        }
    }
}

fn microphone_error(error: cpal::Error) -> CommandError {
    CommandError::Microphone(error.to_string())
}

fn lock(shared: &Mutex<Shared>) -> MutexGuard<'_, Shared> {
    shared.lock().unwrap_or_else(PoisonError::into_inner)
}
