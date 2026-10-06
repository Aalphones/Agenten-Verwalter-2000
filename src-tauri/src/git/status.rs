//! Der Git-Zustand der Einträge in den Changes einer Session (ADR 025): Branch, Upstream, ↓/↑,
//! laufender Merge/Rebase, fremde Änderungen, eigene Commits. Liest nur, ohne Sperre (ADR 006).
use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::Path;
use std::thread::{self, ScopedJoinHandle};

use crate::changes::attribution::{self, Ownership};
use crate::changes::history::CommitInfo;
use crate::changes::model::LineStat;
use crate::changes::sources::{self, Source};
use crate::changes::{self, ChangesInput};
use crate::error::CommandError;
use crate::git;
use crate::git::model::{
    GitBranch, GitBusySession, GitEntryStatus, GitForeignFile, GitOperation, GitOwnCommit,
    GitSessionStatus,
};

const PREFERRED_REMOTE: &str = "origin";
const SHORT_COMMIT_CHARS: usize = 7;
const MERGE_HEAD: &str = "MERGE_HEAD";
const REBASE_MARKERS: [&str; 2] = ["rebase-merge", "rebase-apply"];
const LOCAL_REFS: &str = "refs/heads/";
const REMOTE_REFS: &str = "refs/remotes/";
const REMOTE_HEAD_SUFFIX: &str = "/HEAD";
const CURRENT_MARKER: &str = "*";
const THREAD_FAILED: &str = "interner Fehler beim Lesen des Git-Zustands";

/// Alle Einträge der Reichweite mit Git, je einer in einem eigenen Thread; scheitert einer, trägt
/// nur er den Fehler. Innere Repositories nur, wenn die Changes sie auch zeigen.
pub fn session_status(input: &ChangesInput, busy: Vec<GitBusySession>) -> GitSessionStatus {
    let own = &input.own;
    let sources = sources::sources(input);
    let entries = thread::scope(|scope| {
        let handles: Vec<(&Source, ScopedJoinHandle<'_, Option<GitEntryStatus>>)> = sources
            .iter()
            .map(|source: &Source| (source, scope.spawn(move || visible_status(source, own))))
            .collect();
        handles
            .into_iter()
            .filter_map(|(source, handle)| {
                handle
                    .join()
                    .unwrap_or_else(|_| Some(failed(source.key.clone(), THREAD_FAILED.to_owned())))
            })
            .collect()
    });
    GitSessionStatus { entries, busy }
}

/// `None` für ein inneres Repository, das die Changes weglassen: nichts geschrieben, keine eigenen
/// Commits. Für unberührte reicht die Commit-Liste — wie in `changes::load`, aus demselben Grund.
fn visible_status(source: &Source, own: &Ownership) -> Option<GitEntryStatus> {
    if source.optional && source.error.is_none() && !changes::has_touched_under(&source.dir, own) {
        let has_own_commits = changes::source_base(source)
            .and_then(|base: String| changes::own_commits(&source.dir, &base, own))
            .is_ok_and(|commits: Vec<CommitInfo>| !commits.is_empty());
        if !has_own_commits {
            return None;
        }
    }
    Some(entry_status(source, own))
}

/// Der Git-Zustand eines Eintrags; jeder Fehler landet in `error`.
pub fn entry_status(source: &Source, own: &Ownership) -> GitEntryStatus {
    match read_entry(source, own) {
        Ok(status) => status,
        Err(error) => failed(source.key.clone(), changes::entry_error(error)),
    }
}

fn read_entry(source: &Source, own: &Ownership) -> Result<GitEntryStatus, CommandError> {
    let base = changes::source_base(source)?;
    let dir = source.dir.as_path();
    let branch = git::head_branch(dir)?;
    let upstream = git::upstream(dir)?;
    let remote = push_remote(git::remotes(dir)?);
    let (ahead, behind) = match &upstream {
        Some(upstream) => git::ahead_behind(dir, upstream)?,
        None => (0, 0),
    };
    let operation = operation(dir)?;
    let conflicted = if operation == GitOperation::None {
        Vec::new()
    } else {
        git::conflicted(dir)?
    };
    let foreign = changes::foreign_uncommitted(dir, &base, own)?
        .into_iter()
        .map(|(path, stat): (String, LineStat)| GitForeignFile {
            path,
            kind: stat.kind,
            added: stat.added,
            deleted: stat.deleted,
            binary: stat.binary,
        })
        .collect();
    let commits = own_commits(dir, &base, own, upstream.as_deref())?;
    let head_pushed = match &upstream {
        Some(upstream) => git::is_ancestor(dir, "HEAD", upstream)?,
        None => false,
    };
    Ok(GitEntryStatus {
        key: source.key.clone(),
        branch,
        upstream,
        remote,
        ahead,
        behind,
        operation,
        conflicted,
        foreign,
        commits,
        head_pushed,
        last_fetch_ms: None,
        error: None,
    })
}

/// `origin`, sonst der einzige Remote; bei mehreren ohne `origin` keiner.
fn push_remote(remotes: Vec<String>) -> Option<String> {
    if remotes
        .iter()
        .any(|remote: &String| remote == PREFERRED_REMOTE)
    {
        return Some(PREFERRED_REMOTE.to_owned());
    }
    match <[String; 1]>::try_from(remotes) {
        Ok([only]) => Some(only),
        Err(_) => None,
    }
}

fn operation(dir: &Path) -> Result<GitOperation, CommandError> {
    if git::git_path_exists(dir, MERGE_HEAD)? {
        return Ok(GitOperation::Merge);
    }
    for marker in REBASE_MARKERS {
        if git::git_path_exists(dir, marker)? {
            return Ok(GitOperation::Rebase);
        }
    }
    Ok(GitOperation::None)
}

fn own_commits(
    dir: &Path,
    base: &str,
    own: &Ownership,
    upstream: Option<&str>,
) -> Result<Vec<GitOwnCommit>, CommandError> {
    let commits = changes::own_commits(dir, base, own)?;
    let ids: Vec<String> = commits
        .iter()
        .map(|commit: &CommitInfo| commit.id.clone())
        .collect();
    let mut subjects = git::subjects(dir, &ids)?;
    let unpushed = match upstream {
        Some(upstream) => Some(git::unpushed(dir, upstream)?),
        None => None,
    };
    Ok(commits
        .into_iter()
        .map(|commit: CommitInfo| {
            let pushed = unpushed
                .as_ref()
                .is_some_and(|unpushed: &HashSet<String>| !unpushed.contains(&commit.id));
            GitOwnCommit {
                short_id: commit.id.chars().take(SHORT_COMMIT_CHARS).collect(),
                subject: subjects.remove(&commit.id).unwrap_or_default(),
                pushed,
                files: commit.files,
                id: commit.id,
            }
        })
        .collect())
}

fn failed(key: String, error: String) -> GitEntryStatus {
    GitEntryStatus {
        key,
        branch: None,
        upstream: None,
        remote: None,
        ahead: 0,
        behind: 0,
        operation: GitOperation::None,
        conflicted: Vec::new(),
        foreign: Vec::new(),
        commits: Vec::new(),
        head_pushed: false,
        last_fetch_ms: None,
        error: Some(error),
    }
}

/// Lokale und Remote-Branches fürs Menü, ohne `<remote>/HEAD`; lokal vor remote, sonst nach Name.
pub fn branches(dir: &Path) -> Result<Vec<GitBranch>, CommandError> {
    let own_dir = attribution::normalize_path(&dir.to_string_lossy());
    let mut branches: Vec<GitBranch> = git::branch_refs(dir)?
        .lines()
        .filter_map(|line: &str| parse_branch(line.trim_end_matches('\r'), &own_dir))
        .collect();
    branches.sort_by(|left: &GitBranch, right: &GitBranch| {
        left.remote
            .cmp(&right.remote)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(branches)
}

/// Eine Zeile `<refname>\0<HEAD>\0<worktreepath>` aus `git::branch_refs`.
fn parse_branch(line: &str, own_dir: &str) -> Option<GitBranch> {
    let mut fields = line.split('\0');
    let reference = fields.next()?;
    let head = fields.next().unwrap_or_default();
    let worktree_path = fields.next().unwrap_or_default();
    let (name, remote) = match reference.strip_prefix(LOCAL_REFS) {
        Some(name) => (name, false),
        None => (reference.strip_prefix(REMOTE_REFS)?, true),
    };
    if remote && name.ends_with(REMOTE_HEAD_SUFFIX) {
        return None;
    }
    let is_elsewhere =
        !worktree_path.is_empty() && attribution::normalize_path(worktree_path) != own_dir;
    let worktree = if is_elsewhere {
        Path::new(worktree_path)
            .file_name()
            .map(|folder: &OsStr| folder.to_string_lossy().into_owned())
    } else {
        None
    };
    Some(GitBranch {
        name: name.to_owned(),
        remote,
        current: head == CURRENT_MARKER,
        worktree,
    })
}
