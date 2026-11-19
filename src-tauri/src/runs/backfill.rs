//! Füllt das Laufzeit-Gedächtnis einmalig aus den Hintergrund-Einträgen, die es vor Migration 21 gab.
use std::collections::HashMap;

use rusqlite::Connection;

use crate::background::model::{BackgroundItem, BackgroundKind};
use crate::db::runs as run_rows;
use crate::db::settings as setting_rows;
use crate::error::CommandError;
use crate::runs::normalize::command_key;
use crate::runs::{KEPT_RUNS, MIN_RECORDED_MS};

/// Einstellung, die merkt, dass das Übernehmen gelaufen ist.
const DONE_KEY: &str = "runs_backfilled";

/// Eine erfolgreiche Dauer eines Befehls im Vorhaben.
struct PastRun {
    duration_ms: i64,
    finished_at: f64,
}

/// Gibt die Zahl der übernommenen Läufe zurück; 0, wenn es schon gelaufen ist.
pub fn run(connection: &mut Connection) -> Result<usize, CommandError> {
    if setting_rows::read_all(connection)?.contains_key(DONE_KEY) {
        return Ok(0);
    }
    let payloads = load_payloads(connection)?;
    let grouped = group_runs(&payloads);
    let transaction = connection.transaction()?;
    let mut taken = 0_usize;
    for ((project_id, key), mut runs) in grouped {
        runs.sort_by(|left: &PastRun, right: &PastRun| {
            left.finished_at.total_cmp(&right.finished_at)
        });
        let skip = runs.len().saturating_sub(KEPT_RUNS);
        for past in runs.iter().skip(skip) {
            run_rows::insert(
                &transaction,
                &project_id,
                &key,
                past.duration_ms,
                past.finished_at,
                KEPT_RUNS,
            )?;
            taken += 1;
        }
    }
    setting_rows::write(&transaction, DONE_KEY, "1")?;
    transaction.commit()?;
    Ok(taken)
}

/// Eine Abfrage, ganz im Speicher: keine Leseabfrage bleibt über die Schreibphase offen.
fn load_payloads(connection: &Connection) -> Result<Vec<(String, String)>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT s.project_id, b.payload FROM background_items b \
         JOIN sessions s ON s.id = b.session_id WHERE s.project_id IS NOT NULL",
    )?;
    let rows: Vec<(String, String)> = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn group_runs(payloads: &[(String, String)]) -> HashMap<(String, String), Vec<PastRun>> {
    let mut grouped: HashMap<(String, String), Vec<PastRun>> = HashMap::new();
    for (project_id, payload) in payloads {
        let Ok(item) = serde_json::from_str::<BackgroundItem>(payload) else {
            continue;
        };
        let Some(past) = successful_run(&item) else {
            continue;
        };
        grouped
            .entry((project_id.clone(), command_key(&item.title)))
            .or_default()
            .push(past);
    }
    grouped
}

fn successful_run(item: &BackgroundItem) -> Option<PastRun> {
    if !matches!(item.kind, BackgroundKind::Command | BackgroundKind::Process)
        || item.exit_code != Some(0)
    {
        return None;
    }
    let ended_at = item.ended_at?;
    let duration = ended_at - item.started_at;
    if duration < MIN_RECORDED_MS {
        return None;
    }
    Some(PastRun {
        duration_ms: duration.round() as i64,
        finished_at: ended_at,
    })
}
