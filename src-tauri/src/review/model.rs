use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::changes::model::DiffLineKind;

/// Woran ein Review-Kommentar hÃ¤ngt (ADR 035). Alte EintrÃ¤ge ohne Ziel sind Diff-Kommentare.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum CommentTarget {
    /// Zeile im Diff; Ort steht in den Ã¼brigen Feldern von `ReviewComment`.
    #[default]
    Diff,
    /// Element in einem Artefakt des Vorhabens.
    Artifact {
        /// Dateiname relativ zum Ordner `.artefakte`, mit `/`.
        file: String,
        /// CSS-Pfad des Elements, hÃ¶chstens 300 Zeichen.
        selector: String,
        /// Sichtbarer Text des Elements, gekÃ¼rzt auf 80 Zeichen, fÃ¼r die Karte.
        label: String,
    },
    /// Rechteck auf einem angehÃ¤ngten Bild.
    Image {
        /// Kennung des Anhangs (`Attachment.id`).
        attachment_id: String,
        /// Absoluter Pfad des Bilds zum Zeitpunkt des Kommentars.
        path: String,
        name: String,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
        image_width: u32,
        image_height: u32,
    },
}

/// Ein Review-Kommentar an einer Diff-Zeile, einem Artefakt-Element oder einem Bildbereich.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewComment {
    /// Ziel des Kommentars; fehlt es in alten Chat-EintrÃ¤gen, ist es ein Diff-Kommentar.
    #[serde(default)]
    pub target: CommentTarget,
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
