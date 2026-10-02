//! Tabelle `session_commits`: Commits, die eine Session gemacht hat (ADR 014).
use std::collections::HashSet;

use rusqlite::{Connection, params};

use crate::error::CommandError;

/// Schreibt Commit-IDs in einer Transaktion; eine schon bekannte bleibt.
pub fn insert_all(
    connection: &mut Connection,
    session_id: &str,
    commits: &[String],
) -> Result<(), CommandError> {
    let transaction = connection.transaction()?;
    {
        let mut statement = transaction.prepare(
            "INSERT OR IGNORE INTO session_commits (session_id, commit_id) VALUES (?1, ?2)",
        )?;
        for commit in commits {
            statement.execute(params![session_id, commit])?;
        }
    }
    transaction.commit()?;
    Ok(())
}

/// Die Commits aller genannten Sessions zusammen.
pub fn load_for(
    connection: &Connection,
    session_ids: &[String],
) -> Result<HashSet<String>, CommandError> {
    let mut statement =
        connection.prepare("SELECT commit_id FROM session_commits WHERE session_id = ?1")?;
    let mut commits: HashSet<String> = HashSet::new();
    for session_id in session_ids {
        let rows = statement.query_map(params![session_id], |row| row.get::<_, String>(0))?;
        for commit in rows {
            commits.insert(commit?);
        }
    }
    Ok(commits)
}
