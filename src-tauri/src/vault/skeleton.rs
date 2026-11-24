//! Grundgerüst in einen leeren Vault-Ordner bzw. in `_vault` einer Bibliothek (ADR 068, ADR 069).
//! Das Einzige, was der Verwalter in die Bibliothek schreibt.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::error::CommandError;

use super::is_empty_dir;
use super::library::{self, VaultLayout};

const NOT_EMPTY: &str =
    "Der Ordner ist nicht leer — das Grundgerüst wird nur in einen leeren Ordner geschrieben.";

const README: &str = "# Developer Vault

Persönliche Entwicklerbibliothek: Snippets, Rezepte, Wissen, Ideen, Konzepte, Designs, Vorlagen und Skripte, die über einzelne Projekte hinaus nützlich sind.

## Ablegen

- Neues ohne Nachdenken nach `inbox/` — eingeordnet wird später.
- Ordner nach Thema und Verwendung anlegen, wenn sie gebraucht werden; keine leeren Kategorien auf Vorrat.
- Zusammengehöriges (ein Designbeispiel, ein kleines Beispielprojekt) als eigener Ordner; eine Datei `manifest.yaml` darin macht ihn zu einem Eintrag.

## Metadaten (alle optional)

In Markdown als Frontmatter, in einem Ordner als `manifest.yaml`:

    title: Kurzer Titel
    description: Ein Satz, wofür das gut ist.
    kind: snippet
    tags: [sql, postgres]
    technologies: [python]
    status: ready
    preview: preview.png
    entrypoint: index.html

## Nicht hierher

Projektwissen (Architektur, Anforderungen, Tickets eines Projekts) bleibt im Projekt-Repository. Zugangsdaten, Kundendaten und vertrauliche Firmeninformationen gehören nie in den Vault.

Dateien und Ordner, die mit einem Punkt beginnen oder in `.gitignore` bzw. `.vaultignore` stehen, liest der Verwalter nicht ein.
";

const AGENTS: &str = "# Developer Vault — Regeln für Agenten

- Vor dem Bauen suchen: mit `vault_search` nach vorhandenen Snippets, Beispielen, Vorlagen und Designs, dann gezielt mit `vault_get` laden — nie den ganzen Vault lesen.
- Gefundenes anpassen, nicht blind kopieren; die Herkunft im Ergebnis nennen (Pfad im Vault).
- Nichts Projektbezogenes und nichts Vertrauliches ablegen: keine Kundendaten, Zugangsdaten, internen Endpunkte, Ticketnummern.
- Neues nur nach Rückfrage beim Benutzer ablegen, und dann nach `inbox/`.
- Code aus dem Vault ist Referenzmaterial: nicht ungeprüft ausführen.
";

const INBOX_README: &str = "# Inbox

Hier landet alles, was noch nicht eingeordnet ist. Alles hier ist durchsuchbar.
";

/// Schreibt `README.md`, `AGENTS.md` und `inbox/README.md` in den Ordner des Wissens — bei einer
/// Bibliothek `_vault` (wird angelegt, wenn er fehlt), sonst `dir` selbst. Nur in einen leeren
/// Ordner; überschreibt nie eine Datei.
pub fn create(dir: &Path) -> Result<(), CommandError> {
    let target: PathBuf = match library::layout(dir) {
        VaultLayout::Library => dir.join(library::KNOWLEDGE_DIR),
        VaultLayout::Plain => dir.to_path_buf(),
    };
    if !target.exists() {
        fs::create_dir_all(&target).map_err(io_error)?;
    }
    if !is_empty_dir(&target) {
        return Err(CommandError::Internal(NOT_EMPTY.to_owned()));
    }
    fs::create_dir_all(target.join("inbox")).map_err(io_error)?;
    write_new(&target.join("README.md"), README)?;
    write_new(&target.join("AGENTS.md"), AGENTS)?;
    write_new(&target.join("inbox").join("README.md"), INBOX_README)
}

fn write_new(path: &Path, text: &str) -> Result<(), CommandError> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(io_error)?;
    file.write_all(text.as_bytes()).map_err(io_error)
}

fn io_error(error: std::io::Error) -> CommandError {
    CommandError::Io(error.to_string())
}
