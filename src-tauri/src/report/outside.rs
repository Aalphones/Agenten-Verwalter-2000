//! Repositorys, in die eine Station geschrieben hat, ohne dass sie im Vorhaben eingetragen sind
//! (ADR 075): gefunden über `session_files`, gelesen aus Git. Aus ihnen zählt im Bericht nur, was
//! die Stationen selbst geschrieben haben (`Checkout.written_only`).
use std::collections::{HashMap, HashSet};
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use crate::changes::attribution::{NORMALIZED_SEPARATOR, normalize_path};
use crate::db::session_files::SessionFileRow;
use crate::filesystem::native_path;
use crate::git::{self, ChangingCommit, WorktreeEntry};
use crate::implementation::model::{ImplementationView, PhaseView, StationView};
use crate::report::assemble::AssembleContext;
use crate::report::range::Checkout;

const OUTSIDE_KEY: &str = "extern:";
const GIT_DIR_NAME: &str = ".git";
const MS_PER_SECOND: f64 = 1000.0;

/// Eine geschriebene Datei in einem Repository außerhalb der Einträge der Changes.
struct Located {
    /// Position in `AssembleContext.files`.
    row: usize,
    /// Wie `Checkout.key`.
    checkout_key: String,
    /// Relativ zum Checkout, mit `/`.
    relative: String,
}

/// Wo ein Ordner in einem Repository liegt (`git::place_in_repository`).
struct DirPlace {
    toplevel: PathBuf,
    /// Relativ zu `toplevel`, mit `/` am Ende, in der Wurzel leer.
    prefix: String,
}

/// Hängt die Repositorys außerhalb des Vorhabens an `context`: ihre Checkouts und die Commits der
/// Stationen darin. Ihre Dateien stehen danach in `files` und `touched` unter dem Pfad, den Git
/// für sie meint; wie sie geschrieben wurden, merkt sich `written_as`. `known_dirs` sind die
/// Ordner aller Einträge der Changes, auch der nicht lesbaren.
pub fn extend(
    view: &ImplementationView,
    known_dirs: &[PathBuf],
    context: &mut AssembleContext<'_>,
) {
    let located = locate_files(known_dirs, context);
    for file in &located {
        let Some(checkout) = context
            .checkouts
            .iter()
            .find(|checkout: &&Checkout| checkout.key == file.checkout_key)
        else {
            continue;
        };
        let canonical = normalize_path(
            &checkout
                .dir
                .join(native_path(&file.relative))
                .to_string_lossy(),
        );
        let Some((_, path, touched_at)) = context.files.get_mut(file.row) else {
            continue;
        };
        let latest = context
            .touched
            .entry(canonical.clone())
            .or_insert(*touched_at);
        *latest = latest.max(*touched_at);
        let written = normalize_path(path);
        if written != canonical {
            context.written_as.insert(written, canonical.clone());
            *path = canonical;
        }
    }
    add_commits(view, &located, context);
}

/// Ordnet jeden Pfad außerhalb von `known_dirs`, der in einem Git-Repository liegt, einem Checkout
/// zu und legt fehlende an; andere Pfade werden übergangen.
fn locate_files(known_dirs: &[PathBuf], context: &mut AssembleContext<'_>) -> Vec<Located> {
    let known: Vec<String> = known_dirs
        .iter()
        .map(|dir: &PathBuf| normalize_path(&dir.to_string_lossy()))
        .collect();
    let mut places: HashMap<PathBuf, Option<DirPlace>> = HashMap::new();
    let mut keys: HashMap<String, String> = HashMap::new();
    let mut located: Vec<Located> = Vec::new();
    for (row, (_, path, _)) in context.files.iter().enumerate() {
        let normalized = normalize_path(path);
        if known.iter().any(|dir: &String| is_below(&normalized, dir)) {
            continue;
        }
        let file = native_path(path);
        let (Some(parent), Some(name)) = (file.parent(), file.file_name()) else {
            continue;
        };
        let place = places
            .entry(parent.to_path_buf())
            .or_insert_with(|| place_of(parent));
        let Some(place) = place else {
            continue;
        };
        let checkout_key = keys
            .entry(normalize_path(&place.toplevel.to_string_lossy()))
            .or_insert_with(|| checkout_for(&place.toplevel, &mut context.checkouts))
            .clone();
        located.push(Located {
            row,
            checkout_key,
            relative: format!("{}{}", place.prefix, name.to_string_lossy()),
        });
    }
    located
}

fn is_below(path: &str, dir: &str) -> bool {
    path.strip_prefix(dir)
        .is_some_and(|rest: &str| rest.starts_with(NORMALIZED_SEPARATOR))
}

/// Auch für einen Ordner, den es nicht mehr gibt: dann zählt der nächste vorhandene darüber.
fn place_of(dir: &Path) -> Option<DirPlace> {
    let existing = dir.ancestors().find(|ancestor: &&Path| ancestor.is_dir())?;
    // Ohne `.git` darüber spart das den Git-Aufruf: die meisten Ordner hier sind keine
    // Repositorys. Aufgelöst, weil eine Verknüpfung mitten in ein Repository führen kann.
    let real = fs::canonicalize(existing).unwrap_or_else(|_| existing.to_path_buf());
    let is_in_repository = real
        .ancestors()
        .any(|ancestor: &Path| ancestor.join(GIT_DIR_NAME).exists());
    if !is_in_repository {
        return None;
    }
    let (toplevel, mut prefix) = git::place_in_repository(existing).ok()?;
    for component in dir.strip_prefix(existing).ok()?.components() {
        prefix.push_str(&component.as_os_str().to_string_lossy());
        prefix.push('/');
    }
    Some(DirPlace { toplevel, prefix })
}

/// Der Schlüssel des Checkouts mit diesem Wurzelordner; ein neuer wird angehängt. Ist er ein
/// weiterer Arbeitsbaum eines eingetragenen Repositorys, gehört er in dessen Gruppe — sonst stünden
/// dessen Commits zweimal im Bericht.
fn checkout_for(toplevel: &Path, checkouts: &mut Vec<Checkout>) -> String {
    let wanted = normalize_path(&toplevel.to_string_lossy());
    if let Some(known) = checkouts
        .iter()
        .find(|checkout: &&Checkout| normalize_path(&checkout.dir.to_string_lossy()) == wanted)
    {
        return known.key.clone();
    }
    let worktrees: Vec<WorktreeEntry> = git::worktree_list(toplevel).unwrap_or_default();
    let main: &Path = worktrees
        .first()
        .map_or(toplevel, |entry: &WorktreeEntry| entry.path.as_path());
    let trees: HashSet<String> = worktrees
        .iter()
        .map(|entry: &WorktreeEntry| normalize_path(&entry.path.to_string_lossy()))
        .collect();
    let sibling = checkouts.iter().find(|checkout: &&Checkout| {
        trees.contains(&normalize_path(&checkout.dir.to_string_lossy()))
    });
    let (group, label, outside) = match sibling {
        Some(sibling) => (
            sibling.group.clone(),
            sibling.label.clone(),
            sibling.outside,
        ),
        None => (
            format!("{OUTSIDE_KEY}{}", normalize_path(&main.to_string_lossy())),
            folder_name(main),
            true,
        ),
    };
    let key = format!("{OUTSIDE_KEY}{wanted}");
    checkouts.push(Checkout {
        key: key.clone(),
        group,
        dir: toplevel.to_path_buf(),
        is_main: normalize_path(&main.to_string_lossy()) == wanted,
        outside,
        label,
        written_only: true,
    });
    key
}

/// Der Ordnername, wie das Dateisystem ihn schreibt: die Pfade aus `session_files` sind unter
/// Windows klein geschrieben, und Git übernimmt das auf manchen Laufwerken.
fn folder_name(dir: &Path) -> String {
    let given: OsString = dir.file_name().unwrap_or(dir.as_os_str()).to_owned();
    let wanted = given.to_string_lossy().to_lowercase();
    dir.parent()
        .and_then(|parent: &Path| fs::read_dir(parent).ok())
        .and_then(|listing: fs::ReadDir| {
            let names: Vec<String> = listing
                .filter_map(Result::ok)
                .map(|entry: fs::DirEntry| entry.file_name().to_string_lossy().into_owned())
                .filter(|name: &String| name.to_lowercase() == wanted)
                .collect();
            // Wo Groß- und Kleinschreibung zählt, kann es mehrere geben.
            names
                .iter()
                .find(|name: &&String| given.to_str() == Some(name.as_str()))
                .or_else(|| names.first())
                .cloned()
        })
        .unwrap_or_else(|| given.to_string_lossy().into_owned())
}

/// Was die Session einer Station in einem Checkout geschrieben hat, und wann sie lief (Sekunden
/// seit 1970).
struct StationWrites<'a> {
    session_id: &'a str,
    since: i64,
    /// `None`, solange die Station läuft.
    until: Option<i64>,
    /// Relativ zum Checkout, normalisiert.
    paths: HashSet<String>,
}

impl StationWrites<'_> {
    /// Ob der Commit aus ihrem Zeitfenster stammt und eine ihrer Dateien ändert.
    fn made(&self, commit: &ChangingCommit) -> bool {
        commit.committed_at >= self.since
            && self
                .until
                .is_none_or(|until: i64| commit.committed_at <= until)
            && commit
                .files
                .iter()
                .any(|file: &String| self.paths.contains(&normalize_path(file)))
    }
}

/// Die Commits jeder Station in den neuen Checkouts: aus ihrem Zeitfenster und nur solche, die eine
/// ihrer Dateien dort ändern. `session_commits` kennt sie nicht immer, etwa die einer Automatik.
fn add_commits(view: &ImplementationView, located: &[Located], context: &mut AssembleContext<'_>) {
    let mut seen: HashSet<(String, String)> = context.commits.iter().cloned().collect();
    for checkout in context
        .checkouts
        .iter()
        .filter(|checkout: &&Checkout| checkout.written_only)
    {
        let stations = writes_in(checkout, view, located, &context.files);
        // Ein Aufruf über alle Fenster: einer je Station kostete auf einem Cloud-Laufwerk Sekunden.
        let Some(since) = stations
            .iter()
            .map(|station: &StationWrites<'_>| station.since)
            .min()
        else {
            continue;
        };
        let ends: Option<Vec<i64>> = stations
            .iter()
            .map(|station: &StationWrites<'_>| station.until)
            .collect();
        let until = ends.and_then(|ends: Vec<i64>| ends.into_iter().max());
        let commits = match git::commits_in_window(&checkout.dir, since, until) {
            Ok(commits) => commits,
            Err(error) => {
                eprintln!(
                    "Bericht: Commits in {} nicht gelesen: {error}",
                    checkout.dir.display()
                );
                continue;
            }
        };
        for station in &stations {
            for commit in commits
                .iter()
                .filter(|commit: &&ChangingCommit| station.made(commit))
            {
                let pair = (station.session_id.to_owned(), commit.id.clone());
                if seen.insert(pair.clone()) {
                    context.commits.push(pair);
                }
            }
        }
    }
}

/// Die begonnenen Stationen, deren Session in den Checkout geschrieben hat.
fn writes_in<'a>(
    checkout: &Checkout,
    view: &'a ImplementationView,
    located: &[Located],
    files: &[SessionFileRow],
) -> Vec<StationWrites<'a>> {
    view.phases
        .iter()
        .flat_map(|phase: &PhaseView| &phase.stations)
        .filter_map(|station: &StationView| {
            let session_id = station.session_id.as_deref()?;
            let paths: HashSet<String> = located
                .iter()
                .filter(|file: &&Located| {
                    file.checkout_key == checkout.key
                        && files
                            .get(file.row)
                            .is_some_and(|(session, _, _): &SessionFileRow| session == session_id)
                })
                .map(|file: &Located| normalize_path(&file.relative))
                .collect();
            if paths.is_empty() {
                return None;
            }
            Some(StationWrites {
                session_id,
                since: seconds_of(station.started_at?),
                until: station.completed_at.map(seconds_of),
                paths,
            })
        })
        .collect()
}

fn seconds_of(ms: f64) -> i64 {
    // Ganze Sekunden; der Bruchteil zählt für Git nicht.
    (ms / MS_PER_SECOND) as i64
}
