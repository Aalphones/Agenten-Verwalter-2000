//! Liest die `-z`-Ausgaben der Git-Aufrufe; reine Funktionen ohne Git.
use std::collections::{BTreeMap, HashMap};

use crate::changes::model::{ChangeKind, DiffLine, DiffLineKind, FileDiff, LineStat};

/// Git schreibt `-` statt Zahlen, wenn es eine Datei für binär hält.
const BINARY_MARK: &str = "-";

/// `--name-status -z`: abwechselnd Status und Pfad.
pub fn name_status(raw: &str) -> HashMap<String, ChangeKind> {
    let mut kinds: HashMap<String, ChangeKind> = HashMap::new();
    let mut pieces = raw.split('\0').filter(|piece: &&str| !piece.is_empty());
    while let (Some(status), Some(path)) = (pieces.next(), pieces.next()) {
        let kind = if status.starts_with('A') {
            ChangeKind::Added
        } else if status.starts_with('D') {
            ChangeKind::Deleted
        } else {
            ChangeKind::Modified
        };
        kinds.insert(path.to_owned(), kind);
    }
    kinds
}

/// `--numstat -z` ohne Umbenennungen: je Datei `hinzugefügt\tgelöscht\tpfad`.
/// Ergebnis: (Pfad, hinzugefügt, gelöscht, binär).
pub fn numstat(raw: &str) -> Vec<(String, u32, u32, bool)> {
    let mut stats: Vec<(String, u32, u32, bool)> = Vec::new();
    for piece in raw.split('\0').filter(|piece: &&str| !piece.is_empty()) {
        let fields: Vec<&str> = piece.splitn(3, '\t').collect();
        let [added, deleted, path] = fields[..] else {
            continue;
        };
        if added == BINARY_MARK && deleted == BINARY_MARK {
            stats.push((path.to_owned(), 0, 0, true));
            continue;
        }
        stats.push((
            path.to_owned(),
            added.parse::<u32>().unwrap_or(0),
            deleted.parse::<u32>().unwrap_or(0),
            false,
        ));
    }
    stats
}

/// Die Zahlen eines Blickwinkels je Pfad. Die Dateimenge kommt nur aus `--numstat`: eine Datei, die
/// angefasst, aber inhaltlich nicht geändert wurde, meldet `--name-status` als `M`, `--numstat`
/// lässt sie weg — sie wäre sonst ein Eintrag ohne Änderung.
pub fn scope_stats(name_status_raw: &str, numstat_raw: &str) -> BTreeMap<String, LineStat> {
    let kinds = name_status(name_status_raw);
    numstat(numstat_raw)
        .into_iter()
        .map(|(path, added, deleted, binary)| {
            let kind = kinds.get(&path).copied().unwrap_or(ChangeKind::Modified);
            let stat = LineStat {
                kind,
                added,
                deleted,
                binary,
            };
            (path, stat)
        })
        .collect()
}

/// Ein Diff zeigt höchstens so viele Zeilen, danach ist er gekürzt.
pub const MAX_DIFF_LINES: usize = 20_000;

/// Unified Diff (`-p`) einer Datei in Zeilen mit Nummern. Die Kopfzeilen vor dem ersten `@@`
/// (`diff --git`, `index`, `---`, `+++` …) entfallen.
pub fn unified(raw: &str) -> FileDiff {
    let mut diff = FileDiff {
        lines: Vec::new(),
        binary: false,
        truncated: false,
    };
    let mut in_hunk = false;
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;
    for piece in raw.split('\n') {
        let line = piece.strip_suffix('\r').unwrap_or(piece);
        if line.starts_with("Binary files ") {
            diff.binary = true;
            continue;
        }
        if line.starts_with("@@") {
            in_hunk = true;
            (old_line, new_line) = hunk_start(line);
            let hunk = DiffLine {
                kind: DiffLineKind::Hunk,
                old_line: None,
                new_line: None,
                text: line.to_owned(),
            };
            if !push_line(&mut diff, hunk) {
                break;
            }
            continue;
        }
        if !in_hunk {
            continue;
        }
        let mut characters = line.chars();
        let parsed = match characters.next() {
            Some(' ') => Some((DiffLineKind::Context, Some(old_line), Some(new_line))),
            Some('-') => Some((DiffLineKind::Deleted, Some(old_line), None)),
            Some('+') => Some((DiffLineKind::Added, None, Some(new_line))),
            _ => None,
        };
        let Some((kind, old, new)) = parsed else {
            continue;
        };
        if old.is_some() {
            old_line = old_line.saturating_add(1);
        }
        if new.is_some() {
            new_line = new_line.saturating_add(1);
        }
        let entry = DiffLine {
            kind,
            old_line: old,
            new_line: new,
            text: characters.as_str().to_owned(),
        };
        if !push_line(&mut diff, entry) {
            break;
        }
    }
    diff
}

/// Hängt eine Zeile an; ist die Höchstzahl erreicht, markiert es den Diff als gekürzt und meldet
/// `false`.
pub fn push_line(diff: &mut FileDiff, line: DiffLine) -> bool {
    if diff.lines.len() >= MAX_DIFF_LINES {
        diff.truncated = true;
        return false;
    }
    diff.lines.push(line);
    true
}

/// Erste alte und neue Zeilennummer aus `@@ -<alt>[,n] +<neu>[,n] @@`; unlesbar → 0.
fn hunk_start(header: &str) -> (u32, u32) {
    let mut old_start: u32 = 0;
    let mut new_start: u32 = 0;
    for field in header.split(' ').skip(1).take(2) {
        let digits: String = field
            .chars()
            .skip(1)
            .take_while(|character: &char| character.is_ascii_digit())
            .collect();
        let number = digits.parse::<u32>().unwrap_or(0);
        if field.starts_with('-') {
            old_start = number;
        } else if field.starts_with('+') {
            new_start = number;
        }
    }
    (old_start, new_start)
}

/// NUL-getrennte Pfadliste.
pub fn paths(raw: &str) -> Vec<String> {
    raw.split('\0')
        .filter(|piece: &&str| !piece.is_empty())
        .map(str::to_owned)
        .collect()
}
