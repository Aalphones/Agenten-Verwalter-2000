pub mod workspace;

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::CommandError;

/// Ein kanonischer Pfad in gewöhnlicher Schreibweise, ohne den Windows-Vorsatz `\\?\`. Nur zum
/// Anzeigen; wer den Pfad öffnet oder weitergibt, nimmt `plain_path`.
pub fn without_verbatim_prefix(path: &Path) -> PathBuf {
    let Some(text) = path.to_str() else {
        return path.to_path_buf();
    };
    if let Some(share) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{share}"));
    }
    PathBuf::from(text.strip_prefix(r"\\?\").unwrap_or(text))
}

/// Wie `without_verbatim_prefix`, aber nur, wenn die gewöhnliche Schreibweise dieselbe Datei meint:
/// ohne Vorsatz streicht Windows Punkte und Leerzeichen am Namensende, und geprüft wäre dann eine
/// andere Datei als geöffnet. `canonical` kommt aus `fs::canonicalize`; das Präfix verstehen nicht
/// alle Standardprogramme.
pub(crate) fn plain_path(canonical: &Path) -> Result<PathBuf, CommandError> {
    let plain = without_verbatim_prefix(canonical);
    if fs::canonicalize(&plain)? != canonical {
        return Err(CommandError::FileNotAllowed(format!(
            "Ungültiger Pfad {}",
            plain.display()
        )));
    }
    Ok(plain)
}

/// Ein Pfad aus Git-Ausgabe oder URL, die `/` als Trenner nennen, als Dateisystempfad. Nur unter
/// Windows werden die Schrägstriche zu `\`; anderswo ist `\` ein gültiges Zeichen im Dateinamen
/// und der Text bleibt, wie er ist.
pub fn native_path(path: &str) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(path.replace('/', "\\"))
    } else {
        PathBuf::from(path)
    }
}
