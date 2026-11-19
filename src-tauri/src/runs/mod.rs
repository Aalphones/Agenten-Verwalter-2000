//! Laufzeit-Gedächtnis: merkt sich, wie lange ein Befehl in einem Vorhaben dauert, und schätzt
//! daraus die Dauer beim nächsten Start.
pub mod backfill;
pub mod model;
pub mod normalize;
pub mod progress;

use rusqlite::Connection;

use crate::db::runs as run_rows;
use crate::error::CommandError;

/// Kürzere Läufe sagen nichts über die Dauer und werden nicht gemerkt.
pub const MIN_RECORDED_MS: f64 = 3000.0;
/// So viele der jüngsten Läufe gehen in die Schätzung ein.
pub const ESTIMATE_RUNS: usize = 5;
/// So viele Läufe bleiben je Vorhaben und Befehl gespeichert.
pub const KEPT_RUNS: usize = 10;

/// Median der jüngsten Läufe im Vorhaben; ohne eigene Läufe der über alle Vorhaben.
pub fn estimate(
    connection: &Connection,
    project_id: &str,
    command: &str,
) -> Result<Option<f64>, CommandError> {
    let key = normalize::command_key(command);
    let own = run_rows::recent_durations(connection, &key, Some(project_id), ESTIMATE_RUNS)?;
    if !own.is_empty() {
        return Ok(Some(median(own)));
    }
    let all = run_rows::recent_durations(connection, &key, None, ESTIMATE_RUNS)?;
    if all.is_empty() {
        return Ok(None);
    }
    Ok(Some(median(all)))
}

/// Die Läufe, die in die Schätzung eingingen — für das Prüfprogramm.
pub fn sample_size(
    connection: &Connection,
    project_id: &str,
    command: &str,
) -> Result<usize, CommandError> {
    let key = normalize::command_key(command);
    let own = run_rows::recent_durations(connection, &key, Some(project_id), ESTIMATE_RUNS)?;
    if !own.is_empty() {
        return Ok(own.len());
    }
    Ok(run_rows::recent_durations(connection, &key, None, ESTIMATE_RUNS)?.len())
}

/// Merkt einen erfolgreichen Lauf; zu kurze ignoriert sie.
pub fn record(
    connection: &Connection,
    project_id: &str,
    command: &str,
    duration_ms: f64,
    finished_at: f64,
) -> Result<(), CommandError> {
    if duration_ms < MIN_RECORDED_MS {
        return Ok(());
    }
    run_rows::insert(
        connection,
        project_id,
        &normalize::command_key(command),
        duration_ms.round() as i64,
        finished_at,
        KEPT_RUNS,
    )
}

fn median(mut durations: Vec<i64>) -> f64 {
    durations.sort_unstable();
    let middle = durations.len() / 2;
    if durations.len() % 2 == 1 {
        return durations[middle] as f64;
    }
    (durations[middle - 1] as f64 + durations[middle] as f64) / 2.0
}
