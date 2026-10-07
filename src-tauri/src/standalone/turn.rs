//! Ein Turn im Arbeits-Thread: Modellanfrage, Werkzeuge ausführen, Ergebnisse zurück, wiederholen,
//! bis das Modell ohne Werkzeug antwortet.
//!
//! Der Thread schreibt seine Zeilen selbst auf stdout (`Output` sperrt), das Transkript aber nie:
//! jede Runde geht als `TurnEvent::Messages` an die Hauptschleife, die allein schreibt. Nur so
//! landet der Abbruch-Marker nach Esc hinter den Werkzeug-Ergebnissen der letzten Runde.
//!
//! Vor jedem Werkzeug: erst die Hooks, dann die Rechte; eine Rückfrage geht als `can_use_tool` an
//! den Verwalter, die Antwort reicht die Hauptschleife über `answers` herein.
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use serde_json::{Value, json};

use super::compact;
use super::content;
use super::context::{self, ContextMeasure};
use super::hooks::{HookCall, HookVerdict, Hooks};
use super::llm::{self, ChatRequest, Completion, LlmError, ToolCall};
use super::output::{self, Output};
use super::paths::{self, Access};
use super::permissions::{self, Decision};
use super::tools::{self, ASK_USER_TOOL, INTERRUPTED, ToolContext, ToolImage, ToolOutput};
use crate::agents::event::Mode;

/// Grenze gegen Endlosschleifen eines Modells, das nie aufhört, Werkzeuge zu rufen.
const MAX_TOOL_ROUNDS: usize = 50;
/// Takt beim Warten auf die Antwort einer Rückfrage; dazwischen wird der Abbruch geprüft.
const ANSWER_POLL_INTERVAL: Duration = Duration::from_millis(50);
const REQUEST_ID_PREFIX: &str = "agent-";
const DENIED_PREFIX: &str = "Der Benutzer hat abgelehnt: ";
/// So viel von unlesbaren Argumenten zeigt der Fehler dem Modell.
const ARGUMENTS_EXCERPT_CHARS: usize = 200;

pub struct TurnJob {
    pub output: Arc<Output>,
    pub session_id: String,
    pub base_url: String,
    pub model: String,
    pub context_window: u32,
    /// Letzte Messung des Kontexts; der Turn führt sie nach jeder Antwort nach.
    pub measure: ContextMeasure,
    /// Systemprompt und Verlauf bis einschließlich der neuen Benutzer-Nachricht.
    pub messages: Vec<Value>,
    pub tools: Vec<Value>,
    pub context: Arc<Mutex<ToolContext>>,
    pub cancel: Arc<AtomicBool>,
    /// Gilt sofort — `set_permission_mode` erreicht auch den laufenden Turn.
    pub mode: Arc<Mutex<Mode>>,
    pub hooks: Arc<Hooks>,
    pub cwd: PathBuf,
    pub transcript_path: PathBuf,
    /// Laufende Nummer der Rückfragen, über alle Turns der Session.
    pub request_counter: Arc<AtomicU64>,
    /// Antworten auf Rückfragen: Request-ID und `response`-Objekt der `control_response`.
    pub answers: Receiver<(String, Value)>,
}

/// Antwort, die ein Werkzeug statt seiner Ausführung bekommt.
fn refused(text: &str) -> ToolOutput {
    ToolOutput {
        text: text.to_owned(),
        is_error: true,
        image: None,
    }
}

pub enum Outcome {
    /// Letzter Text des Modells.
    Completed(String),
    Failed(String),
    Aborted,
}

pub enum TurnEvent {
    /// Fürs Transkript, in dieser Reihenfolge: eine Antwort samt ihren Werkzeug-Ergebnissen.
    Messages(Vec<Value>),
    /// Der Verlauf ohne Systemprompt nach dem Verdichten — ersetzt das ganze Transkript. Kommt
    /// hinter allen `Messages`, die der Turn davor geschickt hat.
    Compacted(Vec<Value>),
    /// Neue Messung des Kontexts, die der nächste Turn als Ausgangspunkt braucht.
    Measured(ContextMeasure),
    Done(Outcome),
}

pub fn run(mut job: TurnJob, events: &Sender<TurnEvent>) {
    let outcome = run_rounds(&mut job, events);
    let _ = events.send(TurnEvent::Done(outcome));
}

fn run_rounds(job: &mut TurnJob, events: &Sender<TurnEvent>) -> Outcome {
    let mut tool_rounds = 0;
    loop {
        if let Err(outcome) = make_room(job, events) {
            return outcome;
        }
        let completion = match ask_model(job) {
            Ok(completion) => completion,
            Err(outcome) => return outcome,
        };
        let calls: Vec<ParsedCall> = completion.tool_calls.iter().map(ParsedCall::from).collect();
        job.measure = ContextMeasure::after_answer(
            completion.prompt_tokens,
            completion.completion_tokens,
            &job.messages,
            completion.text.chars().count(),
        );
        let _ = events.send(TurnEvent::Measured(job.measure));
        // Die Zeile meldet den Kontext nach der Antwort — daran liest der Verwalter den Donut ab.
        job.output.line(&output::assistant(
            &job.session_id,
            assistant_blocks(&completion, &calls),
            job.measure.tokens,
            completion.completion_tokens.unwrap_or(0),
        ));
        if calls.is_empty() {
            let answer = json!({ "role": "assistant", "content": completion.text });
            let _ = events.send(TurnEvent::Messages(vec![answer]));
            return Outcome::Completed(completion.text);
        }
        let round_messages = run_tools(job, &completion, &calls);
        job.messages.extend(round_messages.iter().cloned());
        let _ = events.send(TurnEvent::Messages(round_messages));
        if job.cancel.load(Ordering::SeqCst) {
            return Outcome::Aborted;
        }
        tool_rounds += 1;
        if tool_rounds >= MAX_TOOL_ROUNDS {
            return Outcome::Failed(format!(
                "Abgebrochen nach {MAX_TOOL_ROUNDS} Werkzeug-Schritten."
            ));
        }
    }
}

/// Verdichtet den Verlauf, bevor er das Fenster sprengt: ab 80 % des Fensters, vor jeder Anfrage —
/// auch mitten im Turn, denn Werkzeug-Ergebnisse füllen den Kontext schneller als Nachrichten.
fn make_room(job: &mut TurnJob, events: &Sender<TurnEvent>) -> Result<(), Outcome> {
    let threshold = context::compact_threshold(job.context_window);
    let before = job.measure.estimate(&job.messages);
    if before <= threshold {
        return Ok(());
    }
    let Some((system, history)) = job.messages.split_first() else {
        return Ok(());
    };
    let compacted = compact::compact(&job.base_url, &job.model, history, &job.cancel).map_err(
        |error: LlmError| match error {
            LlmError::Cancelled => Outcome::Aborted,
            LlmError::Failed(message) => Outcome::Failed(format!(
                "Kontext voll und Verdichten fehlgeschlagen: {message}"
            )),
        },
    )?;
    let mut messages: Vec<Value> = vec![system.clone()];
    messages.extend(compacted.iter().cloned());
    let measure = ContextMeasure::estimated(&messages);
    if measure.tokens > threshold {
        return Err(Outcome::Failed(
            "Kontext voll und Verdichten fehlgeschlagen: der laufende Turn füllt das Fenster allein."
                .to_owned(),
        ));
    }
    eprintln!("Verdichtet: {before} → {} Token", measure.tokens);
    job.output.line(&output::compact_boundary());
    let _ = events.send(TurnEvent::Compacted(compacted));
    let _ = events.send(TurnEvent::Measured(measure));
    job.messages = messages;
    job.measure = measure;
    Ok(())
}

fn ask_model(job: &TurnJob) -> Result<Completion, Outcome> {
    let request = ChatRequest {
        base_url: &job.base_url,
        model: &job.model,
        messages: &job.messages,
        tools: &job.tools,
        response_format: None,
    };
    match llm::complete(&request, &job.cancel) {
        // Kam die Antwort erst nach Esc an, hat der Verwalter den Turn schon beendet — sie bleibt
        // draußen.
        Ok(_) if job.cancel.load(Ordering::SeqCst) => Err(Outcome::Aborted),
        Ok(completion) => Ok(completion),
        Err(LlmError::Cancelled) => Err(Outcome::Aborted),
        Err(LlmError::Failed(message)) => Err(Outcome::Failed(message)),
    }
}

/// Werkzeug-Aufruf mit gelesenen Argumenten; unlesbare werden zu `{}` und einem Fehler fürs Modell.
struct ParsedCall {
    id: String,
    name: String,
    input: Value,
    argument_error: Option<String>,
}

impl From<&ToolCall> for ParsedCall {
    fn from(call: &ToolCall) -> Self {
        let raw = call.arguments.trim();
        let parsed = if raw.is_empty() {
            Ok(json!({}))
        } else {
            serde_json::from_str::<Value>(raw)
        };
        let (input, argument_error) = match parsed {
            Ok(value) if value.is_object() => (value, None),
            _ => {
                let excerpt: String = raw.chars().take(ARGUMENTS_EXCERPT_CHARS).collect();
                (
                    json!({}),
                    Some(format!("Ungültige Argumente (kein JSON): {excerpt}")),
                )
            }
        };
        ParsedCall {
            id: call.id.clone(),
            name: call.name.clone(),
            input,
            argument_error,
        }
    }
}

/// Blöcke in der Reihenfolge des Kontrakts: Denken, Text, Werkzeug-Aufrufe.
fn assistant_blocks(completion: &Completion, calls: &[ParsedCall]) -> Vec<Value> {
    let mut blocks: Vec<Value> = Vec::new();
    if !completion.reasoning.is_empty() {
        blocks.push(json!({ "type": "thinking", "thinking": completion.reasoning }));
    }
    if !completion.text.is_empty() {
        blocks.push(json!({ "type": "text", "text": completion.text }));
    }
    for call in calls {
        blocks.push(
            json!({ "type": "tool_use", "id": call.id, "name": call.name, "input": call.input }),
        );
    }
    blocks
}

/// Führt die Aufrufe nacheinander aus und gibt die Runde fürs Transkript zurück. Nach Esc bekommt
/// jeder noch offene Aufruf ein Ergebnis „unterbrochen“ — ein `tool_calls` ohne alle Ergebnisse
/// direkt dahinter lehnt die Chat-Vorlage beim nächsten Start ab. Gelesene Bilder folgen hinter
/// allen Ergebnissen als Benutzer-Nachricht: Werkzeug-Nachrichten tragen keine Bilder.
fn run_tools(job: &TurnJob, completion: &Completion, calls: &[ParsedCall]) -> Vec<Value> {
    let mut messages: Vec<Value> = vec![assistant_message(completion, calls)];
    let mut result_blocks: Vec<Value> = Vec::with_capacity(calls.len());
    let mut images: Vec<ToolImage> = Vec::new();
    for call in calls {
        let result = run_tool(job, call);
        result_blocks.push(json!({
            "type": "tool_result",
            "tool_use_id": call.id,
            "is_error": result.is_error,
            "content": result.text,
        }));
        messages.push(json!({ "role": "tool", "tool_call_id": call.id, "content": result.text }));
        images.extend(result.image);
    }
    for image in &images {
        let message = content::read_image_message(&image.path, &image.media_type, &image.data);
        content::push_merged(&mut messages, &message);
    }
    job.output
        .line(&output::tool_results(&job.session_id, result_blocks));
    messages
}

fn run_tool(job: &TurnJob, call: &ParsedCall) -> ToolOutput {
    if job.cancel.load(Ordering::SeqCst) {
        return refused(INTERRUPTED);
    }
    if let Some(error) = &call.argument_error {
        return refused(error);
    }
    let access = path_access(job, call);
    let mode = *job.mode.lock().unwrap_or_else(PoisonError::into_inner);
    let decision = match job
        .hooks
        .pre_tool_use(&hook_call(job, call, mode), &job.cancel)
    {
        HookVerdict::Deny(reason) => return refused(&reason),
        // Eine Auswahlfrage braucht die Antwort des Benutzers, egal was ein Hook sagt.
        HookVerdict::Allow if call.name != ASK_USER_TOOL => Decision::Allow,
        HookVerdict::Ask => Decision::Ask,
        HookVerdict::Allow | HookVerdict::None => permissions::decide(&call.name, mode, access),
    };
    let input = match decision {
        Decision::Allow => call.input.clone(),
        Decision::Deny(text) => return refused(&text),
        Decision::Ask => match ask_permission(job, call) {
            Ok(input) => input,
            Err(output) => return output,
        },
    };
    if job.cancel.load(Ordering::SeqCst) {
        return refused(INTERRUPTED);
    }
    let mut context = job.context.lock().unwrap_or_else(PoisonError::into_inner);
    // Bis hierher kommt ein Pfad außerhalb nur mit Erlaubnis des Benutzers oder eines Hooks.
    context.allow_outside = access == Some(Access::Outside);
    let output = tools::run(&call.name, &input, &mut context);
    context.allow_outside = false;
    output
}

fn path_access(job: &TurnJob, call: &ParsedCall) -> Option<Access> {
    let raw = tools::path_argument(&call.name, &call.input)?;
    let context = job.context.lock().unwrap_or_else(PoisonError::into_inner);
    Some(context.roots.access(&paths::resolve(&context.cwd, raw)))
}

fn hook_call<'a>(job: &'a TurnJob, call: &'a ParsedCall, mode: Mode) -> HookCall<'a> {
    HookCall {
        session_id: &job.session_id,
        transcript_path: &job.transcript_path,
        cwd: &job.cwd,
        permission_mode: mode.cli_value(),
        tool_use_id: &call.id,
        tool: &call.name,
        input: &call.input,
    }
}

/// Stellt die Rückfrage und wartet auf die Antwort; Ergebnis ist die freigegebene Eingabe.
fn ask_permission(job: &TurnJob, call: &ParsedCall) -> Result<Value, ToolOutput> {
    let number = job.request_counter.fetch_add(1, Ordering::SeqCst) + 1;
    let request_id = format!("{REQUEST_ID_PREFIX}{number}");
    job.output
        .line(&output::can_use_tool(&request_id, &call.name, &call.input));
    loop {
        if job.cancel.load(Ordering::SeqCst) {
            return Err(refused(INTERRUPTED));
        }
        match job.answers.recv_timeout(ANSWER_POLL_INTERVAL) {
            Ok((answered_id, response)) if answered_id == request_id => {
                return permission_answer(&response, &call.input);
            }
            // Antwort auf eine ältere Rückfrage, deren Turn schon vorbei ist.
            Ok(_) | Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return Err(refused(INTERRUPTED)),
        }
    }
}

fn permission_answer(response: &Value, original: &Value) -> Result<Value, ToolOutput> {
    match response.get("behavior").and_then(Value::as_str) {
        Some("allow") => Ok(response
            .get("updatedInput")
            .filter(|input: &&Value| input.is_object())
            .cloned()
            .unwrap_or_else(|| original.clone())),
        Some("deny") => {
            let message = response
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or_default();
            Err(refused(&format!("{DENIED_PREFIX}{message}")))
        }
        _ => Err(refused("Unlesbare Antwort auf die Rückfrage.")),
    }
}

/// Argumente in der gelesenen Form — unlesbare als `{}`, sonst lehnt die Chat-Vorlage den
/// Verlauf beim nächsten Start womöglich ab.
fn assistant_message(completion: &Completion, calls: &[ParsedCall]) -> Value {
    let content = if completion.text.is_empty() {
        Value::Null
    } else {
        Value::from(completion.text.as_str())
    };
    let tool_calls: Vec<Value> = calls
        .iter()
        .map(|call: &ParsedCall| {
            json!({
                "id": call.id,
                "type": "function",
                "function": { "name": call.name, "arguments": call.input.to_string() },
            })
        })
        .collect();
    json!({ "role": "assistant", "content": content, "tool_calls": tool_calls })
}
