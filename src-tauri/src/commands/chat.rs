use crate::agents::event::QuestionAnswer;
use crate::error::CommandError;
use crate::review::model::ReviewComment;
use crate::sessions::model::ChatPage;
use crate::sessions::registry::SessionRegistry;

#[tauri::command]
pub async fn chat_history(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    before: Option<u32>,
    limit: u32,
) -> Result<ChatPage, CommandError> {
    registry.history(&session_id, before, limit)
}

#[tauri::command]
pub async fn chat_send(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    text: String,
    attachment_ids: Vec<String>,
    comments: Vec<ReviewComment>,
) -> Result<(), CommandError> {
    registry.send(&app, &session_id, &text, &attachment_ids, &comments)
}

#[tauri::command]
pub async fn chat_answer(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    request_id: String,
    answer: QuestionAnswer,
) -> Result<(), CommandError> {
    registry.answer(&app, &session_id, &request_id, &answer)
}
