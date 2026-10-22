pub mod workspace;

use std::path::PathBuf;

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
