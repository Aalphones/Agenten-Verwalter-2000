//! Suche im Developer Vault (ADR 068): ein Kern für das Werkzeug `vault_search`, den Suchdialog und
//! den Stationsauftrag. Der Kern `search_index` kennt nur die Index-Datei; `search` legt Status
//! und Frische des Index darum.
use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, params_from_iter};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use ts_rs::TS;

use super::index::{self, VaultIndex};
use super::library::{self, Place, VaultLayout};
use super::model::{VaultState, VaultStatus};
use crate::error::CommandError;

pub const NOT_SET_UP: &str = "Der Developer Vault ist nicht eingerichtet.";
/// Anfang und Ende einer Fundstelle im Ausschnitt (Zeichen aus dem Bereich für private Nutzung).
pub const MARK_START: char = '\u{E000}';
pub const MARK_END: char = '\u{E001}';

/// Gewichte der FTS-Spalten: Pfad, Titel, Tags, Überschrift, Text.
const RANK: &str = "bm25(sections_fts, 2.0, 5.0, 4.0, 3.0, 1.0)";
const SNIPPET: &str = "snippet(sections_fts, 4, char(57344), char(57345), '…', 16)";
const MAX_LIMIT: u32 = 50;

#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VaultQuery {
    pub text: String,
    pub kind: Option<String>,
    pub tags: Vec<String>,
    /// Pfad-Präfix relativ zum Vault.
    pub under: Option<String>,
    pub limit: u32,
    /// Ein Begriff genügt (ODER statt UND).
    pub any_term: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VaultHit {
    /// Pfad des Artefakts.
    pub path: String,
    /// Datei des besten Abschnitts.
    pub file: String,
    pub kind: String,
    pub title: String,
    pub description: String,
    pub heading: String,
    pub line: u32,
    /// Fundstellen zwischen `\u{E000}` und `\u{E001}`.
    pub snippet: String,
    pub status: String,
    pub preview: Option<String>,
    /// Gruppe nach dem Ort: `anweisungen`, `skills` oder `wissen`.
    pub group: String,
    /// Untergruppe innerhalb der Gruppe, z. B. `arbeitsweise` oder ein Ordner im Wissen; leer für
    /// den Hauptordner des Wissens.
    pub subgroup: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VaultSearchResult {
    pub hits: Vec<VaultHit>,
    /// Zahl der verschiedenen passenden Artefakte, unabhängig vom Limit.
    pub total: u32,
    pub is_scanning: bool,
    pub scanned_at: Option<i64>,
}

/// Sucht im Vault der App: zieht den Index bei Bedarf nach (ohne zu warten) und meldet, ob noch
/// ein Abgleich läuft.
pub fn search(app: &AppHandle, query: &VaultQuery) -> Result<VaultSearchResult, CommandError> {
    let status: VaultStatus = super::status(app);
    ensure_usable(&status)?;
    super::ensure_fresh(app);
    let index = super::index(app)?;
    let (hits, total): (Vec<VaultHit>, u32) = search_index(&index, query)?;
    let after: VaultStatus = super::status(app);
    Ok(VaultSearchResult {
        hits,
        total,
        is_scanning: after.state == VaultState::Scanning,
        scanned_at: after.scanned_at,
    })
}

/// Fehlersatz, wenn der Vault nicht durchsucht werden kann.
pub fn ensure_usable(status: &VaultStatus) -> Result<(), CommandError> {
    match status.state {
        VaultState::Off => Err(CommandError::Internal(NOT_SET_UP.to_owned())),
        VaultState::Missing | VaultState::Error => Err(CommandError::Internal(
            status
                .message
                .clone()
                .unwrap_or_else(|| NOT_SET_UP.to_owned()),
        )),
        VaultState::Scanning | VaultState::Ready => Ok(()),
    }
}

/// Der Kern ohne `AppHandle`: Treffer (je Artefakt der beste Abschnitt) und Gesamtzahl.
pub fn search_index(
    index: &VaultIndex,
    query: &VaultQuery,
) -> Result<(Vec<VaultHit>, u32), CommandError> {
    index.with(|connection: &mut Connection| search_connection(connection, query))
}

/// Wie `search_index`, auf einer schon offenen Verbindung (das Prüfprogramm öffnet schreibgeschützt).
pub fn search_connection(
    connection: &Connection,
    query: &VaultQuery,
) -> Result<(Vec<VaultHit>, u32), CommandError> {
    let (mut hits, total): (Vec<VaultHit>, u32) = find_hits(connection, query)?;
    let layout: VaultLayout = index::layout(connection)?;
    for hit in &mut hits {
        let Place { group, subgroup } = library::place(layout, &hit.path);
        hit.group = group.to_owned();
        hit.subgroup = subgroup;
    }
    Ok((hits, total))
}

fn find_hits(
    connection: &Connection,
    query: &VaultQuery,
) -> Result<(Vec<VaultHit>, u32), CommandError> {
    let limit: usize = usize::try_from(query.limit.clamp(1, MAX_LIMIT)).unwrap_or(1);
    let terms: Vec<String> = terms_of(&query.text);
    if terms.is_empty() {
        return list_recent(connection, query, limit);
    }
    let (hits, total): (Vec<VaultHit>, u32) = run_fts(
        connection,
        query,
        &match_expression(&terms, query.any_term),
        limit,
    )?;
    if total == 0 && !query.any_term && terms.len() >= 2 {
        return run_fts(connection, query, &match_expression(&terms, true), limit);
    }
    Ok((hits, total))
}

/// Folgen von Buchstaben und Ziffern, klein geschrieben.
fn terms_of(text: &str) -> Vec<String> {
    text.split(|character: char| !character.is_alphanumeric())
        .filter(|part: &&str| !part.is_empty())
        .map(str::to_lowercase)
        .collect()
}

fn match_expression(terms: &[String], any_term: bool) -> String {
    let joiner: &str = if any_term { " OR " } else { " AND " };
    terms
        .iter()
        .map(|term: &String| format!("\"{term}\"*"))
        .collect::<Vec<String>>()
        .join(joiner)
}

/// Filter über `artifacts` (Alias `a`) als SQL-Stück mit Parametern.
fn filters(query: &VaultQuery) -> (String, Vec<SqlValue>) {
    let mut sql = String::new();
    let mut params: Vec<SqlValue> = Vec::new();
    if let Some(kind) = query.kind.as_deref().filter(|text: &&str| !text.is_empty()) {
        sql.push_str(" AND a.kind = ?");
        params.push(SqlValue::Text(kind.to_owned()));
    }
    for tag in &query.tags {
        let tag: String = tag.trim().to_lowercase();
        if tag.is_empty() {
            continue;
        }
        sql.push_str(" AND (' ' || a.tags || ' ') LIKE ? ESCAPE '\\'");
        params.push(SqlValue::Text(format!("% {} %", escape_like(&tag))));
    }
    let under: &str = query.under.as_deref().unwrap_or("").trim_matches('/');
    if !under.is_empty() {
        sql.push_str(" AND (a.path = ? OR a.path LIKE ? ESCAPE '\\')");
        params.push(SqlValue::Text(under.to_owned()));
        params.push(SqlValue::Text(format!("{}/%", escape_like(under))));
    }
    (sql, params)
}

/// `%`, `_` und den Maskierer selbst unschädlich machen.
pub fn escape_like(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for character in text.chars() {
        if matches!(character, '%' | '_' | '\\') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}

fn run_fts(
    connection: &Connection,
    query: &VaultQuery,
    expression: &str,
    limit: usize,
) -> Result<(Vec<VaultHit>, u32), CommandError> {
    let (filter_sql, filter_params): (String, Vec<SqlValue>) = filters(query);
    let from = "FROM sections_fts
         JOIN sections s ON s.id = sections_fts.rowid
         JOIN files f ON f.path = s.file
         JOIN artifacts a ON a.path = f.artifact
         WHERE sections_fts MATCH ?";
    let mut params: Vec<SqlValue> = vec![SqlValue::Text(expression.to_owned())];
    params.extend(filter_params);

    let total: u32 = connection.query_row(
        &format!("SELECT COUNT(DISTINCT a.path) {from}{filter_sql}"),
        params_from_iter(params.iter()),
        |row| row.get(0),
    )?;

    let sql: String = format!(
        "SELECT a.path, s.file, a.kind, a.title, a.description, s.heading, s.line, {SNIPPET},
                a.status, a.preview {from}{filter_sql} ORDER BY {RANK}"
    );
    let mut statement = connection.prepare(&sql)?;
    let mut rows = statement.query(params_from_iter(params.iter()))?;
    let mut hits: Vec<VaultHit> = Vec::new();
    while let Some(row) = rows.next()? {
        let path: String = row.get(0)?;
        if hits.iter().any(|hit: &VaultHit| hit.path == path) {
            continue;
        }
        hits.push(VaultHit {
            path,
            file: row.get(1)?,
            kind: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            heading: row.get(5)?,
            line: row.get(6)?,
            snippet: row.get(7)?,
            status: row.get(8)?,
            preview: row.get(9)?,
            group: String::new(),
            subgroup: String::new(),
        });
        if hits.len() >= limit {
            break;
        }
    }
    Ok((hits, total))
}

/// Ohne Suchtext: Artefakte nach den Filtern, die zuletzt geänderten zuerst.
fn list_recent(
    connection: &Connection,
    query: &VaultQuery,
    limit: usize,
) -> Result<(Vec<VaultHit>, u32), CommandError> {
    let (filter_sql, params): (String, Vec<SqlValue>) = filters(query);
    let total: u32 = connection.query_row(
        &format!("SELECT COUNT(*) FROM artifacts a WHERE 1 = 1{filter_sql}"),
        params_from_iter(params.iter()),
        |row| row.get(0),
    )?;
    let sql: String = format!(
        "SELECT a.path, COALESCE(a.entrypoint, a.path), a.kind, a.title, a.description,
                a.status, a.preview
         FROM artifacts a WHERE 1 = 1{filter_sql} ORDER BY a.modified_ms DESC, a.path LIMIT {limit}"
    );
    let mut statement = connection.prepare(&sql)?;
    let hits: Vec<VaultHit> = statement
        .query_map(params_from_iter(params.iter()), |row| {
            Ok(VaultHit {
                path: row.get(0)?,
                file: row.get(1)?,
                kind: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                heading: String::new(),
                line: 1,
                snippet: String::new(),
                status: row.get(5)?,
                preview: row.get(6)?,
                group: String::new(),
                subgroup: String::new(),
            })
        })?
        .collect::<rusqlite::Result<Vec<VaultHit>>>()?;
    Ok((hits, total))
}
