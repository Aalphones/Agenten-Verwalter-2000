//! Verlauf einer Session als JSONL, je Zeile eine Nachricht im OpenAI-Format. Der Systemprompt
//! gehört nicht dazu — er entsteht bei jedem Start neu.
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, BufWriter, ErrorKind, Write};
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::transcript_path;

const TEMP_EXTENSION: &str = "jsonl.tmp";

pub struct Transcript {
    path: PathBuf,
    pub messages: Vec<Value>,
}

impl Transcript {
    /// Neue, leere Datei; gibt es sie schon, ist die Session-ID vergeben.
    pub fn create(session_id: &str) -> Result<Transcript, String> {
        let path = path_for(session_id)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Ordner {} nicht anlegbar: {error}", parent.display()))?;
        }
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|error| {
                if error.kind() == ErrorKind::AlreadyExists {
                    format!("Transkript existiert schon: {}", path.display())
                } else {
                    format!("Transkript {} nicht anlegbar: {error}", path.display())
                }
            })?;
        Ok(Transcript {
            path,
            messages: Vec::new(),
        })
    }

    pub fn resume(session_id: &str) -> Result<Transcript, String> {
        let path = path_for(session_id)?;
        let file = File::open(&path)
            .map_err(|error| format!("Transkript {} nicht lesbar: {error}", path.display()))?;
        let mut messages: Vec<Value> = Vec::new();
        for (index, line) in BufReader::new(file).lines().enumerate() {
            let line_number = index + 1;
            let line = line.map_err(|error| format!("Transkript, Zeile {line_number}: {error}"))?;
            if line.trim().is_empty() {
                continue;
            }
            let message: Value = serde_json::from_str(&line)
                .map_err(|error| format!("Transkript, Zeile {line_number}: {error}"))?;
            messages.push(message);
        }
        Ok(Transcript { path, messages })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn append(&mut self, message: Value) -> Result<(), String> {
        let mut file = OpenOptions::new()
            .append(true)
            .open(&self.path)
            .map_err(|error| self.write_error(&error))?;
        writeln!(file, "{message}")
            .and_then(|()| file.flush())
            .map_err(|error| self.write_error(&error))?;
        self.messages.push(message);
        Ok(())
    }

    /// Ersetzt den ganzen Verlauf (Verdichten). Erst die Hilfsdatei, dann umbenennen — ein Absturz
    /// mittendrin lässt die alte Datei stehen.
    pub fn rewrite(&mut self, messages: Vec<Value>) -> Result<(), String> {
        let temp_path = self.path.with_extension(TEMP_EXTENSION);
        let file = File::create(&temp_path).map_err(|error| self.write_error(&error))?;
        let mut writer = BufWriter::new(file);
        for message in &messages {
            writeln!(writer, "{message}").map_err(|error| self.write_error(&error))?;
        }
        writer.flush().map_err(|error| self.write_error(&error))?;
        drop(writer);
        fs::rename(&temp_path, &self.path).map_err(|error| self.write_error(&error))?;
        self.messages = messages;
        Ok(())
    }

    fn write_error(&self, error: &std::io::Error) -> String {
        format!(
            "Transkript {} nicht schreibbar: {error}",
            self.path.display()
        )
    }
}

fn path_for(session_id: &str) -> Result<PathBuf, String> {
    transcript_path(session_id).ok_or_else(|| "Benutzerordner unbekannt".to_owned())
}
