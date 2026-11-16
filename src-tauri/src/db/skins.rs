//! Tabelle `skin_packs`: ein Paket je Zeile, `data` ist der Inhalt des Pakets als JSON. Was die
//! Daten bedeuten und prüfen, weiß `crate::skins`.
use rusqlite::{Connection, OptionalExtension, Row, params};

use crate::error::CommandError;

pub struct SkinRow {
    pub id: String,
    /// `figures` oder `style`.
    pub kind: String,
    pub name: String,
    pub data: String,
    pub changed_at: String,
    pub changed_by: Option<String>,
    pub deleted_at: Option<String>,
}

const COLUMNS: &str = "id, kind, name, data, changed_at, changed_by, deleted_at";

fn read(row: &Row<'_>) -> rusqlite::Result<SkinRow> {
    Ok(SkinRow {
        id: row.get(0)?,
        kind: row.get(1)?,
        name: row.get(2)?,
        data: row.get(3)?,
        changed_at: row.get(4)?,
        changed_by: row.get(5)?,
        deleted_at: row.get(6)?,
    })
}

/// Alle nicht gelöschten Pakete nach Name.
pub fn list(connection: &Connection) -> Result<Vec<SkinRow>, CommandError> {
    let mut statement = connection.prepare(&format!(
        "SELECT {COLUMNS} FROM skin_packs WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id"
    ))?;
    let rows: Vec<SkinRow> = statement
        .query_map([], read)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

/// Auch ein gelöschtes Paket (`deleted_at` gesetzt), damit „Rückgängig“ es findet.
pub fn get(connection: &Connection, id: &str) -> Result<Option<SkinRow>, CommandError> {
    let row: Option<SkinRow> = connection
        .query_row(
            &format!("SELECT {COLUMNS} FROM skin_packs WHERE id = ?1"),
            params![id],
            read,
        )
        .optional()?;
    Ok(row)
}

/// Die Art eines nicht gelöschten Pakets; `None`, wenn es fehlt oder gelöscht ist.
pub fn kind_of(connection: &Connection, id: &str) -> Result<Option<String>, CommandError> {
    let kind: Option<String> = connection
        .query_row(
            "SELECT kind FROM skin_packs WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    Ok(kind)
}

pub fn insert(connection: &Connection, row: &SkinRow) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO skin_packs (id, kind, name, data, changed_at, changed_by, deleted_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)",
        params![
            row.id,
            row.kind,
            row.name,
            row.data,
            row.changed_at,
            row.changed_by
        ],
    )?;
    Ok(())
}

pub fn update_data(
    connection: &Connection,
    id: &str,
    data: &str,
    changed_at: &str,
    changed_by: Option<&str>,
) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE skin_packs SET data = ?2, changed_at = ?3, changed_by = ?4 WHERE id = ?1",
        params![id, data, changed_at, changed_by],
    )?;
    Ok(())
}

pub fn rename(
    connection: &Connection,
    id: &str,
    name: &str,
    changed_at: &str,
    changed_by: Option<&str>,
) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE skin_packs SET name = ?2, changed_at = ?3, changed_by = ?4 WHERE id = ?1",
        params![id, name, changed_at, changed_by],
    )?;
    Ok(())
}

/// `Some(Zeitpunkt)` löscht weich, `None` hebt es auf.
pub fn set_deleted(
    connection: &Connection,
    id: &str,
    deleted_at: Option<&str>,
) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE skin_packs SET deleted_at = ?2 WHERE id = ?1",
        params![id, deleted_at],
    )?;
    Ok(())
}

/// Entfernt die Pakete, die vor `before` gelöscht wurden, und nennt ihre IDs. Beide Zeitpunkte
/// sind RFC-3339 in UTC mit gleicher Länge und deshalb als Text vergleichbar.
pub fn purge_deleted(connection: &Connection, before: &str) -> Result<Vec<String>, CommandError> {
    let mut statement = connection.prepare(
        "DELETE FROM skin_packs WHERE deleted_at IS NOT NULL AND deleted_at < ?1 RETURNING id",
    )?;
    let ids: Vec<String> = statement
        .query_map(params![before], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(ids)
}

/// Werkzeugname, Anfang der Eingabe und Anzahl der Aufrufe in Sessions, die seit `since_ms`
/// aktiv waren; die 30 häufigsten Paare. `payload` ist der Chat-Eintrag als JSON
/// (`kind` = `tool`, Felder `tool` und `target`).
pub fn tool_usage(
    connection: &Connection,
    since_ms: f64,
) -> Result<Vec<(String, String, u32)>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT json_extract(c.payload, '$.tool') AS tool, \
                substr(coalesce(json_extract(c.payload, '$.target'), ''), 1, 40) AS head, \
                count(*) AS n \
         FROM chat_entries c JOIN sessions s ON s.id = c.session_id \
         WHERE json_extract(c.payload, '$.kind') = 'tool' AND s.last_activity_at >= ?1 \
         GROUP BY tool, head ORDER BY n DESC LIMIT 30",
    )?;
    let rows: Vec<(String, String, u32)> = statement
        .query_map(params![since_ms], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}
