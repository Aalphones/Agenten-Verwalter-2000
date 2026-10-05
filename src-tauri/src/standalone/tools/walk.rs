//! Verzeichnislauf für Glob und Grep: beachtet `.gitignore`, durchsucht aber Punkt-Ordner wie
//! `.claude` — nur `.git` selbst bleibt draußen.
use std::path::{Path, PathBuf};

use globset::{GlobBuilder, GlobMatcher};
use ignore::{DirEntry, WalkBuilder};

const GIT_DIR: &str = ".git";

/// Alle Dateien unter `base`, nach Namen sortiert; ist `base` eine Datei, nur sie.
pub fn files(base: &Path) -> impl Iterator<Item = PathBuf> {
    WalkBuilder::new(base)
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        .parents(true)
        .sort_by_file_name(|first, second| first.cmp(second))
        .filter_entry(|entry: &DirEntry| entry.file_name() != GIT_DIR)
        .build()
        .filter_map(Result::ok)
        .filter(|entry: &DirEntry| {
            entry
                .file_type()
                .is_some_and(|file_type: std::fs::FileType| file_type.is_file())
        })
        .map(DirEntry::into_path)
}

/// Glob-Muster ohne Groß-/Kleinschreibung; `*` überspringt keinen `/`. `\` gilt als Trenner,
/// weil Modelle unter Windows ihn so schreiben.
pub fn matcher(pattern: &str) -> Result<GlobMatcher, String> {
    GlobBuilder::new(&pattern.replace('\\', "/"))
        .case_insensitive(true)
        .literal_separator(true)
        .build()
        .map(|glob: globset::Glob| glob.compile_matcher())
        .map_err(|error: globset::Error| format!("Ungültiges Glob-Muster: {error}"))
}

/// Pfad relativ zu `base` mit `/` als Trenner — so werden Muster verglichen.
pub fn relative(path: &Path, base: &Path) -> String {
    path.strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}
