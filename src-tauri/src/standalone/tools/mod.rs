//! Werkzeuge, die der Agent dem Modell anbietet — Namen und Parameter wie bei Claude Code, damit
//! Anweisungen, Hooks und die Übersetzung im Verwalter unverändert greifen.
mod ask;
mod edit;
mod glob;
mod grep;
mod read;
pub mod shell;
mod todo;
mod walk;
mod write;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use serde_json::{Value, json};

use super::paths::{self, Access, Roots};

pub const READ_TOOL: &str = "Read";
pub const WRITE_TOOL: &str = "Write";
pub const EDIT_TOOL: &str = "Edit";
pub const GLOB_TOOL: &str = "Glob";
pub const GREP_TOOL: &str = "Grep";
pub const TODO_TOOL: &str = "TodoWrite";
pub const BASH_TOOL: &str = "Bash";
pub const POWERSHELL_TOOL: &str = "PowerShell";
pub const ASK_USER_TOOL: &str = "AskUserQuestion";

/// Ergebnis eines Werkzeugs, das wegen Esc nicht (fertig) lief.
pub const INTERRUPTED: &str = "Vom Benutzer unterbrochen.";

/// Längere Ausgaben behalten Anfang und Ende je zur Hälfte.
const OUTPUT_MAX_CHARS: usize = 30_000;
const OUTPUT_KEPT_CHARS: usize = OUTPUT_MAX_CHARS / 2;
const SNIFF_BYTES: usize = 8 * 1024;
/// Längere Zeilen kürzen Read und Grep — sonst füllt eine minifizierte Datei den Kontext.
const LINE_MAX_CHARS: usize = 2000;

pub struct ToolContext {
    pub cwd: PathBuf,
    pub roots: Roots,
    /// Klein geschriebene Pfade aller Dateien, die das Modell gelesen oder selbst geschrieben hat —
    /// nur die darf es ändern.
    pub read_files: HashSet<String>,
    /// Abbruch des laufenden Turns; setzt die Session zu Beginn jedes Turns neu.
    pub cancel: Arc<AtomicBool>,
    /// Nur für den einen Aufruf, dessen Pfad außerhalb der Grenze der Benutzer erlaubt hat.
    pub allow_outside: bool,
}

impl ToolContext {
    fn remember_read(&mut self, path: &Path) {
        self.read_files.insert(file_key(path));
    }

    fn has_read(&self, path: &Path) -> bool {
        self.read_files.contains(&file_key(path))
    }
}

pub struct ToolOutput {
    pub text: String,
    pub is_error: bool,
}

/// Die Werkzeug-Beschreibungen für die Modellanfrage (OpenAI-Format).
pub fn definitions() -> Vec<Value> {
    vec![
        function(
            READ_TOOL,
            "Reads a text file and returns its lines with line numbers (\"     1\\tline\"). \
             Reads up to 2000 lines from offset (1-based); use offset and limit for longer files. \
             Use Glob for directories.",
            json!({
                "file_path": { "type": "string", "description": "Absolute or relative path of the file" },
                "offset": { "type": "integer", "description": "First line to read, 1-based" },
                "limit": { "type": "integer", "description": "Number of lines to read" },
            }),
            &["file_path"],
        ),
        function(
            WRITE_TOOL,
            "Writes a file, replacing its content; missing folders are created. \
             An existing file must be read with Read first. Prefer Edit for changes to existing files.",
            json!({
                "file_path": { "type": "string", "description": "Absolute or relative path of the file" },
                "content": { "type": "string", "description": "The complete new content" },
            }),
            &["file_path", "content"],
        ),
        function(
            EDIT_TOOL,
            "Replaces text in a file. Read the file first. old_string must match exactly once \
             (copy it from the Read output without the line-number prefix) unless replace_all is true.",
            json!({
                "file_path": { "type": "string", "description": "Absolute or relative path of the file" },
                "old_string": { "type": "string", "description": "Exact text to replace" },
                "new_string": { "type": "string", "description": "Replacement text, different from old_string" },
                "replace_all": { "type": "boolean", "description": "Replace every occurrence" },
            }),
            &["file_path", "old_string", "new_string"],
        ),
        function(
            GLOB_TOOL,
            "Finds files by glob pattern (e.g. \"**/*.rs\", \"src/**/*.tsx\") below path, newest first, \
             at most 200. Files ignored by .gitignore are skipped; hidden folders like .claude are searched.",
            json!({
                "pattern": { "type": "string", "description": "Glob pattern relative to path" },
                "path": { "type": "string", "description": "Folder to search in; default is the working directory" },
            }),
            &["pattern"],
        ),
        function(
            GREP_TOOL,
            "Searches file contents with a regular expression (Rust regex syntax). \
             output_mode: files_with_matches (default, file paths), content (path:line:text) or count (path:count). \
             glob filters files (e.g. \"*.ts\"); head_limit caps the result lines (default 250).",
            json!({
                "pattern": { "type": "string", "description": "Regular expression" },
                "path": { "type": "string", "description": "File or folder to search in; default is the working directory" },
                "glob": { "type": "string", "description": "Only files matching this glob" },
                "output_mode": { "type": "string", "enum": ["content", "files_with_matches", "count"] },
                "-i": { "type": "boolean", "description": "Case insensitive" },
                "head_limit": { "type": "integer", "description": "Maximum number of result lines" },
            }),
            &["pattern"],
        ),
        function(
            TODO_TOOL,
            "Replaces the task list shown to the user. Use it for work with several steps; \
             keep exactly one task in_progress and mark tasks completed as soon as they are done.",
            json!({
                "todos": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "content": { "type": "string", "description": "The task, imperative" },
                            "status": { "type": "string", "enum": ["pending", "in_progress", "completed"] },
                            "activeForm": { "type": "string", "description": "The task in present continuous form" },
                        },
                        "required": ["content", "status", "activeForm"],
                    },
                },
            }),
            &["todos"],
        ),
        function(
            BASH_TOOL,
            "Runs a command in Git Bash on Windows (bash -c) in the working directory and returns \
             stdout and stderr. Use Unix syntax and forward slashes. timeout in milliseconds \
             (default 120000, max 600000). Background processes are not supported; the command \
             must finish on its own.",
            shell_properties(),
            &["command"],
        ),
        function(
            POWERSHELL_TOOL,
            "Runs a command in Windows PowerShell 5.1 in the working directory and returns stdout \
             and stderr. Use PowerShell syntax (no && or ||; use `; if ($?) { … }`). timeout in \
             milliseconds (default 120000, max 600000). Background processes are not supported; \
             the command must finish on its own.",
            shell_properties(),
            &["command"],
        ),
        function(
            ASK_USER_TOOL,
            "Asks the user one or more multiple-choice questions and returns the answers. \
             Use it when a decision is genuinely the user's; each question has 2-4 options.",
            json!({
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": { "type": "string", "description": "The complete question" },
                            "header": { "type": "string", "description": "Very short label" },
                            "options": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": { "type": "string" },
                                        "description": { "type": "string" },
                                    },
                                    "required": ["label", "description"],
                                },
                            },
                            "multiSelect": { "type": "boolean" },
                        },
                        "required": ["question", "header", "options", "multiSelect"],
                    },
                },
            }),
            &["questions"],
        ),
    ]
}

fn shell_properties() -> Value {
    json!({
        "command": { "type": "string", "description": "The command to run" },
        "timeout": { "type": "integer", "description": "Timeout in milliseconds" },
        "description": { "type": "string", "description": "What the command does, in a few words" },
    })
}

/// Namen der Werkzeuge in `definitions` — für die `init`-Zeile.
pub fn names(definitions: &[Value]) -> Vec<String> {
    definitions
        .iter()
        .filter_map(|definition: &Value| {
            definition.pointer("/function/name").and_then(Value::as_str)
        })
        .map(str::to_owned)
        .collect()
}

pub fn run(name: &str, input: &Value, context: &mut ToolContext) -> ToolOutput {
    let result = match name {
        READ_TOOL => read::run(input, context),
        WRITE_TOOL => write::run(input, context),
        EDIT_TOOL => edit::run(input, context),
        GLOB_TOOL => glob::run(input, context),
        GREP_TOOL => grep::run(input, context),
        TODO_TOOL => todo::run(input),
        BASH_TOOL => shell::run(shell::ShellKind::Bash, input, context),
        POWERSHELL_TOOL => shell::run(shell::ShellKind::PowerShell, input, context),
        ASK_USER_TOOL => ask::run(input),
        unknown => Err(format!("Unbekanntes Werkzeug: {unknown}")),
    };
    match result {
        Ok(text) => ToolOutput {
            text: shortened(text),
            is_error: false,
        },
        Err(text) => ToolOutput {
            text: shortened(text),
            is_error: true,
        },
    }
}

fn function(name: &str, description: &str, properties: Value, required: &[&str]) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": { "type": "object", "properties": properties, "required": required },
        },
    })
}

fn shortened(text: String) -> String {
    let length = text.chars().count();
    if length <= OUTPUT_MAX_CHARS {
        return text;
    }
    let head: String = text.chars().take(OUTPUT_KEPT_CHARS).collect();
    let tail: String = text.chars().skip(length - OUTPUT_KEPT_CHARS).collect();
    let cut = length - 2 * OUTPUT_KEPT_CHARS;
    format!("{head}\n… ({cut} Zeichen gekürzt) …\n{tail}")
}

fn file_key(path: &Path) -> String {
    path.to_string_lossy().to_lowercase()
}

/// Der Pfad, den ein Datei-Werkzeug anfasst — für Rechte und Pfadgrenze vor dem Aufruf. Glob und
/// Grep ohne `path` bleiben im Arbeitsordner und haben deshalb keinen.
pub fn path_argument<'a>(name: &str, input: &'a Value) -> Option<&'a str> {
    match name {
        READ_TOOL | WRITE_TOOL | EDIT_TOOL => input.get("file_path").and_then(Value::as_str),
        GLOB_TOOL | GREP_TOOL => optional_string(input, "path"),
        _ => None,
    }
}

pub fn is_writing(name: &str) -> bool {
    matches!(name, WRITE_TOOL | EDIT_TOOL)
}

/// Pfad aus einem Parameter, geprüft gegen die Pfadgrenze; `needs_write` verlangt Schreibzugriff.
fn checked_path(context: &ToolContext, raw: &str, needs_write: bool) -> Result<PathBuf, String> {
    let path = paths::resolve(&context.cwd, raw);
    match context.roots.access(&path) {
        Access::Write => Ok(path),
        Access::ReadOnly if !needs_write => Ok(path),
        Access::ReadOnly => Err(format!("Nur lesbar: {}", path.display())),
        Access::Outside if context.allow_outside => Ok(path),
        Access::Outside => Err(format!(
            "Pfad außerhalb von Workspace und Repositories: {}",
            path.display()
        )),
    }
}

fn required_string<'a>(input: &'a Value, field: &str) -> Result<&'a str, String> {
    input
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Parameter {field} fehlt oder ist kein Text"))
}

fn optional_string<'a>(input: &'a Value, field: &str) -> Option<&'a str> {
    input
        .get(field)
        .and_then(Value::as_str)
        .filter(|text: &&str| !text.trim().is_empty())
}

/// Kleine Modelle schicken Zahlen und Wahrheitswerte gern als Text — beides wird angenommen.
fn optional_count(input: &Value, field: &str) -> Option<usize> {
    let value = input.get(field)?;
    let number = value.as_u64().or_else(|| {
        value
            .as_str()
            .and_then(|text: &str| text.trim().parse::<u64>().ok())
    })?;
    usize::try_from(number).ok()
}

fn optional_flag(input: &Value, field: &str) -> bool {
    match input.get(field) {
        Some(Value::Bool(flag)) => *flag,
        Some(Value::String(text)) => text.trim().eq_ignore_ascii_case("true"),
        _ => false,
    }
}

fn shortened_line(line: &str) -> String {
    if line.chars().count() <= LINE_MAX_CHARS {
        return line.to_owned();
    }
    let mut kept: String = line.chars().take(LINE_MAX_CHARS).collect();
    kept.push('…');
    kept
}

/// Null-Byte in den ersten 8 KB — dieselbe Faustregel wie bei Git.
fn is_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(SNIFF_BYTES).any(|byte: &u8| *byte == 0)
}
