//! Typen der Ansicht „Dateien“ über die Tauri-Grenze (ADR 067).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

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
    /// `data_url`: `data:<MIME>;base64,…`.
    #[serde(rename_all = "camelCase")]
    Image {
        data_url: String,
        bytes: f64,
    },
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
