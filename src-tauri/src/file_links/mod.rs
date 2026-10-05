//! Dateiverweise im Chat (ADR 023): ein Pfad aus einer Agenten-Antwort wird nur geöffnet, wenn er
//! ein Anzeige-Format hat und im Vorhaben liegt.
use std::fs;
use std::path::{MAIN_SEPARATOR_STR, Path, PathBuf};

use crate::changes::{ChangesInput, sources};
use crate::error::CommandError;
use crate::worktrees::SessionRepository;

/// Endungen, die per Klick geöffnet werden. Gespiegelt in `src/lib/fileLinks.ts` (nur Darstellung).
/// Nie etwas, dessen Standardprogramm es ausführt (`cmd`, `bat`, `exe`, `ps1`, `lnk` …).
pub const OPENABLE_EXTENSIONS: &[&str] = &[
    "html", "htm", "pdf", "svg", "png", "jpg", "jpeg", "gif", "webp", "md", "txt",
];

const FILE_URL_PREFIX: &str = "file:///";
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

/// Bereinigt `raw` (trimmen, Präfix `file:///` entfernen, Endung `:<Zahl>` bzw. `:<Zahl>:<Zahl>` entfernen),
/// prüft die Endung, löst auf und prüft die Grenze. Liefert den zu öffnenden Pfad.
pub fn resolve(raw: &str, roots: &LinkRoots) -> Result<PathBuf, CommandError> {
    let cleaned = clean(raw);
    check_extension(Path::new(&cleaned))?;
    // Ein Doppelpunkt hinter dem Laufwerk adressiert unter Windows einen Datenstrom der Datei davor:
    // `x.exe:y.html` hätte die erlaubte Endung, gemeint ist aber die exe.
    if cleaned
        .char_indices()
        .any(|(index, character): (usize, char)| character == ':' && index != 1)
    {
        return Err(CommandError::FileNotAllowed(format!(
            "Ungültiger Pfad {cleaned}"
        )));
    }
    let path = Path::new(&cleaned);
    let candidates: Vec<PathBuf> = if path.is_absolute() {
        vec![path.to_path_buf()]
    } else {
        // Eine relative Basis löste sich gegen das Arbeitsverzeichnis der App auf, nicht gegen das Vorhaben.
        roots
            .relative_bases
            .iter()
            .filter(|base: &&PathBuf| base.is_absolute())
            .map(|base: &PathBuf| base.join(path))
            .collect()
    };
    let Some(found) = candidates
        .into_iter()
        .find(|candidate: &PathBuf| candidate.is_file())
    else {
        return Err(CommandError::FileNotFound(cleaned));
    };
    // Kanonisch geprüft, damit weder `..` noch ein symbolischer Link aus dem Vorhaben herausführt —
    // und ein Link `x.html` auf eine exe nicht durch die Endungsprüfung rutscht.
    let target = fs::canonicalize(&found)?;
    check_extension(&target)?;
    let is_inside = roots
        .allowed
        .iter()
        .filter_map(|root: &PathBuf| fs::canonicalize(root).ok())
        .any(|root: PathBuf| target.starts_with(&root));
    if !is_inside {
        return Err(CommandError::FileNotAllowed(OUTSIDE_PROJECT.to_owned()));
    }
    // Nicht die kanonische Form: deren Präfix `\\?\` verstehen nicht alle Standardprogramme.
    Ok(found)
}

fn clean(raw: &str) -> String {
    let trimmed = raw.trim();
    let without_scheme = match trimmed.get(..FILE_URL_PREFIX.len()) {
        Some(prefix) if prefix.eq_ignore_ascii_case(FILE_URL_PREFIX) => {
            &trimmed[FILE_URL_PREFIX.len()..]
        }
        _ => trimmed,
    };
    strip_line_number(without_scheme).replace('/', MAIN_SEPARATOR_STR)
}

/// `pfad:12` und `pfad:12:5` — Zeile und Spalte, wie Agenten sie anhängen.
fn strip_line_number(text: &str) -> &str {
    let mut rest = text;
    for _ in 0..2 {
        match rest.rsplit_once(':') {
            Some((head, tail))
                if !head.is_empty()
                    && !tail.is_empty()
                    && tail
                        .chars()
                        .all(|character: char| character.is_ascii_digit()) =>
            {
                rest = head;
            }
            _ => break,
        }
    }
    rest
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
