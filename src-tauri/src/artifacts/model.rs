//! Typen, die die Artefakte eines Vorhabens über die Tauri-Grenze beschreiben (ADR 026).
use std::collections::HashMap;

use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    /// Dateiname im Ordner, z. B. "quartalsbericht-q3.html".
    pub file: String,
    /// Inhalt von <title>, sonst der Dateiname ohne Endung.
    pub title: String,
    /// Letzte Änderung der Datei, ms seit 1970.
    pub modified_at: f64,
    /// Session des Vorhabens, die die Datei zuletzt mit einem schreibenden Werkzeug angefasst hat
    /// (Tabelle `session_files`); `None`, wenn keine (z. B. per Shell geschrieben).
    pub session_id: Option<String>,
    pub session_number: Option<u32>,
    pub session_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactList {
    /// Absoluter Pfad des Ordners `.artefakte`, auch wenn es ihn noch nicht gibt.
    pub dir: String,
    /// Neueste Änderung zuerst.
    pub items: Vec<Artifact>,
}

/// Eine Session des Vorhabens mit den Dateien, die ihr Agent geschrieben hat: normalisierter Pfad
/// → letzte Uhrzeit. Nur im Core, für die Zuordnung in `artifacts::list`.
pub struct ArtifactOwner {
    pub session_id: String,
    pub number: u32,
    pub name: String,
    pub touched: HashMap<String, f64>,
}
