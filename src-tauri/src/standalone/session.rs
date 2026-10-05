//! Hauptschleife einer Session: Zeilen von stdin, Turns gegen das Modell, Unterbrechen.
//!
//! Die Modellanfrage läuft in einem Arbeits-Thread; die Hauptschleife bleibt frei, damit ein
//! `interrupt` während der Anfrage ankommt. Nachrichten, die während eines Turns eintreffen,
//! warten in der Schlange und werden danach je als eigener Turn verarbeitet.
use std::collections::VecDeque;
use std::env;
use std::io::{self, BufRead};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender, TryRecvError};
use std::thread;
use std::time::Duration;

use serde_json::{Value, json};

use super::args::{self, AgentArgs, Start};
use super::llm::{self, ChatRequest, Completion, LlmError};
use super::output::{self, Output};
use super::transcript::Transcript;
use super::{BASE_URL_VARIABLE, CONTEXT_WINDOW_VARIABLE, EXIT_START_FAILED, content, prompt};

/// Takt der Hauptschleife, solange weder eine Zeile noch eine Antwort ankommt.
const POLL_INTERVAL: Duration = Duration::from_millis(20);
/// Steht nach einer unterbrochenen Antwort im Verlauf, damit das Modell im nächsten Turn weiß,
/// dass seine letzte Antwort nie ankam. Wortlaut wie bei der Claude-Kommandozeile.
const INTERRUPTED_MARKER: &str = "[Request interrupted by user]";
/// Grobe Schätzung, wenn das Modell keine Token-Zahl meldet.
const CHARS_PER_TOKEN: usize = 4;
const BYTE_ORDER_MARK: char = '\u{feff}';

enum Input {
    Line(String),
    Closed,
}

/// Ein laufender Turn. Nach `interrupt` ist er für den Verwalter schon beendet (`is_aborted`), lebt
/// hier aber weiter, bis der Arbeits-Thread zurückkehrt — erst dann beginnt der nächste.
struct ActiveTurn {
    cancel: Arc<AtomicBool>,
    answer: Receiver<Result<Completion, LlmError>>,
    is_aborted: bool,
}

struct Session {
    output: Arc<Output>,
    session_id: String,
    base_url: String,
    context_window: u32,
    cwd: PathBuf,
    prompt_appendix: Option<String>,
    model: String,
    transcript: Transcript,
    queue: VecDeque<Value>,
    turn: Option<ActiveTurn>,
}

pub fn run(args: AgentArgs) -> i32 {
    let (base_url, context_window) = match read_environment() {
        Ok(values) => values,
        Err(error) => {
            eprintln!("{error}");
            return EXIT_START_FAILED;
        }
    };
    let (session_id, transcript) = match open_transcript(&args.start) {
        Ok(opened) => opened,
        Err(error) => {
            eprintln!("{error}");
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
    let output = Arc::new(Output::default());
    output.line(&output::init(&session_id, &args.model, &cwd, &[]));
    let (input_sender, input_receiver) = mpsc::channel::<Input>();
    if let Err(error) = spawn_stdin_reader(input_sender) {
        eprintln!("Lese-Thread startet nicht: {error}");
        return EXIT_START_FAILED;
    }
    let mut session = Session {
        output,
        session_id,
        base_url,
        context_window,
        cwd,
        prompt_appendix: args.append_system_prompt,
        model: args.model,
        transcript,
        queue: VecDeque::new(),
        turn: None,
    };
    session.run_loop(&input_receiver);
    0
}

fn read_environment() -> Result<(String, u32), String> {
    let base_url = env::var(BASE_URL_VARIABLE)
        .ok()
        .map(|value: String| value.trim().trim_end_matches('/').to_owned())
        .filter(|value: &String| !value.is_empty())
        .ok_or_else(|| format!("{BASE_URL_VARIABLE} fehlt"))?;
    let context_window = env::var(CONTEXT_WINDOW_VARIABLE)
        .ok()
        .and_then(|value: String| value.trim().parse::<u32>().ok())
        .ok_or_else(|| format!("{CONTEXT_WINDOW_VARIABLE} fehlt oder ist keine Ganzzahl"))?;
    Ok((base_url, context_window))
}

fn open_transcript(start: &Start) -> Result<(String, Transcript), String> {
    match start {
        Start::New(id) => Ok((id.clone(), Transcript::create(id)?)),
        Start::Resume(id) => Ok((id.clone(), Transcript::resume(id)?)),
        Start::None => Err("--session-id oder --resume fehlt".to_owned()),
    }
}

/// Liest bis Dateiende; danach kommt genau ein `Closed`.
fn spawn_stdin_reader(sender: Sender<Input>) -> io::Result<()> {
    thread::Builder::new()
        .name("agent-stdin".to_owned())
        .spawn(move || {
            for line in io::stdin().lock().lines() {
                let Ok(line) = line else {
                    break;
                };
                if !line.trim().is_empty() && sender.send(Input::Line(line)).is_err() {
                    return;
                }
            }
            let _ = sender.send(Input::Closed);
        })?;
    Ok(())
}

impl Session {
    fn run_loop(&mut self, input: &Receiver<Input>) {
        loop {
            match input.recv_timeout(POLL_INTERVAL) {
                Ok(Input::Line(line)) => self.handle_line(&line),
                Ok(Input::Closed) | Err(RecvTimeoutError::Disconnected) => {
                    if let Some(turn) = &self.turn {
                        turn.cancel.store(true, Ordering::SeqCst);
                    }
                    return;
                }
                Err(RecvTimeoutError::Timeout) => {}
            }
            self.poll_turn();
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
            // Antworten auf eigene Rückfragen gibt es erst mit Werkzeugen.
            Some("control_response") => {}
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
            // Ohne Werkzeuge ändert der Modus nichts; geprüft wird er trotzdem.
            "set_permission_mode" => {
                let mode = request
                    .get("mode")
                    .and_then(Value::as_str)
                    .and_then(args::mode_from_cli);
                if mode.is_some() {
                    self.reply_success(request_id);
                } else {
                    self.reply_error(request_id, "unbekannter Modus");
                }
            }
            "set_model" => match request.get("model").and_then(Value::as_str) {
                Some(model) => {
                    model.clone_into(&mut self.model);
                    self.reply_success(request_id);
                }
                None => self.reply_error(request_id, "model fehlt"),
            },
            // Hintergrundaufgaben gibt es noch nicht — nichts zu beenden.
            "stop_task" => self.reply_success(request_id),
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

    /// Meldet den Turn sofort als abgebrochen, statt auf den Arbeits-Thread zu warten: der liest
    /// erst beim nächsten Stück der Antwort wieder, und während LM Studio den Prompt verarbeitet,
    /// kommt lange keins.
    fn interrupt(&mut self) {
        match &mut self.turn {
            Some(turn) if !turn.is_aborted => {
                turn.cancel.store(true, Ordering::SeqCst);
                turn.is_aborted = true;
            }
            _ => return,
        }
        self.append_or_report(json!({ "role": "user", "content": INTERRUPTED_MARKER }));
        self.output.line(&output::result_aborted(
            &self.session_id,
            &self.model,
            self.context_window,
        ));
    }

    fn start_turn(&mut self, content: &Value) {
        if let Err(error) = self.transcript.append(content::user_message(content)) {
            self.output.line(&output::result_error(
                &self.session_id,
                &error,
                &self.model,
                self.context_window,
            ));
            return;
        }
        let messages = self.request_messages();
        let cancel = Arc::new(AtomicBool::new(false));
        let (answer_sender, answer_receiver) = mpsc::channel();
        let worker_cancel = Arc::clone(&cancel);
        let base_url = self.base_url.clone();
        let model = self.model.clone();
        let spawned = thread::Builder::new()
            .name("agent-turn".to_owned())
            .spawn(move || {
                let request = ChatRequest {
                    base_url: &base_url,
                    model: &model,
                    messages: &messages,
                    tools: &[],
                    response_format: None,
                };
                let _ = answer_sender.send(llm::complete(&request, &worker_cancel));
            });
        if let Err(error) = spawned {
            self.output.line(&output::result_error(
                &self.session_id,
                &format!("Arbeits-Thread startet nicht: {error}"),
                &self.model,
                self.context_window,
            ));
            return;
        }
        self.turn = Some(ActiveTurn {
            cancel,
            answer: answer_receiver,
            is_aborted: false,
        });
    }

    /// Systemprompt und Verlauf. Aufeinanderfolgende Benutzer-Nachrichten (nach Abbruch oder Fehler)
    /// werden zusammengelegt — manche Chat-Vorlagen lehnen zwei Benutzer-Nachrichten in Folge ab.
    fn request_messages(&self) -> Vec<Value> {
        let mut messages: Vec<Value> = Vec::with_capacity(self.transcript.messages.len() + 1);
        messages.push(json!({ "role": "system", "content": prompt::system_prompt(&self.cwd, self.prompt_appendix.as_deref()) }));
        for message in &self.transcript.messages {
            let merged = messages
                .last_mut()
                .is_some_and(|previous: &mut Value| content::merge_user(previous, message));
            if !merged {
                messages.push(message.clone());
            }
        }
        messages
    }

    fn poll_turn(&mut self) {
        let Some(turn) = &self.turn else {
            return;
        };
        let answer = match turn.answer.try_recv() {
            Ok(answer) => answer,
            Err(TryRecvError::Empty) => return,
            Err(TryRecvError::Disconnected) => Err(LlmError::Failed(
                "Arbeits-Thread ohne Antwort beendet".to_owned(),
            )),
        };
        let is_aborted = turn.is_aborted;
        self.turn = None;
        if is_aborted {
            // Was das Modell bis zum Abbruch schrieb, hat es nie fertig gesagt — es bleibt draußen.
            return;
        }
        match answer {
            Ok(completion) => self.finish_turn(&completion),
            Err(LlmError::Cancelled) => self.output.line(&output::result_aborted(
                &self.session_id,
                &self.model,
                self.context_window,
            )),
            Err(LlmError::Failed(message)) => self.output.line(&output::result_error(
                &self.session_id,
                &message,
                &self.model,
                self.context_window,
            )),
        }
    }

    fn finish_turn(&mut self, completion: &Completion) {
        let mut blocks: Vec<Value> = Vec::new();
        if !completion.reasoning.is_empty() {
            blocks.push(json!({ "type": "thinking", "thinking": completion.reasoning }));
        }
        if !completion.text.is_empty() {
            blocks.push(json!({ "type": "text", "text": completion.text }));
        }
        let input_tokens = completion
            .prompt_tokens
            .unwrap_or_else(|| self.estimated_prompt_tokens());
        self.output.line(&output::assistant(
            &self.session_id,
            blocks,
            input_tokens,
            completion.completion_tokens.unwrap_or(0),
        ));
        if let Err(error) = self
            .transcript
            .append(json!({ "role": "assistant", "content": completion.text }))
        {
            self.output.line(&output::result_error(
                &self.session_id,
                &error,
                &self.model,
                self.context_window,
            ));
            return;
        }
        self.output.line(&output::result_success(
            &self.session_id,
            &completion.text,
            &self.model,
            self.context_window,
        ));
    }

    /// Zeichen aller gesendeten Texte / 4 — Bilder zählen nicht mit.
    fn estimated_prompt_tokens(&self) -> u32 {
        let characters: usize = self
            .request_messages()
            .iter()
            .map(content::text_chars)
            .sum();
        u32::try_from(characters / CHARS_PER_TOKEN).unwrap_or(u32::MAX)
    }

    /// Ein Schreibfehler am Transkript nach einem Abbruch landet nur auf stderr — der Turn ist für
    /// den Verwalter schon beendet.
    fn append_or_report(&mut self, message: Value) {
        if let Err(error) = self.transcript.append(message) {
            eprintln!("{error}");
        }
    }
}
