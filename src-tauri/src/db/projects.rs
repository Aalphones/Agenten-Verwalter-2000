//! Tabelle `projects`: eine Zeile je Vorhaben; seine Sessions verweisen über `sessions.project_id`.
use rusqlite::{Connection, OptionalExtension, params};

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

/// Ein Vorhaben unabhängig davon, ob es archiviert ist; `None`, wenn es die Zeile nicht gibt.
pub fn load_one(connection: &Connection, id: &str) -> Result<Option<ProjectRow>, CommandError> {
    let row = connection
        .query_row(
            "SELECT id, name, created_at, tldr, tldr_at, tldr_sources FROM projects WHERE id = ?1",
            params![id],
            |row| {
                Ok(ProjectRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    tldr: row.get(3)?,
                    tldr_at: row.get(4)?,
                    tldr_sources: row.get(5)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

/// Ein archiviertes Vorhaben, wie die Archiv-Suche es braucht.
#[derive(Debug, Clone)]
pub struct ArchivedRow {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    pub archived_at: f64,
}

/// Alle archivierten Vorhaben, jüngst archivierte zuerst; `id` macht die Reihenfolge eindeutig,
/// damit sich Seiten derselben Suche nicht überlappen.
pub fn load_archived(connection: &Connection) -> Result<Vec<ArchivedRow>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT id, name, created_at, archived_at FROM projects \
         WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, id ASC",
    )?;
    let rows = statement
        .query_map([], |row| {
            Ok(ArchivedRow {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                archived_at: row.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<ArchivedRow>>>()?;
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

/// Holt ein archiviertes Vorhaben samt aller seiner Sessions zurück, in einer Transaktion wie
/// `archive`. Ein unbekanntes oder nicht archiviertes Vorhaben ist ein Fehler; die Transaktion
/// wird dann ohne Änderung verworfen.
pub fn restore(connection: &mut Connection, id: &str) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    let restored = transaction.execute(
        "UPDATE projects SET archived_at = NULL WHERE id = ?1 AND archived_at IS NOT NULL",
        params![id],
    )?;
    if restored == 0 {
        return Err(CommandError::Internal(format!(
            "Kein archiviertes Vorhaben: {id}"
        )));
    }
    transaction.execute(
        "UPDATE sessions SET archived_at = NULL WHERE project_id = ?1",
        params![id],
    )?;
    transaction.commit()?;
    Ok(())
}

/// Nur für ein Vorhaben ohne Sessions: `sessions.project_id` verweist auf die Zeile.
pub fn delete(connection: &Connection, id: &str) -> Result<(), CommandError> {
    connection.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}
