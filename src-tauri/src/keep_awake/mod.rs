//! Hält Windows wach, solange eine Station läuft oder aufs Kontingent wartet und die Einstellung
//! „Nach Kontingent-Limit automatisch weiter“ an ist (ADR 063).
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::db::Database;
use crate::sessions::registry::SessionRegistry;
use crate::settings;

const CHECK_INTERVAL: Duration = Duration::from_secs(30);

enum Signal {
    Release,
}

pub struct KeepAwake {
    sender: Sender<Signal>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl KeepAwake {
    /// Startet den Thread `keep-awake`. Der Wach-Zustand von Windows gehört dem Thread, der ihn
    /// setzt — deshalb setzt und löst ihn immer derselbe, langlebige Thread.
    pub fn start(app: &AppHandle) -> KeepAwake {
        let (sender, receiver) = mpsc::channel::<Signal>();
        let app: AppHandle = app.clone();
        let spawned = thread::Builder::new()
            .name("keep-awake".to_owned())
            .spawn(move || {
                let mut is_awake: bool = false;
                loop {
                    match receiver.recv_timeout(CHECK_INTERVAL) {
                        Ok(Signal::Release) | Err(RecvTimeoutError::Disconnected) => break,
                        Err(RecvTimeoutError::Timeout) => {}
                    }
                    let is_wanted: bool = is_keep_awake_wanted(&app);
                    if is_wanted == is_awake {
                        continue;
                    }
                    set_awake(is_wanted);
                    is_awake = is_wanted;
                    if is_awake {
                        eprintln!("Wachhalten an");
                    } else {
                        eprintln!("Wachhalten aus");
                    }
                }
                if is_awake {
                    set_awake(false);
                    eprintln!("Wachhalten aus");
                }
            });
        // Ohne den Thread schläft der Rechner nur wieder nach Windows-Einstellung — kein Grund, die App zu beenden.
        let worker: Option<JoinHandle<()>> = match spawned {
            Ok(handle) => Some(handle),
            Err(error) => {
                eprintln!("Wachhalten nicht gestartet: {error}");
                None
            }
        };
        KeepAwake {
            sender,
            worker: Mutex::new(worker),
        }
    }

    /// Gibt den Wach-Zustand frei und wartet, bis der Thread geendet hat.
    pub fn release(&self) {
        let _ = self.sender.send(Signal::Release);
        let worker: Option<JoinHandle<()>> = self
            .worker
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take();
        if let Some(handle) = worker {
            let _ = handle.join();
        }
    }
}

fn is_keep_awake_wanted(app: &AppHandle) -> bool {
    let database = app.state::<Arc<Database>>();
    // Ein Lesefehler heißt: nicht wachhalten — der Zustand ist beim nächsten Takt wieder richtig.
    let is_enabled: bool = settings::load(&database)
        .map(|loaded: crate::settings::model::Settings| loaded.auto_continue_at_limit)
        .unwrap_or(false);
    is_enabled && app.state::<SessionRegistry>().stations_busy()
}

#[cfg(windows)]
fn set_awake(is_awake: bool) {
    const ES_CONTINUOUS: u32 = 0x8000_0000;
    const ES_SYSTEM_REQUIRED: u32 = 0x0000_0001;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn SetThreadExecutionState(flags: u32) -> u32;
    }
    let flags: u32 = if is_awake {
        ES_CONTINUOUS | ES_SYSTEM_REQUIRED
    } else {
        ES_CONTINUOUS
    };
    // SAFETY: reiner Aufruf der Windows-API ohne Zeiger; er betrifft nur den aufrufenden Thread.
    unsafe {
        SetThreadExecutionState(flags);
    }
}

#[cfg(not(windows))]
fn set_awake(is_awake: bool) {
    let _ = is_awake;
}
