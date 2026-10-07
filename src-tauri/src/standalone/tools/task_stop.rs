//! `TaskStop`: beendet eine Hintergrundaufgabe; ihr Ende meldet der Überwacher in `tasks`.
use serde_json::Value;

use super::{ToolContext, required_string};

pub fn run(input: &Value, context: &ToolContext) -> Result<String, String> {
    let task_id = required_string(input, "task_id")?.trim();
    context.tasks.stop(task_id)?;
    Ok(format!("Aufgabe {task_id} beendet."))
}
