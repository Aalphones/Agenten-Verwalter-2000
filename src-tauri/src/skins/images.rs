//! Bilder eines Pakets: aus Datei, Adresse oder Bytes in den Paketordner. Die Art des Bildes
//! gilt nach dem Dateikopf, nie nach dem Namen oder dem, was ein Server behauptet.
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use std::time::Duration;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;

use super::model::{ImageSource, ImageTarget, MAX_IMAGE_BYTES};

const NETWORK_TIMEOUT: Duration = Duration::from_secs(10);
/// Die Zeit für den Inhalt selbst: ein Bild bis 2 MiB braucht auch auf einer langsamen Leitung
/// keine halbe Minute, ein Server, der tröpfelt, soll aber nicht ewig halten.
const BODY_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_REDIRECTS: u32 = 3;
const READ_CHUNK_BYTES: usize = 64 * 1024;
const HTTPS_PREFIX: &str = "https://";
const KNOWN_EXTENSIONS: [&str; 4] = ["gif", "png", "webp", "ico"];
const PNG_SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
const ICO_SIGNATURE: [u8; 4] = [0x00, 0x00, 0x01, 0x00];

/// Dateiendung nach dem Dateikopf: `gif`, `png`, `webp` oder `ico`.
pub fn sniff(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("gif");
    }
    if bytes.starts_with(&PNG_SIGNATURE) {
        return Some("png");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("webp");
    }
    if bytes.starts_with(&ICO_SIGNATURE) {
        return Some("ico");
    }
    None
}

/// Dateiname ohne Endung: `<Fach>`, `<Fach>-2`, `sidebar`, `content` oder `icon`.
pub fn file_stem(target: &ImageTarget) -> Result<String, String> {
    match target {
        ImageTarget::Slot { slot, second } => {
            let is_plain: bool = !slot.is_empty()
                && slot.chars().all(|character: char| {
                    character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
                });
            if !is_plain {
                return Err(format!("„{slot}“ ist kein gültiges Fach."));
            }
            Ok(if *second {
                format!("{slot}-2")
            } else {
                slot.clone()
            })
        }
        ImageTarget::SidebarImage => Ok("sidebar".to_owned()),
        ImageTarget::ContentImage => Ok("content".to_owned()),
        ImageTarget::Icon => Ok("icon".to_owned()),
    }
}

/// Holt das Bild, prüft es und legt es als `<Ziel>.<Endung>` in `dir` ab; liefert den Dateinamen.
/// Eine ältere Datei desselben Ziels mit anderer Endung wird ersetzt.
pub fn ingest(dir: &Path, target: &ImageTarget, source: &ImageSource) -> Result<String, String> {
    let stem = file_stem(target)?;
    let bytes: Vec<u8> = fetch(source)?;
    let extension: &str = sniff(&bytes)
        .ok_or_else(|| "Das ist kein Bild: erwartet wird GIF, PNG oder WebP.".to_owned())?;
    let is_icon_target: bool = matches!(target, ImageTarget::Icon);
    if extension == "ico" && !is_icon_target {
        return Err(
            "Ein ICO-Bild geht nur als App-Symbol; erwartet wird GIF, PNG oder WebP.".to_owned(),
        );
    }
    // Das Fenster kann ein Symbol nur aus PNG oder ICO bauen.
    if is_icon_target && extension != "png" && extension != "ico" {
        return Err("Das App-Symbol muss ein PNG oder ICO sein.".to_owned());
    }
    fs::create_dir_all(dir)
        .map_err(|error| format!("Der Paketordner ist nicht anlegbar: {error}"))?;
    let file_name = format!("{stem}.{extension}");
    // Erst schreiben, dann das Alte entfernen: scheitert das Schreiben, bleibt das alte Bild.
    fs::write(dir.join(&file_name), &bytes)
        .map_err(|error| format!("Das Bild ist nicht speicherbar: {error}"))?;
    remove_stem_files(dir, &stem, Some(&file_name));
    Ok(file_name)
}

/// Löscht alle Bilddateien `<stem>.<Endung>` in `dir`, außer `keep`.
pub fn remove_stem_files(dir: &Path, stem: &str, keep: Option<&str>) {
    for extension in KNOWN_EXTENSIONS {
        let name = format!("{stem}.{extension}");
        if keep == Some(name.as_str()) {
            continue;
        }
        // Eine Datei, die es nicht gibt oder nicht gelöscht werden kann, ändert am Paket nichts.
        let _ = fs::remove_file(dir.join(name));
    }
}

fn fetch(source: &ImageSource) -> Result<Vec<u8>, String> {
    match source {
        ImageSource::Path { path } => read_file(Path::new(path)),
        ImageSource::Url { url } => download(url),
        ImageSource::Bytes { base64, .. } => decode(base64),
    }
}

fn too_large() -> String {
    format!(
        "Das Bild ist größer als {} MiB.",
        MAX_IMAGE_BYTES / (1024 * 1024)
    )
}

fn read_file(path: &Path) -> Result<Vec<u8>, String> {
    let file = File::open(path)
        .map_err(|error| format!("Die Datei {} ist nicht lesbar: {error}", path.display()))?;
    read_limited(
        file,
        &format!("Die Datei {} ist nicht lesbar.", path.display()),
    )
}

fn download(url: &str) -> Result<Vec<u8>, String> {
    if !url.trim().to_ascii_lowercase().starts_with(HTTPS_PREFIX) {
        return Err("Bilder lädt der Verwalter nur über https-Adressen.".to_owned());
    }
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_connect(Some(NETWORK_TIMEOUT))
        .timeout_recv_response(Some(NETWORK_TIMEOUT))
        .timeout_recv_body(Some(BODY_TIMEOUT))
        .https_only(true)
        .max_redirects(MAX_REDIRECTS)
        .build()
        .into();
    let response = agent
        .get(url.trim())
        .call()
        .map_err(|error: ureq::Error| format!("Das Bild ist nicht ladbar: {error}"))?;
    let is_known_too_large: bool = response
        .body()
        .content_length()
        .is_some_and(|length: u64| length > MAX_IMAGE_BYTES as u64);
    if is_known_too_large {
        return Err(too_large());
    }
    read_limited(
        response.into_body().into_reader(),
        "Das Bild ist nicht ladbar.",
    )
}

fn decode(encoded: &str) -> Result<Vec<u8>, String> {
    // Base64 ist um ein Drittel länger als die Bytes; so wird nichts Riesiges erst dekodiert.
    if encoded.len() > MAX_IMAGE_BYTES / 3 * 4 + 8 {
        return Err(too_large());
    }
    let bytes: Vec<u8> = STANDARD
        .decode(encoded.trim())
        .map_err(|_| "Die Bilddaten sind kein gültiges Base64.".to_owned())?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(too_large());
    }
    Ok(bytes)
}

/// Liest höchstens `MAX_IMAGE_BYTES` in Blöcken und bricht beim ersten Byte darüber ab;
/// `read_error` ist der Satz für einen Lesefehler.
fn read_limited(mut reader: impl Read, read_error: &str) -> Result<Vec<u8>, String> {
    let mut bytes: Vec<u8> = Vec::new();
    let mut buffer = vec![0_u8; READ_CHUNK_BYTES];
    loop {
        let read_bytes = reader
            .read(&mut buffer)
            .map_err(|_| read_error.to_owned())?;
        if read_bytes == 0 {
            return Ok(bytes);
        }
        if bytes.len() + read_bytes > MAX_IMAGE_BYTES {
            return Err(too_large());
        }
        bytes.extend_from_slice(&buffer[..read_bytes]);
    }
}
