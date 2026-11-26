//! Typen der Ansicht „Dateien“ über die Tauri-Grenze (ADR 067).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::changes::model::ChangeKind;

/// Eine Datei im Baum eines Eintrags.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TreeFile {
    /// Relativ zum Ordner des Eintrags, mit `/`.
    pub path: String,
    /// Symbolischer Link.
    pub link: bool,
}

/// Ein von Git ignorierter Eintrag, so zusammengefasst wie in `git status`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredEntry {
    /// Relativ zum Ordner des Eintrags, mit `/`, ohne Schrägstrich am Ende.
    pub path: String,
    pub dir: bool,
}

/// Der vollständige Dateibaum eines Eintrags.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepoTree {
    /// Versionierte und neue, nicht ignorierte Dateien, nach Pfad sortiert (Byte-Reihenfolge).
    pub files: Vec<TreeFile>,
    /// Ohne Ordner, die selbst ein Repository oder ein Arbeitsbaum sind.
    pub ignored: Vec<IgnoredEntry>,
    /// `files` endet nach der Höchstzahl.
    pub truncated: bool,
}

/// Ein direktes Kind eines ignorierten Ordners.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub dir: bool,
    pub link: bool,
}

/// Der Inhalt einer Datei im Arbeitsverzeichnis, so wie die Ansicht ihn zeigen kann.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FileContent {
    /// Zeilenenden als `\n`; `truncated`: nach der Höchstzahl an Zeilen abgeschnitten.
    #[serde(rename_all = "camelCase")]
    Text {
        text: String,
        line_count: u32,
        truncated: bool,
    },
    /// Kein Text (auch Bilder, Video, Ton, PDF; die zeigt der Betrachter über seine Adresse).
    #[serde(rename_all = "camelCase")]
    Binary {
        bytes: f64,
    },
    #[serde(rename_all = "camelCase")]
    TooLarge {
        bytes: f64,
    },
    Missing,
}

/// Eine Datei, die ein Commit geändert hat, gemessen gegen seinen ersten Elternteil.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HistoryFile {
    /// Relativ zum Repository, mit `/`.
    pub path: String,
    pub kind: ChangeKind,
    pub added: u32,
    pub deleted: u32,
    /// Git zählt keine Zeilen; `added` und `deleted` sind dann 0.
    pub binary: bool,
}

/// Ein eigener Commit des Vorhabens (ein „Schritt“).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HistoryCommit {
    pub id: String,
    pub short_id: String,
    pub subject: String,
    /// Committer-Zeit in Sekunden.
    pub time: f64,
    pub group: String,
    pub group_name: String,
    /// Der Eintrag, in dessen Ordner der Commit lesbar ist — für `files_commit_diff`.
    pub key: String,
    /// In keinem Eintrag zwischen Basis und `HEAD` enthalten, aber im Objektspeicher da.
    pub loose: bool,
    pub files: Vec<HistoryFile>,
}

/// Die Commits einer Session des Vorhabens, neueste zuerst.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HistorySession {
    pub session_id: String,
    pub number: u32,
    pub name: String,
    pub commits: Vec<HistoryCommit>,
}

/// Der Verlauf des ganzen Vorhabens: wer wann was committet hat.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProjectHistory {
    /// Sessions mit mindestens einem lesbaren Commit, nach Nummer absteigend.
    pub sessions: Vec<HistorySession>,
    /// Commits, die kein Repository des Vorhabens mehr kennt.
    pub missing: u32,
}
