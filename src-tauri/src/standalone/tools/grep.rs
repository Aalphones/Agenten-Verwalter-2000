//! `Grep`: Dateiinhalte mit einem regulären Ausdruck durchsuchen.
use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;

use globset::GlobMatcher;
use regex::{Regex, RegexBuilder};
use serde_json::Value;

use super::{
    INTERRUPTED, ToolContext, checked_path, is_binary, optional_count, optional_flag,
    optional_string, required_string, shortened_line, walk,
};

const DEFAULT_HEAD_LIMIT: usize = 250;
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Clone, Copy, PartialEq, Eq)]
enum OutputMode {
    Content,
    FilesWithMatches,
    Count,
}

/// Dateifilter aus `glob`. Ohne `/` im Muster zählt nur der Dateiname — wie bei ripgrep, damit
/// `*.ts` auch in Unterordnern trifft.
struct FileFilter {
    matcher: GlobMatcher,
    is_name_only: bool,
}

impl FileFilter {
    fn accepts(&self, path: &Path, base: &Path) -> bool {
        if self.is_name_only {
            return path
                .file_name()
                .is_some_and(|name: &std::ffi::OsStr| self.matcher.is_match(name));
        }
        self.matcher.is_match(walk::relative(path, base))
    }
}

pub fn run(input: &Value, context: &mut ToolContext) -> Result<String, String> {
    let regex = RegexBuilder::new(required_string(input, "pattern")?)
        .case_insensitive(optional_flag(input, "-i"))
        .build()
        .map_err(|error: regex::Error| format!("Ungültiges Muster: {error}"))?;
    let base = match optional_string(input, "path") {
        Some(raw) => checked_path(context, raw, false)?,
        None => context.cwd.clone(),
    };
    if !base.exists() {
        return Err(format!("Pfad nicht gefunden: {}", base.display()));
    }
    let filter = match optional_string(input, "glob") {
        Some(pattern) => Some(FileFilter {
            matcher: walk::matcher(pattern)?,
            is_name_only: !pattern.contains(['/', '\\']),
        }),
        None => None,
    };
    let mode = output_mode(optional_string(input, "output_mode"))?;
    let head_limit = optional_count(input, "head_limit").unwrap_or(DEFAULT_HEAD_LIMIT);
    let mut lines: Vec<String> = Vec::new();
    for path in walk::files(&base) {
        if context.cancel.load(Ordering::SeqCst) {
            return Err(INTERRUPTED.to_owned());
        }
        if filter
            .as_ref()
            .is_some_and(|filter: &FileFilter| !filter.accepts(&path, &base))
        {
            continue;
        }
        let Some(text) = searchable_text(&path) else {
            continue;
        };
        collect_matches(&path, &text, &regex, mode, &mut lines);
        // Einer mehr als erlaubt reicht, um „gekürzt“ zu melden.
        if head_limit > 0 && lines.len() > head_limit {
            break;
        }
    }
    if lines.is_empty() {
        return Ok("Keine Treffer.".to_owned());
    }
    // `head_limit` 0 heißt: keine Grenze.
    if head_limit > 0 && lines.len() > head_limit {
        lines.truncate(head_limit);
        lines.push(format!("… (gekürzt bei {head_limit})"));
    }
    Ok(lines.join("\n"))
}

fn output_mode(raw: Option<&str>) -> Result<OutputMode, String> {
    match raw {
        None | Some("files_with_matches") => Ok(OutputMode::FilesWithMatches),
        Some("content") => Ok(OutputMode::Content),
        Some("count") => Ok(OutputMode::Count),
        Some(other) => Err(format!(
            "Unbekannter output_mode: {other} (content, files_with_matches oder count)"
        )),
    }
}

/// Text der Datei; zu große, unlesbare und binäre Dateien → `None`.
fn searchable_text(path: &Path) -> Option<String> {
    let size = fs::metadata(path).ok()?.len();
    if size > MAX_FILE_BYTES {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    if is_binary(&bytes) {
        return None;
    }
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

fn collect_matches(
    path: &Path,
    text: &str,
    regex: &Regex,
    mode: OutputMode,
    lines: &mut Vec<String>,
) {
    let display = path.display();
    match mode {
        OutputMode::FilesWithMatches => {
            if text.lines().any(|line: &str| regex.is_match(line)) {
                lines.push(display.to_string());
            }
        }
        OutputMode::Count => {
            let count = text
                .lines()
                .filter(|line: &&str| regex.is_match(line))
                .count();
            if count > 0 {
                lines.push(format!("{display}:{count}"));
            }
        }
        OutputMode::Content => {
            for (index, line) in text.lines().enumerate() {
                if regex.is_match(line) {
                    lines.push(format!("{display}:{}:{}", index + 1, shortened_line(line)));
                }
            }
        }
    }
}
