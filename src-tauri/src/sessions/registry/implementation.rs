//! Umsetzungen der Vorhaben (ADR 048): was die Registry an Sessions beisteuert. Die Zeilen liegen
//! in `db::implementations`, die Ansicht baut `crate::implementation::build_view`.
//!
//! Sperren: erst die Datenbank lesen, dann jede Station-Session einzeln und kurz sperren — nie zwei
//! Session-Sperren zugleich, nie `Database::with` unter einer Session-Sperre.
use std::collections::HashMap;
use std::sync::{Arc, MutexGuard, PoisonError};

use tauri::AppHandle;

use super::{
    Outbox, PendingRequest, ProjectState, Session, SessionRegistry, SessionState, now_ms,
    summarize, update,
};
use crate::agents::event::{Attachment, Effort, ModelId};
use crate::attachments;
use crate::changes::{self, model::ChangesReach};
use crate::db::implementations::{
    self as implementation_rows, BegunPhaseChange, ChangeRow, PhaseRow, StationRow,
    StoredImplementation,
};
use crate::error::CommandError;
use crate::file_links;
use crate::implementation::changes as implementation_changes;
use crate::implementation::model::{
    ImplementationView, InquiryCreated, OpenQuestion, PendingCancel, PhaseInput, PhaseView,
    StationView,
};
use crate::implementation::report::{self, Extras};
use crate::implementation::{Countdowns, SessionLive, build_view, new_rows};
use crate::limit_resume::LimitResumes;
use crate::sessions::model::SessionStatus;
use crate::settings;

const NO_IMPLEMENTATION: &str = "In diesem Vorhaben gibt es keine Umsetzung.";
const IS_FINISHED: &str = "Umsetzung ist schon abgeschlossen.";
const NOT_DELETABLE: &str = "Nur abgebrochene oder nie gestartete Umsetzungen lassen sich löschen.";
const NO_CANCEL_REQUEST: &str = "Es liegt keine Anfrage zum Abbrechen vor.";

/// Ein neuerer Lagebericht für eine Rückfrage: die Datei und was `send` im Zustand vermerkt.
pub(super) struct ReportUpdate {
    pub attachment: Attachment,
    /// Der Bericht ohne die Zeile „Lage“, für den nächsten Vergleich.
    pub stripped: String,
    /// Stand des Berichts in ms.
    pub at: f64,
    pub summary: String,
}

impl SessionRegistry {
    /// Alle Umsetzungen nicht archivierter Vorhaben, neueste zuerst.
    pub fn implementation_views(&self) -> Result<Vec<ImplementationView>, CommandError> {
        let stored = self
            .database
            .with(|connection| implementation_rows::load_all(connection))?;
        let active: Vec<StoredImplementation> = {
            let projects = self.lock_projects();
            stored
                .into_iter()
                .filter(|item: &StoredImplementation| projects.contains_key(&item.row.project_id))
                .collect()
        };
        Ok(active
            .iter()
            .map(|item: &StoredImplementation| self.view_of(item))
            .collect())
    }

    /// Eine Umsetzung nach ID.
    pub fn implementation_view(&self, id: &str) -> Result<ImplementationView, CommandError> {
        let stored = self
            .database
            .with(|connection| implementation_rows::load(connection, id))?
            .ok_or_else(|| {
                CommandError::Implementation(format!("Umsetzung nicht gefunden: {id}"))
            })?;
        Ok(self.view_of(&stored))
    }

    /// Für eine Station ihre Umsetzung, sonst die neueste des Vorhabens der Session.
    pub fn implementation_of_session(
        &self,
        session_id: &str,
    ) -> Result<Option<ImplementationView>, CommandError> {
        let session = self.get(session_id)?;
        let station_of: Option<String> = session.lock().station_of.clone();
        let id = match station_of {
            Some(id) => Some(id),
            None => self.database.with(|connection| {
                implementation_rows::latest_of_project(connection, &session.project_id)
            })?,
        };
        id.map(|id: String| self.implementation_view(&id))
            .transpose()
    }

    /// Wie `implementation_of_session`, ohne Umsetzung ein Fehler mit dem Satz für den Agenten.
    pub fn require_implementation_of_session(
        &self,
        session_id: &str,
    ) -> Result<ImplementationView, CommandError> {
        self.implementation_of_session(session_id)?
            .ok_or_else(|| CommandError::Implementation(NO_IMPLEMENTATION.to_owned()))
    }

    /// Legt im Vorhaben der Session eine Umsetzung an; `phases` sind schon geprüft
    /// (`model::validate`). Prüfung auf eine unfertige Umsetzung und Anlegen laufen unter derselben
    /// Datenbank-Sperre, damit zwei gleichzeitige Aufrufe nicht beide durchkommen.
    pub fn create_implementation(
        &self,
        session_id: &str,
        name: &str,
        source: &str,
        phases: &[PhaseInput],
    ) -> Result<ImplementationView, CommandError> {
        let project_id = self.get(session_id)?.project_id.clone();
        let (row, phase_rows, station_rows) =
            new_rows(&project_id, session_id, name, source, phases, now_ms());
        self.database.with(|connection| {
            if let Some((_, running)) =
                implementation_rows::unfinished_of_project(connection, &project_id)?
            {
                return Err(CommandError::Implementation(format!(
                    "Im Vorhaben läuft schon die Umsetzung „{running}“."
                )));
            }
            implementation_rows::insert(connection, &row, &phase_rows, &station_rows)
        })?;
        self.implementation_view(&row.id)
    }

    /// Ändert Titel und Beschreibung einer Phase, auch einer fertigen; `None` lässt den Text stehen.
    pub fn describe_implementation_phase(
        &self,
        session_id: &str,
        key: &str,
        title: Option<&str>,
        description: Option<&str>,
    ) -> Result<ImplementationView, CommandError> {
        let view = self.require_implementation_of_session(session_id)?;
        let Some(phase) = view
            .phases
            .iter()
            .find(|phase: &&PhaseView| phase.key == key)
        else {
            return Err(CommandError::Implementation(format!(
                "key: keine Phase „{key}“ in der Umsetzung „{}“",
                view.name
            )));
        };
        let title = title.map_or(phase.title.as_str(), str::trim);
        let description = description.map_or(phase.description.as_str(), str::trim);
        self.database.with(|connection| {
            implementation_rows::update_phase_text(connection, &phase.id, title, description)
        })?;
        self.implementation_view(&view.id)
    }

    /// (Umsetzung, Station) einer Session, die eine Station ist.
    pub fn station_of_session(
        &self,
        session_id: &str,
    ) -> Result<Option<(String, String)>, CommandError> {
        self.database
            .with(|connection| implementation_rows::station_of_session(connection, session_id))
    }

    /// Bindet die Station an ihre frische Session und merkt die Session als Station. Die
    /// Datenbank-Zeile zuerst, damit eine Fertigmeldung der Session die Station schon findet.
    pub fn bind_station(
        &self,
        app: &AppHandle,
        implementation_id: &str,
        station_id: &str,
        session_id: &str,
    ) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        self.database.with(|connection| {
            implementation_rows::set_station_session(connection, station_id, session_id, now_ms())
        })?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.station_of = Some(implementation_id.to_owned());
                outbox.summary_dirty = true;
                Ok(())
            },
        )
    }

    /// Schreibt eine Zeile ins Protokoll der Session; unbekannte Sessions bleiben still.
    pub fn log_session_line(&self, session_id: &str, line: String) {
        if let Ok(session) = self.get(session_id) {
            session.log_line(line);
        }
    }

    /// Meldet die Station fertig und hängt `followups` dahinter an (eine Datenbank-Transaktion).
    pub fn store_station_completion(
        &self,
        station_id: &str,
        result: &str,
        followups: &[StationRow],
    ) -> Result<(), CommandError> {
        self.database.with(|connection| {
            implementation_rows::complete_station_with_followups(
                connection,
                station_id,
                now_ms(),
                result,
                followups,
            )
        })
    }

    /// Ändert Modell und Aufwand einer Station, die noch nicht begonnen hat. Hat sie zwischen
    /// Prüfung und Schreiben begonnen, ändert die Datenbank nichts und es kommt derselbe Fehler.
    pub fn set_station_plan(
        &self,
        station_id: &str,
        model: Option<ModelId>,
        effort: Option<Effort>,
    ) -> Result<(), CommandError> {
        let changed: usize = self.database.with(|connection| {
            implementation_rows::set_station_plan(connection, station_id, model, effort)
        })?;
        if changed == 0 {
            return Err(CommandError::Implementation(
                "Die Station hat schon begonnen.".to_owned(),
            ));
        }
        Ok(())
    }

    /// Setzt Automatik, Halt-Schalter und Abschluss der Umsetzung.
    pub fn store_implementation_flags(
        &self,
        implementation_id: &str,
        auto_start: bool,
        stop_after_current: bool,
        finished_at: Option<f64>,
    ) -> Result<(), CommandError> {
        self.database.with(|connection| {
            implementation_rows::set_flags(
                connection,
                implementation_id,
                auto_start,
                stop_after_current,
                finished_at,
            )
        })
    }

    /// Gibt der Umsetzung den Namen, den der Nutzer gewählt hat.
    pub fn rename_implementation(
        &self,
        implementation_id: &str,
        name: &str,
    ) -> Result<(), CommandError> {
        let name = super::trimmed_name(name)?;
        self.implementation_view(implementation_id)?;
        self.database
            .with(|connection| implementation_rows::rename(connection, implementation_id, &name))
    }

    /// Bricht die Umsetzung ab (ADR 060): abgeschlossen, Automatik aus, Vorschlag und Anfrage
    /// verworfen, Countdowns beendet. Eine arbeitende Station sperrt, dann ändert sich nichts.
    pub fn cancel_implementation(&self, id: &str) -> Result<ImplementationView, CommandError> {
        let view = self.implementation_view(id)?;
        if view.finished_at.is_some() {
            return Err(CommandError::Implementation(IS_FINISHED.to_owned()));
        }
        self.check_not_running(&view)?;
        self.database
            .with(|connection| implementation_rows::cancel(connection, id, now_ms()))?;
        self.cancel_countdowns_of(&view);
        self.cancel_limit_resumes_of(&view);
        self.implementation_view(id)
    }

    /// Löscht eine abgebrochene oder nie begonnene Umsetzung samt Phasen, Stationen und Verlauf
    /// (ADR 060). Die Sessions bleiben; was im Speicher auf die Umsetzung zeigt, wird geleert.
    pub fn delete_implementation(&self, app: &AppHandle, id: &str) -> Result<(), CommandError> {
        let view = self.implementation_view(id)?;
        self.check_not_running(&view)?;
        if !implementation_changes::may_delete(&view) {
            return Err(CommandError::Implementation(NOT_DELETABLE.to_owned()));
        }
        self.cancel_countdowns_of(&view);
        self.cancel_limit_resumes_of(&view);
        self.database
            .with(|connection| implementation_rows::delete(connection, id))?;
        for member in self.project_sessions(&view.project_id) {
            let is_linked: bool = {
                let state = member.lock();
                state.station_of.as_deref() == Some(id) || state.inquiry_of.as_deref() == Some(id)
            };
            if !is_linked {
                continue;
            }
            update(
                app,
                &member,
                |state: &mut SessionState, outbox: &mut Outbox| {
                    if state.station_of.as_deref() == Some(id) {
                        state.station_of = None;
                    }
                    if state.inquiry_of.as_deref() == Some(id) {
                        state.inquiry_of = None;
                        state.last_report = None;
                    }
                    outbox.summary_dirty = true;
                    Ok(())
                },
            )?;
        }
        Ok(())
    }

    /// `implementation_cancel`: legt die Anfrage eines Agenten ab und beendet die Countdowns; sonst
    /// ändert sich nichts, bis der Benutzer bestätigt (ADR 060).
    pub fn request_cancel(
        &self,
        session_id: &str,
        reason: &str,
        delete: bool,
    ) -> Result<ImplementationView, String> {
        let view = self
            .require_implementation_of_session(session_id)
            .map_err(|error: CommandError| error.to_string())?;
        if view.finished_at.is_some() {
            return Err(IS_FINISHED.to_owned());
        }
        if delete && !implementation_changes::may_delete(&view) {
            return Err(NOT_DELETABLE.to_owned());
        }
        if view.pending_cancel.is_some() {
            return Err("Es liegt schon eine Anfrage vor.".to_owned());
        }
        let pending = PendingCancel {
            session_id: session_id.to_owned(),
            session_number: self.session_number(session_id),
            at: now_ms(),
            reason: reason.trim().to_owned(),
            delete,
        };
        // Erst ablegen, dann Countdowns beenden: ein Zeitgeber dazwischen sieht die Anfrage schon.
        self.database
            .with(|connection| {
                implementation_rows::set_pending_cancel(connection, &view.id, Some(&pending))
            })
            .map_err(|error: CommandError| error.to_string())?;
        self.cancel_countdowns_of(&view);
        self.implementation_view(&view.id)
            .map_err(|error: CommandError| error.to_string())
    }

    /// „Verwerfen“ der Anfrage; das Neuplanen der Stationen übernimmt der Aufrufer.
    pub fn discard_cancel(&self, id: &str) -> Result<ImplementationView, CommandError> {
        let view = self.implementation_view(id)?;
        if view.pending_cancel.is_none() {
            return Err(CommandError::Implementation(NO_CANCEL_REQUEST.to_owned()));
        }
        self.database
            .with(|connection| implementation_rows::set_pending_cancel(connection, id, None))?;
        self.implementation_view(id)
    }

    /// Sperrt, solange eine Station arbeitet oder ihre Session gerade angelegt wird.
    fn check_not_running(&self, view: &ImplementationView) -> Result<(), CommandError> {
        let starting: Option<(String, String)> = {
            let countdowns = self.lock_countdowns();
            view.phases.iter().find_map(|phase: &PhaseView| {
                phase
                    .stations
                    .iter()
                    .find(|station: &&StationView| countdowns.is_starting(&station.id))
                    .map(|station: &StationView| (phase.key.clone(), station.stage.clone()))
            })
        };
        match implementation_changes::blocking_station(view).or(starting) {
            Some((key, stage)) => Err(CommandError::Implementation(format!(
                "Station „{stage}“ in Phase {key} läuft noch. „Nach dieser anhalten“ einschalten \
                 und abbrechen, sobald sie fertig ist."
            ))),
            None => Ok(()),
        }
    }

    fn cancel_countdowns_of(&self, view: &ImplementationView) {
        let mut countdowns = self.lock_countdowns();
        for station in view
            .phases
            .iter()
            .flat_map(|phase: &PhaseView| phase.stations.iter())
        {
            countdowns.cancel(&station.id);
        }
    }

    /// Beendet das Warten aufs Kontingent jeder Station der Umsetzung (ADR 063).
    fn cancel_limit_resumes_of(&self, view: &ImplementationView) {
        let mut resumes = self.lock_limit_resumes();
        for session_id in view
            .phases
            .iter()
            .flat_map(|phase: &PhaseView| phase.stations.iter())
            .filter_map(|station: &StationView| station.session_id.as_deref())
        {
            resumes.cancel(session_id);
        }
    }

    /// Nummer der Session im Vorhaben; 0 für eine unbekannte.
    pub fn session_number(&self, session_id: &str) -> u32 {
        self.get(session_id)
            .map_or(0, |session: Arc<Session>| session.number)
    }

    /// Ersetzt die kommenden Phasen in einem Zug (siehe `replace_upcoming_phases`).
    pub fn store_plan_change(
        &self,
        implementation_id: &str,
        removed_phase_ids: &[String],
        begun: &[BegunPhaseChange],
        phases: &[PhaseRow],
        stations: &[StationRow],
        change: Option<&ChangeRow>,
    ) -> Result<(), CommandError> {
        self.database.with(|connection| {
            implementation_rows::replace_upcoming_phases(
                connection,
                implementation_id,
                removed_phase_ids,
                begun,
                phases,
                stations,
                change,
            )
        })
    }

    pub fn clear_phase_mark(&self, phase_id: &str) -> Result<(), CommandError> {
        self.database
            .with(|connection| implementation_rows::clear_phase_mark(connection, phase_id))
    }

    /// Beginnt den Countdown der Station; ein laufender wird ersetzt. Gibt die Marke zurück.
    pub fn begin_countdown(&self, station_id: &str, ends_at: f64) -> u64 {
        self.lock_countdowns().begin(station_id, ends_at)
    }

    /// `true`, wenn der Countdown mit dieser Marke noch galt; er ist danach weg.
    pub fn take_countdown(&self, station_id: &str, token: u64) -> bool {
        self.lock_countdowns().take(station_id, token)
    }

    /// `true`, wenn ein Countdown lief.
    pub fn cancel_countdown(&self, station_id: &str) -> bool {
        self.lock_countdowns().cancel(station_id)
    }

    /// Hat nur der erste Aufrufer Erfolg, bis `release_start` folgt: schützt vor zwei Sessions für
    /// dieselbe Station (Zeitgeber und ▶ zugleich).
    pub fn claim_start(&self, station_id: &str) -> bool {
        self.lock_countdowns().claim_start(station_id)
    }

    pub fn release_start(&self, station_id: &str) {
        self.lock_countdowns().release_start(station_id);
    }

    /// Einstellung „Nach Kontingent-Limit automatisch weiter“; ohne lesbare Einstellungen aus.
    pub fn auto_continue_at_limit(&self) -> bool {
        settings::load(&self.database)
            .is_ok_and(|loaded: settings::model::Settings| loaded.auto_continue_at_limit)
    }

    /// Beginnt das Warten der Session aufs Kontingent; ein laufendes wird ersetzt, der Versuch
    /// zählt. Gibt die Marke zurück.
    pub fn begin_limit_resume(&self, session_id: &str, resume_at: f64) -> u64 {
        self.lock_limit_resumes().begin(session_id, resume_at)
    }

    /// `true`, wenn das Warten mit dieser Marke noch galt; es ist danach weg.
    pub fn take_limit_resume(&self, session_id: &str, token: u64) -> bool {
        self.lock_limit_resumes().take(session_id, token)
    }

    pub fn holds_limit_resume(&self, session_id: &str, token: u64) -> bool {
        self.lock_limit_resumes().holds(session_id, token)
    }

    /// `true`, wenn die Session wartete.
    pub fn cancel_limit_resume(&self, session_id: &str) -> bool {
        self.lock_limit_resumes().cancel(session_id)
    }

    pub fn limit_resume_attempts(&self, session_id: &str) -> u32 {
        self.lock_limit_resumes().attempts(session_id)
    }

    pub(super) fn lock_limit_resumes(&self) -> MutexGuard<'_, LimitResumes> {
        self.limit_resumes
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    fn lock_countdowns(&self) -> MutexGuard<'_, Countdowns> {
        self.implementation_countdowns
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// Der Lagebericht, wie Agent, Ansicht und Rückfragen ihn lesen: dazu „Ziel“ aus der README
    /// der Quelle und die Zahl der geänderten Dateien. Liest Dateien und Git, also nie unter einer
    /// Sperre aufrufen.
    pub fn report_text(&self, view: &ImplementationView, for_inquiry: bool, now: f64) -> String {
        report::text_with(view, now, for_inquiry, &self.report_extras(view))
    }

    fn report_extras(&self, view: &ImplementationView) -> Extras {
        let Some(anchor) = self.project_members(&view.project_id).pop() else {
            return Extras::default();
        };
        let Ok(input) = self.changes_input(&anchor.id, ChangesReach::Project) else {
            return Extras::default();
        };
        let loaded = changes::load(&input);
        let counted: Vec<usize> = loaded
            .repositories
            .iter()
            .filter(|repository| repository.error.is_none())
            .map(|repository| {
                repository
                    .files
                    .iter()
                    .filter(|file| file.all.is_some())
                    .count()
            })
            .collect();
        Extras {
            goal: report::goal_of(&view.source, &file_links::roots(&input)),
            changed_files: (!counted.is_empty())
                .then(|| u32::try_from(counted.iter().sum::<usize>()).unwrap_or(u32::MAX)),
        }
    }

    /// Legt eine Rückfrage zur Umsetzung an: eine frische Session im Vorhaben, der Lagebericht als
    /// ungesendeter Anhang. Wie viel vom Bericht die Session schon kennt, steht in `last_report`.
    pub fn new_inquiry(
        &self,
        app: &AppHandle,
        implementation_id: &str,
    ) -> Result<InquiryCreated, CommandError> {
        let view = self.implementation_view(implementation_id)?;
        let created = self.create_fresh_in_project(&view.project_id)?;
        let now = now_ms();
        let text = self.report_text(&view, true, now);
        let attachment = attachments::add_text(app, &report::file_name(now), &text)?;
        let session = self.get(&created.id)?;
        update(
            app,
            &session,
            |state: &mut SessionState, outbox: &mut Outbox| {
                state.inquiry_of = Some(implementation_id.to_owned());
                state.last_report = Some(report::stripped(&text));
                outbox.summary_dirty = true;
                Ok(())
            },
        )?;
        let summary = summarize(&session, &session.lock());
        Ok(InquiryCreated {
            session: summary,
            attachment,
        })
    }

    /// Hat sich der Lagebericht seit dem letzten Anhang dieser Rückfrage geändert, kommt er als
    /// neue Datei zurück. Keine Rückfrage, keine Änderung oder ein Fehler beim Anlegen: `None` —
    /// das Senden der Nachricht scheitert daran nie.
    pub(super) fn report_update(&self, app: &AppHandle, session: &Session) -> Option<ReportUpdate> {
        let (inquiry_of, last_report) = {
            let state = session.lock();
            (state.inquiry_of.clone(), state.last_report.clone())
        };
        let view = self.implementation_view(&inquiry_of?).ok()?;
        let at = now_ms();
        let text = self.report_text(&view, true, at);
        let stripped = report::stripped(&text);
        if last_report.as_deref() == Some(stripped.as_str()) {
            return None;
        }
        let summary = last_report
            .as_deref()
            .map_or_else(report::unknown_change, |old: &str| {
                report::change_summary(old, &stripped)
            });
        let attachment = attachments::add_text(app, &report::file_name(at), &text).ok()?;
        Some(ReportUpdate {
            attachment,
            stripped,
            at,
            summary,
        })
    }

    /// Name des Vorhabens für Kopfzeilen; leer für ein unbekanntes.
    pub fn project_name(&self, project_id: &str) -> String {
        self.lock_projects()
            .get(project_id)
            .map(|project: &ProjectState| project.name.clone())
            .unwrap_or_default()
    }

    fn view_of(&self, stored: &StoredImplementation) -> ImplementationView {
        let members = self.project_sessions(&stored.row.project_id);
        let numbers: HashMap<String, u32> = members
            .iter()
            .map(|member: &Arc<Session>| (member.id.clone(), member.number))
            .collect();
        let now = now_ms();
        let countdowns: HashMap<String, f64> = self.lock_countdowns().ends();
        let resumes: HashMap<String, f64> = self.lock_limit_resumes().ends();
        let live: HashMap<String, SessionLive> = members
            .iter()
            .filter(|member: &&Arc<Session>| {
                stored.stations.iter().any(|station: &StationRow| {
                    station.session_id.as_deref() == Some(member.id.as_str())
                })
            })
            .map(|member: &Arc<Session>| {
                let resumes_at: Option<f64> = resumes.get(&member.id).copied();
                (member.id.clone(), live_of(member, now, resumes_at))
            })
            .collect();
        build_view(stored, &live, &numbers, &countdowns)
    }
}

/// Liest unter der Sperre dieser einen Session, ohne den Verlauf zu laden.
fn live_of(session: &Session, now: f64, resumes_at: Option<f64>) -> SessionLive {
    let state = session.lock();
    let status = if state.is_awaiting_subagent() {
        SessionStatus::Running
    } else {
        state.status
    };
    let running_ms = state.running_ms
        + state
            .running_since
            .map_or(0.0, |since: f64| (now - since).max(0.0));
    let open_question =
        state
            .pending
            .first()
            .map(
                |(request_id, request): &(String, PendingRequest)| OpenQuestion {
                    seq: request.seq,
                    request_id: request_id.clone(),
                    question_kind: request.question_kind,
                    questions: request.questions.clone(),
                },
            );
    SessionLive {
        status,
        number: session.number,
        running_ms,
        open_question,
        last_activity_at: state.last_activity_at,
        unread: state.last_activity_at > state.seen_at,
        awaits_script: state.awaited_script().is_some(),
        resumes_at,
    }
}
