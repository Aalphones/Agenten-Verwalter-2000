//! MCP-Server der Session über Steueranfragen an ihren Agenten. Die Liste gibt es nur im Speicher
//! und wird mit dem Prozess verworfen (ADR 013); jede Änderung meldet `mcp://changed`.
use serde_json::Value;
use tauri::AppHandle;

use super::{Outbox, SessionRegistry, SessionState, now_ms, update};
use crate::agents::claude::protocol::{
    control_request, mcp_authenticate, mcp_reconnect, mcp_status, mcp_toggle,
};
use crate::error::CommandError;
use crate::mcp::model::{
    McpAction, McpActionError, McpAuthWait, McpServer, McpServerStatus, SessionMcp,
};

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

    /// Schaltet einen Server aus oder ein; `false`, wenn der Agent nicht zuhört.
    pub fn toggle_mcp(
        &self,
        app: &AppHandle,
        session_id: &str,
        server: &str,
        enabled: bool,
    ) -> Result<bool, CommandError> {
        let session = self.get(session_id)?;
        let action = if enabled {
            McpAction::Enable
        } else {
            McpAction::Disable
        };
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.start_mcp_action(outbox, server, action, mcp_toggle(server, enabled))
            },
        )
    }
}

impl SessionState {
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
        let is_known = self
            .mcp_servers
            .as_ref()
            .is_some_and(|servers: &Vec<McpServer>| {
                servers.iter().any(|known: &McpServer| known.name == server)
            });
        if !is_known {
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
