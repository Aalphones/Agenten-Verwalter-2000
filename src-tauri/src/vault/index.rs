//! Die Index-Datei des Developer Vault (`<Datenordner>\vault\index.db`): eine eigene, wegwerfbare
//! SQLite-Datei mit Dateien, Artefakten und Abschnitten samt FTS5-Index. Sie hat eine eigene
//! Verbindung und nicht `Database`, weil deren `open` die Migrationen der Hauptdatenbank fährt.
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::{Mutex, PoisonError};

use rusqlite::{Connection, OptionalExtension, params};

use crate::error::CommandError;
use crate::vault::library::{self, VaultLayout};

/// Version 2: Arten nach Ort und Erlaubnisliste der Bibliothek; ältere Indizes werden neu gebaut.
const SCHEMA_VERSION: &str = "2";
const META_SCHEMA_VERSION: &str = "schema_version";
const META_VAULT_DIR: &str = "vault_dir";
/// Layout des Ordners beim letzten Abgleich; die Suche leitet daraus Gruppe und Untergruppe ab.
const META_LAYOUT: &str = "layout";

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  size INTEGER NOT NULL,
  modified_ms INTEGER NOT NULL,
  hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  artifact TEXT NOT NULL,
  error TEXT
);
CREATE TABLE IF NOT EXISTS artifacts (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL,
  tags TEXT NOT NULL,
  status TEXT NOT NULL,
  preview TEXT,
  entrypoint TEXT,
  modified_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY,
  file TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  heading TEXT NOT NULL,
  line INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sections_file ON sections(file);
CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
  path, title, tags, heading, text,
  tokenize = 'unicode61 remove_diacritics 2'
);
";

pub struct VaultIndex {
    connection: Mutex<Connection>,
}

/// Eine Zeile aus `files`.
#[derive(Debug, Clone)]
pub struct FileRow {
    pub path: String,
    pub size: i64,
    pub modified_ms: i64,
    pub hash: String,
    pub kind: String,
    pub artifact: String,
    pub error: Option<String>,
}

pub struct SectionInput {
    pub heading: String,
    pub line: u32,
    pub text: String,
}

/// Die Spalten des Artefakts, die in jede FTS-Zeile seiner Abschnitte wandern.
pub struct ArtifactFts<'a> {
    pub title: &'a str,
    pub tags: &'a str,
}

pub struct ArtifactRow {
    pub path: String,
    pub title: String,
    pub description: String,
    pub kind: String,
    pub tags: String,
    pub status: String,
    pub preview: Option<String>,
    pub entrypoint: Option<String>,
    pub modified_ms: i64,
}

pub struct Counts {
    pub files: u32,
    pub artifacts: u32,
    pub skipped: u32,
}

impl VaultIndex {
    /// Öffnet die Index-Datei. Gehört sie zu einem anderen Vault-Ordner oder Schema, oder lässt sie
    /// sich nicht öffnen, wird sie samt `-wal` und `-shm` gelöscht und leer neu angelegt.
    pub fn open(file: &Path, vault_dir: &Path) -> Result<VaultIndex, CommandError> {
        if let Some(parent) = file.parent() {
            fs::create_dir_all(parent)?;
        }
        let dir_text: String = vault_dir.to_string_lossy().into_owned();
        if let Some(connection) = open_matching(file, &dir_text) {
            return Ok(VaultIndex::wrap(connection));
        }
        remove_files(file)?;
        let connection: Connection = open_matching(file, &dir_text).ok_or_else(|| {
            CommandError::Database("Index-Datei lässt sich nicht anlegen".to_owned())
        })?;
        Ok(VaultIndex::wrap(connection))
    }

    fn wrap(connection: Connection) -> VaultIndex {
        VaultIndex {
            connection: Mutex::new(connection),
        }
    }

    pub fn with<R>(
        &self,
        work: impl FnOnce(&mut Connection) -> Result<R, CommandError>,
    ) -> Result<R, CommandError> {
        // Eigene Zeile: im Kopf eines `match` hielte die Sperre bis zu dessen Ende.
        let mut connection = self
            .connection
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        work(&mut connection)
    }
}

/// `None`, wenn die Datei fremd, veraltet oder nicht zu öffnen ist — dann baut der Aufrufer neu.
fn open_matching(file: &Path, vault_dir: &str) -> Option<Connection> {
    let connection: Connection = Connection::open(file).ok()?;
    connection
        .execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
        .ok()?;
    connection.execute_batch(SCHEMA).ok()?;
    let version: Option<String> = read_meta(&connection, META_SCHEMA_VERSION).ok()?;
    let stored_dir: Option<String> = read_meta(&connection, META_VAULT_DIR).ok()?;
    match (version, stored_dir) {
        (None, None) => {
            write_meta(&connection, META_SCHEMA_VERSION, SCHEMA_VERSION).ok()?;
            write_meta(&connection, META_VAULT_DIR, vault_dir).ok()?;
            Some(connection)
        }
        (Some(version), Some(stored_dir))
            if version == SCHEMA_VERSION && stored_dir == vault_dir =>
        {
            Some(connection)
        }
        _ => None,
    }
}

fn remove_files(file: &Path) -> Result<(), CommandError> {
    let base: String = file.to_string_lossy().into_owned();
    for path in [base.clone(), format!("{base}-wal"), format!("{base}-shm")] {
        match fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    Ok(())
}

fn read_meta(connection: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    connection
        .query_row("SELECT value FROM meta WHERE key = ?1", [key], |row| {
            row.get(0)
        })
        .optional()
}

fn write_meta(connection: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn set_layout(connection: &Connection, layout: VaultLayout) -> Result<(), CommandError> {
    write_meta(connection, META_LAYOUT, library::layout_name(layout))?;
    Ok(())
}

/// Das gespeicherte Layout; ohne Eintrag (noch kein Abgleich) ein reiner Vault.
pub fn layout(connection: &Connection) -> Result<VaultLayout, CommandError> {
    let name: Option<String> = read_meta(connection, META_LAYOUT)?;
    Ok(library::layout_from_name(name.as_deref().unwrap_or("")))
}

pub fn file_row(connection: &Connection, path: &str) -> Result<Option<FileRow>, CommandError> {
    let row: Option<FileRow> = connection
        .query_row(
            "SELECT path, size, modified_ms, hash, kind, artifact, error FROM files WHERE path = ?1",
            [path],
            |row| {
                Ok(FileRow {
                    path: row.get(0)?,
                    size: row.get(1)?,
                    modified_ms: row.get(2)?,
                    hash: row.get(3)?,
                    kind: row.get(4)?,
                    artifact: row.get(5)?,
                    error: row.get(6)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

/// Alle Zeilen aus `files`, nach Pfad.
pub fn all_file_rows(connection: &Connection) -> Result<HashMap<String, FileRow>, CommandError> {
    let mut statement = connection
        .prepare("SELECT path, size, modified_ms, hash, kind, artifact, error FROM files")?;
    let rows: Vec<FileRow> = statement
        .query_map([], |row| {
            Ok(FileRow {
                path: row.get(0)?,
                size: row.get(1)?,
                modified_ms: row.get(2)?,
                hash: row.get(3)?,
                kind: row.get(4)?,
                artifact: row.get(5)?,
                error: row.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<FileRow>>>()?;
    Ok(rows
        .into_iter()
        .map(|row: FileRow| (row.path.clone(), row))
        .collect())
}

/// Titel und Tags des gespeicherten Artefakts, wie sie in den FTS-Zeilen stehen.
pub fn artifact_title_tags(
    connection: &Connection,
    path: &str,
) -> Result<Option<(String, String)>, CommandError> {
    let found: Option<(String, String)> = connection
        .query_row(
            "SELECT title, tags FROM artifacts WHERE path = ?1",
            [path],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    Ok(found)
}

/// Eine Zeile je Artefakt für das Prüfprogramm.
pub struct ArtifactSummary {
    pub path: String,
    pub kind: String,
    pub title: String,
    pub tags: String,
    pub files: u32,
    pub sections: u32,
}

pub fn artifact_summaries(connection: &Connection) -> Result<Vec<ArtifactSummary>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT a.path, a.kind, a.title, a.tags,
           (SELECT COUNT(*) FROM files f WHERE f.artifact = a.path),
           (SELECT COUNT(*) FROM sections s WHERE s.file IN
             (SELECT f.path FROM files f WHERE f.artifact = a.path))
         FROM artifacts a ORDER BY a.path",
    )?;
    let summaries: Vec<ArtifactSummary> = statement
        .query_map([], |row| {
            Ok(ArtifactSummary {
                path: row.get(0)?,
                kind: row.get(1)?,
                title: row.get(2)?,
                tags: row.get(3)?,
                files: row.get(4)?,
                sections: row.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<ArtifactSummary>>>()?;
    Ok(summaries)
}

pub fn all_paths(connection: &Connection) -> Result<HashSet<String>, CommandError> {
    let mut statement = connection.prepare("SELECT path FROM files")?;
    let paths: HashSet<String> = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<HashSet<String>>>()?;
    Ok(paths)
}

pub fn put_file(connection: &Connection, row: &FileRow) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO files (path, size, modified_ms, hash, kind, artifact, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(path) DO UPDATE SET size = excluded.size, modified_ms = excluded.modified_ms,
           hash = excluded.hash, kind = excluded.kind, artifact = excluded.artifact,
           error = excluded.error",
        params![
            row.path,
            row.size,
            row.modified_ms,
            row.hash,
            row.kind,
            row.artifact,
            row.error
        ],
    )?;
    Ok(())
}

/// Gleicher Inhalt, nur Größe oder Zeit weichen ab.
pub fn touch_file(
    connection: &Connection,
    path: &str,
    size: i64,
    modified_ms: i64,
) -> Result<(), CommandError> {
    connection.execute(
        "UPDATE files SET size = ?2, modified_ms = ?3 WHERE path = ?1",
        params![path, size, modified_ms],
    )?;
    Ok(())
}

/// Ersetzt alle Abschnitte einer Datei samt ihren FTS-Zeilen (`rowid` = `sections.id`).
pub fn replace_sections(
    connection: &Connection,
    file: &str,
    sections: &[SectionInput],
    artifact: &ArtifactFts,
) -> Result<(), CommandError> {
    delete_sections(connection, file)?;
    for (ordinal, section) in sections.iter().enumerate() {
        connection.execute(
            "INSERT INTO sections (file, ordinal, heading, line, text) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                file,
                ordinal as i64,
                section.heading,
                section.line,
                section.text
            ],
        )?;
        let section_id: i64 = connection.last_insert_rowid();
        connection.execute(
            "INSERT INTO sections_fts (rowid, path, title, tags, heading, text)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                section_id,
                file,
                artifact.title,
                artifact.tags,
                section.heading,
                section.text
            ],
        )?;
    }
    Ok(())
}

fn delete_sections(connection: &Connection, file: &str) -> Result<(), CommandError> {
    connection.execute(
        "DELETE FROM sections_fts WHERE rowid IN (SELECT id FROM sections WHERE file = ?1)",
        [file],
    )?;
    connection.execute("DELETE FROM sections WHERE file = ?1", [file])?;
    Ok(())
}

pub fn delete_file(connection: &Connection, path: &str) -> Result<(), CommandError> {
    delete_sections(connection, path)?;
    connection.execute("DELETE FROM files WHERE path = ?1", [path])?;
    Ok(())
}

pub fn put_artifact(connection: &Connection, row: &ArtifactRow) -> Result<(), CommandError> {
    connection.execute(
        "INSERT INTO artifacts
           (path, title, description, kind, tags, status, preview, entrypoint, modified_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(path) DO UPDATE SET title = excluded.title,
           description = excluded.description, kind = excluded.kind, tags = excluded.tags,
           status = excluded.status, preview = excluded.preview,
           entrypoint = excluded.entrypoint, modified_ms = excluded.modified_ms",
        params![
            row.path,
            row.title,
            row.description,
            row.kind,
            row.tags,
            row.status,
            row.preview,
            row.entrypoint,
            row.modified_ms
        ],
    )?;
    Ok(())
}

/// Entfernt Artefakte, zu denen keine Datei mehr gehört.
pub fn delete_orphan_artifacts(connection: &Connection) -> Result<(), CommandError> {
    connection.execute(
        "DELETE FROM artifacts WHERE path NOT IN (SELECT artifact FROM files)",
        [],
    )?;
    Ok(())
}

pub fn counts(connection: &Connection) -> Result<Counts, CommandError> {
    let files: u32 = connection.query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))?;
    let artifacts: u32 =
        connection.query_row("SELECT COUNT(*) FROM artifacts", [], |row| row.get(0))?;
    let skipped: u32 = connection.query_row(
        "SELECT COUNT(*) FROM files WHERE error IS NOT NULL",
        [],
        |row| row.get(0),
    )?;
    Ok(Counts {
        files,
        artifacts,
        skipped,
    })
}
