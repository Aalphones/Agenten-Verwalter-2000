//! Der Weg aus dem Verlauf (ADR 075): solange keine Ordnung vorliegt, die Etappen aus den
//! Werkzeug-Aufrufen der Stationen — ohne Modell. Eine neue Etappe beginnt mit einem anderen
//! Repository oder nach einem Commit. Ohne App und ohne Datenbank.
use serde_json::Value;

use super::anchor;
use super::model::ReportWayStep;
use super::tidy::StationTrace;
use crate::agents::event::ChatEntry;
use crate::db::tool_details::ToolSummary;

/// Die eigenen Werkzeuge der App sind keine Arbeit an der Phase.
const OWN_TOOL_PREFIX: &str = "mcp__verwalter__";
const COMMAND_TOOLS: [&str; 2] = ["Bash", "PowerShell"];
const GREP_TOOL: &str = "Grep";
const READ_TOOLS: [&str; 3] = ["Read", GREP_TOOL, "Glob"];
/// Steht im `target` einer Suche zwischen Muster und Ordner (`"muster" in <Ordner>`).
const GREP_PATH_MARKER: &str = "\" in ";
const UNNAMED_STEP: &str = "Lesen und Suchen";
const EARLIER_STEPS: &str = "Frühere Schritte";
const MAX_STEPS: usize = 12;
const MAX_STEP_FILES: usize = 8;
const SHORT_COMMIT_CHARS: usize = 7;
const COMMIT_CHARS: std::ops::RangeInclusive<usize> = SHORT_COMMIT_CHARS..=40;

/// Eine Etappe, bevor sie ihren Stopp kennt.
pub struct HistoryStep {
    /// `stop` bleibt leer.
    pub step: ReportWayStep,
    /// Der erste geschriebene Pfad, wie der Aufruf ihn nennt: an ihm hängt der Stopp.
    pub first_written: Option<String>,
}

/// Die Etappen aller Stationen in Verlaufsreihenfolge, höchstens `MAX_STEPS`. `locate` bildet einen
/// Pfad auf das Label seines Repositorys ab; `running` markiert die letzte Etappe.
pub fn history_way(
    traces: &[StationTrace],
    locate: &dyn Fn(&str) -> Option<String>,
    running: bool,
) -> Vec<HistoryStep> {
    let mut steps: Vec<HistoryStep> = Vec::new();
    let mut is_closed = true;
    for station in traces {
        for entry in &station.entries {
            let ChatEntry::Tool {
                at,
                tool_use_id,
                tool,
                target,
                description,
                ..
            } = entry
            else {
                continue;
            };
            if tool.starts_with(OWN_TOOL_PREFIX) {
                continue;
            }
            let call = Call::of(entry, tool, target, station.details.get(tool_use_id));
            let location = call.path.as_deref().and_then(locate);
            let is_elsewhere = steps.last().is_some_and(|current: &HistoryStep| {
                match (&current.step.location, &location) {
                    (Some(current), Some(next)) => current != next,
                    _ => false,
                }
            });
            if is_closed || is_elsewhere {
                steps.push(empty_step(*at));
            }
            let Some(current) = steps.last_mut() else {
                continue;
            };
            is_closed = false;
            if current.step.location.is_none() {
                current.step.location = location;
            }
            match call.kind {
                CallKind::Write => {
                    current.step.writes = current.step.writes.saturating_add(1);
                    if let Some(path) = call.path {
                        add_file(&mut current.step.files, file_name(&path));
                        current.first_written.get_or_insert(path);
                    }
                }
                CallKind::Read => {
                    current.step.reads = current.step.reads.saturating_add(1);
                }
                CallKind::Command => {
                    if let Some(description) = description.as_deref().map(single_line)
                        && !description.is_empty()
                    {
                        current.step.calls.push(description);
                    }
                    if let Some(commit) = call.commit {
                        current.step.commit = Some(commit);
                        is_closed = true;
                    }
                }
                CallKind::Other => {}
            }
        }
    }
    for current in &mut steps {
        if let Some(first) = current.step.calls.first() {
            current.step.text.clone_from(first);
        }
    }
    let mut steps = merge_earlier(steps);
    if running && let Some(last) = steps.last_mut() {
        last.step.running = true;
    }
    steps
}

enum CallKind {
    Write,
    Read,
    Command,
    Other,
}

/// Was ein Aufruf zum Weg beiträgt.
struct Call {
    kind: CallKind,
    /// Wo er gearbeitet hat; Befehle haben keinen Ort.
    path: Option<String>,
    /// Der Kurz-Hash, wenn der Befehl committet hat.
    commit: Option<String>,
}

impl Call {
    fn of(entry: &ChatEntry, tool: &str, target: &str, summary: Option<&ToolSummary>) -> Self {
        if anchor::is_write(entry) {
            return Call {
                kind: CallKind::Write,
                path: path_of(target, summary),
                commit: None,
            };
        }
        if READ_TOOLS.contains(&tool) {
            let searched = if tool == GREP_TOOL {
                target
                    .rsplit_once(GREP_PATH_MARKER)
                    .map(|(_, folder): (&str, &str)| folder)
            } else {
                Some(target)
            };
            return Call {
                kind: CallKind::Read,
                path: searched.and_then(|searched: &str| path_of(searched, summary)),
                commit: None,
            };
        }
        if COMMAND_TOOLS.contains(&tool) {
            return Call {
                kind: CallKind::Command,
                path: None,
                commit: summary
                    .and_then(|summary: &ToolSummary| committed_in(&summary.output_head)),
            };
        }
        Call {
            kind: CallKind::Other,
            path: None,
            commit: None,
        }
    }
}

fn path_of(target: &str, summary: Option<&ToolSummary>) -> Option<String> {
    let input: Option<Value> =
        summary.and_then(|summary: &ToolSummary| serde_json::from_str(&summary.input).ok());
    anchor::written_path(target, input.as_ref()).map(|path| path.to_string_lossy().into_owned())
}

/// Der Kurz-Hash aus der Kopfzeile, die `git commit` druckt: `[<Branch> <Hash>] <Betreff>`.
fn committed_in(output: &str) -> Option<String> {
    output.lines().find_map(|line: &str| {
        let (head, _) = line.strip_prefix('[')?.split_once(']')?;
        let (branch, commit) = head.split_once(' ')?;
        let is_head = !branch.is_empty()
            && !branch.contains(char::is_whitespace)
            && COMMIT_CHARS.contains(&commit.len())
            && commit
                .chars()
                .all(|sign: char| matches!(sign, '0'..='9' | 'a'..='f'));
        is_head.then(|| commit.chars().take(SHORT_COMMIT_CHARS).collect())
    })
}

fn empty_step(at: Option<f64>) -> HistoryStep {
    HistoryStep {
        step: ReportWayStep {
            text: UNNAMED_STEP.to_owned(),
            files: Vec::new(),
            detour: false,
            stop: None,
            at,
            location: None,
            commit: None,
            calls: Vec::new(),
            reads: 0,
            writes: 0,
            running: false,
        },
        first_written: None,
    }
}

/// Über der Grenze werden die ältesten Etappen zu einer; ihr Ort bleibt nur, wenn alle ihn teilen.
fn merge_earlier(mut steps: Vec<HistoryStep>) -> Vec<HistoryStep> {
    if steps.len() <= MAX_STEPS {
        return steps;
    }
    let kept = steps.split_off(steps.len() - (MAX_STEPS - 1));
    let mut earlier = steps.into_iter();
    let Some(mut merged) = earlier.next() else {
        return kept;
    };
    merged.step.text = EARLIER_STEPS.to_owned();
    for next in earlier {
        if merged.step.location != next.step.location {
            merged.step.location = None;
        }
        for file in next.step.files {
            add_file(&mut merged.step.files, file);
        }
        merged.step.calls.extend(next.step.calls);
        merged.step.reads = merged.step.reads.saturating_add(next.step.reads);
        merged.step.writes = merged.step.writes.saturating_add(next.step.writes);
        merged.step.commit = next.step.commit.or(merged.step.commit);
        merged.first_written = merged.first_written.or(next.first_written);
    }
    std::iter::once(merged).chain(kept).collect()
}

fn add_file(files: &mut Vec<String>, name: String) {
    if files.len() < MAX_STEP_FILES && !files.contains(&name) {
        files.push(name);
    }
}

/// Auch für einen Windows-Pfad unter Linux und macOS.
fn file_name(path: &str) -> String {
    path.rsplit(['/', '\\']).next().unwrap_or(path).to_owned()
}

fn single_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<&str>>().join(" ")
}
