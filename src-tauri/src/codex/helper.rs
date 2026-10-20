//! Ein kurzlebiger `codex app-server` für einzelne Fragen außerhalb einer Session: Modelle, Konto,
//! Kontingent, Anmeldung.
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread;
use std::time::Duration;

use super::rpc::{Incoming, RpcClient};
use crate::agents::codex::find_codex;
use crate::error::CommandError;
use crate::standalone::home_dir;

/// Gesamtzeit für Start und Frage; danach wird `codex app-server` beendet.
pub const QUICK_TIME_LIMIT: Duration = Duration::from_secs(20);

const DATA_DIR: &str = ".verwalter";

/// Startet `codex app-server`, begrüßt ihn, ruft `ask` und beendet ihn wieder — höchstens
/// `QUICK_TIME_LIMIT` lang.
pub fn with_server<T>(ask: impl FnOnce(&RpcClient) -> Result<T, String>) -> Result<T, String> {
    with_listening_server(QUICK_TIME_LIMIT, |_: Incoming| {}, ask)
}

/// Wie `with_server`, mit eigenem Zeitlimit und einem Zuhörer für Benachrichtigungen von Codex
/// (`on_message` läuft auf dem Lese-Thread).
pub fn with_listening_server<T>(
    time_limit: Duration,
    on_message: impl Fn(Incoming) + Send + 'static,
    ask: impl FnOnce(&RpcClient) -> Result<T, String>,
) -> Result<T, String> {
    let exe = find_codex().ok_or_else(|| CommandError::CodexNotFound.to_string())?;
    let rpc = Arc::new(
        RpcClient::start(&exe, &working_dir(), on_message)
            .map_err(|error: std::io::Error| format!("Codex startet nicht: {error}"))?,
    );
    let is_timed_out = Arc::new(AtomicBool::new(false));
    let (done_sender, done_receiver) = mpsc::channel::<()>();
    let watchdog_rpc = Arc::clone(&rpc);
    let watchdog_flag = Arc::clone(&is_timed_out);
    // Ohne Wachhund gälten nur die Zeitlimits der einzelnen Anfragen.
    let _ = thread::Builder::new()
        .name("codex-helper-watchdog".to_owned())
        .spawn(move || {
            if matches!(
                done_receiver.recv_timeout(time_limit),
                Err(RecvTimeoutError::Timeout)
            ) {
                watchdog_flag.store(true, Ordering::SeqCst);
                watchdog_rpc.shutdown();
            }
        });
    let outcome = rpc.initialize().and_then(|()| ask(&rpc));
    drop(done_sender);
    rpc.shutdown();
    if is_timed_out.load(Ordering::SeqCst) {
        return Err(format!(
            "Codex antwortete nicht innerhalb von {} s",
            time_limit.as_secs()
        ));
    }
    outcome
}

/// `%USERPROFILE%\.verwalter`, sonst der Temp-Ordner: Codex liest Projekt-Dateien aus dem
/// Arbeitsordner, und der Verwalter-Ordner enthält keine.
fn working_dir() -> PathBuf {
    home_dir()
        .map(|home: PathBuf| home.join(DATA_DIR))
        .filter(|dir: &PathBuf| dir.is_dir())
        .unwrap_or_else(std::env::temp_dir)
}
