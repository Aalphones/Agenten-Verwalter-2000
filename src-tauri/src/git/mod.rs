//! Einziger Ort, der `git` aufruft (AGENTS.md, Regel 2).
use std::ffi::OsStr;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

use crate::error::CommandError;
use crate::processes::hide_console;

const MAX_ERROR_CHARS: usize = 500;

/// Wurzelordner des Repositorys, in dem `dir` liegt (Backslashes unter Windows).
pub fn toplevel(dir: &Path) -> Result<PathBuf, CommandError> {
    let output = run(dir, &args(&["rev-parse", "--show-toplevel"]))?;
    Ok(PathBuf::from(output.replace('/', "\\")))
}

pub fn head_commit(repo: &Path) -> Result<String, CommandError> {
    run(repo, &args(&["rev-parse", "--verify", "HEAD"]))
}

/// Der ausgecheckte Branch, `None` bei losgelöstem HEAD.
pub fn head_branch(repo: &Path) -> Result<Option<String>, CommandError> {
    let output = run_allowing_failure(repo, &args(&["symbolic-ref", "--short", "-q", "HEAD"]))?;
    if output.status.success() {
        return Ok(Some(stdout_text(&output)));
    }
    if output.status.code() == Some(1) {
        return Ok(None);
    }
    Err(git_error(&output))
}

pub fn branch_exists(repo: &Path, branch: &str) -> Result<bool, CommandError> {
    let reference = format!("refs/heads/{branch}");
    exit_means_yes_or_no(
        repo,
        &args(&["show-ref", "--verify", "--quiet", &reference]),
    )
}

pub fn worktree_add_new(
    repo: &Path,
    path: &Path,
    branch: &str,
    start: &str,
) -> Result<(), CommandError> {
    let arguments: Vec<&OsStr> = vec![
        "worktree".as_ref(),
        "add".as_ref(),
        "-b".as_ref(),
        branch.as_ref(),
        path.as_os_str(),
        start.as_ref(),
    ];
    run(repo, &arguments).map(|_| ())
}

pub fn worktree_add_existing(repo: &Path, path: &Path, branch: &str) -> Result<(), CommandError> {
    let arguments: Vec<&OsStr> = vec![
        "worktree".as_ref(),
        "add".as_ref(),
        path.as_os_str(),
        branch.as_ref(),
    ];
    run(repo, &arguments).map(|_| ())
}

/// Ohne `--force`: Git verweigert bei geänderten oder neuen, nicht ignorierten Dateien.
pub fn worktree_remove(repo: &Path, path: &Path) -> Result<(), CommandError> {
    let arguments: Vec<&OsStr> = vec!["worktree".as_ref(), "remove".as_ref(), path.as_os_str()];
    run(repo, &arguments).map(|_| ())
}

/// Nur für den Rückbau eines gescheiterten Anlegens.
pub fn worktree_remove_force(repo: &Path, path: &Path) -> Result<(), CommandError> {
    let arguments: Vec<&OsStr> = vec![
        "worktree".as_ref(),
        "remove".as_ref(),
        "--force".as_ref(),
        path.as_os_str(),
    ];
    run(repo, &arguments).map(|_| ())
}

pub fn worktree_prune(repo: &Path) -> Result<(), CommandError> {
    run(repo, &args(&["worktree", "prune"])).map(|_| ())
}

/// Nur für den Rückbau eines gescheiterten Anlegens.
pub fn branch_delete_force(repo: &Path, branch: &str) -> Result<(), CommandError> {
    run(repo, &args(&["branch", "-D", branch])).map(|_| ())
}

fn args<'a>(values: &[&'a str]) -> Vec<&'a OsStr> {
    values
        .iter()
        .map(|value: &&str| OsStr::new(*value))
        .collect()
}

/// Exit 0 heißt ja, Exit 1 nein, alles andere ist ein Fehler.
fn exit_means_yes_or_no(repo: &Path, arguments: &[&OsStr]) -> Result<bool, CommandError> {
    let output = run_allowing_failure(repo, arguments)?;
    match output.status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(git_error(&output)),
    }
}

fn run(dir: &Path, arguments: &[&OsStr]) -> Result<String, CommandError> {
    let output = run_allowing_failure(dir, arguments)?;
    if output.status.success() {
        return Ok(stdout_text(&output));
    }
    Err(git_error(&output))
}

fn run_allowing_failure(dir: &Path, arguments: &[&OsStr]) -> Result<Output, CommandError> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(dir)
        .args(arguments)
        .stdin(Stdio::null())
        // Ohne das wartet Git bei fehlender Anmeldung auf eine Eingabe, die nie kommt.
        .env("GIT_TERMINAL_PROMPT", "0");
    hide_console(&mut command);
    command.output().map_err(|error: io::Error| {
        if error.kind() == io::ErrorKind::NotFound {
            CommandError::GitNotFound
        } else {
            CommandError::from(error)
        }
    })
}

fn stdout_text(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout)
        .trim_end()
        .to_owned()
}

fn git_error(output: &Output) -> CommandError {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let message = stderr.trim();
    if message.is_empty() {
        let code: String = output
            .status
            .code()
            .map_or_else(|| "unbekannt".to_owned(), |code: i32| code.to_string());
        return CommandError::Git(format!("Exit-Code {code}"));
    }
    CommandError::Git(message.chars().take(MAX_ERROR_CHARS).collect())
}
