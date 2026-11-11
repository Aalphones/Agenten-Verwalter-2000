//! Weiter nach dem Kontingent-Limit (ADR 063): erkennt den Limit-Stopp einer Antwort, lässt eine
//! Station bis zum Zurücksetzen des Kontingents warten und schickt ihr dann selbst „weiter“. Nur im
//! Speicher: nach einem App-Neustart wartet nichts (wie ADR 040).

#[cfg(test)]
mod tests;

use std::collections::HashMap;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::implementation::{announce, now_ms};
use crate::sessions::registry::{Session, SessionRegistry};

/// Kontingent ist zum Reset-Zeitpunkt nicht immer sofort frei.
pub const RESUME_BUFFER_MS: f64 = 120_000.0;
/// Wartezeit ohne bekannte Reset-Zeit.
pub const RESUME_FALLBACK_MS: f64 = 900_000.0;
/// Bremse gegen eine Schleife aus Limit-Stopps.
pub const MAX_ATTEMPTS: u32 = 8;
/// So oft prüft der Zeitgeber die Wanduhr; Schlaf und Uhrumstellung verschieben den Zeitpunkt so nicht.
pub const POLL: Duration = Duration::from_secs(30);
pub const RESUME_TEXT: &str = "Das Kontingent ist wieder frei. Mach an der Stelle weiter, an der dich das Limit unterbrochen hat.";

/// Eine Antwort endete am Kontingent-Limit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LimitStop {
    /// Unix-Sekunden aus dem `rejected`-Kontingent-Ereignis der Antwort; `None`, wenn keins kam.
    pub reset_at: Option<i64>,
}

/// Wahr, wenn die Antwort am Kontingent-Limit endete: entweder kam in ihr ein
/// `rate_limit_event` mit Status `rejected`, oder der Fehlertext der Kommandozeile nennt das Limit.
/// Der Text ist der Rückfall, weil die Reihenfolge von Ereignis und `result`-Zeile nicht belegt ist.
pub fn is_limit_stop(text: &str, rejected_reset_at: Option<i64>) -> bool {
    if rejected_reset_at.is_some() {
        return true;
    }
    let lower = text.to_lowercase();
    (lower.contains("hit your") && lower.contains("limit")) || lower.contains("usage limit reached")
}

/// Zeitpunkt des Weiterschickens in ms: Reset plus Puffer, wenn der Reset in der Zukunft liegt,
/// sonst der Rückfall ab jetzt.
pub fn resume_at_ms(reset_at: Option<i64>, now_ms: f64) -> f64 {
    if let Some(seconds) = reset_at {
        let reset_ms: f64 = seconds as f64 * 1000.0;
        if reset_ms > now_ms {
            return reset_ms + RESUME_BUFFER_MS;
        }
    }
    now_ms + RESUME_FALLBACK_MS
}

/// Wartende Stationen und ihre Versuche; liegt in der `SessionRegistry` (eigene Sperre, nie
/// zusammen mit einer anderen gehalten).
#[derive(Default)]
pub struct LimitResumes {
    next_token: u64,
    /// Session → (Marke, Zeitpunkt in ms).
    waiting: HashMap<String, (u64, f64)>,
    /// Session → aufeinanderfolgende Limit-Stopps ohne normal beendete Antwort.
    attempts: HashMap<String, u32>,
}

impl LimitResumes {
    /// Ersetzt ein laufendes Warten der Session, zählt den Versuch und gibt die neue Marke zurück.
    pub fn begin(&mut self, session_id: &str, resume_at_ms: f64) -> u64 {
        self.next_token += 1;
        self.waiting
            .insert(session_id.to_owned(), (self.next_token, resume_at_ms));
        *self.attempts.entry(session_id.to_owned()).or_insert(0) += 1;
        self.next_token
    }

    /// `true`, wenn das Warten mit dieser Marke noch gilt; es ist danach beendet.
    pub fn take(&mut self, session_id: &str, token: u64) -> bool {
        if self.holds(session_id, token) {
            self.waiting.remove(session_id);
            return true;
        }
        false
    }

    /// `true`, wenn das Warten mit dieser Marke noch gilt; ändert nichts.
    pub fn holds(&self, session_id: &str, token: u64) -> bool {
        self.waiting
            .get(session_id)
            .is_some_and(|&(waiting_token, _): &(u64, f64)| waiting_token == token)
    }

    /// `true`, wenn die Session wartete.
    pub fn cancel(&mut self, session_id: &str) -> bool {
        self.waiting.remove(session_id).is_some()
    }

    pub fn ends(&self) -> HashMap<String, f64> {
        self.waiting
            .iter()
            .map(|(session_id, &(_, resume_at)): (&String, &(u64, f64))| {
                (session_id.clone(), resume_at)
            })
            .collect()
    }

    pub fn any_waiting(&self) -> bool {
        !self.waiting.is_empty()
    }

    pub fn attempts(&self, session_id: &str) -> u32 {
        self.attempts.get(session_id).copied().unwrap_or(0)
    }

    pub fn reset_attempts(&mut self, session_id: &str) {
        self.attempts.remove(session_id);
    }
}

/// Prüft nach einem Limit-Stopp, ob die Session bis zum Reset wartet, und startet dann den
/// Zeitgeber. Nie unter einer Sperre aufrufen: liest Einstellungen und Umsetzung selbst.
pub fn consider(app: &AppHandle, session: &Arc<Session>, stop: LimitStop) {
    let registry = app.state::<SessionRegistry>();
    let reset = match stop.reset_at {
        Some(seconds) => format!("Reset um {seconds} (Unix-Sekunden)"),
        None => "ohne Reset-Zeit".to_owned(),
    };
    session.log_line(format!("Limit-Stopp: Kontingent aufgebraucht, {reset}"));
    // Einzel-Sessions bleiben nur ansprechbar; weiter schickt der Verwalter nur Stationen.
    if !session.is_station() || !registry.auto_continue_at_limit() {
        return;
    }
    let attempts: u32 = registry.limit_resume_attempts(&session.id);
    if attempts >= MAX_ATTEMPTS {
        session.log_line(format!(
            "Limit-Stopp: {attempts} Versuche ohne normal beendete Antwort, die Station wartet auf den Benutzer"
        ));
        return;
    }
    let resume_at: f64 = resume_at_ms(stop.reset_at, now_ms());
    let token: u64 = registry.begin_limit_resume(&session.id, resume_at);
    let thread_app: AppHandle = app.clone();
    let thread_session: Arc<Session> = Arc::clone(session);
    let spawned = thread::Builder::new()
        .name("limit-resume".to_owned())
        .spawn(move || wait_and_resume(&thread_app, &thread_session, token, resume_at));
    if let Err(error) = spawned {
        let _ = registry.take_limit_resume(&session.id, token);
        session.log_line(format!("Limit-Stopp: Zeitgeber nicht gestartet: {error}"));
    }
    announce_station(app, &session.id);
}

/// Beendet das Warten der Session (Nachricht des Benutzers, Schließen) und meldet die Station neu.
/// Nie unter einer Sperre aufrufen.
pub fn cancel(app: &AppHandle, session_id: &str) {
    let registry = app.state::<SessionRegistry>();
    if registry.cancel_limit_resume(session_id) {
        announce_station(app, session_id);
    }
}

/// Läuft im Thread des Zeitgebers, ohne gehaltene Sperre. Die Marke entscheidet, ob das Warten
/// noch gilt; Nachricht des Benutzers, Abbrechen und Schließen haben es schon entfernt.
fn wait_and_resume(app: &AppHandle, session: &Arc<Session>, token: u64, resume_at: f64) {
    let registry = app.state::<SessionRegistry>();
    let session_id: &str = &session.id;
    loop {
        thread::sleep(POLL);
        if !registry.holds_limit_resume(session_id, token) {
            return;
        }
        if now_ms() >= resume_at {
            break;
        }
    }
    if !registry.take_limit_resume(session_id, token) {
        return;
    }
    if let Err(error) = registry.send(app, session_id, RESUME_TEXT, &[], &[]) {
        session.log_line(format!("Limit-Stopp: Weiterschicken gescheitert: {error}"));
    }
    announce_station(app, session_id);
}

/// Meldet die Umsetzung der Station an die Oberfläche, damit Karte und Sidebar umschalten.
fn announce_station(app: &AppHandle, session_id: &str) {
    let registry = app.state::<SessionRegistry>();
    if let Ok(Some(view)) = registry.implementation_of_session(session_id) {
        announce(app, &view);
    }
}
