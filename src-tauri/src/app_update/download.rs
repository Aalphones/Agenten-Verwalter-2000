//! Download einer Release-Datei mit Fortschritt und Prüfung von Größe, SHA-256 und Programmkopf.
use std::fmt::Write as _;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

use sha2::{Digest, Sha256};

use super::model::InstallPhase;
use super::releases::Asset;

const READ_CHUNK_BYTES: usize = 64 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
// ureq kennt kein Zeitlimit je Lesen, nur eines für den ganzen Inhalt. Zehn Minuten lassen einer
// langsamen Leitung Zeit für 15 MB und beenden trotzdem einen Download, der stehen geblieben ist.
const BODY_TIMEOUT: Duration = Duration::from_secs(600);
/// Jede Windows-exe beginnt mit diesen zwei Bytes; eine Fehlerseite als „exe“ fällt hier auf.
const EXE_MAGIC: &[u8; 2] = b"MZ";

/// Lädt `asset` nach `dest` und prüft die Datei; scheitert etwas, ist `dest` danach gelöscht.
pub fn fetch_verified(
    asset: &Asset,
    dest: &Path,
    mut on_progress: impl FnMut(InstallPhase, u64, Option<u64>),
) -> Result<(), String> {
    if let Err(error) = stream_to(asset, dest, &mut on_progress) {
        // Ein Fehler beim Aufräumen ändert nichts mehr am Ergebnis.
        let _ = fs::remove_file(dest);
        return Err(error);
    }
    on_progress(InstallPhase::Verifying, asset.size, Some(asset.size));
    verify(asset, dest)
}

/// Prüft eine geladene Datei gegen `asset`; scheitert eine Prüfung, wird die Datei gelöscht.
pub fn verify(asset: &Asset, path: &Path) -> Result<(), String> {
    let result = check_file(asset, path);
    if result.is_err() {
        let _ = fs::remove_file(path);
    }
    result
}

fn stream_to(
    asset: &Asset,
    dest: &Path,
    on_progress: &mut impl FnMut(InstallPhase, u64, Option<u64>),
) -> Result<(), String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_connect(Some(CONNECT_TIMEOUT))
        .timeout_recv_response(Some(CONNECT_TIMEOUT))
        .timeout_recv_body(Some(BODY_TIMEOUT))
        .build()
        .into();
    // `call()` macht aus einem HTTP-Status ab 400 einen Fehler; Weiterleitungen zum Datenspeicher von
    // GitHub folgt ureq von selbst.
    let response = agent
        .get(&asset.url)
        .call()
        .map_err(|error: ureq::Error| format!("Download scheitert: {error}"))?;
    let total_bytes = response.body().content_length().or(Some(asset.size));
    // Der Reader hat kein Größenlimit (anders als `read_to_vec`, das bei 10 MB abbricht).
    let mut reader = response.into_body().into_reader();
    let mut file = File::create(dest)
        .map_err(|error| format!("Datei {} nicht anlegbar: {error}", dest.display()))?;

    let mut buffer = vec![0_u8; READ_CHUNK_BYTES];
    let mut received_bytes: u64 = 0;
    on_progress(InstallPhase::Downloading, 0, total_bytes);
    loop {
        let read_bytes = reader
            .read(&mut buffer)
            .map_err(|error| format!("Download bricht ab: {error}"))?;
        if read_bytes == 0 {
            break;
        }
        file.write_all(&buffer[..read_bytes])
            .map_err(|error| format!("Datei nicht schreibbar: {error}"))?;
        received_bytes += read_bytes as u64;
        on_progress(InstallPhase::Downloading, received_bytes, total_bytes);
    }
    file.flush()
        .map_err(|error| format!("Datei nicht schreibbar: {error}"))
}

fn check_file(asset: &Asset, path: &Path) -> Result<(), String> {
    let expected = asset
        .sha256
        .as_deref()
        .ok_or_else(|| "Das Release enthält keine Prüfsumme.".to_owned())?;
    let mut file =
        File::open(path).map_err(|error| format!("Geladene Datei nicht lesbar: {error}"))?;
    let mut hasher = Sha256::new();
    let mut head: Vec<u8> = Vec::with_capacity(EXE_MAGIC.len());
    let mut size: u64 = 0;
    let mut buffer = vec![0_u8; READ_CHUNK_BYTES];
    loop {
        let read_bytes = file
            .read(&mut buffer)
            .map_err(|error| format!("Geladene Datei nicht lesbar: {error}"))?;
        if read_bytes == 0 {
            break;
        }
        let chunk = &buffer[..read_bytes];
        if head.len() < EXE_MAGIC.len() {
            let missing = EXE_MAGIC.len() - head.len();
            head.extend(chunk.iter().take(missing));
        }
        hasher.update(chunk);
        size += read_bytes as u64;
    }
    if size != asset.size {
        return Err(format!(
            "Größe stimmt nicht: {size} statt {} Bytes.",
            asset.size
        ));
    }
    if hex(&hasher.finalize()) != expected {
        return Err("Prüfsumme stimmt nicht.".to_owned());
    }
    if head.as_slice() != EXE_MAGIC {
        return Err("Die Datei ist kein Windows-Programm.".to_owned());
    }
    Ok(())
}

fn hex(bytes: &[u8]) -> String {
    let mut text = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        // Schreiben in einen `String` schlägt nicht fehl.
        let _ = write!(text, "{byte:02x}");
    }
    text
}
