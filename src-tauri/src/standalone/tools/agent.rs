//! Beschreibung des Werkzeugs `Agent` fürs Modell. Ausgeführt wird es nicht hier, sondern in
//! `standalone::subagent` — ein Subagent braucht die ganze Werkzeug-Schleife, nicht nur den
//! `ToolContext`.
use serde_json::{Value, json};

use super::{AGENT_TOOL, function};
use crate::standalone::agents::AgentDefinition;

/// Die Beschreibung listet die verfügbaren Typen, damit das Modell `subagent_type` wählen kann.
pub fn definition(agents: &[AgentDefinition]) -> Value {
    let types: Vec<String> = agents
        .iter()
        .map(|agent: &AgentDefinition| format!("- {}: {}", agent.name, agent.description))
        .collect();
    let description = format!(
        "Starts a subagent with its own context for a self-contained task (searching across many \
         files, a focused change, a review). It sees nothing of this conversation: put everything \
         it needs into prompt. In the foreground its final report is the result; with \
         run_in_background the result is a start message and the report arrives later as a new \
         message. Available subagent types:\n{}",
        types.join("\n")
    );
    function(
        AGENT_TOOL,
        &description,
        json!({
            "description": { "type": "string", "description": "Short title of the task, 3-5 words" },
            "prompt": { "type": "string", "description": "The complete task for the subagent" },
            "subagent_type": { "type": "string", "description": "Type of subagent; default general-purpose" },
            "run_in_background": { "type": "boolean", "description": "Return at once; the report arrives as a new message" },
        }),
        &["description", "prompt"],
    )
}
