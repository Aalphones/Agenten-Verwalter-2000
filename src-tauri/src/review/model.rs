use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::changes::model::DiffLineKind;

/// Ein Review-Kommentar zu einer Diff-Zeile der Changes-Ansicht; geht mit `chat_send` an den Agenten.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewComment {
    /// `RepositoryChanges.key`: `"<Position>"`, `"<Position>/<Ordner>"` oder `"<Position>:<Ordner>"`.
    pub repository_key: String,
    /// `RepositoryChanges.name`, nur zur Anzeige und als Ersatz, wenn der Schlüssel nicht mehr auflösbar ist.
    pub repository_name: String,
    /// `FileChange.path`: relativ zum Repository bzw. Worktree, mit `/`.
    pub path: String,
    /// `Added`, `Deleted` oder `Context` — nie `Hunk`.
    pub kind: DiffLineKind,
    /// Neue Nummer; bei `Deleted` die alte.
    pub line: u32,
    /// Zeilentext ohne Vorzeichen, wie `DiffLine.text`.
    pub code: String,
    /// Der Kommentar, getrimmt, nicht leer.
    pub text: String,
}
