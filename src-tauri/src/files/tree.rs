//! Der Dateibaum eines Eintrags: was Git kennt, was neu ist, und was Git ignoriert.
use std::cmp::Ordering;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use crate::error::CommandError;
use crate::files::checked_path;
use crate::files::model::{DirEntry, IgnoredEntry, RepoTree, TreeFile};
use crate::filesystem::native_path;
use crate::git;

/// Darüber endet der Baum; so viele Dateien liest niemand im Baum, und die Liste geht ganz über die
/// Tauri-Grenze.
pub const MAX_TREE_FILES: usize = 50_000;
/// Höchstzahl der Kinder eines ignorierten Ordners, etwa in `node_modules`.
pub const MAX_DIR_ENTRIES: usize = 2_000;

/// Git-Modus eines Submoduls: ein Commit in einem anderen Repository, keine Datei.
const SUBMODULE_MODE: &str = "160000";
const SYMLINK_MODE: &str = "120000";
const IGNORED_PREFIX: &str = "!! ";
const NOT_IGNORED: &str = "Nur ignorierte Ordner lassen sich so aufklappen";

/// Alle versionierten und neuen, nicht ignorierten Dateien in `dir`, jede einmal, nach Pfad sortiert,
/// dazu die ignorierten Einträge ohne Ordner, die selbst ein Repository oder Arbeitsbaum sind.
pub fn tree(dir: &Path) -> Result<RepoTree, CommandError> {
    let mut files: BTreeMap<String, bool> = BTreeMap::new();
    for entry in git::ls_files_staged(dir)?.split('\0') {
        // `<Modus> <Objekt> <Stufe>\t<Pfad>`; bei einem Konflikt steht derselbe Pfad je Stufe einmal.
        let Some((meta, path)) = entry.split_once('\t') else {
            continue;
        };
        let mode = meta.split(' ').next().unwrap_or_default();
        if path.is_empty() || mode == SUBMODULE_MODE {
            continue;
        }
        files.insert(path.to_owned(), mode == SYMLINK_MODE);
    }
    for path in git::ls_files_others(dir)?.split('\0') {
        if path.is_empty() || files.contains_key(path) {
            continue;
        }
        files.insert(path.to_owned(), is_symlink(&dir.join(native_path(path))));
    }
    let truncated = files.len() > MAX_TREE_FILES;
    let files: Vec<TreeFile> = files
        .into_iter()
        .take(MAX_TREE_FILES)
        .map(|(path, link): (String, bool)| TreeFile { path, link })
        .collect();
    Ok(RepoTree {
        files,
        ignored: ignored(dir)?,
        truncated,
    })
}

/// Die ignorierten Einträge aus `git status`; ein ganz ignorierter Ordner ist ein Eintrag. Ordner mit
/// `.git` darin fehlen: das sind innere Repositories und Arbeitsbäume, die eigene Knoten haben.
fn ignored(dir: &Path) -> Result<Vec<IgnoredEntry>, CommandError> {
    let status = git::status_ignored(dir)?;
    let mut entries: Vec<IgnoredEntry> = Vec::new();
    for record in status.split('\0') {
        let Some(raw_path) = record.strip_prefix(IGNORED_PREFIX) else {
            continue;
        };
        let is_dir = raw_path.ends_with('/');
        let path = raw_path.trim_end_matches('/');
        if path.is_empty() {
            continue;
        }
        let is_repository = is_dir && dir.join(native_path(path)).join(".git").exists();
        if is_repository {
            continue;
        }
        entries.push(IgnoredEntry {
            path: path.to_owned(),
            dir: is_dir,
        });
    }
    entries.sort_by(|first: &IgnoredEntry, second: &IgnoredEntry| first.path.cmp(&second.path));
    Ok(entries)
}

/// Die direkten Kinder des ignorierten Ordners `path` in `dir`: Ordner zuerst, je nach Name.
pub fn ignored_children(dir: &Path, path: &str) -> Result<Vec<DirEntry>, CommandError> {
    let folder = checked_path(dir, path)?;
    if !git::is_ignored(dir, path)? {
        return Err(CommandError::FileNotAllowed(NOT_IGNORED.to_owned()));
    }
    let mut children: Vec<DirEntry> = Vec::new();
    for entry in fs::read_dir(&folder)? {
        // Ein Eintrag kann zwischen Auflisten und Lesen verschwinden; er fehlt dann einfach.
        let Ok(entry) = entry else {
            continue;
        };
        let Ok(metadata) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        children.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            dir: metadata.is_dir(),
            link: metadata.file_type().is_symlink(),
        });
    }
    children.sort_by(
        |first: &DirEntry, second: &DirEntry| match (first.dir, second.dir) {
            (true, false) => Ordering::Less,
            (false, true) => Ordering::Greater,
            _ => first.name.cmp(&second.name),
        },
    );
    children.truncate(MAX_DIR_ENTRIES);
    Ok(children)
}

fn is_symlink(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok_and(|metadata: fs::Metadata| metadata.file_type().is_symlink())
}
