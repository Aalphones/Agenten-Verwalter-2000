//! MCP-Server der Session über Steueranfragen an ihren Agenten. Die Liste gibt es nur im Speicher
//! und wird mit dem Prozess verworfen (ADR 013); jede Änderung meldet `mcp://changed`. Die
//! Konfiguration liest der Core selbst aus den Dateien, auch ohne Agent (ADR 070).
use std::path::PathBuf;
use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, Emitter};

use super::{Outbox, Session, SessionRegistry, SessionState, now_ms, update};
use crate::agents::claude::protocol::{
    control_request, mcp_authenticate, mcp_reconnect, mcp_status, mcp_toggle,
};
use crate::error::CommandError;
use crate::mcp::config_files::{self, LoadedConfig};
use crate::mcp::model::{
    McpAction, McpActionError, McpAuthWait, McpChangedEvent, McpConfigView, McpDraft, McpServer,
    McpServerStatus, SessionMcp,
};
use crate::settings;
use crate::standalone::home_dir;
use crate::worktrees::SessionRepository;

pub(super) const MCP_CHANGED_EVENT: &str = "mcp://changed";

/// Nur Webseiten: die Adresse stammt aus der Ausgabe eines Prozesses (ADR 024).
const AUTH_URL_SCHEME: &str = "https://";

impl SessionRegistry {
    /// Die letzte Liste der MCP-Server, die laufenden Aktionen und ob der Agent gerade zuhört.
    pub fn mcp(&self, session_id: &str) -> Result<SessionMcp, CommandError> {
        let session = self.get(session_id)?;
        let state = session.lock();
        let mut busy: Vec<String> = state
            .mcp_actions
            .values()
            .map(|(server, _): &(String, McpAction)| server.clone())
            .collect();
        busy.sort();
        busy.dedup();
        Ok(SessionMcp {
            servers: state.mcp_servers.clone(),
            busy,
            error: state.mcp_error.clone(),
            auth: state.mcp_auth.clone(),
            fetched_at: state.mcp_fetched_at,
            is_agent_running: state.is_listening(),
        })
    }

    /// Die Server aus den Konfigurationsdateien, auch ohne Agent. Liest nur; fehlende
    /// Arbeitsordner entstehen hier nicht.
    pub fn mcp_config(&self, session_id: &str) -> Result<McpConfigView, CommandError> {
        let session = self.get(session_id)?;
        let config = load_config(&session, &session.repositories())
            .ok_or_else(|| CommandError::Io("Benutzerordner unbekannt".to_owned()))?;
        let fingerprint = config.fingerprint();
        // Erst nach dem Lesen sperren: die Dateien liegen nicht unter der Session-Sperre.
        let state = session.lock();
        let config_changed = state.process.is_some()
            && state
                .process_mcp_fingerprint
                .is_some_and(|started_with: u64| started_with != fingerprint);
        drop(state);
        Ok(McpConfigView {
            sources: config.sources(),
            config_changed,
            disabled_everywhere: settings::mcp_disabled_everywhere(&self.database)?,
        })
    }

    /// Was ein Test ohne Agent braucht: den gelesenen Stand der Dateien und den Arbeitsordner für
    /// stdio-Server. Ohne Workspace (er entsteht hier nicht) ist das der Benutzerordner.
    pub fn mcp_probe_context(
        &self,
        session_id: &str,
    ) -> Result<(LoadedConfig, PathBuf), CommandError> {
        let session = self.get(session_id)?;
        let home = home_or_error()?;
        let config = config_files::load(
            &home,
            &session.workspace,
            &repository_folders(&session, &session.repositories()),
        );
        let folder = if session.workspace.is_dir() {
            session.workspace.clone()
        } else {
            home
        };
        Ok((config, folder))
    }

    /// Legt einen Server an oder ersetzt einen, in der Datei der gewählten Quelle (ADR 070).
    /// Ein laufender Agent bemerkt es erst mit seinem nächsten Start.
    pub fn save_mcp_server(
        &self,
        app: &AppHandle,
        session_id: &str,
        draft: &McpDraft,
    ) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        config_files::save(
            &home_or_error()?,
            &session.workspace,
            &repository_folders(&session, &session.repositories()),
            draft,
        )?;
        self.emit_mcp_changed(app);
        Ok(())
    }

    /// Entfernt einen Server aus der Datei der Quelle; fehlt er dort, passiert nichts.
    pub fn remove_mcp_server(
        &self,
        app: &AppHandle,
        session_id: &str,
        source_id: &str,
        name: &str,
    ) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        config_files::remove(
            &home_or_error()?,
            &session.workspace,
            &repository_folders(&session, &session.repositories()),
            source_id,
            name,
        )?;
        self.emit_mcp_changed(app);
        Ok(())
    }

    /// Meldet allen Sessions eine Änderung: Benutzer-Server und „überall aus“ betreffen jede.
    fn emit_mcp_changed(&self, app: &AppHandle) {
        let sessions: Vec<Arc<Session>> = self.lock_sessions().values().cloned().collect();
        for session in sessions {
            let event = McpChangedEvent {
                session_id: session.id.clone(),
            };
            if let Err(error) = app.emit(MCP_CHANGED_EVENT, event) {
                session.log_line(format!("MCP-Ereignis nicht gesendet: {error}"));
            }
        }
    }

    /// Fragt den Agenten nach einer frischen Liste; `false`, wenn er nicht zuhört.
    pub fn refresh_mcp(&self, app: &AppHandle, session_id: &str) -> Result<bool, CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                if !state.is_listening() {
                    return Ok(false);
                }
                state.send_control(outbox, mcp_status())?;
                Ok(true)
            },
        )
    }

    /// Verbindet einen Server neu; `false`, wenn der Agent nicht zuhört.
    pub fn reconnect_mcp(
        &self,
        app: &AppHandle,
        session_id: &str,
        server: &str,
    ) -> Result<bool, CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.start_mcp_action(outbox, server, McpAction::Reconnect, mcp_reconnect(server))
            },
        )
    }

    /// Startet die Anmeldung bei einem Server; die Anmeldeseite öffnet sich, sobald die Antwort
    /// kommt. `false`, wenn der Agent nicht zuhört.
    pub fn authenticate_mcp(
        &self,
        app: &AppHandle,
        session_id: &str,
        server: &str,
    ) -> Result<bool, CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.start_mcp_action(
                    outbox,
                    server,
                    McpAction::Authenticate,
                    mcp_authenticate(server),
                )
            },
        )
    }

    /// Schaltet einen Server aus oder ein. Meldet der laufende Agent ihn, geht eine Steueranfrage
    /// hinaus; sonst schreibt der Core `disabledMcpServers` des Workspace. `everywhere` beim Ausschalten
    /// nimmt den Namen in die Liste „überall aus“, Einschalten nimmt ihn heraus und wieder ein
    /// in allen Vorhaben des Verwalters. Immer `true`, sobald der Wechsel angewendet ist.
    pub fn toggle_mcp(
        &self,
        app: &AppHandle,
        session_id: &str,
        server: &str,
        enabled: bool,
        everywhere: bool,
    ) -> Result<bool, CommandError> {
        let session = self.get(session_id)?;
        // Für einen Server, den der laufende Agent noch nicht meldet (neu angelegt), lehnt
        // `start_mcp_action` die Steueranfrage ab: er geht wie ohne Agent in die Datei.
        let is_reported = {
            let state = session.lock();
            state.is_listening() && state.reports_mcp_server(server)
        };
        self.update_disabled_everywhere(&session, server, enabled, everywhere, is_reported)?;
        let action = if enabled {
            McpAction::Enable
        } else {
            McpAction::Disable
        };
        let is_sent = is_reported
            && update(
                app,
                &session,
                |state: &mut SessionState, outbox: &mut Outbox| {
                    state.start_mcp_action(outbox, server, action, mcp_toggle(server, enabled))
                },
            )?;
        if !is_sent {
            config_files::set_disabled_for_workspace(
                &home_or_error()?,
                &session.workspace,
                &[server.to_owned()],
                !enabled,
            )?;
        }
        // Auch bei der Steueranfrage: andere Sessions sehen die geänderte Liste „überall aus“.
        self.emit_mcp_changed(app);
        Ok(true)
    }

    /// Führt die Liste „überall aus“ nach und schaltet die anderen Vorhaben des Verwalters
    /// wieder ein, wenn der Name sie verlässt. Der eigene Workspace bleibt aus, wenn er aus
    /// bleiben soll oder der laufende Agent ihn selbst schaltet.
    fn update_disabled_everywhere(
        &self,
        session: &Session,
        server: &str,
        enabled: bool,
        everywhere: bool,
        is_reported: bool,
    ) -> Result<(), CommandError> {
        let mut names = settings::mcp_disabled_everywhere(&self.database)?;
        let was_listed = names.iter().any(|name: &String| name == server);
        let is_listed = !enabled && everywhere;
        if was_listed == is_listed {
            return Ok(());
        }
        names.retain(|name: &String| name != server);
        if is_listed {
            names.push(server.to_owned());
        }
        settings::set_mcp_disabled_everywhere(&self.database, &names)?;
        if !was_listed {
            return Ok(());
        }
        let workspace_root = session
            .workspace
            .parent()
            .ok_or_else(|| CommandError::Io("Workspace-Ordner unbekannt".to_owned()))?;
        let keep_own = !enabled || is_reported;
        config_files::clear_disabled_under(
            &home_or_error()?,
            workspace_root,
            &[server.to_owned()],
            keep_own.then_some(session.workspace.as_path()),
        )
    }
}

fn home_or_error() -> Result<PathBuf, CommandError> {
    home_dir().ok_or_else(|| CommandError::Io("Benutzerordner unbekannt".to_owned()))
}

/// Trägt vor dem Start alle „überall aus“-Server in `disabledMcpServers` des Workspace ein,
/// damit auch ein neues Vorhaben sie ausgeschaltet startet. Ein Fehler hält den Start nicht auf.
pub(super) fn apply_disabled_everywhere(session: &Session) {
    let names = match settings::mcp_disabled_everywhere(&session.database) {
        Ok(names) if !names.is_empty() => names,
        Ok(_) => return,
        Err(error) => {
            session.log_line(format!("Liste „überall aus“ nicht gelesen: {error}"));
            return;
        }
    };
    let Some(home) = home_dir() else {
        return;
    };
    if let Err(error) =
        config_files::set_disabled_for_workspace(&home, &session.workspace, &names, true)
    {
        session.log_line(format!(
            "MCP-Server „überall aus“ nicht eingetragen: {error}"
        ));
    }
}

/// Der Stand der Konfiguration, mit dem ein Prozess gestartet wird; `None` ohne Benutzerordner.
pub(super) fn mcp_fingerprint(
    session: &Session,
    repositories: &[SessionRepository],
) -> Option<u64> {
    load_config(session, repositories).map(|config: LoadedConfig| config.fingerprint())
}

fn load_config(session: &Session, repositories: &[SessionRepository]) -> Option<LoadedConfig> {
    Some(config_files::load(
        &home_dir()?,
        &session.workspace,
        &repository_folders(session, repositories),
    ))
}

/// Name und Arbeitsordner je Repository in der Reihenfolge der Session.
fn repository_folders(
    session: &Session,
    repositories: &[SessionRepository],
) -> Vec<(String, PathBuf)> {
    repositories
        .iter()
        .map(|repository: &SessionRepository| {
            (
                repository.name.clone(),
                repository.working_dir(&session.workspace),
            )
        })
        .collect()
}

impl SessionState {
    fn reports_mcp_server(&self, server: &str) -> bool {
        self.mcp_servers
            .as_ref()
            .is_some_and(|servers: &Vec<McpServer>| {
                servers.iter().any(|known: &McpServer| known.name == server)
            })
    }

    fn start_mcp_action(
        &mut self,
        outbox: &mut Outbox,
        server: &str,
        action: McpAction,
        request: Value,
    ) -> Result<bool, CommandError> {
        if !self.is_listening() {
            return Ok(false);
        }
        if !self.reports_mcp_server(server) {
            return Err(CommandError::Internal(format!(
                "MCP-Server unbekannt: {server}"
            )));
        }
        let request_id = self.next_request_id();
        outbox.write(self, control_request(&request_id, request))?;
        // Erst nach dem Einreihen: eine Aktion, die nie hinausging, bekäme nie eine Antwort.
        self.mcp_actions
            .insert(request_id, (server.to_owned(), action));
        self.mcp_error = None;
        outbox.mcp_changed = true;
        Ok(true)
    }

    pub(super) fn apply_mcp_servers(&mut self, outbox: &mut Outbox, servers: Vec<McpServer>) {
        let problems_before = self.mcp_problem_count();
        self.mcp_servers = Some(servers);
        self.mcp_fetched_at = Some(now_ms());
        // Die Kommandozeile meldet das Ende einer Anmeldung nicht; erkennbar ist es nur an der Liste.
        if let Some(auth) = &self.mcp_auth
            && !self.is_needing_auth(&auth.server)
        {
            self.mcp_auth = None;
        }
        outbox.mcp_changed = true;
        if self.mcp_problem_count() != problems_before {
            outbox.summary_dirty = true;
        }
    }

    /// Ordnet eine Antwort ohne Inhalt oder einen Fehler über ihre Request-ID einer MCP-Aktion zu;
    /// fremde IDs (z.B. die Bestätigung von `stop_task`) bleiben ohne Folge.
    pub(super) fn mcp_answered(
        &mut self,
        outbox: &mut Outbox,
        request_id: &str,
        error: Option<String>,
    ) {
        let Some((server, action)) = self.mcp_actions.remove(request_id) else {
            return;
        };
        if let Some(text) = error {
            self.mcp_error = Some(McpActionError {
                server,
                action,
                text,
            });
        }
        outbox.mcp_changed = true;
        // Die Liste ist Beiwerk: ein Fehler beim Einreihen ändert nichts am Ausgang der Aktion.
        let _ = self.send_control(outbox, mcp_status());
    }

    /// Ordnet die Antwort auf `mcp_authenticate` zu: eine `https://`-Anmeldeseite wird nach dem
    /// Freigeben der Sperre geöffnet und bleibt als offene Anmeldung stehen. Ohne Adresse liegt
    /// schon ein gültiges Token vor; die Kommandozeile verbindet dann selbst.
    pub(super) fn mcp_auth_started(
        &mut self,
        outbox: &mut Outbox,
        request_id: &str,
        auth_url: Option<String>,
        callback_expected: bool,
    ) {
        let Some((server, action)) = self.mcp_actions.remove(request_id) else {
            return;
        };
        // Eine andere Aktion mit dieser Antwortform gilt nur als beantwortet.
        if action == McpAction::Authenticate
            && let Some(url) = auth_url
        {
            if url.starts_with(AUTH_URL_SCHEME) {
                outbox.open_urls.push(url.clone());
                self.mcp_auth = Some(McpAuthWait {
                    server,
                    url,
                    callback_expected,
                });
            } else {
                self.mcp_error = Some(McpActionError {
                    server,
                    action,
                    text: "Anmeldeadresse nicht geöffnet: kein https".to_owned(),
                });
            }
        }
        outbox.mcp_changed = true;
        // Die Liste ist Beiwerk: ein Fehler beim Einreihen ändert nichts am Ausgang der Aktion.
        let _ = self.send_control(outbox, mcp_status());
    }

    /// Verwirft Liste, laufende Aktionen, Fehler und offene Anmeldung, wenn der Prozess endet oder
    /// ersetzt wird.
    pub(super) fn forget_mcp(&mut self, outbox: &mut Outbox) {
        let had_state = self.mcp_servers.is_some()
            || !self.mcp_actions.is_empty()
            || self.mcp_error.is_some()
            || self.mcp_auth.is_some();
        if !had_state {
            return;
        }
        let had_problems = self.mcp_problem_count() > 0;
        self.mcp_servers = None;
        self.mcp_fetched_at = None;
        self.mcp_actions.clear();
        self.mcp_error = None;
        self.mcp_auth = None;
        outbox.mcp_changed = true;
        if had_problems {
            outbox.summary_dirty = true;
        }
    }

    fn is_needing_auth(&self, server: &str) -> bool {
        self.mcp_servers
            .as_ref()
            .is_some_and(|servers: &Vec<McpServer>| {
                servers.iter().any(|known: &McpServer| {
                    known.name == server && known.status == McpServerStatus::NeedsAuth
                })
            })
    }

    pub(super) fn mcp_problem_count(&self) -> u32 {
        let Some(servers) = &self.mcp_servers else {
            return 0;
        };
        let problems = servers
            .iter()
            .filter(|server: &&McpServer| server.status.is_problem())
            .count();
        u32::try_from(problems).unwrap_or(u32::MAX)
    }
}
