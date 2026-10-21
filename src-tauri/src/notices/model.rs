//! Typen der Hinweise im Verlauf (ADR 033).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Ein abgelehnter Werkzeugaufruf — von einer Regel oder vom User.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Denial {
    pub tool: String,
    /// Worauf das Werkzeug zielte, eine Zeile wie bei `ChatEntry::Tool`.
    pub target: String,
}
