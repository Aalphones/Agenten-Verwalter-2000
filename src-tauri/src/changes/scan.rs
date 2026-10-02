//! Welche neuen Commits ein beendeter Git-Befehl der Session hinterlassen hat (ADR 014).
use std::path::{Path, PathBuf};

use super::{folders_of, is_plain_folder};
use crate::git;
use crate::worktrees::{self, SessionRepository};

/// Git speichert ganze Sekunden, und der Werkzeugaufruf kommt eventuell erst nach dem Start an —
/// gemessen lag ein Commit genau auf der Startsekunde.
const START_SLACK_SECONDS: i64 = 2;
const END_SLACK_SECONDS: i64 = 1;

/// Ein Arbeitsordner der Session mit der Basis, ab der seine Commits gelten.
pub struct ScanDir {
    pub dir: PathBuf,
    pub base: String,
}

/// Eine Zeile von `git rev-list --timestamp --parents`.
pub struct RevListEntry {
    pub id: String,
    /// Committer-Zeit in Sekunden.
    pub time: i64,
    pub first_parent: Option<String>,
}

/// Die Arbeitsordner, in denen die Session Commits machen kann: je Repository der Haupt-Checkout
/// bzw. App-Worktree und die benutzten Ticket-Worktrees. Ordner ohne Git haben keine Commits.
pub fn session_dirs(
    workspace: &Path,
    repositories: &[SessionRepository],
    ticket_folders: &[(u32, String)],
) -> Vec<ScanDir> {
    let mut dirs: Vec<ScanDir> = Vec::new();
    for (index, repository) in repositories.iter().enumerate() {
        if is_plain_folder(repository) {
            continue;
        }
        let position = u32::try_from(index).unwrap_or(u32::MAX);
        let working_dir = repository.working_dir(workspace);
        if repository.repository_path.join(".git").exists() && working_dir.is_dir() {
            dirs.push(ScanDir {
                dir: working_dir,
                base: repository.base_commit.clone(),
            });
        }
        let folders = folders_of(ticket_folders, position);
        for worktree in worktrees::ticket_worktrees(repository, position, &folders) {
            let Ok((base, _)) = worktrees::ticket_base(repository, &worktree) else {
                continue;
            };
            dirs.push(ScanDir {
                dir: worktree.path,
                base,
            });
        }
    }
    dirs
}

/// Die Commits in `dirs`, deren Committer-Zeit in einem der Fenster `(Start, Ende)` in ms liegt.
/// Ohne Doppelte, in Fundreihenfolge; ein Ordner, den Git nicht lesen kann, wird übersprungen.
pub fn own_commits(dirs: &[ScanDir], windows: &[(f64, f64)]) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for scan_dir in dirs {
        let Ok(text) = git::commits_since(&scan_dir.dir, &scan_dir.base) else {
            continue;
        };
        for entry in parse_rev_list(&text) {
            if is_in_a_window(entry.time, windows) && !found.contains(&entry.id) {
                found.push(entry.id);
            }
        }
    }
    found
}

fn is_in_a_window(time: i64, windows: &[(f64, f64)]) -> bool {
    windows.iter().any(|(start, end): &(f64, f64)| {
        let earliest = (start / 1000.0).floor() as i64 - START_SLACK_SECONDS;
        let latest = (end / 1000.0).ceil() as i64 + END_SLACK_SECONDS;
        time >= earliest && time <= latest
    })
}

/// Zerlegt die Ausgabe von `git rev-list --timestamp --parents`; Zeilen, die sich nicht zerlegen
/// lassen, entfallen.
pub fn parse_rev_list(text: &str) -> Vec<RevListEntry> {
    text.lines()
        .filter_map(|line: &str| {
            let mut parts = line.split_whitespace();
            let time = parts.next()?.parse::<i64>().ok()?;
            let id = parts.next()?.to_owned();
            let first_parent = parts.next().map(str::to_owned);
            Some(RevListEntry {
                id,
                time,
                first_parent,
            })
        })
        .collect()
}
