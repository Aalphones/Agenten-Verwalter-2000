//! `Bash` (Git Bash) und `PowerShell` (Windows PowerShell 5.1): ein Befehl im Arbeitsordner, mit
//! Zeitlimit und Abbruch über Esc. Auch die Hooks laufen über `bash_path` und `wait_for`.
use std::env;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::Value;

use super::{ToolContext, optional_count, required_string};
use crate::processes::hide_console;

pub const BASH_PATH_VARIABLE: &str = "VERWALTER_BASH_PATH";
const DEFAULT_GIT_BASH: &str = r"C:\Program Files\Git\bin\bash.exe";
const BASH_NOT_FOUND: &str =
    "Git Bash nicht gefunden — Umgebungsvariable VERWALTER_BASH_PATH auf bash.exe setzen.";

const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const MAX_TIMEOUT_MS: u64 = 600_000;
const POLL_INTERVAL: Duration = Duration::from_millis(50);
/// So lange warten die Lese-Threads nach Prozessende noch auf den Rest der Ausgabe. Hält ein
/// Enkelprozess die Pipe offen, bleibt es bei dem, was bis dahin kam.
const READER_GRACE: Duration = Duration::from_secs(1);
/// Exit-Code, den `timeout` aus den GNU-Werkzeugen bei überschrittenem Zeitlimit meldet.
const TIMEOUT_EXIT_CODE: i32 = 124;
const CANCELLED_TEXT: &str =
    "Vom Benutzer unterbrochen. Der Befehl kann teilweise ausgeführt worden sein.";
/// PowerShell 5.1 schreibt umgeleitete Ausgabe sonst in der Konsolen-Codepage — Umlaute kaputt.
const POWERSHELL_PREAMBLE: &str = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ";
const BYTE_ORDER_MARK: char = '\u{feff}';

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellKind {
    Bash,
    PowerShell,
}

pub enum Waited {
    Exited(i32),
    TimedOut,
    Cancelled,
}

/// Git Bash, nie `bash.exe` aus dem `PATH` — das kann die Bash von WSL sein.
pub fn bash_path() -> Result<PathBuf, String> {
    if let Some(configured) = env::var_os(BASH_PATH_VARIABLE).map(PathBuf::from)
        && configured.is_file()
    {
        return Ok(configured);
    }
    let default = PathBuf::from(DEFAULT_GIT_BASH);
    if default.is_file() {
        return Ok(default);
    }
    bash_next_to_git().ok_or_else(|| BASH_NOT_FOUND.to_owned())
}

/// `…\Git\cmd\git.exe` oder `…\Git\bin\git.exe` im `PATH` → `…\Git\bin\bash.exe`.
fn bash_next_to_git() -> Option<PathBuf> {
    let path_variable = env::var_os("PATH")?;
    env::split_paths(&path_variable)
        .filter(|dir: &PathBuf| dir.join("git.exe").is_file())
        .filter_map(|dir: PathBuf| {
            let folder = dir.file_name()?.to_string_lossy().to_lowercase();
            if folder == "cmd" || folder == "bin" {
                Some(dir.parent()?.join("bin").join("bash.exe"))
            } else {
                None
            }
        })
        .find(|bash: &PathBuf| bash.is_file())
}

pub fn run(kind: ShellKind, input: &Value, context: &ToolContext) -> Result<String, String> {
    let command_text = required_string(input, "command")?;
    let timeout_ms = optional_count(input, "timeout")
        .and_then(|value: usize| u64::try_from(value).ok())
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .clamp(1, MAX_TIMEOUT_MS);
    let mut command = shell_command(kind, command_text)?;
    command
        .current_dir(&context.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(&mut command);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Befehl startet nicht: {error}"))?;
    let collected = Arc::new(Mutex::new(Vec::<u8>::new()));
    let readers = spawn_readers(&mut child, &collected);
    let timeout = Duration::from_millis(timeout_ms);
    let waited = wait_for(&mut child, timeout, &context.cancel);
    wait_for_readers(&readers);
    let output = decoded(&collected.lock().unwrap_or_else(PoisonError::into_inner));
    match waited {
        Waited::Cancelled => Err(CANCELLED_TEXT.to_owned()),
        Waited::TimedOut => Err(format!(
            "Exit code {TIMEOUT_EXIT_CODE}\nZeitlimit von {} s überschritten.\n{output}",
            timeout.as_secs()
        )),
        Waited::Exited(0) if output.trim().is_empty() => Ok("(keine Ausgabe)".to_owned()),
        Waited::Exited(0) => Ok(output),
        Waited::Exited(code) => Err(format!("Exit code {code}\n{output}")),
    }
}

fn shell_command(kind: ShellKind, command_text: &str) -> Result<Command, String> {
    match kind {
        ShellKind::Bash => {
            let mut command = Command::new(bash_path()?);
            command.arg("-c").arg(command_text);
            Ok(command)
        }
        ShellKind::PowerShell => {
            // Nicht `-EncodedCommand`: damit schreibt PowerShell 5.1 Fehler als CLIXML auf stderr
            // statt als Text.
            let mut command = Command::new("powershell.exe");
            command
                .args(["-NoProfile", "-NonInteractive", "-Command"])
                .arg(format!("{POWERSHELL_PREAMBLE}{command_text}"));
            Ok(command)
        }
    }
}

/// Je ein Lese-Thread für stdout und stderr, beide in denselben Puffer — die Reihenfolge der
/// Ausgabe bleibt grob erhalten. Jeder meldet sein Ende über den Kanal.
fn spawn_readers(child: &mut Child, collected: &Arc<Mutex<Vec<u8>>>) -> Receiver<()> {
    let (done_sender, done_receiver) = mpsc::channel::<()>();
    let streams: Vec<Box<dyn Read + Send>> = [
        child
            .stdout
            .take()
            .map(|stream| Box::new(stream) as Box<dyn Read + Send>),
        child
            .stderr
            .take()
            .map(|stream| Box::new(stream) as Box<dyn Read + Send>),
    ]
    .into_iter()
    .flatten()
    .collect();
    for mut stream in streams {
        let collected = Arc::clone(collected);
        let done_sender = done_sender.clone();
        thread::spawn(move || {
            let mut buffer = [0_u8; 8192];
            while let Ok(read) = stream.read(&mut buffer) {
                if read == 0 {
                    break;
                }
                collected
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .extend_from_slice(&buffer[..read]);
            }
            let _ = done_sender.send(());
        });
    }
    done_receiver
}

fn wait_for_readers(readers: &Receiver<()>) {
    let deadline = Instant::now() + READER_GRACE;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if readers.recv_timeout(remaining).is_err() {
            // Alle fertig (Kanal getrennt) oder die Frist ist um.
            return;
        }
    }
}

/// Wartet in 50-ms-Schritten auf das Prozessende. Abbruch oder Zeitlimit beenden den ganzen
/// Prozessbaum — `bash -c` startet seine Befehle als Kindprozesse, die sonst weiterliefen.
pub fn wait_for(child: &mut Child, timeout: Duration, cancel: &AtomicBool) -> Waited {
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Waited::Exited(status.code().unwrap_or(-1)),
            Ok(None) => {}
            Err(_) => return Waited::Exited(-1),
        }
        let waited = if cancel.load(Ordering::SeqCst) {
            Waited::Cancelled
        } else if started.elapsed() >= timeout {
            Waited::TimedOut
        } else {
            thread::sleep(POLL_INTERVAL);
            continue;
        };
        kill_tree(child);
        return waited;
    }
}

fn kill_tree(child: &mut Child) {
    let mut taskkill = Command::new("taskkill");
    taskkill
        .args(["/PID", &child.id().to_string(), "/T", "/F"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    hide_console(&mut taskkill);
    if taskkill.status().is_err() {
        let _ = child.kill();
    }
    let _ = child.wait();
}

fn decoded(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes)
        .trim_start_matches(BYTE_ORDER_MARK)
        .trim_end()
        .to_owned()
}
