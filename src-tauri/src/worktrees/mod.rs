//! Arbeitsordner der Session-Repositories: Haupt-Checkouts, Freigaben für Ticket-Worktrees, die
//! App-Worktrees von Sessions vor ADR 010 und Ordner ohne Git.
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};

use crate::db::repositories::RepositoryRow;
use crate::error::CommandError;
use crate::git;

/// Namensregel eines Ticket-Worktrees: Nachbarordner `<Ordner des Repositorys>-wt-<Name>`.
pub const TICKET_WORKTREE_INFIX: &str = "-wt-";

/// Zeichen, hinter denen im Text ein Ordnername beginnen kann (außer Leerraum).
const NAME_BOUNDARIES: [char; 6] = ['\\', '/', '"', '\'', '=', ':'];
const HEAD: &str = "HEAD";

// Darüber wird der Speicher geleert statt einzeln verdrängt: ein Neuaufbau kostet nur Git-Aufrufe.
const MAX_CACHED_BASES: usize = 1_000;

/// Basis je inneres Repository und Beginn der Reichweite (`<Ordner>|<Sekunde>`). Hält die Basis
/// fest, solange die App läuft: ohne Commit vor dem Beginn wäre sie sonst der jeweils ausgecheckte
/// Stand und eigene Commits fielen aus den Changes, sobald sie da sind.
static INNER_BASES: OnceLock<Mutex<HashMap<String, (String, String)>>> = OnceLock::new();

/// Ein Ticket-Worktree, den der Agent der Session benutzt hat und den es laut Git noch gibt.
#[derive(Debug, Clone)]
pub struct TicketWorktree {
    /// Position des Repositorys in der Session.
    pub position: u32,
    /// Ordnername in der Schreibweise, in der die Session ihn sich gemerkt hat.
    pub folder: String,
    pub path: PathBuf,
    pub head: String,
    /// `None` bei losgelöstem HEAD.
    pub branch: Option<String>,
}

/// Woran ein Ticket-Worktree eines Session-Repositorys im Text zu erkennen ist.
#[derive(Debug, Clone)]
pub struct TicketRoot {
    /// Position des Repositorys in der Session.
    pub position: u32,
    /// `<Ordner>-wt-` in ASCII-Kleinbuchstaben.
    pub prefix: String,
    /// `None`: Ticket-Worktrees des angehängten Repositorys, neben ihm. `Some(<Ordnername>)`:
    /// Ticket-Worktrees dieses inneren Repositorys, im angehängten Ordner.
    pub inner: Option<String>,
}

/// Wo der Agent ein Repository der Session vorfindet.
#[derive(Debug, Clone)]
pub enum RepositoryCheckout {
    /// Von der App angelegter Worktree (Sessions vor ADR 010).
    AppWorktree { folder: String, branch: String },
    /// Der Agent arbeitet im Haupt-Checkout (`repository_path`).
    Main,
    /// Ordner ohne Git: der Agent arbeitet direkt in `repository_path`; keine Basis, keine Changes (ADR 018).
    Folder,
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
            RepositoryCheckout::Main | RepositoryCheckout::Folder => self.repository_path.clone(),
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
            if !repository_path.is_dir() {
                return Err(CommandError::RepositoryMissing(row.path.clone()));
            }
            if !repository_path.join(".git").exists() {
                return Ok(folder_checkout(row));
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

/// Ein Repository, das nachträglich an ein Vorhaben kommt, mit seinem Haupt-Checkout. Die Basis ist
/// der letzte Commit vor `since_ms` (Anlegen des Vorhabens, ms seit 1970), damit die Changes alles
/// seit Beginn des Vorhabens zeigen; gibt es davor keinen, der ausgecheckte Stand.
pub fn main_checkout_since(
    row: &RepositoryRow,
    since_ms: f64,
) -> Result<SessionRepository, CommandError> {
    let repository_path = PathBuf::from(&row.path);
    if !repository_path.is_dir() {
        return Err(CommandError::RepositoryMissing(row.path.clone()));
    }
    if !repository_path.join(".git").exists() {
        return Ok(folder_checkout(row));
    }
    let (base_ref, base_commit) = base_since(&repository_path, since_ms)
        .map_err(|error: CommandError| prefixed(&row.name, error))?;
    Ok(SessionRepository {
        name: row.name.clone(),
        repository_path,
        base_ref,
        base_commit,
        checkout: RepositoryCheckout::Main,
    })
}

/// Ein inneres Repository des angehängten `outer` als Repository im Haupt-Checkout, gemessen ab dem
/// letzten Commit vor `since_ms` (ms seit 1970); gibt es davor keinen, ab dem ausgecheckten Stand.
pub fn inner_checkout(
    outer: &SessionRepository,
    folder: &str,
    since_ms: f64,
) -> Result<SessionRepository, CommandError> {
    let repository_path = outer.repository_path.join(folder);
    let since_seconds = (since_ms / 1000.0) as i64;
    let key = format!("{}|{since_seconds}", normalized_dir(&repository_path));
    let cached = inner_bases_cache().get(&key).cloned();
    let (base_ref, base_commit) = match cached {
        Some(base) => base,
        None => {
            // Die Sperre ist hier frei: Git läuft nie unter ihr.
            let base = base_since(&repository_path, since_ms)
                .map_err(|error: CommandError| prefixed(folder, error))?;
            let mut cache = inner_bases_cache();
            if cache.len() >= MAX_CACHED_BASES {
                cache.clear();
            }
            cache.insert(key, base.clone());
            base
        }
    };
    Ok(SessionRepository {
        name: folder.to_owned(),
        repository_path,
        base_ref,
        base_commit,
        checkout: RepositoryCheckout::Main,
    })
}

/// `(base_ref, base_commit)`: der letzte Commit vor `since_ms` auf dem First-Parent-Pfad von `HEAD`
/// mit dem ausgecheckten Branch; gibt es davor keinen, der ausgecheckte Stand.
fn base_since(repository_path: &Path, since_ms: f64) -> Result<(String, String), CommandError> {
    let since_seconds = (since_ms / 1000.0) as i64;
    let Some(commit) = git::commit_before(repository_path, since_seconds)? else {
        return read_base(repository_path);
    };
    let reference = git::head_branch(repository_path)?.unwrap_or_else(|| commit.clone());
    Ok((reference, commit))
}

fn inner_bases_cache() -> MutexGuard<'static, HashMap<String, (String, String)>> {
    INNER_BASES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

/// Ein Ordner ohne Git als Repository der Session: leere Basis, denn es gibt nichts zu vergleichen.
fn folder_checkout(row: &RepositoryRow) -> SessionRepository {
    SessionRepository {
        name: row.name.clone(),
        repository_path: PathBuf::from(&row.path),
        base_ref: String::new(),
        base_commit: String::new(),
        checkout: RepositoryCheckout::Folder,
    }
}

/// Derselbe Ordner, ohne Rücksicht auf Groß/Klein, Schrägstrich-Richtung und abschließenden Trenner.
pub fn same_repository(first: &Path, second: &Path) -> bool {
    same_dir(first, second)
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
    // Ein Ordner ohne Git hat kein `.git`, das fehlen könnte: für ihn zählt nur, dass er da ist.
    let is_main_checkout_there = match repository.checkout {
        RepositoryCheckout::Folder => main_checkout.is_dir(),
        RepositoryCheckout::Main | RepositoryCheckout::AppWorktree { .. } => {
            main_checkout.join(".git").exists()
        }
    };
    if !is_main_checkout_there {
        return WorktreeCheck::Missing {
            name: repository.name.clone(),
            reason: format!("{} gibt es nicht mehr.", main_checkout.display()),
        };
    }
    let (folder, branch) = match &repository.checkout {
        RepositoryCheckout::Main | RepositoryCheckout::Folder => {
            return WorktreeCheck::Ready(main_checkout.clone());
        }
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

/// Die inneren Repositories von `folder`: direkte Unterordner, in denen `.git` ein Ordner ist —
/// Unterordner mit `.git`-Datei sind Worktrees, Namen mit führendem `.` zählen nicht. Aufsteigend
/// ohne Rücksicht auf Groß/Klein; ist `folder` nicht lesbar, keine.
pub fn inner_repositories(folder: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(|entry: std::io::Result<fs::DirEntry>| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || !entry.path().join(".git").is_dir() {
                return None;
            }
            Some(name)
        })
        .collect();
    names.sort_by_key(|name: &String| name.to_ascii_lowercase());
    names
}

/// Woran die Ticket-Worktrees zu erkennen sind: je Repository im Haupt-Checkout die Wurzel
/// `inner: None` plus je inneres Repository eine; je Ordner ohne Git nur die der inneren;
/// App-Worktrees keine, dort legt der Agent keine Ticket-Worktrees an. Liest je Repository einmal
/// das Verzeichnis.
pub fn ticket_roots(repositories: &[SessionRepository]) -> Vec<TicketRoot> {
    let mut roots: Vec<TicketRoot> = Vec::new();
    for (index, repository) in repositories.iter().enumerate() {
        let Ok(position) = u32::try_from(index) else {
            continue;
        };
        match repository.checkout {
            RepositoryCheckout::AppWorktree { .. } => continue,
            RepositoryCheckout::Main => {
                let Some(folder_name) = repository.repository_path.file_name() else {
                    continue;
                };
                roots.push(TicketRoot {
                    position,
                    prefix: ticket_prefix(&folder_name.to_string_lossy()),
                    inner: None,
                });
            }
            RepositoryCheckout::Folder => {}
        }
        for name in inner_repositories(&repository.repository_path) {
            roots.push(TicketRoot {
                position,
                prefix: ticket_prefix(&name),
                inner: Some(name),
            });
        }
    }
    roots
}

/// Die Wurzel an `position`, deren Präfix am Anfang von `folder` steht (ASCII ohne Groß/Klein); bei
/// mehreren die mit dem längsten Präfix — `admin-app-wt-x` gehört zu `admin-app`, nicht zu `app`.
pub fn ticket_root_of<'a>(
    roots: &'a [TicketRoot],
    position: u32,
    folder: &str,
) -> Option<&'a TicketRoot> {
    let lower = folder.to_ascii_lowercase();
    roots
        .iter()
        .filter(|root: &&TicketRoot| root.position == position && lower.starts_with(&root.prefix))
        .max_by_key(|root: &&TicketRoot| root.prefix.len())
}

fn ticket_prefix(folder_name: &str) -> String {
    format!("{folder_name}{TICKET_WORKTREE_INFIX}").to_ascii_lowercase()
}

/// Die Ticket-Worktrees, die `text` nennt — als absoluten Pfad, `../<Ordner>` oder nackten
/// Ordnernamen —, als `(Position, Ordnername)` in der Schreibweise aus `text`, ohne Doppelte.
/// Liest nur Text, kein Dateisystem, kein Git: ob der Ordner ein Worktree ist, prüft der Aufrufer.
pub fn mentioned_ticket_worktrees(roots: &[TicketRoot], text: &str) -> Vec<(u32, String)> {
    // Nur ASCII-Kleinschreibung: sie ändert keine Byte-Länge, jede Position in `lower` gilt auch in `text`.
    let lower = text.to_ascii_lowercase();
    let mut found: Vec<(u32, String)> = Vec::new();
    for root in roots {
        for (start, _) in lower.match_indices(root.prefix.as_str()) {
            let is_name_start = lower[..start]
                .chars()
                .next_back()
                .is_none_or(|previous: char| {
                    previous.is_whitespace() || NAME_BOUNDARIES.contains(&previous)
                });
            if !is_name_start {
                continue;
            }
            let name_start = start + root.prefix.len();
            let rest = &text[name_start..];
            let name_length = rest
                .find(|character: char| !is_folder_character(character))
                .unwrap_or(rest.len());
            // Ein Punkt am Ende ist das Satzende, nicht Teil des Namens.
            let name = rest[..name_length].trim_end_matches('.');
            if name.is_empty() {
                continue;
            }
            let folder = &text[start..name_start + name.len()];
            let is_known = found.iter().any(|(position, known): &(u32, String)| {
                *position == root.position && known.eq_ignore_ascii_case(folder)
            });
            if !is_known {
                found.push((root.position, folder.to_owned()));
            }
        }
    }
    found
}

/// Die zugeordneten Ticket-Worktrees eines Repositorys, die Git noch als Worktree des Haupt-Checkouts
/// führt, nach Ordner sortiert. Was nicht (mehr) dazugehört, fällt still weg — auch alles, wenn
/// `git worktree list` scheitert: der Eintrag des Repositorys selbst soll davon nicht abhängen.
pub fn ticket_worktrees(
    repository: &SessionRepository,
    position: u32,
    folders: &[String],
) -> Vec<TicketWorktree> {
    let Some(parent) = repository.repository_path.parent() else {
        return Vec::new();
    };
    ticket_worktrees_in(repository, position, folders, parent)
}

/// Wie `ticket_worktrees`, aber die Worktree-Ordner liegen in `parent` statt neben dem
/// Haupt-Checkout — bei einem inneren Repository im angehängten Ordner.
pub fn ticket_worktrees_in(
    repository: &SessionRepository,
    position: u32,
    folders: &[String],
    parent: &Path,
) -> Vec<TicketWorktree> {
    let has_ticket_worktrees = matches!(repository.checkout, RepositoryCheckout::Main);
    if !has_ticket_worktrees || folders.is_empty() {
        return Vec::new();
    }
    let Ok(entries) = git::worktree_list(&repository.repository_path) else {
        return Vec::new();
    };
    let mut worktrees: Vec<TicketWorktree> = folders
        .iter()
        .filter_map(|folder: &String| {
            let expected = parent.join(folder);
            let entry = entries
                .iter()
                .find(|entry: &&git::WorktreeEntry| same_dir(&entry.path, &expected))?;
            // Ein von Hand gelöschter Ordner steht bis zum nächsten `prune` noch in der Liste.
            if !entry.path.exists() {
                return None;
            }
            Some(TicketWorktree {
                position,
                folder: folder.clone(),
                path: entry.path.clone(),
                head: entry.head.clone(),
                branch: entry.branch.clone(),
            })
        })
        .collect();
    worktrees.sort_by(|first: &TicketWorktree, second: &TicketWorktree| {
        first.folder.cmp(&second.folder)
    });
    worktrees
}

/// `(base_commit, base_ref)` eines Ticket-Worktrees: die Abzweigung vom Standard-Branch, damit die
/// Changes den ganzen Branch zeigen, egal welche Session daran gearbeitet hat. Ohne Standard-Branch
/// gilt ersatzweise der ausgecheckte Stand des Haupt-Checkouts.
pub fn ticket_base(
    repository: &SessionRepository,
    worktree: &TicketWorktree,
) -> Result<(String, String), CommandError> {
    if let Some(branch) = git::default_branch(&repository.repository_path)? {
        let reference = format!("refs/heads/{branch}");
        let commit = git::merge_base(&worktree.path, HEAD, &reference)?;
        return Ok((commit, branch));
    }
    let (reference, main_commit) = read_base(&repository.repository_path)?;
    let commit = git::merge_base(&worktree.path, HEAD, &main_commit)?;
    Ok((commit, reference))
}

/// Gleicher Ordner ohne Rücksicht auf Groß/Klein, Schrägstrich-Richtung und abschließenden Trenner:
/// Git nennt unter Windows `C:/Users/...`, die Session kennt `C:\Users\...`.
fn same_dir(first: &Path, second: &Path) -> bool {
    normalized_dir(first) == normalized_dir(second)
}

pub fn normalized_dir(path: &Path) -> String {
    path.to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

pub fn is_folder_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
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
