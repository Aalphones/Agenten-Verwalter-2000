//! Kontingent des Claude-Abos: Zwischenspeicher und Abruf über einen Hilfsprozess.
pub mod model;

use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager};

use crate::agents::claude::helper;
use crate::agents::claude::locate::find_claude;
use crate::agents::claude::protocol::get_usage;
use crate::agents::claude::stats;
use crate::filesystem::workspace::data_dir;
use model::{UsageSnapshot, UsageStatus};

const MIN_REFRESH_INTERVAL: Duration = Duration::from_secs(30);
const HELPER_TIMEOUT: Duration = Duration::from_secs(20);
pub const USAGE_CHANGED_EVENT: &str = "usage://changed";

/// Das Kontingent kommt von einem eigenen kurzlebigen `claude.exe`, nicht vom Agenten einer
/// Session: ohne laufenden Agenten gäbe es sonst gar keine Zahl, und dieselbe Zahl bräuchte zwei
/// Wege (ADR 008).
pub struct UsageService {
    cache: Mutex<UsageCache>,
}

struct UsageCache {
    snapshot: Option<UsageSnapshot>,
    error: Option<String>,
    is_loading: bool,
    last_started: Option<Instant>,
}

impl Default for UsageService {
    fn default() -> Self {
        UsageService::new()
    }
}

impl UsageService {
    pub fn new() -> UsageService {
        UsageService {
            cache: Mutex::new(UsageCache {
                snapshot: None,
                error: None,
                is_loading: false,
                last_started: None,
            }),
        }
    }

    pub fn status(&self) -> UsageStatus {
        let cache = self.lock();
        UsageStatus {
            snapshot: cache.snapshot.clone(),
            error: cache.error.clone(),
            is_loading: cache.is_loading,
        }
    }

    /// Startet einen Abruf im Hintergrund und kehrt sofort zurück. Nie zwei Abrufe gleichzeitig;
    /// ohne `force` höchstens einer je `MIN_REFRESH_INTERVAL`.
    pub fn refresh(&self, app: &AppHandle, force: bool) {
        {
            let mut cache = self.lock();
            if cache.is_loading {
                return;
            }
            let is_recent = cache
                .last_started
                .is_some_and(|started: Instant| started.elapsed() < MIN_REFRESH_INTERVAL);
            if is_recent && !force {
                return;
            }
            cache.is_loading = true;
            cache.last_started = Some(Instant::now());
        }
        emit_changed(app);
        let worker_app = app.clone();
        let spawned = thread::Builder::new()
            .name("usage-refresh".to_owned())
            .spawn(move || {
                let result = fetch(&worker_app);
                worker_app
                    .state::<UsageService>()
                    .finish(&worker_app, result);
            });
        if let Err(error) = spawned {
            self.finish(app, Err(format!("Abruf startet nicht: {error}")));
        }
    }

    fn finish(&self, app: &AppHandle, result: Result<UsageSnapshot, String>) {
        {
            let mut cache = self.lock();
            match result {
                Ok(snapshot) => {
                    cache.snapshot = Some(snapshot);
                    cache.error = None;
                }
                Err(error) => cache.error = Some(error),
            }
            cache.is_loading = false;
        }
        emit_changed(app);
    }

    fn lock(&self) -> MutexGuard<'_, UsageCache> {
        self.cache.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

fn fetch(app: &AppHandle) -> Result<UsageSnapshot, String> {
    let exe = find_claude().ok_or_else(|| "Claude-Kommandozeile nicht gefunden".to_owned())?;
    let dir = data_dir(app).map_err(|error| error.to_string())?;
    let body = helper::ask_once(&exe, &dir, get_usage(), HELPER_TIMEOUT)?;
    let mut snapshot =
        stats::usage_snapshot(&body).ok_or_else(|| "Antwort von Claude unlesbar".to_owned())?;
    snapshot.fetched_at = now_ms();
    Ok(snapshot)
}

fn emit_changed(app: &AppHandle) {
    if let Err(error) = app.emit(USAGE_CHANGED_EVENT, ()) {
        eprintln!("Kontingent-Ereignis nicht gesendet: {error}");
    }
}

fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed: Duration| elapsed.as_secs_f64() * 1000.0)
}
