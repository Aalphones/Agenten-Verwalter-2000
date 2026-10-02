//! Was zu einer Session gehört: eigene Commits, geschriebene Dateien (ADR 014).

const VERBATIM_PREFIX: &str = "\\\\?\\";

/// Windows-Pfade unterscheiden keine Groß-/Kleinschreibung; so vergleicht die App, was der Agent
/// schrieb, mit dem, was Git meldet.
pub fn normalize_path(path: &str) -> String {
    let without_prefix = path.strip_prefix(VERBATIM_PREFIX).unwrap_or(path);
    without_prefix
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}
