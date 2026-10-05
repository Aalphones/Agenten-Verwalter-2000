//! Pfadgrenze der Datei-Werkzeuge: Arbeitsordner und `--add-dir`-Ordner zum Schreiben, die
//! Ticket-Worktrees aus `--allowedTools` ebenso, `~/.claude` nur zum Lesen (Skills, Anweisungen).
use std::path::{Component, Path, PathBuf};

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};

use super::home_dir;

const CLAUDE_DIR: &str = ".claude";
/// Regeln, deren Muster einen Ticket-Worktree freigeben (`worktrees::permission_rules`).
const PATTERN_RULE_PREFIXES: [&str; 2] = ["Edit(", "Read("];
const RULE_SUFFIX: char = ')';
/// So beginnt ein absoluter Pfad in einer Regel der Claude-Kommandozeile: `//c/Users/…`.
const RULE_ABSOLUTE_PREFIX: &str = "//";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Access {
    Write,
    ReadOnly,
    Outside,
}

pub struct Roots {
    writable: Vec<PathBuf>,
    readonly: Vec<PathBuf>,
    ticket_patterns: GlobSet,
}

impl Roots {
    pub fn from_args(cwd: &Path, add_dirs: &[PathBuf], allowed_rules: &[String]) -> Roots {
        let mut writable: Vec<PathBuf> = vec![resolve(cwd, &cwd.to_string_lossy())];
        writable.extend(
            add_dirs
                .iter()
                .map(|dir: &PathBuf| resolve(cwd, &dir.to_string_lossy())),
        );
        let readonly: Vec<PathBuf> = home_dir()
            .map(|home: PathBuf| home.join(CLAUDE_DIR))
            .into_iter()
            .collect();
        Roots {
            writable,
            readonly,
            ticket_patterns: ticket_patterns(allowed_rules),
        }
    }

    pub fn access(&self, path: &Path) -> Access {
        let is_writable = self
            .writable
            .iter()
            .any(|root: &PathBuf| is_within(path, root))
            || self.matches_ticket_pattern(path);
        if is_writable {
            return Access::Write;
        }
        if self
            .readonly
            .iter()
            .any(|root: &PathBuf| is_within(path, root))
        {
            return Access::ReadOnly;
        }
        Access::Outside
    }

    /// Die Muster enden auf `/**` und treffen damit nur, was unter dem Worktree liegt — der
    /// Worktree-Ordner selbst (z. B. als Startpfad für Glob) zählt über ein gedachtes Kind mit.
    fn matches_ticket_pattern(&self, path: &Path) -> bool {
        let slashed = slashed(path);
        self.ticket_patterns.is_match(&slashed)
            || self
                .ticket_patterns
                .is_match(format!("{}/x", slashed.trim_end_matches('/')))
    }
}

/// Relative Pfade gegen `cwd`; `/` und `\` gleichwertig; `.` und `..` rein lexikalisch — ohne
/// `canonicalize`, das an noch nicht existierenden Dateien scheitert und `\\?\`-Pfade liefert.
pub fn resolve(cwd: &Path, raw: &str) -> PathBuf {
    let raw_path = Path::new(raw.trim());
    let joined = if raw_path.is_absolute() {
        raw_path.to_path_buf()
    } else {
        cwd.join(raw_path)
    };
    let mut resolved = PathBuf::new();
    for component in joined.components() {
        match component {
            Component::CurDir => {}
            // Über die Wurzel hinaus gibt es nichts; `pop` lässt sie dann stehen.
            Component::ParentDir => {
                resolved.pop();
            }
            other => resolved.push(other.as_os_str()),
        }
    }
    resolved
}

/// Ordnergrenze beachtet: `C:\repo2` liegt nicht in `C:\repo`. Ohne Groß-/Kleinschreibung (Windows).
fn is_within(path: &Path, root: &Path) -> bool {
    let path = slashed(path).to_lowercase();
    let root = slashed(root).to_lowercase();
    let root = root.trim_end_matches('/');
    path == root || path.starts_with(&format!("{root}/"))
}

fn slashed(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn ticket_patterns(allowed_rules: &[String]) -> GlobSet {
    let mut builder = GlobSetBuilder::new();
    for rule in allowed_rules {
        let Some(pattern) = rule_pattern(rule) else {
            continue;
        };
        match GlobBuilder::new(&pattern)
            .case_insensitive(true)
            .literal_separator(true)
            .build()
        {
            Ok(glob) => {
                builder.add(glob);
            }
            Err(error) => eprintln!("Regel nicht lesbar, überlesen: {rule} ({error})"),
        }
    }
    builder.build().unwrap_or_else(|error: globset::Error| {
        eprintln!("Worktree-Regeln nicht nutzbar: {error}");
        GlobSet::empty()
    })
}

/// `Edit(//c/Users/x/repo-wt-*/**)` → `C:/Users/x/repo-wt-*/**`; andere Regeln → `None`.
fn rule_pattern(rule: &str) -> Option<String> {
    let inner = PATTERN_RULE_PREFIXES
        .iter()
        .find_map(|prefix: &&str| rule.strip_prefix(prefix))?
        .strip_suffix(RULE_SUFFIX)?;
    let Some(absolute) = inner.strip_prefix(RULE_ABSOLUTE_PREFIX) else {
        return Some(inner.to_owned());
    };
    match absolute.split_once('/') {
        Some((drive, rest))
            if drive.len() == 1
                && drive
                    .chars()
                    .all(|letter: char| letter.is_ascii_alphabetic()) =>
        {
            Some(format!("{}:/{rest}", drive.to_ascii_uppercase()))
        }
        _ => Some(format!("/{absolute}")),
    }
}
