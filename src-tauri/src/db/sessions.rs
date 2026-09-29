//! Tabelle `sessions`: ein Zeile je Session mit allem, was ein Neustart wiederherstellen muss.
use rusqlite::{Connection, Row, params};

use crate::agents::event::{Effort, Mode, ModelId};
use crate::db::{enum_from_text, enum_to_text};
use crate::error::CommandError;
use crate::sessions::model::SessionStatus;

#[derive(Debug, Clone)]
pub struct SessionRow {
    pub id: String,
    pub name: String,
    pub status: SessionStatus,
    pub model: ModelId,
    pub effort: Effort,
    pub mode: Mode,
    pub created_at: f64,
    pub running_ms: f64,
    pub context_used: u32,
    pub context_window: u32,
    /// `system/init` wurde mindestens einmal gesehen — erst dann kennt Claude die Session (`--resume`).
    pub has_agent_history: bool,
    /// Arbeitsordner der Session; `None` bei Sessions von vor Meilenstein 3 (`workspaces\<id>`).
    pub workspace_dir: Option<String>,
}

/// Die Zeile, wie sie in der Datenbank steht; die Enum-Texte werden erst danach umgewandelt,
/// weil ein Fehler dabei kein `rusqlite`-Fehler ist.
struct StoredRow {
    id: String,
    name: String,
    status: String,
    model: String,
    effort: String,
    mode: String,
    created_at: f64,
    running_ms: f64,
    context_used: u32,
    context_window: u32,
    has_agent_history: bool,
    workspace_dir: Option<String>,
}

impl StoredRow {
    fn read(row: &Row<'_>) -> rusqlite::Result<StoredRow> {
        Ok(StoredRow {
            id: row.get(0)?,
            name: row.get(1)?,
            status: row.get(2)?,
            model: row.get(3)?,
            effort: row.get(4)?,
            mode: row.get(5)?,
            created_at: row.get(6)?,
            running_ms: row.get(7)?,
            context_used: row.get(8)?,
            context_window: row.get(9)?,
            has_agent_history: row.get(10)?,
            workspace_dir: row.get(11)?,
        })
    }

    fn into_row(self) -> Result<SessionRow, CommandError> {
        Ok(SessionRow {
            status: enum_from_text(&self.status)?,
            model: enum_from_text(&self.model)?,
            effort: enum_from_text(&self.effort)?,
            mode: enum_from_text(&self.mode)?,
            id: self.id,
            name: self.name,
            created_at: self.created_at,
            running_ms: self.running_ms,
            context_used: self.context_used,
            context_window: self.context_window,
            has_agent_history: self.has_agent_history,
            workspace_dir: self.workspace_dir,
        })
    }
}

/// Legt die Zeile an oder aktualisiert sie. `created_at`, `workspace_dir` und `archived_at`
/// bleiben, wie sie sind: der Arbeitsordner einer Session ändert sich nie.
pub fn upsert(connection: &Connection, row: &SessionRow) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO sessions (id, name, status, model, effort, mode, created_at, running_ms, \
             context_used, context_window, has_agent_history, workspace_dir) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) \
         ON CONFLICT(id) DO UPDATE SET \
             name = excluded.name, \
             status = excluded.status, \
             model = excluded.model, \
             effort = excluded.effort, \
             mode = excluded.mode, \
             running_ms = excluded.running_ms, \
             context_used = excluded.context_used, \
             context_window = excluded.context_window, \
             has_agent_history = excluded.has_agent_history",
        params![
            row.id,
            row.name,
            enum_to_text(&row.status)?,
            enum_to_text(&row.model)?,
            enum_to_text(&row.effort)?,
            enum_to_text(&row.mode)?,
            row.created_at,
            row.running_ms,
            row.context_used,
            row.context_window,
            row.has_agent_history,
            row.workspace_dir,
        ],
    )?;
    Ok(())
}

/// Alle nicht archivierten Sessions, neueste zuerst.
pub fn load_active(connection: &Connection) -> Result<Vec<SessionRow>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT id, name, status, model, effort, mode, created_at, running_ms, \
             context_used, context_window, has_agent_history, workspace_dir \
         FROM sessions WHERE archived_at IS NULL ORDER BY created_at DESC",
    )?;
    let stored: Vec<StoredRow> = statement
        .query_map([], StoredRow::read)?
        .collect::<rusqlite::Result<_>>()?;
    stored.into_iter().map(StoredRow::into_row).collect()
}

pub fn archive(connection: &Connection, id: &str, archived_at: f64) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE sessions SET archived_at = ?2 WHERE id = ?1",
        params![id, archived_at],
    )?;
    Ok(())
}

/// Löscht die Zeile samt ihrer Chat-Einträge (`ON DELETE CASCADE`).
pub fn delete(connection: &Connection, id: &str) -> Result<(), CommandError> {
    connection.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
    Ok(())
}
