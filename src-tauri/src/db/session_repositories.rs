//! Tabelle `session_repositories`: die Repositories einer Session samt Checkout-Art und Basis.
use std::path::PathBuf;

use rusqlite::{Connection, params};

use crate::error::CommandError;
use crate::worktrees::{RepositoryCheckout, SessionRepository};

const CHECKOUT_APP_WORKTREE: &str = "app_worktree";
const CHECKOUT_MAIN: &str = "main";

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
                 (session_id, position, name, repository_path, checkout, folder, branch, base_ref, base_commit) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )?;
        for (index, repository) in repositories.iter().enumerate() {
            let position =
                i64::try_from(index).map_err(|error| CommandError::Internal(error.to_string()))?;
            let (checkout, folder, branch) = match &repository.checkout {
                RepositoryCheckout::AppWorktree { folder, branch } => {
                    (CHECKOUT_APP_WORKTREE, folder.as_str(), branch.as_str())
                }
                RepositoryCheckout::Main => (CHECKOUT_MAIN, "", ""),
            };
            statement.execute(params![
                session_id,
                position,
                repository.name,
                repository.repository_path.to_string_lossy(),
                checkout,
                folder,
                branch,
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
        "SELECT name, repository_path, checkout, folder, branch, base_ref, base_commit \
         FROM session_repositories WHERE session_id = ?1 ORDER BY position",
    )?;
    let rows: Vec<StoredRepository> = statement
        .query_map(params![session_id], |row| {
            Ok(StoredRepository {
                name: row.get(0)?,
                repository_path: row.get(1)?,
                checkout: row.get(2)?,
                folder: row.get(3)?,
                branch: row.get(4)?,
                base_ref: row.get(5)?,
                base_commit: row.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    rows.into_iter()
        .map(StoredRepository::into_session)
        .collect()
}

/// Eine Zeile, wie sie in der Tabelle steht; die Checkout-Art wird erst danach geprüft.
struct StoredRepository {
    name: String,
    repository_path: String,
    checkout: String,
    folder: String,
    branch: String,
    base_ref: String,
    base_commit: String,
}

impl StoredRepository {
    fn into_session(self) -> Result<SessionRepository, CommandError> {
        let checkout = match self.checkout.as_str() {
            CHECKOUT_APP_WORKTREE => RepositoryCheckout::AppWorktree {
                folder: self.folder,
                branch: self.branch,
            },
            CHECKOUT_MAIN => RepositoryCheckout::Main,
            other => {
                return Err(CommandError::Internal(format!(
                    "Unbekannte Checkout-Art {other}"
                )));
            }
        };
        Ok(SessionRepository {
            name: self.name,
            repository_path: PathBuf::from(self.repository_path),
            base_ref: self.base_ref,
            base_commit: self.base_commit,
            checkout,
        })
    }
}
