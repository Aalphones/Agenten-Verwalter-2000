//! Codex-Konto: gelesen über `account/read`, angemeldet über `account/login/start` eines kurz
//! gestarteten `codex app-server` (ADR 031).
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::account::model::{AccountInfo, AccountStatus};
use crate::codex::helper::{QUICK_TIME_LIMIT, with_listening_server, with_server};
use crate::codex::rpc::{Incoming, RpcClient};
use crate::db::Database;
use crate::settings::{self, model::OperatingMode};
use crate::usage::UsageService;

pub const CODEX_ACCOUNT_CHANGED_EVENT: &str = "codex-account://changed";

const LOGIN_TIMEOUT: Duration = Duration::from_secs(10 * 60);
/// Zeit über `LOGIN_TIMEOUT` hinaus, die der Wachhund des Hilfsprozesses dem Abbruch lässt.
const LOGIN_CANCEL_MARGIN: Duration = Duration::from_secs(30);
const LOGIN_COMPLETED_METHOD: &str = "account/login/completed";
const UNKNOWN_LOGIN_FAILURE: &str = "Anmeldung nicht abgeschlossen";

/// Das Konto gehört Codex, nicht der App: die App liest es nur und lässt Codex die Anmeldung
/// durchführen (wie bei Claude, ADR 021).
pub struct CodexAccountService {
    state: Mutex<AccountState>,
}

struct AccountState {
    info: Option<AccountInfo>,
    error: Option<String>,
    is_logging_in: bool,
}

/// Ergebnis der Benachrichtigung `account/login/completed`.
struct LoginOutcome {
    is_success: bool,
    error: Option<String>,
}

impl Default for CodexAccountService {
    fn default() -> Self {
        CodexAccountService::new()
    }
}

impl CodexAccountService {
    pub fn new() -> CodexAccountService {
        CodexAccountService {
            state: Mutex::new(AccountState {
                info: None,
                error: None,
                is_logging_in: false,
            }),
        }
    }

    /// Liest das Konto neu und blockiert dabei bis zu `QUICK_TIME_LIMIT`.
    pub fn load(&self) -> AccountStatus {
        self.store(with_server(read_account))
    }

    /// Startet die Anmeldung und kehrt sofort zurück; Anfang, Ende und neues Konto meldet
    /// `codex-account://changed`. Nie zwei Anmeldungen gleichzeitig.
    pub fn login(&self, app: &AppHandle) {
        {
            let mut state = self.lock();
            if state.is_logging_in {
                return;
            }
            state.is_logging_in = true;
        }
        emit_changed(app);
        let worker_app = app.clone();
        let spawned = thread::Builder::new()
            .name("codex-account-login".to_owned())
            .spawn(move || {
                let outcome = run_login(&worker_app);
                worker_app
                    .state::<CodexAccountService>()
                    .finish_login(&worker_app, outcome);
            });
        if let Err(error) = spawned {
            self.finish_login(app, Err(format!("Anmeldung startet nicht: {error}")));
        }
    }

    fn finish_login(&self, app: &AppHandle, outcome: Result<(), String>) {
        self.lock().is_logging_in = false;
        // Das Konto wird auch nach einem Abbruch neu gelesen: es kann sich trotzdem geändert haben.
        self.store(with_server(read_account));
        if let Err(error) = outcome {
            self.lock().error = Some(error);
        }
        emit_changed(app);
        refresh_usage(app);
    }

    fn store(&self, result: Result<AccountInfo, String>) -> AccountStatus {
        let mut state = self.lock();
        match result {
            Ok(info) => {
                state.info = Some(info);
                state.error = None;
            }
            Err(error) => state.error = Some(error),
        }
        AccountStatus {
            info: state.info.clone(),
            error: state.error.clone(),
            is_logging_in: state.is_logging_in,
        }
    }

    fn lock(&self) -> MutexGuard<'_, AccountState> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

fn read_account(rpc: &RpcClient) -> Result<AccountInfo, String> {
    let answer = rpc.call("account/read", json!({}), QUICK_TIME_LIMIT)?;
    Ok(parse_account(&answer))
}

/// `account` fehlt (`null`) ohne Anmeldung; mit ChatGPT-Konto stehen `email` und `planType` dabei.
fn parse_account(answer: &Value) -> AccountInfo {
    let Some(account) = answer
        .get("account")
        .filter(|value: &&Value| value.is_object())
    else {
        return AccountInfo {
            logged_in: false,
            email: None,
            org_name: None,
            plan: None,
            auth_method: None,
        };
    };
    AccountInfo {
        logged_in: true,
        email: text_field(account, "email"),
        org_name: None,
        plan: text_field(account, "planType"),
        auth_method: text_field(account, "type"),
    }
}

fn text_field(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::to_owned)
}

/// Startet die Anmeldung bei Codex, öffnet deren Adresse im Browser und wartet auf
/// `account/login/completed`. Der Hilfsprozess muss bis dahin laufen: er hört auf die Antwort
/// des Browsers.
fn run_login(app: &AppHandle) -> Result<(), String> {
    let (sender, receiver) = mpsc::channel::<LoginOutcome>();
    let listener = move |incoming: Incoming| {
        if let Incoming::Notification { method, params } = incoming
            && method == LOGIN_COMPLETED_METHOD
        {
            // Nach einem Zeitlimit gibt es keinen Empfänger mehr.
            let _ = sender.send(LoginOutcome {
                is_success: params.get("success").and_then(Value::as_bool) == Some(true),
                error: text_field(&params, "error"),
            });
        }
    };
    with_listening_server(
        LOGIN_TIMEOUT + LOGIN_CANCEL_MARGIN,
        listener,
        |rpc: &RpcClient| {
            let started = rpc.call(
                "account/login/start",
                json!({ "type": "chatgpt" }),
                QUICK_TIME_LIMIT,
            )?;
            let auth_url = text_field(&started, "authUrl")
                .ok_or_else(|| "Codex nannte keine Anmelde-Adresse".to_owned())?;
            app.opener().open_url(auth_url, None::<&str>).map_err(
                |error: tauri_plugin_opener::Error| format!("Browser nicht geöffnet: {error}"),
            )?;
            wait_for_completion(rpc, &receiver, text_field(&started, "loginId"))
        },
    )
}

fn wait_for_completion(
    rpc: &RpcClient,
    receiver: &mpsc::Receiver<LoginOutcome>,
    login_id: Option<String>,
) -> Result<(), String> {
    match receiver.recv_timeout(LOGIN_TIMEOUT) {
        Ok(outcome) if outcome.is_success => Ok(()),
        Ok(outcome) => Err(outcome
            .error
            .unwrap_or_else(|| UNKNOWN_LOGIN_FAILURE.to_owned())),
        Err(RecvTimeoutError::Timeout) => {
            if let Some(id) = login_id {
                let _ = rpc.call(
                    "account/login/cancel",
                    json!({ "loginId": id }),
                    QUICK_TIME_LIMIT,
                );
            }
            Err(format!(
                "Anmeldung nicht innerhalb von {} Minuten abgeschlossen",
                LOGIN_TIMEOUT.as_secs() / 60
            ))
        }
        Err(RecvTimeoutError::Disconnected) => Err("Codex wurde vor dem Ende beendet".to_owned()),
    }
}

/// Das Kontingent hängt am Konto; es wird nur in „Codex“ neu gefragt.
fn refresh_usage(app: &AppHandle) {
    let database = app.state::<Arc<Database>>();
    match settings::load(&database) {
        Ok(loaded) if loaded.operating_mode == OperatingMode::Codex => {
            app.state::<UsageService>().refresh(app, true);
        }
        Ok(_) => {}
        Err(error) => eprintln!("Kontingent nach der Codex-Anmeldung nicht abgerufen: {error}"),
    }
}

fn emit_changed(app: &AppHandle) {
    if let Err(error) = app.emit(CODEX_ACCOUNT_CHANGED_EVENT, ()) {
        eprintln!("Codex-Konto-Ereignis nicht gesendet: {error}");
    }
}
