//! Die Vorgaben an Codex (`developerInstructions`): der Zusatz des Verwalters (Scratchpad,
//! Artefakte) und die `AGENTS.md` der Repositories, die Codex selbst nicht findet.
use std::fs;
use std::path::{Path, PathBuf};

const AGENTS_FILE: &str = "AGENTS.md";
/// Größere Dateien lässt Codex selbst lesen, statt sie in jeden Thread-Start zu packen.
const MAX_AGENTS_BYTES: u64 = 32 * 1024;
const SECTION_SEPARATOR: &str = "\n\n";

/// Zusatz aus `--append-system-prompt`, dann je `--add-dir`-Ordner dessen `AGENTS.md` unter der Zeile
/// `--- AGENTS.md aus <ordner> ---`. `None`, wenn nichts vorliegt. Der Arbeitsordner selbst zählt
/// nicht: dessen `AGENTS.md` lädt Codex von allein.
pub fn developer_instructions(
    append: Option<&str>,
    cwd: &Path,
    add_dirs: &[PathBuf],
) -> Option<String> {
    let mut sections: Vec<String> = Vec::new();
    if let Some(text) = append.map(str::trim).filter(|text: &&str| !text.is_empty()) {
        sections.push(text.to_owned());
    }
    for folder in add_dirs
        .iter()
        .filter(|folder: &&PathBuf| folder.as_path() != cwd)
    {
        if let Some(section) = agents_section(folder) {
            sections.push(section);
        }
    }
    if sections.is_empty() {
        return None;
    }
    Some(sections.join(SECTION_SEPARATOR))
}

fn agents_section(folder: &Path) -> Option<String> {
    let file = folder.join(AGENTS_FILE);
    let size = fs::metadata(&file).ok()?.len();
    let heading = format!("--- {AGENTS_FILE} aus {} ---", folder.display());
    if size > MAX_AGENTS_BYTES {
        return Some(format!(
            "{heading}\nLies {} vor der Arbeit.",
            file.display()
        ));
    }
    let bytes = fs::read(&file).ok()?;
    let text = String::from_utf8_lossy(&bytes);
    Some(format!("{heading}\n{}", text.trim()))
}
