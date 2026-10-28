//! Tabelle `tool_details`: Eingabe und Ausgabe je Werkzeug-Aufruf des Hauptagenten (ADR 042).
//! Getrennt von `chat_entries`, damit das Laden des Verlaufs die Texte nie mitlädt.
use rusqlite::{Connection, OptionalExtension, params};

use crate::agents::event::ToolDetail;
use crate::error::CommandError;

/// Deckel je Aufruf; ein längerer Text wird gekürzt und als gekürzt gemeldet.
pub const MAX_TOOL_INPUT_BYTES: usize = 32_768;
pub const MAX_TOOL_OUTPUT_BYTES: usize = 131_072;

/// Legt die Zeile an oder ersetzt nur die Eingabe; Eingabe und Ausgabe dürfen in beliebiger
/// Reihenfolge ankommen.
pub fn set_input(
    connection: &Connection,
    session_id: &str,
    tool_use_id: &str,
    input: &str,
    truncated: bool,
) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO tool_details (session_id, tool_use_id, input, input_truncated) \
         VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(session_id, tool_use_id) DO UPDATE SET \
             input = excluded.input, input_truncated = excluded.input_truncated",
        params![session_id, tool_use_id, input, truncated],
    )?;
    Ok(())
}

/// Legt die Zeile an oder ersetzt nur die Ausgabe.
pub fn set_output(
    connection: &Connection,
    session_id: &str,
    tool_use_id: &str,
    output: &str,
    truncated: bool,
) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO tool_details (session_id, tool_use_id, output, output_truncated) \
         VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(session_id, tool_use_id) DO UPDATE SET \
             output = excluded.output, output_truncated = excluded.output_truncated",
        params![session_id, tool_use_id, output, truncated],
    )?;
    Ok(())
}

/// `None`, wenn es zu dem Aufruf keine Zeile gibt.
pub fn load(
    connection: &Connection,
    session_id: &str,
    tool_use_id: &str,
) -> Result<Option<ToolDetail>, CommandError> {
    let detail = connection
        .query_row(
            "SELECT input, input_truncated, output, output_truncated FROM tool_details \
             WHERE session_id = ?1 AND tool_use_id = ?2",
            params![session_id, tool_use_id],
            |row| {
                Ok(ToolDetail {
                    input: row.get(0)?,
                    input_truncated: row.get(1)?,
                    output: row.get(2)?,
                    output_truncated: row.get(3)?,
                    missing: false,
                })
            },
        )
        .optional()?;
    Ok(detail)
}
