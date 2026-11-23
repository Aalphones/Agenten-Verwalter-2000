//! Der Abgleich: liest den Vault-Ordner und zieht den Index nach — nur geänderte Dateien werden
//! geöffnet. Ohne `AppHandle`, damit das Prüfprogramm `vault-probe` ihn ohne App fahren kann.
use std::collections::{HashMap, HashSet};
use std::fmt::Write as _;
use std::fs;
use std::path::Path;
use std::time::{Instant, UNIX_EPOCH};

use ignore::{DirEntry, WalkBuilder};
use sha2::{Digest, Sha256};

use crate::error::CommandError;
use crate::vault::extract::{self, FileKind, SectionInput};
use crate::vault::index::{self, ArtifactFts, ArtifactRow, FileRow, VaultIndex, delete_file};
use crate::vault::meta::Meta;

/// Größere Dateien werden nicht gelesen; ihr Name bleibt auffindbar.
const MAX_READ_BYTES: u64 = 2 * 1024 * 1024;
const IGNORE_FILE: &str = ".vaultignore";
const MANIFEST_NAMES: [&str; 2] = ["manifest.yaml", "manifest.yml"];
const README_NAME: &str = "README.md";
/// Anfang einer Datei, nach dem `file_kind` bei unbekannter Endung urteilt.
const HEAD_BYTES: usize = 8 * 1024;

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
    /// Pfad des Artefakts: die Datei selbst oder der Ordner mit `manifest.yaml`.
    artifact: String,
}

/// Titel und Tags eines Ordner-Artefakts, wie sie in die FTS-Zeilen seiner Dateien kommen.
struct FolderFts {
    title: String,
    tags: String,
}

/// Gleicht den Index mit dem Ordner ab. Je Datei eine eigene Transaktion; eine nicht lesbare
/// Datei wird als übersprungen vermerkt und bricht den Lauf nicht ab.
pub fn run(root: &Path, index: &VaultIndex) -> Result<ScanReport, CommandError> {
    let started: Instant = Instant::now();
    let mut report = ScanReport::default();
    let mut entries: Vec<Entry> = walk(root, &mut report);
    report.seen = entries.len() as u32;
    let folders: HashSet<String> = manifest_folders(&entries);
    for entry in &mut entries {
        entry.artifact = artifact_of(&entry.rel, &folders);
    }
    let stored: HashMap<String, FileRow> =
        index.with(|connection| index::all_file_rows(connection))?;
    let mut work: Vec<bool> = entries
        .iter()
        .map(|entry: &Entry| is_changed(entry, stored.get(&entry.rel)))
        .collect();
    let dirty: Vec<String> = dirty_folders(&entries, &work, &stored, &folders);
    let folder_fts: HashMap<String, FolderFts> =
        put_folder_artifacts(root, index, &entries, &dirty, &mut work)?;
    let forced: HashSet<usize> = forced_members(&entries, &work, &stored, &dirty);
    for (position, entry) in entries.iter().enumerate() {
        if !work[position] && !forced.contains(&position) {
            continue;
        }
        let fts: Option<&FolderFts> = folder_fts.get(&entry.artifact);
        let is_forced: bool = forced.contains(&position);
        sync_file(root, index, entry, stored.get(&entry.rel), fts, is_forced)?;
        report.read += 1;
    }
    report.skipped += index.with(|connection| Ok(index::counts(connection)?.skipped))?;
    report.removed = remove_vanished(index, &entries, &stored)?;
    index.with(|connection| index::delete_orphan_artifacts(connection))?;
    report.duration_ms = started.elapsed().as_millis() as u64;
    Ok(report)
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
        artifact: String::new(),
    })
}

/// Ordner, die eine `manifest.yaml` oder `manifest.yml` tragen. Eine Manifest-Datei im Vault-Ordner
/// selbst macht nicht den ganzen Vault zu einem Artefakt.
fn manifest_folders(entries: &[Entry]) -> HashSet<String> {
    entries
        .iter()
        .filter_map(|entry: &Entry| entry.rel.rsplit_once('/'))
        .filter(|(_, name): &(&str, &str)| MANIFEST_NAMES.contains(name))
        .map(|(folder, _): (&str, &str)| folder.to_owned())
        .collect()
}

/// Das Artefakt einer Datei: der tiefste Manifest-Ordner über ihr, sonst sie selbst.
fn artifact_of(rel: &str, folders: &HashSet<String>) -> String {
    let mut parent: &str = rel;
    while let Some((folder, _)) = parent.rsplit_once('/') {
        if folders.contains(folder) {
            return folder.to_owned();
        }
        parent = folder;
    }
    rel.to_owned()
}

fn is_changed(entry: &Entry, stored: Option<&FileRow>) -> bool {
    let Some(row) = stored else {
        return true;
    };
    row.error.is_some()
        || row.size != entry.size
        || row.modified_ms != entry.modified_ms
        || row.artifact != entry.artifact
}

/// Ordner-Artefakte, an denen sich etwas geändert hat: durch eine geänderte oder entfernte Datei.
fn dirty_folders(
    entries: &[Entry],
    changed: &[bool],
    stored: &HashMap<String, FileRow>,
    folders: &HashSet<String>,
) -> Vec<String> {
    let present: HashSet<&str> = entries
        .iter()
        .map(|entry: &Entry| entry.rel.as_str())
        .collect();
    let mut dirty: HashSet<String> = HashSet::new();
    for (entry, is_changed) in entries.iter().zip(changed) {
        if *is_changed {
            dirty.insert(entry.artifact.clone());
            if let Some(row) = stored.get(&entry.rel) {
                dirty.insert(row.artifact.clone());
            }
        }
    }
    for (path, row) in stored {
        if !present.contains(path.as_str()) {
            dirty.insert(row.artifact.clone());
        }
    }
    let mut found: Vec<String> = dirty
        .into_iter()
        .filter(|artifact: &String| folders.contains(artifact))
        .collect();
    found.sort();
    found
}

/// Berechnet die Metadaten der schmutzigen Ordner-Artefakte und schreibt ihre Zeilen. Ändern sich
/// Titel oder Tags gegenüber dem Gespeicherten, bleibt der Vermerk für `forced_members` in der
/// Rückgabe stehen, denn dann stimmen die FTS-Zeilen aller Dateien des Ordners nicht mehr.
fn put_folder_artifacts(
    root: &Path,
    index: &VaultIndex,
    entries: &[Entry],
    dirty_folders: &[String],
    changed: &mut [bool],
) -> Result<HashMap<String, FolderFts>, CommandError> {
    let mut found: HashMap<String, FolderFts> = HashMap::new();
    for folder in dirty_folders {
        let members: Vec<&Entry> = entries
            .iter()
            .filter(|entry: &&Entry| &entry.artifact == folder)
            .collect();
        let meta: Meta = folder_meta_of(root, folder, &members);
        let latest: i64 = members
            .iter()
            .map(|entry: &&Entry| entry.modified_ms)
            .max()
            .unwrap_or(0);
        let row: ArtifactRow = artifact_row(folder, &meta, latest);
        let previous: Option<(String, String)> =
            index.with(|connection| index::artifact_title_tags(connection, folder))?;
        let is_same: bool = previous
            .as_ref()
            .is_some_and(|(title, tags): &(String, String)| {
                *title == row.title && *tags == row.tags
            });
        index.with(|connection| index::put_artifact(connection, &row))?;
        if !is_same {
            // Erzwingt das Einlesen aller Dateien des Ordners: ihre FTS-Zeilen tragen Titel und Tags.
            for (position, entry) in entries.iter().enumerate() {
                if &entry.artifact == folder {
                    changed[position] = true;
                }
            }
        }
        found.insert(
            folder.clone(),
            FolderFts {
                title: row.title,
                tags: row.tags,
            },
        );
    }
    Ok(found)
}

/// Dateien, die nur wegen ihres Ordner-Artefakts neu eingelesen werden, obwohl sie selbst
/// unverändert sind. Ihr Hash-Kurzschluss gilt nicht.
fn forced_members(
    entries: &[Entry],
    work: &[bool],
    stored: &HashMap<String, FileRow>,
    dirty_folders: &[String],
) -> HashSet<usize> {
    let dirty: HashSet<&str> = dirty_folders.iter().map(String::as_str).collect();
    entries
        .iter()
        .enumerate()
        .filter(|(position, entry): &(usize, &Entry)| {
            work[*position]
                && dirty.contains(entry.artifact.as_str())
                && !is_changed(entry, stored.get(&entry.rel))
        })
        .map(|(position, _): (usize, &Entry)| position)
        .collect()
}

fn folder_meta_of(root: &Path, folder: &str, members: &[&Entry]) -> Meta {
    let files: HashSet<String> = members
        .iter()
        .map(|entry: &&Entry| entry.rel.clone())
        .collect();
    let manifest: String = MANIFEST_NAMES
        .iter()
        .map(|name: &&str| format!("{folder}/{name}"))
        .find(|path: &String| files.contains(path))
        .and_then(|path: String| read_small_text(root, &path))
        .unwrap_or_default();
    let readme_path: String = format!("{folder}/{README_NAME}");
    let readme: Option<String> = if files.contains(&readme_path) {
        read_small_text(root, &readme_path)
    } else {
        None
    };
    extract::folder_meta(folder, &manifest, readme.as_deref(), &files)
}

fn read_small_text(root: &Path, rel: &str) -> Option<String> {
    let path = root.join(native(rel));
    let size: u64 = fs::metadata(&path).ok()?.len();
    if size > MAX_READ_BYTES {
        return None;
    }
    let bytes: Vec<u8> = fs::read(path).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

/// Vergleicht eine Datei mit dem gespeicherten Stand und zieht den Index nach.
fn sync_file(
    root: &Path,
    index: &VaultIndex,
    entry: &Entry,
    stored: Option<&FileRow>,
    folder: Option<&FolderFts>,
    is_forced: bool,
) -> Result<(), CommandError> {
    let loaded: Result<Loaded, String> = load(&root.join(native(&entry.rel)), entry.size);
    match loaded {
        Err(message) => store_failure(index, entry, message)?,
        Ok(loaded) => store_loaded(index, entry, stored, folder, is_forced, loaded)?,
    }
    Ok(())
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
                kind: FileKind::Binary.as_str().to_owned(),
                artifact: entry.artifact.clone(),
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
    folder: Option<&FolderFts>,
    is_forced: bool,
    loaded: Loaded,
) -> Result<(), CommandError> {
    let has_same_content: bool = !is_forced
        && stored.is_some_and(|row: &FileRow| {
            row.error.is_none()
                && row.artifact == entry.artifact
                && !loaded.hash.is_empty()
                && row.hash == loaded.hash
        });
    if has_same_content {
        return index.with(|connection| {
            index::touch_file(connection, &entry.rel, entry.size, entry.modified_ms)
        });
    }
    let head: Option<&[u8]> = loaded
        .bytes
        .as_deref()
        .map(|bytes: &[u8]| &bytes[..bytes.len().min(HEAD_BYTES)]);
    let kind: FileKind = extract::file_kind(&entry.rel, head);
    let text: Option<String> = text_of(kind, loaded.bytes.as_deref());
    let parts: Vec<SectionInput> = extract::sections(kind, &entry.rel, text.as_deref());
    let own_row: Option<ArtifactRow> = match folder {
        Some(_) => None,
        None => {
            let meta: Meta = extract::file_meta(kind, &entry.rel, text.as_deref());
            Some(artifact_row(&entry.rel, &meta, entry.modified_ms))
        }
    };
    let (title, tags): (&str, &str) = match (folder, &own_row) {
        (Some(fts), _) => (&fts.title, &fts.tags),
        (None, Some(row)) => (&row.title, &row.tags),
        (None, None) => ("", ""),
    };
    index.with(|connection| {
        let transaction = connection.transaction()?;
        index::replace_sections(
            &transaction,
            &entry.rel,
            &parts,
            &ArtifactFts { title, tags },
        )?;
        index::put_file(
            &transaction,
            &FileRow {
                path: entry.rel.clone(),
                size: entry.size,
                modified_ms: entry.modified_ms,
                hash: loaded.hash.clone(),
                kind: kind.as_str().to_owned(),
                artifact: entry.artifact.clone(),
                error: None,
            },
        )?;
        if let Some(row) = &own_row {
            index::put_artifact(&transaction, row)?;
        }
        transaction.commit()?;
        Ok(())
    })
}

/// Der Text einer Datei, soweit ihre Art Text ist. Unbekannte Endungen hat `file_kind` schon auf
/// Text oder binär geprüft, bei bekannten Endungen zählt die Endung.
fn text_of(kind: FileKind, bytes: Option<&[u8]>) -> Option<String> {
    if matches!(kind, FileKind::Image | FileKind::Binary) {
        return None;
    }
    bytes.map(|content: &[u8]| String::from_utf8_lossy(content).into_owned())
}

/// Aus fertigen Metadaten wird die Zeile in `artifacts`; `extract` setzt Titel und Art immer.
fn artifact_row(path: &str, meta: &Meta, modified_ms: i64) -> ArtifactRow {
    ArtifactRow {
        path: path.to_owned(),
        title: meta.title.clone().unwrap_or_default(),
        description: meta.description.clone().unwrap_or_default(),
        kind: meta.kind.clone().unwrap_or_default(),
        tags: meta.tags.join(" "),
        status: meta.status.clone().unwrap_or_default(),
        preview: meta.preview.clone(),
        entrypoint: meta.entrypoint.clone(),
        modified_ms,
    }
}

/// Löscht Dateien, die der Durchlauf nicht mehr gesehen hat; gibt ihre Zahl zurück.
fn remove_vanished(
    index: &VaultIndex,
    entries: &[Entry],
    stored: &HashMap<String, FileRow>,
) -> Result<u32, CommandError> {
    let seen: HashSet<&str> = entries
        .iter()
        .map(|entry: &Entry| entry.rel.as_str())
        .collect();
    let mut removed: u32 = 0;
    for path in stored
        .keys()
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

/// Pfad mit `/` zum Dateisystempfad (siehe `filesystem::native_path`).
fn native(rel: &str) -> std::path::PathBuf {
    crate::filesystem::native_path(rel)
}
