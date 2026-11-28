//! Typen des Review-Berichts (ADR 073): die Ansicht über die Tauri-Grenze und was ein Eintrag
//! eines Bildschirms in der Datenbank trägt.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::implementation::model::StationState;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportView {
    pub implementation_id: String,
    pub phases: Vec<ReportPhase>,
    pub acceptance: Option<ReportAcceptance>,
}

/// Die erste Station `by: "you"` der letzten Phase.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportAcceptance {
    pub station_id: String,
    pub state: StationState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ReportPhaseState {
    NotStarted,
    Running,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportPhase {
    pub phase_id: String,
    pub key: String,
    pub title: String,
    pub state: ReportPhaseState,
    /// `"#11 Umsetzung"` der ersten Umsetzungs-Station.
    pub station_label: String,
    #[ts(type = "number | null")]
    pub finished_at: Option<f64>,
    pub files: u32,
    pub added: u32,
    pub removed: u32,
    /// Kurz-Hashes.
    pub commits: Vec<String>,
    pub result: Option<String>,
    pub way: Vec<ReportWayStep>,
    pub ordered: bool,
    pub tidy_error: Option<String>,
    pub review: Option<ReportReview>,
    pub screens: Vec<ReportScreen>,
    pub stops: Vec<ReportStop>,
    pub checks: Option<PhaseChecks>,
    pub entries: u32,
    /// Seit wann Haiku die Phase gerade ordnet, ms seit der Epoche.
    #[ts(type = "number | null")]
    pub tidying_since: Option<f64>,
    /// Der Stand der gültigen Ordnung, ms seit der Epoche.
    #[ts(type = "number | null")]
    pub tidied_at: Option<f64>,
    /// Dateien der Phase, geschrieben nach `tidied_at`; ohne Ordnung 0.
    pub files_since: u32,
    /// Einträge, die die Ordnung noch nicht kennt; ohne Ordnung 0.
    pub entries_since: u32,
    /// Die Ergebnisse der Fertigmeldungen der Spur-Stationen, je Zeile eines.
    pub station_result: Option<String>,
    /// Die Session der ersten Spur-Station: Ziel von „Station nachfragen“.
    pub station_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportScreen {
    pub entry: u32,
    pub name: String,
    pub by: String,
    pub text: Option<String>,
    pub deviation: Option<String>,
    pub shots: Vec<ReportShot>,
    pub steps: Vec<ReportStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportImage {
    pub url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportShot {
    pub label: String,
    pub image: ReportImage,
    /// Breite höchstens 600 px.
    pub narrow: bool,
    pub design: Option<ReportImage>,
    pub marks: Vec<ReportMark>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportStep {
    pub open: String,
    pub act: String,
    pub expect: String,
    pub before: Option<ReportImage>,
    pub after: Option<ReportImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportWayStep {
    pub text: String,
    pub files: Vec<String>,
    pub detour: bool,
    pub stop: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportReview {
    pub by: String,
    pub open: Vec<ReportFinding>,
    pub resolved: Vec<ReportFinding>,
    pub figures: Vec<ReportFigure>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportFinding {
    pub entry: u32,
    pub text: String,
    pub location: Option<ReportLocation>,
    pub stop: Option<u32>,
    pub resolved_by: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportLocation {
    pub repository_key: String,
    pub path: String,
    pub line: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportStop {
    pub index: u32,
    pub title: String,
    pub kind: String,
    pub look: Option<String>,
    pub by: String,
    pub lead: Option<ReportLead>,
    pub blocks: Vec<ReportBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportLead {
    pub entry: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ReportBlock {
    Code(ReportCode),
    Figure(ReportFigure),
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportCode {
    pub repository_key: String,
    pub path: String,
    pub added: u32,
    pub removed: u32,
    pub rows: Vec<ReportRow>,
    pub notes: Vec<ReportNote>,
    pub uncovered: Vec<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ReportRowKind {
    Add,
    Context,
    Removed,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportRow {
    pub kind: ReportRowKind,
    pub old: Option<u32>,
    pub new: Option<u32>,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ReportNoteKind {
    Why,
    Risk,
    Finding,
    Mutant,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportNote {
    pub entry: Option<u32>,
    /// `"1"`, `"2"` … je Code-Block in Zeilenfolge, für Mutanten `"M1"`, `"M2"` …
    pub label: String,
    pub kind: ReportNoteKind,
    pub from: u32,
    pub to: u32,
    pub text: String,
    pub by: String,
    pub open: Option<bool>,
    pub moved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportFigure {
    pub entry: u32,
    pub caption: String,
    pub by: String,
    pub text: Option<String>,
    pub mermaid: Option<String>,
    pub image: Option<ReportImage>,
    pub marks: Vec<ReportMark>,
}

/// Rechteck in Bildpixeln; so auch in `report_entries.marks` und in `ScreenRow` gespeichert.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportMark {
    pub n: u32,
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PhaseChecks {
    pub by: String,
    pub sources: Vec<String>,
    pub chain: Option<CheckRun>,
    pub tests: Option<TestCounts>,
    pub coverage: Option<CoverageCounts>,
    pub mutation: Option<MutationCounts>,
    pub gaps: Vec<CheckGap>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CheckRun {
    pub command: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TestCounts {
    pub passed: u32,
    pub failed: u32,
    pub skipped: u32,
}

/// Nur die neuen Zeilen der Phase.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CoverageCounts {
    pub covered: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MutationCounts {
    pub killed: u32,
    pub survived: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum CheckGapKind {
    Mutant,
    Uncovered,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CheckGap {
    pub kind: CheckGapKind,
    pub repository_key: String,
    pub path: String,
    pub from: u32,
    pub to: u32,
    pub text: String,
}

/// Gesendet als `report://changed`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReportChangedEvent {
    pub implementation_id: String,
    /// Die Phasen der Umsetzung, die Haiku gerade ordnet.
    pub tidying_phase_ids: Vec<String>,
}

/// Ein Bildschirm der Sichtabnahme, als JSON in `report_entries.screen`; der freie Kommentar steht
/// in der Spalte `text`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenRow {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deviation: Option<String>,
    pub shots: Vec<ShotRow>,
    #[serde(default)]
    pub steps: Vec<StepRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShotRow {
    pub label: String,
    #[serde(flatten)]
    pub image: ImageRow,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design: Option<ImageRow>,
    #[serde(default)]
    pub marks: Vec<ReportMark>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepRow {
    pub open: String,
    pub act: String,
    pub expect: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<ImageRow>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<ImageRow>,
}

/// Ein kopiertes Bild: Dateiname im Bericht-Ordner der Phase und Maße in Pixeln.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRow {
    pub file: String,
    pub width: u32,
    pub height: u32,
}
