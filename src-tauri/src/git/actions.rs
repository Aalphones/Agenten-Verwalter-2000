//! Schreibende Git-Befehle der Changes einer Session (ADR 025): Commit, Push, Pull, Fetch, Branch
//! wechseln und anlegen, Merge/Rebase abbrechen. Ob die Sperre greift, prüft der Command davor.
use std::path::Path;

use crate::error::CommandError;
use crate::git;
use crate::git::model::{GitOperation, GitSwitchMode};
use crate::git::status;

/// Committet genau `paths` (bei `amend`: ergänzt `HEAD` um sie) und gibt die neue `HEAD`-ID zurück.
pub fn commit(
    dir: &Path,
    paths: &[String],
    message: &str,
    amend: bool,
) -> Result<String, CommandError> {
    let message = message.trim();
    if amend {
        ensure_head_unpushed(dir)?;
    } else {
        if message.is_empty() {
            return Err(CommandError::Git("Commit-Nachricht fehlt.".to_owned()));
        }
        if paths.is_empty() {
            return Err(CommandError::Git("Keine Datei ausgewählt.".to_owned()));
        }
    }
    if !paths.is_empty() {
        git::add_paths(dir, paths)?;
    }
    if amend {
        let message = (!message.is_empty()).then_some(message);
        git::commit_amend(dir, paths, message)?;
    } else {
        git::commit_paths(dir, paths, message)?;
    }
    git::head_commit(dir)
}

/// Ergänzen schreibt die Geschichte um — nur, solange `HEAD` nirgends veröffentlicht ist.
fn ensure_head_unpushed(dir: &Path) -> Result<(), CommandError> {
    let Some(upstream) = git::upstream(dir)? else {
        return Ok(());
    };
    if git::is_ancestor(dir, "HEAD", &upstream)? {
        return Err(CommandError::Git(
            "Der letzte Commit ist schon gepusht — Ergänzen nicht möglich.".to_owned(),
        ));
    }
    Ok(())
}

/// Ohne Upstream mit `-u` zum Remote, den auch der Status nennt.
pub fn push(dir: &Path) -> Result<(), CommandError> {
    let Some(branch) = git::head_branch(dir)? else {
        return Err(CommandError::Git(
            "Losgelöster HEAD — erst einen Branch anlegen.".to_owned(),
        ));
    };
    if git::upstream(dir)?.is_some() {
        return git::push(dir);
    }
    match status::push_remote(git::remotes(dir)?) {
        Some(remote) => git::push_set_upstream(dir, &remote, &branch),
        None => Err(CommandError::Git("Kein Remote eingerichtet.".to_owned())),
    }
}

/// Ein Merge mit Konflikten ist kein Fehler: Git lässt ihn stehen, der Status zeigt ihn.
pub fn pull(dir: &Path) -> Result<(), CommandError> {
    if git::upstream(dir)?.is_none() {
        return Err(CommandError::Git(
            "Kein Upstream — erst veröffentlichen.".to_owned(),
        ));
    }
    match git::pull_merge(dir) {
        Ok(()) => Ok(()),
        Err(error) => {
            if status::operation(dir)? == GitOperation::Merge {
                return Ok(());
            }
            Err(error)
        }
    }
}

/// Fetch und Zeitpunkt merken; nur ein erfolgreicher zählt.
pub fn fetch(dir: &Path) -> Result<(), CommandError> {
    git::fetch(dir)?;
    status::mark_fetched(dir);
    Ok(())
}

/// `origin/x` wird zum lokalen `x` — vorhanden, dann gewechselt, sonst mit Upstream angelegt.
pub fn switch(dir: &Path, branch: &str, mode: GitSwitchMode) -> Result<(), CommandError> {
    git::check_branch_name(dir, branch)?;
    if mode == GitSwitchMode::Stash {
        git::stash_push(dir, &format!("verwalter: vor Wechsel auf {branch}"))?;
    }
    let local = git::remotes(dir)?.into_iter().find_map(|remote: String| {
        branch
            .strip_prefix(&format!("{remote}/"))
            .map(str::to_owned)
    });
    match local {
        Some(local) if git::branch_exists(dir, &local)? => git::switch(dir, &local),
        Some(_) => git::switch_track(dir, branch),
        None => git::switch(dir, branch),
    }
}

/// Neuer Branch vom aktuellen `HEAD`, gleich ausgecheckt.
pub fn create_branch(dir: &Path, name: &str) -> Result<(), CommandError> {
    git::check_branch_name(dir, name)?;
    if git::branch_exists(dir, name)? {
        return Err(CommandError::Git(format!("Branch {name} gibt es schon.")));
    }
    git::switch_create(dir, name)
}

pub fn abort_operation(dir: &Path) -> Result<(), CommandError> {
    match status::operation(dir)? {
        GitOperation::Merge => git::merge_abort(dir),
        GitOperation::Rebase => git::rebase_abort(dir),
        GitOperation::None => Err(CommandError::Git(
            "Kein Merge oder Rebase im Gang.".to_owned(),
        )),
    }
}
