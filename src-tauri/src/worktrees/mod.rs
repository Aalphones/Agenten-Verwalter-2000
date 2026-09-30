//! Arbeitsordner der Session-Repositories: Haupt-Checkouts, Freigaben für Ticket-Worktrees und die
//! App-Worktrees von Sessions vor ADR 010.
use std::fs;
use std::path::{Path, PathBuf};

use crate::db::repositories::RepositoryRow;
use crate::error::CommandError;
use crate::git;

/// Namensregel eines Ticket-Worktrees: Nachbarordner `<Ordner des Repositorys>-wt-<Name>`.
pub const TICKET_WORKTREE_INFIX: &str = "-wt-";

/// Wo der Agent ein Repository der Session vorfindet.
#[derive(Debug, Clone)]
pub enum RepositoryCheckout {
    /// Von der App angelegter Worktree (Sessions vor ADR 010).
    AppWorktree { folder: String, branch: String },
    /// Der Agent arbeitet im Haupt-Checkout (`repository_path`).
    Main,
}

/// Ein Repository einer Session, als Kopie: die Session bleibt gültig, auch wenn das
/// Repository aus der Liste der bekannten Repositories verschwindet.
#[derive(Debug, Clone)]
pub struct SessionRepository {
    pub name: String,
    /// Wurzelordner des Haupt-Checkouts.
    pub repository_path: PathBuf,
    pub base_ref: String,
    pub base_commit: String,
    pub checkout: RepositoryCheckout,
}

impl SessionRepository {
    /// Der Ordner, in dem der Agent dieses Repository vorfindet.
    pub fn working_dir(&self, workspace: &Path) -> PathBuf {
        match &self.checkout {
            RepositoryCheckout::AppWorktree { folder, .. } => workspace.join(folder),
            RepositoryCheckout::Main => self.repository_path.clone(),
        }
    }
}

/// Ergebnis von `ensure` für ein Repository der Session.
pub enum WorktreeCheck {
    /// Der Arbeitsordner ist da (ein App-Worktree gegebenenfalls gerade neu angelegt).
    Ready(PathBuf),
    /// Der Agent startet ohne dieses Repository; `reason` ist ein ganzer Satz.
    Missing { name: String, reason: String },
}

/// Die Repositories einer neuen Session mit ihren Haupt-Checkouts. Legt nichts an, liest nur die
/// Basis: den ausgecheckten Branch und seinen Commit.
pub fn main_checkouts(
    repositories: &[RepositoryRow],
) -> Result<Vec<SessionRepository>, CommandError> {
    repositories
        .iter()
        .map(|row: &RepositoryRow| {
            let repository_path = PathBuf::from(&row.path);
            if !repository_path.join(".git").exists() {
                return Err(CommandError::RepositoryMissing(row.path.clone()));
            }
            let (base_ref, base_commit) =
                read_base(&repository_path).map_err(|error| prefixed(&row.name, error))?;
            Ok(SessionRepository {
                name: row.name.clone(),
                repository_path,
                base_ref,
                base_commit,
                checkout: RepositoryCheckout::Main,
            })
        })
        .collect()
}

/// Prüft vor einem Agent-Start die Arbeitsordner einer Session. Ein fehlender App-Worktree entsteht
/// aus dem Session-Branch neu; ein vorhandener wird nie angefasst. Fehlt der Haupt-Checkout, ist
/// das Repository `Missing` — auch wenn der Worktree-Ordner noch liegt, denn ohne Haupt-Checkout
/// ist er kein funktionierender Worktree mehr.
///
/// Läuft unter der Session-Sperre: im Normalfall nur Dateisystem-Prüfungen, Git erst beim Reparieren.
pub fn ensure(workspace: &Path, repositories: &[SessionRepository]) -> Vec<WorktreeCheck> {
    repositories
        .iter()
        .map(|repository: &SessionRepository| ensure_one(workspace, repository))
        .collect()
}

fn ensure_one(workspace: &Path, repository: &SessionRepository) -> WorktreeCheck {
    let main_checkout = &repository.repository_path;
    if !main_checkout.join(".git").exists() {
        return WorktreeCheck::Missing {
            name: repository.name.clone(),
            reason: format!("{} gibt es nicht mehr.", main_checkout.display()),
        };
    }
    let (folder, branch) = match &repository.checkout {
        RepositoryCheckout::Main => return WorktreeCheck::Ready(main_checkout.clone()),
        RepositoryCheckout::AppWorktree { folder, branch } => (folder, branch),
    };
    let path = workspace.join(folder);
    if path.exists() {
        return WorktreeCheck::Ready(path);
    }
    // Ohne `prune` hielte Git den gelöschten Ordner noch für den Worktree des Branches und
    // verweigerte ihn einem neuen.
    let _ = git::worktree_prune(main_checkout);
    let added = match git::branch_exists(main_checkout, branch) {
        Ok(true) => git::worktree_add_existing(main_checkout, &path, branch),
        Ok(false) => git::worktree_add_new(main_checkout, &path, branch, &repository.base_commit),
        Err(error) => Err(error),
    };
    match added {
        Ok(()) => WorktreeCheck::Ready(path),
        Err(error) => WorktreeCheck::Missing {
            name: repository.name.clone(),
            reason: format!("Worktree konnte nicht neu angelegt werden ({error})."),
        },
    }
}

/// Räumt die App-Worktrees einer archivierten Session weg und danach den Workspace-Ordner, wenn er
/// leer ist. Ohne `--force`: Git verweigert das Entfernen bei geänderten oder neuen, nicht
/// ignorierten Dateien — solche Worktrees bleiben mit ihren Änderungen liegen. Branches bleiben
/// immer. Haupt-Checkouts und Ticket-Worktrees fasst sie nicht an — deren Lebenszyklus gehört den
/// Anweisungen des Agenten (ADR 010).
///
/// Arbeitet nur mit den übergebenen Pfaden: die Session ist zu diesem Zeitpunkt schon aus der
/// Registry entfernt.
pub fn remove_clean(workspace: &Path, repositories: &[SessionRepository]) {
    for repository in repositories {
        let RepositoryCheckout::AppWorktree { folder, .. } = &repository.checkout else {
            continue;
        };
        let path = workspace.join(folder);
        if !path.exists() {
            continue;
        }
        let _ = git::worktree_remove(&repository.repository_path, &path);
        let _ = git::worktree_prune(&repository.repository_path);
    }
    let _ = fs::remove_dir(workspace);
}

/// Freigaben für `--allowedTools`: je Haupt-Checkout `Edit(…)` und `Read(…)` auf alle
/// Ticket-Worktrees `<Ordner>-wt-*` daneben. Schreibweise belegt am 2026-09-30 mit Claude Code
/// 2.1.284: ein absoluter Pfad beginnt mit `//`, das Laufwerk klein und ohne Doppelpunkt;
/// `Edit`-Regeln decken alle Schreibwerkzeuge ab, `Write(…)` ignoriert Claude.
pub fn permission_rules(repositories: &[SessionRepository]) -> Vec<String> {
    let mut rules: Vec<String> = Vec::new();
    for repository in repositories {
        if !matches!(repository.checkout, RepositoryCheckout::Main) {
            continue;
        }
        let path = &repository.repository_path;
        let (Some(parent), Some(folder_name)) = (path.parent(), path.file_name()) else {
            continue;
        };
        let pattern = format!(
            "{}/{}{TICKET_WORKTREE_INFIX}*/**",
            rule_path(parent),
            folder_name.to_string_lossy()
        );
        rules.push(format!("Edit({pattern})"));
        rules.push(format!("Read({pattern})"));
    }
    rules
}

/// `C:\Users\x\develop` → `//c/Users/x/develop`, die Pfadschreibweise der Claude-Freigaben.
fn rule_path(dir: &Path) -> String {
    let slashed = dir.to_string_lossy().replace('\\', "/");
    let mut characters = slashed.chars();
    match (characters.next(), characters.next()) {
        (Some(drive), Some(':')) if drive.is_ascii_alphabetic() => {
            // Ohne das Kürzen hätte der Laufwerksstamm `C:\` einen doppelten Schrägstrich im Muster.
            let rest = characters.as_str().trim_end_matches('/');
            format!("//{}{rest}", drive.to_ascii_lowercase())
        }
        _ => slashed,
    }
}

/// `(base_ref, base_commit)`: der ausgecheckte Branch — bei losgelöstem HEAD die Commit-ID — und
/// dessen Commit-ID.
fn read_base(repository: &Path) -> Result<(String, String), CommandError> {
    let commit = git::head_commit(repository)?;
    let reference = git::head_branch(repository)?.unwrap_or_else(|| commit.clone());
    Ok((reference, commit))
}

/// Stellt einem Git-Fehler den Namen des Repositorys voran; andere Fehler bleiben, wie sie sind.
fn prefixed(repository_name: &str, error: CommandError) -> CommandError {
    match error {
        CommandError::Git(message) => CommandError::Git(format!("{repository_name}: {message}")),
        other => other,
    }
}
