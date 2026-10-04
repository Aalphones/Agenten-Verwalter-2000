//! Welche neuen Commits ein beendeter Git-Befehl der Session hinterlassen hat (ADR 014).
use std::path::PathBuf;
use std::thread::{self, ScopedJoinHandle};

use super::ChangesInput;
use super::sources::{self, Source};
use crate::git;
use crate::worktrees;

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

/// Die Arbeitsordner, in denen die Session Commits machen kann: je Eintrag der Changes ein
/// Suchordner, auch innere Repositories und ihre Ticket-Worktrees (ADR 020). Ordner ohne Git haben
/// keine Commits, Einträge ohne bestimmbare Basis keinen Suchordner.
pub fn session_dirs(input: &ChangesInput) -> Vec<ScanDir> {
    sources::sources(input)
        .into_iter()
        .filter_map(scan_dir_of)
        .collect()
}

fn scan_dir_of(source: Source) -> Option<ScanDir> {
    if source.error.is_some() {
        return None;
    }
    if !source.repository.repository_path.join(".git").exists() || !source.dir.is_dir() {
        return None;
    }
    let base = match &source.ticket {
        Some(ticket) => worktrees::ticket_base(&source.repository, ticket).ok()?.0,
        None => source.repository.base_commit.clone(),
    };
    Some(ScanDir {
        dir: source.dir,
        base,
    })
}

/// Die Commits in `dirs`, deren Committer-Zeit in einem der Fenster `(Start, Ende)` in ms liegt.
/// Ohne Doppelte, in der Reihenfolge von `dirs`; ein Ordner, den Git nicht lesen kann, wird
/// übersprungen.
pub fn own_commits(dirs: &[ScanDir], windows: &[(f64, f64)]) -> Vec<String> {
    // Nebeneinander gelesen: acht innere Repositories nacheinander kosten gemessen gut 1 s je
    // Git-Befehl des Agenten.
    let per_dir: Vec<Vec<String>> = thread::scope(|scope| {
        let handles: Vec<ScopedJoinHandle<'_, Vec<String>>> = dirs
            .iter()
            .map(|scan_dir: &ScanDir| scope.spawn(move || commits_in_windows(scan_dir, windows)))
            .collect();
        handles
            .into_iter()
            .map(|handle: ScopedJoinHandle<'_, Vec<String>>| handle.join().unwrap_or_default())
            .collect()
    });
    let mut found: Vec<String> = Vec::new();
    for id in per_dir.into_iter().flatten() {
        if !found.contains(&id) {
            found.push(id);
        }
    }
    found
}

fn commits_in_windows(scan_dir: &ScanDir, windows: &[(f64, f64)]) -> Vec<String> {
    let Ok(text) = git::commits_since(&scan_dir.dir, &scan_dir.base) else {
        return Vec::new();
    };
    parse_rev_list(&text)
        .into_iter()
        .filter(|entry: &RevListEntry| is_in_a_window(entry.time, windows))
        .map(|entry: RevListEntry| entry.id)
        .collect()
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
