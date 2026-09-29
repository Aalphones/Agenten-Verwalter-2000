//! Tabelle `background_items`: eine Zeile je Hintergrund-Eintrag, die Nutzlast ist der Eintrag als
//! JSON. Die Ausgabe eines Befehls liegt in einer eigenen Spalte, damit die Liste sie nie mitlädt.
use rusqlite::{Connection, OptionalExtension, params};

use crate::background::model::BackgroundItem;
use crate::error::CommandError;

/// Schreibt die Einträge in einer Transaktion. Eine bestehende Zeile behält ihre Ausgabe.
pub fn upsert_items(
    connection: &mut Connection,
    session_id: &str,
    items: &[BackgroundItem],
) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    {
        let mut statement = transaction.prepare(
            "INSERT INTO background_items (session_id, id, started_at, payload) \
             VALUES (?1, ?2, ?3, ?4) \
             ON CONFLICT(session_id, id) DO UPDATE SET \
                 payload = excluded.payload, started_at = excluded.started_at",
        )?;
        for item in items {
            let payload = serde_json::to_string(item)
                .map_err(|error| CommandError::Database(error.to_string()))?;
            statement.execute(params![session_id, item.id, item.started_at, payload])?;
        }
    }
    transaction.commit()?;
    Ok(())
}

/// Die Zeile muss schon stehen (`upsert_items`).
pub fn set_output(
    connection: &Connection,
    session_id: &str,
    id: &str,
    output: &str,
    truncated: bool,
) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE background_items SET output = ?3, output_truncated = ?4 \
         WHERE session_id = ?1 AND id = ?2",
        params![session_id, id, output, truncated],
    )?;
    Ok(())
}

/// Alle Einträge der Session nach `started_at`, ohne Ausgaben.
pub fn load_items(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<BackgroundItem>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT payload FROM background_items WHERE session_id = ?1 ORDER BY started_at, id",
    )?;
    let payloads: Vec<String> = statement
        .query_map(params![session_id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<_>>()?;
    payloads
        .iter()
        .map(|payload: &String| {
            serde_json::from_str(payload)
                .map_err(|error| CommandError::Database(format!("Hintergrund-Eintrag: {error}")))
        })
        .collect()
}

/// Ausgabe und ob sie gekürzt ist; `None`, wenn es die Zeile nicht gibt oder keine Ausgabe gespeichert ist.
pub fn load_output(
    connection: &Connection,
    session_id: &str,
    id: &str,
) -> Result<Option<(String, bool)>, CommandError> {
    let stored: Option<(Option<String>, bool)> = connection
        .query_row(
            "SELECT output, output_truncated FROM background_items \
             WHERE session_id = ?1 AND id = ?2",
            params![session_id, id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    Ok(stored.and_then(|(output, truncated)| output.map(|text: String| (text, truncated))))
}
