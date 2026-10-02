//! Die Modelldatei des Diktierens: wo sie liegt, ob sie fertig ist, und der geprüfte Download.
use std::fmt::{Display, Write as _};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use sha2::{Digest, Sha256};

use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;

// „small“ statt „large-v3-turbo“: das große Modell braucht auf einer CPU ohne GPU Minuten je Abschnitt
// (gemessen: 257 s für 5 s Audio auf einem Ryzen 5 3600).
pub const MODEL_FILE_NAME: &str = "ggml-small-q5_1.bin";
// Auf einen festen Stand gepinnt: unter `main` könnte die Datei sich ändern, und die Prüfsumme unten
// würde nie wieder stimmen.
const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin";
pub const MODEL_BYTES: u64 = 190_085_487;
const MODEL_SHA256: &str = "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb";
const MODELS_DIR: &str = "models";
const PART_SUFFIX: &str = ".part";
const READ_CHUNK_BYTES: usize = 1024 * 1024;
const CANCELLED_TEXT: &str = "abgebrochen";

/// Legt nichts an.
pub fn model_path(app: &tauri::AppHandle) -> Result<PathBuf, CommandError> {
    Ok(data_dir(app)?.join(MODELS_DIR).join(MODEL_FILE_NAME))
}

/// Nur die Größe wird verglichen: 190 MB bei jedem Status-Aufruf zu hashen dauert Sekunden. Die
/// Prüfsumme gilt beim Download; nur eine Datei, die dort bestanden hat, trägt den endgültigen Namen.
pub fn is_model_ready(path: &Path) -> bool {
    fs::metadata(path).is_ok_and(|metadata: fs::Metadata| metadata.len() == MODEL_BYTES)
}

/// Lädt das Modell nach `<path>.part`, prüft die SHA-256 und benennt erst dann um. Bei jedem Fehler
/// und bei Abbruch ist `.part` danach gelöscht. Der Aufrufer erkennt einen Abbruch an `cancel`,
/// nicht am Fehlertext.
pub fn download(
    path: &Path,
    cancel: &AtomicBool,
    on_progress: impl FnMut(u64, u64),
) -> Result<(), CommandError> {
    let part_path = part_path(path);
    let result = download_to_part(&part_path, cancel, on_progress)
        .and_then(|()| fs::rename(&part_path, path).map_err(download_error));
    if result.is_err() {
        // Ein Fehler beim Aufräumen ändert nichts mehr am Ergebnis.
        let _ = fs::remove_file(&part_path);
    }
    result
}

fn download_to_part(
    part_path: &Path,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<(), CommandError> {
    if let Some(dir) = part_path.parent() {
        fs::create_dir_all(dir).map_err(download_error)?;
    }
    let mut part_file = File::create(part_path).map_err(download_error)?;

    // `call()` macht aus einem HTTP-Status ab 400 einen Fehler (Voreinstellung von ureq, nicht
    // abschalten): sonst läge eine Fehlerseite als „Modell“ auf der Platte und fiele erst an der
    // Prüfsumme auf.
    let response = ureq::get(MODEL_URL).call().map_err(download_error)?;
    let total_bytes = response.body().content_length().unwrap_or(MODEL_BYTES);
    // Der Reader hat kein Größenlimit (anders als `read_to_vec`, das bei 10 MB abbricht).
    let mut reader = response.into_body().into_reader();

    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; READ_CHUNK_BYTES];
    let mut received_bytes: u64 = 0;
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err(CommandError::VoiceDownload(CANCELLED_TEXT.to_owned()));
        }
        let read_bytes = reader.read(&mut buffer).map_err(download_error)?;
        if read_bytes == 0 {
            break;
        }
        let chunk = &buffer[..read_bytes];
        part_file.write_all(chunk).map_err(download_error)?;
        hasher.update(chunk);
        received_bytes += read_bytes as u64;
        on_progress(received_bytes, total_bytes);
    }
    part_file.flush().map_err(download_error)?;

    if hex(&hasher.finalize()) != MODEL_SHA256 {
        return Err(CommandError::VoiceDownload(
            "Prüfsumme stimmt nicht".to_owned(),
        ));
    }
    Ok(())
}

fn part_path(path: &Path) -> PathBuf {
    let mut part = path.as_os_str().to_owned();
    part.push(PART_SUFFIX);
    PathBuf::from(part)
}

fn download_error(error: impl Display) -> CommandError {
    CommandError::VoiceDownload(error.to_string())
}

fn hex(bytes: &[u8]) -> String {
    let mut text = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        // Schreiben in einen `String` schlägt nicht fehl.
        let _ = write!(text, "{byte:02x}");
    }
    text
}
