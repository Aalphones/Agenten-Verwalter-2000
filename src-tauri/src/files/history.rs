//! Verlauf des Vorhabens: welche Session welche Commits gemacht hat, und der Diff eines einzelnen
//! eigenen Commits (ADR 067). Was ein Commit geändert hat, ändert sich nie — der Core merkt es sich.
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};

use crate::changes::attribution::Ownership;
use crate::changes::model::{FileDiff, LineStat};
use crate::changes::sources::{self, Source};
use crate::changes::{self, ChangesInput, parse};
use crate::error::CommandError;
use crate::files::model::{HistoryCommit, HistoryFile, HistorySession, ProjectHistory};
use crate::git;

/// Der Hash des leeren Baums: der „Elternteil“ eines Commits ohne Elternteil.
const EMPTY_TREE: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
// Darüber wird der Speicher geleert statt einzeln verdrängt: ein Neuaufbau kostet nur Git-Aufrufe.
const MAX_CACHED_COMMITS: usize = 50_000;
const SHORT_ID_CHARS: usize = 7;
const NOT_OWN_COMMIT: &str = "Kein eigener Commit des Vorhabens";
/// Trennt in `git log --format=%x01%H` die Commits voneinander.
const COMMIT_MARK: char = '\u{1}';

/// Kopf und Dateien eines Commits.
type CommitDetail = (Head, Vec<HistoryFile>);

static COMMITS: OnceLock<Mutex<HashMap<String, CommitDetail>>> = OnceLock::new();

/// Eine Session des Vorhabens, so wie der Verlauf sie braucht.
#[derive(Debug, Clone)]
pub struct SessionRef {
    pub id: String,
    pub number: u32,
    pub name: String,
    pub created_at: f64,
}

/// Was `SessionRegistry::history_input` liefert: Eingabe der Changes, Sessions, Paare
/// `(Session, Commit)`.
pub type HistoryInput = (ChangesInput, Vec<SessionRef>, Vec<(String, String)>);

#[derive(Debug, Clone)]
struct Head {
    parent: Option<String>,
    /// Committer-Zeit in Sekunden.
    time: f64,
    subject: String,
}

/// Ein Repository des Vorhabens: alle Einträge einer Gruppe, gelesen im ersten fehlerfreien.
struct Group<'a> {
    group: String,
    group_name: String,
    read: &'a Source,
    entries: Vec<&'a Source>,
}

/// Der Verlauf des ganzen Vorhabens, je Session mit ihren Commits und Dateien.
pub fn history(
    input: &ChangesInput,
    sessions: &[SessionRef],
    pairs: &[(String, String)],
) -> ProjectHistory {
    let all_sources = sources::sources(input);
    let groups = groups_of(&all_sources);
    let (assigned, missing) = assign_commits(&groups, pairs);
    let mut commits: HashMap<String, HistoryCommit> = HashMap::new();
    for (index, group) in groups.iter().enumerate() {
        let ids: Vec<String> = assigned
            .iter()
            .filter(|(_, group_index): &(&String, &usize)| **group_index == index)
            .map(|(id, _): (&String, &usize)| id.clone())
            .collect();
        for commit in read_group(group, &ids, &input.own) {
            commits.insert(commit.id.clone(), commit);
        }
    }
    ProjectHistory {
        sessions: sessions_of(sessions, pairs, &mut commits),
        missing,
    }
}

fn groups_of(all_sources: &[Source]) -> Vec<Group<'_>> {
    let mut groups: Vec<Group<'_>> = Vec::new();
    for source in all_sources {
        let position = groups
            .iter()
            .position(|group: &Group<'_>| group.group == source.group);
        match position {
            Some(position) => {
                let group = &mut groups[position];
                group.entries.push(source);
                if group.read.error.is_some() && source.error.is_none() {
                    group.read = source;
                }
            }
            None => groups.push(Group {
                group: source.group.clone(),
                group_name: source.group_name.clone(),
                read: source,
                entries: vec![source],
            }),
        }
    }
    groups
        .into_iter()
        .filter(|group: &Group<'_>| group.read.error.is_none())
        .collect()
}

/// Jeder Commit gehört der ersten Gruppe, in deren Objektspeicher er liegt; was keine kennt, zählt.
fn assign_commits(
    groups: &[Group<'_>],
    pairs: &[(String, String)],
) -> (HashMap<String, usize>, u32) {
    let mut open: Vec<String> = Vec::new();
    let mut seen: HashSet<&str> = HashSet::new();
    for (_, commit) in pairs {
        if seen.insert(commit.as_str()) {
            open.push(commit.clone());
        }
    }
    let mut assigned: HashMap<String, usize> = HashMap::new();
    for (index, group) in groups.iter().enumerate() {
        if open.is_empty() {
            break;
        }
        // Scheitert Git in einer Gruppe, kennt sie für die Ansicht keinen dieser Commits.
        let known = git::existing_commits(&group.read.dir, &open).unwrap_or_default();
        open.retain(|id: &String| {
            let is_known = known.contains(id);
            if is_known {
                assigned.insert(id.clone(), index);
            }
            !is_known
        });
    }
    (assigned, u32::try_from(open.len()).unwrap_or(u32::MAX))
}

/// Die Commits `ids` einer Gruppe mit Kopf, Dateien, Eintrag und Lose-Kennzeichen.
fn read_group(group: &Group<'_>, ids: &[String], own: &Ownership) -> Vec<HistoryCommit> {
    if ids.is_empty() {
        return Vec::new();
    }
    let details = commit_details(&group.read.dir, ids);
    let mut contained: HashMap<String, String> = HashMap::new();
    for entry in &group.entries {
        if entry.error.is_some() {
            continue;
        }
        // Scheitert ein Eintrag, enthält er für die Ansicht keinen Commit.
        let Ok(base) = changes::source_base(entry) else {
            continue;
        };
        let Ok(own_commits) = changes::own_commits(&entry.dir, &base, own) else {
            continue;
        };
        for commit in own_commits {
            contained
                .entry(commit.id)
                .or_insert_with(|| entry.key.clone());
        }
    }
    ids.iter()
        .filter_map(|id: &String| {
            let (head, files) = details.get(id)?;
            let entry_key = contained.get(id);
            Some(HistoryCommit {
                id: id.clone(),
                short_id: id.chars().take(SHORT_ID_CHARS).collect(),
                subject: head.subject.clone(),
                time: head.time,
                group: group.group.clone(),
                group_name: group.group_name.clone(),
                key: entry_key.map_or_else(|| group.read.key.clone(), String::clone),
                loose: entry_key.is_none(),
                files: files.clone(),
            })
        })
        .collect()
}

/// Kopf und Dateien je Commit: aus dem Speicher, die übrigen in drei Git-Aufrufen. Ein Commit, den
/// Git nicht lesen kann, fehlt im Ergebnis.
fn commit_details(dir: &Path, ids: &[String]) -> HashMap<String, CommitDetail> {
    let canonical: PathBuf = fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf());
    let prefix = format!("{}|", canonical.display());
    let mut details: HashMap<String, CommitDetail> = HashMap::new();
    let mut missing: Vec<String> = Vec::new();
    {
        let cache = commits_cache();
        for id in ids {
            match cache.get(&format!("{prefix}{id}")) {
                Some(cached) => {
                    details.insert(id.clone(), cached.clone());
                }
                None => missing.push(id.clone()),
            }
        }
    }
    if missing.is_empty() {
        return details;
    }
    // Die Sperre ist hier frei: Git läuft nie unter ihr.
    let Ok(fetched) = fetch_details(dir, &missing) else {
        return details;
    };
    let mut cache = commits_cache();
    if cache.len() + fetched.len() > MAX_CACHED_COMMITS {
        cache.clear();
    }
    for (id, entry) in fetched {
        cache.insert(format!("{prefix}{id}"), entry.clone());
        details.insert(id, entry);
    }
    details
}

fn fetch_details(
    dir: &Path,
    ids: &[String],
) -> Result<HashMap<String, CommitDetail>, CommandError> {
    let heads = parse_heads(&git::commit_heads(dir, ids)?);
    let name_status = split_by_commit(&git::commit_name_status(dir, ids)?);
    let numstat = split_by_commit(&git::commit_numstat(dir, ids)?);
    let mut details: HashMap<String, CommitDetail> = HashMap::new();
    for (id, head) in heads {
        let stats = parse::scope_stats(
            name_status.get(&id).map_or("", String::as_str),
            numstat.get(&id).map_or("", String::as_str),
        );
        let files: Vec<HistoryFile> = stats
            .into_iter()
            .map(|(path, stat): (String, LineStat)| HistoryFile {
                path,
                kind: stat.kind,
                added: stat.added,
                deleted: stat.deleted,
                binary: stat.binary,
            })
            .collect();
        details.insert(id, (head, files));
    }
    Ok(details)
}

/// `<ID>\t<Eltern>\t<Zeit>\t<Betreff>` je Zeile.
fn parse_heads(raw: &str) -> HashMap<String, Head> {
    raw.lines()
        .filter_map(|line: &str| {
            let mut fields = line.splitn(4, '\t');
            let id = fields.next()?;
            let parents = fields.next()?;
            let time = fields.next()?.parse::<f64>().ok()?;
            let subject = fields.next().unwrap_or("");
            let head = Head {
                parent: parents
                    .split(' ')
                    .next()
                    .filter(|first: &&str| !first.is_empty())
                    .map(str::to_owned),
                time,
                subject: subject.trim_end_matches('\r').to_owned(),
            };
            Some((id.to_owned(), head))
        })
        .collect()
}

/// Zerlegt `\x01<ID>\0\n<Einträge>` je Commit in `ID → Einträge`.
fn split_by_commit(raw: &str) -> HashMap<String, String> {
    raw.split(COMMIT_MARK)
        .filter_map(|block: &str| {
            let (id, rest) = block.split_once('\0')?;
            Some((id.to_owned(), rest.trim_start_matches('\n').to_owned()))
        })
        .collect()
}

/// Sessions mit mindestens einem lesbaren Commit, geordnet nach Nummer und Anlegezeit absteigend.
fn sessions_of(
    sessions: &[SessionRef],
    pairs: &[(String, String)],
    commits: &mut HashMap<String, HistoryCommit>,
) -> Vec<HistorySession> {
    let mut result: Vec<(f64, HistorySession)> = Vec::new();
    for session in sessions {
        let mut own: Vec<HistoryCommit> = pairs
            .iter()
            .filter(|(session_id, _): &&(String, String)| *session_id == session.id)
            .filter_map(|(_, commit): &(String, String)| commits.get(commit).cloned())
            .collect();
        if own.is_empty() {
            continue;
        }
        own.sort_by(|left: &HistoryCommit, right: &HistoryCommit| right.time.total_cmp(&left.time));
        result.push((
            session.created_at,
            HistorySession {
                session_id: session.id.clone(),
                number: session.number,
                name: session.name.clone(),
                commits: own,
            },
        ));
    }
    result.sort_by(
        |left: &(f64, HistorySession), right: &(f64, HistorySession)| {
            right
                .1
                .number
                .cmp(&left.1.number)
                .then(right.0.total_cmp(&left.0))
        },
    );
    result
        .into_iter()
        .map(|(_, session): (f64, HistorySession)| session)
        .collect()
}

/// Der Diff eines eigenen Commits an einer Datei gegen seinen ersten Elternteil, gelesen im Ordner
/// des Eintrags.
pub fn commit_diff(
    source: &Source,
    own: &Ownership,
    commit: &str,
    path: &str,
) -> Result<FileDiff, CommandError> {
    if !own.commits.contains(commit) {
        return Err(CommandError::Internal(NOT_OWN_COMMIT.to_owned()));
    }
    changes::validate_path(path)?;
    if let Some(error) = &source.error {
        return Err(CommandError::Io(error.clone()));
    }
    let dir = &source.dir;
    let ids = [commit.to_owned()];
    let heads = parse_heads(&git::commit_heads(dir, &ids)?);
    let head = heads
        .get(commit)
        .ok_or_else(|| CommandError::Internal(NOT_OWN_COMMIT.to_owned()))?;
    let parent = head.parent.as_deref().unwrap_or(EMPTY_TREE);
    let raw = git::diff_tree_patch(dir, parent, commit, path)?;
    let mut diff = parse::unified(&raw);
    if !diff.binary {
        diff.new_line_count = git::show_file(dir, commit, path, changes::MAX_UNTRACKED_BYTES)
            .filter(|content: &String| !changes::is_binary(content.as_bytes()))
            .map(|content: String| changes::line_count(&content));
    }
    Ok(diff)
}

fn commits_cache() -> MutexGuard<'static, HashMap<String, CommitDetail>> {
    COMMITS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}
