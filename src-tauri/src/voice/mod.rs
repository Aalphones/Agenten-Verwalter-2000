//! Diktieren: Sprachmodell laden und prüfen (Aufnahme und Erkennung folgen in Phase 2).
pub mod model;
pub mod model_file;

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};

use crate::error::CommandError;
use model::{VoiceModelEvent, VoiceModelState};
use model_file::{MODEL_BYTES, download, is_model_ready, model_path};

pub const VOICE_MODEL_EVENT: &str = "voice://model";
pub const VOICE_LEVEL_EVENT: &str = "voice://level";
pub const VOICE_PARTIAL_EVENT: &str = "voice://partial";

const PROGRESS_EVENT_INTERVAL: Duration = Duration::from_millis(250);

/// Zustand des Diktierens im Core: heute der laufende Modell-Download, ab Phase 2 auch die Aufnahme.
pub struct VoiceService {
    inner: Mutex<VoiceInner>,
}

struct VoiceInner {
    download: Option<DownloadHandle>,
}

struct DownloadHandle {
    cancel: Arc<AtomicBool>,
    received_bytes: u64,
    total_bytes: u64,
}

impl Default for VoiceService {
    fn default() -> Self {
        VoiceService::new()
    }
}

impl VoiceService {
    pub fn new() -> VoiceService {
        VoiceService {
            inner: Mutex::new(VoiceInner { download: None }),
        }
    }

    pub fn model_state(&self, app: &AppHandle) -> Result<VoiceModelState, CommandError> {
        if let Some(download) = &self.lock().download {
            return Ok(downloading_state(
                download.received_bytes,
                download.total_bytes,
            ));
        }
        if is_model_ready(&model_path(app)?) {
            Ok(VoiceModelState::Ready)
        } else {
            Ok(VoiceModelState::Missing)
        }
    }

    /// Startet den Download im Hintergrund und kehrt sofort zurück. Läuft schon einer oder liegt das
    /// Modell fertig da, passiert nichts.
    pub fn start_download(&self, app: &AppHandle) -> Result<(), CommandError> {
        let path = model_path(app)?;
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut inner = self.lock();
            if inner.download.is_some() || is_model_ready(&path) {
                return Ok(());
            }
            inner.download = Some(DownloadHandle {
                cancel: Arc::clone(&cancel),
                received_bytes: 0,
                total_bytes: MODEL_BYTES,
            });
        }
        let worker_app = app.clone();
        let spawned = thread::Builder::new()
            .name("voice-download".to_owned())
            .spawn(move || run_download(&worker_app, &path, &cancel));
        if let Err(error) = spawned {
            self.lock().download = None;
            return Err(CommandError::VoiceDownload(format!(
                "Download startet nicht: {error}"
            )));
        }
        Ok(())
    }

    /// Setzt nur das Abbruch-Zeichen; der Download-Thread räumt auf und meldet `missing`.
    pub fn cancel_download(&self) {
        if let Some(download) = &self.lock().download {
            download.cancel.store(true, Ordering::Relaxed);
        }
    }

    fn set_progress(&self, received_bytes: u64, total_bytes: u64) {
        if let Some(download) = &mut self.lock().download {
            download.received_bytes = received_bytes;
            download.total_bytes = total_bytes;
        }
    }

    fn lock(&self) -> MutexGuard<'_, VoiceInner> {
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

fn run_download(app: &AppHandle, path: &Path, cancel: &AtomicBool) {
    let service = app.state::<VoiceService>();
    emit_model(app, downloading_state(0, MODEL_BYTES), None);
    let mut last_event = Instant::now();
    let result = download(path, cancel, |received_bytes: u64, total_bytes: u64| {
        service.set_progress(received_bytes, total_bytes);
        if last_event.elapsed() >= PROGRESS_EVENT_INTERVAL {
            last_event = Instant::now();
            emit_model(app, downloading_state(received_bytes, total_bytes), None);
        }
    });
    // Erst das Handle weg, dann melden: ein `voice_model_status` nach dem Ereignis darf nicht mehr
    // „Downloading“ sehen.
    service.lock().download = None;
    match result {
        Ok(()) => emit_model(app, VoiceModelState::Ready, None),
        // Ein Abbruch durch den Nutzer ist kein Fehler, den die Oberfläche anzeigen soll.
        Err(_) if cancel.load(Ordering::Relaxed) => {
            emit_model(app, VoiceModelState::Missing, None);
        }
        Err(error) => emit_model(app, VoiceModelState::Missing, Some(error.to_string())),
    }
}

fn downloading_state(received_bytes: u64, total_bytes: u64) -> VoiceModelState {
    VoiceModelState::Downloading {
        received_bytes: received_bytes as f64,
        total_bytes: total_bytes as f64,
    }
}

fn emit_model(app: &AppHandle, state: VoiceModelState, error: Option<String>) {
    if let Err(send_error) = app.emit(VOICE_MODEL_EVENT, VoiceModelEvent { state, error }) {
        eprintln!("Sprachmodell-Ereignis nicht gesendet: {send_error}");
    }
}
