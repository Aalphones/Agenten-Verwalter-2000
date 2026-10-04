//! Commits einer Session finden und speichern (ADR 014).
use std::sync::Arc;
use std::thread;

use super::Session;
use crate::changes::attribution::Ownership;
use crate::changes::{ChangesInput, scan};
use crate::db::session_commits;

/// Sucht in einem eigenen Thread die Commits der Zeitfenster und speichert sie.
pub(super) fn schedule(session: Arc<Session>, windows: Vec<(f64, f64)>) {
    // Startet der Thread nicht, fehlen diese Commits in den Changes — kein Fehler für den Nutzer.
    let _ = thread::Builder::new()
        .name("commit-scan".to_owned())
        .spawn(move || {
            let repositories = session.repositories();
            let (ticket_roots, ticket_folders, created_at) = {
                let state = session.lock();
                (
                    state.ticket_roots.clone(),
                    state.ticket_worktrees.clone(),
                    state.created_at,
                )
            };
            // Die Basis der inneren Repositories liegt vor dem Anlegen der Session; eigene Commits
            // liegen immer danach.
            let input = ChangesInput {
                workspace: session.workspace.clone(),
                repositories,
                ticket_roots,
                ticket_folders,
                since_ms: created_at,
                own: Ownership::default(),
            };
            let dirs = scan::session_dirs(&input);
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
