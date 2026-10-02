//! Einziger Ort, der `git` aufruft (AGENTS.md, Regel 2).
use std::ffi::OsStr;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;

use crate::error::CommandError;
use crate::processes::hide_console;

const MAX_ERROR_CHARS: usize = 500;
const LOCAL_BRANCH_PREFIX: &str = "refs/heads/";
/// Wird geprüft, wenn `origin/HEAD` keinen Standard-Branch nennt — in dieser Reihenfolge.
const FALLBACK_DEFAULT_BRANCHES: [&str; 2] = ["main", "master"];

/// Ein Eintrag aus `git worktree list --porcelain`; `path` mit Backslashes, `branch` ohne
/// `refs/heads/`, `None` bei losgelöstem HEAD.
#[derive(Debug, Clone)]
pub struct WorktreeEntry {
    pub path: PathBuf,
    pub head: String,
    pub branch: Option<String>,
}

/// Wurzelordner des Repositorys, in dem `dir` liegt (Backslashes unter Windows).
pub fn toplevel(dir: &Path) -> Result<PathBuf, CommandError> {
    let output = run(dir, &args(&["rev-parse", "--show-toplevel"]))?;
    Ok(PathBuf::from(output.replace('/', "\\")))
}

pub fn head_commit(repo: &Path) -> Result<String, CommandError> {
    run(repo, &args(&["rev-parse", "--verify", "HEAD"]))
}

/// Der letzte Commit auf dem ersten-Eltern-Pfad von HEAD vor `before_seconds` (Sekunden seit 1970),
/// `None`, wenn es davor keinen gibt. Liest nur und nimmt keine Index-Sperre (ADR 006).
pub fn commit_before(repo: &Path, before_seconds: i64) -> Result<Option<String>, CommandError> {
    let before = format!("--before={before_seconds}");
    let output = run(
        repo,
        &args(&["rev-list", "-1", "--first-parent", &before, "HEAD"]),
    )?;
    let commit = output.trim();
    if commit.is_empty() {
        return Ok(None);
    }
    Ok(Some(commit.to_owned()))
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
    let reference = format!("{LOCAL_BRANCH_PREFIX}{branch}");
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

pub fn worktree_prune(repo: &Path) -> Result<(), CommandError> {
    run(repo, &args(&["worktree", "prune"])).map(|_| ())
}

/// Alle Worktrees des Repositorys, der Haupt-Checkout eingeschlossen. Liest nur und nimmt keine
/// Index-Sperre (ADR 006).
pub fn worktree_list(repo: &Path) -> Result<Vec<WorktreeEntry>, CommandError> {
    let output = run(repo, &args(&["worktree", "list", "--porcelain"]))?;
    let entries = output
        .split("\n\n")
        .filter_map(parse_worktree_block)
        .collect();
    Ok(entries)
}

/// Ein Block aus `worktree list --porcelain`; ohne `worktree`-Zeile kein Eintrag.
fn parse_worktree_block(block: &str) -> Option<WorktreeEntry> {
    let mut path: Option<PathBuf> = None;
    let mut head = String::new();
    let mut branch: Option<String> = None;
    for line in block.lines() {
        let line = line.trim_end_matches('\r');
        if let Some(value) = line.strip_prefix("worktree ") {
            path = Some(PathBuf::from(value.replace('/', "\\")));
        } else if let Some(value) = line.strip_prefix("HEAD ") {
            value.clone_into(&mut head);
        } else if let Some(value) = line.strip_prefix("branch ") {
            branch = Some(
                value
                    .strip_prefix(LOCAL_BRANCH_PREFIX)
                    .unwrap_or(value)
                    .to_owned(),
            );
        }
    }
    Some(WorktreeEntry {
        path: path?,
        head,
        branch,
    })
}

pub fn merge_base(dir: &Path, first: &str, second: &str) -> Result<String, CommandError> {
    run(dir, &args(&["merge-base", first, second]))
}

/// Der Standard-Branch, nicht der ausgecheckte: erst das, worauf `origin/HEAD` zeigt, dann `main`,
/// dann `master` — jeweils nur, wenn es den lokalen Branch gibt.
pub fn default_branch(repo: &Path) -> Result<Option<String>, CommandError> {
    let output = run_allowing_failure(
        repo,
        &args(&[
            "symbolic-ref",
            "--quiet",
            "--short",
            "refs/remotes/origin/HEAD",
        ]),
    )?;
    if output.status.success() {
        let remote_head = stdout_text(&output);
        if let Some((_, branch)) = remote_head.split_once('/')
            && branch_exists(repo, branch)?
        {
            return Ok(Some(branch.to_owned()));
        }
    }
    for branch in FALLBACK_DEFAULT_BRANCHES {
        if branch_exists(repo, branch)? {
            return Ok(Some(branch.to_owned()));
        }
    }
    Ok(None)
}

/// `git diff-tree -r --no-renames --name-status -z <from> <to>`
pub fn diff_tree_name_status(
    worktree: &Path,
    from: &str,
    to: &str,
) -> Result<String, CommandError> {
    run_raw(
        worktree,
        &args(&[
            "diff-tree",
            "-r",
            "--no-renames",
            "--name-status",
            "-z",
            from,
            to,
        ]),
    )
}

/// `git diff-tree -r --no-renames --numstat -z <from> <to>`
pub fn diff_tree_numstat(worktree: &Path, from: &str, to: &str) -> Result<String, CommandError> {
    run_raw(
        worktree,
        &args(&[
            "diff-tree",
            "-r",
            "--no-renames",
            "--numstat",
            "-z",
            from,
            to,
        ]),
    )
}

/// `git diff-index --no-renames --name-status -z <from>` — Stand `from` gegen das Arbeitsverzeichnis.
pub fn diff_index_name_status(worktree: &Path, from: &str) -> Result<String, CommandError> {
    run_raw(
        worktree,
        &args(&["diff-index", "--no-renames", "--name-status", "-z", from]),
    )
}

/// `git diff-index --no-renames --numstat -z <from>` — Stand `from` gegen das Arbeitsverzeichnis.
pub fn diff_index_numstat(worktree: &Path, from: &str) -> Result<String, CommandError> {
    run_raw(
        worktree,
        &args(&["diff-index", "--no-renames", "--numstat", "-z", from]),
    )
}

/// `git ls-files --others --exclude-standard -z` — neue, nicht ignorierte Dateien.
pub fn untracked_files(worktree: &Path) -> Result<String, CommandError> {
    run_raw(
        worktree,
        &args(&["ls-files", "--others", "--exclude-standard", "-z"]),
    )
}

/// `git rev-list --reverse --topo-order --no-merges --timestamp --parents <from>..HEAD`
pub fn commits_since(worktree: &Path, from: &str) -> Result<String, CommandError> {
    let range = format!("{from}..HEAD");
    run(
        worktree,
        &args(&[
            "rev-list",
            "--reverse",
            "--topo-order",
            "--no-merges",
            "--timestamp",
            "--parents",
            &range,
        ]),
    )
}

/// `git diff-tree --stdin -r --no-renames --name-only -z` mit einer Commit-ID je Zeile: in einem
/// Aufruf je Commit `<ID>\0<Pfad>\0…` gegen seinen Elternteil. Commits ohne Änderung und ohne
/// Elternteil fehlen in der Ausgabe.
pub fn commit_files(worktree: &Path, commits: &[String]) -> Result<String, CommandError> {
    let mut input = commits.join("\n");
    input.push('\n');
    run_raw_with_input(
        worktree,
        &args(&[
            "diff-tree",
            "--stdin",
            "-r",
            "--no-renames",
            "--name-only",
            "-z",
        ]),
        input,
    )
}

/// `git diff-tree -r -p --no-renames -U3 <from> <to> -- <path>`
pub fn diff_tree_patch(
    worktree: &Path,
    from: &str,
    to: &str,
    path: &str,
) -> Result<String, CommandError> {
    run_raw(
        worktree,
        &args(&[
            "diff-tree",
            "-r",
            "-p",
            "--no-renames",
            "-U3",
            from,
            to,
            "--",
            path,
        ]),
    )
}

/// `git diff-index -p --no-renames -U3 <from> -- <path>` — Stand `from` gegen das Arbeitsverzeichnis.
pub fn diff_index_patch(worktree: &Path, from: &str, path: &str) -> Result<String, CommandError> {
    run_raw(
        worktree,
        &args(&["diff-index", "-p", "--no-renames", "-U3", from, "--", path]),
    )
}

/// Ob `path` eine neue, nicht ignorierte Datei ist, die Git noch nicht kennt.
pub fn is_untracked(worktree: &Path, path: &str) -> Result<bool, CommandError> {
    let output = run_raw(
        worktree,
        &args(&[
            "ls-files",
            "--others",
            "--exclude-standard",
            "-z",
            "--",
            path,
        ]),
    )?;
    Ok(!output.is_empty())
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

/// Wie `run`, schneidet aber nichts ab: `-z`-Ausgaben und Diff-Text brauchen jedes Zeichen.
fn run_raw(dir: &Path, arguments: &[&OsStr]) -> Result<String, CommandError> {
    let output = run_allowing_failure(dir, arguments)?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }
    Err(git_error(&output))
}

/// Wie `run_raw`, schreibt aber `input` auf die Standardeingabe.
fn run_raw_with_input(
    dir: &Path,
    arguments: &[&OsStr],
    input: String,
) -> Result<String, CommandError> {
    let mut command = git_command(dir, arguments);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(spawn_error)?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| CommandError::Internal("Git ohne Standardeingabe gestartet".to_owned()))?;
    // Eigener Thread: Git schreibt schon, während es liest — eine volle Ausgabe-Pipe hielte sonst
    // beide Seiten fest.
    let writer = thread::spawn(move || stdin.write_all(input.as_bytes()));
    let output = child.wait_with_output()?;
    // Ein Schreibfehler heißt meist, dass Git vorher beendet war; dann sagt der Exit-Code mehr.
    let written = writer
        .join()
        .unwrap_or_else(|_| Err(io::Error::other("Schreib-Thread abgebrochen")));
    if !output.status.success() {
        return Err(git_error(&output));
    }
    written?;
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn run_allowing_failure(dir: &Path, arguments: &[&OsStr]) -> Result<Output, CommandError> {
    let mut command = git_command(dir, arguments);
    command.stdin(Stdio::null());
    command.output().map_err(spawn_error)
}

fn git_command(dir: &Path, arguments: &[&OsStr]) -> Command {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(dir)
        .args(arguments)
        // Ohne das wartet Git bei fehlender Anmeldung auf eine Eingabe, die nie kommt.
        .env("GIT_TERMINAL_PROMPT", "0")
        // Lesende Aufrufe sollen nie eine Sperre im Worktree des Agenten nehmen.
        .env("GIT_OPTIONAL_LOCKS", "0");
    hide_console(&mut command);
    command
}

fn spawn_error(error: io::Error) -> CommandError {
    if error.kind() == io::ErrorKind::NotFound {
        CommandError::GitNotFound
    } else {
        CommandError::from(error)
    }
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
