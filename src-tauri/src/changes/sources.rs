//! Die Einträge der Changes-Ansicht einer Reichweite — die eine Stelle, die Schlüssel baut und
//! auflöst (ADR 020).
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;

use crate::changes::ChangesInput;
use crate::error::CommandError;
use crate::worktrees::{self, RepositoryCheckout, SessionRepository, TicketRoot, TicketWorktree};

/// Ein Eintrag der Changes-Ansicht, bevor Git seine Dateien liest.
pub struct Source {
    /// `RepositoryChanges.key`: `"<P>"`, `"<P>/<Ordner>"` oder `"<P>:<Ordner>"`.
    pub key: String,
    pub name: String,
    /// Wogegen gemessen wird; bei inneren Repositories aus `inner_checkout`.
    pub repository: SessionRepository,
    pub ticket: Option<TicketWorktree>,
    /// Ordner, in dem Git liest: Ticket-Worktree, sonst `repository.working_dir(workspace)`.
    pub dir: PathBuf,
    /// Nur innere Repositories: entfällt in `changes::load`, wenn es nichts zeigt.
    pub optional: bool,
    /// Basis nicht bestimmbar; der Eintrag trägt dann diesen Fehler.
    pub error: Option<String>,
}

/// Alle Einträge der Reichweite in Anzeigereihenfolge: je Repository erst es selbst und seine
/// Ticket-Worktrees daneben, dann je inneres Repository es selbst und seine Ticket-Worktrees im
/// angehängten Ordner. Ein Ordner ohne Git hat keinen eigenen Eintrag (ADR 018), nur seine inneren
/// Repositories. Ticket-Worktrees nur, wenn Git sie noch als Worktree führt.
pub fn sources(input: &ChangesInput) -> Vec<Source> {
    let mut sources: Vec<Source> = Vec::new();
    for (index, repository) in input.repositories.iter().enumerate() {
        let Ok(position) = u32::try_from(index) else {
            continue;
        };
        let mut sibling: Vec<String> = Vec::new();
        let mut inner_folders: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for (ticket_position, folder) in &input.ticket_folders {
            if *ticket_position != position {
                continue;
            }
            match worktrees::ticket_root_of(&input.ticket_roots, position, folder) {
                Some(TicketRoot { inner: None, .. }) => sibling.push(folder.clone()),
                Some(TicketRoot {
                    inner: Some(inner), ..
                }) => inner_folders
                    .entry(inner.clone())
                    .or_default()
                    .push(folder.clone()),
                None => {}
            }
        }
        if !matches!(repository.checkout, RepositoryCheckout::Folder) {
            sources.push(Source {
                key: position.to_string(),
                name: repository.name.clone(),
                repository: repository.clone(),
                ticket: None,
                dir: repository.working_dir(&input.workspace),
                optional: false,
                error: None,
            });
            for worktree in worktrees::ticket_worktrees(repository, position, &sibling) {
                sources.push(Source {
                    key: format!("{position}/{}", worktree.folder),
                    name: format!("{} · {}", repository.name, worktree.folder),
                    repository: repository.clone(),
                    dir: worktree.path.clone(),
                    ticket: Some(worktree),
                    optional: false,
                    error: None,
                });
            }
        }
        let inner_names = input
            .ticket_roots
            .iter()
            .filter(|root: &&TicketRoot| root.position == position)
            .filter_map(|root: &TicketRoot| root.inner.as_ref());
        for inner in inner_names {
            sources.extend(inner_sources(
                input,
                position,
                repository,
                inner,
                inner_folders.get(inner).map_or(&[], Vec::as_slice),
            ));
        }
    }
    sources
}

/// Ein inneres Repository und seine Ticket-Worktrees; ohne bestimmbare Basis nur der Eintrag mit
/// dem Fehler.
fn inner_sources(
    input: &ChangesInput,
    position: u32,
    outer: &SessionRepository,
    inner: &str,
    folders: &[String],
) -> Vec<Source> {
    let key = format!("{position}:{inner}");
    let name = format!("{}/{inner}", outer.name);
    let inner_repository = match worktrees::inner_checkout(outer, inner, input.since_ms) {
        Ok(inner_repository) => inner_repository,
        Err(error) => {
            let path = outer.repository_path.join(inner);
            return vec![Source {
                key,
                name,
                repository: SessionRepository {
                    name: inner.to_owned(),
                    repository_path: path.clone(),
                    base_ref: String::new(),
                    base_commit: String::new(),
                    checkout: RepositoryCheckout::Main,
                },
                ticket: None,
                dir: path,
                optional: true,
                error: Some(error.to_string()),
            }];
        }
    };
    let worktrees = worktrees::ticket_worktrees_in(
        &inner_repository,
        position,
        folders,
        &outer.repository_path,
    );
    let mut sources = vec![Source {
        key,
        name: name.clone(),
        dir: inner_repository.repository_path.clone(),
        repository: inner_repository.clone(),
        ticket: None,
        optional: true,
        error: None,
    }];
    sources.extend(
        worktrees
            .into_iter()
            .map(|worktree: TicketWorktree| Source {
                key: format!("{position}:{}", worktree.folder),
                name: format!("{name} · {}", worktree.folder),
                repository: inner_repository.clone(),
                dir: worktree.path.clone(),
                ticket: Some(worktree),
                optional: false,
                error: None,
            }),
    );
    sources
}

/// Der Eintrag zu einem Schlüssel aus der Oberfläche — nur einer, den `sources` für dieselbe
/// Reichweite selbst gebaut hat. So wird ein Ordner aus der Oberfläche nie ungeprüft zum Pfad.
pub fn find(input: &ChangesInput, key: &str) -> Result<Source, CommandError> {
    let (position_text, folder) = match key.find(['/', ':']) {
        Some(separator) => (&key[..separator], Some(&key[separator + 1..])),
        None => (key, None),
    };
    if position_text.parse::<u32>().is_err() {
        return Err(CommandError::Internal(format!(
            "Ungültiger Schlüssel {key}"
        )));
    }
    if let Some(folder) = folder {
        validate_folder(folder)?;
    }
    sources(input)
        .into_iter()
        .find(|source: &Source| source.key.eq_ignore_ascii_case(key))
        .ok_or_else(|| {
            CommandError::Io("Diesen Eintrag gibt es in den Changes nicht mehr.".to_owned())
        })
}

/// Ein einzelner Ordnername im oder neben dem angehängten Ordner — nichts, was woandershin führt.
fn validate_folder(folder: &str) -> Result<(), CommandError> {
    let leaves_parent =
        folder.is_empty() || folder == "." || folder == ".." || folder.contains(['/', '\\', ':']);
    if leaves_parent {
        return Err(CommandError::Internal(format!(
            "Ungültiger Ordner: {folder}"
        )));
    }
    Ok(())
}

/// Die Ticket-Worktrees einer Reichweite: die gemerkten plus die, die in den Pfaden der
/// geschriebenen Dateien vorkommen — rückwirkend, damit laufende Sessions ihre offenen Dateien in
/// Ticket-Worktrees innerer Repositories sofort zeigen (ADR 020). Ob es sie noch gibt, prüft
/// `sources` über Git.
pub fn scope_ticket_folders(
    roots: &[TicketRoot],
    remembered: Vec<(u32, String)>,
    touched: &HashMap<String, f64>,
) -> Vec<(u32, String)> {
    let mut folders = remembered;
    let mut paths: Vec<&String> = touched.keys().collect();
    paths.sort();
    for path in paths {
        for (position, folder) in worktrees::mentioned_ticket_worktrees(roots, path) {
            let is_known = folders
                .iter()
                .any(|(known_position, known): &(u32, String)| {
                    *known_position == position && known.eq_ignore_ascii_case(&folder)
                });
            if !is_known {
                folders.push((position, folder));
            }
        }
    }
    folders
}
