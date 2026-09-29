//! Die Liste der Repositories, die die App kennt.
pub mod model;

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::db::Database;
use crate::db::repositories::{self as rows, RepositoryRow};
use crate::error::CommandError;
use crate::git;
use model::KnownRepository;

pub fn list(database: &Database) -> Result<Vec<KnownRepository>, CommandError> {
    let stored = database.with(|connection| rows::list(connection))?;
    Ok(stored.into_iter().map(describe).collect())
}

/// Merkt sich das Repository, in dem `path` liegt (gespeichert wird der Wurzelordner).
/// Ein schon bekanntes Repository wird zurückgegeben statt doppelt angelegt.
pub fn add(database: &Database, path: &str) -> Result<KnownRepository, CommandError> {
    let root = match git::toplevel(Path::new(path)) {
        Ok(root) => root,
        Err(CommandError::Git(_)) => return Err(CommandError::NotARepository(path.to_owned())),
        Err(other) => return Err(other),
    };
    let root_text: String = root.to_string_lossy().into_owned();
    let name: String = root.file_name().map_or_else(
        || root_text.clone(),
        |name| name.to_string_lossy().into_owned(),
    );
    database.with(|connection| {
        let known = rows::list(connection)?;
        if let Some(existing) = known
            .into_iter()
            .find(|row: &RepositoryRow| row.path.eq_ignore_ascii_case(&root_text))
        {
            return Ok(describe(existing));
        }
        let row = RepositoryRow {
            id: Uuid::new_v4().to_string(),
            name,
            path: root_text,
            added_at: now_ms(),
        };
        rows::insert(connection, &row)?;
        Ok(describe(row))
    })
}

pub fn remove(database: &Database, id: &str) -> Result<(), CommandError> {
    database.with(|connection| rows::delete(connection, id))
}

/// Anzahl der Unterordner von `<root>\.claude\skills`, die eine `SKILL.md` enthalten.
pub fn count_skills(root: &Path) -> u32 {
    let Ok(entries) = fs::read_dir(root.join(".claude").join("skills")) else {
        return 0;
    };
    let count: usize = entries
        .flatten()
        .filter(|entry: &fs::DirEntry| entry.path().join("SKILL.md").is_file())
        .count();
    u32::try_from(count).unwrap_or(u32::MAX)
}

fn describe(row: RepositoryRow) -> KnownRepository {
    let root = Path::new(&row.path);
    let is_missing = !root.join(".git").exists();
    let skill_count = if is_missing { 0 } else { count_skills(root) };
    KnownRepository {
        id: row.id,
        name: row.name,
        path: row.path,
        skill_count,
        is_missing,
    }
}

fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed| elapsed.as_secs_f64() * 1000.0)
}
