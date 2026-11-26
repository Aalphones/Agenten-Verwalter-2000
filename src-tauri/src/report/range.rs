//! Der Commit-Bereich einer Phase je Repository-Eintrag und was der Bericht daraus liest: Zahlen je
//! Datei, Patch und Endstand. Git ruft im Bericht nur dieses Modul auf.
//!
//! `session_commits` kennt kein Repository, und alle Arbeitsbäume eines Repositorys teilen sich den
//! Objektspeicher. Deshalb gehört ein Commit je Repository zu genau einem Eintrag: dem ersten, dessen
//! `HEAD` ihn enthält — zuerst die Einträge, die Notizen der Phase nennen, dann der Checkout selbst.
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::thread::{self, ScopedJoinHandle};

use crate::changes::attribution::normalize_path;
use crate::changes::sources::Source;
use crate::changes::{self, parse};
use crate::error::CommandError;
use crate::filesystem::native_path;
use crate::git;
use crate::report::model::ReportPhaseState;

/// Der leere Baum von Git: Basis eines Bereichs, dessen ältester Commit keinen Vorgänger hat.
const EMPTY_TREE: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const HEAD: &str = "HEAD";
/// So beginnt im Patch die Kopfzeile jeder Datei.
const PATCH_HEADER: &str = "diff --git ";
const MS_PER_SECOND: f64 = 1000.0;

/// Ein Repository-Eintrag der Changes, wie der Bericht ihn braucht.
#[derive(Debug, Clone)]
pub struct Checkout {
    /// Wie `Source.key`.
    pub key: String,
    /// Einträge mit derselben Gruppe sind Arbeitsbäume desselben Repositorys.
    pub group: String,
    pub dir: PathBuf,
    pub is_main: bool,
}

/// Die lesbaren Einträge aus `changes::sources`.
pub fn checkouts(sources: &[Source]) -> Vec<Checkout> {
    sources
        .iter()
        .filter(|source: &&Source| source.error.is_none() && source.dir.is_dir())
        .map(|source: &Source| Checkout {
            key: source.key.clone(),
            group: source.group.clone(),
            dir: source.dir.clone(),
            is_main: source.is_main,
        })
        .collect()
}

/// Die Köpfe der Commits eines Repositorys je ID.
type Heads = HashMap<String, CommitHead>;

#[derive(Debug, Clone)]
struct CommitHead {
    parents: Vec<String>,
    /// Zeit des Committers in Sekunden.
    time: i64,
}

/// Je Repository (Gruppe) die Commits der Umsetzung, die in seinem Objektspeicher liegen. Ein Commit,
/// der dort fehlt, liegt nicht in diesem Repository.
#[derive(Default)]
pub struct CommitCatalog {
    groups: HashMap<String, Heads>,
}

/// Liest die Köpfe aller Commits einmal je Repository, die Repositories nebeneinander. Kann Git
/// eines nicht lesen, hat es keine Commits.
pub fn commit_catalog(checkouts: &[Checkout], commit_ids: &[String]) -> CommitCatalog {
    let mut seen: HashSet<&str> = HashSet::new();
    let firsts: Vec<&Checkout> = checkouts
        .iter()
        .filter(|checkout: &&Checkout| seen.insert(checkout.group.as_str()))
        .collect();
    let groups = thread::scope(|scope| {
        let handles: Vec<(&Checkout, ScopedJoinHandle<'_, Result<Heads, CommandError>>)> = firsts
            .into_iter()
            .map(|checkout: &Checkout| {
                (
                    checkout,
                    scope.spawn(|| heads_in(&checkout.dir, commit_ids)),
                )
            })
            .collect();
        handles
            .into_iter()
            .filter_map(|(checkout, handle)| match handle.join() {
                Ok(Ok(heads)) => Some((checkout.group.clone(), heads)),
                Ok(Err(error)) => {
                    eprintln!(
                        "Bericht: Commits in {} nicht gelesen: {error}",
                        checkout.dir.display()
                    );
                    None
                }
                Err(_) => None,
            })
            .collect()
    });
    CommitCatalog { groups }
}

fn heads_in(dir: &Path, commit_ids: &[String]) -> Result<Heads, CommandError> {
    let existing = git::existing_commits(dir, commit_ids)?;
    let ids: Vec<String> = commit_ids
        .iter()
        .filter(|id: &&String| existing.contains(*id))
        .cloned()
        .collect();
    Ok(git::commit_heads(dir, &ids)?
        .lines()
        .filter_map(|line: &str| {
            let mut fields = line.split('\t');
            let id = fields.next()?.to_owned();
            let parents = fields
                .next()?
                .split_whitespace()
                .map(str::to_owned)
                .collect();
            let time = fields.next()?.parse::<i64>().ok()?;
            Some((id, CommitHead { parents, time }))
        })
        .collect())
}

/// Was die Bereiche einer Phase bestimmt.
pub struct PhaseSpan<'a> {
    /// Die Commits der Sessions aller Stationen der Phase.
    pub commits: HashSet<String>,
    /// Beginn der ersten gestarteten Station, ms seit der Epoche.
    pub started_at: Option<f64>,
    pub state: ReportPhaseState,
    /// Ohne Agenten-Station (reine Abnahme) gehört das Arbeitsverzeichnis nie zur Phase.
    pub has_agents: bool,
    /// Keine spätere Phase hat begonnen: Uncommittetes gehört noch zu dieser.
    pub is_latest: bool,
    /// Die Einträge, die Notizen der Phase nennen.
    pub preferred: HashSet<&'a str>,
}

/// Eine Datei eines Bereichs mit ihren Zeilenzahlen.
#[derive(Debug, Clone)]
pub struct FileStat {
    /// Relativ zum Eintrag, mit `/`.
    pub path: String,
    pub added: u32,
    pub removed: u32,
    /// Git kennt die Datei noch nicht; es gibt für sie keinen Patch.
    pub untracked: bool,
}

/// Der Bereich einer Phase in einem Repository-Eintrag.
#[derive(Debug, Clone)]
pub struct RepoRange {
    pub repository_key: String,
    pub group: String,
    pub folder: PathBuf,
    pub from: String,
    /// `None` = das Arbeitsverzeichnis.
    pub to: Option<String>,
    /// In Commit-Reihenfolge, ungekürzt.
    pub commits: Vec<String>,
    pub files: Vec<FileStat>,
}

impl RepoRange {
    pub fn file(&self, path: &str) -> Option<&FileStat> {
        self.files.iter().find(|file: &&FileStat| file.path == path)
    }
}

/// Die Bereiche einer Phase. Läuft sie noch, endet jeder am Arbeitsverzeichnis. Ist sie ohne einen
/// Commit fertig und hat noch keine spätere begonnen, zählt nur das Uncommittete — ab dem Start
/// sähe man auch fremde Commits von danach. `touched` sind die von den Sessions geschriebenen
/// Dateien: nur unter ihnen zählen Dateien, die Git noch nicht kennt.
pub fn phase_ranges(
    checkouts: &[Checkout],
    catalog: &CommitCatalog,
    span: &PhaseSpan<'_>,
    touched: &HashMap<String, f64>,
) -> Vec<RepoRange> {
    if span.state == ReportPhaseState::NotStarted {
        return Vec::new();
    }
    let has_commits = catalog.groups.values().any(|heads| {
        span.commits
            .iter()
            .any(|id: &String| heads.contains_key(id))
    });
    let to_working_tree = span.has_agents
        && (span.state == ReportPhaseState::Running || (!has_commits && span.is_latest));
    if !to_working_tree && !has_commits {
        return Vec::new();
    }
    let no_heads = Heads::new();
    let mut seen: HashSet<&str> = HashSet::new();
    checkouts
        .iter()
        .filter(|checkout: &&Checkout| seen.insert(checkout.group.as_str()))
        .flat_map(|first: &Checkout| {
            let heads = catalog.groups.get(&first.group).unwrap_or(&no_heads);
            let mut members: Vec<&Checkout> = checkouts
                .iter()
                .filter(|checkout: &&Checkout| checkout.group == first.group)
                .collect();
            members.sort_by_key(|member: &&Checkout| {
                (
                    !span.preferred.contains(member.key.as_str()),
                    !member.is_main,
                )
            });
            repository_ranges(&members, heads, span, to_working_tree, touched)
        })
        .collect()
}

/// Die Bereiche eines Repositorys; `members` sind seine Arbeitsbäume, der bevorzugte zuerst.
fn repository_ranges(
    members: &[&Checkout],
    heads: &Heads,
    span: &PhaseSpan<'_>,
    to_working_tree: bool,
    touched: &HashMap<String, f64>,
) -> Vec<RepoRange> {
    let Some(main) = members
        .iter()
        .find(|member: &&&Checkout| member.is_main)
        .or_else(|| members.first())
    else {
        return Vec::new();
    };
    let commits = commit_order(
        heads,
        span.commits
            .iter()
            .filter(|id: &&String| heads.contains_key(*id))
            .cloned()
            .collect(),
    );
    let (assigned, leftover) = assign(members, commits);
    let mut ranges: Vec<RepoRange> = Vec::new();
    for (member, own) in &assigned {
        if to_working_tree {
            ranges.extend(range_of(member, heads, own.clone(), None, touched));
            continue;
        }
        for (tip, chain) in chains(&member.dir, own) {
            ranges.extend(range_of(member, heads, chain, Some(tip), touched));
        }
    }
    // Was in keinem Arbeitsbaum steht: auf einem anderen Branch zählt es mit. Sonst ersetzt
    // (amend, rebase) — gezeigt nur, wenn das Repository sonst nichts hätte.
    let on_a_ref: Vec<String> = leftover
        .iter()
        .filter(|id: &&String| git::is_on_any_ref(&main.dir, id).unwrap_or(false))
        .cloned()
        .collect();
    let rest = if on_a_ref.is_empty() && assigned.is_empty() {
        leftover
    } else {
        on_a_ref
    };
    for (tip, chain) in chains(&main.dir, &rest) {
        ranges.extend(range_of(main, heads, chain, Some(tip), touched));
    }
    if to_working_tree {
        for member in members {
            let has_commits_here = assigned
                .iter()
                .any(|(owner, _): &(&Checkout, Vec<String>)| owner.key == member.key);
            if has_commits_here {
                continue;
            }
            let started_at = span
                .started_at
                .filter(|_: &f64| span.state == ReportPhaseState::Running);
            if let Some(start) = start_commit(&member.dir, started_at) {
                ranges.extend(open_range(member, start, touched));
            }
        }
    }
    ranges
}

/// Verteilt die Commits auf die Arbeitsbäume in der Reihenfolge von `members`; der Rest steht in
/// keinem `HEAD`.
fn assign<'a>(
    members: &[&'a Checkout],
    commits: Vec<String>,
) -> (Vec<(&'a Checkout, Vec<String>)>, Vec<String>) {
    let mut remaining = commits;
    let mut assigned: Vec<(&Checkout, Vec<String>)> = Vec::new();
    for member in members {
        if remaining.is_empty() {
            break;
        }
        let Ok(outside) = git::commits_outside(&member.dir, &remaining, HEAD) else {
            continue;
        };
        let (rest, own): (Vec<String>, Vec<String>) = remaining
            .into_iter()
            .partition(|id: &String| outside.contains(id));
        remaining = rest;
        if !own.is_empty() {
            assigned.push((member, own));
        }
    }
    (assigned, remaining)
}

/// Je Spitze die Commits, die sie enthält; meist eine. Mehrere gibt es nur, wenn die Phase auf
/// Zweigen gearbeitet hat, von denen keiner den anderen enthält. `commits` in Commit-Reihenfolge.
fn chains(dir: &Path, commits: &[String]) -> Vec<(String, Vec<String>)> {
    let Some(newest) = commits.last() else {
        return Vec::new();
    };
    if commits.len() == 1 {
        return vec![(newest.clone(), commits.to_vec())];
    }
    let Ok(tips) = git::independent_commits(dir, commits) else {
        return vec![(newest.clone(), commits.to_vec())];
    };
    if tips.len() <= 1 {
        let tip = tips.into_iter().next().unwrap_or_else(|| newest.clone());
        return vec![(tip, commits.to_vec())];
    }
    let mut remaining: Vec<String> = commits.to_vec();
    let mut chains: Vec<(String, Vec<String>)> = Vec::new();
    for tip in commits.iter().filter(|id: &&String| tips.contains(*id)) {
        let Ok(outside) = git::commits_outside(dir, &remaining, tip) else {
            continue;
        };
        let (rest, chain): (Vec<String>, Vec<String>) = remaining
            .into_iter()
            .partition(|id: &String| outside.contains(id));
        remaining = rest;
        chains.push((tip.clone(), chain));
    }
    chains
}

/// Älteste zuerst: nach der Zeit des Committers, ein Vorgänger aber immer vor seinem Nachfolger.
fn commit_order(heads: &Heads, mut commits: Vec<String>) -> Vec<String> {
    commits.sort_by_key(|id: &String| {
        (
            heads.get(id).map_or(0, |head: &CommitHead| head.time),
            id.clone(),
        )
    });
    let mut ordered: Vec<String> = Vec::with_capacity(commits.len());
    while !commits.is_empty() {
        let next = commits
            .iter()
            .position(|id: &String| {
                heads.get(id).is_none_or(|head: &CommitHead| {
                    !head
                        .parents
                        .iter()
                        .any(|parent: &String| commits.contains(parent))
                })
            })
            .unwrap_or(0);
        ordered.push(commits.remove(next));
    }
    ordered
}

/// Der Bereich vom Vorgänger des ältesten Commits bis `to`; `None` ohne Commit.
fn range_of(
    checkout: &Checkout,
    heads: &Heads,
    commits: Vec<String>,
    to: Option<String>,
    touched: &HashMap<String, f64>,
) -> Option<RepoRange> {
    let oldest = heads.get(commits.first()?)?;
    let from = oldest
        .parents
        .first()
        .cloned()
        .unwrap_or_else(|| EMPTY_TREE.to_owned());
    let mut range = empty_range(checkout, from, to);
    range.commits = commits;
    range.files = read_stats(&range, touched);
    Some(range)
}

/// Ein Eintrag ohne eigene Commits: nur mit Änderungen im Arbeitsverzeichnis.
fn open_range(
    checkout: &Checkout,
    from: String,
    touched: &HashMap<String, f64>,
) -> Option<RepoRange> {
    let mut range = empty_range(checkout, from, None);
    range.files = read_stats(&range, touched);
    (!range.files.is_empty()).then_some(range)
}

fn empty_range(checkout: &Checkout, from: String, to: Option<String>) -> RepoRange {
    RepoRange {
        repository_key: checkout.key.clone(),
        group: checkout.group.clone(),
        folder: checkout.dir.clone(),
        from,
        to,
        commits: Vec::new(),
        files: Vec::new(),
    }
}

/// `HEAD` beim Start der ersten Station, ersatzweise `HEAD`.
fn start_commit(dir: &Path, started_at: Option<f64>) -> Option<String> {
    started_at
        .and_then(|started_at: f64| {
            // Ganze Sekunden; der Bruchteil zählt für Git nicht.
            let seconds = (started_at / MS_PER_SECOND) as i64;
            git::commit_before(dir, seconds).ok().flatten()
        })
        .or_else(|| git::head_commit(dir).ok())
}

/// Die Zahlen je Datei; kann Git den Bereich nicht lesen, hat er keine.
fn read_stats(range: &RepoRange, touched: &HashMap<String, f64>) -> Vec<FileStat> {
    match numstat(range, touched) {
        Ok(files) => files,
        Err(error) => {
            eprintln!(
                "Bericht: Bereich in {} nicht gelesen: {error}",
                range.folder.display()
            );
            Vec::new()
        }
    }
}

/// `--numstat` des Bereichs; am Arbeitsverzeichnis kommen die eigenen Dateien dazu, die Git noch
/// nicht kennt.
pub fn numstat(
    range: &RepoRange,
    touched: &HashMap<String, f64>,
) -> Result<Vec<FileStat>, CommandError> {
    let raw = match &range.to {
        Some(to) => git::diff_tree_numstat(&range.folder, &range.from, to)?,
        None => git::diff_index_numstat(&range.folder, &range.from)?,
    };
    let mut files: Vec<FileStat> = parse::numstat(&raw)
        .into_iter()
        .map(|(path, added, removed, _)| FileStat {
            path,
            added,
            removed,
            untracked: false,
        })
        .collect();
    if range.to.is_none() {
        for path in parse::paths(&git::untracked_files(&range.folder)?) {
            let full = range.folder.join(native_path(&path));
            if !touched.contains_key(&normalize_path(&full.to_string_lossy())) {
                continue;
            }
            let added = working_text(&range.folder, &path)
                .map_or(0, |text: String| changes::line_count(&text));
            files.push(FileStat {
                path,
                added,
                removed: 0,
                untracked: true,
            });
        }
    }
    Ok(files)
}

/// Unified Diffs der Dateien im Bereich mit drei Zeilen Umgebung, in einem Git-Aufruf. Für eine
/// Datei, die Git noch nicht kennt, besteht er aus ihrem ganzen Inhalt als neuen Zeilen. Dateien,
/// die der Bereich nicht ändert, fehlen.
pub fn file_patches(range: &RepoRange, paths: &[&str]) -> HashMap<String, String> {
    let mut patches: HashMap<String, String> = HashMap::new();
    let mut tracked: Vec<&str> = Vec::new();
    for path in paths {
        match range.file(path) {
            Some(file) if file.untracked => {
                patches.insert((*path).to_owned(), added_patch(&range.folder, path));
            }
            Some(_) => tracked.push(path),
            None => {}
        }
    }
    if tracked.is_empty() {
        return patches;
    }
    match git::diff_patches(&range.folder, &range.from, range.to.as_deref(), &tracked) {
        Ok(output) => patches.extend(split_patches(&output, &tracked)),
        Err(error) => eprintln!(
            "Bericht: Patches in {} nicht gelesen: {error}",
            range.folder.display()
        ),
    }
    patches
}

fn added_patch(folder: &Path, path: &str) -> String {
    let text = working_text(folder, path).unwrap_or_default();
    let mut patch = format!("@@ -0,0 +1,{} @@\n", text.lines().count());
    for line in text.lines() {
        patch.push('+');
        patch.push_str(line);
        patch.push('\n');
    }
    patch
}

/// Zerlegt die Ausgabe für mehrere Pfade an den Kopfzeilen `diff --git a/<p> b/<p>`; ohne
/// Umbenennungen steht dort zweimal derselbe Pfad.
fn split_patches(output: &str, paths: &[&str]) -> HashMap<String, String> {
    let headers: HashMap<String, &str> = paths
        .iter()
        .map(|path: &&str| (format!("{PATCH_HEADER}a/{path} b/{path}"), *path))
        .collect();
    let mut patches: HashMap<String, String> = HashMap::new();
    let mut current: Option<&str> = None;
    // `split_inclusive` hält die Zeilenenden: ein `\r` gehört zum Inhalt.
    for line in output.split_inclusive('\n') {
        if line.starts_with(PATCH_HEADER) {
            current = headers.get(line.trim_end_matches('\n')).copied();
        }
        if let Some(path) = current {
            patches.entry(path.to_owned()).or_default().push_str(line);
        }
    }
    patches
}

/// Die Dateien im Endstand des Bereichs, in einem Git-Aufruf; binäre, über 8 MB große, gelöschte
/// und nicht lesbare fehlen.
pub fn end_texts(range: &RepoRange, paths: &[&str]) -> HashMap<String, String> {
    let Some(to) = &range.to else {
        return paths
            .iter()
            .filter_map(|path: &&str| {
                Some(((*path).to_owned(), working_text(&range.folder, path)?))
            })
            .collect();
    };
    let objects: Vec<String> = paths
        .iter()
        .map(|path: &&str| format!("{to}:{path}"))
        .collect();
    let mut found = git::show_files(&range.folder, &objects, changes::MAX_UNTRACKED_BYTES)
        .unwrap_or_else(|error: CommandError| {
            eprintln!(
                "Bericht: Endstand in {} nicht gelesen: {error}",
                range.folder.display()
            );
            HashMap::new()
        });
    paths
        .iter()
        .zip(&objects)
        .filter_map(|(path, object): (&&str, &String)| {
            let bytes = found.remove(object)?;
            (!changes::is_binary(&bytes)).then(|| {
                (
                    (*path).to_owned(),
                    String::from_utf8_lossy(&bytes).into_owned(),
                )
            })
        })
        .collect()
}

/// Die Datei im Arbeitsverzeichnis, unter denselben Grenzen wie `end_texts`.
pub fn working_text(folder: &Path, path: &str) -> Option<String> {
    changes::validate_path(path).ok()?;
    let file = folder.join(native_path(path));
    let size = fs::metadata(&file).ok()?.len();
    if size > changes::MAX_UNTRACKED_BYTES {
        return None;
    }
    let bytes = fs::read(&file).ok()?;
    (!changes::is_binary(&bytes)).then(|| String::from_utf8_lossy(&bytes).into_owned())
}
