//! Artefakte: HTML-Seiten, die der Agent im Ordner `.artefakte` des Vorhabens ablegt (ADR 026).
//! Hier liegen Ordner, Liste und die Pfadprüfung; ausgeliefert werden die Dateien über einen
//! eigenen Server auf `127.0.0.1` (`server`).
pub mod model;
pub mod server;

use std::cmp::Ordering;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use model::{Artifact, ArtifactOwner};

use crate::changes::attribution::normalize_path;
use crate::error::CommandError;

pub const DIR_NAME: &str = ".artefakte";

const ARTIFACT_EXTENSIONS: [&str; 2] = ["html", "htm"];
const MAX_TITLE_BYTES: u64 = 65_536;
const MAX_TITLE_CHARS: usize = 200;
const HTML_ENTITIES: [(&str, &str); 6] = [
    ("&lt;", "<"),
    ("&gt;", ">"),
    ("&quot;", "\""),
    ("&#39;", "'"),
    ("&nbsp;", " "),
    // Zuletzt: sonst würde aus `&amp;lt;` erst `&lt;` und dann `<`.
    ("&amp;", "&"),
];

/// Der Ordner `.artefakte` im Workspace des Vorhabens — alle Sessions teilen ihn.
pub fn dir(workspace: &Path) -> PathBuf {
    workspace.join(DIR_NAME)
}

/// Ein Name direkt im Ordner mit Endung `.html`/`.htm`, Groß-/Kleinschreibung egal.
pub fn is_artifact_file(name: &str) -> bool {
    if name.contains(['/', '\\']) {
        return false;
    }
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension: &str| {
            ARTIFACT_EXTENSIONS
                .iter()
                .any(|known: &&str| extension.eq_ignore_ascii_case(known))
        })
}

/// Die Artefakte im Ordner, neueste zuerst. Fehlt er oder ist er nicht lesbar, ist die Liste leer.
/// Die Session je Datei ist die, deren Agent sie zuletzt mit einem schreibenden Werkzeug anfasste.
pub fn list(dir: &Path, owners: &[ArtifactOwner]) -> Vec<Artifact> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut items: Vec<Artifact> = Vec::new();
    for entry in entries.flatten() {
        let is_file = entry
            .file_type()
            .is_ok_and(|file_type: fs::FileType| file_type.is_file());
        let file = entry.file_name().to_string_lossy().into_owned();
        if !is_file || !is_artifact_file(&file) {
            continue;
        }
        let path = entry.path();
        let modified_at = entry
            .metadata()
            .and_then(|metadata: fs::Metadata| metadata.modified())
            .map_or(0.0, |modified: SystemTime| {
                modified
                    .duration_since(UNIX_EPOCH)
                    .map_or(0.0, |elapsed| elapsed.as_secs_f64() * 1000.0)
            });
        let title = title_of(&path).unwrap_or_else(|| file_stem(&file));
        let owner = latest_owner(&normalize_path(&path.to_string_lossy()), owners);
        items.push(Artifact {
            file,
            title,
            modified_at,
            session_id: owner.map(|found: &ArtifactOwner| found.session_id.clone()),
            session_number: owner.map(|found: &ArtifactOwner| found.number),
            session_name: owner.map(|found: &ArtifactOwner| found.name.clone()),
        });
    }
    items.sort_by(|left: &Artifact, right: &Artifact| {
        right
            .modified_at
            .partial_cmp(&left.modified_at)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.file.cmp(&right.file))
    });
    items
}

/// Die Datei `relative` im Ordner `dir`. Der Pfad kommt aus einer Seite oder der Oberfläche: `..`,
/// Wurzel und Laufwerk sind verboten, und das kanonische Ziel muss unter dem kanonischen Ordner
/// liegen — sonst führte ein Symlink im Ordner nach draußen.
pub fn resolve(dir: &Path, relative: &str) -> Result<PathBuf, CommandError> {
    let has_escape = Path::new(relative)
        .components()
        .any(|component: Component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        });
    if relative.trim().is_empty() || has_escape {
        return Err(not_allowed(relative));
    }
    let joined = dir.join(relative);
    if !joined.exists() {
        return Err(CommandError::FileNotFound(relative.to_owned()));
    }
    let root = fs::canonicalize(dir)?;
    let target =
        fs::canonicalize(&joined).map_err(|_| CommandError::FileNotFound(relative.to_owned()))?;
    if !target.starts_with(&root) {
        return Err(not_allowed(relative));
    }
    if target.is_dir() {
        return Err(CommandError::FileNotFound(relative.to_owned()));
    }
    Ok(target)
}

fn not_allowed(relative: &str) -> CommandError {
    CommandError::FileNotAllowed(format!("Nicht im Ordner {DIR_NAME}: {relative}"))
}

/// Unter allen Sessions die, die den Pfad zuletzt geschrieben hat.
fn latest_owner<'a>(key: &str, owners: &'a [ArtifactOwner]) -> Option<&'a ArtifactOwner> {
    owners
        .iter()
        .filter_map(|owner: &ArtifactOwner| {
            owner
                .touched
                .get(key)
                .map(|touched_at: &f64| (owner, *touched_at))
        })
        .max_by(
            |left: &(&ArtifactOwner, f64), right: &(&ArtifactOwner, f64)| {
                left.1.partial_cmp(&right.1).unwrap_or(Ordering::Equal)
            },
        )
        .map(|(owner, _): (&ArtifactOwner, f64)| owner)
}

fn file_stem(file: &str) -> String {
    Path::new(file).file_stem().map_or_else(
        || file.to_owned(),
        |stem| stem.to_string_lossy().into_owned(),
    )
}

/// Der Text von `<title>` aus den ersten 64 KiB. Gesucht wird in einer Kopie in Kleinbuchstaben;
/// `to_ascii_lowercase` lässt die Byte-Positionen unverändert, also passen sie aufs Original.
fn title_of(path: &Path) -> Option<String> {
    let mut bytes: Vec<u8> = Vec::new();
    File::open(path)
        .ok()?
        .take(MAX_TITLE_BYTES)
        .read_to_end(&mut bytes)
        .ok()?;
    let text = String::from_utf8_lossy(&bytes);
    let lower = text.to_ascii_lowercase();
    let tag_start = lower.find("<title")?;
    let content_start = tag_start + lower[tag_start..].find('>')? + 1;
    let content_end = content_start + lower[content_start..].find("</title")?;
    let mut title = text[content_start..content_end].to_owned();
    for (entity, replacement) in HTML_ENTITIES {
        title = title.replace(entity, replacement);
    }
    let collapsed: String = title
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
        .chars()
        .take(MAX_TITLE_CHARS)
        .collect();
    if collapsed.is_empty() {
        return None;
    }
    Some(collapsed)
}
