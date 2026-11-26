//! Session-Dateien (ADR 071): die Dateien einer Session außerhalb der Repositories — in ihren
//! Scratchpads, von ihr geschrieben oder im Chat verlinkt. Hier entsteht die Eingabe aus Datenbank
//! und Ordnern (von der Registry und vom Prüfprogramm), die Liste baut `scan`, die Grenze zum
//! Ansehen und Öffnen zieht `access`; die Kennungen der Betrachter-Adresse hält `handles`.
pub mod access;
pub mod handles;
pub mod links;
pub mod model;
pub mod scan;

use std::fs;
use std::ops::ControlFlow;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::agents::event::ChatEntry;
use crate::artifacts;
use crate::background::scratchpad;
use crate::changes::{ChangesInput, sources};
use crate::db::{Database, chat_entries, session_files, session_links, sessions};
use crate::error::CommandError;

use model::{MemberIdentity, SessionFilesInput, SessionFilesMember};

/// Liest ältere Sessions einmal nach und sammelt dann je Mitglied Scratchpad der Kommandozeile,
/// geschriebene und verlinkte Pfade; dazu die Ordner der Repository-Einträge aus `changes`
/// (Reichweite Vorhaben) und `.artefakte`. Die Datenbank wird je Session neu gesperrt, damit ein
/// langer Verlauf die App nicht anhält.
pub fn collect_input(
    database: &Database,
    members: Vec<MemberIdentity>,
    changes: &ChangesInput,
) -> Result<SessionFilesInput, CommandError> {
    let mut collected: Vec<SessionFilesMember> = Vec::with_capacity(members.len());
    for identity in members {
        let id: String = identity.session_id.clone();
        database.with(|connection| scan_stored_answers(connection, &id))?;
        let member: SessionFilesMember = database.with(|connection| {
            let mut written: Vec<String> = session_files::load_with_first(connection, &id)?
                .into_keys()
                .collect();
            written.sort();
            Ok(SessionFilesMember {
                cli_scratchpad_dir: sessions::load_cli_scratchpad(connection, &id)?
                    .map(PathBuf::from),
                written,
                linked: session_links::load(connection, &id)?,
                identity,
            })
        })?;
        collected.push(member);
    }
    Ok(SessionFilesInput {
        members: collected,
        repository_dirs: sources::sources(changes)
            .into_iter()
            .map(|source: sources::Source| source.dir)
            .collect(),
        artifacts_dir: artifacts::dir(&changes.workspace),
    })
}

/// Die beiden Scratchpad-Ordner einer Session; `None`, wo keiner bekannt oder der Pfad nicht
/// absolut ist — ein relativer meinte den Arbeitsordner der App.
fn scratchpads_of(member: &SessionFilesMember) -> (Option<PathBuf>, Option<PathBuf>) {
    let own: PathBuf = scratchpad::dir_of(&member.identity.workspace, &member.identity.session_id);
    (
        Some(own).filter(|dir: &PathBuf| dir.is_absolute()),
        member
            .cli_scratchpad_dir
            .clone()
            .filter(|dir: &PathBuf| dir.is_absolute()),
    )
}

/// Ob der Ordner selbst eine Verknüpfung ist. Ein Agent kann seinen Scratchpad durch eine ersetzen;
/// dann läge alles hinter ihr „im Scratchpad“, ohne je genannt worden zu sein.
fn is_link(dir: &Path) -> bool {
    fs::symlink_metadata(dir).is_ok_and(|metadata: fs::Metadata| metadata.file_type().is_symlink())
}

/// Der kanonische Ordner eines Scratchpads; `None`, wenn er fehlt oder eine Verknüpfung ist.
fn scratchpad_root(dir: &Path) -> Option<PathBuf> {
    if is_link(dir) {
        return None;
    }
    fs::canonicalize(dir).ok()
}

/// Trägt einmal je Session die Dateiverweise ihrer gespeicherten Antworten ein (`links_scanned`):
/// Antworten aus der Zeit vor `session_links` hat niemand beim Eintreffen gelesen.
fn scan_stored_answers(connection: &mut Connection, session_id: &str) -> Result<(), CommandError> {
    if session_links::is_scanned(connection, session_id)? {
        return Ok(());
    }
    let mut found: Vec<(String, f64)> = Vec::new();
    chat_entries::for_each_payload(connection, session_id, |payload: &str| {
        // Ein Eintrag, den diese Version nicht mehr lesen kann, hält die übrigen nicht auf.
        if let Ok(ChatEntry::Text { text, at, .. }) = serde_json::from_str::<ChatEntry>(payload) {
            for path in links::link_candidates(&text) {
                found.push((path, at.unwrap_or(0.0)));
            }
        }
        ControlFlow::Continue(())
    })?;
    session_links::upsert_all(connection, session_id, &found)?;
    session_links::mark_scanned(connection, session_id)
}
