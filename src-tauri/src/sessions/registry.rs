//! Alle Sessions im Speicher des Core: Zustand, Chat-Verlauf und die Verbindung zum Agenten-Prozess.
//!
//! Jede Änderung läuft durch `update`: der Zustand wird gesperrt verändert, Ereignisse an die
//! Oberfläche und Zeilen an den Prozess gehen erst nach dem Freigeben der Sperre hinaus. Ein
//! Schreiben in die Pipe unter der Sperre könnte sich mit dem Lese-Thread verklemmen — der
//! Agent blockiert auf einer vollen Ausgabe-Pipe, der Lese-Thread wartet auf die Sperre.
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{Map, Value, json};
use tauri::{AppHandle, Emitter, Manager};

use crate::agents::claude::locate::find_claude;
use crate::agents::claude::process::{ClaudeProcess, ProcessOutput, SpawnOptions, spawn};
use crate::agents::claude::protocol::{allow, control_request, deny, user_message};
use crate::agents::claude::translate::Translator;
use crate::agents::event::{
    AgentEvent, ChatEntry, Effort, Mode, ModelId, Question, QuestionAnswer, QuestionKind, TodoItem,
    ToolState, TurnEnd,
};
use crate::db::sessions::{self as session_rows, SessionRow};
use crate::db::{Database, chat_entries, repositories as repository_rows, session_repositories};
use crate::error::CommandError;
use crate::filesystem::workspace::{new_session_workspace, stored_session_workspace};
use crate::sessions::model::{ChatEntryEvent, ChatPage, SessionStatus, SessionSummary};
use crate::sessions::{MAX_NAME_CHARS, name_from_task};
use crate::worktrees::{self, SessionRepository, WorktreeCheck};

const SESSION_CHANGED_EVENT: &str = "session://changed";
const CHAT_ENTRY_EVENT: &str = "chat://entry";
const INITIAL_CONTEXT_WINDOW: u32 = 200_000;
const KILL_GRACE: Duration = Duration::from_secs(5);
/// Abstand zwischen dem Abschuss des Agenten und dem Aufräumen seiner Worktrees.
const CLEANUP_MARGIN: Duration = Duration::from_secs(1);
const MAX_LOG_LINES: usize = 300;
const MAX_LOG_LINE_CHARS: usize = 500;
const MAX_HISTORY_PAGE: u32 = 500;
const RESUME_MESSAGE: &str = "Mach weiter.";
const ANSWER_SEPARATOR: &str = " · ";
const DEFAULT_IDLE_SECONDS: u64 = 1800;
const IDLE_CHECK_INTERVAL: Duration = Duration::from_secs(15);
const IDLE_SECONDS_VARIABLE: &str = "VERWALTER_IDLE_SECONDS";

pub struct SessionRegistry {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    database: Arc<Database>,
    /// Hält das Anlegen von Sessions nacheinander: zwei gleichzeitige würden sonst denselben
    /// freien Branch-Namen wählen.
    create_lock: Mutex<()>,
}

pub struct Session {
    pub id: String,
    workspace: PathBuf,
    /// Nach dem Anlegen unveränderlich.
    repositories: Vec<SessionRepository>,
    database: Arc<Database>,
    state: Mutex<SessionState>,
}

struct PendingRequest {
    question_kind: QuestionKind,
    questions: Vec<Question>,
    /// Die Eingabe des Werkzeugs: die Antwort schickt sie als `updatedInput` zurück.
    input: Value,
    seq: u32,
}

struct SessionState {
    name: String,
    status: SessionStatus,
    model: ModelId,
    effort: Effort,
    /// Denkaufwand, mit dem der laufende Prozess gestartet wurde — der lässt sich nur beim Start setzen.
    process_effort: Effort,
    /// `system/init` wurde mindestens einmal gesehen. Erst dann kennt Claude die Session und
    /// erlaubt `--resume`; davor bricht es mit „No conversation found“ ab.
    has_agent_history: bool,
    mode: Mode,
    created_at: f64,
    running_ms: f64,
    running_since: Option<f64>,
    context_used: u32,
    context_window: u32,
    /// Seit wann die Session ruht (`completed`/`paused`) — Grundlage für `reap_idle`.
    idle_since: Option<f64>,
    /// Eine wiederhergestellte Session lädt ihren Verlauf erst beim ersten Zugriff (`Session::lock_loaded`).
    entries_loaded: bool,
    /// Die Session war beim Beenden aktiv: beim Laden des Verlaufs werden offene Rückfragen und
    /// laufende Werkzeug-Zeilen abgeschlossen (`settle_after_restart`).
    needs_settling: bool,
    entries: Vec<ChatEntry>,
    tool_seqs: HashMap<String, u32>,
    todos_seq: Option<u32>,
    /// Offene Rückfragen und Rechte-Abfragen als (request_id, Anfrage), älteste zuerst.
    pending: Vec<(String, PendingRequest)>,
    process: Option<Arc<ClaudeProcess>>,
    /// Zählt Prozessstarts: Ausgaben eines ersetzten Prozesses verändern den Zustand nicht mehr.
    generation: u32,
    translator: Translator,
    log: VecDeque<String>,
    pause_requested: bool,
    cancel_requested: bool,
    next_request: u32,
}

/// Was nach dem Freigeben der Sperre hinausgeht.
#[derive(Default)]
struct Outbox {
    entries: Vec<ChatEntry>,
    summary_dirty: bool,
    summary: Option<SessionSummary>,
    lines: Vec<String>,
    process: Option<Arc<ClaudeProcess>>,
    retire: bool,
}

impl SessionRegistry {
    pub fn new(database: Arc<Database>) -> SessionRegistry {
        SessionRegistry {
            sessions: Mutex::new(HashMap::new()),
            database,
            create_lock: Mutex::new(()),
        }
    }

    /// Lädt alle nicht archivierten Sessions aus der Datenbank, ohne ihren Verlauf und ohne Agenten.
    /// Eine vorher aktive Session ist danach pausiert (auch in der Datenbank).
    pub fn restore(
        app: &AppHandle,
        database: Arc<Database>,
    ) -> Result<SessionRegistry, CommandError> {
        let loaded: Vec<(SessionRow, Vec<SessionRepository>)> = database.with(|connection| {
            let rows = session_rows::load_active(connection)?;
            rows.into_iter()
                .map(|row: SessionRow| {
                    let repositories = session_repositories::load(connection, &row.id)?;
                    Ok((row, repositories))
                })
                .collect()
        })?;
        let registry = SessionRegistry::new(Arc::clone(&database));
        let mut interrupted: Vec<SessionRow> = Vec::new();
        {
            let mut sessions = registry.lock_sessions();
            for (row, repositories) in loaded {
                let state = SessionState::restored(&row);
                if state.needs_settling {
                    interrupted.push(SessionRow {
                        status: SessionStatus::Paused,
                        ..row.clone()
                    });
                }
                let workspace =
                    stored_session_workspace(app, &row.id, row.workspace_dir.as_deref())?;
                sessions.insert(
                    row.id.clone(),
                    Arc::new(Session {
                        id: row.id,
                        workspace,
                        repositories,
                        database: Arc::clone(&database),
                        state: Mutex::new(state),
                    }),
                );
            }
        }
        if !interrupted.is_empty() {
            database.with(|connection| {
                for row in &interrupted {
                    session_rows::upsert(connection, row)?;
                }
                Ok(())
            })?;
        }
        Ok(registry)
    }

    /// Legt Workspace und Worktrees an, speichert die Session und startet ihren Agenten. Alles
    /// oder nichts: scheitert ein Schritt, bleibt weder ein Worktree noch ein Branch noch der
    /// Workspace-Ordner noch eine Datenbankzeile zurück.
    pub fn create(
        &self,
        app: &AppHandle,
        task: &str,
        repository_ids: &[String],
        model: ModelId,
        effort: Effort,
        mode: Mode,
    ) -> Result<SessionSummary, CommandError> {
        let _creating = self
            .create_lock
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        // Vor jedem Git-Aufruf: ohne Agent wären angelegte Worktrees umsonst.
        find_claude().ok_or(CommandError::ClaudeNotFound)?;
        let rows = self
            .database
            .with(|connection| repository_rows::get_many(connection, repository_ids))?;
        let id = uuid::Uuid::new_v4().to_string();
        let name = name_from_task(task);
        // Die Worktrees entstehen ohne Session-Sperre: `worktree add` kann bei großen
        // Repositories Sekunden dauern.
        let workspace = new_session_workspace(app, &id)?;
        let repositories = match worktrees::create_all(&workspace, &name, &rows) {
            Ok(repositories) => repositories,
            Err(error) => {
                let _ = fs::remove_dir_all(&workspace);
                return Err(error);
            }
        };
        let session = Arc::new(Session {
            id: id.clone(),
            workspace,
            repositories,
            database: Arc::clone(&self.database),
            state: Mutex::new(SessionState::new(name, model, effort, mode)),
        });
        // Die Session-Zeile muss vor `session_repositories` stehen, die darauf verweisen.
        let row = row_of(&session, &session.lock());
        let saved = self.database.with(|connection| {
            session_rows::upsert(connection, &row)?;
            session_repositories::insert_all(connection, &id, &session.repositories)
        });
        if let Err(error) = saved {
            self.discard_created(&session);
            return Err(error);
        }
        self.lock_sessions()
            .insert(id.clone(), Arc::clone(&session));
        let created = update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                // Ohne diese Zeile bekäme die neue Session nie ihre Datenbankzeile.
                outbox.summary_dirty = true;
                start_process(app, &session, state, outbox)?;
                state.push_user(outbox, task);
                outbox.write(state, user_message(task))?;
                Ok(summarize(&session, state))
            },
        );
        if created.is_err() {
            self.lock_sessions().remove(&id);
            self.discard_created(&session);
        }
        created
    }

    /// Rückbau einer Session, deren Anlegen gescheitert ist. Die Zeile einer nie gestarteten
    /// Session käme sonst beim nächsten Start als Geister-Session wieder. Hält Windows den
    /// Workspace-Ordner noch fest, bleibt er liegen — für den Nutzer kein Fehler.
    fn discard_created(&self, session: &Session) {
        // Löscht über `ON DELETE CASCADE` auch Chat-Einträge und `session_repositories`.
        let _ = self
            .database
            .with(|connection| session_rows::delete(connection, &session.id));
        worktrees::rollback(&session.workspace, &session.repositories);
        let _ = fs::remove_dir_all(&session.workspace);
    }

    /// Neueste zuerst.
    pub fn list(&self) -> Vec<SessionSummary> {
        let sessions: Vec<Arc<Session>> = self.lock_sessions().values().cloned().collect();
        let mut summaries: Vec<SessionSummary> = sessions
            .iter()
            .map(|session: &Arc<Session>| summarize(session, &session.lock()))
            .collect();
        summaries.sort_by(|left: &SessionSummary, right: &SessionSummary| {
            right.created_at.total_cmp(&left.created_at)
        });
        summaries
    }

    pub fn send(&self, app: &AppHandle, session_id: &str, text: &str) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                match state.status {
                    SessionStatus::Cancelled => return Err(CommandError::SessionClosed),
                    SessionStatus::Error => return Err(CommandError::AgentStopped),
                    _ => {}
                }
                if !state.pending.is_empty() {
                    answer_oldest_with_text(state, outbox, text)?;
                    state.push_user(outbox, text);
                    return Ok(());
                }
                // Ohne Prozess (wiederhergestellte Session) startet der Agent hier, mit dem bisherigen Verlauf.
                if state.process.is_none() || state.effort != state.process_effort {
                    start_process(app, &session, state, outbox)?;
                }
                state.push_user(outbox, text);
                state.set_status(outbox, SessionStatus::Running);
                outbox.write(state, user_message(text))
            },
        )
    }

    pub fn answer(
        &self,
        app: &AppHandle,
        session_id: &str,
        request_id: &str,
        answer: &QuestionAnswer,
    ) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                apply_answer(state, outbox, request_id, answer)
            },
        )
    }

    /// Pause und Esc: unterbricht die laufende Antwort; der Status wechselt mit dem `result` des Agenten.
    pub fn pause(&self, app: &AppHandle, session_id: &str) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                let is_active = matches!(
                    state.status,
                    SessionStatus::Starting | SessionStatus::Running | SessionStatus::Waiting
                );
                if !is_active {
                    return Ok(());
                }
                state.pause_requested = true;
                interrupt_agent(state, outbox, "Vom Benutzer pausiert.", "Pausiert")
            },
        )
    }

    pub fn resume(&self, app: &AppHandle, session_id: &str) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        let status = session.lock().status;
        if status != SessionStatus::Paused {
            return Ok(());
        }
        self.send(app, session_id, RESUME_MESSAGE)
    }

    pub fn cancel(&self, app: &AppHandle, session_id: &str) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        let cancelled = update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                if state.status == SessionStatus::Cancelled {
                    return Ok(());
                }
                state.cancel_requested = true;
                if matches!(
                    state.status,
                    SessionStatus::Running | SessionStatus::Waiting
                ) {
                    interrupt_agent(state, outbox, "Vom Benutzer abgebrochen.", "Abgebrochen")?;
                }
                state.abandon_pending(outbox, "Abgebrochen");
                state.set_status(outbox, SessionStatus::Cancelled);
                state.interrupt_running_tools(outbox);
                outbox.retire(state);
                Ok(())
            },
        );
        // Ein Prozess, der schon weg ist, muss nicht mehr unterbrochen werden.
        match cancelled {
            Err(CommandError::AgentStopped) => Ok(()),
            other => other,
        }
    }

    pub fn rename(
        &self,
        app: &AppHandle,
        session_id: &str,
        name: &str,
    ) -> Result<(), CommandError> {
        let name: String = name.trim().chars().take(MAX_NAME_CHARS).collect();
        if name.is_empty() {
            return Err(CommandError::Internal(
                "Der Name darf nicht leer sein.".to_owned(),
            ));
        }
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.name = name;
                outbox.summary_dirty = true;
                Ok(())
            },
        )
    }

    /// Blendet die Session aus: der Agent wird beendet, die Zeile als archiviert markiert, die Session
    /// verlässt die Liste. Der Verlauf bleibt; Worktrees ohne offene Änderungen werden nach dem Ende
    /// des Agenten entfernt, Branches bleiben.
    pub fn archive(&self, app: &AppHandle, session_id: &str) -> Result<(), CommandError> {
        self.cancel(app, session_id)?;
        let session = self.get(session_id)?;
        session
            .database
            .with(|connection| session_rows::archive(connection, session_id, now_ms()))?;
        self.lock_sessions().remove(session_id);
        if !session.repositories.is_empty() {
            schedule_worktree_cleanup(session.workspace.clone(), session.repositories.clone());
        }
        Ok(())
    }

    pub fn restart(&self, app: &AppHandle, session_id: &str) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                if state.status != SessionStatus::Error {
                    return Ok(());
                }
                start_process(app, &session, state, outbox)?;
                state.pause_requested = false;
                state.set_status(outbox, SessionStatus::Paused);
                Ok(())
            },
        )
    }

    pub fn set_model(
        &self,
        app: &AppHandle,
        session_id: &str,
        model: ModelId,
    ) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.model = model;
                outbox.summary_dirty = true;
                state.send_control(
                    outbox,
                    json!({ "subtype": "set_model", "model": model.cli_id() }),
                )
            },
        )
    }

    pub fn set_mode(
        &self,
        app: &AppHandle,
        session_id: &str,
        mode: Mode,
    ) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.mode = mode;
                outbox.summary_dirty = true;
                state.send_control(
                    outbox,
                    json!({ "subtype": "set_permission_mode", "mode": mode.cli_value() }),
                )
            },
        )
    }

    /// Wirkt erst mit dem nächsten Prozessstart — der Agent kennt keine Steueranfrage dafür.
    pub fn set_effort(
        &self,
        app: &AppHandle,
        session_id: &str,
        effort: Effort,
    ) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.effort = effort;
                outbox.summary_dirty = true;
                Ok(())
            },
        )
    }

    pub fn history(
        &self,
        session_id: &str,
        before: Option<u32>,
        limit: u32,
    ) -> Result<ChatPage, CommandError> {
        let session = self.get(session_id)?;
        let state = session.lock_loaded()?;
        let total = state.entries.len();
        let end = before.map_or(total, |seq: u32| (seq as usize).min(total));
        let start = end.saturating_sub(limit.clamp(1, MAX_HISTORY_PAGE) as usize);
        let entries = state
            .entries
            .get(start..end)
            .map(<[ChatEntry]>::to_vec)
            .unwrap_or_default();
        Ok(ChatPage {
            entries,
            has_more: start > 0,
        })
    }

    /// Workspace und Repositories der Session, als Kopie. Ohne Session-Sperre: beide sind nach dem
    /// Anlegen unveränderlich.
    pub fn repositories_of(
        &self,
        session_id: &str,
    ) -> Result<(PathBuf, Vec<SessionRepository>), CommandError> {
        let session = self.get(session_id)?;
        Ok((session.workspace.clone(), session.repositories.clone()))
    }

    pub fn log(&self, session_id: &str) -> Result<Vec<String>, CommandError> {
        let session = self.get(session_id)?;
        let lines = session.lock().log.iter().cloned().collect();
        Ok(lines)
    }

    /// Beendet den Agenten jeder Session, die seit mindestens `idle_ms` ruht (`completed`/`paused`)
    /// und noch einen Prozess hat. Gibt rund 390 MB je Session frei; die nächste Nachricht startet
    /// den Agenten mit `--resume` neu.
    fn reap_idle(&self, app: &AppHandle, idle_ms: f64) {
        let sessions: Vec<Arc<Session>> = self.lock_sessions().values().cloned().collect();
        let now = now_ms();
        for session in sessions {
            let is_candidate = {
                let state = session.lock();
                state.process.is_some()
                    && state
                        .idle_since
                        .is_some_and(|since: f64| now - since >= idle_ms)
            };
            if !is_candidate {
                continue;
            }
            // Der Zustand kann sich zwischen der Vorprüfung und hier geändert haben — deshalb erneut
            // unter `update`. Ein Fehler bedeutet nur, dass der nächste Durchlauf es erneut versucht;
            // ein nicht mehr laufender Prozess ist ohnehin das Ziel.
            let _ = update(
                app,
                &session,
                |state: &mut SessionState, outbox: &mut Outbox| {
                    if state.process.is_some()
                        && state
                            .idle_since
                            .is_some_and(|since: f64| now - since >= idle_ms)
                    {
                        // Erhöht vor dem Beenden: das folgende `Exited` gilt dann als Ausgabe eines
                        // ersetzten Prozesses, nicht als Absturz.
                        state.generation += 1;
                        outbox.retire(state);
                        state.process = None;
                        state.idle_since = None;
                    }
                    Ok(())
                },
            );
        }
    }

    /// Startet den Hintergrund-Thread, der ruhende Agenten nach der Frist beendet
    /// (`VERWALTER_IDLE_SECONDS`, Standard 30 Minuten).
    pub fn start_reaper(app: AppHandle) {
        let idle_ms: f64 = std::env::var(IDLE_SECONDS_VARIABLE)
            .ok()
            .and_then(|value: String| value.parse::<u64>().ok())
            .filter(|seconds: &u64| *seconds > 0)
            .unwrap_or(DEFAULT_IDLE_SECONDS) as f64
            * 1000.0;
        let spawned = thread::Builder::new()
            .name("session-reaper".to_owned())
            .spawn(move || {
                loop {
                    thread::sleep(IDLE_CHECK_INTERVAL);
                    let registry = app.state::<SessionRegistry>();
                    registry.reap_idle(&app, idle_ms);
                }
            });
        // Ohne den Reaper laufen ruhende Agenten nur länger — kein Grund, die App zu beenden.
        if let Err(error) = spawned {
            eprintln!("Reaper für ruhende Agenten nicht gestartet: {error}");
        }
    }

    fn get(&self, session_id: &str) -> Result<Arc<Session>, CommandError> {
        self.lock_sessions()
            .get(session_id)
            .cloned()
            .ok_or_else(|| CommandError::SessionNotFound(session_id.to_owned()))
    }

    fn lock_sessions(&self) -> MutexGuard<'_, HashMap<String, Arc<Session>>> {
        self.sessions.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

impl Session {
    fn lock(&self) -> MutexGuard<'_, SessionState> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Wie `lock`, lädt aber vorher den Verlauf einer wiederhergestellten Session. Alles, was Einträge
    /// liest oder verändert, geht hierüber; `list`, `log` und Statusabfragen brauchen ihn nicht.
    fn lock_loaded(&self) -> Result<MutexGuard<'_, SessionState>, CommandError> {
        let mut state = self.lock();
        if !state.entries_loaded {
            state.load_entries(self)?;
        }
        Ok(state)
    }

    fn log_line(&self, line: String) {
        self.lock().push_log(line);
    }
}

impl SessionState {
    fn new(name: String, model: ModelId, effort: Effort, mode: Mode) -> Self {
        SessionState {
            name,
            status: SessionStatus::Starting,
            model,
            effort,
            process_effort: effort,
            has_agent_history: false,
            mode,
            created_at: now_ms(),
            running_ms: 0.0,
            running_since: None,
            context_used: 0,
            context_window: INITIAL_CONTEXT_WINDOW,
            idle_since: None,
            entries_loaded: true,
            needs_settling: false,
            entries: Vec::new(),
            tool_seqs: HashMap::new(),
            todos_seq: None,
            pending: Vec::new(),
            process: None,
            generation: 0,
            translator: Translator::default(),
            log: VecDeque::new(),
            pause_requested: false,
            cancel_requested: false,
            next_request: 0,
        }
    }

    /// Der Zustand einer Session, wie ihn die Datenbank kennt. Der Agent-Prozess endet mit der App;
    /// eine vorher aktive Session ist deshalb pausiert und startet mit der nächsten Nachricht neu.
    fn restored(row: &SessionRow) -> Self {
        let was_active = matches!(
            row.status,
            SessionStatus::Starting | SessionStatus::Running | SessionStatus::Waiting
        );
        let mut state = SessionState::new(row.name.clone(), row.model, row.effort, row.mode);
        state.status = if was_active {
            SessionStatus::Paused
        } else {
            row.status
        };
        state.created_at = row.created_at;
        state.running_ms = row.running_ms;
        state.context_used = row.context_used;
        state.context_window = row.context_window;
        state.has_agent_history = row.has_agent_history;
        state.idle_since = None;
        state.entries_loaded = false;
        state.needs_settling = was_active;
        state
    }

    /// Lädt den Verlauf aus der Datenbank. Schlägt das fehl, bleibt `entries_loaded` falsch und der
    /// nächste Zugriff versucht es erneut.
    fn load_entries(&mut self, session: &Session) -> Result<(), CommandError> {
        self.entries = session
            .database
            .with(|connection| chat_entries::load_all(connection, &session.id))?;
        self.entries_loaded = true;
        if self.needs_settling {
            let mut outbox = Outbox::default();
            self.settle_after_restart(&mut outbox);
            self.needs_settling = false;
            if !outbox.entries.is_empty() {
                let saved = session.database.with(|connection| {
                    chat_entries::upsert_all(connection, &session.id, &outbox.entries)
                });
                if let Err(error) = saved {
                    self.push_log(format!("Speichern fehlgeschlagen: {error}"));
                }
            }
        }
        Ok(())
    }

    /// Antworten und Ergebnisse, die nach einem Beenden der App nie mehr kommen.
    fn settle_after_restart(&mut self, outbox: &mut Outbox) {
        for entry in &mut self.entries {
            match entry {
                ChatEntry::Question { answer, .. } if answer.is_none() => {
                    *answer = Some("Nicht beantwortet".to_owned());
                }
                ChatEntry::Tool { state, .. } if *state == ToolState::Running => {
                    *state = ToolState::Interrupted;
                }
                _ => continue,
            }
            outbox.entries.push(entry.clone());
        }
    }

    fn push_log(&mut self, line: String) {
        let line: String = line.chars().take(MAX_LOG_LINE_CHARS).collect();
        if self.log.len() >= MAX_LOG_LINES {
            self.log.pop_front();
        }
        self.log.push_back(line);
    }

    fn set_status(&mut self, outbox: &mut Outbox, status: SessionStatus) {
        if self.status == status {
            return;
        }
        let now = now_ms();
        if self.status == SessionStatus::Running
            && let Some(since) = self.running_since.take()
        {
            self.running_ms += now - since;
        }
        if status == SessionStatus::Running {
            self.running_since = Some(now);
        }
        self.idle_since =
            matches!(status, SessionStatus::Completed | SessionStatus::Paused).then_some(now);
        self.status = status;
        outbox.summary_dirty = true;
    }

    /// Hängt einen Eintrag an; `build` bekommt seine `seq`.
    fn push_entry(&mut self, outbox: &mut Outbox, build: impl FnOnce(u32) -> ChatEntry) -> u32 {
        let seq = u32::try_from(self.entries.len()).unwrap_or(u32::MAX);
        let entry = build(seq);
        self.entries.push(entry.clone());
        outbox.entries.push(entry);
        seq
    }

    fn push_user(&mut self, outbox: &mut Outbox, text: &str) {
        let sent_at = now_ms();
        self.push_entry(outbox, |seq: u32| ChatEntry::User {
            seq,
            text: text.to_owned(),
            sent_at,
        });
    }

    fn replace_entry(&mut self, outbox: &mut Outbox, entry: ChatEntry) {
        let Some(slot) = self.entries.get_mut(entry.seq() as usize) else {
            return;
        };
        *slot = entry.clone();
        outbox.entries.push(entry);
    }

    fn set_question_answer(&mut self, outbox: &mut Outbox, seq: u32, text: String) {
        let Some(entry) = self.entries.get_mut(seq as usize) else {
            return;
        };
        let ChatEntry::Question { answer, .. } = entry else {
            return;
        };
        *answer = Some(text);
        outbox.entries.push(entry.clone());
    }

    fn finish_tool(&mut self, outbox: &mut Outbox, tool_use_id: &str, failed: bool) {
        // `TodoWrite` und `AskUserQuestion` liefern ein Ergebnis ohne vorheriges `ToolStarted`.
        let Some(&seq) = self.tool_seqs.get(tool_use_id) else {
            return;
        };
        let Some(entry) = self.entries.get_mut(seq as usize) else {
            return;
        };
        let ChatEntry::Tool { state, .. } = entry else {
            return;
        };
        if *state != ToolState::Running {
            return;
        }
        *state = if failed {
            ToolState::Failed
        } else {
            ToolState::Done
        };
        outbox.entries.push(entry.clone());
    }

    /// Ein unterbrochener Aufruf kann trotzdem gelaufen sein — deshalb „unterbrochen“, nie „nicht ausgeführt“.
    fn interrupt_running_tools(&mut self, outbox: &mut Outbox) {
        for entry in &mut self.entries {
            let ChatEntry::Tool { state, .. } = entry else {
                continue;
            };
            if *state != ToolState::Running {
                continue;
            }
            *state = ToolState::Interrupted;
            outbox.entries.push(entry.clone());
        }
    }

    fn update_todos(&mut self, outbox: &mut Outbox, items: Vec<TodoItem>) {
        match self.todos_seq {
            Some(seq) => self.replace_entry(outbox, ChatEntry::Todos { seq, items }),
            None => {
                let seq = self.push_entry(outbox, |seq: u32| ChatEntry::Todos { seq, items });
                self.todos_seq = Some(seq);
            }
        }
    }

    /// Antworten, die nie mehr kommen: die Fragen bleiben sichtbar, aber nicht mehr offen.
    fn abandon_pending(&mut self, outbox: &mut Outbox, label: &str) {
        for (_, request) in std::mem::take(&mut self.pending) {
            self.set_question_answer(outbox, request.seq, label.to_owned());
        }
    }

    fn next_request_id(&mut self) -> String {
        self.next_request += 1;
        format!("app-{}", self.next_request)
    }

    /// Schickt eine Steueranfrage — an einen Prozess, der nicht mehr zuhört, nur nicht.
    fn send_control(&mut self, outbox: &mut Outbox, request: Value) -> Result<(), CommandError> {
        let is_listening = self.process.is_some()
            && !matches!(self.status, SessionStatus::Cancelled | SessionStatus::Error);
        if !is_listening {
            return Ok(());
        }
        let request_id = self.next_request_id();
        outbox.write(self, control_request(&request_id, request))
    }

    fn apply_event(&mut self, outbox: &mut Outbox, event: AgentEvent) {
        match event {
            AgentEvent::Ready { .. } => {
                if !self.has_agent_history {
                    self.has_agent_history = true;
                    outbox.summary_dirty = true;
                }
                if self.status == SessionStatus::Starting {
                    self.set_status(outbox, SessionStatus::Running);
                }
            }
            AgentEvent::Text(text) => {
                self.push_entry(outbox, |seq: u32| ChatEntry::Text { seq, text });
            }
            AgentEvent::Thinking { text, seconds } => {
                self.push_entry(outbox, |seq: u32| ChatEntry::Thinking {
                    seq,
                    text,
                    seconds,
                });
            }
            AgentEvent::ToolStarted {
                tool_use_id,
                tool,
                target,
            } => {
                let entry_tool_use_id = tool_use_id.clone();
                let seq = self.push_entry(outbox, |seq: u32| ChatEntry::Tool {
                    seq,
                    tool_use_id: entry_tool_use_id,
                    tool,
                    target,
                    state: ToolState::Running,
                });
                self.tool_seqs.insert(tool_use_id, seq);
            }
            AgentEvent::ToolFinished {
                tool_use_id,
                failed,
            } => self.finish_tool(outbox, &tool_use_id, failed),
            AgentEvent::Todos(items) => self.update_todos(outbox, items),
            AgentEvent::QuestionAsked {
                request_id,
                question_kind,
                questions,
                input,
            } => self.ask(outbox, request_id, question_kind, questions, input),
            AgentEvent::ContextUsed(used) => {
                if self.context_used != used {
                    self.context_used = used;
                    outbox.summary_dirty = true;
                }
            }
            AgentEvent::TurnEnded {
                end,
                context_window,
            } => self.end_turn(outbox, end, context_window),
            AgentEvent::Unknown(line) => self.push_log(line),
        }
    }

    fn ask(
        &mut self,
        outbox: &mut Outbox,
        request_id: String,
        question_kind: QuestionKind,
        questions: Vec<Question>,
        input: Value,
    ) {
        let entry_request_id = request_id.clone();
        let entry_questions = questions.clone();
        let seq = self.push_entry(outbox, |seq: u32| ChatEntry::Question {
            seq,
            request_id: entry_request_id,
            question_kind,
            questions: entry_questions,
            answer: None,
        });
        self.pending.push((
            request_id,
            PendingRequest {
                question_kind,
                questions,
                input,
                seq,
            },
        ));
        self.set_status(outbox, SessionStatus::Waiting);
    }

    fn end_turn(&mut self, outbox: &mut Outbox, end: TurnEnd, context_window: Option<u32>) {
        if let Some(window) = context_window
            && window != self.context_window
        {
            self.context_window = window;
            outbox.summary_dirty = true;
        }
        self.todos_seq = None;
        if self.cancel_requested {
            return;
        }
        match end {
            TurnEnd::Aborted => self.pause_after_interrupt(outbox),
            _ if self.pause_requested => self.pause_after_interrupt(outbox),
            TurnEnd::Failed(text) => {
                self.interrupt_running_tools(outbox);
                self.abandon_pending(outbox, "Nicht beantwortet");
                self.push_entry(outbox, |seq: u32| ChatEntry::Error {
                    seq,
                    title: "Fehler vom Agenten".to_owned(),
                    text,
                });
                self.set_status(outbox, SessionStatus::Error);
            }
            TurnEnd::Completed => self.set_status(outbox, SessionStatus::Completed),
        }
    }

    fn pause_after_interrupt(&mut self, outbox: &mut Outbox) {
        self.interrupt_running_tools(outbox);
        self.set_status(outbox, SessionStatus::Paused);
        self.pause_requested = false;
    }

    fn process_exited(&mut self, outbox: &mut Outbox, exit_code: Option<i32>) {
        self.process = None;
        if self.cancel_requested || self.status == SessionStatus::Error {
            return;
        }
        self.interrupt_running_tools(outbox);
        self.abandon_pending(outbox, "Nicht beantwortet");
        let code = exit_code.map_or_else(|| "unbekannt".to_owned(), |value: i32| value.to_string());
        self.push_entry(outbox, |seq: u32| ChatEntry::Error {
            seq,
            title: "Agent beendet".to_owned(),
            text: format!("Claude wurde unerwartet beendet (Exit-Code {code})."),
        });
        self.set_status(outbox, SessionStatus::Error);
    }
}

impl Outbox {
    /// Reiht eine Zeile für den Prozess der Session ein; ohne Prozess gibt es niemanden, der sie liest.
    fn write(&mut self, state: &SessionState, line: String) -> Result<(), CommandError> {
        let Some(process) = &state.process else {
            return Err(CommandError::AgentStopped);
        };
        self.process = Some(Arc::clone(process));
        self.lines.push(line);
        Ok(())
    }

    /// Schließt den Prozess nach den eingereihten Zeilen (siehe `retire_process`).
    fn retire(&mut self, state: &SessionState) {
        if let Some(process) = &state.process {
            self.process = Some(Arc::clone(process));
            self.retire = true;
        }
    }

    fn emit(&self, app: &AppHandle, session: &Session) {
        for entry in &self.entries {
            let event = ChatEntryEvent {
                session_id: session.id.clone(),
                entry: entry.clone(),
            };
            if let Err(error) = app.emit(CHAT_ENTRY_EVENT, event) {
                session.log_line(format!("Chat-Ereignis nicht gesendet: {error}"));
            }
        }
        if let Some(summary) = &self.summary
            && let Err(error) = app.emit(SESSION_CHANGED_EVENT, summary)
        {
            session.log_line(format!("Session-Ereignis nicht gesendet: {error}"));
        }
    }

    fn deliver(self, session: &Session) -> Result<(), CommandError> {
        let Some(process) = self.process else {
            return Ok(());
        };
        let mut delivered = Ok(());
        for line in &self.lines {
            if let Err(error) = process.write_line(line) {
                session.log_line(format!("Schreiben an den Agenten fehlgeschlagen: {error}"));
                delivered = Err(CommandError::AgentStopped);
                break;
            }
        }
        if self.retire {
            retire_process(process);
        }
        delivered
    }
}

/// Verändert den Zustand unter der Sperre und verschickt die Folgen danach.
fn update<R>(
    app: &AppHandle,
    session: &Arc<Session>,
    change: impl FnOnce(&mut SessionState, &mut Outbox) -> Result<R, CommandError>,
) -> Result<R, CommandError> {
    let mut outbox = Outbox::default();
    let result = {
        let mut state = session.lock_loaded()?;
        let result = change(&mut state, &mut outbox);
        // Auch bei einem Fehler: die Closure kann den Zustand schon verändert haben.
        persist(session, &mut state, &outbox);
        if outbox.summary_dirty {
            outbox.summary = Some(summarize(session, &state));
        }
        result
    };
    outbox.emit(app, session);
    let value = result?;
    outbox.deliver(session)?;
    Ok(value)
}

fn row_of(session: &Session, state: &SessionState) -> SessionRow {
    SessionRow {
        id: session.id.clone(),
        name: state.name.clone(),
        status: state.status,
        model: state.model,
        effort: state.effort,
        mode: state.mode,
        created_at: state.created_at,
        running_ms: state.running_ms,
        context_used: state.context_used,
        context_window: state.context_window,
        has_agent_history: state.has_agent_history,
        workspace_dir: Some(session.workspace.to_string_lossy().into_owned()),
    }
}

/// Schreibt, was der `Outbox` an Änderungen trägt, in die Datenbank — unter der Session-Sperre,
/// damit zwei Änderungen derselben Session nicht in vertauschter Reihenfolge ankommen.
/// Ein Fehler landet im Protokoll der Session; die Session läuft weiter.
fn persist(session: &Session, state: &mut SessionState, outbox: &Outbox) {
    let saved = session.database.with(|connection| {
        // Erst die Session, dann ihre Einträge: die Einträge verweisen auf die Zeile.
        if outbox.summary_dirty {
            session_rows::upsert(connection, &row_of(session, state))?;
        }
        if !outbox.entries.is_empty() {
            chat_entries::upsert_all(connection, &session.id, &outbox.entries)?;
        }
        Ok(())
    });
    if let Err(error) = saved {
        state.push_log(format!("Speichern fehlgeschlagen: {error}"));
    }
}

fn summarize(session: &Session, state: &SessionState) -> SessionSummary {
    SessionSummary {
        id: session.id.clone(),
        name: state.name.clone(),
        status: state.status,
        model: state.model,
        effort: state.effort,
        mode: state.mode,
        created_at: state.created_at,
        running_ms: state.running_ms,
        running_since: state.running_since,
        context_used: state.context_used,
        context_window: state.context_window,
        repository_count: u32::try_from(session.repositories.len()).unwrap_or(u32::MAX),
    }
}

fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed: Duration| elapsed.as_secs_f64() * 1000.0)
}

/// Startet den Agenten neu und ersetzt einen noch laufenden Prozess. Kennt Claude die Session
/// schon (`has_agent_history`), setzt der Start sie mit ihrem Verlauf fort (`--resume`), sonst
/// legt er sie unter der Session-ID an (`--session-id`).
///
/// Vorher prüft `worktrees::ensure` die Worktrees: fehlende Ordner entstehen neu, ein Repository
/// ohne Haupt-Checkout bleibt draußen und bekommt einen Fehler-Eintrag im Chat.
fn start_process(
    app: &AppHandle,
    session: &Arc<Session>,
    state: &mut SessionState,
    outbox: &mut Outbox,
) -> Result<(), CommandError> {
    let resume = state.has_agent_history;
    let exe = find_claude().ok_or(CommandError::ClaudeNotFound)?;
    let mut add_dirs: Vec<PathBuf> = Vec::with_capacity(session.repositories.len());
    for check in worktrees::ensure(&session.workspace, &session.repositories) {
        match check {
            WorktreeCheck::Ready(path) => add_dirs.push(path),
            WorktreeCheck::Missing { name, reason } => {
                state.push_entry(outbox, |seq: u32| ChatEntry::Error {
                    seq,
                    title: "Repository nicht gefunden".to_owned(),
                    text: format!(
                        "{name}: {reason} Der Agent arbeitet ohne dieses Repository weiter."
                    ),
                });
            }
        }
    }
    if let Some(previous) = state.process.take() {
        retire_process(previous);
    }
    state.generation += 1;
    let generation = state.generation;
    let callback_app = app.clone();
    let callback_session = Arc::clone(session);
    let process = spawn(
        SpawnOptions {
            exe,
            cwd: session.workspace.clone(),
            session_id: session.id.clone(),
            resume,
            model: state.model,
            effort: state.effort,
            mode: state.mode,
            add_dirs,
        },
        move |output: ProcessOutput| {
            handle_output(&callback_app, &callback_session, generation, output);
        },
    )?;
    state.process = Some(Arc::new(process));
    state.process_effort = state.effort;
    state.translator = Translator::default();
    Ok(())
}

/// Ohne Standardeingabe beendet sich ein ruhender Agent selbst; der Abschuss nach der Frist
/// fängt einen ab, der hängt.
fn retire_process(process: Arc<ClaudeProcess>) {
    process.close_stdin();
    let killer = Arc::clone(&process);
    let spawned = thread::Builder::new()
        .name("claude-retire".to_owned())
        .spawn(move || {
            thread::sleep(KILL_GRACE);
            killer.kill();
        });
    if spawned.is_err() {
        process.kill();
    }
}

/// Räumt die Worktrees erst auf, wenn der Agent sicher beendet ist (`retire_process`): Windows
/// verweigert das Löschen von Dateien, die ein laufender Prozess offen hält. Startet der Thread
/// nicht, bleiben die Worktrees liegen — für den Nutzer kein Fehler.
fn schedule_worktree_cleanup(workspace: PathBuf, repositories: Vec<SessionRepository>) {
    let _ = thread::Builder::new()
        .name("worktree-cleanup".to_owned())
        .spawn(move || {
            thread::sleep(KILL_GRACE + CLEANUP_MARGIN);
            worktrees::remove_clean(&workspace, &repositories);
        });
}

fn handle_output(app: &AppHandle, session: &Arc<Session>, generation: u32, output: ProcessOutput) {
    // Die Ausgabeverarbeitung schreibt nie in den Prozess — es gibt keinen Fehler zu melden.
    let _ = update(
        app,
        session,
        |state: &mut SessionState, outbox: &mut Outbox| {
            if state.generation != generation {
                state.push_log(describe_stale(output));
                return Ok(());
            }
            match output {
                ProcessOutput::Stderr(line) => state.push_log(line),
                ProcessOutput::Line(line) => {
                    for event in state.translator.handle_line(&line) {
                        state.apply_event(outbox, event);
                    }
                }
                ProcessOutput::Exited(exit_code) => state.process_exited(outbox, exit_code),
            }
            Ok(())
        },
    );
}

fn describe_stale(output: ProcessOutput) -> String {
    match output {
        ProcessOutput::Line(line) | ProcessOutput::Stderr(line) => line,
        ProcessOutput::Exited(code) => format!("Ersetzter Agent-Prozess beendet ({code:?})"),
    }
}

/// Lehnt offene Rückfragen ab und unterbricht die laufende Antwort.
fn interrupt_agent(
    state: &mut SessionState,
    outbox: &mut Outbox,
    deny_message: &str,
    answer_label: &str,
) -> Result<(), CommandError> {
    for (request_id, request) in std::mem::take(&mut state.pending) {
        outbox.write(state, deny(&request_id, deny_message))?;
        state.set_question_answer(outbox, request.seq, answer_label.to_owned());
    }
    if state.status == SessionStatus::Waiting {
        state.set_status(outbox, SessionStatus::Running);
    }
    state.send_control(outbox, json!({ "subtype": "interrupt" }))
}

/// Freier Text im Eingabefeld beantwortet die älteste offene Anfrage.
fn answer_oldest_with_text(
    state: &mut SessionState,
    outbox: &mut Outbox,
    text: &str,
) -> Result<(), CommandError> {
    let Some((request_id, request)) = state.pending.first() else {
        return Ok(());
    };
    let answer = match request.question_kind {
        QuestionKind::AskUser => QuestionAnswer::Options {
            answers: vec![text.to_owned(); request.questions.len()],
        },
        QuestionKind::Permission => QuestionAnswer::Deny {
            message: text.to_owned(),
        },
    };
    let request_id = request_id.clone();
    apply_answer(state, outbox, &request_id, &answer)
}

fn apply_answer(
    state: &mut SessionState,
    outbox: &mut Outbox,
    request_id: &str,
    answer: &QuestionAnswer,
) -> Result<(), CommandError> {
    let Some(position) = state
        .pending
        .iter()
        .position(|(pending_id, _)| pending_id == request_id)
    else {
        return Err(CommandError::Internal("Rückfrage nicht offen".to_owned()));
    };
    let (line, label, seq) = {
        let (_, request) = &state.pending[position];
        let (line, label) = answer_line(request_id, request, answer)?;
        (line, label, request.seq)
    };
    outbox.write(state, line)?;
    state.pending.remove(position);
    state.set_question_answer(outbox, seq, label);
    if state.pending.is_empty() && state.status == SessionStatus::Waiting {
        state.set_status(outbox, SessionStatus::Running);
    }
    Ok(())
}

/// Die Antwortzeile für den Agenten und der Text, den der Chat als Antwort anzeigt.
fn answer_line(
    request_id: &str,
    request: &PendingRequest,
    answer: &QuestionAnswer,
) -> Result<(String, String), CommandError> {
    match answer {
        QuestionAnswer::Options { answers } => {
            if request.question_kind != QuestionKind::AskUser
                || answers.len() != request.questions.len()
            {
                return Err(CommandError::Internal(
                    "Antwort passt nicht zur Rückfrage".to_owned(),
                ));
            }
            let answered: Map<String, Value> = request
                .questions
                .iter()
                .zip(answers)
                .map(|(question, choice)| {
                    (question.question.clone(), Value::String(choice.clone()))
                })
                .collect();
            let mut updated_input = request.input.clone();
            if let Value::Object(fields) = &mut updated_input {
                fields.insert("answers".to_owned(), Value::Object(answered));
            }
            Ok((
                allow(request_id, updated_input),
                answers.join(ANSWER_SEPARATOR),
            ))
        }
        QuestionAnswer::Allow => Ok((
            allow(request_id, request.input.clone()),
            "Erlaubt".to_owned(),
        )),
        QuestionAnswer::Deny { message } => {
            Ok((deny(request_id, message), format!("Abgelehnt: {message}")))
        }
    }
}
