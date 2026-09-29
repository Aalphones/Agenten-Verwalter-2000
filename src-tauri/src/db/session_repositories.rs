//! Tabelle `session_repositories`: die Repositories einer Session samt Branch und Basis.
use std::path::PathBuf;

use rusqlite::{Connection, params};

use crate::error::CommandError;
use crate::worktrees::SessionRepository;

/// Schreibt alle Repositories einer Session in einer Transaktion; `position` ist der Index.
pub fn insert_all(
    connection: &mut Connection,
    session_id: &str,
    repositories: &[SessionRepository],
) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    {
        let mut statement = transaction.prepare(
            "INSERT INTO session_repositories \
                 (session_id, position, name, repository_path, folder, branch, base_ref, base_commit) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )?;
        for (index, repository) in repositories.iter().enumerate() {
            let position =
                i64::try_from(index).map_err(|error| CommandError::Internal(error.to_string()))?;
            statement.execute(params![
                session_id,
                position,
                repository.name,
                repository.repository_path.to_string_lossy(),
                repository.folder,
                repository.branch,
                repository.base_ref,
                repository.base_commit,
            ])?;
        }
    }
    transaction.commit()?;
    Ok(())
}

pub fn load(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<SessionRepository>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT name, repository_path, folder, branch, base_ref, base_commit \
         FROM session_repositories WHERE session_id = ?1 ORDER BY position",
    )?;
    let repositories: Vec<SessionRepository> = statement
        .query_map(params![session_id], |row| {
            Ok(SessionRepository {
                name: row.get(0)?,
                repository_path: PathBuf::from(row.get::<_, String>(1)?),
                folder: row.get(2)?,
                branch: row.get(3)?,
                base_ref: row.get(4)?,
                base_commit: row.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(repositories)
}
