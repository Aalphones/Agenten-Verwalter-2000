//! Typen, die Versionen und Installation des Verwalters über die Tauri-Grenze beschreiben.
use serde::Serialize;
use ts_rs::TS;

/// Wie sich der laufende Verwalter aktualisiert.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum InstallKind {
    /// Die lose exe ersetzt ihre eigene Datei am selben Pfad.
    Portable,
    /// Neben der exe liegt `uninstall.exe`: der Installer der neuen Version wird gestartet.
    Installer,
    /// Kein Windows: nur ein Link auf die Release-Seite.
    Manual,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    /// Ohne führendes `v`, z.B. `0.35.0`.
    pub version: String,
    /// Markdown der Release-Notes; leer, wenn das Release keine hat.
    pub notes: String,
    /// ISO 8601.
    pub published_at: Option<String>,
    /// Release-Seite auf GitHub.
    pub url: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateStatus {
    /// Die laufende Version (in Debug-Läufen ersetzbar über `VERWALTER_APP_VERSION`).
    pub installed: String,
    /// Die neueste veröffentlichte Version; `None`, wenn die Abfrage scheiterte.
    pub latest: Option<String>,
    pub has_update: bool,
    /// Alle Releases neuer als `installed`, neueste zuerst.
    pub releases: Vec<ReleaseInfo>,
    pub install_kind: InstallKind,
    /// Nur bei `Portable`: die exe, die ersetzt wird.
    pub target_path: Option<String>,
    /// Bytes der Datei, die für die neueste Version geladen würde.
    #[ts(type = "number | null")]
    pub download_size: Option<u64>,
    /// Satz, wenn die Abfrage der Releases scheiterte.
    pub latest_error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum InstallPhase {
    Downloading,
    Verifying,
    Installing,
}

/// Inhalt von `app-update://progress`.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateProgress {
    pub phase: InstallPhase,
    #[ts(type = "number")]
    pub downloaded: u64,
    #[ts(type = "number | null")]
    pub total: Option<u64>,
}
