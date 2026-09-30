//! Tabelle `session_ticket_worktrees`: Ticket-Worktrees, die der Agent einer Session benutzt hat.
use rusqlite::{Connection, params};

use crate::error::CommandError;

/// Schreibt `(Position, Ordnername)`-Paare in einer Transaktion; ein schon bekanntes Paar bleibt.
pub fn insert_all(
    connection: &mut Connection,
    session_id: &str,
    worktrees: &[(u32, String)],
) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    {
        let mut statement = transaction.prepare(
            "INSERT OR IGNORE INTO session_ticket_worktrees (session_id, position, folder) \
             VALUES (?1, ?2, ?3)",
        )?;
        for (position, folder) in worktrees {
            statement.execute(params![session_id, position, folder])?;
        }
    }
    transaction.commit()?;
    Ok(())
}

pub fn load(connection: &Connection, session_id: &str) -> Result<Vec<(u32, String)>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT position, folder FROM session_ticket_worktrees \
         WHERE session_id = ?1 ORDER BY position, folder",
    )?;
    let worktrees = statement
        .query_map(params![session_id], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<Vec<(u32, String)>>>()?;
    Ok(worktrees)
}
