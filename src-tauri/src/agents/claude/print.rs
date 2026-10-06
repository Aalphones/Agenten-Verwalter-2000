//! Kurzlebiger `claude.exe` im Druckmodus für eine einzige strukturierte Antwort, unabhängig von jeder Session.
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::agents::claude::local::{self, LocalBackend, LocalProgram};
use crate::agents::event::ModelId;
use crate::db::Database;
use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;
use crate::processes::hide_console;
use crate::settings;

pub struct PrintRequest<'a> {
    pub model: ModelId,
    pub system_prompt: &'a str,
    pub json_schema: &'a str,
    pub input: &'a str,
    /// `Some` in der Betriebsart Claude Code + LM Studio.
    pub local: Option<&'a LocalBackend>,
}

/// Ein Einmal-Aufruf von Haiku mit der Betriebsart aus den Einstellungen; in „Autark“ gibt es den
/// Druckmodus noch nicht, dann kommt `autark_message` als Fehler.
pub fn ask_haiku<T: DeserializeOwned>(
    app: &AppHandle,
    exe: &Path,
    request: &HaikuRequest<'_>,
) -> Result<T, String> {
    let cwd = data_dir(app).map_err(|error: CommandError| error.to_string())?;
    let database = app.state::<Arc<Database>>();
    let settings = settings::load(&database).map_err(|error: CommandError| error.to_string())?;
    let backend = local::resolve(&settings).map_err(|error: CommandError| error.to_string())?;
    if backend
        .as_ref()
        .is_some_and(|local: &LocalBackend| local.program == LocalProgram::Standalone)
    {
        return Err(request.autark_message.to_owned());
    }
    let print_request = PrintRequest {
        model: ModelId::Haiku,
        system_prompt: request.system_prompt,
        json_schema: request.json_schema,
        input: request.input,
        local: backend.as_ref(),
    };
    let answer = run_print(exe, &cwd, &print_request, request.timeout)?;
    serde_json::from_value::<T>(answer)
        .map_err(|error| format!("Antwort von Claude nicht lesbar: {error}"))
}

pub struct HaikuRequest<'a> {
    pub system_prompt: &'a str,
    pub json_schema: &'a str,
    pub input: &'a str,
    pub timeout: Duration,
    /// Fehlertext der Betriebsart „Autark“.
    pub autark_message: &'a str,
}

/// Startet `claude.exe`, schickt `input` über die Standardeingabe und liefert `structured_output`.
/// Der Prozess wird in jedem Fall beendet, auch nach Zeitlimit oder Fehler.
pub fn run_print(
    exe: &Path,
    cwd: &Path,
    request: &PrintRequest<'_>,
    timeout: Duration,
) -> Result<Value, String> {
    let mut child = print_command(exe, cwd, request)
        .spawn()
        .map_err(|error| format!("Claude-Kommandozeile startet nicht: {error}"))?;
    let output = exchange(&mut child, request.input, timeout);
    // Ohne `wait` bliebe ein Prozess-Handle offen; Lese- und Schreib-Thread enden nach `kill` mit
    // dem Schließen der Pipes.
    let _ = child.kill();
    let _ = child.wait();
    structured_output(&output?)
}

/// Ohne Werkzeuge, MCP-Server, Hooks und Transkript; `--bare` scheidet aus, weil es sich nur mit
/// API-Schlüssel anmeldet, nicht mit dem Abo (docs/knowledge/claude-stream-json.md).
fn print_command(exe: &Path, cwd: &Path, request: &PrintRequest<'_>) -> Command {
    let mut command = Command::new(exe);
    command
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .arg("-p")
        .arg("--model")
        .arg(match request.local {
            Some(backend) => backend.model.as_str(),
            None => request.model.cli_id(),
        })
        // `--tools` nimmt mehrere Werte: der leere schaltet alle ab, `--safe-mode` beendet die Liste.
        .arg("--tools")
        .arg("")
        .arg("--safe-mode")
        .arg("--strict-mcp-config")
        .arg("--no-session-persistence")
        .arg("--system-prompt")
        .arg(request.system_prompt)
        .arg("--json-schema")
        .arg(request.json_schema)
        .arg("--output-format")
        .arg("json");
    if let Some(backend) = request.local {
        local::apply(&mut command, backend);
    }
    hide_console(&mut command);
    command
}

/// Die ganze Standardausgabe als Text. Schreiben und Lesen laufen in eigenen Threads, damit das
/// Zeitlimit auch dann greift, wenn die Kommandozeile die Eingabe nicht abnimmt.
fn exchange(child: &mut Child, input: &str, timeout: Duration) -> Result<String, String> {
    let (Some(stdin), Some(stdout)) = (child.stdin.take(), child.stdout.take()) else {
        return Err("Ein-/Ausgabe von Claude nicht verfügbar".to_owned());
    };
    let receiver = start_reader(stdout)?;
    start_writer(stdin, input.to_owned())?;
    match receiver.recv_timeout(timeout) {
        Ok(output) => output,
        Err(RecvTimeoutError::Timeout) => Err(format!(
            "Claude antwortete nicht innerhalb von {} s",
            timeout.as_secs()
        )),
        Err(RecvTimeoutError::Disconnected) => Err("Claude beendete sich ohne Antwort".to_owned()),
    }
}

fn start_reader(mut stdout: ChildStdout) -> Result<Receiver<Result<String, String>>, String> {
    let (sender, receiver) = mpsc::channel::<Result<String, String>>();
    thread::Builder::new()
        .name("claude-print-read".to_owned())
        .spawn(move || {
            let mut output = String::new();
            let read = stdout
                .read_to_string(&mut output)
                .map(|_| output)
                .map_err(|error| format!("Antwort von Claude nicht lesbar: {error}"));
            // Nach einem Zeitlimit gibt es keinen Empfänger mehr; die Antwort verfällt dann.
            let _ = sender.send(read);
        })
        .map_err(|error| format!("Lese-Thread startet nicht: {error}"))?;
    Ok(receiver)
}

/// Schließt die Eingabe nach dem Schreiben: erst dann beginnt die Kommandozeile im Modus `-p`.
/// Ein Schreibfehler zeigt sich als fehlende oder unlesbare Antwort.
fn start_writer(mut stdin: ChildStdin, input: String) -> Result<(), String> {
    thread::Builder::new()
        .name("claude-print-write".to_owned())
        .spawn(move || {
            let _ = stdin
                .write_all(input.as_bytes())
                .and_then(|()| stdin.flush());
        })
        .map_err(|error| format!("Schreib-Thread startet nicht: {error}"))?;
    Ok(())
}

fn structured_output(output: &str) -> Result<Value, String> {
    if output.trim().is_empty() {
        return Err("Claude beendete sich ohne Antwort".to_owned());
    }
    let answer: Value = serde_json::from_str(output)
        .map_err(|error| format!("Antwort von Claude nicht lesbar: {error}"))?;
    if answer.get("is_error").and_then(Value::as_bool) == Some(true) {
        let message = answer
            .get("result")
            .and_then(Value::as_str)
            .filter(|text: &&str| !text.trim().is_empty())
            .unwrap_or("Claude meldet einen Fehler");
        return Err(message.to_owned());
    }
    match answer.get("structured_output") {
        Some(structured) if structured.is_object() => Ok(structured.clone()),
        _ => Err("Claude lieferte keine strukturierte Antwort".to_owned()),
    }
}
