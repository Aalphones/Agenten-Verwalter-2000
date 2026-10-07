//! Das Werkzeug `Agent`: ein Subagent mit eigenem Verlauf, eigenem Werkzeug-Kontext und eigenem
//! Abbruch, im selben Prozess und gegen dasselbe lokale Modell. Er läuft immer in einem eigenen
//! Thread — im Vordergrund wartet der Hauptagent auf ihn und reicht Esc weiter, im Hintergrund
//! kehrt das Werkzeug sofort zurück und der Bericht kommt als neue Nachricht in die Schlange.
//!
//! Laufen Hauptagent und Hintergrund-Subagent gleichzeitig, reiht LM Studio ihre Anfragen ein
//! (gleichzeitige Anfragen sind dort beim Benutzer auf 1–2 gestellt). Die Wartezeit in dieser
//! Schlange trägt `llm::complete` mit: es begrenzt nur den Verbindungsaufbau.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread;
use std::time::Duration;

use serde_json::{Value, json};

use super::agents::{self, AgentDefinition, DEFAULT_AGENT_TYPE};
use super::context::ContextMeasure;
use super::mcp::{McpAccess, is_mcp_tool};
use super::session::Input;
use super::tasks::TaskStatus;
use super::tools::{INTERRUPTED, ToolOutput};
use super::turn::{self, Outcome, Role, TurnJob};

/// Takt, in dem der wartende Hauptagent nach Esc schaut.
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(50);
const EMPTY_REPORT: &str = "(Der Subagent hat keinen Bericht geschrieben.)";

/// Was die Session für Subagenten bereithält.
pub struct Subagents {
    pub definitions: Vec<AgentDefinition>,
    /// Systemprompt des Hauptagenten; der Subagent bekommt ihn plus seine Anweisung.
    pub system_prompt: String,
    /// Alle Werkzeuge außer `Agent`.
    pub tools: Vec<Value>,
    /// Hier landet der Bericht eines Hintergrund-Subagenten — als Nachricht für die Hauptschleife.
    pub inbox: Sender<Input>,
}

/// Was der Subagent tun soll, aus den Argumenten des `Agent`-Aufrufs.
struct Assignment {
    description: String,
    prompt: String,
    definition: AgentDefinition,
    in_background: bool,
}

/// Führt einen `Agent`-Aufruf des Hauptagenten aus.
pub fn run(parent: &TurnJob, input: &Value, tool_use_id: &str) -> ToolOutput {
    let assignment = match read_assignment(parent, input) {
        Ok(assignment) => assignment,
        Err(error) => return ToolOutput::from_result(Err(error)),
    };
    let cancel = Arc::new(AtomicBool::new(false));
    let context = parent
        .context
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .for_subagent(Arc::clone(&cancel));
    let shared = Arc::clone(&parent.shared);
    let task_id = shared.tasks.start_subagent(
        tool_use_id,
        &assignment.description,
        &assignment.definition.name,
        Arc::clone(&cancel),
    );
    let system_prompt = format!(
        "{}\n\n# Subagent instructions\n\n{}",
        shared.subagents.system_prompt, assignment.definition.instructions
    );
    let job = TurnJob {
        shared: Arc::clone(&shared),
        role: Role::Subagent {
            parent_tool_use_id: tool_use_id.to_owned(),
            task_id: task_id.clone(),
        },
        model: parent.model.clone(),
        measure: ContextMeasure::default(),
        messages: vec![
            json!({ "role": "system", "content": system_prompt }),
            json!({ "role": "user", "content": assignment.prompt }),
        ],
        tools: allowed_tools(&shared.subagents.tools, &assignment.definition),
        mcp_access: mcp_access(&assignment.definition),
        context: Arc::new(Mutex::new(context)),
        cancel: Arc::clone(&cancel),
    };
    let (result_sender, result_receiver) = mpsc::channel::<Result<String, String>>();
    let in_background = assignment.in_background;
    let description = assignment.description;
    let finished_task_id = task_id.clone();
    let spawned = thread::Builder::new()
        .name("agent-subagent".to_owned())
        .spawn(move || {
            let mut job = job;
            let outcome = turn::run_rounds(&mut job);
            let (status, result) = settle(outcome);
            let report = match &result {
                Ok(text) | Err(text) => text.clone(),
            };
            job.shared
                .tasks
                .finish_subagent(&finished_task_id, status, &report);
            if in_background {
                let message = format!(
                    "Background subagent {finished_task_id} ({description}) finished ({}):\n\n{report}",
                    status.as_str()
                );
                let _ = job
                    .shared
                    .subagents
                    .inbox
                    .send(Input::Message(Value::from(message)));
            } else {
                let _ = result_sender.send(result);
            }
        });
    if let Err(error) = spawned {
        let error = format!("Subagent startet nicht: {error}");
        shared
            .tasks
            .finish_subagent(&task_id, TaskStatus::Failed, &error);
        return ToolOutput::from_result(Err(error));
    }
    if in_background {
        return ToolOutput::from_result(Ok(format!(
            "Subagent läuft im Hintergrund (Aufgabe {task_id}). Sein Ergebnis kommt als eigene \
             Nachricht, sobald er fertig ist."
        )));
    }
    let result = wait_in_foreground(&result_receiver, &parent.cancel, &cancel);
    ToolOutput::from_result(result)
}

fn read_assignment(parent: &TurnJob, input: &Value) -> Result<Assignment, String> {
    let description = required_text(input, "description")?;
    let prompt = required_text(input, "prompt")?;
    let subagent_type = input
        .get("subagent_type")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|name: &&str| !name.is_empty())
        .unwrap_or(DEFAULT_AGENT_TYPE);
    let definitions = &parent.shared.subagents.definitions;
    let Some(definition) = agents::find(definitions, subagent_type) else {
        let names: Vec<&str> = definitions
            .iter()
            .map(|definition: &AgentDefinition| definition.name.as_str())
            .collect();
        return Err(format!(
            "Unbekannter Subagent-Typ: {subagent_type}. Verfügbar: {}",
            names.join(", ")
        ));
    };
    // Kleine Modelle schicken Wahrheitswerte gern als Text.
    let in_background = match input.get("run_in_background") {
        Some(Value::Bool(flag)) => *flag,
        Some(Value::String(text)) => text.trim().eq_ignore_ascii_case("true"),
        _ => false,
    };
    Ok(Assignment {
        description,
        prompt,
        definition: definition.clone(),
        in_background,
    })
}

fn required_text(input: &Value, field: &str) -> Result<String, String> {
    input
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text: &&str| !text.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| format!("Parameter {field} fehlt oder ist kein Text"))
}

/// Die Werkzeuge der Definition, soweit es sie gibt — unbekannte Namen fallen still weg.
fn allowed_tools(all_tools: &[Value], definition: &AgentDefinition) -> Vec<Value> {
    let Some(allowed) = &definition.tools else {
        return all_tools.to_vec();
    };
    all_tools
        .iter()
        .filter(|tool: &&Value| {
            tool.pointer("/function/name")
                .and_then(Value::as_str)
                .is_some_and(|name: &str| allowed.iter().any(|wanted: &String| wanted == name))
        })
        .cloned()
        .collect()
}

/// Eine Definition mit `tools` bekommt nur die MCP-Werkzeuge, deren vollen Namen sie nennt.
fn mcp_access(definition: &AgentDefinition) -> McpAccess {
    let Some(allowed) = &definition.tools else {
        return McpAccess::All;
    };
    McpAccess::Only(
        allowed
            .iter()
            .filter(|name: &&String| is_mcp_tool(name))
            .cloned()
            .collect(),
    )
}

/// Status für `task_notification` und Ergebnis fürs Modell.
fn settle(outcome: Outcome) -> (TaskStatus, Result<String, String>) {
    match outcome {
        Outcome::Completed(text) if text.trim().is_empty() => {
            (TaskStatus::Completed, Ok(EMPTY_REPORT.to_owned()))
        }
        Outcome::Completed(text) => (TaskStatus::Completed, Ok(text)),
        Outcome::Failed(error) => (TaskStatus::Failed, Err(error)),
        Outcome::Aborted => (TaskStatus::Stopped, Err(INTERRUPTED.to_owned())),
    }
}

/// Wartet auf den Bericht; Esc des Hauptagenten stoppt auch den Subagenten. Zurück kommt erst,
/// wenn sein Thread fertig ist — sonst liefen nach Esc noch Werkzeuge eines „gestoppten“ Agenten.
fn wait_in_foreground(
    results: &mpsc::Receiver<Result<String, String>>,
    parent_cancel: &AtomicBool,
    cancel: &AtomicBool,
) -> Result<String, String> {
    loop {
        if parent_cancel.load(Ordering::SeqCst) {
            cancel.store(true, Ordering::SeqCst);
        }
        match results.recv_timeout(WAIT_POLL_INTERVAL) {
            Ok(result) => return result,
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => {
                return Err("Subagent ohne Ergebnis beendet.".to_owned());
            }
        }
    }
}
