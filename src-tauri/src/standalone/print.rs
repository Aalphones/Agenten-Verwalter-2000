//! Druckmodus: eine strukturierte Einmal-Antwort ohne Werkzeuge und Transkript — der Weg, auf dem
//! TL;DR und Commit-Vorschläge in der Betriebsart Autark ohne Claude-Kommandozeile antworten.
use std::io::{self, Read};
use std::sync::atomic::AtomicBool;

use serde_json::{Value, json};

use super::args::AgentArgs;
use super::llm::{self, ChatRequest, LlmError};
use super::output::{self, Output};
use super::{EXIT_START_FAILED, Environment};

const SCHEMA_NAME: &str = "answer";

/// Eine Zeile `result` auf stdout, Exit 0 — auch bei einem Fehler des Modells; der steht dann in
/// der Zeile. Nur fehlende Umgebung und fehlerhafte Argumente enden mit `EXIT_START_FAILED`.
pub fn run(args: &AgentArgs) -> i32 {
    let environment = match Environment::read() {
        Ok(environment) => environment,
        Err(error) => {
            eprintln!("{error}");
            return EXIT_START_FAILED;
        }
    };
    let Some(schema_text) = &args.json_schema else {
        eprintln!("--json-schema fehlt");
        return EXIT_START_FAILED;
    };
    let schema: Value = match serde_json::from_str(schema_text) {
        Ok(schema) => schema,
        Err(error) => {
            eprintln!("--json-schema ist kein JSON: {error}");
            return EXIT_START_FAILED;
        }
    };
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        eprintln!("Eingabe nicht lesbar: {error}");
        return EXIT_START_FAILED;
    }
    let line = match answer(&environment, args, &schema, &input) {
        Ok((raw, structured)) => output::print_success(&raw, &structured),
        Err(text) => output::print_error(&text),
    };
    Output::default().line(&line);
    0
}

/// Roher Text der Antwort und ihr Inhalt als JSON-Objekt.
fn answer(
    environment: &Environment,
    args: &AgentArgs,
    schema: &Value,
    input: &str,
) -> Result<(String, Value), String> {
    let mut messages: Vec<Value> = Vec::new();
    if let Some(system_prompt) = &args.system_prompt {
        messages.push(json!({ "role": "system", "content": system_prompt }));
    }
    messages.push(json!({ "role": "user", "content": input }));
    let response_format = json!({
        "type": "json_schema",
        "json_schema": { "name": SCHEMA_NAME, "strict": true, "schema": schema },
    });
    let request = ChatRequest {
        base_url: &environment.base_url,
        model: &args.model,
        messages: &messages,
        tools: &[],
        response_format: Some(&response_format),
    };
    // Niemand bricht den Druckmodus ab: der Verwalter beendet den Prozess nach seinem Zeitlimit.
    let never_cancelled = AtomicBool::new(false);
    let completion =
        llm::complete(&request, &never_cancelled).map_err(|error: LlmError| match error {
            LlmError::Cancelled => "Abgebrochen".to_owned(),
            LlmError::Failed(message) => message,
        })?;
    match serde_json::from_str::<Value>(completion.text.trim()) {
        Ok(structured) if structured.is_object() => Ok((completion.text, structured)),
        _ => Err("Antwort ist kein JSON-Objekt".to_owned()),
    }
}
