//! Was in den Repositories einer Session und in ihren Ticket-Worktrees gegenüber der Basis geändert
//! ist, soweit es der Session oder dem Vorhaben gehört (ADR 014) — in drei Blickwinkeln, gelesen
//! nur mit Plumbing-Befehlen, die im Worktree keine Sperre nehmen (ADR 006).
pub mod attribution;
pub mod history;
pub mod model;
pub mod parse;
pub mod scan;

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread::{self, ScopedJoinHandle};

use crate::changes::attribution::{OwnFile, Ownership};
use crate::changes::history::CommitInfo;
use crate::changes::model::{
    ChangeKind, ChangeScope, DiffLine, DiffLineKind, FileChange, FileDiff, LineStat,
    RepositoryChanges, SessionChanges,
};
use crate::error::CommandError;
use crate::git;
use crate::worktrees::{self, RepositoryCheckout, SessionRepository, TicketWorktree};

/// Größere untracked Dateien gelten als binär: ihre Zeilen zu zählen hieße, sie ganz zu lesen.
const MAX_UNTRACKED_BYTES: u64 = 8 * 1024 * 1024;
/// So viele Bytes prüft auch Git auf ein NUL-Byte, bevor es eine Datei binär nennt.
const BINARY_PROBE_BYTES: usize = 8000;
const WORKTREE_MISSING: &str =
    "Worktree fehlt — die nächste Nachricht an den Agenten legt ihn neu an.";
const THREAD_FAILED: &str = "interner Fehler beim Lesen der Changes";
const HEAD: &str = "HEAD";
const NO_OWN_COMMITS: &str = "Die Datei hat keine eigenen Commits in dieser Ansicht";
const SHORT_COMMIT_CHARS: usize = 7;
/// Basis eines Ticket-Worktrees, wenn sie sich nicht bestimmen ließ; der Eintrag trägt dann den Fehler.
const UNKNOWN_BASE: &str = "unbekannt";

/// Alles, was die Changes einer Reichweite brauchen; gebaut von `SessionRegistry::changes_input`.
pub struct ChangesInput {
    pub workspace: PathBuf,
    pub repositories: Vec<SessionRepository>,
    /// Die Ticket-Worktrees der Reichweite als `(Position, Ordner)`.
    pub ticket_folders: Vec<(u32, String)>,
    pub own: Ownership,
}

/// Liest alle Repositories der Session nebeneinander, je eines samt seiner Ticket-Worktrees in einem
/// eigenen Thread. Scheitert eines, trägt nur sein Eintrag den Fehler. Ordner ohne Git bekommen
/// keinen Thread und keinen Eintrag, nur ihr Name steht in `plain_folders` (ADR 018).
pub fn load(input: &ChangesInput) -> SessionChanges {
    let workspace = input.workspace.as_path();
    let ticket_folders = input.ticket_folders.as_slice();
    let own = &input.own;
    let plain_folders: Vec<String> = input
        .repositories
        .iter()
        .filter(|repository: &&SessionRepository| is_plain_folder(repository))
        .map(|repository: &SessionRepository| repository.name.clone())
        .collect();
    let repositories = thread::scope(|scope| {
        let handles: Vec<(
            u32,
            &SessionRepository,
            ScopedJoinHandle<'_, Vec<RepositoryChanges>>,
        )> = input
            .repositories
            .iter()
            .enumerate()
            .filter(|(_, repository): &(usize, &SessionRepository)| !is_plain_folder(repository))
            .map(|(index, repository): (usize, &SessionRepository)| {
                let position = u32::try_from(index).unwrap_or(u32::MAX);
                let folders = folders_of(ticket_folders, position);
                let handle =
                    scope.spawn(move || load_one(workspace, position, repository, folders, own));
                (position, repository, handle)
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|(position, repository, handle)| {
                // Ein panischer Thread trifft nur sein Repository, nicht die ganze Ansicht.
                handle.join().unwrap_or_else(|_| {
                    vec![failed_repository(
                        position,
                        repository,
                        THREAD_FAILED.to_owned(),
                    )]
                })
            })
            .collect()
    });
    SessionChanges {
        repositories,
        plain_folders,
        untracked_before: own.untracked_before,
    }
}

fn is_plain_folder(repository: &SessionRepository) -> bool {
    matches!(repository.checkout, RepositoryCheckout::Folder)
}

fn folders_of(ticket_folders: &[(u32, String)], position: u32) -> Vec<String> {
    ticket_folders
        .iter()
        .filter(|(ticket_position, _): &&(u32, String)| *ticket_position == position)
        .map(|(_, folder): &(u32, String)| folder.clone())
        .collect()
}

/// Erst der Eintrag des Repositorys, dann einer je Ticket-Worktree, den es noch gibt.
fn load_one(
    workspace: &Path,
    position: u32,
    repository: &SessionRepository,
    folders: Vec<String>,
    own: &Ownership,
) -> Vec<RepositoryChanges> {
    let mut entries = vec![load_repository(workspace, position, repository, own)];
    entries.extend(
        worktrees::ticket_worktrees(repository, position, &folders)
            .iter()
            .map(|worktree: &TicketWorktree| load_ticket(repository, worktree, own)),
    );
    entries
}

/// Nur lesen: ein fehlender Worktree wird gemeldet, nicht angelegt — das bleibt bei
/// `worktrees::ensure` vor dem Agent-Start.
fn load_repository(
    workspace: &Path,
    position: u32,
    repository: &SessionRepository,
    own: &Ownership,
) -> RepositoryChanges {
    if !repository.repository_path.join(".git").exists() {
        let missing =
            CommandError::RepositoryMissing(repository.repository_path.display().to_string());
        return failed_repository(position, repository, missing.to_string());
    }
    let worktree = repository.working_dir(workspace);
    if is_app_worktree_missing(repository, &worktree) {
        return failed_repository(position, repository, WORKTREE_MISSING.to_owned());
    }
    match read_changes(&worktree, &repository.base_commit, own) {
        Ok((files, commit_count)) => RepositoryChanges {
            key: position.to_string(),
            name: repository.name.clone(),
            branch: branch_label(repository),
            base_ref: repository.base_ref.clone(),
            commit_count,
            files,
            error: None,
        },
        Err(error) => failed_repository(position, repository, error.to_string()),
    }
}

/// Ein Ticket-Worktree gegen seine Abzweigung vom Standard-Branch, mit den Änderungen der
/// Reichweite auf dem Branch.
fn load_ticket(
    repository: &SessionRepository,
    worktree: &TicketWorktree,
    own: &Ownership,
) -> RepositoryChanges {
    let key = format!("{}/{}", worktree.position, worktree.folder);
    let name = format!("{} · {}", repository.name, worktree.folder);
    let branch = ticket_branch_label(worktree);
    let (base_commit, base_ref) = match worktrees::ticket_base(repository, worktree) {
        Ok(base) => base,
        Err(error) => {
            return failed(
                key,
                name,
                branch,
                UNKNOWN_BASE.to_owned(),
                error.to_string(),
            );
        }
    };
    match read_changes(&worktree.path, &base_commit, own) {
        Ok((files, commit_count)) => RepositoryChanges {
            key,
            name,
            branch,
            base_ref,
            commit_count,
            files,
            error: None,
        },
        Err(error) => failed(key, name, branch, base_ref, error.to_string()),
    }
}

fn ticket_branch_label(worktree: &TicketWorktree) -> String {
    match &worktree.branch {
        Some(branch) => branch.clone(),
        None => worktree.head.chars().take(SHORT_COMMIT_CHARS).collect(),
    }
}

/// Nur was der Reichweite gehört (ADR 014): eigene Commits je Datei von ihrem ersten bis zum
/// letzten, eigene geschriebene Dateien, solange sie seit dem letzten Schreiben nicht committet sind.
fn read_changes(
    worktree: &Path,
    base: &str,
    own: &Ownership,
) -> Result<(Vec<FileChange>, u32), CommandError> {
    let commits = history::read(worktree, base)?;
    let own_files = attribution::own_files(&commits, &own.commits);
    let dirty = dirty_stats(worktree)?;
    let uncommitted = open_uncommitted(worktree, &dirty, &commits, own);
    let committed = committed_stats(worktree, &own_files)?;
    let all = all_stats(worktree, &own_files, &dirty, &uncommitted)?;
    let commit_count = attribution::own_commit_count(&commits, &own.commits);

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

/// Alles Uncommittete im Arbeitsordner, egal von wem: `HEAD` → Arbeitsverzeichnis und die untracked
/// Dateien.
fn dirty_stats(worktree: &Path) -> Result<BTreeMap<String, LineStat>, CommandError> {
    let mut dirty = parse::scope_stats(
        &git::diff_index_name_status(worktree, HEAD)?,
        &git::diff_index_numstat(worktree, HEAD)?,
    );
    for path in parse::paths(&git::untracked_files(worktree)?) {
        let stat = untracked_stat(&worktree.join(path.replace('/', "\\")));
        dirty.insert(path, stat);
    }
    Ok(dirty)
}

/// Der Teil von `dirty`, den die Reichweite geschrieben und seitdem nicht committet hat.
fn open_uncommitted(
    worktree: &Path,
    dirty: &BTreeMap<String, LineStat>,
    commits: &[CommitInfo],
    own: &Ownership,
) -> BTreeMap<String, LineStat> {
    dirty
        .iter()
        .filter(|(path, _): &(&String, &LineStat)| {
            let absolute = worktree.join(path.replace('/', "\\"));
            let key = attribution::normalize_path(&absolute.to_string_lossy());
            own.touched.get(&key).is_some_and(|touched_at: &f64| {
                attribution::is_open(*touched_at, path, commits, &own.commits)
            })
        })
        .map(|(path, stat): (&String, &LineStat)| (path.clone(), stat.clone()))
        .collect()
}

/// Je Datei mit eigenen Commits vom ersten bis zum letzten; Dateien mit gleichem `from → to` teilen
/// sich einen Git-Aufruf. Netto unveränderte Dateien entfallen.
fn committed_stats(
    worktree: &Path,
    own_files: &BTreeMap<String, OwnFile>,
) -> Result<BTreeMap<String, LineStat>, CommandError> {
    let mut groups: BTreeMap<(&str, &str), Vec<(&String, &OwnFile)>> = BTreeMap::new();
    for (path, file) in own_files {
        groups
            .entry((file.from.as_str(), file.to.as_str()))
            .or_default()
            .push((path, file));
    }
    let mut committed: BTreeMap<String, LineStat> = BTreeMap::new();
    for ((from, to), files) in groups {
        let stats = history::range_stats(worktree, from, to)?;
        for (path, file) in files {
            let Some(stat) = stats.get(path) else {
                continue;
            };
            let mut stat = stat.clone();
            stat.foreign = file.foreign_between;
            committed.insert(path.clone(), stat);
        }
    }
    Ok(committed)
}

/// Dateien mit eigenen Commits vom ersten Elternteil bis zum Arbeitsverzeichnis, dazu die offenen
/// eigenen Dateien ohne Commit. Dateien mit gleichem `from` teilen sich einen Git-Aufruf; ist keine
/// davon uncommittet, ist das Arbeitsverzeichnis für sie `HEAD`, und `from → HEAD` kommt aus dem
/// Zwischenspeicher — sonst liefe jeder Takt der Ansicht zwei Git-Aufrufe je Gruppe.
fn all_stats(
    worktree: &Path,
    own_files: &BTreeMap<String, OwnFile>,
    dirty: &BTreeMap<String, LineStat>,
    uncommitted: &BTreeMap<String, LineStat>,
) -> Result<BTreeMap<String, LineStat>, CommandError> {
    let mut groups: BTreeMap<&str, Vec<(&String, &OwnFile)>> = BTreeMap::new();
    for (path, file) in own_files {
        groups
            .entry(file.from.as_str())
            .or_default()
            .push((path, file));
    }
    let mut all: BTreeMap<String, LineStat> = BTreeMap::new();
    let mut head: Option<String> = None;
    for (from, files) in groups {
        let is_clean = files
            .iter()
            .all(|(path, _): &(&String, &OwnFile)| !dirty.contains_key(*path));
        let stats = if is_clean {
            let head = match &head {
                Some(head) => head,
                None => head.insert(git::head_commit(worktree)?),
            };
            history::range_stats(worktree, from, head)?
        } else {
            parse::scope_stats(
                &git::diff_index_name_status(worktree, from)?,
                &git::diff_index_numstat(worktree, from)?,
            )
        };
        for (path, file) in files {
            let Some(stat) = stats.get(path) else {
                continue;
            };
            let has_foreign_dirt = dirty.contains_key(path) && !uncommitted.contains_key(path);
            let mut stat = stat.clone();
            stat.foreign = file.foreign_after || has_foreign_dirt;
            all.insert(path.clone(), stat);
        }
    }
    for (path, stat) in uncommitted {
        if !own_files.contains_key(path) {
            all.insert(path.clone(), stat.clone());
        }
    }
    Ok(all)
}

/// Der Diff einer Datei im gewählten Blickwinkel — im Arbeitsordner des Repositorys oder, mit
/// `ticket`, in diesem Ticket-Worktree. Prüft den Pfad, bevor er an Git oder ins Dateisystem geht;
/// legt nichts an.
pub fn file_diff(
    workspace: &Path,
    repository: &SessionRepository,
    ticket: Option<&TicketWorktree>,
    path: &str,
    scope: ChangeScope,
    own: &Ownership,
) -> Result<FileDiff, CommandError> {
    validate_path(path)?;
    if is_plain_folder(repository) {
        return Err(CommandError::Internal(
            "Ordner ohne Git hat keinen Diff".to_owned(),
        ));
    }
    if !repository.repository_path.join(".git").exists() {
        return Err(CommandError::RepositoryMissing(
            repository.repository_path.display().to_string(),
        ));
    }
    let (worktree, base): (PathBuf, String) = match ticket {
        Some(ticket) => {
            let (base_commit, _) = worktrees::ticket_base(repository, ticket)?;
            (ticket.path.clone(), base_commit)
        }
        None => {
            let worktree = repository.working_dir(workspace);
            if is_app_worktree_missing(repository, &worktree) {
                return Err(CommandError::Io(WORKTREE_MISSING.to_owned()));
            }
            (worktree, repository.base_commit.clone())
        }
    };
    let base = base.as_str();
    let raw = match scope {
        ChangeScope::Committed => {
            let Some(file) = own_file(&worktree, base, own, path)? else {
                return Err(CommandError::Internal(NO_OWN_COMMITS.to_owned()));
            };
            git::diff_tree_patch(&worktree, &file.from, &file.to, path)?
        }
        ChangeScope::All => match own_file(&worktree, base, own, path)? {
            Some(file) => git::diff_index_patch(&worktree, &file.from, path)?,
            None => git::diff_index_patch(&worktree, HEAD, path)?,
        },
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

/// Erster und letzter eigener Commit an `path`; `None`, wenn die Reichweite ihn nicht committet hat.
fn own_file(
    worktree: &Path,
    base: &str,
    own: &Ownership,
    path: &str,
) -> Result<Option<OwnFile>, CommandError> {
    let commits = history::read(worktree, base)?;
    Ok(attribution::own_files(&commits, &own.commits).remove(path))
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
            foreign: false,
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
        foreign: false,
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

fn failed_repository(
    position: u32,
    repository: &SessionRepository,
    error: String,
) -> RepositoryChanges {
    failed(
        position.to_string(),
        repository.name.clone(),
        branch_label(repository),
        repository.base_ref.clone(),
        error,
    )
}

fn failed(
    key: String,
    name: String,
    branch: String,
    base_ref: String,
    error: String,
) -> RepositoryChanges {
    RepositoryChanges {
        key,
        name,
        branch,
        base_ref,
        commit_count: 0,
        files: Vec::new(),
        error: Some(error),
    }
}
