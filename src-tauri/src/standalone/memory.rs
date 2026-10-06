//! Anweisungsdateien des Benutzers und der Projekte (`CLAUDE.md`) samt `@`-Einbindungen — in der
//! Reihenfolge, in der Claude Code sie dem Modell zeigt.
//!
//! Ordner unter `~\.claude` können Verknüpfungen (Junctions) sein; `fs::read_to_string` folgt ihnen.
//! Das ist gewollt, aber nirgends läuft ein Verzeichnislauf über sie.
use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use super::paths;
use super::settings::CLAUDE_DIR;

const USER_FILE: &str = "CLAUDE.md";
const PROJECT_FILES: [&str; 3] = ["CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md"];
const INCLUDE_PREFIX: char = '@';
const RELATIVE_STARTS: [&str; 2] = ["./", "../"];
const HOME_START: &str = "~/";
const FENCE: &str = "```";
const MAX_INCLUDE_DEPTH: usize = 5;
const BYTE_ORDER_MARK: char = '\u{feff}';
/// Satzzeichen, die hinter einem eingebundenen Pfad stehen können, ohne zu ihm zu gehören.
const TRAILING_PUNCTUATION: [char; 3] = [',', ';', ')'];

/// Pfad und Inhalt jeder Datei: die des Benutzers zuerst, dann je Arbeitsordner und `--add-dir`;
/// eine eingebundene Datei folgt direkt auf die einbindende. Nur vorhandene Dateien; jede Datei
/// (ohne Groß-/Kleinschreibung) höchstens einmal.
pub fn collect(home: &Path, cwd: &Path, add_dirs: &[PathBuf]) -> Vec<(PathBuf, String)> {
    let mut candidates: Vec<PathBuf> = vec![home.join(CLAUDE_DIR).join(USER_FILE)];
    for root in std::iter::once(cwd).chain(add_dirs.iter().map(PathBuf::as_path)) {
        candidates.extend(PROJECT_FILES.iter().map(|file: &&str| root.join(file)));
    }
    let mut collector = Collector {
        home,
        seen: HashSet::new(),
        files: Vec::new(),
    };
    for path in candidates {
        collector.add(&path, 0, false);
    }
    collector.files
}

struct Collector<'a> {
    home: &'a Path,
    seen: HashSet<String>,
    files: Vec<(PathBuf, String)>,
}

impl Collector<'_> {
    /// `is_include`: eine fehlende Datei ist dann ein Fehler im Protokoll, sonst nur nicht vorhanden.
    fn add(&mut self, path: &Path, depth: usize, is_include: bool) {
        // Gleiche Datei über verschiedene Schreibweisen (`.\`, `..\`, `/`) nur einmal.
        let path = paths::resolve(Path::new(""), &path.to_string_lossy());
        if !self.seen.insert(path.to_string_lossy().to_lowercase()) {
            return;
        }
        let text = match fs::read_to_string(&path) {
            Ok(text) => text.trim_start_matches(BYTE_ORDER_MARK).to_owned(),
            Err(error) if !is_include && error.kind() == ErrorKind::NotFound => return,
            Err(error) => {
                eprintln!("Anweisungsdatei {} nicht lesbar: {error}", path.display());
                return;
            }
        };
        let includes = if depth < MAX_INCLUDE_DEPTH {
            self.includes_of(&text, &path)
        } else {
            Vec::new()
        };
        self.files.push((path, text));
        for include in includes {
            self.add(&include, depth + 1, true);
        }
    }

    fn includes_of(&self, text: &str, file: &Path) -> Vec<PathBuf> {
        let folder = file.parent().unwrap_or(Path::new(""));
        let mut includes: Vec<PathBuf> = Vec::new();
        let mut is_fenced = false;
        for line in text.lines() {
            if line.trim_start().starts_with(FENCE) {
                is_fenced = !is_fenced;
                continue;
            }
            if is_fenced {
                continue;
            }
            for word in outside_inline_code(line).split_whitespace() {
                if let Some(path) = self.include_path(word, folder) {
                    includes.push(path);
                }
            }
        }
        includes
    }

    /// `@./x.md`, `@../x.md`, `@~/x.md` oder `@C:/x.md` — jedes andere Wort mit `@` (E-Mail,
    /// Benutzername) ist keine Einbindung.
    fn include_path(&self, word: &str, folder: &Path) -> Option<PathBuf> {
        let target = word
            .strip_prefix(INCLUDE_PREFIX)?
            .trim_end_matches(TRAILING_PUNCTUATION);
        if let Some(rest) = target.strip_prefix(HOME_START) {
            return Some(self.home.join(rest));
        }
        if RELATIVE_STARTS
            .iter()
            .any(|start: &&str| target.starts_with(start))
        {
            return Some(folder.join(target));
        }
        let mut characters = target.chars();
        let is_drive_path = characters
            .next()
            .is_some_and(|letter: char| letter.is_ascii_alphabetic())
            && characters.next() == Some(':');
        is_drive_path.then(|| PathBuf::from(target))
    }
}

/// Die Zeile ohne die Stücke zwischen Backticks — dort steht Code, keine Einbindung.
fn outside_inline_code(line: &str) -> String {
    line.split('`').step_by(2).collect::<Vec<&str>>().join(" ")
}
