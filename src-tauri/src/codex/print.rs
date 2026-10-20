//! Druckmodus: eine strukturierte Einmal-Antwort ohne Werkzeuge und Transkript — der Weg, auf dem
//! TL;DR, Retro und Commit-Vorschläge in der Betriebsart Codex ohne Claude-Kommandozeile antworten.
use std::env;
use std::io::{self, Read};
use std::path::Path;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::time::Duration;

use serde_json::{Value, json};

use super::rpc::{Incoming, RpcClient};
use crate::standalone::EXIT_START_FAILED;
use crate::standalone::args::AgentArgs;
use crate::standalone::output::{self, Output};

const CALL_TIMEOUT: Duration = Duration::from_secs(60);
/// Der Verwalter beendet den Prozess nach seinem eigenen Zeitlimit; diese Zeit schützt nur davor,
/// dass der Übersetzer ohne Verwalter ewig wartet.
const TURN_TIMEOUT: Duration = Duration::from_secs(300);
/// Zusammenfassen und Vorschlagen brauchen kein langes Nachdenken.
const PRINT_EFFORT: &str = "low";
const SANDBOX_READ_ONLY: &str = "read-only";
const APPROVAL_NEVER: &str = "never";
const AGENT_MESSAGE: &str = "agentMessage";

/// Eine Zeile `result` auf stdout, Exit 0 — auch bei einem Fehler von Codex; der steht dann in der
/// Zeile. Nur fehlende Umgebung und fehlerhafte Argumente enden mit `EXIT_START_FAILED`.
pub fn run(args: &AgentArgs, exe: &Path) -> i32 {
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
    let cwd = match env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => {
            eprintln!("Arbeitsordner unbekannt: {error}");
            return EXIT_START_FAILED;
        }
    };
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        eprintln!("Eingabe nicht lesbar: {error}");
        return EXIT_START_FAILED;
    }
    let line = match answer(exe, &cwd, args, &schema, &input) {
        Ok((raw, structured)) => output::print_success(&raw, &structured),
        Err(text) => output::print_error(&text),
    };
    Output::default().line(&line);
    0
}

/// Roher Text der Antwort und ihr Inhalt als JSON-Objekt.
fn answer(
    exe: &Path,
    cwd: &Path,
    args: &AgentArgs,
    schema: &Value,
    input: &str,
) -> Result<(String, Value), String> {
    let (sender, receiver) = mpsc::channel::<Incoming>();
    let rpc = RpcClient::start(exe, cwd, move |message: Incoming| {
        let _ = sender.send(message);
    })
    .map_err(|error: io::Error| format!("Codex startet nicht ({}): {error}", exe.display()))?;
    let outcome = ask(&rpc, &receiver, cwd, args, schema, input);
    rpc.shutdown();
    let text = outcome?;
    match serde_json::from_str::<Value>(text.trim()) {
        Ok(structured) if structured.is_object() => Ok((text, structured)),
        _ => Err("Antwort ist kein JSON-Objekt".to_owned()),
    }
}

fn ask(
    rpc: &RpcClient,
    receiver: &Receiver<Incoming>,
    cwd: &Path,
    args: &AgentArgs,
    schema: &Value,
    input: &str,
) -> Result<String, String> {
    rpc.initialize()?;
    let mut thread_params = json!({
        "cwd": cwd.to_string_lossy(),
        "ephemeral": true,
        "approvalPolicy": APPROVAL_NEVER,
        "sandbox": SANDBOX_READ_ONLY,
    });
    if let Some(system_prompt) = &args.system_prompt {
        thread_params["baseInstructions"] = json!(system_prompt);
    }
    if !args.model.is_empty() {
        thread_params["model"] = json!(args.model);
    }
    let started = rpc.call("thread/start", thread_params, CALL_TIMEOUT)?;
    let thread_id = started
        .pointer("/thread/id")
        .and_then(Value::as_str)
        .ok_or("thread/start: Antwort ohne thread.id")?
        .to_owned();
    let mut turn_params = json!({
        "threadId": thread_id,
        "input": [{ "type": "text", "text": input }],
        "outputSchema": schema,
        "effort": PRINT_EFFORT,
    });
    if !args.model.is_empty() {
        turn_params["model"] = json!(args.model);
    }
    rpc.call("turn/start", turn_params, CALL_TIMEOUT)?;
    wait_for_answer(receiver, &thread_id)
}

/// Liest Benachrichtigungen bis zum Ende des Turns und liefert den Text der letzten Antwort.
fn wait_for_answer(receiver: &Receiver<Incoming>, thread_id: &str) -> Result<String, String> {
    let mut last_text = String::new();
    let mut last_error: Option<String> = None;
    loop {
        let message = match receiver.recv_timeout(TURN_TIMEOUT) {
            Ok(message) => message,
            Err(RecvTimeoutError::Timeout) => {
                return Err(format!(
                    "Codex antwortete nicht innerhalb von {} s",
                    TURN_TIMEOUT.as_secs()
                ));
            }
            Err(RecvTimeoutError::Disconnected) => return Err("Codex wurde beendet".to_owned()),
        };
        let (method, params) = match message {
            Incoming::Notification { method, params } => (method, params),
            Incoming::Request { method, .. } => {
                // Ohne Werkzeuge und mit Freigabe „never“ darf keine Rückfrage kommen.
                eprintln!("Anfrage von Codex im Druckmodus überlesen: {method}");
                continue;
            }
            Incoming::Closed => return Err("Codex wurde beendet".to_owned()),
        };
        if params.get("threadId").and_then(Value::as_str) != Some(thread_id) {
            continue;
        }
        match method.as_str() {
            "item/completed" => {
                let item = params.get("item").unwrap_or(&Value::Null);
                if item.get("type").and_then(Value::as_str) == Some(AGENT_MESSAGE) {
                    item.get("text")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .clone_into(&mut last_text);
                }
            }
            "error" => {
                let will_retry = params
                    .get("willRetry")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                if !will_retry {
                    last_error = params
                        .pointer("/error/message")
                        .and_then(Value::as_str)
                        .map(str::to_owned);
                }
            }
            "turn/completed" => {
                let finished = params.get("turn").unwrap_or(&Value::Null);
                return match finished.get("status").and_then(Value::as_str) {
                    Some("completed") => Ok(last_text),
                    _ => Err(finished
                        .pointer("/error/message")
                        .and_then(Value::as_str)
                        .map(str::to_owned)
                        .or(last_error)
                        .unwrap_or_else(|| "Codex hat den Turn abgebrochen".to_owned())),
                };
            }
            _ => {}
        }
    }
}
