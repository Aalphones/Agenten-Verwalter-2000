//! Die Liste der Repositories und Ordner ohne Git, die die App kennt (ADR 018).
pub mod model;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::db::Database;
use crate::db::repositories::{self as rows, RepositoryRow};
use crate::error::CommandError;
use crate::filesystem::workspace::DATA_DIR_NAME;
use crate::git;
use crate::worktrees::normalized_dir;
use model::{KnownRepository, RepositoryKind};

pub fn list(database: &Database) -> Result<Vec<KnownRepository>, CommandError> {
    let stored = database.with(|connection| rows::list(connection))?;
    Ok(stored.into_iter().map(describe).collect())
}

/// Merkt sich das Repository, in dem `path` liegt (gespeichert wird der Wurzelordner). Liegt in
/// `path` und allen Ordnern darüber kein `.git`, wird der Ordner selbst als Ordner ohne Git
/// gespeichert — außer er ist gesperrt (`check_folder_allowed`). Ein schon bekannter Eintrag wird
/// zurückgegeben statt doppelt angelegt.
pub fn add(database: &Database, path: &str, home: &Path) -> Result<KnownRepository, CommandError> {
    let normalized = trim_trailing_separators(path);
    let root: PathBuf = if has_git_above(Path::new(&normalized)) {
        // Ein Git-Fehler bleibt ein Fehler: ein Repository mit Git-Problem wird nicht still zum Ordner.
        git::toplevel(Path::new(&normalized))?
    } else {
        check_folder_allowed(Path::new(&normalized), home)?;
        PathBuf::from(&normalized)
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
    let is_missing = !root.is_dir();
    let kind = if root.join(".git").exists() {
        RepositoryKind::Git
    } else {
        RepositoryKind::Folder
    };
    let skill_count = if is_missing { 0 } else { count_skills(root) };
    KnownRepository {
        id: row.id,
        name: row.name,
        path: row.path,
        kind,
        skill_count,
        is_missing,
    }
}

/// Ohne abschließenden Trenner; eine Laufwerkswurzel behält ihn (`C:` → `C:\`), damit sie als
/// Wurzel erkennbar bleibt.
fn trim_trailing_separators(path: &str) -> String {
    let trimmed = path.trim_end_matches(['\\', '/']);
    if trimmed.ends_with(':') {
        return format!("{trimmed}\\");
    }
    trimmed.to_owned()
}

/// Ob in `path` oder einem Ordner darüber ein `.git` liegt (Ordner oder Datei). Das Dateisystem
/// entscheidet, nicht ein Git-Fehler.
fn has_git_above(path: &Path) -> bool {
    path.ancestors().any(|dir: &Path| dir.join(".git").exists())
}

/// Sperrt für Ordner ohne Git, was der Agent nicht bekommen darf (AGENTS.md Regel 5): die
/// Laufwerkswurzel, den Benutzerordner samt allem darüber und den Datenordner der App samt Inhalt.
fn check_folder_allowed(dir: &Path, home: &Path) -> Result<(), CommandError> {
    let dir_text = normalized_dir(dir);
    let home_text = normalized_dir(home);
    let data_text = normalized_dir(&home.join(DATA_DIR_NAME));
    let is_drive_root = dir.parent().is_none();
    let is_home_or_above = is_same_or_inside(&home_text, &dir_text);
    let is_data_dir = is_same_or_inside(&dir_text, &data_text);
    if is_drive_root || is_home_or_above || is_data_dir {
        return Err(CommandError::FolderNotAllowed(dir.display().to_string()));
    }
    Ok(())
}

/// `candidate` ist `base` oder liegt darin; beide sind mit `normalized_dir` aufbereitet.
fn is_same_or_inside(candidate: &str, base: &str) -> bool {
    candidate == base || candidate.starts_with(&format!("{base}\\"))
}

fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed| elapsed.as_secs_f64() * 1000.0)
}
