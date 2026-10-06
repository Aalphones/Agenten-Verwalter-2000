//! Typen der Git-Werkzeuge in den Changes einer Session über die Tauri-Grenze (ADR 025).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::changes::model::ChangeKind;

/// Ein laufender Merge oder Rebase im Arbeitsordner, den Git mit Konflikten hat stehen lassen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum GitOperation {
    None,
    Merge,
    Rebase,
}

/// Eine Session des Vorhabens, die gerade arbeitet und damit die Sperre hält.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitBusySession {
    pub id: String,
    pub number: u32,
    pub name: String,
}

/// Eine uncommittete Datei im Ordner eines Eintrags, die nicht zu den eigenen Changes gehört.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitForeignFile {
    /// Relativ zum Ordner, mit Schrägstrichen.
    pub path: String,
    pub kind: ChangeKind,
    pub added: u32,
    pub deleted: u32,
    pub binary: bool,
}

/// Ein eigener Commit der Session seit der Basis.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitOwnCommit {
    pub id: String,
    /// Die ersten 7 Zeichen von `id`.
    pub short_id: String,
    pub subject: String,
    /// Im Upstream enthalten; ohne Upstream `false`.
    pub pushed: bool,
    /// Relativ zum Ordner, mit Schrägstrichen.
    pub files: Vec<String>,
}

/// Der Git-Zustand eines Eintrags der Changes. Scheitert das Lesen, steht nur `error`, der Rest ist
/// leer bzw. 0.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitEntryStatus {
    /// `RepositoryChanges.key`.
    pub key: String,
    /// `None` bei losgelöstem HEAD.
    pub branch: Option<String>,
    /// Z. B. `origin/main`.
    pub upstream: Option<String>,
    /// Ziel für einen Push ohne Upstream: `origin`, sonst der einzige Remote.
    pub remote: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub operation: GitOperation,
    pub conflicted: Vec<String>,
    pub foreign: Vec<GitForeignFile>,
    /// Neueste zuerst.
    pub commits: Vec<GitOwnCommit>,
    /// `HEAD` liegt im Upstream; dann ist „Ergänzen“ gesperrt.
    pub head_pushed: bool,
    /// Letzter erfolgreicher Fetch in diesem App-Lauf, ms seit 1970.
    pub last_fetch_ms: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitSessionStatus {
    /// Reihenfolge wie `SessionChanges.repositories`.
    pub entries: Vec<GitEntryStatus>,
    /// Sessions des Vorhabens in `Starting`, `Running` oder `Waiting`.
    pub busy: Vec<GitBusySession>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    /// Lokal `x`, remote `origin/x`.
    pub name: String,
    pub remote: bool,
    pub current: bool,
    /// Ordnername des Worktrees, in dem der Branch anderswo ausgecheckt ist.
    pub worktree: Option<String>,
}

/// Was mit offenen Änderungen beim Branch-Wechsel geschieht.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum GitSwitchMode {
    /// Mitnehmen.
    Plain,
    /// Vorher beiseitelegen.
    Stash,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum GitOpenTarget {
    Explorer,
    VsCode,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitLogCommit {
    pub id: String,
    pub short_id: String,
    pub parents: Vec<String>,
    pub author: String,
    /// Sekunden seit 1970; serde schreibt eine JSON-Zahl, kein `bigint`.
    #[ts(type = "number")]
    pub time: i64,
    pub subject: String,
    /// Aus `%D` mit vollen Namen (`refs/heads/x`, `refs/remotes/origin/x`, `tag: refs/tags/x`), ohne `HEAD`.
    pub refs: Vec<String>,
    pub own: bool,
    pub pushed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitLog {
    pub commits: Vec<GitLogCommit>,
    pub incoming: Vec<GitLogCommit>,
}
