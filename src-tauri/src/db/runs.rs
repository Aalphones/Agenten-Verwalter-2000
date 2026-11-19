//! Tabelle `command_runs`: die Dauer erfolgreicher Läufe je Vorhaben und vereinheitlichtem Befehl.
use rusqlite::{Connection, params};

use crate::error::CommandError;

/// Fügt einen Lauf ein und lässt je (`project_id`, `command_key`) nur die jüngsten `kept` stehen.
pub fn insert(
    connection: &Connection,
    project_id: &str,
    command_key: &str,
    duration_ms: i64,
    finished_at: f64,
    kept: usize,
) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO command_runs (project_id, command_key, duration_ms, finished_at) \
         VALUES (?1, ?2, ?3, ?4)",
        params![project_id, command_key, duration_ms, finished_at],
    )?;
    connection.execute(
        "DELETE FROM command_runs WHERE project_id = ?1 AND command_key = ?2 AND id NOT IN ( \
             SELECT id FROM command_runs WHERE project_id = ?1 AND command_key = ?2 \
             ORDER BY finished_at DESC, id DESC LIMIT ?3)",
        params![
            project_id,
            command_key,
            i64::try_from(kept).unwrap_or(i64::MAX)
        ],
    )?;
    Ok(())
}

/// Dauern nach `finished_at` absteigend; mit `project_id` nur dieses Vorhaben, sonst alle.
pub fn recent_durations(
    connection: &Connection,
    command_key: &str,
    project_id: Option<&str>,
    limit: usize,
) -> Result<Vec<i64>, CommandError> {
    let limit = i64::try_from(limit).unwrap_or(i64::MAX);
    let durations: Vec<i64> = match project_id {
        Some(project_id) => {
            let mut statement = connection.prepare(
                "SELECT duration_ms FROM command_runs WHERE command_key = ?1 AND project_id = ?2 \
                 ORDER BY finished_at DESC, id DESC LIMIT ?3",
            )?;
            statement
                .query_map(params![command_key, project_id, limit], |row| row.get(0))?
                .collect::<rusqlite::Result<_>>()?
        }
        None => {
            let mut statement = connection.prepare(
                "SELECT duration_ms FROM command_runs WHERE command_key = ?1 \
                 ORDER BY finished_at DESC, id DESC LIMIT ?2",
            )?;
            statement
                .query_map(params![command_key, limit], |row| row.get(0))?
                .collect::<rusqlite::Result<_>>()?
        }
    };
    Ok(durations)
}
