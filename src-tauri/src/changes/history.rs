//! Die Commits seit der Basis mit ihren Dateien. Was ein Commit geändert hat, ändert sich nie —
//! deshalb merkt es sich der Core (ADR 014).
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};

use crate::changes::model::LineStat;
use crate::changes::{parse, scan};
use crate::error::CommandError;
use crate::git;

// Darüber wird der Speicher geleert statt einzeln verdrängt: ein Neuaufbau kostet nur Git-Aufrufe.
const MAX_CACHED_COMMITS: usize = 50_000;
const MAX_CACHED_RANGES: usize = 2_000;

static COMMIT_FILES: OnceLock<Mutex<HashMap<String, Vec<String>>>> = OnceLock::new();
static RANGE_STATS: OnceLock<Mutex<HashMap<String, BTreeMap<String, LineStat>>>> = OnceLock::new();

/// Ein Commit seit der Basis; `files` relativ zum Repository mit `/`, gegen den ersten Elternteil.
#[derive(Debug, Clone)]
pub struct CommitInfo {
    pub id: String,
    /// Committer-Zeit in Sekunden.
    pub time: i64,
    pub first_parent: Option<String>,
    pub files: Vec<String>,
}

/// Die Commits von `base` bis `HEAD` ohne Merge-Commits, älteste zuerst.
pub fn read(worktree: &Path, base: &str) -> Result<Vec<CommitInfo>, CommandError> {
    let entries = scan::parse_rev_list(&git::commits_since(worktree, base)?);
    let ids: Vec<String> = entries
        .iter()
        .map(|entry: &scan::RevListEntry| entry.id.clone())
        .collect();
    let mut files = files_of(worktree, &ids)?;
    Ok(entries
        .into_iter()
        .map(|entry: scan::RevListEntry| CommitInfo {
            files: files.remove(&entry.id).unwrap_or_default(),
            id: entry.id,
            time: entry.time,
            first_parent: entry.first_parent,
        })
        .collect())
}

/// Die Zahlen `from → to` je Pfad über den ganzen Baum.
pub fn range_stats(
    worktree: &Path,
    from: &str,
    to: &str,
) -> Result<BTreeMap<String, LineStat>, CommandError> {
    let key = format!("{from}..{to}");
    if let Some(stats) = range_stats_cache().get(&key) {
        return Ok(stats.clone());
    }
    let stats = parse::scope_stats(
        &git::diff_tree_name_status(worktree, from, to)?,
        &git::diff_tree_numstat(worktree, from, to)?,
    );
    let mut cache = range_stats_cache();
    if cache.len() >= MAX_CACHED_RANGES {
        cache.clear();
    }
    cache.insert(key, stats.clone());
    Ok(stats)
}

/// Die Dateien je Commit: aus dem Speicher, die übrigen in einem Git-Aufruf. Ein Commit ohne
/// Elternteil oder ohne Änderung hat keine.
fn files_of(worktree: &Path, ids: &[String]) -> Result<HashMap<String, Vec<String>>, CommandError> {
    let mut files: HashMap<String, Vec<String>> = HashMap::new();
    let mut missing: Vec<String> = Vec::new();
    {
        let cache = commit_files_cache();
        for id in ids {
            match cache.get(id) {
                Some(cached) => {
                    files.insert(id.clone(), cached.clone());
                }
                None => missing.push(id.clone()),
            }
        }
    }
    if missing.is_empty() {
        return Ok(files);
    }
    // Die Sperre ist hier frei: Git läuft nie unter ihr.
    let fetched = split_by_commit(&git::commit_files(worktree, &missing)?, &missing);
    let mut cache = commit_files_cache();
    if cache.len() + missing.len() > MAX_CACHED_COMMITS {
        cache.clear();
    }
    for id in missing {
        let commit_files = fetched.get(&id).cloned().unwrap_or_default();
        cache.insert(id.clone(), commit_files.clone());
        files.insert(id, commit_files);
    }
    Ok(files)
}

/// Zerlegt `<ID>\0<Pfad>\0…<ID>\0…`; eine ID erkennt es daran, dass sie angefragt war.
fn split_by_commit(raw: &str, ids: &[String]) -> HashMap<String, Vec<String>> {
    let requested: HashSet<&str> = ids.iter().map(String::as_str).collect();
    let mut files: HashMap<String, Vec<String>> = HashMap::new();
    let mut current: Option<String> = None;
    for piece in parse::paths(raw) {
        if requested.contains(piece.as_str()) {
            current = Some(piece);
            continue;
        }
        if let Some(id) = &current {
            files.entry(id.clone()).or_default().push(piece);
        }
    }
    files
}

fn commit_files_cache() -> MutexGuard<'static, HashMap<String, Vec<String>>> {
    COMMIT_FILES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

fn range_stats_cache() -> MutexGuard<'static, HashMap<String, BTreeMap<String, LineStat>>> {
    RANGE_STATS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}
