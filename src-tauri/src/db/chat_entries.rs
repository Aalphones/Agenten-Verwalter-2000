//! Tabelle `chat_entries`: eine Zeile je Chat-Eintrag, die Nutzlast ist der Eintrag als JSON.
use rusqlite::{Connection, params};

use crate::agents::event::ChatEntry;
use crate::error::CommandError;

/// Schreibt die Einträge in einer Transaktion; ein Eintrag mit bekannter `seq` überschreibt die Zeile.
pub fn upsert_all(
    connection: &mut Connection,
    session_id: &str,
    entries: &[ChatEntry],
) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    {
        let mut statement = transaction.prepare(
            "INSERT INTO chat_entries (session_id, seq, payload) VALUES (?1, ?2, ?3) \
             ON CONFLICT(session_id, seq) DO UPDATE SET payload = excluded.payload",
        )?;
        for entry in entries {
            let payload = serde_json::to_string(entry)
                .map_err(|error| CommandError::Database(error.to_string()))?;
            statement.execute(params![session_id, entry.seq(), payload])?;
        }
    }
    transaction.commit()?;
    Ok(())
}

/// Der Verlauf aufsteigend, bis zur ersten Lücke in `seq`: der Speicher indiziert mit `seq`,
/// eine Lücke darf nicht durchrutschen.
pub fn load_all(connection: &Connection, session_id: &str) -> Result<Vec<ChatEntry>, CommandError> {
    let mut statement = connection
        .prepare("SELECT seq, payload FROM chat_entries WHERE session_id = ?1 ORDER BY seq")?;
    let rows = statement.query_map(params![session_id], |row| {
        Ok((row.get::<_, u32>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut entries: Vec<ChatEntry> = Vec::new();
    for row in rows {
        let (seq, payload) = row?;
        if usize::try_from(seq).ok() != Some(entries.len()) {
            break;
        }
        let entry: ChatEntry = serde_json::from_str(&payload)
            .map_err(|error| CommandError::Database(format!("Eintrag {seq}: {error}")))?;
        entries.push(entry);
    }
    Ok(entries)
}
