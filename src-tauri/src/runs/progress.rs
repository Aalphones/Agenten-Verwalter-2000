//! Fortschritt und letzte Zeile aus dem Ende der Ausgabe eines laufenden Befehls.
use std::sync::LazyLock;

use regex::{Captures, Regex};

use super::model::{ProgressUnit, RunProgress};
use crate::background::output::strip_ansi;

/// So viel vom Ende der Ausgabedatei liest der Wächter je Durchgang.
pub const TAIL_BYTES: u64 = 4096;
/// Längere letzte Zeilen werden gekürzt.
pub const MAX_LAST_LINE_CHARS: usize = 160;

const PERCENT_TOTAL: u32 = 100;
/// Eine Zählung bis 1 sagt nichts über den Fortschritt.
const MIN_COUNT_TOTAL: u32 = 2;

/// `12/40`, `[ 3 / 9]`, `(7/12)` — nicht innerhalb eines Pfads wie `C:/a/2/3/x`.
static COUNT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:^|[\s\[(])(\d{1,7})\s?/\s?(\d{1,7})(?:$|[\s\]),.:;])")
        .expect("Muster ist ein Literal")
});
/// `45%`, `[ 45.5 %]`.
static PERCENT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:^|[\s\[(])(\d{1,3})(?:[.,]\d+)?\s?%").expect("Muster ist ein Literal")
});

/// Fortschritt der jüngsten Zeile mit Treffer und die letzte nicht leere Zeile.
pub fn read(tail: &str) -> (Option<RunProgress>, Option<String>) {
    let plain = strip_ansi(tail);
    let lines: Vec<&str> = plain
        .split(['\n', '\r'])
        .map(str::trim)
        .filter(|line: &&str| !line.is_empty())
        .collect();
    let last_line = lines.last().map(|line: &&str| shorten(line));
    let progress = lines
        .iter()
        .rev()
        .find_map(|line: &&str| line_progress(line));
    (progress, last_line)
}

fn line_progress(line: &str) -> Option<RunProgress> {
    let count = COUNT_PATTERN
        .captures_iter(line)
        .filter_map(|captures: Captures| count_of(&captures))
        .last();
    if count.is_some() {
        return count;
    }
    PERCENT_PATTERN
        .captures_iter(line)
        .filter_map(|captures: Captures| percent_of(&captures))
        .last()
}

fn count_of(captures: &Captures) -> Option<RunProgress> {
    let done: u32 = captures.get(1)?.as_str().parse().ok()?;
    let total: u32 = captures.get(2)?.as_str().parse().ok()?;
    if total < MIN_COUNT_TOTAL || done > total {
        return None;
    }
    Some(RunProgress {
        done,
        total,
        unit: ProgressUnit::Count,
    })
}

fn percent_of(captures: &Captures) -> Option<RunProgress> {
    let done: u32 = captures.get(1)?.as_str().parse().ok()?;
    if done > PERCENT_TOTAL {
        return None;
    }
    Some(RunProgress {
        done,
        total: PERCENT_TOTAL,
        unit: ProgressUnit::Percent,
    })
}

fn shorten(line: &str) -> String {
    match line.char_indices().nth(MAX_LAST_LINE_CHARS) {
        Some((end, _)) => line[..end].to_owned(),
        None => line.to_owned(),
    }
}
