//! Typen der Changes-Ansicht über die Tauri-Grenze.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
}

/// Blickwinkel auf die Änderungen, alle gegen `base_commit` der Session (ADR 006).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ChangeScope {
    /// Basis → Arbeitsverzeichnis, dazu die untracked Dateien.
    All,
    /// Basis → `HEAD` des Session-Branches.
    Committed,
    /// `HEAD` → Arbeitsverzeichnis, dazu die untracked Dateien.
    Uncommitted,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LineStat {
    pub kind: ChangeKind,
    pub added: u32,
    pub deleted: u32,
    /// Git zählt keine Zeilen; `added` und `deleted` sind dann 0.
    pub binary: bool,
}

/// Eine geänderte Datei mit ihren Zahlen je Blickwinkel; fehlt ein Wert, ist sie dort unverändert.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    /// Relativ zum Worktree, mit Schrägstrichen.
    pub path: String,
    pub all: Option<LineStat>,
    pub committed: Option<LineStat>,
    pub uncommitted: Option<LineStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryChanges {
    /// Wie `session_repositories.position`.
    pub position: u32,
    pub name: String,
    pub branch: String,
    pub base_ref: String,
    /// Commits von der Basis bis `HEAD`.
    pub commit_count: u32,
    /// Nach `path` sortiert (Byte-Reihenfolge).
    pub files: Vec<FileChange>,
    /// Gesetzt: `files` ist leer und die Zahl der Commits 0.
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionChanges {
    /// In der Reihenfolge von `session_repositories`.
    pub repositories: Vec<RepositoryChanges>,
}
