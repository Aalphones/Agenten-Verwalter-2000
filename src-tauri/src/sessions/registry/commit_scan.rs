//! Commits einer Session finden und speichern (ADR 014).
use std::sync::Arc;
use std::thread;

use super::Session;
use crate::changes::scan;
use crate::db::session_commits;

/// Sucht in einem eigenen Thread die Commits der Zeitfenster und speichert sie.
pub(super) fn schedule(session: Arc<Session>, windows: Vec<(f64, f64)>) {
    // Startet der Thread nicht, fehlen diese Commits in den Changes — kein Fehler für den Nutzer.
    let _ = thread::Builder::new()
        .name("commit-scan".to_owned())
        .spawn(move || {
            let repositories = session.repositories();
            let ticket_folders = session.lock().ticket_worktrees.clone();
            let dirs = scan::session_dirs(&session.workspace, &repositories, &ticket_folders);
            let commits = scan::own_commits(&dirs, &windows);
            if commits.is_empty() {
                return;
            }
            let saved = session
                .database
                .with(|connection| session_commits::insert_all(connection, &session.id, &commits));
            if let Err(error) = saved {
                session.log_line(format!("Commits der Session nicht gespeichert: {error}"));
            }
        });
}
