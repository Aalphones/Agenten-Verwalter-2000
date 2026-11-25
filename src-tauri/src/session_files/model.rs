//! Typen der Session-Dateien (ADR 071): was über die Tauri-Grenze geht, und die Eingabe, aus der
//! die Liste und die Grenze entstehen.
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::artifacts::model::ArtifactKind;

/// Ort einer Session-Datei. Die Reihenfolge hier ist die der Liste.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SessionFileOrigin {
    /// `<Workspace>\.scratchpad\<Session-ID>`.
    Scratchpad,
    /// Der Scratchpad-Ordner, den die Kommandozeile meldet.
    CliScratchpad,
    /// Alles andere außerhalb der Repository-Einträge und `.artefakte`.
    Elsewhere,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionFile {
    /// Absolut und nativ; bei vorhandener Datei mit echter Schreibweise.
    pub path: String,
    /// Scratchpad-Orte: Ordner relativ zum Scratchpad mit `/`, leer = Wurzel. `Elsewhere`:
    /// absoluter Elternordner, nativ.
    pub folder: String,
    pub name: String,
    pub origin: SessionFileOrigin,
    /// Der Agent der Session hat die Datei geschrieben (`session_files`).
    pub written: bool,
    /// Die Session hat die Datei im Chat verlinkt (`session_links`).
    pub linked: bool,
    pub exists: bool,
    pub bytes: Option<f64>,
    /// Letzte Änderung, ms seit 1970.
    pub modified_at: Option<f64>,
    pub kind: ArtifactKind,
    /// Für den Typ gibt es eine Betrachter-Seite.
    pub viewer: bool,
    /// „Mit Standardprogramm öffnen“ ist gesperrt.
    pub executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionFileGroup {
    pub session_id: String,
    pub number: u32,
    pub name: String,
    pub scratchpad_dir: Option<String>,
    pub cli_scratchpad_dir: Option<String>,
    /// Sortiert nach Ort, dann `folder`, dann `name`.
    pub files: Vec<SessionFile>,
    /// Ein Scratchpad hatte mehr Einträge, als gelesen werden.
    pub truncated: bool,
    /// Je nicht lesbarem Ort ein Satz.
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionFilesListing {
    /// Die anfragende Session zuerst, dann nach Nummer absteigend; Gruppen ohne Dateien und ohne
    /// Fehler fehlen.
    pub groups: Vec<SessionFileGroup>,
}

/// Wie die Oberfläche eine Datei adressiert.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FileRef {
    /// Eintrag und relativer Pfad wie in `files_read`.
    Entry { key: String, path: String },
    /// Eine Session-Datei; die Grenze zieht `access::allowed_absolute`.
    Absolute { path: String },
}

/// Eine Session des Vorhabens, wie die Registry oder das Prüfprogramm sie kennt.
#[derive(Debug, Clone)]
pub struct MemberIdentity {
    pub session_id: String,
    pub number: u32,
    pub name: String,
    pub workspace: PathBuf,
    /// Die anfragende Session.
    pub is_own: bool,
}

/// Eine Session mit allem, was die Datenbank über ihre Dateien weiß.
#[derive(Debug, Clone)]
pub struct SessionFilesMember {
    pub identity: MemberIdentity,
    pub cli_scratchpad_dir: Option<PathBuf>,
    /// Geschriebene Pfade, wie `session_files` sie speichert (normalisiert).
    pub written: Vec<String>,
    /// Verlinkte Pfade, wie `session_links` sie speichert.
    pub linked: Vec<String>,
}

/// Alles, woraus die Liste und die Grenze eines Vorhabens entstehen.
#[derive(Debug, Clone)]
pub struct SessionFilesInput {
    pub members: Vec<SessionFilesMember>,
    /// Die Ordner aller Repository-Einträge des Vorhabens.
    pub repository_dirs: Vec<PathBuf>,
    /// Der Ordner `.artefakte` des Vorhabens.
    pub artifacts_dir: PathBuf,
}
