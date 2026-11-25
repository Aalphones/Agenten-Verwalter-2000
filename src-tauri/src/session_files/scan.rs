//! Die Liste „Session-Dateien“ eines Vorhabens (ADR 071): je Session die Dateien ihrer beiden
//! Scratchpads und jede geschriebene oder verlinkte Datei außerhalb der Repository-Einträge und
//! `.artefakte`.
use std::cmp::Reverse;
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::model::{
    SessionFile, SessionFileGroup, SessionFileOrigin, SessionFilesInput, SessionFilesListing,
    SessionFilesMember,
};
use super::{is_link, scratchpad_root, scratchpads_of};
use crate::artifacts::{self, viewers};
use crate::background::model::{ScratchpadEntry, ScratchpadListing};
use crate::background::scratchpad;
use crate::changes::attribution::{NORMALIZED_SEPARATOR, normalize_path};
use crate::file_links;
use crate::filesystem::{native_path, without_verbatim_prefix};

/// Die Dateien einer Gruppe, je Vergleichsschlüssel einmal.
type Found = BTreeMap<String, SessionFile>;

/// Ein Ordner, wie er genannt ist und wie er wirklich heißt (`None`, wenn es ihn nicht gibt).
struct Root {
    dir: PathBuf,
    canonical: Option<PathBuf>,
}

impl Root {
    /// Der Teil eines kanonischen Pfads unterhalb des Ordners.
    fn relative<'a>(&self, canonical: &'a Path) -> Option<&'a Path> {
        canonical.strip_prefix(self.canonical.as_ref()?).ok()
    }

    /// Wie `relative`, für eine Datei, die es nicht mehr gibt: verglichen wird nur der Text.
    fn parts_of_missing(&self, path: &str) -> Option<Vec<String>> {
        parts_below(path, &self.dir).or_else(|| parts_below(path, self.canonical.as_deref()?))
    }
}

/// Einer der beiden Scratchpads einer Session.
struct Place {
    origin: SessionFileOrigin,
    root: Root,
}

struct Stat {
    bytes: f64,
    /// ms seit 1970.
    modified_at: f64,
}

pub fn listing(input: &SessionFilesInput) -> SessionFilesListing {
    // Was in einem Repository-Eintrag oder in `.artefakte` liegt, hat dort seinen Platz.
    let shown_elsewhere: Vec<Root> = input
        .repository_dirs
        .iter()
        .chain([&input.artifacts_dir])
        .map(|dir: &PathBuf| Root {
            dir: dir.clone(),
            canonical: fs::canonicalize(dir).ok(),
        })
        .collect();
    let mut members: Vec<&SessionFilesMember> = input.members.iter().collect();
    members.sort_by_key(|member: &&SessionFilesMember| {
        (!member.identity.is_own, Reverse(member.identity.number))
    });
    SessionFilesListing {
        groups: members
            .into_iter()
            .filter_map(|member: &SessionFilesMember| group_of(member, &shown_elsewhere))
            .collect(),
    }
}

fn group_of(member: &SessionFilesMember, shown_elsewhere: &[Root]) -> Option<SessionFileGroup> {
    let (own_dir, cli_dir) = scratchpads_of(member);
    let places: Vec<Place> = [
        (SessionFileOrigin::Scratchpad, &own_dir),
        (SessionFileOrigin::CliScratchpad, &cli_dir),
    ]
    .into_iter()
    .filter_map(|(origin, dir): (SessionFileOrigin, &Option<PathBuf>)| {
        let dir: PathBuf = dir.clone()?;
        let canonical: Option<PathBuf> = scratchpad_root(&dir);
        Some(Place {
            origin,
            root: Root { dir, canonical },
        })
    })
    .collect();

    let mut found: Found = Found::new();
    let mut errors: Vec<String> = Vec::new();
    let mut truncated: bool = false;
    for place in &places {
        truncated |= add_scratchpad(place, &mut found, &mut errors);
    }
    // Verlinkte zuerst: ihr Pfad hat die Schreibweise der Antwort, der geschriebene ist unter
    // Windows klein gespeichert — das zählt für Dateien, die es nicht mehr gibt.
    for stored in &member.linked {
        if let Some(file) = named_file(stored, &places, shown_elsewhere) {
            entry_for(&mut found, file).linked = true;
        }
    }
    for stored in &member.written {
        if let Some(file) = named_file(stored, &places, shown_elsewhere) {
            entry_for(&mut found, file).written = true;
        }
    }
    if found.is_empty() && errors.is_empty() {
        return None;
    }

    let mut files: Vec<SessionFile> = found.into_values().collect();
    files.sort_by(|left: &SessionFile, right: &SessionFile| {
        (left.origin, &left.folder, &left.name).cmp(&(right.origin, &right.folder, &right.name))
    });
    Some(SessionFileGroup {
        session_id: member.identity.session_id.clone(),
        number: member.identity.number,
        name: member.identity.name.clone(),
        scratchpad_dir: own_dir.map(|dir: PathBuf| dir.to_string_lossy().into_owned()),
        cli_scratchpad_dir: cli_dir.map(|dir: PathBuf| dir.to_string_lossy().into_owned()),
        files,
        truncated,
        errors,
    })
}

fn entry_for(found: &mut Found, file: SessionFile) -> &mut SessionFile {
    found.entry(normalize_path(&file.path)).or_insert(file)
}

/// Nimmt die Dateien eines Scratchpads auf; `true`, wenn er mehr Einträge hat, als gelesen werden.
/// Ein fehlender Ordner ist leer, ein nicht lesbarer ein Fehlersatz.
fn add_scratchpad(place: &Place, found: &mut Found, errors: &mut Vec<String>) -> bool {
    let label: &str = if place.origin == SessionFileOrigin::CliScratchpad {
        "Scratchpad Kommandozeile"
    } else {
        "Scratchpad"
    };
    if is_link(&place.root.dir) {
        errors.push(format!(
            "{label} ist eine Verknüpfung und wird nicht gelesen"
        ));
        return false;
    }
    if let Err(error) = fs::read_dir(&place.root.dir) {
        if error.kind() != io::ErrorKind::NotFound {
            errors.push(format!("{label} nicht lesbar: {error}"));
        }
        return false;
    }
    let Some(root) = &place.root.canonical else {
        return false;
    };
    let listing: ScratchpadListing = scratchpad::list(Some(&place.root.dir));
    for entry in &listing.entries {
        if let Some(file) = scratchpad_file(place.origin, root, entry) {
            entry_for(found, file);
        }
    }
    listing.truncated
}

/// Ein Eintrag der Scratchpad-Liste als Session-Datei. Ordner zählen nicht, ebenso wenig eine
/// Verknüpfung, die aus dem Scratchpad hinausführt — genannt hat ihr Ziel damit niemand.
fn scratchpad_file(
    origin: SessionFileOrigin,
    root: &Path,
    entry: &ScratchpadEntry,
) -> Option<SessionFile> {
    if entry.is_dir {
        return None;
    }
    let canonical: PathBuf = fs::canonicalize(root.join(native_path(&entry.path))).ok()?;
    let relative: &Path = canonical.strip_prefix(root).ok()?;
    if !canonical.is_file() {
        return None;
    }
    Some(session_file(
        &without_verbatim_prefix(&canonical),
        folder_of(&parts_of(relative)),
        origin,
        Some(Stat {
            bytes: entry.size_bytes as f64,
            modified_at: entry.modified_ms,
        }),
    ))
}

/// Eine geschriebene oder verlinkte Datei; `None`, wenn sie nicht in diese Liste gehört (Ordner,
/// relativer Pfad, Datei eines Repository-Eintrags oder aus `.artefakte`).
fn named_file(stored: &str, places: &[Place], shown_elsewhere: &[Root]) -> Option<SessionFile> {
    if !Path::new(stored).is_absolute() || file_links::has_stream_colon(stored) {
        return None;
    }
    match fs::canonicalize(stored) {
        Ok(canonical) => existing_file(&canonical, places, shown_elsewhere),
        Err(_) => missing_file(stored, places, shown_elsewhere),
    }
}

fn existing_file(
    canonical: &Path,
    places: &[Place],
    shown_elsewhere: &[Root],
) -> Option<SessionFile> {
    let metadata: fs::Metadata = fs::metadata(canonical)
        .ok()
        .filter(|metadata: &fs::Metadata| metadata.is_file())?;
    let stat: Stat = Stat {
        bytes: metadata.len() as f64,
        modified_at: modified_ms(&metadata),
    };
    let display: PathBuf = without_verbatim_prefix(canonical);
    for place in places {
        if let Some(relative) = place.root.relative(canonical) {
            return Some(session_file(
                &display,
                folder_of(&parts_of(relative)),
                place.origin,
                Some(stat),
            ));
        }
    }
    if shown_elsewhere
        .iter()
        .any(|root: &Root| root.relative(canonical).is_some())
    {
        return None;
    }
    Some(session_file(
        &display,
        parent_of(&display),
        SessionFileOrigin::Elsewhere,
        Some(stat),
    ))
}

fn missing_file(stored: &str, places: &[Place], shown_elsewhere: &[Root]) -> Option<SessionFile> {
    let path: &Path = Path::new(stored);
    for place in places {
        if let Some(parts) = place.root.parts_of_missing(stored) {
            return Some(session_file(path, folder_of(&parts), place.origin, None));
        }
    }
    if shown_elsewhere
        .iter()
        .any(|root: &Root| root.parts_of_missing(stored).is_some())
    {
        return None;
    }
    Some(session_file(
        path,
        parent_of(path),
        SessionFileOrigin::Elsewhere,
        None,
    ))
}

/// `written` und `linked` setzt der Aufrufer; ohne `stat` gibt es die Datei nicht mehr.
fn session_file(
    path: &Path,
    folder: String,
    origin: SessionFileOrigin,
    stat: Option<Stat>,
) -> SessionFile {
    let kind = artifacts::kind_of(path);
    SessionFile {
        path: path.to_string_lossy().into_owned(),
        folder,
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default(),
        origin,
        written: false,
        linked: false,
        exists: stat.is_some(),
        bytes: stat.as_ref().map(|stat: &Stat| stat.bytes),
        modified_at: stat.as_ref().map(|stat: &Stat| stat.modified_at),
        kind,
        viewer: viewers::page(kind).is_some(),
        executable: file_links::is_executable(path),
    }
}

/// Die Teile von `path` unterhalb von `root`, in der Schreibweise von `path`, verglichen über
/// `normalize_path`.
fn parts_below(path: &str, root: &Path) -> Option<Vec<String>> {
    let root_key: String = normalize_path(&root.to_string_lossy());
    let prefix: String = format!("{root_key}{NORMALIZED_SEPARATOR}");
    if !normalize_path(path).starts_with(&prefix) {
        return None;
    }
    // `normalize_path` ändert die Zahl der Teile nicht, also stehen sie im Original an denselben
    // Stellen.
    let depth: usize = root_key.split(NORMALIZED_SEPARATOR).count();
    Some(
        without_verbatim_prefix(Path::new(path))
            .to_string_lossy()
            .split(std::path::is_separator)
            .skip(depth)
            .map(str::to_owned)
            .collect(),
    )
}

fn parts_of(relative: &Path) -> Vec<String> {
    relative
        .components()
        .map(|part: Component| part.as_os_str().to_string_lossy().into_owned())
        .collect()
}

/// Der Ordner zu den Teilen eines Pfads: alle bis auf den Dateinamen, mit `/`.
fn folder_of(parts: &[String]) -> String {
    parts
        .split_last()
        .map(|(_, folders): (&String, &[String])| folders.join("/"))
        .unwrap_or_default()
}

fn parent_of(path: &Path) -> String {
    path.parent()
        .map(|parent: &Path| parent.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn modified_ms(metadata: &fs::Metadata) -> f64 {
    metadata.modified().map_or(0.0, |modified: SystemTime| {
        modified
            .duration_since(UNIX_EPOCH)
            .map_or(0.0, |elapsed| elapsed.as_secs_f64() * 1000.0)
    })
}
