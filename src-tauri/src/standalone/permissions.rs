//! Rechte je Werkzeug und Modus (ADR 017): was ohne Rückfrage läuft, was der Benutzer erlauben
//! muss und was abgelehnt wird. Einen Sicherheits-Klassifizierer wie Claude im Modus Auto gibt es
//! nicht — dort laufen Befehle ungefragt.
use super::paths::Access;
use super::tools::{
    AGENT_TOOL, ASK_USER_TOOL, BASH_TOOL, EDIT_TOOL, GLOB_TOOL, GREP_TOOL, POWERSHELL_TOOL,
    READ_TOOL, SKILL_TOOL, TASK_STOP_TOOL, TODO_TOOL, WRITE_TOOL, is_writing,
};
use crate::agents::event::Mode;

pub const PLAN_MODE_DENIAL: &str = "Im Modus Planen sind keine Änderungen erlaubt.";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Ask,
    Deny(String),
}

/// `access`: Pfadgrenze für den Pfad des Aufrufs, `None` bei Werkzeugen ohne Pfad. Ein Pfad
/// außerhalb fragt in jedem Modus nach — auch bei reinen Lese-Werkzeugen.
pub fn decide(tool: &str, mode: Mode, access: Option<Access>) -> Decision {
    match access {
        Some(Access::Outside) => return Decision::Ask,
        Some(Access::ReadOnly) if is_writing(tool) => {
            return Decision::Deny("Nur lesbar: Ordner ~/.claude".to_owned());
        }
        _ => {}
    }
    match tool {
        // `TaskStop` beendet nur, was das Modell selbst im Hintergrund gestartet hat.
        READ_TOOL | GLOB_TOOL | GREP_TOOL | TODO_TOOL | SKILL_TOOL | TASK_STOP_TOOL => {
            Decision::Allow
        }
        WRITE_TOOL | EDIT_TOOL => match mode {
            Mode::Manual => Decision::Ask,
            Mode::Edit | Mode::Auto => Decision::Allow,
            Mode::Plan => Decision::Deny(PLAN_MODE_DENIAL.to_owned()),
        },
        BASH_TOOL | POWERSHELL_TOOL => match mode {
            Mode::Auto => Decision::Allow,
            Mode::Manual | Mode::Edit | Mode::Plan => Decision::Ask,
        },
        ASK_USER_TOOL => Decision::Ask,
        // Die Werkzeuge des Subagenten fragen selbst.
        AGENT_TOOL => Decision::Allow,
        // Ein Werkzeug, das hier fehlt, fragt — neue Werkzeuge sind nie stillschweigend frei.
        _ => Decision::Ask,
    }
}
