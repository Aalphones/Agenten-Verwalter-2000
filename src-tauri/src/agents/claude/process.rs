//! Start und Ein-/Ausgabe eines `claude.exe`-Prozesses.
use std::io::{self, BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

use crate::agents::claude::local::{self, LocalBackend};
use crate::agents::event::{Effort, Mode, ModelId};
use crate::processes::hide_console;

const EXIT_POLL_INTERVAL: Duration = Duration::from_millis(50);

pub struct SpawnOptions {
    pub exe: PathBuf,
    pub cwd: PathBuf,
    pub session_id: String,
    pub resume: bool,
    pub model: ModelId,
    pub effort: Effort,
    pub mode: Mode,
    /// Ordner der Session-Repositories (Haupt-Checkout oder App-Worktree): ohne `--add-dir` findet
    /// Claude ihre Skills nicht.
    pub add_dirs: Vec<PathBuf>,
    /// Freigaben für Ticket-Worktrees neben den Haupt-Checkouts (`worktrees::permission_rules`).
    pub allowed_rules: Vec<String>,
    /// `Some` in der Betriebsart Claude Code + LM Studio.
    pub local: Option<LocalBackend>,
}

#[derive(Debug, Clone)]
pub enum ProcessOutput {
    Line(String),
    Stderr(String),
    Exited(Option<i32>),
}

pub struct ClaudeProcess {
    child: Arc<Mutex<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    pid: u32,
}

type OutputHandler = Arc<dyn Fn(ProcessOutput) + Send + Sync>;

/// Startet `claude.exe` ohne Shell und ohne Konsolenfenster. `on_output` läuft auf den
/// Lese-Threads; nach dem letzten `Line` kommt genau ein `Exited`.
pub fn spawn(
    opts: SpawnOptions,
    on_output: impl Fn(ProcessOutput) + Send + Sync + 'static,
) -> io::Result<ClaudeProcess> {
    let mut child = build_command(&opts).spawn()?;
    let (Some(stdin), Some(stdout), Some(stderr)) =
        (child.stdin.take(), child.stdout.take(), child.stderr.take())
    else {
        let _ = child.kill();
        return Err(io::Error::other("Ein-/Ausgabe des Agenten nicht verfügbar"));
    };
    let pid = child.id();
    let child = Arc::new(Mutex::new(child));
    if let Err(error) = start_readers(Arc::clone(&child), stdout, stderr, Arc::new(on_output)) {
        let _ = lock(&child).kill();
        return Err(error);
    }
    Ok(ClaudeProcess {
        child,
        stdin: Mutex::new(Some(stdin)),
        pid,
    })
}

impl ClaudeProcess {
    pub fn write_line(&self, line: &str) -> io::Result<()> {
        let mut stdin = lock(&self.stdin);
        let Some(pipe) = stdin.as_mut() else {
            return Err(io::Error::from(io::ErrorKind::BrokenPipe));
        };
        pipe.write_all(line.as_bytes())?;
        pipe.write_all(b"\n")?;
        pipe.flush()
    }

    /// Ohne Standardeingabe beendet sich der Agent nach der laufenden Antwort von selbst.
    pub fn close_stdin(&self) {
        drop(lock(&self.stdin).take());
    }

    pub fn kill(&self) {
        let _ = lock(&self.child).kill();
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }
}

fn build_command(opts: &SpawnOptions) -> Command {
    let mut command = Command::new(&opts.exe);
    command
        .current_dir(&opts.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("-p")
        .arg("--input-format")
        .arg("stream-json")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--permission-prompt-tool")
        .arg("stdio")
        .arg("--model")
        .arg(match &opts.local {
            Some(backend) => backend.model.as_str(),
            None => opts.model.cli_id(),
        });
    // Das lokale Modell kennt keinen Denkaufwand.
    if opts.local.is_none() {
        command.arg("--effort").arg(opts.effort.cli_value());
    }
    command
        .arg("--permission-mode")
        .arg(opts.mode.cli_value())
        // Ohne die Variable lädt Claude die `CLAUDE.md` eines `--add-dir`-Ordners nicht.
        .env("CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD", "1");
    if let Some(backend) = &opts.local {
        local::apply(&mut command, backend);
    }
    // `--allowedTools` nimmt mehrere Werte; die nächste Option (`--add-dir`, `--resume`,
    // `--session-id`) beendet die Liste.
    if !opts.allowed_rules.is_empty() {
        command.arg("--allowedTools").args(&opts.allowed_rules);
    }
    for dir in &opts.add_dirs {
        command.arg("--add-dir").arg(dir);
    }
    // Claude sucht die `.mcp.json` nur im Arbeitsverzeichnis, das hier der Workspace des Vorhabens
    // ist — die der Repositories reichen wir ausdrücklich nach.
    let mcp_configs = project_mcp_configs(&opts.add_dirs);
    if !mcp_configs.is_empty() {
        command.arg("--mcp-config").args(&mcp_configs);
    }
    if opts.resume {
        command.arg("--resume");
    } else {
        command.arg("--session-id");
    }
    command.arg(&opts.session_id);
    hide_console(&mut command);
    command
}

/// Die `.mcp.json` der Ordner, die eine hat. Ordner ohne Datei fallen still weg.
fn project_mcp_configs(dirs: &[PathBuf]) -> Vec<PathBuf> {
    dirs.iter()
        .map(|dir: &PathBuf| dir.join(".mcp.json"))
        .filter(|file: &PathBuf| file.is_file())
        .collect()
}

fn start_readers(
    child: Arc<Mutex<Child>>,
    stdout: ChildStdout,
    stderr: ChildStderr,
    on_output: OutputHandler,
) -> io::Result<()> {
    let stderr_output = Arc::clone(&on_output);
    thread::Builder::new()
        .name("claude-stderr".to_owned())
        .spawn(move || {
            for_each_line(stderr, |line: String| {
                stderr_output(ProcessOutput::Stderr(line));
            });
        })?;
    thread::Builder::new()
        .name("claude-stdout".to_owned())
        .spawn(move || {
            for_each_line(stdout, |line: String| {
                if !line.trim().is_empty() {
                    on_output(ProcessOutput::Line(line));
                }
            });
            on_output(ProcessOutput::Exited(wait_for_exit(&child)));
        })?;
    Ok(())
}

/// Liest bis Dateiende. Ungültiges UTF-8 wird ersetzt statt das Lesen zu beenden —
/// ein nicht mehr gelesener Pipe-Puffer würde den Agenten sonst blockieren.
fn for_each_line(stream: impl Read, mut handle: impl FnMut(String)) {
    let mut reader = BufReader::new(stream);
    let mut buffer: Vec<u8> = Vec::new();
    loop {
        buffer.clear();
        match reader.read_until(b'\n', &mut buffer) {
            Ok(0) => return,
            Ok(_) => {
                let line = String::from_utf8_lossy(&buffer);
                handle(line.trim_end_matches(['\r', '\n']).to_owned());
            }
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(_) => return,
        }
    }
}

/// Fragt den Exit-Status in kurzen Abständen ab, statt `wait()` unter der Sperre zu halten —
/// sonst müsste ein gleichzeitiges `kill()` warten, bis der Prozess von selbst endet.
fn wait_for_exit(child: &Mutex<Child>) -> Option<i32> {
    loop {
        // Eigene Zeile: im `match`-Kopf hielte die Sperre bis nach dem `sleep`.
        let exit_status = lock(child).try_wait();
        match exit_status {
            Ok(Some(status)) => return status.code(),
            Ok(None) => thread::sleep(EXIT_POLL_INTERVAL),
            Err(_) => return None,
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}
