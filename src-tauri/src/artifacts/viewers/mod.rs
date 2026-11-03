//! Betrachter-Seiten für Artefakte, die keine HTML-Seite sind (ADR 047). Der Artefakt-Server
//! liefert sie unter `<datei>?view=1` aus; die Seite holt die Datei selbst per `fetch` aus
//! demselben Ordner und läuft im selben abgeschotteten Rahmen wie eine HTML-Seite.
use super::model::ArtifactKind;

const SHELL: &str = include_str!("shell.html");
const COMMON: &str = include_str!("common.js");
const IMAGE: &str = include_str!("image.js");
const VIDEO: &str = include_str!("video.js");
const AUDIO: &str = include_str!("audio.js");
const TEXT: &str = include_str!("text.js");
const MARKDOWN: &str = include_str!("markdown.js");

/// Das Skript des Betrachters für den Typ; `None` → die Oberfläche zeigt die Rest-Karte. Ein neuer
/// Betrachter ist eine `.js` daneben und eine Zeile hier.
pub fn page(kind: ArtifactKind) -> Option<&'static str> {
    match kind {
        ArtifactKind::Image => Some(IMAGE),
        ArtifactKind::Video => Some(VIDEO),
        ArtifactKind::Audio => Some(AUDIO),
        ArtifactKind::Text | ArtifactKind::Code | ArtifactKind::Log | ArtifactKind::Diff => {
            Some(TEXT)
        }
        ArtifactKind::Markdown => Some(MARKDOWN),
        _ => None,
    }
}

/// Die fertige Betrachter-Seite für `file`, ohne Kommentar-Brücke (die hängt der Server an).
pub fn render(kind: ArtifactKind, file: &str) -> Option<String> {
    let script = page(kind)?;
    // Erst die Skripte, zuletzt der Dateiname: so kann kein Name einen Platzhalter tragen,
    // der danach noch ersetzt würde.
    Some(
        SHELL
            .replace("__COMMON__", COMMON)
            .replace("__SCRIPT__", script)
            .replace("__KIND__", &script_string(kind.as_str()))
            .replace("__FILE__", &script_string(file)),
    )
}

/// Ein JSON-String, der in einem `<script>` stehen darf: `</` beendet sonst das Element.
fn script_string(text: &str) -> String {
    serde_json::Value::String(text.to_owned())
        .to_string()
        .replace("</", "<\\/")
}
