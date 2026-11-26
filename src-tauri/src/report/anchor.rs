//! Der Ort eines Eintrags: aus `at` oder aus dem letzten Schreib-Aufruf der Session, aufgelöst
//! gegen die Repository-Einträge der Changes.
use std::collections::HashMap;
use std::fs;
use std::ops::ControlFlow;
use std::path::{Component, Path, PathBuf};

use rusqlite::Connection;
use serde_json::Value;

use crate::agents::event::{ChatEntry, ToolState};
use crate::changes::attribution::normalize_path;
use crate::changes::sources::Source;
use crate::db::chat_entries;
use crate::db::tool_details::{self, ToolSummary};
use crate::error::CommandError;
use crate::filesystem::native_path;

pub const AMBIGUOUS: &str = "Stelle nicht eindeutig: gib at an.";
const OUTSIDE_REPOSITORIES: &str = "Datei liegt in keinem Repository dieser Session.";
const AT_FORM: &str = "at: erwartet „<pfad>:<zeile>“ oder „<pfad>:<von>-<bis>“";
const MAX_AT_LINES: u32 = 80;
/// So viele Zeilen zeigt der Ort eines `Write`.
const MAX_WRITE_LINES: u32 = 40;
const WRITE_TOOL: &str = "Write";
const EDIT_TOOL: &str = "Edit";
const MULTI_EDIT_TOOL: &str = "MultiEdit";
/// Mit diesem Zeichen endet ein gekürztes `target`.
const SHORTENED: char = '…';

/// Eine Datei in einem Repository-Eintrag.
pub struct ResolvedPath {
    pub repository_key: String,
    /// Relativ zum Eintrag, mit `/`.
    pub path: String,
    pub absolute: PathBuf,
}

/// Zerlegt `at` in Pfad, erste und letzte Zeile.
pub fn parse_at(at: &str) -> Result<(String, u32, u32), String> {
    let (path, lines) = at
        .trim()
        .rsplit_once(':')
        .ok_or_else(|| AT_FORM.to_owned())?;
    let (from_text, to_text) = lines.split_once('-').unwrap_or((lines, lines));
    let (Ok(from), Ok(to)) = (
        from_text.trim().parse::<u32>(),
        to_text.trim().parse::<u32>(),
    ) else {
        return Err(AT_FORM.to_owned());
    };
    if path.is_empty() || from == 0 {
        return Err(AT_FORM.to_owned());
    }
    if from > to {
        return Err(format!("at: Zeile {from} liegt hinter Zeile {to}"));
    }
    if to - from >= MAX_AT_LINES {
        return Err(format!("at: höchstens {MAX_AT_LINES} Zeilen"));
    }
    Ok((path.to_owned(), from, to))
}

/// Ein relativer Pfad muss in genau einem Eintrag eine Datei sein; ein absoluter muss unter dem
/// Ordner eines Eintrags liegen. Bei verschachtelten Ordnern gilt der innerste.
pub fn resolve_path(sources: &[Source], path: &str) -> Result<ResolvedPath, String> {
    let given = native_path(path);
    // `..` führte an der Prüfung gegen die Ordner vorbei.
    if given
        .components()
        .any(|component: Component<'_>| component == Component::ParentDir)
    {
        return Err(OUTSIDE_REPOSITORIES.to_owned());
    }
    if given.is_absolute() {
        return attribute(sources, &given);
    }
    if given.has_root() {
        return Err(OUTSIDE_REPOSITORIES.to_owned());
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    for source in sources {
        let file = source.dir.join(&given);
        let is_new = !candidates
            .iter()
            .any(|known: &PathBuf| key_of(known) == key_of(&file));
        if is_new && file.is_file() {
            candidates.push(file);
        }
    }
    match candidates.as_slice() {
        [] => Err(OUTSIDE_REPOSITORIES.to_owned()),
        [only] => attribute(sources, only),
        several => {
            let listed: Vec<String> = several
                .iter()
                .map(|file: &PathBuf| file.display().to_string())
                .collect();
            Err(format!(
                "Stelle nicht eindeutig: „{path}“ gibt es mehrfach ({}). Gib in at den \
                 absoluten Pfad an.",
                listed.join(", ")
            ))
        }
    }
}

fn attribute(sources: &[Source], file: &Path) -> Result<ResolvedPath, String> {
    let file_key = key_of(file);
    let owner = sources
        .iter()
        .filter(|source: &&Source| {
            let prefix = format!("{}{}", key_of(&source.dir), std::path::MAIN_SEPARATOR);
            file_key.starts_with(&prefix)
        })
        .max_by_key(|source: &&Source| segments(&source.dir).len())
        .ok_or_else(|| OUTSIDE_REPOSITORIES.to_owned())?;
    // Aus dem Pfad selbst, nicht aus dem Vergleichsschlüssel: der ist unter Windows klein.
    let relative = segments(file)
        .into_iter()
        .skip(segments(&owner.dir).len())
        .collect::<Vec<String>>()
        .join("/");
    Ok(ResolvedPath {
        repository_key: owner.key.clone(),
        path: relative,
        absolute: file.to_path_buf(),
    })
}

fn key_of(path: &Path) -> String {
    normalize_path(&path.to_string_lossy())
}

fn segments(path: &Path) -> Vec<String> {
    path.components()
        .filter_map(|component: Component<'_>| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect()
}

/// Was `last_edit_anchor` aus der Datenbank braucht: nur der letzte Schreib-Aufruf der Session
/// und die Eingaben der Aufrufe. Gelungen oder noch offen; ein gescheiterter hat nichts geschrieben.
pub fn load_last_write(
    connection: &Connection,
    session_id: &str,
) -> Result<(Vec<ChatEntry>, HashMap<String, ToolSummary>), CommandError> {
    let mut last: Option<ChatEntry> = None;
    chat_entries::for_each_payload(connection, session_id, |payload: &str| {
        if let Ok(entry) = serde_json::from_str::<ChatEntry>(payload)
            && is_write(&entry)
        {
            last = Some(entry);
        }
        ControlFlow::Continue(())
    })?;
    let details = tool_details::load_summaries(connection, session_id)?;
    Ok((last.into_iter().collect(), details))
}

fn is_write(entry: &ChatEntry) -> bool {
    let ChatEntry::Tool { tool, state, .. } = entry else {
        return false;
    };
    [WRITE_TOOL, EDIT_TOOL, MULTI_EDIT_TOOL].contains(&tool.as_str())
        && !matches!(state, ToolState::Failed | ToolState::Interrupted)
}

/// Der Ort eines `report_note` ohne `at`: der letzte Schreib-Aufruf der Session. Bei `Edit` und
/// `MultiEdit` die Fundstelle des (letzten) `new_string`, nur wenn die Datei ihn genau einmal
/// enthält; bei `Write` der Anfang der Datei.
pub fn last_edit_anchor(
    entries: &[ChatEntry],
    details: &HashMap<String, ToolSummary>,
    read: impl Fn(&Path) -> Option<String>,
) -> Result<(PathBuf, u32, u32), String> {
    let ambiguous = || AMBIGUOUS.to_owned();
    let last = entries
        .iter()
        .rev()
        .find(|entry: &&ChatEntry| is_write(entry));
    let Some(ChatEntry::Tool {
        tool_use_id,
        tool,
        target,
        ..
    }) = last
    else {
        return Err(ambiguous());
    };
    let input: Option<Value> = details
        .get(tool_use_id)
        .and_then(|summary: &ToolSummary| serde_json::from_str(&summary.input).ok());
    let path = if target.ends_with(SHORTENED) {
        input
            .as_ref()
            .and_then(|input: &Value| input.get("file_path"))
            .and_then(Value::as_str)
            .ok_or_else(ambiguous)?
    } else {
        target.as_str()
    };
    let path = native_path(path);
    let content = read(&path).ok_or_else(ambiguous)?;
    if tool == WRITE_TOOL {
        let count = u32::try_from(content.lines().count()).unwrap_or(u32::MAX);
        if count == 0 {
            return Err(ambiguous());
        }
        return Ok((path, 1, count.min(MAX_WRITE_LINES)));
    }
    // Eine gekürzte Eingabe ist kein gültiges JSON mehr und fällt hier heraus.
    let edit: Option<&Value> = if tool == MULTI_EDIT_TOOL {
        input
            .as_ref()
            .and_then(|input: &Value| input.get("edits"))
            .and_then(Value::as_array)
            .and_then(|edits: &Vec<Value>| edits.last())
    } else {
        input.as_ref()
    };
    let new_string = edit
        .and_then(|edit: &Value| edit.get("new_string"))
        .and_then(Value::as_str)
        .ok_or_else(ambiguous)?;
    let (from, to) = unique_lines(&content, new_string).ok_or_else(ambiguous)?;
    Ok((path, from, to))
}

/// Die Zeilen, in denen `needle` steht, wenn der Text sie genau einmal enthält. Leerzeilen am
/// Rand des Gesuchten zählen nicht zum Ort.
fn unique_lines(content: &str, needle: &str) -> Option<(u32, u32)> {
    let content = content.replace("\r\n", "\n");
    let needle = needle.replace("\r\n", "\n");
    let core = needle.trim_matches('\n');
    if core.trim().is_empty() {
        return None;
    }
    let start = content.find(&needle)?;
    let after_start = start + content[start..].chars().next()?.len_utf8();
    if content[after_start..].contains(&needle) {
        return None;
    }
    let leading = needle.len() - needle.trim_start_matches('\n').len();
    let before = &content[..start + leading];
    let from = u32::try_from(before.matches('\n').count()).ok()? + 1;
    let to = from + u32::try_from(core.matches('\n').count()).ok()?;
    Some((from, to))
}

/// Die Zeilen `from`..`to` (ab 1, einschließlich) ohne Zeilenende-Zeichen am Ende; `None`, wenn
/// die Datei kürzer ist.
pub fn lines_text(content: &str, from: u32, to: u32) -> Option<String> {
    let skipped = usize::try_from(from.checked_sub(1)?).ok()?;
    let wanted = usize::try_from(to.checked_sub(from)?).ok()? + 1;
    let lines: Vec<&str> = content.lines().skip(skipped).take(wanted).collect();
    (lines.len() == wanted).then(|| lines.join("\n"))
}

/// Der Inhalt einer Datei als Text; ungültige Bytes werden ersetzt, damit auch eine Datei in
/// anderer Kodierung einen Ort bekommt.
pub fn read_text(path: &Path) -> Option<String> {
    fs::read(path)
        .ok()
        .map(|bytes: Vec<u8>| String::from_utf8_lossy(&bytes).into_owned())
}
