//! Tabelle `session_links`: absolute Dateipfade, die eine Agenten-Antwort im Chat genannt hat
//! (ADR 071), und der Haken `sessions.links_scanned` für das einmalige Nachlesen älterer Einträge.
use rusqlite::{Connection, params};

use crate::error::CommandError;

/// Schreibt `(Pfad, ms)`-Paare in einer Transaktion; die letzte Uhrzeit steigt nur, die erste
/// setzt nur der erste Eintrag.
pub fn upsert_all(
    connection: &mut Connection,
    session_id: &str,
    links: &[(String, f64)],
) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    {
        let mut statement = transaction.prepare(
            "INSERT INTO session_links (session_id, path, first_seen_at, last_seen_at) \
             VALUES (?1, ?2, ?3, ?3) \
             ON CONFLICT(session_id, path) DO UPDATE SET \
             last_seen_at = max(last_seen_at, excluded.last_seen_at)",
        )?;
        for (path, seen_at) in links {
            statement.execute(params![session_id, path, seen_at])?;
        }
    }
    transaction.commit()?;
    Ok(())
}

/// Alle verlinkten Pfade einer Session, älteste zuerst.
pub fn load(connection: &Connection, session_id: &str) -> Result<Vec<String>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT path FROM session_links WHERE session_id = ?1 ORDER BY first_seen_at, path",
    )?;
    let paths = statement
        .query_map(params![session_id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;
    Ok(paths)
}

/// Ob die Verweise der älteren Chat-Einträge dieser Session schon eingelesen sind.
pub fn is_scanned(connection: &Connection, session_id: &str) -> Result<bool, CommandError> {
    let scanned: bool = connection.query_row(
        "SELECT links_scanned FROM sessions WHERE id = ?1",
        params![session_id],
        |row| row.get(0),
    )?;
    Ok(scanned)
}

pub fn mark_scanned(connection: &Connection, session_id: &str) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE sessions SET links_scanned = 1 WHERE id = ?1",
        params![session_id],
    )?;
    Ok(())
}
