//! Der Abgleich: liest den Vault-Ordner und zieht den Index nach — nur geänderte Dateien werden
//! geöffnet. Ohne `AppHandle`, damit das Prüfprogramm `vault-probe` ihn ohne App fahren kann.
use std::fmt::Write as _;
use std::fs;
use std::path::Path;
use std::time::{Instant, UNIX_EPOCH};

use ignore::{DirEntry, WalkBuilder};
use sha2::{Digest, Sha256};

use crate::error::CommandError;
use crate::vault::index::{
    self, ArtifactFts, ArtifactRow, FileRow, SectionInput, VaultIndex, delete_file,
};

/// Größere Dateien werden nicht gelesen; ihr Name bleibt auffindbar.
const MAX_READ_BYTES: u64 = 2 * 1024 * 1024;
/// So viele Zeichen eines Textes kommen vorläufig in den einen Abschnitt.
const MAX_SECTION_CHARS: usize = 4000;
/// Anfang einer Datei, in dem ein NUL-Byte sie als binär ausweist.
const BINARY_PROBE_BYTES: usize = 8 * 1024;
const IGNORE_FILE: &str = ".vaultignore";
const INBOX_PREFIX: &str = "inbox/";
const KIND_TEXT: &str = "text";
const KIND_BINARY: &str = "binary";
const STATUS_INBOX: &str = "inbox";

#[derive(Debug, Default, Clone, Copy)]
pub struct ScanReport {
    pub seen: u32,
    pub read: u32,
    pub removed: u32,
    pub skipped: u32,
    pub duration_ms: u64,
}

struct Entry {
    rel: String,
    size: i64,
    modified_ms: i64,
}

/// Gleicht den Index mit dem Ordner ab. Je Datei eine eigene Transaktion; eine nicht lesbare
/// Datei wird als übersprungen vermerkt und bricht den Lauf nicht ab.
pub fn run(root: &Path, index: &VaultIndex) -> Result<ScanReport, CommandError> {
    let started: Instant = Instant::now();
    let mut report = ScanReport::default();
    let entries: Vec<Entry> = walk(root, &mut report);
    report.seen = entries.len() as u32;
    for entry in &entries {
        if sync_file(root, index, entry)? == Outcome::Read {
            report.read += 1;
        }
    }
    report.skipped += index.with(|connection| Ok(index::counts(connection)?.skipped))?;
    report.removed = remove_vanished(index, &entries)?;
    index.with(|connection| index::delete_orphan_artifacts(connection))?;
    report.duration_ms = started.elapsed().as_millis() as u64;
    Ok(report)
}

#[derive(PartialEq, Eq)]
enum Outcome {
    Unchanged,
    Read,
}

fn walk(root: &Path, report: &mut ScanReport) -> Vec<Entry> {
    let walker = WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .git_exclude(true)
        .git_global(false)
        .parents(true)
        .require_git(false)
        .follow_links(false)
        .add_custom_ignore_filename(IGNORE_FILE)
        .build();
    let mut entries: Vec<Entry> = Vec::new();
    for item in walker {
        let Ok(found) = item else {
            report.skipped += 1;
            continue;
        };
        if !found.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }
        if let Some(entry) = entry_of(root, &found) {
            entries.push(entry);
        }
    }
    entries
}

fn entry_of(root: &Path, found: &DirEntry) -> Option<Entry> {
    let metadata = found.metadata().ok()?;
    let modified = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?;
    let relative = found.path().strip_prefix(root).ok()?;
    let parts: Vec<String> = relative
        .components()
        .map(|part| part.as_os_str().to_string_lossy().into_owned())
        .collect();
    Some(Entry {
        rel: parts.join("/"),
        size: metadata.len() as i64,
        modified_ms: modified.as_millis() as i64,
    })
}

/// Vergleicht eine Datei mit dem gespeicherten Stand und zieht den Index nach.
fn sync_file(root: &Path, index: &VaultIndex, entry: &Entry) -> Result<Outcome, CommandError> {
    let stored: Option<FileRow> =
        index.with(|connection| index::file_row(connection, &entry.rel))?;
    if let Some(row) = &stored {
        let is_unchanged: bool =
            row.error.is_none() && row.size == entry.size && row.modified_ms == entry.modified_ms;
        if is_unchanged {
            return Ok(Outcome::Unchanged);
        }
    }
    let loaded: Result<Loaded, String> = load(&root.join(native(&entry.rel)), entry.size);
    match loaded {
        Err(message) => store_failure(index, entry, message)?,
        Ok(loaded) => store_loaded(index, entry, stored.as_ref(), loaded)?,
    }
    Ok(Outcome::Read)
}

struct Loaded {
    hash: String,
    /// `None`, wenn die Datei zu groß war und nicht gelesen wurde.
    bytes: Option<Vec<u8>>,
}

fn load(path: &Path, size: i64) -> Result<Loaded, String> {
    if size as u64 > MAX_READ_BYTES {
        return Ok(Loaded {
            hash: String::new(),
            bytes: None,
        });
    }
    let bytes: Vec<u8> = fs::read(path).map_err(|error| error.to_string())?;
    let mut text = String::with_capacity(64);
    for byte in Sha256::digest(&bytes) {
        // Schreiben in einen `String` schlägt nicht fehl.
        let _ = write!(text, "{byte:02x}");
    }
    Ok(Loaded {
        hash: text,
        bytes: Some(bytes),
    })
}

fn store_failure(index: &VaultIndex, entry: &Entry, message: String) -> Result<(), CommandError> {
    index.with(|connection| {
        let transaction = connection.transaction()?;
        let artifact: ArtifactFts = ArtifactFts {
            title: "",
            tags: "",
        };
        index::replace_sections(&transaction, &entry.rel, &[], &artifact)?;
        index::put_file(
            &transaction,
            &FileRow {
                path: entry.rel.clone(),
                size: entry.size,
                modified_ms: entry.modified_ms,
                hash: String::new(),
                kind: KIND_BINARY.to_owned(),
                artifact: entry.rel.clone(),
                error: Some(message),
            },
        )?;
        transaction.commit()?;
        Ok(())
    })
}

fn store_loaded(
    index: &VaultIndex,
    entry: &Entry,
    stored: Option<&FileRow>,
    loaded: Loaded,
) -> Result<(), CommandError> {
    let has_same_content: bool = stored.is_some_and(|row| {
        row.error.is_none() && !loaded.hash.is_empty() && row.hash == loaded.hash
    });
    if has_same_content {
        return index.with(|connection| {
            index::touch_file(connection, &entry.rel, entry.size, entry.modified_ms)
        });
    }
    let text: Option<String> = loaded.bytes.as_deref().and_then(text_of);
    let kind: &str = if text.is_some() {
        KIND_TEXT
    } else {
        KIND_BINARY
    };
    let title: String = file_title(&entry.rel);
    let status: &str = if entry.rel.starts_with(INBOX_PREFIX) {
        STATUS_INBOX
    } else {
        ""
    };
    let section_text: String = match &text {
        Some(text) => text.chars().take(MAX_SECTION_CHARS).collect(),
        None => file_name(&entry.rel),
    };
    index.with(|connection| {
        let transaction = connection.transaction()?;
        let artifact: ArtifactFts = ArtifactFts {
            title: &title,
            tags: "",
        };
        index::replace_sections(
            &transaction,
            &entry.rel,
            &[SectionInput {
                heading: String::new(),
                line: 1,
                text: section_text,
            }],
            &artifact,
        )?;
        index::put_file(
            &transaction,
            &FileRow {
                path: entry.rel.clone(),
                size: entry.size,
                modified_ms: entry.modified_ms,
                hash: loaded.hash,
                kind: kind.to_owned(),
                artifact: entry.rel.clone(),
                error: None,
            },
        )?;
        index::put_artifact(
            &transaction,
            &ArtifactRow {
                path: entry.rel.clone(),
                title,
                description: String::new(),
                kind: kind.to_owned(),
                tags: String::new(),
                status: status.to_owned(),
                preview: None,
                entrypoint: None,
                modified_ms: entry.modified_ms,
            },
        )?;
        transaction.commit()?;
        Ok(())
    })
}

/// Der Text einer Datei, wenn sie UTF-8 ist und im Anfang kein NUL-Byte trägt.
fn text_of(bytes: &[u8]) -> Option<String> {
    let head: &[u8] = &bytes[..bytes.len().min(BINARY_PROBE_BYTES)];
    if head.contains(&0) {
        return None;
    }
    String::from_utf8(bytes.to_vec()).ok()
}

/// Löscht Dateien, die der Durchlauf nicht mehr gesehen hat; gibt ihre Zahl zurück.
fn remove_vanished(index: &VaultIndex, entries: &[Entry]) -> Result<u32, CommandError> {
    let seen: std::collections::HashSet<&str> = entries
        .iter()
        .map(|entry: &Entry| entry.rel.as_str())
        .collect();
    let stored = index.with(|connection| index::all_paths(connection))?;
    let mut removed: u32 = 0;
    for path in stored
        .iter()
        .filter(|path: &&String| !seen.contains(path.as_str()))
    {
        index.with(|connection| {
            let transaction = connection.transaction()?;
            delete_file(&transaction, path)?;
            transaction.commit()?;
            Ok(())
        })?;
        removed += 1;
    }
    Ok(removed)
}

fn file_name(rel: &str) -> String {
    rel.rsplit('/').next().unwrap_or(rel).to_owned()
}

fn file_title(rel: &str) -> String {
    let name: String = file_name(rel);
    match name.rsplit_once('.') {
        Some((stem, _)) if !stem.is_empty() => stem.to_owned(),
        _ => name,
    }
}

/// Pfad mit `/` zum Dateisystempfad (siehe `filesystem::native_path`).
fn native(rel: &str) -> std::path::PathBuf {
    crate::filesystem::native_path(rel)
}
