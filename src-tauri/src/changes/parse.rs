//! Liest die `-z`-Ausgaben der Git-Aufrufe; reine Funktionen ohne Git.
use std::collections::{BTreeMap, HashMap};

use crate::changes::model::{ChangeKind, LineStat};

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

/// NUL-getrennte Pfadliste.
pub fn paths(raw: &str) -> Vec<String> {
    raw.split('\0')
        .filter(|piece: &&str| !piece.is_empty())
        .map(str::to_owned)
        .collect()
}
