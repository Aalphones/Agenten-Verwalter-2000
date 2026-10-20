//! Hauptschleife des Übersetzers: Zeilen vom Verwalter, Nachrichten von Codex, je ein Turn.
//!
//! Alles läuft auf einem Thread: Codex arbeitet den Turn selbst ab und meldet ihn über
//! Benachrichtigungen, die Hauptschleife übersetzt sie nur. Nachrichten, die während eines Turns
//! eintreffen, warten in der Schlange und werden danach je als eigener Turn verarbeitet.
use std::collections::{HashSet, VecDeque};
use std::env;
use std::ffi::OsString;
use std::fs;
use std::io::{self, BufRead};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use std::time::Duration;

use serde_json::{Value, json};

use super::rpc::{Incoming, RpcClient};
use super::thread_file;
use crate::agents::event::Mode;
use crate::standalone::args::{self, AgentArgs, Start};
use crate::standalone::output::{self, Output};
use crate::standalone::{EXIT_START_FAILED, SCRATCHPAD_VARIABLE, fallback_scratchpad};

const INITIALIZE_TIMEOUT: Duration = Duration::from_secs(20);
const CALL_TIMEOUT: Duration = Duration::from_secs(60);
const BYTE_ORDER_MARK: char = '\u{feff}';
/// Steht statt eines Fehlersatzes, wenn Codex einen Turn ohne Begründung scheitern lässt.
const UNKNOWN_FAILURE: &str = "Codex hat den Turn ohne Fehlermeldung abgebrochen.";
const CODEX_CLOSED: &str = "Codex wurde beendet.";

/// Codex-Werte der Freigaben (`AskForApproval`) und der Sandbox (`SandboxMode`).
const APPROVAL_ON_REQUEST: &str = "on-request";
const SANDBOX_READ_ONLY: &str = "read-only";
const SANDBOX_WORKSPACE_WRITE: &str = "workspace-write";
/// Freigabe-Anfragen, deren Antwort `{"decision": …}` ist.
const APPROVAL_METHODS: [&str; 2] = [
    "item/commandExecution/requestApproval",
    "item/fileChange/requestApproval",
];

enum Input {
    Line(String),
    Codex(Incoming),
    StdinClosed,
}

/// Ein laufender Turn. Nach `interrupt` ist er für den Verwalter schon beendet (`is_aborted`), bis
/// Codex ihn mit `turn/completed` abschließt — erst dann beginnt der nächste.
struct ActiveTurn {
    id: String,
    last_text: String,
    /// Fehlersatz aus einer `error`-Benachrichtigung, falls `turn/completed` selbst keinen trägt.
    error: Option<String>,
    is_aborted: bool,
}

struct Session {
    output: Output,
    rpc: RpcClient,
    session_id: String,
    thread_id: String,
    /// Modell, das Codex für den Thread meldet — steht in jeder `result`-Zeile.
    model: String,
    /// Mit `set_model` gewählt; gilt ab dem nächsten `turn/start`.
    requested_model: Option<String>,
    mode: Mode,
    queue: VecDeque<Value>,
    turn: Option<ActiveTurn>,
    /// Benachrichtigungen, die schon einmal als unbekannt gemeldet wurden.
    reported_methods: HashSet<String>,
}

pub fn run(args: AgentArgs, exe: &Path) -> i32 {
    let cwd = match env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => {
            eprintln!("Arbeitsordner unbekannt: {error}");
            return EXIT_START_FAILED;
        }
    };
    let (sender, receiver) = mpsc::channel::<Input>();
    let codex_sender = sender.clone();
    let rpc = match RpcClient::start(exe, &cwd, move |message: Incoming| {
        let _ = codex_sender.send(Input::Codex(message));
    }) {
        Ok(rpc) => rpc,
        Err(error) => {
            eprintln!("Codex startet nicht ({}): {error}", exe.display());
            return EXIT_START_FAILED;
        }
    };
    let started = initialize(&rpc).and_then(|()| open_thread(&rpc, &args, &cwd));
    let (session_id, thread_id, model) = match started {
        Ok(opened) => opened,
        Err(error) => {
            eprintln!("{error}");
            rpc.shutdown();
            return EXIT_START_FAILED;
        }
    };
    if let Err(error) = spawn_stdin_reader(sender) {
        eprintln!("Lese-Thread startet nicht: {error}");
        rpc.shutdown();
        return EXIT_START_FAILED;
    }
    let output = Output::default();
    output.line(&output::init(
        &session_id,
        &model,
        &cwd,
        &[],
        &scratchpad(&session_id),
    ));
    let mut session = Session {
        output,
        rpc,
        session_id,
        thread_id,
        model,
        requested_model: None,
        mode: args.mode,
        queue: VecDeque::new(),
        turn: None,
        reported_methods: HashSet::new(),
    };
    let exit_code = session.run_loop(&receiver);
    session.rpc.shutdown();
    exit_code
}

fn initialize(rpc: &RpcClient) -> Result<(), String> {
    rpc.call(
        "initialize",
        json!({
            "clientInfo": { "name": "verwalter", "version": env!("CARGO_PKG_VERSION") },
        }),
        INITIALIZE_TIMEOUT,
    )?;
    rpc.notify("initialized")
        .map_err(|error: io::Error| format!("initialized: {error}"))
}

/// Legt den Thread an bzw. setzt ihn fort; Rückgabe Session-ID, Thread-ID und Modell.
fn open_thread(
    rpc: &RpcClient,
    args: &AgentArgs,
    cwd: &Path,
) -> Result<(String, String, String), String> {
    let cwd_text = cwd.to_string_lossy();
    match &args.start {
        Start::New(session_id) => {
            let file = thread_file(session_id).ok_or("Benutzerordner unbekannt")?;
            if file.exists() {
                return Err(format!(
                    "Für die Session {session_id} gibt es schon einen Codex-Thread ({})",
                    file.display()
                ));
            }
            let mut params = json!({
                "cwd": cwd_text,
                "approvalPolicy": APPROVAL_ON_REQUEST,
                "sandbox": sandbox_of(args.mode),
            });
            if !args.model.is_empty() {
                params["model"] = json!(args.model);
            }
            let result = rpc.call("thread/start", params, CALL_TIMEOUT)?;
            let thread_id = result
                .pointer("/thread/id")
                .and_then(Value::as_str)
                .ok_or("thread/start: Antwort ohne thread.id")?
                .to_owned();
            write_thread_file(&file, &thread_id)?;
            Ok((session_id.clone(), thread_id, model_of(&result)))
        }
        Start::Resume(session_id) => {
            let file = thread_file(session_id).ok_or("Benutzerordner unbekannt")?;
            let thread_id = read_thread_file(&file)?;
            let result = rpc.call(
                "thread/resume",
                json!({ "threadId": thread_id, "cwd": cwd_text }),
                CALL_TIMEOUT,
            )?;
            Ok((session_id.clone(), thread_id, model_of(&result)))
        }
        Start::None => Err("--session-id oder --resume fehlt".to_owned()),
    }
}

fn model_of(result: &Value) -> String {
    result
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn sandbox_of(mode: Mode) -> &'static str {
    if mode == Mode::Plan {
        SANDBOX_READ_ONLY
    } else {
        SANDBOX_WORKSPACE_WRITE
    }
}

fn write_thread_file(file: &Path, thread_id: &str) -> Result<(), String> {
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir).map_err(|error: io::Error| {
            format!("Ordner {} nicht anlegbar: {error}", dir.display())
        })?;
    }
    fs::write(file, json!({ "threadId": thread_id }).to_string())
        .map_err(|error: io::Error| format!("{} nicht schreibbar: {error}", file.display()))
}

fn read_thread_file(file: &Path) -> Result<String, String> {
    let text = fs::read_to_string(file)
        .map_err(|error: io::Error| format!("{} nicht lesbar: {error}", file.display()))?;
    serde_json::from_str::<Value>(&text)
        .ok()
        .and_then(|value: Value| value.get("threadId")?.as_str().map(str::to_owned))
        .ok_or_else(|| format!("{} enthält keine threadId", file.display()))
}

/// Der Ordner, den der Verwalter vorgibt, sonst der Ersatz unter `.verwalter\agent`. Steht nur in
/// der `init`-Zeile; die Vorgabe an Codex kommt über den Systemprompt-Zusatz (Phase 3).
fn scratchpad(session_id: &str) -> PathBuf {
    env::var_os(SCRATCHPAD_VARIABLE)
        .filter(|value: &OsString| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| fallback_scratchpad(session_id))
        .unwrap_or_default()
}

/// Liest bis Dateiende; danach kommt genau ein `StdinClosed`.
fn spawn_stdin_reader(sender: Sender<Input>) -> io::Result<()> {
    thread::Builder::new()
        .name("codex-stdin".to_owned())
        .spawn(move || {
            for line in io::stdin().lock().lines() {
                let Ok(line) = line else {
                    break;
                };
                if !line.trim().is_empty() && sender.send(Input::Line(line)).is_err() {
                    return;
                }
            }
            let _ = sender.send(Input::StdinClosed);
        })?;
    Ok(())
}

/// Der Text einer `user`-Zeile: `message.content` als Zeichenkette oder die `text`-Blöcke.
fn text_of(content: &Value) -> String {
    if let Some(text) = content.as_str() {
        return text.to_owned();
    }
    content
        .as_array()
        .map(|blocks: &Vec<Value>| {
            blocks
                .iter()
                .filter(|block: &&Value| block.get("type").and_then(Value::as_str) == Some("text"))
                .filter_map(|block: &Value| block.get("text").and_then(Value::as_str))
                .collect::<Vec<&str>>()
                .join("\n\n")
        })
        .unwrap_or_default()
}

/// Codex meldet das Kontextfenster erst mit der Token-Zählung (Phase 4); bis dahin fehlt
/// `modelUsage`, statt ein Fenster von 0 zu behaupten.
fn without_window(mut line: Value) -> Value {
    if let Some(fields) = line.as_object_mut() {
        fields.remove("modelUsage");
    }
    line
}

impl Session {
    fn run_loop(&mut self, input: &Receiver<Input>) -> i32 {
        loop {
            let Ok(message) = input.recv() else {
                return 0;
            };
            match message {
                Input::Line(line) => self.handle_line(&line),
                Input::Codex(Incoming::Notification { method, params }) => {
                    self.handle_notification(&method, &params);
                }
                Input::Codex(Incoming::Request { id, method, .. }) => {
                    self.decline_request(&id, &method);
                }
                Input::Codex(Incoming::Closed) => {
                    self.fail_turn(CODEX_CLOSED);
                    eprintln!("{CODEX_CLOSED}");
                    return 1;
                }
                Input::StdinClosed => return 0,
            }
            if self.turn.is_none()
                && let Some(content) = self.queue.pop_front()
            {
                self.start_turn(&content);
            }
        }
    }

    fn handle_line(&mut self, line: &str) {
        // Manche Aufrufer (.NET-`Process`) schreiben ein Byte-Order-Mark vor die erste Zeile.
        let line = line.trim_start_matches(BYTE_ORDER_MARK);
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            eprintln!("Zeile ist kein JSON, überlesen");
            return;
        };
        match value.get("type").and_then(Value::as_str) {
            Some("user") => match value.pointer("/message/content") {
                Some(content) => self.queue.push_back(content.clone()),
                None => eprintln!("user-Zeile ohne message.content, überlesen"),
            },
            Some("control_request") => self.handle_control(&value),
            Some("control_response") => eprintln!("Antwort auf Rückfrage, überlesen"),
            other => eprintln!("Unbekannte Zeile, überlesen: {other:?}"),
        }
    }

    fn handle_control(&mut self, value: &Value) {
        let request_id = value
            .get("request_id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let request = value.get("request").unwrap_or(&Value::Null);
        let subtype = request
            .get("subtype")
            .and_then(Value::as_str)
            .unwrap_or_default();
        match subtype {
            "interrupt" => {
                self.reply_success(request_id);
                self.interrupt();
            }
            "set_permission_mode" => {
                match request
                    .get("mode")
                    .and_then(Value::as_str)
                    .and_then(args::mode_from_cli)
                {
                    Some(mode) => {
                        self.mode = mode;
                        self.reply_success(request_id);
                    }
                    None => self.reply_error(request_id, "unbekannter Modus"),
                }
            }
            "set_model" => match request.get("model").and_then(Value::as_str) {
                Some(model) => {
                    self.requested_model =
                        Some(model.to_owned()).filter(|id: &String| !id.is_empty());
                    self.reply_success(request_id);
                }
                None => self.reply_error(request_id, "model fehlt"),
            },
            other => self.reply_error(request_id, &format!("nicht unterstützt: {other}")),
        }
    }

    fn reply_success(&self, request_id: &str) {
        self.output
            .line(&output::control_success(request_id, json!({})));
    }

    fn reply_error(&self, request_id: &str, error: &str) {
        self.output.line(&output::control_error(request_id, error));
    }

    /// Freigaben laufen erst mit den Rückfragen des Verwalters (Phase 2); bis dahin lehnt der
    /// Übersetzer ab, damit Codex nicht auf eine Antwort wartet, die nie kommt.
    fn decline_request(&self, id: &Value, method: &str) {
        eprintln!("Anfrage von Codex abgelehnt: {method}");
        let answered = if APPROVAL_METHODS.contains(&method) {
            self.rpc.respond(id, json!({ "decision": "decline" }))
        } else {
            self.rpc
                .respond_error(id, &format!("nicht unterstützt: {method}"))
        };
        if let Err(error) = answered {
            eprintln!("Antwort an Codex gescheitert: {error}");
        }
    }

    fn start_turn(&mut self, content: &Value) {
        let mut params = json!({
            "threadId": self.thread_id,
            "input": [{ "type": "text", "text": text_of(content) }],
            "approvalPolicy": APPROVAL_ON_REQUEST,
        });
        if let Some(model) = &self.requested_model {
            params["model"] = json!(model);
        }
        let started = self.rpc.call("turn/start", params, CALL_TIMEOUT);
        let turn_id = started.and_then(|result: Value| {
            result
                .pointer("/turn/id")
                .and_then(Value::as_str)
                .map(str::to_owned)
                .ok_or_else(|| "turn/start: Antwort ohne turn.id".to_owned())
        });
        match turn_id {
            Ok(id) => {
                if let Some(model) = &self.requested_model {
                    model.clone_into(&mut self.model);
                }
                self.turn = Some(ActiveTurn {
                    id,
                    last_text: String::new(),
                    error: None,
                    is_aborted: false,
                });
            }
            Err(error) => self.output.line(&without_window(output::result_error(
                &self.session_id,
                &error,
                &self.model,
                0,
            ))),
        }
    }

    /// Meldet den Turn sofort als abgebrochen; Codex schließt ihn danach mit `interrupted` ab.
    fn interrupt(&mut self) {
        let Some(turn) = &mut self.turn else {
            return;
        };
        if turn.is_aborted {
            return;
        }
        turn.is_aborted = true;
        let params = json!({ "threadId": self.thread_id, "turnId": turn.id });
        if let Err(error) = self.rpc.call("turn/interrupt", params, CALL_TIMEOUT) {
            eprintln!("{error}");
        }
        self.output.line(&without_window(output::result_aborted(
            &self.session_id,
            &self.model,
            0,
        )));
    }

    fn handle_notification(&mut self, method: &str, params: &Value) {
        if params.get("threadId").and_then(Value::as_str) != Some(self.thread_id.as_str()) {
            return;
        }
        match method {
            "item/completed" => self.item_completed(params.get("item").unwrap_or(&Value::Null)),
            "turn/completed" => self.turn_completed(params.get("turn").unwrap_or(&Value::Null)),
            "error" => {
                let will_retry = params
                    .get("willRetry")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                let message = params.pointer("/error/message").and_then(Value::as_str);
                if let (false, Some(message), Some(turn)) = (will_retry, message, &mut self.turn) {
                    turn.error = Some(message.to_owned());
                }
            }
            other => {
                if self.reported_methods.insert(other.to_owned()) {
                    eprintln!("Benachrichtigung von Codex noch nicht übersetzt: {other}");
                }
            }
        }
    }

    fn item_completed(&mut self, item: &Value) {
        let Some(turn) = &mut self.turn else {
            return;
        };
        if turn.is_aborted || item.get("type").and_then(Value::as_str) != Some("agentMessage") {
            return;
        }
        let text = item.get("text").and_then(Value::as_str).unwrap_or_default();
        text.clone_into(&mut turn.last_text);
        self.output.line(&output::assistant(
            &self.session_id,
            vec![json!({ "type": "text", "text": text })],
            0,
            0,
        ));
    }

    fn turn_completed(&mut self, finished: &Value) {
        let Some(turn) = self.turn.take() else {
            return;
        };
        if turn.is_aborted {
            // Der Verwalter hat `result` schon bei Esc bekommen.
            return;
        }
        let line = match finished.get("status").and_then(Value::as_str) {
            Some("completed") => {
                output::result_success(&self.session_id, &turn.last_text, &self.model, 0)
            }
            Some("interrupted") => output::result_aborted(&self.session_id, &self.model, 0),
            _ => {
                let error = finished
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .or(turn.error)
                    .unwrap_or_else(|| UNKNOWN_FAILURE.to_owned());
                output::result_error(&self.session_id, &error, &self.model, 0)
            }
        };
        self.output.line(&without_window(line));
    }

    /// Codex ist weg: ein laufender Turn endet für den Verwalter mit einem Fehler.
    fn fail_turn(&mut self, error: &str) {
        let Some(turn) = self.turn.take() else {
            return;
        };
        if turn.is_aborted {
            return;
        }
        self.output.line(&without_window(output::result_error(
            &self.session_id,
            error,
            &self.model,
            0,
        )));
    }
}
