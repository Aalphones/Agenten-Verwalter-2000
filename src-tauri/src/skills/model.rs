use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Woher ein Skill oder Befehl stammt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SkillOrigin {
    User,
    Repository { name: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SkillKind {
    Skill,
    Command,
}

/// Ein Eintrag des `/`-Menüs.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub kind: SkillKind,
    pub origin: SkillOrigin,
}

/// Der Skill, den eine gesendete Nachricht aufruft; hängt am Chat-Eintrag.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SkillRef {
    pub name: String,
    pub origin: SkillOrigin,
}
