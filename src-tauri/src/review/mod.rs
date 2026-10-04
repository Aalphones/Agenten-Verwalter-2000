//! Review-Kommentare aus der Changes-Ansicht: Prüfung beim Senden und der Text, den der Agent
//! dazu bekommt.
pub mod model;

use std::path::PathBuf;

use crate::changes::model::DiffLineKind;
use crate::error::CommandError;
use crate::review::model::ReviewComment;

const MIN_FENCE_LENGTH: usize = 3;
const FENCE_CHARACTER: char = '`';

/// Ein Kommentar auf einem Abschnittskopf oder ohne Text kann die Oberfläche nicht erzeugen —
/// kommt er an, ist etwas kaputt, und es wird nichts gesendet.
pub fn validate(comments: &[ReviewComment]) -> Result<(), CommandError> {
    for comment in comments {
        if comment.kind == DiffLineKind::Hunk {
            return Err(CommandError::Internal(
                "Review-Kommentar auf einem Abschnittskopf".to_owned(),
            ));
        }
        if comment.text.trim().is_empty() {
            return Err(CommandError::Internal("Leerer Review-Kommentar".to_owned()));
        }
    }
    Ok(())
}

/// Der Text einer Nachricht samt Kommentaren. `folders[index]` ist der aufgelöste Ordner zu
/// `comments[index]`; ohne Ordner nennt der Ort den Repository-Namen. Ohne Kommentare bleibt der
/// Text unverändert.
pub fn agent_text(text: &str, comments: &[ReviewComment], folders: &[Option<PathBuf>]) -> String {
    if comments.is_empty() {
        return text.to_owned();
    }
    let items: Vec<String> = comments
        .iter()
        .enumerate()
        .map(|(index, comment): (usize, &ReviewComment)| {
            let folder: Option<&PathBuf> = folders.get(index).and_then(Option::as_ref);
            let fence = fence(&comment.code);
            format!(
                "{}. {}\n{fence}\n{}{}\n{fence}\n{}",
                index + 1,
                location(comment, folder),
                sign(comment.kind),
                comment.code,
                comment.text,
            )
        })
        .collect();
    let mut result = String::new();
    // Das Voranstellen lässt ein `/skill` am Anfang der Nachricht stehen.
    if !text.is_empty() {
        result.push_str(text);
        result.push_str("\n\n");
    }
    result.push_str(&format!(
        "Review-Kommentare zu den Changes ({}):\n\n{}",
        comments.len(),
        items.join("\n\n")
    ));
    result
}

fn location(comment: &ReviewComment, folder: Option<&PathBuf>) -> String {
    let path: String = match folder {
        Some(folder) => {
            let mut full: PathBuf = folder.clone();
            for part in comment.path.split('/') {
                full.push(part);
            }
            full.display().to_string()
        }
        None => format!("{}/{}", comment.repository_name, comment.path),
    };
    match comment.kind {
        DiffLineKind::Deleted => format!("{path} — gelöschte Zeile, vorher Zeile {}", comment.line),
        _ => format!("{path}:{}", comment.line),
    }
}

fn sign(kind: DiffLineKind) -> &'static str {
    match kind {
        DiffLineKind::Added => "+ ",
        DiffLineKind::Deleted => "- ",
        DiffLineKind::Context => "  ",
        DiffLineKind::Hunk => "",
    }
}

/// Länger als jede Backtick-Folge im Code, damit der Code den Zaun nicht beenden kann.
fn fence(code: &str) -> String {
    let mut longest_run: usize = 0;
    let mut current_run: usize = 0;
    for character in code.chars() {
        if character == FENCE_CHARACTER {
            current_run += 1;
            longest_run = longest_run.max(current_run);
        } else {
            current_run = 0;
        }
    }
    FENCE_CHARACTER
        .to_string()
        .repeat((longest_run + 1).max(MIN_FENCE_LENGTH))
}
