//! Typen der Hinweise im Verlauf (ADR 033).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::agents::event::ModelId;

/// Ein abgelehnter Werkzeugaufruf — von einer Regel oder vom User.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Denial {
    pub tool: String,
    /// Worauf das Werkzeug zielte, eine Zeile wie bei `ChatEntry::Tool`.
    pub target: String,
}

/// Was ein Hinweis im Verlauf festhält (`ChatEntry::Notice`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Notice {
    /// Claude hat den bisherigen Verlauf durch eine Kurzfassung ersetzt. `trigger` ist `manual`
    /// oder `auto`; ohne `compact_metadata` (Agent „Autark“) fehlen alle drei Angaben.
    Compacted {
        trigger: Option<String>,
        pre_tokens: Option<u32>,
        post_tokens: Option<u32>,
        /// Text der Kurzfassung; kommt erst nach der Trennlinie.
        summary: Option<String>,
    },
    /// Der User hat das Modell gewechselt, obwohl ein Prompt-Cache bestand.
    ModelSwitched {
        from: ModelId,
        to: ModelId,
        /// Token, die die nächste Nachricht neu schreibt.
        recache_tokens: u32,
    },
}
