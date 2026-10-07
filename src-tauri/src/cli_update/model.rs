//! Typen, die Version und Aktualisierung der Claude-Kommandozeile über die Tauri-Grenze beschreiben.
use serde::Serialize;
use ts_rs::TS;

/// Ergebnis des letzten `claude update` in dieser App-Sitzung.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CliUpdateOutcome {
    pub succeeded: bool,
    /// Die letzten Zeilen der Ausgabe von `claude update`.
    pub output: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CliVersionStatus {
    /// Die installierte Version, z.B. `2.1.284`; `None`, wenn sie sich nicht lesen ließ.
    pub installed: Option<String>,
    /// Die jüngste veröffentlichte Version; `None`, wenn die Abfrage scheiterte.
    pub latest: Option<String>,
    /// `true`, nur wenn beide Versionen bekannt sind und `latest` neuer ist.
    pub has_update: bool,
    pub is_updating: bool,
    pub last_update: Option<CliUpdateOutcome>,
    /// Fehler beim Lesen der installierten Version.
    pub installed_error: Option<String>,
    /// Fehler bei der Abfrage der jüngsten Version.
    pub latest_error: Option<String>,
}
