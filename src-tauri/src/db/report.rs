//! Tabelle `report_entries`: eine Zeile je Eintrag eines Review-Berichts (ADR 073).
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::db::{enum_from_text, enum_to_text};
use crate::error::CommandError;
use crate::report::model::{ReportMark, ReportNoteKind, ScreenRow};

/// Das Werkzeug, das den Eintrag angelegt hat.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EntryTool {
    Note,
    Figure,
    Screen,
}

/// Ein neuer Eintrag; ID und Nummer vergibt `insert_entry`.
#[derive(Debug, Clone)]
pub struct NewEntry {
    pub implementation_id: String,
    pub phase_id: String,
    pub station_id: String,
    pub session_id: String,
    pub tool: EntryTool,
    pub note_kind: Option<ReportNoteKind>,
    pub resolves: Option<u32>,
    pub text: String,
    pub caption: Option<String>,
    pub mermaid: Option<String>,
    pub image_file: Option<String>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
    pub marks: Vec<ReportMark>,
    pub screen: Option<ScreenRow>,
    pub repository_key: Option<String>,
    pub path: Option<String>,
    pub line_from: Option<u32>,
    pub line_to: Option<u32>,
    pub anchor_text: Option<String>,
    pub created_at: f64,
}

/// Eine gespeicherte Zeile mit allen Spalten.
#[derive(Debug, Clone)]
pub struct EntryRow {
    pub id: i64,
    pub implementation_id: String,
    pub phase_id: String,
    pub station_id: String,
    pub session_id: String,
    pub number: u32,
    pub tool: EntryTool,
    pub note_kind: Option<ReportNoteKind>,
    pub resolves: Option<u32>,
    pub text: String,
    pub caption: Option<String>,
    pub mermaid: Option<String>,
    pub image_file: Option<String>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
    pub marks: Vec<ReportMark>,
    pub screen: Option<ScreenRow>,
    pub repository_key: Option<String>,
    pub path: Option<String>,
    pub line_from: Option<u32>,
    pub line_to: Option<u32>,
    pub anchor_text: Option<String>,
    pub created_at: f64,
}

/// Vergibt die nächste Nummer der Phase und legt den Eintrag in derselben Transaktion an.
/// `name_files` läuft dazwischen mit der Nummer: dort bekommen Bilder ihre Namen. Scheitert er,
/// entsteht keine Zeile und die Nummer bleibt frei.
pub fn insert_entry(
    connection: &mut Connection,
    mut entry: NewEntry,
    name_files: impl FnOnce(u32, &mut NewEntry) -> Result<(), CommandError>,
) -> Result<u32, CommandError> {
    let transaction = connection.transaction()?;
    let number: u32 = transaction.query_row(
        "SELECT COALESCE(MAX(number), 0) + 1 FROM report_entries WHERE phase_id = ?1",
        params![entry.phase_id],
        |row| row.get(0),
    )?;
    name_files(number, &mut entry)?;
    let note_kind: Option<String> = entry.note_kind.as_ref().map(enum_to_text).transpose()?;
    let marks: Option<String> = if entry.marks.is_empty() {
        None
    } else {
        Some(to_json(&entry.marks)?)
    };
    let screen: Option<String> = entry.screen.as_ref().map(to_json).transpose()?;
    transaction.execute(
        "INSERT INTO report_entries (implementation_id, phase_id, station_id, session_id, number, \
         tool, note_kind, resolves, text, caption, mermaid, image_file, image_width, \
         image_height, marks, screen, repository_key, path, line_from, line_to, anchor_text, \
         created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, \
         ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
        params![
            entry.implementation_id,
            entry.phase_id,
            entry.station_id,
            entry.session_id,
            number,
            enum_to_text(&entry.tool)?,
            note_kind,
            entry.resolves,
            entry.text,
            entry.caption,
            entry.mermaid,
            entry.image_file,
            entry.image_width,
            entry.image_height,
            marks,
            screen,
            entry.repository_key,
            entry.path,
            entry.line_from,
            entry.line_to,
            entry.anchor_text,
            entry.created_at,
        ],
    )?;
    transaction.commit()?;
    Ok(number)
}

/// Alle Einträge einer Umsetzung, sortiert nach Phase (Plan-Reihenfolge) und Nummer.
pub fn load_entries(
    connection: &Connection,
    implementation_id: &str,
) -> Result<Vec<EntryRow>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT e.id, e.implementation_id, e.phase_id, e.station_id, e.session_id, e.number, \
         e.tool, e.note_kind, e.resolves, e.text, e.caption, e.mermaid, e.image_file, \
         e.image_width, e.image_height, e.marks, e.screen, e.repository_key, e.path, \
         e.line_from, e.line_to, e.anchor_text, e.created_at \
         FROM report_entries e JOIN implementation_phases p ON p.id = e.phase_id \
         WHERE e.implementation_id = ?1 ORDER BY p.position, e.number",
    )?;
    let mut rows = statement.query(params![implementation_id])?;
    let mut entries: Vec<EntryRow> = Vec::new();
    while let Some(row) = rows.next()? {
        entries.push(entry_of(row)?);
    }
    Ok(entries)
}

/// Ob die Nummer in dieser Phase ein Befund ist.
pub fn is_finding(
    connection: &Connection,
    phase_id: &str,
    number: u32,
) -> Result<bool, CommandError> {
    let kind: Option<Option<String>> = connection
        .query_row(
            "SELECT note_kind FROM report_entries WHERE phase_id = ?1 AND number = ?2",
            params![phase_id, number],
            |row| row.get(0),
        )
        .optional()?;
    let finding: String = enum_to_text(&ReportNoteKind::Finding)?;
    Ok(kind.flatten().is_some_and(|kind: String| kind == finding))
}

fn entry_of(row: &Row<'_>) -> Result<EntryRow, CommandError> {
    let tool: String = row.get(6)?;
    let note_kind: Option<String> = row.get(7)?;
    let marks: Option<String> = row.get(15)?;
    let screen: Option<String> = row.get(16)?;
    Ok(EntryRow {
        id: row.get(0)?,
        implementation_id: row.get(1)?,
        phase_id: row.get(2)?,
        station_id: row.get(3)?,
        session_id: row.get(4)?,
        number: row.get(5)?,
        tool: enum_from_text(&tool)?,
        note_kind: note_kind
            .as_deref()
            .map(enum_from_text::<ReportNoteKind>)
            .transpose()?,
        resolves: row.get(8)?,
        text: row.get(9)?,
        caption: row.get(10)?,
        mermaid: row.get(11)?,
        image_file: row.get(12)?,
        image_width: row.get(13)?,
        image_height: row.get(14)?,
        marks: marks
            .as_deref()
            .map(from_json::<Vec<ReportMark>>)
            .transpose()?
            .unwrap_or_default(),
        screen: screen.as_deref().map(from_json::<ScreenRow>).transpose()?,
        repository_key: row.get(17)?,
        path: row.get(18)?,
        line_from: row.get(19)?,
        line_to: row.get(20)?,
        anchor_text: row.get(21)?,
        created_at: row.get(22)?,
    })
}

fn to_json<T: Serialize>(value: &T) -> Result<String, CommandError> {
    serde_json::to_string(value).map_err(|error| CommandError::Database(error.to_string()))
}

fn from_json<T: DeserializeOwned>(text: &str) -> Result<T, CommandError> {
    serde_json::from_str(text).map_err(|error| CommandError::Database(error.to_string()))
}
