//! Tabelle `projects`: eine Zeile je Vorhaben; seine Sessions verweisen über `sessions.project_id`.
use rusqlite::{Connection, params};

use crate::error::CommandError;

#[derive(Debug, Clone)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    /// TL;DR als JSON; nur gelesen — geschrieben wird es über `db::tldr`, `insert` lässt es leer.
    pub tldr: Option<String>,
    pub tldr_at: Option<f64>,
    pub tldr_sources: Option<u32>,
}

pub fn insert(connection: &Connection, row: &ProjectRow) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO projects (id, name, created_at) VALUES (?1, ?2, ?3)",
        params![row.id, row.name, row.created_at],
    )?;
    Ok(())
}

/// Alle nicht archivierten Vorhaben, neueste zuerst.
pub fn load_active(connection: &Connection) -> Result<Vec<ProjectRow>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT id, name, created_at, tldr, tldr_at, tldr_sources FROM projects \
         WHERE archived_at IS NULL ORDER BY created_at DESC",
    )?;
    let rows = statement
        .query_map([], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                tldr: row.get(3)?,
                tldr_at: row.get(4)?,
                tldr_sources: row.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<ProjectRow>>>()?;
    Ok(rows)
}

pub fn rename(connection: &Connection, id: &str, name: &str) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE projects SET name = ?2 WHERE id = ?1",
        params![id, name],
    )?;
    Ok(())
}

/// Archiviert das Vorhaben samt aller seiner Sessions in einer Transaktion — ein halb archiviertes
/// Vorhaben käme nach einem Neustart ohne seine Sessions oder mit Sessions ohne Vorhaben zurück.
pub fn archive(
    connection: &mut Connection,
    id: &str,
    archived_at: f64,
) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    transaction.execute(
        "UPDATE projects SET archived_at = ?2 WHERE id = ?1",
        params![id, archived_at],
    )?;
    transaction.execute(
        "UPDATE sessions SET archived_at = ?2 WHERE project_id = ?1",
        params![id, archived_at],
    )?;
    transaction.commit()?;
    Ok(())
}

/// Nur für ein Vorhaben ohne Sessions: `sessions.project_id` verweist auf die Zeile.
pub fn delete(connection: &Connection, id: &str) -> Result<(), CommandError> {
    connection.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}
