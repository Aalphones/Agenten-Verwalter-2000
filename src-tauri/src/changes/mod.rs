//! Was der Agent in den Worktrees einer Session gegenüber der Basis geändert hat — in drei
//! Blickwinkeln, gelesen nur mit Plumbing-Befehlen, die im Worktree keine Sperre nehmen (ADR 006).
pub mod model;
pub mod parse;

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::thread::{self, ScopedJoinHandle};

use crate::changes::model::{
    ChangeKind, ChangeScope, DiffLine, DiffLineKind, FileChange, FileDiff, LineStat,
    RepositoryChanges, SessionChanges,
};
use crate::error::CommandError;
use crate::git;
use crate::worktrees::{RepositoryCheckout, SessionRepository};

/// Größere untracked Dateien gelten als binär: ihre Zeilen zu zählen hieße, sie ganz zu lesen.
const MAX_UNTRACKED_BYTES: u64 = 8 * 1024 * 1024;
/// So viele Bytes prüft auch Git auf ein NUL-Byte, bevor es eine Datei binär nennt.
const BINARY_PROBE_BYTES: usize = 8000;
const WORKTREE_MISSING: &str =
    "Worktree fehlt — die nächste Nachricht an den Agenten legt ihn neu an.";
const THREAD_FAILED: &str = "interner Fehler beim Lesen der Changes";
const HEAD: &str = "HEAD";
const SHORT_COMMIT_CHARS: usize = 7;

/// Liest alle Repositories der Session nebeneinander, je eines in einem eigenen Thread. Scheitert
/// eines, trägt nur sein Eintrag den Fehler.
pub fn load(workspace: &Path, repositories: &[SessionRepository]) -> SessionChanges {
    let repositories = thread::scope(|scope| {
        let handles: Vec<(
            u32,
            &SessionRepository,
            ScopedJoinHandle<'_, RepositoryChanges>,
        )> = repositories
            .iter()
            .enumerate()
            .map(|(index, repository): (usize, &SessionRepository)| {
                let position = u32::try_from(index).unwrap_or(u32::MAX);
                let handle = scope.spawn(move || load_one(workspace, position, repository));
                (position, repository, handle)
            })
            .collect();
        handles
            .into_iter()
            .map(|(position, repository, handle)| {
                // Ein panischer Thread trifft nur sein Repository, nicht die ganze Ansicht.
                handle
                    .join()
                    .unwrap_or_else(|_| failed(position, repository, THREAD_FAILED.to_owned()))
            })
            .collect()
    });
    SessionChanges { repositories }
}

/// Nur lesen: ein fehlender Worktree wird gemeldet, nicht angelegt — das bleibt bei
/// `worktrees::ensure` vor dem Agent-Start.
fn load_one(workspace: &Path, position: u32, repository: &SessionRepository) -> RepositoryChanges {
    if !repository.repository_path.join(".git").exists() {
        let missing =
            CommandError::RepositoryMissing(repository.repository_path.display().to_string());
        return failed(position, repository, missing.to_string());
    }
    let worktree = repository.working_dir(workspace);
    if is_app_worktree_missing(repository, &worktree) {
        return failed(position, repository, WORKTREE_MISSING.to_owned());
    }
    match read_changes(&worktree, &repository.base_commit) {
        Ok((files, commit_count)) => RepositoryChanges {
            position,
            name: repository.name.clone(),
            branch: branch_label(repository),
            base_ref: repository.base_ref.clone(),
            commit_count,
            files,
            error: None,
        },
        Err(error) => failed(position, repository, error.to_string()),
    }
}

fn read_changes(worktree: &Path, base: &str) -> Result<(Vec<FileChange>, u32), CommandError> {
    let committed = parse::scope_stats(
        &git::diff_tree_name_status(worktree, base, HEAD)?,
        &git::diff_tree_numstat(worktree, base, HEAD)?,
    );
    let mut all = parse::scope_stats(
        &git::diff_index_name_status(worktree, base)?,
        &git::diff_index_numstat(worktree, base)?,
    );
    let mut uncommitted = parse::scope_stats(
        &git::diff_index_name_status(worktree, HEAD)?,
        &git::diff_index_numstat(worktree, HEAD)?,
    );
    for path in parse::paths(&git::untracked_files(worktree)?) {
        let stat = untracked_stat(&worktree.join(path.replace('/', "\\")));
        all.insert(path.clone(), stat.clone());
        uncommitted.insert(path, stat);
    }
    let commit_count = git::commit_count(worktree, base)?;

    let mut files: BTreeMap<String, FileChange> = BTreeMap::new();
    for path in all.keys().chain(committed.keys()).chain(uncommitted.keys()) {
        if files.contains_key(path) {
            continue;
        }
        files.insert(
            path.clone(),
            FileChange {
                path: path.clone(),
                all: all.get(path).cloned(),
                committed: committed.get(path).cloned(),
                uncommitted: uncommitted.get(path).cloned(),
            },
        );
    }
    Ok((files.into_values().collect(), commit_count))
}

/// Der Diff einer Datei im gewählten Blickwinkel. Prüft den Pfad, bevor er an Git oder ins
/// Dateisystem geht; legt nichts an.
pub fn file_diff(
    workspace: &Path,
    repository: &SessionRepository,
    path: &str,
    scope: ChangeScope,
) -> Result<FileDiff, CommandError> {
    validate_path(path)?;
    if !repository.repository_path.join(".git").exists() {
        return Err(CommandError::RepositoryMissing(
            repository.repository_path.display().to_string(),
        ));
    }
    let worktree = repository.working_dir(workspace);
    if is_app_worktree_missing(repository, &worktree) {
        return Err(CommandError::Io(WORKTREE_MISSING.to_owned()));
    }
    let base = repository.base_commit.as_str();
    let raw = match scope {
        ChangeScope::Committed => git::diff_tree_patch(&worktree, base, HEAD, path)?,
        ChangeScope::All => git::diff_index_patch(&worktree, base, path)?,
        ChangeScope::Uncommitted => git::diff_index_patch(&worktree, HEAD, path)?,
    };
    // Untracked Dateien kennt kein Diff-Befehl; ihr Inhalt ist der ganze Diff.
    if scope != ChangeScope::Committed
        && raw.trim().is_empty()
        && git::is_untracked(&worktree, path)?
    {
        return Ok(untracked_diff(&worktree.join(path.replace('/', "\\"))));
    }
    Ok(parse::unified(&raw))
}

/// Der Pfad kommt aus der Oberfläche und landet bei untracked Dateien im Dateisystem: nichts
/// zulassen, was aus dem Worktree hinausführt.
fn validate_path(path: &str) -> Result<(), CommandError> {
    let leaves_worktree = path.is_empty()
        || path.starts_with(['/', '\\'])
        || path.contains(':')
        || path.split(['/', '\\']).any(|part: &str| part == "..");
    if leaves_worktree {
        return Err(CommandError::Internal(format!("Ungültiger Pfad: {path}")));
    }
    Ok(())
}

/// Alle Zeilen einer neuen Datei als Hinzufügungen unter einem Abschnittskopf.
fn untracked_diff(path: &Path) -> FileDiff {
    let mut diff = FileDiff {
        lines: Vec::new(),
        binary: false,
        truncated: false,
    };
    let Some(content) = read_text(path) else {
        diff.binary = true;
        return diff;
    };
    let mut texts: Vec<&str> = content
        .split('\n')
        .map(|line: &str| line.strip_suffix('\r').unwrap_or(line))
        .collect();
    // Endet die Datei auf einen Zeilenumbruch, ist das letzte Stück leer und keine Zeile.
    if content.ends_with('\n') || content.is_empty() {
        texts.pop();
    }
    if texts.is_empty() {
        return diff;
    }
    let header = DiffLine {
        kind: DiffLineKind::Hunk,
        old_line: None,
        new_line: None,
        text: format!("@@ -0,0 +1,{} @@", texts.len()),
    };
    parse::push_line(&mut diff, header);
    for (index, text) in texts.into_iter().enumerate() {
        let line = DiffLine {
            kind: DiffLineKind::Added,
            old_line: None,
            new_line: Some(u32::try_from(index + 1).unwrap_or(u32::MAX)),
            text: text.to_owned(),
        };
        if !parse::push_line(&mut diff, line) {
            break;
        }
    }
    diff
}

/// Inhalt einer untracked Datei; `None` heißt binär, zu groß oder nicht lesbar.
fn read_text(path: &Path) -> Option<String> {
    let is_small = fs::metadata(path)
        .is_ok_and(|metadata: fs::Metadata| metadata.len() <= MAX_UNTRACKED_BYTES);
    if !is_small {
        return None;
    }
    // Die Datei kann zwischen Auflisten und Lesen verschwunden sein; der nächste Durchlauf korrigiert.
    let content = fs::read(path).ok()?;
    let probe = &content[..content.len().min(BINARY_PROBE_BYTES)];
    if probe.contains(&0) {
        return None;
    }
    Some(String::from_utf8_lossy(&content).into_owned())
}

/// Zeilenzahl einer untracked Datei, die Git nicht zählt, weil es sie nicht kennt.
fn untracked_stat(path: &Path) -> LineStat {
    let Some(content) = read_text(path) else {
        return LineStat {
            kind: ChangeKind::Added,
            added: 0,
            deleted: 0,
            binary: true,
        };
    };
    let newlines = content.matches('\n').count();
    let has_open_last_line = !content.is_empty() && !content.ends_with('\n');
    let lines = newlines + usize::from(has_open_last_line);
    LineStat {
        kind: ChangeKind::Added,
        added: u32::try_from(lines).unwrap_or(u32::MAX),
        deleted: 0,
        binary: false,
    }
}

/// Nur ein App-Worktree kann fehlen, während sein Haupt-Checkout noch da ist.
fn is_app_worktree_missing(repository: &SessionRepository, worktree: &Path) -> bool {
    matches!(repository.checkout, RepositoryCheckout::AppWorktree { .. }) && !worktree.exists()
}

/// Der Branch, den die Changes über dem Repository nennen. Im Haupt-Checkout ist das, was gerade
/// ausgecheckt ist — nicht zwingend der Standard-Branch; bei losgelöstem HEAD die kurze Commit-ID.
fn branch_label(repository: &SessionRepository) -> String {
    if let RepositoryCheckout::AppWorktree { branch, .. } = &repository.checkout {
        return branch.clone();
    }
    let path = &repository.repository_path;
    if let Ok(Some(branch)) = git::head_branch(path) {
        return branch;
    }
    match git::head_commit(path) {
        Ok(commit) => commit.chars().take(SHORT_COMMIT_CHARS).collect(),
        Err(_) => HEAD.to_owned(),
    }
}

fn failed(position: u32, repository: &SessionRepository, error: String) -> RepositoryChanges {
    RepositoryChanges {
        position,
        name: repository.name.clone(),
        branch: branch_label(repository),
        base_ref: repository.base_ref.clone(),
        commit_count: 0,
        files: Vec::new(),
        error: Some(error),
    }
}
