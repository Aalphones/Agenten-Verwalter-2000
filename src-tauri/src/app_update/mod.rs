//! Update des Verwalters: Releases von GitHub abfragen, Download prüfen, eigene Datei tauschen oder
//! Installer starten (ADR 041).
pub mod download;
pub mod model;
pub mod releases;
pub mod swap;

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

use crate::error::CommandError;
use model::{AppUpdateProgress, AppUpdateStatus, InstallKind, InstallPhase, ReleaseInfo};
use releases::Release;

pub const APP_UPDATE_PROGRESS_EVENT: &str = "app-update://progress";
/// Ersetzt in Debug-Läufen die laufende Version, damit sich „Update verfügbar“ prüfen lässt.
const VERSION_OVERRIDE_ENV: &str = "VERWALTER_APP_VERSION";
const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);
const INSTALLER_DIR: &str = "Agenten-Verwalter-2000-update";
const ALREADY_INSTALLING: &str = "Eine Installation läuft bereits.";

pub struct AppUpdateService {
    /// Einmal beim Start gelesen: nach dem Tausch zeigt `current_exe()` auf die `.alt`-Datei.
    exe: Option<PathBuf>,
    is_installing: Mutex<bool>,
    cache: Mutex<Option<Vec<Release>>>,
}

impl Default for AppUpdateService {
    fn default() -> Self {
        AppUpdateService::new()
    }
}

impl AppUpdateService {
    pub fn new() -> AppUpdateService {
        AppUpdateService {
            exe: env::current_exe().ok(),
            is_installing: Mutex::new(false),
            cache: Mutex::new(None),
        }
    }

    pub fn exe(&self) -> Option<&Path> {
        self.exe.as_deref()
    }

    /// Fragt GitHub ab und blockiert dafür bis zu 10 s; ein Fehler landet in `latest_error`.
    pub fn load(&self, app: &AppHandle) -> AppUpdateStatus {
        let installed = installed_version(app);
        let fetched = releases::fetch(&installed);
        if let Ok(list) = &fetched {
            *lock(&self.cache) = Some(list.clone());
        }
        status(&installed, self.install_kind(), self.exe(), fetched)
    }

    /// Lädt die neueste Version, prüft sie, tauscht die exe bzw. startet den Installer und beendet
    /// die App. Kehrt nur mit Fehler zurück; nie zwei Installationen gleichzeitig.
    pub fn install(&self, app: &AppHandle) -> Result<(), CommandError> {
        {
            let mut is_installing = lock(&self.is_installing);
            if *is_installing {
                return Err(CommandError::AppUpdate(ALREADY_INSTALLING.to_owned()));
            }
            *is_installing = true;
        }
        if let Err(error) = self.run_install(app) {
            *lock(&self.is_installing) = false;
            return Err(CommandError::AppUpdate(error));
        }
        app.exit(0);
        Ok(())
    }

    fn run_install(&self, app: &AppHandle) -> Result<(), String> {
        let exe = self
            .exe()
            .ok_or_else(|| "Pfad des laufenden Verwalters unbekannt.".to_owned())?;
        let kind = swap::install_kind(exe);
        if kind == InstallKind::Manual {
            return Err(releases::MANUAL_TEXT.to_owned());
        }
        let installed = installed_version(app);
        let cached = lock(&self.cache).clone();
        let all = match cached {
            Some(list) => list,
            None => releases::fetch(&installed)?,
        };
        let newest = releases::newer_than(&all, &installed)
            .into_iter()
            .next()
            .ok_or_else(|| "Es gibt keine neuere Version.".to_owned())?;
        let asset = releases::pick_asset(newest, kind)?;

        let dest = match kind {
            InstallKind::Installer => prepare_installer_path(&asset.name)?,
            _ => swap::sibling(exe, swap::NEW_SUFFIX),
        };
        let mut reporter = ProgressReporter::new(app);
        download::fetch_verified(asset, &dest, |phase, downloaded, total| {
            reporter.report(phase, downloaded, total);
        })?;
        reporter.report(InstallPhase::Installing, asset.size, Some(asset.size));

        if kind == InstallKind::Installer {
            return swap::start_installer(&dest);
        }
        swap::swap_files(exe, &dest)?;
        swap::relaunch(exe).map_err(|error: String| {
            format!("Die neue Version liegt bereit, startet aber nicht von selbst ({error}). Den Verwalter von Hand neu starten.")
        })
    }

    fn install_kind(&self) -> InstallKind {
        match self.exe() {
            Some(exe) => swap::install_kind(exe),
            None => InstallKind::Manual,
        }
    }
}

/// Fasst eine Abfrage zum Status zusammen; öffentlich für das Prüfprogramm.
pub fn status(
    installed: &str,
    install_kind: InstallKind,
    exe: Option<&Path>,
    fetched: Result<Vec<Release>, String>,
) -> AppUpdateStatus {
    let target_path = match (install_kind, exe) {
        (InstallKind::Portable, Some(path)) => Some(path.display().to_string()),
        _ => None,
    };
    let all = match fetched {
        Ok(list) => list,
        Err(error) => {
            return AppUpdateStatus {
                installed: installed.to_owned(),
                latest: None,
                has_update: false,
                releases: Vec::new(),
                install_kind,
                target_path,
                download_size: None,
                latest_error: Some(error),
            };
        }
    };
    let newer: Vec<ReleaseInfo> = releases::newer_than(&all, installed)
        .into_iter()
        .map(Release::info)
        .collect();
    let newest = all.first();
    AppUpdateStatus {
        installed: installed.to_owned(),
        latest: newest.map(|release: &Release| release.version.clone()),
        has_update: !newer.is_empty(),
        releases: newer,
        install_kind,
        target_path,
        download_size: newest
            .and_then(|release: &Release| releases::pick_asset(release, install_kind).ok())
            .map(|asset: &releases::Asset| asset.size),
        latest_error: None,
    }
}

fn installed_version(app: &AppHandle) -> String {
    // Nur in Debug-Läufen: ein Release soll sich nicht über die Umgebung täuschen lassen.
    if cfg!(debug_assertions)
        && let Ok(version) = env::var(VERSION_OVERRIDE_ENV)
        && !version.trim().is_empty()
    {
        return version.trim().to_owned();
    }
    app.package_info().version.to_string()
}

/// Leert den Temp-Ordner des Installers und liefert den Pfad für die neue Datei.
fn prepare_installer_path(asset_name: &str) -> Result<PathBuf, String> {
    // Der Name kommt aus der Antwort von GitHub: nur ein reiner Dateiname darf in den Pfad.
    let file_name = Path::new(asset_name)
        .file_name()
        .filter(|name| *name == asset_name)
        .ok_or_else(|| format!("Ungültiger Dateiname im Release: {asset_name}"))?;
    let dir = env::temp_dir().join(INSTALLER_DIR);
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Ordner {} nicht anlegbar: {error}", dir.display()))?;
    Ok(dir.join(file_name))
}

/// Sendet den Fortschritt höchstens alle 250 ms und bei jedem Phasenwechsel.
struct ProgressReporter<'a> {
    app: &'a AppHandle,
    last: Option<(InstallPhase, Instant)>,
}

impl<'a> ProgressReporter<'a> {
    fn new(app: &'a AppHandle) -> ProgressReporter<'a> {
        ProgressReporter { app, last: None }
    }

    fn report(&mut self, phase: InstallPhase, downloaded: u64, total: Option<u64>) {
        let now = Instant::now();
        let is_due = match self.last {
            Some((last_phase, sent_at)) => {
                last_phase != phase || now.duration_since(sent_at) >= PROGRESS_INTERVAL
            }
            None => true,
        };
        if !is_due {
            return;
        }
        self.last = Some((phase, now));
        let progress = AppUpdateProgress {
            phase,
            downloaded,
            total,
        };
        if let Err(error) = self.app.emit(APP_UPDATE_PROGRESS_EVENT, progress) {
            eprintln!("Fortschritt des Updates nicht gesendet: {error}");
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}
