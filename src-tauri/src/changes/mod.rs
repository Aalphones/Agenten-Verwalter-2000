//! Was der Agent in den Worktrees einer Session gegenüber der Basis geändert hat — in drei
//! Blickwinkeln, gelesen nur mit Plumbing-Befehlen, die im Worktree keine Sperre nehmen (ADR 006).
pub mod model;
pub mod parse;

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::thread::{self, ScopedJoinHandle};

use crate::changes::model::{ChangeKind, FileChange, LineStat, RepositoryChanges, SessionChanges};
use crate::error::CommandError;
use crate::git;
use crate::worktrees::SessionRepository;

/// Größere untracked Dateien gelten als binär: ihre Zeilen zu zählen hieße, sie ganz zu lesen.
const MAX_UNTRACKED_BYTES: u64 = 8 * 1024 * 1024;
/// So viele Bytes prüft auch Git auf ein NUL-Byte, bevor es eine Datei binär nennt.
const BINARY_PROBE_BYTES: usize = 8000;
const WORKTREE_MISSING: &str =
    "Worktree fehlt — die nächste Nachricht an den Agenten legt ihn neu an.";
const THREAD_FAILED: &str = "interner Fehler beim Lesen der Changes";
const HEAD: &str = "HEAD";

/// Liest alle Repositories der Session nebeneinander, je eines in einem eigenen Thread. Scheitert
/// eines, trägt nur sein Eintrag den Fehler.
pub fn load(workspace: &Path, repositories: &[SessionRepository]) -> SessionChanges {
    let repositories = thread::scope(|scope| {
        let handles: Vec<(
            u32,
            &SessionRepository,
            ScopedJoinHandle<'_, RepositoryChanges>,
        )> = repositories
            .iter()
            .enumerate()
            .map(|(index, repository): (usize, &SessionRepository)| {
                let position = u32::try_from(index).unwrap_or(u32::MAX);
                let handle = scope.spawn(move || load_one(workspace, position, repository));
                (position, repository, handle)
            })
            .collect();
        handles
            .into_iter()
            .map(|(position, repository, handle)| {
                // Ein panischer Thread trifft nur sein Repository, nicht die ganze Ansicht.
                handle
                    .join()
                    .unwrap_or_else(|_| failed(position, repository, THREAD_FAILED.to_owned()))
            })
            .collect()
    });
    SessionChanges { repositories }
}

/// Nur lesen: ein fehlender Worktree wird gemeldet, nicht angelegt — das bleibt bei
/// `worktrees::ensure` vor dem Agent-Start.
fn load_one(workspace: &Path, position: u32, repository: &SessionRepository) -> RepositoryChanges {
    if !repository.repository_path.join(".git").exists() {
        let missing =
            CommandError::RepositoryMissing(repository.repository_path.display().to_string());
        return failed(position, repository, missing.to_string());
    }
    let worktree = workspace.join(&repository.folder);
    if !worktree.exists() {
        return failed(position, repository, WORKTREE_MISSING.to_owned());
    }
    match read_changes(&worktree, &repository.base_commit) {
        Ok((files, commit_count)) => RepositoryChanges {
            position,
            name: repository.name.clone(),
            branch: repository.branch.clone(),
            base_ref: repository.base_ref.clone(),
            commit_count,
            files,
            error: None,
        },
        Err(error) => failed(position, repository, error.to_string()),
    }
}

fn read_changes(worktree: &Path, base: &str) -> Result<(Vec<FileChange>, u32), CommandError> {
    let committed = parse::scope_stats(
        &git::diff_tree_name_status(worktree, base, HEAD)?,
        &git::diff_tree_numstat(worktree, base, HEAD)?,
    );
    let mut all = parse::scope_stats(
        &git::diff_index_name_status(worktree, base)?,
        &git::diff_index_numstat(worktree, base)?,
    );
    let mut uncommitted = parse::scope_stats(
        &git::diff_index_name_status(worktree, HEAD)?,
        &git::diff_index_numstat(worktree, HEAD)?,
    );
    for path in parse::paths(&git::untracked_files(worktree)?) {
        let stat = untracked_stat(&worktree.join(path.replace('/', "\\")));
        all.insert(path.clone(), stat.clone());
        uncommitted.insert(path, stat);
    }
    let commit_count = git::commit_count(worktree, base)?;

    let mut files: BTreeMap<String, FileChange> = BTreeMap::new();
    for path in all.keys().chain(committed.keys()).chain(uncommitted.keys()) {
        if files.contains_key(path) {
            continue;
        }
        files.insert(
            path.clone(),
            FileChange {
                path: path.clone(),
                all: all.get(path).cloned(),
                committed: committed.get(path).cloned(),
                uncommitted: uncommitted.get(path).cloned(),
            },
        );
    }
    Ok((files.into_values().collect(), commit_count))
}

/// Zeilenzahl einer untracked Datei, die Git nicht zählt, weil es sie nicht kennt.
fn untracked_stat(path: &Path) -> LineStat {
    let binary = LineStat {
        kind: ChangeKind::Added,
        added: 0,
        deleted: 0,
        binary: true,
    };
    let is_small = fs::metadata(path)
        .is_ok_and(|metadata: fs::Metadata| metadata.len() <= MAX_UNTRACKED_BYTES);
    if !is_small {
        return binary;
    }
    // Die Datei kann zwischen Auflisten und Lesen verschwunden sein; der nächste Durchlauf korrigiert.
    let Ok(content) = fs::read(path) else {
        return binary;
    };
    let probe = &content[..content.len().min(BINARY_PROBE_BYTES)];
    if probe.contains(&0) {
        return binary;
    }
    let newlines = content.iter().filter(|byte: &&u8| **byte == b'\n').count();
    let has_open_last_line = content.last().is_some_and(|byte: &u8| *byte != b'\n');
    let lines = newlines + usize::from(has_open_last_line);
    LineStat {
        kind: ChangeKind::Added,
        added: u32::try_from(lines).unwrap_or(u32::MAX),
        deleted: 0,
        binary: false,
    }
}

fn failed(position: u32, repository: &SessionRepository, error: String) -> RepositoryChanges {
    RepositoryChanges {
        position,
        name: repository.name.clone(),
        branch: repository.branch.clone(),
        base_ref: repository.base_ref.clone(),
        commit_count: 0,
        files: Vec::new(),
        error: Some(error),
    }
}
