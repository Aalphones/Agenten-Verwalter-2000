//! Übersetzt Elemente (`ThreadItem`) und Plan-Schritte von Codex in die Werkzeug-Zeilen des
//! Zeilenprotokolls — die Namen und Eingaben wie bei der Claude-Kommandozeile, damit die
//! Übersetzung des Verwalters und die Changes sie unverändert lesen (Kontrakt-Tabelle im Plan).
use std::path::Path;

use serde_json::{Value, json};

use crate::standalone::output;
use crate::standalone::paths;
use crate::standalone::tools::shortened;

const BASH_TOOL: &str = "Bash";
const WRITE_TOOL: &str = "Write";
const EDIT_TOOL: &str = "Edit";
const WEB_SEARCH_TOOL: &str = "WebSearch";
const TODO_TOOL: &str = "TodoWrite";
const MCP_PREFIX: &str = "mcp__";

const STATUS_COMPLETED: &str = "completed";
const STATUS_DECLINED: &str = "declined";
const CHANGE_ADD: &str = "add";

const COMMAND_DECLINED: &str = "Befehl abgelehnt.";
const COMMAND_FAILED: &str = "Befehl fehlgeschlagen.";
const MCP_FAILED: &str = "MCP-Aufruf fehlgeschlagen.";
const SEARCH_DONE: &str = "Suche ausgeführt.";
const PLAN_UPDATED: &str = "Aufgabenliste aktualisiert.";

/// Elemente, die der Chat nicht zeigt: die Eingabe des Benutzers, Codex' Plantext (der Plan kommt
/// als `turn/plan/updated`) und der Hinweis auf eine Verlaufs-Verdichtung.
const SILENT_TYPES: [&str; 3] = ["userMessage", "plan", "contextCompaction"];
/// Elemente, die nur beim Abschluss etwas zeigen — oder, wie `agentMessage`, die Sitzung selbst
/// behandelt.
const COMPLETION_ONLY_TYPES: [&str; 3] = ["agentMessage", "reasoning", "webSearch"];

/// `None`: ein Typ, den dieser Übersetzer nicht kennt.
pub fn started(session_id: &str, cwd: &Path, item: &Value) -> Option<Vec<Value>> {
    let item_id = text_of(item, "id");
    match type_of(item) {
        "commandExecution" => {
            let input = json!({ "command": text_of(item, "command"), "description": "" });
            Some(vec![tool_calls(
                session_id,
                vec![tool_use(item_id, BASH_TOOL, input)],
            )])
        }
        "fileChange" => {
            let calls: Vec<Value> = file_calls(cwd, item)
                .into_iter()
                .map(|call: FileCall| tool_use(&call.id, call.tool, call.input()))
                .collect();
            if calls.is_empty() {
                return Some(Vec::new());
            }
            Some(vec![tool_calls(session_id, calls)])
        }
        "mcpToolCall" => Some(vec![tool_calls(
            session_id,
            vec![tool_use(item_id, &mcp_tool_name(item), mcp_arguments(item))],
        )]),
        other if is_known_without_start(other) => Some(Vec::new()),
        _ => None,
    }
}

/// `agentMessage` fehlt hier bewusst: ihren Text braucht die Sitzung für das `result`.
pub fn completed(session_id: &str, cwd: &Path, item: &Value) -> Option<Vec<Value>> {
    let item_id = text_of(item, "id");
    match type_of(item) {
        "commandExecution" => Some(vec![tool_result_line(
            session_id,
            vec![command_result(item_id, item)],
        )]),
        "fileChange" => {
            let results: Vec<Value> = file_calls(cwd, item)
                .into_iter()
                .map(|call: FileCall| file_result(&call, text_of(item, "status")))
                .collect();
            if results.is_empty() {
                return Some(Vec::new());
            }
            Some(vec![tool_result_line(session_id, results)])
        }
        "mcpToolCall" => Some(vec![tool_result_line(
            session_id,
            vec![mcp_result(item_id, item)],
        )]),
        "webSearch" => Some(search_lines(session_id, item)),
        "reasoning" => Some(thinking_lines(session_id, item)),
        other if is_known_without_start(other) => Some(Vec::new()),
        _ => None,
    }
}

/// Die Pfade, die ein `fileChange`-Element ändert (absolut) — für die Rückfrage vor der Änderung.
pub fn change_paths(cwd: &Path, item: &Value) -> Vec<String> {
    file_calls(cwd, item)
        .into_iter()
        .map(|call: FileCall| call.path)
        .collect()
}

/// `turn/plan/updated` als `TodoWrite`-Aufruf samt Ergebnis; `call_id` muss je Aufruf neu sein.
pub fn plan_update(session_id: &str, call_id: &str, params: &Value) -> Vec<Value> {
    let todos: Vec<Value> = params
        .get("plan")
        .and_then(Value::as_array)
        .map(|steps: &Vec<Value>| {
            steps
                .iter()
                .map(|step: &Value| {
                    let label = text_of(step, "step");
                    json!({
                        "content": label,
                        "activeForm": label,
                        "status": todo_status(text_of(step, "status")),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    vec![
        tool_calls(
            session_id,
            vec![tool_use(call_id, TODO_TOOL, json!({ "todos": todos }))],
        ),
        tool_result_line(session_id, vec![tool_result(call_id, PLAN_UPDATED, false)]),
    ]
}

fn todo_status(codex_status: &str) -> &'static str {
    match codex_status {
        "inProgress" => "in_progress",
        "completed" => STATUS_COMPLETED,
        _ => "pending",
    }
}

/// Eine Änderung aus `changes`; Codex nummeriert sie nicht, der Verwalter braucht je Datei eine ID.
struct FileCall {
    id: String,
    tool: &'static str,
    path: String,
}

impl FileCall {
    fn input(&self) -> Value {
        if self.tool == WRITE_TOOL {
            json!({ "file_path": self.path, "content": "" })
        } else {
            json!({ "file_path": self.path, "old_string": "", "new_string": "" })
        }
    }
}

fn file_calls(cwd: &Path, item: &Value) -> Vec<FileCall> {
    let item_id = text_of(item, "id");
    let Some(changes) = item.get("changes").and_then(Value::as_array) else {
        return Vec::new();
    };
    changes
        .iter()
        .enumerate()
        .map(|(index, change): (usize, &Value)| {
            let is_new_file =
                change.pointer("/kind/type").and_then(Value::as_str) == Some(CHANGE_ADD);
            FileCall {
                id: format!("{item_id}-{index}"),
                tool: if is_new_file { WRITE_TOOL } else { EDIT_TOOL },
                path: paths::resolve(cwd, text_of(change, "path"))
                    .to_string_lossy()
                    .into_owned(),
            }
        })
        .collect()
}

fn file_result(call: &FileCall, status: &str) -> Value {
    match status {
        STATUS_COMPLETED => tool_result(&call.id, &format!("Datei geändert: {}", call.path), false),
        STATUS_DECLINED => tool_result(
            &call.id,
            &format!("Änderung abgelehnt: {}", call.path),
            true,
        ),
        _ => tool_result(
            &call.id,
            &format!("Änderung fehlgeschlagen: {}", call.path),
            true,
        ),
    }
}

/// Ein Fehlschlag mit Exit-Code beginnt mit `Exit code <n>` — daran liest der Verwalter ihn ab.
/// Ein abgelehnter oder gescheiterter Befehl ohne Exit-Code trägt nur seinen Text.
fn command_result(item_id: &str, item: &Value) -> Value {
    let output = shortened(text_of(item, "aggregatedOutput").to_owned());
    let exit_code = item.get("exitCode").and_then(Value::as_i64);
    let status = text_of(item, "status");
    if status == STATUS_DECLINED {
        return tool_result(item_id, &or_default(output, COMMAND_DECLINED), true);
    }
    match exit_code {
        Some(code) if code != 0 => {
            tool_result(item_id, &format!("Exit code {code}\n{output}"), true)
        }
        _ if status == "failed" => tool_result(item_id, &or_default(output, COMMAND_FAILED), true),
        _ => tool_result(item_id, &output, false),
    }
}

fn mcp_tool_name(item: &Value) -> String {
    format!(
        "{MCP_PREFIX}{}__{}",
        text_of(item, "server"),
        text_of(item, "tool")
    )
}

fn mcp_arguments(item: &Value) -> Value {
    match item.get("arguments") {
        Some(arguments) if arguments.is_object() => arguments.clone(),
        _ => json!({}),
    }
}

fn mcp_result(item_id: &str, item: &Value) -> Value {
    if let Some(message) = item.pointer("/error/message").and_then(Value::as_str) {
        return tool_result(item_id, message, true);
    }
    let text = mcp_text(item.get("result"));
    let is_error = text_of(item, "status") != STATUS_COMPLETED;
    if is_error && text.is_empty() {
        return tool_result(item_id, MCP_FAILED, true);
    }
    tool_result(item_id, &shortened(text), is_error)
}

/// Die Text-Blöcke des Ergebnisses; ohne sie der strukturierte Inhalt als Text.
fn mcp_text(result: Option<&Value>) -> String {
    let Some(result) = result else {
        return String::new();
    };
    let text = result
        .get("content")
        .and_then(Value::as_array)
        .map(|blocks: &Vec<Value>| {
            blocks
                .iter()
                .filter_map(|block: &Value| block.get("text").and_then(Value::as_str))
                .collect::<Vec<&str>>()
                .join("\n")
        })
        .unwrap_or_default();
    if !text.is_empty() {
        return text;
    }
    result
        .get("structuredContent")
        .map(Value::to_string)
        .unwrap_or_default()
}

fn search_lines(session_id: &str, item: &Value) -> Vec<Value> {
    let item_id = text_of(item, "id");
    let input = json!({ "query": search_query(item) });
    vec![
        tool_calls(session_id, vec![tool_use(item_id, WEB_SEARCH_TOOL, input)]),
        tool_result_line(session_id, vec![tool_result(item_id, SEARCH_DONE, false)]),
    ]
}

/// Die Suchanfrage steht im Element oder, je nach Aktion, in `action`.
fn search_query(item: &Value) -> String {
    let query = text_of(item, "query");
    if !query.is_empty() {
        return query.to_owned();
    }
    let action = item.get("action").unwrap_or(&Value::Null);
    if let Some(single) = action.get("query").and_then(Value::as_str) {
        return single.to_owned();
    }
    if let Some(queries) = action.get("queries").and_then(Value::as_array) {
        return queries
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<&str>>()
            .join(", ");
    }
    text_of(action, "url").to_owned()
}

fn thinking_lines(session_id: &str, item: &Value) -> Vec<Value> {
    let summary = item
        .get("summary")
        .and_then(Value::as_array)
        .map(|parts: &Vec<Value>| {
            parts
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<&str>>()
                .join("\n\n")
        })
        .unwrap_or_default();
    if summary.trim().is_empty() {
        return Vec::new();
    }
    vec![output::assistant(
        session_id,
        vec![json!({ "type": "thinking", "thinking": summary })],
        0,
        0,
    )]
}

fn is_known_without_start(item_type: &str) -> bool {
    SILENT_TYPES.contains(&item_type) || COMPLETION_ONLY_TYPES.contains(&item_type)
}

fn type_of(item: &Value) -> &str {
    text_of(item, "type")
}

fn text_of<'a>(value: &'a Value, field: &str) -> &'a str {
    value.get(field).and_then(Value::as_str).unwrap_or_default()
}

fn or_default(text: String, fallback: &str) -> String {
    if text.is_empty() {
        fallback.to_owned()
    } else {
        text
    }
}

fn tool_use(id: &str, name: &str, input: Value) -> Value {
    json!({ "type": "tool_use", "id": id, "name": name, "input": input })
}

fn tool_result(id: &str, content: &str, is_error: bool) -> Value {
    json!({ "type": "tool_result", "tool_use_id": id, "is_error": is_error, "content": content })
}

fn tool_calls(session_id: &str, calls: Vec<Value>) -> Value {
    output::assistant(session_id, calls, 0, 0)
}

fn tool_result_line(session_id: &str, results: Vec<Value>) -> Value {
    output::tool_results(session_id, None, results, None)
}
