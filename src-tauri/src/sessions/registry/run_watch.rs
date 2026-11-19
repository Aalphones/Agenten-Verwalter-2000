//! Live-Fortschritt: liest einmal je Sekunde das Ende der Ausgabedatei eines laufenden Befehls oder
//! Prozesses und meldet geänderten Fortschritt und letzte Zeile an die Oberfläche (ADR 066).
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::thread;
use std::time::Duration;

use tauri::AppHandle;

use super::{Session, update};
use crate::background::output::read_tail;
use crate::runs::model::RunProgress;
use crate::runs::progress::{self, TAIL_BYTES};

const WATCH_INTERVAL: Duration = Duration::from_secs(1);

/// Stand aus der Ausgabedatei; `None` heißt: Datei fehlt, der bisherige Stand bleibt.
pub(super) type LiveReading = Option<(Option<RunProgress>, Option<String>)>;

/// Beobachtet den Eintrag `item_id`, bis er nicht mehr läuft oder die Session gelöscht ist. Der
/// Aufrufer hat die ID in `watched_runs` eingetragen; der Wächter nimmt sie beim Ende wieder heraus.
pub(super) fn schedule(app: AppHandle, session: Arc<Session>, item_id: String, file: String) {
    // Startet der Thread nicht, fehlt nur der Live-Fortschritt — kein Fehler für den Nutzer.
    let _ = thread::Builder::new()
        .name("run-watch".to_owned())
        .spawn(move || {
            loop {
                thread::sleep(WATCH_INTERVAL);
                if session.deleted.load(Ordering::SeqCst) {
                    return;
                }
                let reading = read_file(&file);
                let keeps_running = update(&app, &session, |state, outbox| {
                    Ok(state.apply_live_run(outbox, &item_id, reading))
                });
                if !matches!(keeps_running, Ok(true)) {
                    return;
                }
            }
        });
}

/// Die Kommandozeile löscht die Datei eines Vordergrund-Befehls an seinem Ende, noch bevor sein
/// Ergebnis ankommt: eine fehlende Datei lässt deshalb den letzten Stand stehen. Leer oder binär
/// ist ein gültiger Stand ohne Fortschritt und ohne Zeile.
fn read_file(file: &str) -> LiveReading {
    let tail = read_tail(Path::new(file), TAIL_BYTES);
    if tail.missing {
        return None;
    }
    if tail.binary {
        return Some((None, None));
    }
    Some(progress::read(&tail.text))
}
