//! Was zu einer Session gehört: eigene Commits, geschriebene Dateien (ADR 014).
use std::collections::{BTreeMap, HashMap, HashSet};

use crate::changes::history::CommitInfo;

const VERBATIM_PREFIX: &str = "\\\\?\\";
const MS_PER_SECOND: f64 = 1000.0;

/// Was einer Reichweite gehört.
#[derive(Debug, Clone, Default)]
pub struct Ownership {
    /// Eigene Commit-IDs der Reichweite.
    pub commits: HashSet<String>,
    /// Geschriebene Dateien als normalisierter absoluter Pfad → letzte Uhrzeit in ms.
    pub touched: HashMap<String, f64>,
    /// Wie `SessionChanges.untracked_before`.
    pub untracked_before: Option<f64>,
}

/// Eine Datei mit eigenen Commits.
#[derive(Debug, Clone)]
pub struct OwnFile {
    /// Erster Elternteil des ersten eigenen Commits an der Datei.
    pub from: String,
    /// Letzter eigener Commit an der Datei.
    pub to: String,
    /// Ein fremder Commit ändert die Datei zwischen `from` und `to`.
    pub foreign_between: bool,
    /// Ein fremder Commit ändert die Datei nach dem ersten eigenen.
    pub foreign_after: bool,
}

/// `OwnFile` mit den Positionen in der Commit-Liste, die nur die Rechnung braucht.
struct Tracked {
    file: OwnFile,
    first_index: usize,
    last_index: usize,
}

/// Windows-Pfade unterscheiden keine Groß-/Kleinschreibung; so vergleicht die App, was der Agent
/// schrieb, mit dem, was Git meldet.
pub fn normalize_path(path: &str) -> String {
    let without_prefix = path.strip_prefix(VERBATIM_PREFIX).unwrap_or(path);
    without_prefix
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

/// Je Datei aus eigenen Commits: vom ersten bis zum letzten eigenen Commit, mit fremden Anteilen.
/// `commits` in der Reihenfolge von `history::read` (älteste zuerst).
pub fn own_files(commits: &[CommitInfo], own: &HashSet<String>) -> BTreeMap<String, OwnFile> {
    let mut tracked: BTreeMap<String, Tracked> = BTreeMap::new();
    for (index, commit) in commits.iter().enumerate() {
        if !own.contains(&commit.id) {
            continue;
        }
        let Some(parent) = &commit.first_parent else {
            continue;
        };
        for path in &commit.files {
            let entry = tracked.entry(path.clone()).or_insert_with(|| Tracked {
                file: OwnFile {
                    from: parent.clone(),
                    to: commit.id.clone(),
                    foreign_between: false,
                    foreign_after: false,
                },
                first_index: index,
                last_index: index,
            });
            entry.file.to.clone_from(&commit.id);
            entry.last_index = index;
        }
    }
    for (index, commit) in commits.iter().enumerate() {
        if own.contains(&commit.id) {
            continue;
        }
        for path in &commit.files {
            let Some(entry) = tracked.get_mut(path) else {
                continue;
            };
            entry.file.foreign_between |= entry.first_index < index && index < entry.last_index;
            entry.file.foreign_after |= index > entry.first_index;
        }
    }
    tracked
        .into_iter()
        .map(|(path, entry): (String, Tracked)| (path, entry.file))
        .collect()
}

pub fn own_commit_count(commits: &[CommitInfo], own: &HashSet<String>) -> u32 {
    let count = commits
        .iter()
        .filter(|commit: &&CommitInfo| own.contains(&commit.id))
        .count();
    u32::try_from(count).unwrap_or(u32::MAX)
}

/// Nach dem letzten Schreiben committet: neuer Schmutz stammt nicht mehr von der Reichweite.
/// Dieselbe Sekunde zählt als committet. `path` relativ zum Repository mit `/`.
pub fn is_open(touched_at: f64, path: &str, commits: &[CommitInfo], own: &HashSet<String>) -> bool {
    let touched_second = (touched_at / MS_PER_SECOND).floor() as i64;
    !commits.iter().any(|commit: &CommitInfo| {
        commit.time >= touched_second
            && own.contains(&commit.id)
            && commit.files.iter().any(|file: &String| file == path)
    })
}
