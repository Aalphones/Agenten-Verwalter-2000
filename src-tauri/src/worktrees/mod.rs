//! Anlegen und Aufräumen der Worktrees einer Session.
use std::path::PathBuf;

/// Ein Repository einer Session, als Kopie: die Session bleibt gültig, auch wenn das
/// Repository aus der Liste der bekannten Repositories verschwindet.
#[derive(Debug, Clone)]
pub struct SessionRepository {
    pub name: String,
    /// Wurzelordner des Haupt-Checkouts.
    pub repository_path: PathBuf,
    /// Unterordner im Workspace.
    pub folder: String,
    pub branch: String,
    pub base_ref: String,
    pub base_commit: String,
}
