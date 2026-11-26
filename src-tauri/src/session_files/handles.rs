//! Handles der Betrachter-Adresse (ADR 071): jede geprüfte Datei, die die App zeigt, bekommt eine
//! zufällige Kennung. Nur über sie liefert der Artefakt-Server eine Datei außerhalb von
//! `.artefakte` aus; wer den Pfad kennt, aber keinen Handle hat, erreicht sie nicht.
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};

/// So viele Dateien bleiben erreichbar; danach fällt der älteste Handle weg.
const MAX_HANDLES: usize = 512;

/// Handle und echter Pfad je Datei, älteste vorn; als Tauri-State verwaltet.
#[derive(Default)]
pub struct ViewHandles(Mutex<VecDeque<(String, PathBuf)>>);

impl ViewHandles {
    /// Der Handle der Datei `path`, die der Aufrufer schon geprüft hat; derselbe Pfad behält ihn.
    pub fn issue(&self, path: PathBuf) -> String {
        let mut entries = self.entries();
        if let Some((handle, _)) = entries
            .iter()
            .find(|(_, known): &&(String, PathBuf)| *known == path)
        {
            return handle.clone();
        }
        let handle: String = uuid::Uuid::new_v4().simple().to_string();
        entries.push_back((handle.clone(), path));
        if entries.len() > MAX_HANDLES {
            entries.pop_front();
        }
        handle
    }

    /// Der Pfad hinter `handle`; ein Treffer ist buchstabengleich mit einem ausgegebenen Handle.
    pub fn get(&self, handle: &str) -> Option<PathBuf> {
        self.entries()
            .iter()
            .find(|(known, _): &&(String, PathBuf)| known == handle)
            .map(|(_, path): &(String, PathBuf)| path.clone())
    }

    /// Nach einem Panic eines anderen Threads bleibt die Liste brauchbar: jeder Schritt lässt sie
    /// vollständig zurück.
    fn entries(&self) -> MutexGuard<'_, VecDeque<(String, PathBuf)>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}
