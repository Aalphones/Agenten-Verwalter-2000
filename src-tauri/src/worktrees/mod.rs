//! Anlegen und Aufräumen der Worktrees einer Session.
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::db::repositories::RepositoryRow;
use crate::error::CommandError;
use crate::git;

pub const BRANCH_PREFIX: &str = "verwalter/";
const MAX_SLUG_CHARS: usize = 40;
const MAX_BRANCH_SUFFIX: u32 = 99;
const EMPTY_SLUG: &str = "session";

/// Ein Repository einer Session, als Kopie: die Session bleibt gültig, auch wenn das
/// Repository aus der Liste der bekannten Repositories verschwindet.
#[derive(Debug, Clone)]
pub struct SessionRepository {
    pub name: String,
    /// Wurzelordner des Haupt-Checkouts.
    pub repository_path: PathBuf,
    /// Unterordner im Workspace.
    pub folder: String,
    pub branch: String,
    pub base_ref: String,
    pub base_commit: String,
}

/// Ergebnis von `ensure` für ein Repository der Session.
pub enum WorktreeCheck {
    /// Der Worktree-Ordner ist da (gegebenenfalls gerade neu angelegt).
    Ready(PathBuf),
    /// Der Agent startet ohne dieses Repository; `reason` ist ein ganzer Satz.
    Missing { name: String, reason: String },
}

/// Der Teil des Branch-Namens nach `verwalter/`: „OAuth Login für Backend“ → `oauth-login-fuer-backend`.
pub fn branch_slug(session_name: &str) -> String {
    let mut replaced = String::with_capacity(session_name.len());
    for character in session_name.chars() {
        match character {
            'ä' | 'Ä' => replaced.push_str("ae"),
            'ö' | 'Ö' => replaced.push_str("oe"),
            'ü' | 'Ü' => replaced.push_str("ue"),
            'ß' => replaced.push_str("ss"),
            _ if character.is_ascii_alphanumeric() => {
                replaced.push(character.to_ascii_lowercase());
            }
            _ => replaced.push('-'),
        }
    }
    let joined: String = replaced
        .split('-')
        .filter(|part: &&str| !part.is_empty())
        .collect::<Vec<&str>>()
        .join("-");
    let shortened: String = joined.chars().take(MAX_SLUG_CHARS).collect();
    let slug = shortened.trim_end_matches('-');
    if slug.is_empty() {
        return EMPTY_SLUG.to_owned();
    }
    slug.to_owned()
}

/// Legt für jedes Repository einen Worktree mit dem Session-Branch im Workspace an — alles oder
/// nichts: scheitert eines, baut die Funktion die schon angelegten wieder ab. Den Workspace-Ordner
/// selbst räumt der Aufrufer weg.
pub fn create_all(
    workspace: &Path,
    session_name: &str,
    repositories: &[RepositoryRow],
) -> Result<Vec<SessionRepository>, CommandError> {
    if repositories.is_empty() {
        return Ok(Vec::new());
    }
    let mut bases: Vec<(String, String)> = Vec::with_capacity(repositories.len());
    for row in repositories {
        let repository = Path::new(&row.path);
        if !repository.join(".git").exists() {
            return Err(CommandError::RepositoryMissing(row.path.clone()));
        }
        bases.push(read_base(repository).map_err(|error| prefixed(&row.name, error))?);
    }
    let branch = free_branch(repositories, &branch_slug(session_name))?;
    let mut planned: Vec<SessionRepository> = Vec::with_capacity(repositories.len());
    for ((row, folder), (base_ref, base_commit)) in repositories
        .iter()
        .zip(folder_names(repositories))
        .zip(bases)
    {
        planned.push(SessionRepository {
            name: row.name.clone(),
            repository_path: PathBuf::from(&row.path),
            folder,
            branch: branch.clone(),
            base_ref,
            base_commit,
        });
    }
    for (index, repository) in planned.iter().enumerate() {
        let added = git::worktree_add_new(
            &repository.repository_path,
            &workspace.join(&repository.folder),
            &repository.branch,
            &repository.base_commit,
        );
        if let Err(error) = added {
            // Das gescheiterte Repository gehört mit in den Rückbau: `worktree add` kann Branch
            // und Worktree schon angelegt haben, bevor es scheitert (etwa an einem Hook). Beides
            // gehört dieser Session — der Branch war vorher frei, der Workspace-Ordner neu.
            rollback(workspace, &planned[..=index]);
            return Err(prefixed(&repository.name, error));
        }
    }
    Ok(planned)
}

/// Prüft vor einem Agent-Start die Worktrees einer Session. Ein fehlender Worktree-Ordner entsteht
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
    let path = workspace.join(&repository.folder);
    if !main_checkout.join(".git").exists() {
        return WorktreeCheck::Missing {
            name: repository.name.clone(),
            reason: format!("{} gibt es nicht mehr.", main_checkout.display()),
        };
    }
    if path.exists() {
        return WorktreeCheck::Ready(path);
    }
    // Ohne `prune` hielte Git den gelöschten Ordner noch für den Worktree des Branches und
    // verweigerte ihn einem neuen.
    let _ = git::worktree_prune(main_checkout);
    let added = match git::branch_exists(main_checkout, &repository.branch) {
        Ok(true) => git::worktree_add_existing(main_checkout, &path, &repository.branch),
        Ok(false) => git::worktree_add_new(
            main_checkout,
            &path,
            &repository.branch,
            &repository.base_commit,
        ),
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

/// Räumt die Worktrees einer archivierten Session weg und danach den Workspace-Ordner, wenn er leer
/// ist. Ohne `--force`: Git verweigert das Entfernen bei geänderten oder neuen, nicht ignorierten
/// Dateien — solche Worktrees bleiben mit ihren Änderungen liegen. Branches bleiben immer.
///
/// Arbeitet nur mit den übergebenen Pfaden: die Session ist zu diesem Zeitpunkt schon aus der
/// Registry entfernt.
pub fn remove_clean(workspace: &Path, repositories: &[SessionRepository]) {
    for repository in repositories {
        let path = workspace.join(&repository.folder);
        if !path.exists() {
            continue;
        }
        let _ = git::worktree_remove(&repository.repository_path, &path);
        let _ = git::worktree_prune(&repository.repository_path);
    }
    let _ = fs::remove_dir(workspace);
}

/// Rückbau nach gescheitertem Anlegen: Worktrees mit Gewalt entfernen, Branches löschen. Fehler
/// ändern den Ausgang nicht und werden übergangen.
pub(crate) fn rollback(workspace: &Path, created: &[SessionRepository]) {
    for repository in created {
        let _ = git::worktree_remove_force(
            &repository.repository_path,
            &workspace.join(&repository.folder),
        );
        let _ = git::branch_delete_force(&repository.repository_path, &repository.branch);
    }
    for repository in created {
        let _ = git::worktree_prune(&repository.repository_path);
    }
}

/// `(base_ref, base_commit)`: der ausgecheckte Branch — bei losgelöstem HEAD die Commit-ID — und
/// die Commit-ID, von der der Session-Branch ausgeht.
fn read_base(repository: &Path) -> Result<(String, String), CommandError> {
    let commit = git::head_commit(repository)?;
    let reference = git::head_branch(repository)?.unwrap_or_else(|| commit.clone());
    Ok((reference, commit))
}

/// Der erste Name `verwalter/<slug>`, `verwalter/<slug>-2` …, der in keinem Repository existiert:
/// eine Session trägt überall denselben Branch.
fn free_branch(repositories: &[RepositoryRow], slug: &str) -> Result<String, CommandError> {
    for suffix in 1..=MAX_BRANCH_SUFFIX {
        let candidate = if suffix == 1 {
            format!("{BRANCH_PREFIX}{slug}")
        } else {
            format!("{BRANCH_PREFIX}{slug}-{suffix}")
        };
        let mut is_taken = false;
        for row in repositories {
            let exists = git::branch_exists(Path::new(&row.path), &candidate)
                .map_err(|error| prefixed(&row.name, error))?;
            if exists {
                is_taken = true;
                break;
            }
        }
        if !is_taken {
            return Ok(candidate);
        }
    }
    Err(CommandError::Git(format!(
        "Kein freier Branch-Name für {slug}"
    )))
}

/// Ordnernamen im Workspace: der Name des Repositorys, bei gleichen Namen (ohne Groß/Klein)
/// `name-2`, `name-3` …
fn folder_names(repositories: &[RepositoryRow]) -> Vec<String> {
    let mut used: HashSet<String> = HashSet::new();
    let mut folders: Vec<String> = Vec::with_capacity(repositories.len());
    for row in repositories {
        let mut folder = row.name.clone();
        let mut suffix: u32 = 2;
        while used.contains(&folder.to_lowercase()) {
            folder = format!("{}-{suffix}", row.name);
            suffix += 1;
        }
        used.insert(folder.to_lowercase());
        folders.push(folder);
    }
    folders
}

/// Stellt einem Git-Fehler den Namen des Repositorys voran; andere Fehler bleiben, wie sie sind.
fn prefixed(repository_name: &str, error: CommandError) -> CommandError {
    match error {
        CommandError::Git(message) => CommandError::Git(format!("{repository_name}: {message}")),
        other => other,
    }
}
