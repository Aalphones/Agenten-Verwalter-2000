//! Der Verlauf des ausgecheckten Branches für die Übersicht der Changes (ADR 025): die letzten
//! Commits ab `HEAD` und, was im Upstream noch dazukommt. Liest nur, ohne Sperre (ADR 006).
use std::collections::HashSet;
use std::path::Path;

use crate::error::CommandError;
use crate::git;
use crate::git::model::{GitLog, GitLogCommit};

const RECORD_SEPARATOR: char = '\x1e';
const FIELD_SEPARATOR: char = '\0';
const SHORT_COMMIT_CHARS: usize = 7;
const HEAD_REF: &str = "HEAD";
const HEAD_ARROW: &str = "HEAD -> ";
const REMOTE_HEAD_SUFFIX: &str = "/HEAD";

/// `own`: die Commits der Session; ohne Upstream gilt nichts als gepusht.
pub fn read(
    dir: &Path,
    own: &HashSet<String>,
    upstream: Option<&str>,
) -> Result<GitLog, CommandError> {
    let unpushed = match upstream {
        Some(upstream) => Some(git::unpushed(dir, upstream)?),
        None => None,
    };
    let commits = parse(&git::log_graph(dir)?, |id: &str| {
        (
            own.contains(id),
            unpushed
                .as_ref()
                .is_some_and(|unpushed: &HashSet<String>| !unpushed.contains(id)),
        )
    });
    let incoming = match upstream {
        Some(upstream) => parse(&git::log_incoming(dir, upstream)?, |_: &str| (false, true)),
        None => Vec::new(),
    };
    Ok(GitLog { commits, incoming })
}

/// `flags` liefert je Commit-ID `(own, pushed)`.
fn parse(output: &str, flags: impl Fn(&str) -> (bool, bool)) -> Vec<GitLogCommit> {
    output
        .split(RECORD_SEPARATOR)
        .filter_map(|record: &str| parse_record(record.trim_start_matches(['\r', '\n']), &flags))
        .collect()
}

/// `<ID>\0<Eltern>\0<Autor>\0<Zeit>\0<Marken>\0<Betreff>`
fn parse_record(record: &str, flags: &impl Fn(&str) -> (bool, bool)) -> Option<GitLogCommit> {
    if record.is_empty() {
        return None;
    }
    let mut fields = record.split(FIELD_SEPARATOR);
    let id = fields.next()?.to_owned();
    let parents = fields
        .next()?
        .split_whitespace()
        .map(str::to_owned)
        .collect();
    let author = fields.next()?.to_owned();
    let time = fields.next()?.trim().parse::<i64>().ok()?;
    let refs = parse_refs(fields.next()?);
    let subject = fields.next()?.to_owned();
    let (own, pushed) = flags(&id);
    Some(GitLogCommit {
        short_id: id.chars().take(SHORT_COMMIT_CHARS).collect(),
        id,
        parents,
        author,
        time,
        subject,
        refs,
        own,
        pushed,
    })
}

/// `%D` mit `--decorate=full`: `HEAD -> refs/heads/main, refs/remotes/origin/main, tag: refs/tags/v1`.
/// `HEAD` und `<remote>/HEAD` fallen weg; die Namen bleiben voll, denn nur so unterscheidet die
/// Oberfläche einen Branch `feature/x` von einem Remote-Branch `origin/x`.
fn parse_refs(decorations: &str) -> Vec<String> {
    decorations
        .split(", ")
        .map(|reference: &str| {
            reference
                .strip_prefix(HEAD_ARROW)
                .unwrap_or(reference)
                .trim()
        })
        .filter(|reference: &&str| {
            !reference.is_empty()
                && *reference != HEAD_REF
                && !reference.ends_with(REMOTE_HEAD_SUFFIX)
        })
        .map(str::to_owned)
        .collect()
}
