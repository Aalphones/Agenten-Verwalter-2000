//! TL;DR-Spalten von `sessions` und `projects`; die übrigen Schreibwege lassen sie unberührt.
use rusqlite::{Connection, params};

use crate::error::CommandError;

/// `seq`: Anzahl Chat-Einträge, die das TL;DR kannte.
pub fn save_session(
    connection: &Connection,
    session_id: &str,
    tldr_json: &str,
    at: f64,
    seq: u32,
) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE sessions SET tldr = ?2, tldr_at = ?3, tldr_seq = ?4 WHERE id = ?1",
        params![session_id, tldr_json, at, seq],
    )?;
    Ok(())
}

/// `sources`: aus wie vielen Session-TL;DRs das TL;DR des Vorhabens entstand.
pub fn save_project(
    connection: &Connection,
    project_id: &str,
    tldr_json: &str,
    at: f64,
    sources: u32,
) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE projects SET tldr = ?2, tldr_at = ?3, tldr_sources = ?4 WHERE id = ?1",
        params![project_id, tldr_json, at, sources],
    )?;
    Ok(())
}
