//! Bilder eines Eintrags: prüfen (Endung, Größe, Maße) und in den Bericht-Ordner kopieren. Die
//! Maße kommen aus dem Dateikopf, eine Bild-Bibliothek hat der Core nicht.
use std::fs;
use std::path::{Path, PathBuf};

const MAX_IMAGE_BYTES: u64 = 5 * 1024 * 1024;
const EXTENSIONS: [&str; 5] = ["png", "jpg", "jpeg", "webp", "gif"];
const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";
const JPEG_START: &[u8] = &[0xFF, 0xD8];
const STAGE_PREFIX: &str = "neu-";

/// Prüft das Bild und kopiert es als `<name>.<endung>` nach `dir`; liefert Dateiname, Breite und
/// Höhe. Der Fehler nennt den Pfad: „Bild <Pfad>: <Grund>“.
pub fn copy_image(src: &Path, dir: &Path, name: &str) -> Result<(String, u32, u32), String> {
    let (bytes, extension, width, height) =
        read_image(src).map_err(|reason: String| failure(src, &reason))?;
    let file = format!("{name}.{extension}");
    fs::create_dir_all(dir)
        .and_then(|()| fs::write(dir.join(&file), bytes))
        .map_err(|error| failure(src, &format!("nicht kopiert: {error}")))?;
    Ok((file, width, height))
}

/// Die Bilder eines Aufrufs, bis sein Eintrag gespeichert ist: erst unter vorläufigen Namen, weil
/// die Nummer erst beim Schreiben der Zeile feststeht. Ohne `keep` verschwinden alle wieder.
pub struct StagedImages {
    dir: PathBuf,
    token: String,
    files: Vec<PathBuf>,
    is_kept: bool,
}

/// Ein kopiertes Bild unter vorläufigem Namen.
pub struct StagedImage {
    index: usize,
    extension: String,
    pub width: u32,
    pub height: u32,
}

impl StagedImages {
    pub fn new(dir: PathBuf) -> StagedImages {
        StagedImages {
            dir,
            token: uuid::Uuid::new_v4().simple().to_string(),
            files: Vec::new(),
            is_kept: false,
        }
    }

    pub fn add(&mut self, src: &Path) -> Result<StagedImage, String> {
        let index = self.files.len();
        let name = format!("{STAGE_PREFIX}{}-{index}", self.token);
        let (file, width, height) = copy_image(src, &self.dir, &name)?;
        let extension = file
            .rsplit_once('.')
            .map(|(_, extension): (&str, &str)| extension.to_owned())
            .unwrap_or_default();
        self.files.push(self.dir.join(file));
        Ok(StagedImage {
            index,
            extension,
            width,
            height,
        })
    }

    /// Gibt dem Bild seinen endgültigen Namen `<stem>.<endung>` und liefert den Dateinamen.
    pub fn rename(&mut self, image: &StagedImage, stem: &str) -> Result<String, String> {
        let file = format!("{stem}.{}", image.extension);
        let target = self.dir.join(&file);
        let Some(current) = self.files.get_mut(image.index) else {
            return Err(format!("Bild {file}: nicht vorbereitet"));
        };
        fs::rename(&*current, &target)
            .map_err(|error| format!("Bild {file}: nicht abgelegt: {error}"))?;
        *current = target;
        Ok(file)
    }

    /// Der Eintrag ist gespeichert: die Dateien bleiben.
    pub fn keep(mut self) {
        self.is_kept = true;
    }
}

impl Drop for StagedImages {
    fn drop(&mut self) {
        if self.is_kept {
            return;
        }
        for file in &self.files {
            let _ = fs::remove_file(file);
        }
    }
}

fn failure(src: &Path, reason: &str) -> String {
    format!("Bild {}: {reason}", src.display())
}

fn read_image(src: &Path) -> Result<(Vec<u8>, String, u32, u32), String> {
    if !src.is_absolute() {
        return Err("kein absoluter Pfad".to_owned());
    }
    let extension = src
        .extension()
        .map(|extension| extension.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if !EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("nur {}", EXTENSIONS.join(", ")));
    }
    let metadata = fs::metadata(src).map_err(|error| format!("nicht lesbar: {error}"))?;
    if !metadata.is_file() {
        return Err("keine Datei".to_owned());
    }
    // Vor dem Lesen: eine riesige Datei soll nicht erst in den Speicher.
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err("größer als 5 MB".to_owned());
    }
    let bytes = fs::read(src).map_err(|error| format!("nicht lesbar: {error}"))?;
    let Some((width, height)) = dimensions(&bytes) else {
        return Err("Maße nicht lesbar, kein gültiges Bild".to_owned());
    };
    Ok((bytes, extension, width, height))
}

/// Breite und Höhe aus dem Kopf von PNG, GIF, JPEG oder WebP — am Inhalt erkannt, nicht an der
/// Endung.
fn dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    let size = if bytes.starts_with(PNG_SIGNATURE) {
        Some((big_endian(bytes, 16, 4)?, big_endian(bytes, 20, 4)?))
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some((little_endian(bytes, 6, 2)?, little_endian(bytes, 8, 2)?))
    } else if bytes.starts_with(JPEG_START) {
        jpeg_dimensions(bytes)
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP".as_slice()) {
        webp_dimensions(bytes)
    } else {
        None
    };
    size.filter(|&(width, height): &(u32, u32)| width > 0 && height > 0)
}

/// Läuft die Segmente bis zum ersten Rahmenkopf (SOF) ab.
fn jpeg_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    let mut offset = JPEG_START.len();
    loop {
        if *bytes.get(offset)? != 0xFF {
            return None;
        }
        let marker = *bytes.get(offset + 1)?;
        match marker {
            // Füllbyte vor einem Marker.
            0xFF => offset += 1,
            // Marker ohne Länge.
            0x01 | 0xD0..=0xD8 => offset += 2,
            // SOF0 bis SOF15 ohne DHT (C4), JPG (C8) und DAC (CC).
            0xC0..=0xC3 | 0xC5..=0xC7 | 0xC9..=0xCB | 0xCD..=0xCF => {
                let height = big_endian(bytes, offset + 5, 2)?;
                let width = big_endian(bytes, offset + 7, 2)?;
                return Some((width, height));
            }
            _ => {
                let length = usize::try_from(big_endian(bytes, offset + 2, 2)?).ok()?;
                offset += 2 + length;
            }
        }
    }
}

fn webp_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    match bytes.get(12..16)? {
        // Verlustbehaftet: 14 Bit je Seite hinter dem Startcode des Rahmens.
        b"VP8 " => Some((
            little_endian(bytes, 26, 2)? & 0x3FFF,
            little_endian(bytes, 28, 2)? & 0x3FFF,
        )),
        // Verlustfrei: nach der Kennung 0x2F je 14 Bit „Seite minus 1“.
        b"VP8L" => {
            let packed = little_endian(bytes, 21, 4)?;
            Some(((packed & 0x3FFF) + 1, ((packed >> 14) & 0x3FFF) + 1))
        }
        // Erweitert: je 24 Bit „Seite minus 1“.
        b"VP8X" => Some((
            little_endian(bytes, 24, 3)? + 1,
            little_endian(bytes, 27, 3)? + 1,
        )),
        _ => None,
    }
}

fn big_endian(bytes: &[u8], offset: usize, length: usize) -> Option<u32> {
    Some(
        bytes
            .get(offset..offset.checked_add(length)?)?
            .iter()
            .fold(0, |value: u32, &byte: &u8| (value << 8) | u32::from(byte)),
    )
}

fn little_endian(bytes: &[u8], offset: usize, length: usize) -> Option<u32> {
    Some(
        bytes
            .get(offset..offset.checked_add(length)?)?
            .iter()
            .rev()
            .fold(0, |value: u32, &byte: &u8| (value << 8) | u32::from(byte)),
    )
}
