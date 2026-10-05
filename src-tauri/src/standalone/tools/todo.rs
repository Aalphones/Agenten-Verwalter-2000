//! `TodoWrite`: die Aufgabenliste zeigt der Verwalter aus dem `tool_use` selbst an — hier wird
//! nur geprüft, damit das Modell von einer kaputten Liste erfährt.
use serde_json::Value;

const STATUSES: [&str; 3] = ["pending", "in_progress", "completed"];

pub fn run(input: &Value) -> Result<String, String> {
    let todos = input
        .get("todos")
        .and_then(Value::as_array)
        .ok_or_else(|| "todos muss ein Array sein.".to_owned())?;
    for (index, todo) in todos.iter().enumerate() {
        let number = index + 1;
        let has_content = todo
            .get("content")
            .and_then(Value::as_str)
            .is_some_and(|content: &str| !content.trim().is_empty());
        if !has_content {
            return Err(format!("Eintrag {number}: content fehlt."));
        }
        let status = todo.get("status").and_then(Value::as_str);
        if !status.is_some_and(|status: &str| STATUSES.contains(&status)) {
            return Err(format!(
                "Eintrag {number}: status muss pending, in_progress oder completed sein."
            ));
        }
    }
    Ok("Aufgabenliste aktualisiert.".to_owned())
}
