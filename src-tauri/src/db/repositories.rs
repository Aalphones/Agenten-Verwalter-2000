//! Tabelle `repositories`: die Repositories, die die App kennt.
use rusqlite::{Connection, Row, params};

use crate::error::CommandError;

#[derive(Debug, Clone)]
pub struct RepositoryRow {
    pub id: String,
    pub name: String,
    /// Wurzelordner mit Backslashes.
    pub path: String,
    pub added_at: f64,
}

fn read(row: &Row<'_>) -> rusqlite::Result<RepositoryRow> {
    Ok(RepositoryRow {
        id: row.get(0)?,
        name: row.get(1)?,
        path: row.get(2)?,
        added_at: row.get(3)?,
    })
}

pub fn insert(connection: &Connection, row: &RepositoryRow) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO repositories (id, name, path, added_at) VALUES (?1, ?2, ?3, ?4)",
        params![row.id, row.name, row.path, row.added_at],
    )?;
    Ok(())
}

/// Nach Name aufsteigend, ohne Unterschied zwischen Groß- und Kleinschreibung.
pub fn list(connection: &Connection) -> Result<Vec<RepositoryRow>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT id, name, path, added_at FROM repositories ORDER BY name COLLATE NOCASE",
    )?;
    let rows: Vec<RepositoryRow> = statement
        .query_map([], read)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

/// In der Reihenfolge von `ids`; eine unbekannte ID ist ein Fehler.
pub fn get_many(
    connection: &Connection,
    ids: &[String],
) -> Result<Vec<RepositoryRow>, CommandError> {
    let mut statement =
        connection.prepare("SELECT id, name, path, added_at FROM repositories WHERE id = ?1")?;
    let mut rows: Vec<RepositoryRow> = Vec::with_capacity(ids.len());
    for id in ids {
        let mut found = statement.query_map(params![id], read)?;
        match found.next() {
            Some(row) => rows.push(row?),
            None => {
                return Err(CommandError::Internal(format!(
                    "Unbekanntes Repository: {id}"
                )));
            }
        }
    }
    Ok(rows)
}

pub fn delete(connection: &Connection, id: &str) -> Result<(), CommandError> {
    connection.execute("DELETE FROM repositories WHERE id = ?1", params![id])?;
    Ok(())
}
