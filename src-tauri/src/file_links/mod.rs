//! Dateiverweise im Chat (ADR 023): ein Pfad aus einer Agenten-Antwort wird nur geöffnet, wenn er
//! ein Anzeige-Format hat und im Vorhaben liegt.
use std::fs;
use std::path::{MAIN_SEPARATOR_STR, Path, PathBuf};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::changes::{ChangesInput, sources};
use crate::error::CommandError;
use crate::worktrees::SessionRepository;

/// Endungen, die per Klick geöffnet werden. Gespiegelt in `src/lib/fileLinks.ts` (nur Darstellung).
/// Nie etwas, dessen Standardprogramm es ausführt (`cmd`, `bat`, `exe`, `ps1`, `lnk` …).
pub const OPENABLE_EXTENSIONS: &[&str] = &[
    "html", "htm", "pdf", "svg", "png", "jpg", "jpeg", "gif", "webp", "md", "txt",
];

/// Endungen, die immer das Standardprogramm öffnet; die Ansicht „Dateien“ zeigt sie nicht.
/// Gespiegelt in `src/lib/fileLinks.ts` (`isExternalLink`).
pub const EXTERNAL_EXTENSIONS: &[&str] = &["html", "htm", "pdf"];

/// Unter Unix bleibt der Schrägstrich des Pfads stehen (`file:///home/x` → `/home/x`).
const FILE_URL_PREFIX: &str = if cfg!(windows) { "file:///" } else { "file://" };
const OUTSIDE_PROJECT: &str = "Liegt außerhalb des Vorhabens";

pub struct LinkRoots {
    /// Basen für relative Pfade, in Suchreihenfolge.
    pub relative_bases: Vec<PathBuf>,
    /// Alles, worin ein aufgelöster Pfad liegen darf (Basen + Haupt-Checkouts + Ticket-Worktrees).
    pub allowed: Vec<PathBuf>,
}

/// Die Wurzeln des ganzen Vorhabens: relative Pfade gegen die Arbeitsordner der Repositories (in
/// Positions-Reihenfolge), zuletzt gegen den Workspace; erlaubt sind dazu die Haupt-Checkouts und
/// alle Einträge der Changes, also auch Ticket-Worktrees und innere Repositories.
pub fn roots(input: &ChangesInput) -> LinkRoots {
    let mut relative_bases: Vec<PathBuf> = input
        .repositories
        .iter()
        .map(|repository: &SessionRepository| repository.working_dir(&input.workspace))
        .collect();
    relative_bases.push(input.workspace.clone());
    let mut allowed: Vec<PathBuf> = relative_bases.clone();
    allowed.extend(
        input
            .repositories
            .iter()
            .map(|repository: &SessionRepository| repository.repository_path.clone()),
    );
    allowed.extend(
        sources::sources(input)
            .into_iter()
            .map(|source: sources::Source| source.dir),
    );
    LinkRoots {
        relative_bases,
        allowed,
    }
}

/// Wohin ein Klick auf einen Dateilink führt (ADR 067).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FileLinkTarget {
    /// In „Dateien“ öffnen: `key` des Eintrags, `path` relativ zu dessen Ordner mit `/`.
    #[serde(rename_all = "camelCase")]
    View {
        key: String,
        path: String,
        line: Option<u32>,
    },
    /// Mit `file_link_open` im Standardprogramm öffnen.
    External,
    /// Nur ein Dateiname: die Oberfläche sucht ihn in den Bäumen.
    #[serde(rename_all = "camelCase")]
    Name { name: String },
}

/// Bereinigt `raw` (trimmen, Präfix `file:///` entfernen, Endung `:<Zahl>` bzw. `:<Zahl>:<Zahl>` entfernen),
/// prüft die Endung, löst auf und prüft die Grenze. Liefert den zu öffnenden Pfad.
pub fn resolve(raw: &str, roots: &LinkRoots) -> Result<PathBuf, CommandError> {
    let cleaned = clean(raw);
    check_extension(Path::new(&cleaned))?;
    let (found, target) = locate(&cleaned, roots)?;
    // Das Ziel eines symbolischen Links `x.html` auf eine exe darf nicht durch die Endungsprüfung rutschen.
    check_extension(&target)?;
    // Nicht die kanonische Form: deren Präfix `\\?\` verstehen nicht alle Standardprogramme.
    Ok(found)
}

/// Entscheidet, wohin der Link führt: Dateiname ohne Ordner → `Name`, HTML und PDF → `External`, Datei im Ordner
/// eines Eintrags (`entries` = Schlüssel und Ordner) → `View`, sonst im Workspace nur mit Anzeige-Endung → `External`.
pub fn target(
    raw: &str,
    roots: &LinkRoots,
    entries: &[(String, PathBuf)],
) -> Result<FileLinkTarget, CommandError> {
    let cleaned = clean(raw);
    let path = Path::new(&cleaned);
    let has_folder = cleaned.contains(MAIN_SEPARATOR_STR);
    let exists_in_base = candidates(path, roots)
        .iter()
        .any(|candidate: &PathBuf| candidate.is_file());
    if !has_folder && !exists_in_base {
        return Ok(FileLinkTarget::Name { name: cleaned });
    }
    let (found, canonical) = locate(&cleaned, roots)?;
    if has_extension(&found, EXTERNAL_EXTENSIONS) {
        return Ok(FileLinkTarget::External);
    }
    if let Some((key, relative)) = entry_of(&canonical, entries) {
        return Ok(FileLinkTarget::View {
            key,
            path: relative,
            line: line_of(raw),
        });
    }
    if has_extension(&found, OPENABLE_EXTENSIONS) {
        return Ok(FileLinkTarget::External);
    }
    Err(CommandError::FileNotAllowed(
        "Liegt in keinem Repository des Vorhabens".to_owned(),
    ))
}

/// Die erste angehängte Zahl: `pfad:12` und `pfad:12:5` liefern 12.
pub fn line_of(raw: &str) -> Option<u32> {
    split_line(without_scheme(raw.trim())).1
}

/// Schlüssel und relativer Pfad (mit `/`) des Eintrags, in dessen Ordner die Datei liegt; der längste passende
/// Ordner gewinnt, denn Ticket-Worktrees und innere Repositories liegen oft unter einem anderen Eintrag.
fn entry_of(canonical: &Path, entries: &[(String, PathBuf)]) -> Option<(String, String)> {
    let mut best: Option<(usize, &String, PathBuf)> = None;
    for (key, dir) in entries {
        let Ok(root) = fs::canonicalize(dir) else {
            continue;
        };
        let Ok(relative) = canonical.strip_prefix(&root) else {
            continue;
        };
        let depth = root.components().count();
        if best
            .as_ref()
            .is_none_or(|(best_depth, _, _): &(usize, &String, PathBuf)| depth > *best_depth)
        {
            best = Some((depth, key, relative.to_path_buf()));
        }
    }
    best.map(|(_, key, relative): (usize, &String, PathBuf)| {
        let joined: Vec<String> = relative
            .components()
            .map(|part| part.as_os_str().to_string_lossy().into_owned())
            .collect();
        (key.clone(), joined.join("/"))
    })
}

fn has_extension(path: &Path, extensions: &[&str]) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension: &str| {
            extensions
                .iter()
                .any(|allowed: &&str| allowed.eq_ignore_ascii_case(extension))
        })
}

/// Mögliche Orte der Datei: der Pfad selbst, sonst gegen jede relative Basis.
fn candidates(path: &Path, roots: &LinkRoots) -> Vec<PathBuf> {
    if path.is_absolute() {
        return vec![path.to_path_buf()];
    }
    // Eine relative Basis löste sich gegen das Arbeitsverzeichnis der App auf, nicht gegen das Vorhaben.
    roots
        .relative_bases
        .iter()
        .filter(|base: &&PathBuf| base.is_absolute())
        .map(|base: &PathBuf| base.join(path))
        .collect()
}

/// Findet die Datei und prüft, dass sie im Vorhaben liegt; liefert den gefundenen und den kanonischen Pfad.
fn locate(cleaned: &str, roots: &LinkRoots) -> Result<(PathBuf, PathBuf), CommandError> {
    // Ein Doppelpunkt hinter dem Laufwerk adressiert unter Windows einen Datenstrom der Datei davor:
    // `x.exe:y.html` hätte die erlaubte Endung, gemeint ist aber die exe. Unter Unix ist er ein Namenszeichen.
    if cfg!(windows)
        && cleaned
            .char_indices()
            .any(|(index, character): (usize, char)| character == ':' && index != 1)
    {
        return Err(CommandError::FileNotAllowed(format!(
            "Ungültiger Pfad {cleaned}"
        )));
    }
    let Some(found) = candidates(Path::new(cleaned), roots)
        .into_iter()
        .find(|candidate: &PathBuf| candidate.is_file())
    else {
        return Err(CommandError::FileNotFound(cleaned.to_owned()));
    };
    // Kanonisch geprüft, damit weder `..` noch ein symbolischer Link aus dem Vorhaben herausführt.
    let canonical = fs::canonicalize(&found)?;
    let is_inside = roots
        .allowed
        .iter()
        .filter_map(|root: &PathBuf| fs::canonicalize(root).ok())
        .any(|root: PathBuf| canonical.starts_with(&root));
    if !is_inside {
        return Err(CommandError::FileNotAllowed(OUTSIDE_PROJECT.to_owned()));
    }
    Ok((found, canonical))
}

fn clean(raw: &str) -> String {
    strip_line_number(without_scheme(raw.trim())).replace('/', MAIN_SEPARATOR_STR)
}

/// Entfernt `file:///` (Windows) bzw. `file://` (sonst, der Schrägstrich des Pfads bleibt stehen).
fn without_scheme(trimmed: &str) -> &str {
    match trimmed.get(..FILE_URL_PREFIX.len()) {
        Some(prefix) if prefix.eq_ignore_ascii_case(FILE_URL_PREFIX) => {
            &trimmed[FILE_URL_PREFIX.len()..]
        }
        _ => trimmed,
    }
}

/// `pfad:12` und `pfad:12:5` — Zeile und Spalte, wie Agenten sie anhängen.
fn strip_line_number(text: &str) -> &str {
    split_line(text).0
}

/// Der Pfad ohne angehängte Zahlen und die erste davon (die Zeile).
fn split_line(text: &str) -> (&str, Option<u32>) {
    let mut rest = text;
    let mut line: Option<u32> = None;
    for _ in 0..2 {
        match rest.rsplit_once(':') {
            Some((head, tail))
                if !head.is_empty()
                    && !tail.is_empty()
                    && tail
                        .chars()
                        .all(|character: char| character.is_ascii_digit()) =>
            {
                line = tail.parse::<u32>().ok();
                rest = head;
            }
            _ => break,
        }
    }
    (rest, line)
}

fn check_extension(path: &Path) -> Result<(), CommandError> {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return Err(CommandError::FileNotAllowed(
            "Kein Dateityp erkennbar".to_owned(),
        ));
    };
    let is_openable = OPENABLE_EXTENSIONS
        .iter()
        .any(|allowed: &&str| allowed.eq_ignore_ascii_case(extension));
    if !is_openable {
        return Err(CommandError::FileNotAllowed(format!(
            "Dateityp .{extension} wird nicht geöffnet"
        )));
    }
    Ok(())
}
