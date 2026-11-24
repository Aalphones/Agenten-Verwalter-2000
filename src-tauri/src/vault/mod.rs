//! Developer Vault: Ordner mit der Entwicklerbibliothek des Benutzers (ADR 068). Dieses Modul
//! kennt Einstellung, Status, Grundgerüst, die Index-Datei und den Abgleich im Hintergrund.
pub mod extract;
pub mod index;
pub mod meta;
pub mod model;
pub mod resolve;
pub mod scan;
pub mod search;
pub mod skeleton;
pub mod tools;

pub use resolve::resolve;

use std::fs;
use std::panic::{self, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread;

use tauri::{AppHandle, Emitter, Manager};

use crate::db::Database;
use crate::error::CommandError;
use crate::filesystem::workspace::{data_dir, home_dir};
use crate::mcp_access::tools::ToolSet;
use crate::settings;
use index::VaultIndex;
use model::{VaultState, VaultStatus};

pub const CHANGED_EVENT: &str = "vault://changed";

const INDEX_DIR: &str = "vault";
const INDEX_FILE: &str = "index.db";
/// Älter als das, zieht eine Suche den Index vorher nach.
const FRESH_MS: i64 = 30_000;

/// Hält die Verbindung zur Index-Datei und den Stand des laufenden Abgleichs.
pub struct VaultService {
    /// Kanonischer Vault-Ordner, zu dem der Index geöffnet ist, und der Index.
    index: Mutex<Option<(PathBuf, Arc<VaultIndex>)>>,
    scanning: AtomicBool,
    /// Eine Anforderung kam während eines Laufs: danach folgt genau ein weiterer.
    again: AtomicBool,
    /// Ende des letzten erfolgreichen Abgleichs in ms seit Epoche, 0 = noch keiner.
    last_scan_ms: AtomicI64,
    scan_error: Mutex<Option<String>>,
}

impl Default for VaultService {
    fn default() -> Self {
        VaultService::new()
    }
}

impl VaultService {
    pub fn new() -> VaultService {
        VaultService {
            index: Mutex::new(None),
            scanning: AtomicBool::new(false),
            again: AtomicBool::new(false),
            last_scan_ms: AtomicI64::new(0),
            scan_error: Mutex::new(None),
        }
    }
}

/// Stand des Vault: Einstellungen und Ordner, dazu Zähler, Abgleichzeit und Lauf aus dem Index.
pub fn status(app: &AppHandle) -> VaultStatus {
    let base: VaultStatus = folder_status(app);
    if base.state != VaultState::Ready {
        return base;
    }
    let service = app.state::<VaultService>();
    let (files, artifacts, skipped): (u32, u32, u32) = counts(&service, base.dir.as_deref());
    let last_scan_ms: i64 = service.last_scan_ms.load(Ordering::SeqCst);
    let scan_error: Option<String> = service
        .scan_error
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .clone();
    let (state, message): (VaultState, Option<String>) = if service.scanning.load(Ordering::SeqCst)
    {
        (VaultState::Scanning, None)
    } else if let Some(message) = scan_error {
        (VaultState::Error, Some(message))
    } else {
        (VaultState::Ready, None)
    };
    VaultStatus {
        state,
        files,
        artifacts,
        skipped,
        scanned_at: (last_scan_ms > 0).then_some(last_scan_ms),
        message,
        ..base
    }
}

/// Zähler aus dem Index, wenn er schon zu diesem Ordner geöffnet ist; sonst Nullen.
fn counts(service: &VaultService, dir: Option<&str>) -> (u32, u32, u32) {
    let Some(resolved) = dir.and_then(|text: &str| fs::canonicalize(text).ok()) else {
        return (0, 0, 0);
    };
    let opened: Option<Arc<VaultIndex>> = service
        .index
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_ref()
        .filter(|(opened_dir, _)| *opened_dir == resolved)
        .map(|(_, index)| Arc::clone(index));
    let Some(index) = opened else {
        return (0, 0, 0);
    };
    match index.with(|connection| index::counts(connection)) {
        Ok(counts) => (counts.files, counts.artifacts, counts.skipped),
        Err(error) => {
            eprintln!("Vault-Zähler nicht gelesen: {error}");
            (0, 0, 0)
        }
    }
}

/// Stand allein aus Einstellungen und Ordner; `Ready` heißt hier „Ordner brauchbar“.
fn folder_status(app: &AppHandle) -> VaultStatus {
    let database: Arc<Database> = Arc::clone(&app.state::<Arc<Database>>());
    let loaded = match settings::load(&database) {
        Ok(loaded) => loaded,
        Err(error) => return failure(None, format!("Einstellungen nicht lesbar: {error}")),
    };
    let Some(dir_text) = loaded.vault_dir.filter(|_| loaded.vault_enabled) else {
        return base(None, VaultState::Off);
    };
    let dir: PathBuf = PathBuf::from(&dir_text);
    let (home, data): (PathBuf, PathBuf) = match (home_dir(app), data_dir(app)) {
        (Ok(home), Ok(data)) => (home, data),
        (Err(error), _) | (_, Err(error)) => return failure(Some(dir_text), error.to_string()),
    };
    match check_dir(&dir, &home, &data) {
        Err((state, message)) => VaultStatus {
            message: Some(message),
            ..base(Some(dir_text), state)
        },
        Ok(()) => VaultStatus {
            is_empty_dir: is_empty_dir(&dir),
            ..base(Some(dir_text), VaultState::Ready)
        },
    }
}

/// Öffnet bei Bedarf die Index-Datei zum aktuellen Vault-Ordner.
pub fn index(app: &AppHandle) -> Result<Arc<VaultIndex>, CommandError> {
    let base: VaultStatus = folder_status(app);
    let Some(dir) = base.dir.filter(|_| base.state == VaultState::Ready) else {
        return Err(CommandError::Internal(
            "Der Vault ist nicht bereit.".to_owned(),
        ));
    };
    open_index(app, Path::new(&dir))
}

fn open_index(app: &AppHandle, root: &Path) -> Result<Arc<VaultIndex>, CommandError> {
    let service = app.state::<VaultService>();
    let resolved: PathBuf = fs::canonicalize(root)?;
    let mut guard = service.index.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some((opened_dir, opened)) = guard.as_ref()
        && *opened_dir == resolved
    {
        return Ok(Arc::clone(opened));
    }
    // Erst schließen: Windows löscht eine Datei mit offener Verbindung nicht.
    *guard = None;
    let file: PathBuf = data_dir(app)?.join(INDEX_DIR).join(INDEX_FILE);
    let opened: Arc<VaultIndex> = Arc::new(VaultIndex::open(&file, &resolved)?);
    service.last_scan_ms.store(0, Ordering::SeqCst);
    *guard = Some((resolved, Arc::clone(&opened)));
    Ok(opened)
}

/// Startet einen Abgleich im Hintergrund. Läuft schon einer, folgt genau ein weiterer danach.
/// Bei `Off`, `Missing` und `Error` des Ordners passiert nichts; der Index bleibt liegen.
pub fn spawn_scan(app: &AppHandle) {
    if folder_status(app).state != VaultState::Ready {
        return;
    }
    let service = app.state::<VaultService>();
    if service.scanning.swap(true, Ordering::SeqCst) {
        service.again.store(true, Ordering::SeqCst);
        return;
    }
    announce(app);
    let worker_app: AppHandle = app.clone();
    let spawned = thread::Builder::new()
        .name("vault-scan".to_owned())
        .spawn(move || scan_loop(&worker_app));
    if let Err(error) = spawned {
        eprintln!("Vault-Abgleich nicht gestartet: {error}");
        service.scanning.store(false, Ordering::SeqCst);
    }
}

/// Zieht den Index nach, wenn der letzte Abgleich mehr als 30 s her ist und keiner läuft.
pub fn ensure_fresh(app: &AppHandle) {
    let service = app.state::<VaultService>();
    if service.scanning.load(Ordering::SeqCst) {
        return;
    }
    let age_ms: i64 = now_ms() - service.last_scan_ms.load(Ordering::SeqCst);
    if age_ms > FRESH_MS {
        spawn_scan(app);
    }
}

fn scan_loop(app: &AppHandle) {
    let service = app.state::<VaultService>();
    loop {
        scan_once(app, &service);
        if service.again.swap(false, Ordering::SeqCst) {
            continue;
        }
        service.scanning.store(false, Ordering::SeqCst);
        // Eine Anforderung zwischen dem Prüfen und dem Freigeben darf nicht verloren gehen.
        if service.again.swap(false, Ordering::SeqCst)
            && !service.scanning.swap(true, Ordering::SeqCst)
        {
            continue;
        }
        break;
    }
    announce(app);
}

fn scan_once(app: &AppHandle, service: &VaultService) {
    let outcome = panic::catch_unwind(AssertUnwindSafe(|| -> Result<(), CommandError> {
        let index: Arc<VaultIndex> = index(app)?;
        let Some(dir) = folder_status(app).dir else {
            return Ok(());
        };
        scan::run(Path::new(&dir), &index)?;
        Ok(())
    }));
    let failure: Option<String> = match outcome {
        Ok(Ok(())) => None,
        Ok(Err(error)) => Some(format!("Index nicht lesbar: {error}")),
        Err(_) => Some("Index nicht lesbar: der Abgleich ist abgestürzt".to_owned()),
    };
    if failure.is_none() {
        service.last_scan_ms.store(now_ms(), Ordering::SeqCst);
    }
    *service
        .scan_error
        .lock()
        .unwrap_or_else(PoisonError::into_inner) = failure;
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Sendet den aktuellen Stand an die Oberfläche.
pub fn announce(app: &AppHandle) {
    if let Err(error) = app.emit(CHANGED_EVENT, status(app)) {
        eprintln!("Vault-Ereignis nicht gesendet: {error}");
    }
}

fn base(dir: Option<String>, state: VaultState) -> VaultStatus {
    VaultStatus {
        state,
        dir,
        files: 0,
        artifacts: 0,
        skipped: 0,
        scanned_at: None,
        message: None,
        is_empty_dir: false,
    }
}

fn failure(dir: Option<String>, message: String) -> VaultStatus {
    VaultStatus {
        message: Some(message),
        ..base(dir, VaultState::Error)
    }
}

/// Fehlt der Ordner, ist der Zustand `Missing`; ein ungeeigneter Ordner ist `Error`.
fn check_dir(dir: &Path, home: &Path, data_dir: &Path) -> Result<(), (VaultState, String)> {
    let Ok(resolved) = fs::canonicalize(dir) else {
        return Err((
            VaultState::Missing,
            format!("Ordner nicht gefunden: {}", dir.display()),
        ));
    };
    let resolved_home: PathBuf = fs::canonicalize(home).unwrap_or_else(|_| home.to_path_buf());
    if resolved == resolved_home {
        return Err((
            VaultState::Error,
            "Bitte einen Unterordner deines Benutzerordners wählen.".to_owned(),
        ));
    }
    let resolved_data: PathBuf =
        fs::canonicalize(data_dir).unwrap_or_else(|_| data_dir.to_path_buf());
    if resolved.starts_with(&resolved_data) {
        return Err((
            VaultState::Error,
            "Der Datenordner des Verwalters kann kein Vault sein.".to_owned(),
        ));
    }
    Ok(())
}

/// Kürzeste Länge eines Suchbegriffs aus dem Auftrag; kürzere Wörter treffen zu viel.
const BRIEF_MIN_TERM_CHARS: usize = 4;
const BRIEF_MAX_TERMS: usize = 12;
const BRIEF_LIMIT: u32 = 3;
const BRIEF_DESCRIPTION_CHARS: usize = 120;
const BRIEF_HEADLINE: &str = "Vault (passend zur Phase; laden mit vault_get):";

/// Die Vault-Zeilen für die erste Nachricht einer Station: bis zu drei Treffer zu Titel und
/// Beschreibung der Phase. Leer, wenn der Vault nicht angeboten wird oder nichts passt.
pub fn brief_lines(
    app: &AppHandle,
    title: &str,
    description: &str,
) -> Result<Vec<String>, CommandError> {
    if !tools::VaultTools.offered(app) {
        return Ok(Vec::new());
    }
    let text: String = brief_terms(&format!("{title} {description}")).join(" ");
    if text.is_empty() {
        return Ok(Vec::new());
    }
    let result: search::VaultSearchResult = search::search(
        app,
        &search::VaultQuery {
            text,
            kind: None,
            tags: Vec::new(),
            under: None,
            limit: BRIEF_LIMIT,
            any_term: true,
        },
    )?;
    if result.hits.is_empty() {
        return Ok(Vec::new());
    }
    let mut lines: Vec<String> = vec![BRIEF_HEADLINE.to_owned()];
    lines.extend(result.hits.iter().map(brief_hit_line));
    Ok(lines)
}

/// Die ersten verschiedenen Begriffe ab vier Zeichen, klein geschrieben.
fn brief_terms(text: &str) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    for part in text.split(|character: char| !character.is_alphanumeric()) {
        let term: String = part.to_lowercase();
        if term.chars().count() < BRIEF_MIN_TERM_CHARS || terms.contains(&term) {
            continue;
        }
        terms.push(term);
        if terms.len() == BRIEF_MAX_TERMS {
            break;
        }
    }
    terms
}

fn brief_hit_line(hit: &search::VaultHit) -> String {
    let mut description: String = hit.description.clone();
    if description.chars().count() > BRIEF_DESCRIPTION_CHARS {
        description = description.chars().take(BRIEF_DESCRIPTION_CHARS).collect();
        description.push('…');
    }
    format!("- {} · {} — {}", hit.path, hit.title, description)
}

/// Wahr, wenn der Ordner lesbar ist und keinen Eintrag ohne führenden Punkt enthält.
pub fn is_empty_dir(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    entries
        .flatten()
        .all(|entry: fs::DirEntry| entry.file_name().to_string_lossy().starts_with('.'))
}
